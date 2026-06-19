
import { Check, FileText, Loader2, XCircle, Clock } from 'lucide-react'
import { JobStage, OcrJob } from '../../../shared/types'

interface PendingFile {
  path: string
  fileName: string
}

interface FileQueueListProps {
  jobs: OcrJob[]
  pendingFiles: PendingFile[]
  selectedJobId: string | null
  onSelectJob: (jobId: string) => void
  onClear: () => void
  isProcessing: boolean
}

export function FileQueueList({ jobs, pendingFiles, selectedJobId, onSelectJob, onClear, isProcessing }: FileQueueListProps) {
  const totalCount = jobs.length + pendingFiles.length

  if (totalCount === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-gray-500 p-8 text-center border-r border-gray-200">
        <FileText className="w-12 h-12 mb-4 text-gray-300" />
        <p>No files queued</p>
        <p className="text-sm mt-2 text-gray-400">Select files or a directory to begin</p>
      </div>
    )
  }

  const renderStageIcon = (stage: JobStage) => {
    switch (stage) {
      case 'queued':
        return <div className="w-4 h-4 rounded-full border-2 border-gray-300" />
      case 'ocr':
      case 'structuring':
      case 'summarizing':
        return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
      case 'done':
        return <Check className="w-4 h-4 text-green-500" />
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500" />
    }
  }

  const renderStageText = (job: OcrJob) => {
    if (job.stage === 'error') return <span className="text-red-500 truncate" title={job.error}>{job.error || 'Error'}</span>
    if (job.stage === 'done') return <span className="text-green-500">Complete</span>

    const stageNames = {
      queued: 'Queued',
      ocr: 'Extracting text...',
      structuring: 'Formatting...',
      summarizing: 'Summarizing...'
    }

    const text = stageNames[job.stage] || job.stage
    if (job.progress !== undefined && job.progress > 0) {
      return <span>{text} ({Math.round(job.progress)}%)</span>
    }

    return <span>{text}</span>
  }

  return (
    <div className="flex flex-col h-full border-r border-gray-200 bg-gray-50">
      <div className="p-3 border-b border-gray-200 flex justify-between items-center bg-white">
        <h2 className="font-semibold text-gray-700">Queue ({totalCount})</h2>
        {!isProcessing && totalCount > 0 && (
          <button
            onClick={onClear}
            className="text-xs text-gray-500 hover:text-red-500 px-2 py-1 rounded"
          >
            Clear
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        <ul className="divide-y divide-gray-100">
          {pendingFiles.map((file, idx) => (
            <li
              key={`pending-${idx}-${file.path}`}
              className="p-3 bg-white"
            >
              <div className="flex items-start gap-3">
                <div className="mt-1 flex-shrink-0">
                  <Clock className="w-4 h-4 text-gray-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate" title={file.fileName}>
                    {file.fileName}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">Pending</p>
                </div>
              </div>
            </li>
          ))}
          {jobs.map((job) => (
            <li
              key={job.jobId}
              onClick={() => onSelectJob(job.jobId)}
              className={`p-3 cursor-pointer hover:bg-blue-50 transition-colors ${
                selectedJobId === job.jobId ? 'bg-blue-100' : 'bg-white'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="mt-1 flex-shrink-0">
                  {renderStageIcon(job.stage)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate" title={job.fileName}>
                    {job.fileName}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {renderStageText(job)}
                  </p>
                  {isProcessing && job.progress !== undefined && (
                    <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2">
                      <div
                        className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                        style={{ width: `${job.progress}%` }}
                      ></div>
                    </div>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
