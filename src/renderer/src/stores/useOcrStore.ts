import { create } from 'zustand'
import { IPC_CHANNELS, JobResult, OcrJob, ProcessMode } from '../../../shared/types'

interface OcrState {
  // State
  jobs: Record<string, OcrJob>
  results: Record<string, JobResult>
  isProcessing: boolean
  mode: ProcessMode
  selectedJobId: string | null

  // Computed (will use derived state pattern in component)
  // jobList: OcrJob[]

  // Actions
  setMode: (mode: ProcessMode) => void
  selectJob: (jobId: string | null) => void

  // IPC Operations
  pickFiles: (type: 'files' | 'directory') => Promise<void>
  startBatch: () => Promise<void>
  cancelBatch: () => Promise<void>
  fetchResult: (jobId: string) => Promise<void>
  exportBatch: (outputDir: string) => Promise<{ success: boolean; exportedCount: number }>
  clearJobs: () => void

  // Event Handlers
  handleJobProgress: (job: OcrJob) => void
  handleBatchDone: (stats: { total: number; success: number; failed: number }) => void
}

export const useOcrStore = create<OcrState>((set, get) => {
  // Set up event listeners once during initialization
  if (typeof window !== 'undefined' && (window as any).api) {
    (window as any).api.on(IPC_CHANNELS.ON_JOB_PROGRESS, (_event: any, job: OcrJob) => {
      get().handleJobProgress(job)

      // Auto-fetch result when a job is done
      if (job.stage === 'done') {
        get().fetchResult(job.jobId)
      }
    });

    (window as any).api.on(IPC_CHANNELS.ON_BATCH_DONE, (_event: any, stats: any) => {
      get().handleBatchDone(stats)
    })
  }

  return {
    jobs: {},
    results: {},
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
          // Add queued jobs to state
          const newJobs: Record<string, OcrJob> = { ...get().jobs }

          paths.forEach((path: string) => {
            // Generate a temporary ID that matches what backend will create
            // The backend creates IDs like 'job_<timestamp>_<random>'
            // We just create placeholders until backend reports progress
            const tempId = `temp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`

            // Extract filename from path
            const fileName = path.split(/[\\/]/).pop() || 'Unknown File'

            newJobs[tempId] = {
              jobId: tempId,
              filePath: path,
              fileName,
              stage: 'queued'
            }
          })

          set({ jobs: newJobs })
        }
      } catch (err) {
        console.error('Failed to pick files:', err)
      }
    },

    startBatch: async () => {
      const state = get()
      if (state.isProcessing) return

      // Get paths from queued jobs
      const paths = Object.values(state.jobs)
        .filter(j => j.stage === 'queued' || j.stage === 'error')
        .map(j => j.filePath)

      if (paths.length === 0) return

      // Clear old jobs and results, keep only files we're processing
      // We rely on backend to send correct job updates which will overwrite temp IDs
      set({ isProcessing: true })

      try {
        await (window as any).api.invoke(IPC_CHANNELS.OCR_START_BATCH, {
          paths,
          mode: state.mode
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
          set(state => ({
            results: { ...state.results, [jobId]: result }
          }))
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
      set({ jobs: {}, results: {}, selectedJobId: null })
    },

    handleJobProgress: (job) => {
      set(state => {
        const newJobs = { ...state.jobs }

        // If this is a real job replacing a temp job, try to find and remove the temp job
        if (!job.jobId.startsWith('temp_')) {
          const tempJobId = Object.keys(newJobs).find(id =>
            id.startsWith('temp_') && newJobs[id].filePath === job.filePath
          )
          if (tempJobId) {
            delete newJobs[tempJobId]
          }
        }

        newJobs[job.jobId] = job
        return { jobs: newJobs }
      })
    },

    handleBatchDone: () => {
      set({ isProcessing: false })
    }
  }
})
