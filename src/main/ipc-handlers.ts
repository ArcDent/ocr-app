import { ipcMain, dialog, app, IpcMainInvokeEvent } from 'electron'
import * as fs from 'node:fs/promises'
import * as path from 'path'
import { IPC_CHANNELS, type IpcRequest, type IpcResponse } from '../shared/types'
import { configStore } from './store'
import { TextInClient } from './ocr/textin-client'
import { LlmClient } from './llm/llm-client'
import { Orchestrator } from './pipeline/orchestrator'
import { HistoryManager } from './history/history-manager'
import { exportBatch } from './export/markdown-exporter'

// Extensions supported by both the file picker filter and the TextIn API.
// Keep in sync with the `filters` array in the OCR_PICK_FILES handler.
const SUPPORTED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'pdf']

/**
 * Recursively collect files under `dir` whose extension is supported.
 * Expanding directories here (rather than returning the directory path) is
 * what prevents EISDIR when TextInClient.recognizeFile later calls fs.readFile
 * on the picked path.
 */
async function collectSupportedFiles(dir: string): Promise<string[]> {
  let entries: import('node:fs').Dirent[]
  try {
    entries = await fs.readdir(dir, { withFileTypes: true })
  } catch {
    return []
  }
  const collected: string[] = []
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      collected.push(...(await collectSupportedFiles(full)))
    } else if (
      SUPPORTED_EXTENSIONS.includes(path.extname(entry.name).slice(1).toLowerCase())
    ) {
      collected.push(full)
    }
  }
  return collected
}

let historyManager: HistoryManager | null = null
let currentOrchestrator: Orchestrator | null = null

