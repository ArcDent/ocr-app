import { create } from 'zustand'
import { IPC_CHANNELS, JobResult, OcrJob, ProcessMode } from '../../../shared/types'

interface PendingFile {
  path: string
  fileName: string
}

interface OcrState {
  jobs: Record<string, OcrJob>
  results: Record<string, JobResult>
  pendingFiles: PendingFile[]
  isProcessing: boolean
  mode: ProcessMode
  selectedJobId: string | null

  setMode: (mode: ProcessMode) => void
  selectJob: (jobId: string | null) => void

  pickFiles: (type: 'files' | 'directory') => Promise<void>
  startBatch: () => Promise<void>
  cancelBatch: () => Promise<void>
  fetchResult: (jobId: string) => Promise<void>
  exportBatch: (outputDir: string) => Promise<{ success: boolean; exportedCount: number }>
  clearJobs: () => void

  handleJobProgress: (job: OcrJob) => void
  handleBatchDone: (stats: { total: number; success: number; failed: number }) => void
}

export const useOcrStore = create<OcrState>((set, get) => {
  if (typeof window !== 'undefined' && (window as any).api) {
    ;(window as any).api.on(IPC_CHANNELS.ON_JOB_PROGRESS, (_event: any, job: OcrJob) => {
      get().handleJobProgress(job)
      if (job.stage === 'done') {
        get().fetchResult(job.jobId)
      }
    })

    ;(window as any).api.on(IPC_CHANNELS.ON_BATCH_DONE, (_event: any, stats: any) => {
      get().handleBatchDone(stats)
    })
  }

  return {
    jobs: {},
    results: {},
    pendingFiles: [],
    isProcessing: false,
    mode: 'faithful',
    selectedJobId: null,

    setMode: (mode) => set({ mode }),

    selectJob: (jobId) => set({ selectedJobId: jobId }),

    pickFiles: async (type) => {
      if (get().isProcessing) return
      try {
        const paths = await (window as any).api.invoke(IPC_CHANNELS.OCR_PICK_FILES, { type })
        if (paths && paths.length > 0) {
          const newPending: PendingFile[] = paths.map((p: string) => ({
            path: p,
            fileName: p.split(/[\\/]/).pop() || 'Unknown File',
          }))
          set({ pendingFiles: [...get().pendingFiles, ...newPending] })
        }
      } catch (err) {
        console.error('Failed to pick files:', err)
      }
    },

    startBatch: async () => {
      const state = get()
      if (state.isProcessing) return
      const paths = state.pendingFiles.map((f) => f.path)
      if (paths.length === 0) return

      set({ isProcessing: true, pendingFiles: [] })

      try {
        await (window as any).api.invoke(IPC_CHANNELS.OCR_START_BATCH, {
          paths,
          mode: state.mode,
        })
      } catch (err) {
        console.error('Failed to start batch:', err)
        set({ isProcessing: false })
      }
    },

    cancelBatch: async () => {
      if (!get().isProcessing) return
      try {
        await (window as any).api.invoke(IPC_CHANNELS.OCR_CANCEL, undefined)
      } catch (err) {
        console.error('Failed to cancel batch:', err)
      }
    },

    fetchResult: async (jobId) => {
      try {
        const result = await (window as any).api.invoke(IPC_CHANNELS.OCR_GET_RESULT, { jobId })
        if (result) {
          set((state) => ({ results: { ...state.results, [jobId]: result } }))
        }
      } catch (err) {
        console.error(`Failed to fetch result for job ${jobId}:`, err)
      }
    },

    exportBatch: async (outputDir) => {
      const jobIds = Object.keys(get().results)
      if (jobIds.length === 0) return { success: false, exportedCount: 0 }
      try {
        return await (window as any).api.invoke(IPC_CHANNELS.EXPORT_BATCH, { jobIds, outputDir })
      } catch (err) {
        console.error('Failed to export batch:', err)
        return { success: false, exportedCount: 0 }
      }
    },

    clearJobs: () => {
      if (get().isProcessing) return
      set({ jobs: {}, results: {}, pendingFiles: [], selectedJobId: null })
    },

    handleJobProgress: (job) => {
      set((state) => ({
        jobs: { ...state.jobs, [job.jobId]: job },
      }))
    },

    handleBatchDone: () => {
      set({ isProcessing: false })
    },
  }
})
