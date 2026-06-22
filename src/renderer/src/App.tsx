import { useEffect, useState } from 'react'
import { Copy, Folder, Play, Settings, StopCircle, Upload, Download } from 'lucide-react'
import { toast } from 'sonner'
import { FileQueueList } from './components/FileQueueList'
import { ResultDetail, type ResultTab } from './components/ResultDetail'
import { ConfigDialog } from './components/ConfigDialog'
import { useOcrStore } from './stores/useOcrStore'
import { useSettingsStore } from './stores/useSettingsStore'


export default function App() {
  const [isConfigOpen, setIsConfigOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<ResultTab>('structured')
  const [copySuccess, setCopySuccess] = useState(false)


  // Settings state
  const { loadSettings, isLoaded: isSettingsLoaded } = useSettingsStore()

  // OCR state
  const {
    jobs,
    pendingFiles,
    results,
    isProcessing,
    mode,
    selectedJobId,
    setMode,
    selectJob,
    pickFiles,
    startBatch,
    cancelBatch,
    clearJobs,
    exportBatch
  } = useOcrStore()

  // Initialize
  useEffect(() => {
    if (!isSettingsLoaded) {
      loadSettings()
    }
  }, [isSettingsLoaded, loadSettings])

  // Convert jobs record to array for the list
  const jobList = Object.values(jobs)
  const hasQueuedFiles = jobList.length > 0 || pendingFiles.length > 0

  const handleExport = async () => {
    let outputDir: string | null
    try {
      // @ts-ignore
      outputDir = await window.api.invoke('dialog:pick-export-dir')
    } catch (err) {
      toast.error('导出失败：' + (err as Error).message)
      return
    }
    if (!outputDir) return // User cancelled

    const result = await exportBatch(outputDir)
    if (result.success) {
      toast.success(`成功导出 ${result.exportedCount} 个结果`)
    } else if (result.exportedCount > 0 && result.failedCount > 0) {
      toast.warning(`导出 ${result.exportedCount} 个，失败 ${result.failedCount} 个`)
    } else {
      toast.error('导出失败：' + (result.error || '没有可导出的结果'))
    }
  }

  const currentResult = selectedJobId ? results[selectedJobId] || null : null

  const currentContent = (() => {
    if (!currentResult) return ''
    switch (activeTab) {
      case 'structured':
        return currentResult.structuredText
      case 'summary':
        return currentResult.summary
      case 'raw':
        return currentResult.rawText
    }
  })()

  const handleCopy = async () => {
    if (!currentContent) {
      toast.info('当前没有可复制的内容')
      return
    }
    try {
      await navigator.clipboard.writeText(currentContent)
      setCopySuccess(true)
      setTimeout(() => setCopySuccess(false), 2000)
    } catch (err) {
      toast.error('复制失败：' + (err as Error).message)
    }
  }

  // macOS keeps the native traffic lights on the left; Windows/Linux render
  // the min/max/close overlay at the right edge, so reserve a right strip on
  // those platforms to keep the settings button clear of the native controls.
  const isMac =
    typeof navigator !== 'undefined' &&
    /Mac|iPhone|iPod|iPad/.test(navigator.platform || navigator.userAgent)
  const headerPadRight = isMac ? '' : 'pr-[140px]'

  return (
    <div className="h-screen flex flex-col bg-paper text-ink overflow-hidden">
      {/* Header — also the window drag region (titleBarStyle: 'hidden' in main).
          headerPadRight reserves space for the Windows/Linux titleBarOverlay
          min/max/close controls so the settings button never sits under them. */}
      <header
        className={`bg-paper-2 border-b border-line px-6 py-5 flex items-center justify-start shrink-0 z-10 ${headerPadRight}`}
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <div className="flex items-center gap-3">
          {/* Vermilion seal logo — custom SVG, replaces the ugly "文" placeholder */}
          <svg
            width="32"
            height="32"
            viewBox="0 0 32 32"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-label="OCR App"
            className="shrink-0"
          >
            <rect x="1" y="1" width="30" height="30" rx="5" fill="var(--vermilion)" />
            <rect x="1" y="1" width="30" height="30" rx="5" fill="none" stroke="var(--vermilion-2)" strokeWidth="1" opacity="0.5" />
            {/* Abstract "字" stroke geometry — two horizontal bars + a triangle, like a seal carving / OCR scan lines */}
            <rect x="9" y="9" width="14" height="2.2" rx="1" fill="var(--paper)" />
            <rect x="9" y="14.5" width="14" height="2.2" rx="1" fill="var(--paper)" />
            <path d="M16 17.5 L22 24 L10 24 Z" fill="var(--paper)" />
          </svg>
          <div className="w-1 h-8 bg-vermilion rounded-sm"></div>
          <div>
            <p className="font-display text-lg font-bold text-ink leading-tight">OCR 结构化工坊</p>
            <p className="text-xs text-ink-3 leading-tight mt-1">OCR + AI 结构化处理</p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden gap-4 p-4">
        {/* Left Panel: Controls & Queue */}
        <div className="w-80 flex flex-col bg-paper-2 rounded-xl shadow-card border border-line overflow-hidden">
          {/* Controls */}
          <div className="p-5 border-b border-line">
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => pickFiles('files')}
                disabled={isProcessing}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 bg-paper border border-line rounded-md text-sm font-medium text-ink-2 hover:border-vermilion hover:bg-vermilion-soft hover:text-vermilion disabled:opacity-50 disabled:hover:border-line disabled:hover:bg-paper disabled:hover:text-ink-2 transition-all duration-200"
              >
                <Upload className="w-4 h-4" />
                选择文件
              </button>
              <button
                onClick={() => pickFiles('directory')}
                disabled={isProcessing}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 bg-paper border border-line rounded-md text-sm font-medium text-ink-2 hover:border-vermilion hover:bg-vermilion-soft hover:text-vermilion disabled:opacity-50 disabled:hover:border-line disabled:hover:bg-paper disabled:hover:text-ink-2 transition-all duration-200"
              >
                <Folder className="w-4 h-4" />
                选择文件夹
              </button>
            </div>

            <div className="mb-4">
              <label className="block text-xs font-semibold text-ink-3 uppercase tracking-wider mb-2.5">
                处理模式
              </label>
              <div className="flex rounded-md overflow-hidden border border-line bg-paper">
                <button
                  onClick={() => setMode('faithful')}
                  disabled={isProcessing}
                  className={`flex-1 py-2.5 text-sm font-medium transition-all duration-200 ${
                    mode === 'faithful'
                      ? 'bg-ink text-paper shadow-card'
                      : 'bg-paper text-ink-2 hover:bg-paper-2'
                  }`}
                >
                  忠实提取
                </button>
                <button
                  onClick={() => setMode('enhanced')}
                  disabled={isProcessing}
                  className={`flex-1 py-2.5 text-sm font-medium border-l border-line transition-all duration-200 ${
                    mode === 'enhanced'
                      ? 'bg-ink text-paper shadow-card'
                      : 'bg-paper text-ink-2 hover:bg-paper-2'
                  }`}
                >
                  增强摘要
                </button>
              </div>
            </div>

            {!isProcessing ? (
              <button
                onClick={startBatch}
                disabled={!hasQueuedFiles}
                className="w-full flex items-center justify-center gap-2 py-3 bg-vermilion text-white rounded-md font-semibold hover:bg-vermilion-2 disabled:bg-ink-3 disabled:cursor-not-allowed transition-all duration-200 shadow-card active:animate-seal-press"
              >
                <Play className="w-5 h-5" />
                开始处理
              </button>
            ) : (
              <button
                onClick={cancelBatch}
                className="w-full flex items-center justify-center gap-2 py-3 bg-paper border border-red-300 text-red-700 rounded-md font-semibold hover:bg-red-soft transition-all duration-200"
              >
                <StopCircle className="w-5 h-5" />
                取消处理
              </button>
            )}
          </div>

          {/* Queue List */}
          <div className="flex-1 overflow-hidden">
            <FileQueueList
              jobs={jobList}
              pendingFiles={pendingFiles}
              selectedJobId={selectedJobId}
              onSelectJob={selectJob}
              onClear={clearJobs}
              isProcessing={isProcessing}
            />
          </div>
        </div>

        {/* Right Panel: Result Details */}
        <div className="flex-1 flex flex-col bg-paper-2 rounded-xl shadow-card border border-line overflow-hidden">
          {/* Toolbar — settings button lives here, above the result/summary area */}
          <div className="px-4 py-2.5 border-b border-line bg-paper-2 flex justify-end shrink-0">
            <button
              onClick={() => setIsConfigOpen(true)}
              className="p-2 text-ink-2 hover:text-ink hover:bg-paper rounded-lg transition-all duration-200"
              title="设置"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-hidden">
            <ResultDetail
              result={currentResult}
              activeTab={activeTab}
              onActiveTabChange={setActiveTab}
            />
          </div>

          {/* Bottom Action Bar */}
          <div className="bg-paper-2 border-t border-line p-4 flex justify-end gap-3 shrink-0">
            <button
              onClick={handleCopy}
              disabled={!currentResult || !currentContent}
              className={`flex items-center gap-2 px-5 py-2.5 border rounded-md text-sm font-semibold focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 ${
                copySuccess
                  ? 'border-seal text-seal bg-seal-soft'
                  : 'border-line text-ink-2 bg-paper hover:bg-paper-2 hover:text-ink'
              }`}
              title="复制当前内容到剪贴板"
            >
              <Copy className="w-4 h-4" />
              {copySuccess ? '已复制' : '复制内容'}
            </button>
            <button
              onClick={handleExport}
              disabled={Object.keys(results).length === 0 || isProcessing}
              className="flex items-center gap-2 px-5 py-2.5 border border-seal text-seal rounded-md text-sm font-semibold bg-paper hover:bg-seal-soft focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-paper transition-all duration-200"
            >
              <Download className="w-4 h-4" />
              导出所有结果
            </button>
          </div>
        </div>
      </div>

      <ConfigDialog
        isOpen={isConfigOpen}
        onClose={() => setIsConfigOpen(false)}
      />
    </div>
  )
}