export function registerIpcHandlers() {
  if (!historyManager) {
    historyManager = new HistoryManager(app.getPath('userData'))
  }

  // SETTINGS
  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET, (): IpcResponse['settings:get'] => {
    return configStore.getSettings()
  })

  ipcMain.handle(
    IPC_CHANNELS.SETTINGS_SET,
    (_, data: IpcRequest['settings:set']): IpcResponse['settings:set'] => {
      configStore.setSettings(data)
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.SETTINGS_TEST_OCR,
    async (): Promise<IpcResponse['settings:test-ocr']> => {
      const settings = configStore.getSettings()
      if (!settings.textin.appId || !settings.textin.secretCode) {
        return { success: false, message: 'OCR API keys not configured' }
      }
      try {
        const client = new TextInClient(settings.textin)
        return await client.testConnection()
      } catch (error) {
        return { success: false, message: error instanceof Error ? error.message : String(error) }
      }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.SETTINGS_TEST_LLM,
    async (): Promise<IpcResponse['settings:test-llm']> => {
      const settings = configStore.getSettings()
      if (!settings.llm.apiKey) {
        return { success: false, message: 'LLM API key not configured' }
      }
      try {
        const client = new LlmClient(settings.llm)
        return await client.testConnection()
      } catch (error) {
        return { success: false, message: error instanceof Error ? error.message : String(error) }
      }
    }
  )

  // OCR_PICK_FILES
  ipcMain.handle(
    IPC_CHANNELS.OCR_PICK_FILES,
    async (_, data: IpcRequest['ocr:pick-files']): Promise<IpcResponse['ocr:pick-files']> => {
      if (data.type === 'directory') {
        // Pick directories, then expand each into its supported files.
        // Returning directory paths directly causes EISDIR downstream when
        // TextInClient.recognizeFile calls fs.readFile on a directory.
        const result = await dialog.showOpenDialog({
          properties: ['openDirectory', 'multiSelections'],
          title: '选择文件夹',
        })
        if (result.canceled) return []
        const files: string[] = []
        for (const dir of result.filePaths) {
          files.push(...(await collectSupportedFiles(dir)))
        }
        return files
      }

      const result = await dialog.showOpenDialog({
        properties: ['openFile', 'multiSelections'],
        filters: [{ name: 'Images & PDFs', extensions: SUPPORTED_EXTENSIONS }],
      })
      if (result.canceled) return []
      return result.filePaths
    }
  )

  // OCR_START_BATCH
  ipcMain.handle(
    IPC_CHANNELS.OCR_START_BATCH,
    async (event: IpcMainInvokeEvent, data: IpcRequest['ocr:start-batch']): Promise<IpcResponse['ocr:start-batch']> => {
      const settings = configStore.getSettings()
      const missing: string[] = []
      if (!settings.textin.appId) missing.push('TextIn appId')
      if (!settings.textin.secretCode) missing.push('TextIn secretCode')
      if (!settings.llm.apiKey) missing.push('LLM apiKey')
      if (!settings.llm.model) missing.push('LLM model')
      if (!settings.llm.baseUrl) missing.push('LLM baseUrl')
      if (missing.length > 0) {
        throw new Error(`配置缺失：${missing.join('、')}，请先在设置中填写`)
      }

      const textin = new TextInClient(settings.textin)
      const llm = new LlmClient(settings.llm)
      currentOrchestrator = new Orchestrator(textin, llm, {
        concurrency: settings.concurrency,
        chunkThreshold: settings.chunkThreshold,
      })

      const onProgress = (job: any) => {
        event.sender.send(IPC_CHANNELS.ON_JOB_PROGRESS, job)
      }

      try {
        const stats = await currentOrchestrator.startBatch(data.paths, data.mode, onProgress)

        // Save completed results to history
        if (historyManager) {
          for (const job of currentOrchestrator.getJobs()) {
            if (job.stage === 'done') {
              const result = currentOrchestrator.getResult(job.jobId)
              if (result) {
                try {
                  await historyManager.saveResult(result)
                } catch (error) {
                  console.error(`Failed to save history for ${job.jobId}:`, error)
                }
              }
            }
          }
        }

        event.sender.send(IPC_CHANNELS.ON_BATCH_DONE, stats)
      } finally {
        currentOrchestrator = null
      }
    }
  )

  ipcMain.handle(IPC_CHANNELS.OCR_CANCEL, async (): Promise<IpcResponse['ocr:cancel']> => {
    if (currentOrchestrator) {
      currentOrchestrator.cancel()
    }
  })

  ipcMain.handle(
    IPC_CHANNELS.OCR_GET_RESULT,
    async (_, data: IpcRequest['ocr:get-result']): Promise<IpcResponse['ocr:get-result']> => {
      const inMemory = currentOrchestrator?.getResult(data.jobId)
      if (inMemory) return inMemory
      if (historyManager) {
        return await historyManager.getJob(data.jobId)
      }
      return null
    }
  )

  // DIALOG
  ipcMain.handle(
    IPC_CHANNELS.DIALOG_PICK_EXPORT_DIR,
    async (): Promise<IpcResponse['dialog:pick-export-dir']> => {
      const result = await dialog.showOpenDialog({
        properties: ['openDirectory', 'createDirectory'],
        title: '选择导出目录',
        buttonLabel: '选择',
      })
      if (result.canceled || result.filePaths.length === 0) {
        return null
      }
      return result.filePaths[0]
    }
  )

  // EXPORT
  ipcMain.handle(
    IPC_CHANNELS.EXPORT_BATCH,
    async (_, data: IpcRequest['export:batch']): Promise<IpcResponse['export:batch']> => {
      if (!historyManager) return { success: false, exportedCount: 0, failedCount: 0, error: '历史管理未初始化' }
      const results = await Promise.all(data.jobIds.map((id) => historyManager!.getJob(id)))
      const validResults = results.filter((r): r is NonNullable<typeof r> => r !== null)
      if (validResults.length === 0) {
        return { success: false, exportedCount: 0, failedCount: 0, error: '没有可导出的结果' }
      }
      try {
        const { success, failed } = await exportBatch(validResults, data.outputDir)
        return {
          success: success > 0 && failed === 0,
          exportedCount: success,
          failedCount: failed,
        }
      } catch (error) {
        console.error('Export error:', error)
        return {
          success: false,
          exportedCount: 0,
          failedCount: 0,
          error: error instanceof Error ? error.message : String(error),
        }
      }
    }
  )

  // HISTORY
  ipcMain.handle(IPC_CHANNELS.HISTORY_LIST, async (): Promise<IpcResponse['history:list']> => {
    return historyManager?.listHistory() || []
  })

  ipcMain.handle(
    IPC_CHANNELS.HISTORY_GET,
    async (_, data: IpcRequest['history:get']): Promise<IpcResponse['history:get']> => {
      if (!historyManager) return null
      return await historyManager.getJob(data.jobId)
    }
  )

  ipcMain.handle(IPC_CHANNELS.HISTORY_CLEAR, async (): Promise<IpcResponse['history:clear']> => {
    if (historyManager) {
      await historyManager.clearHistory()
    }
  })
}
