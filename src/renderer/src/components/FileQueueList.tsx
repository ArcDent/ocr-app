
import { Check, FileText, Loader2, XCircle, Clock } from 'lucide-react'
import { useRef } from 'react'
import { JobStage, OcrJob } from '../../../shared/types'
import { useScrollOverlay } from '../hooks/useScrollOverlay'

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
  const scrollRef = useRef<HTMLDivElement>(null)
  useScrollOverlay(scrollRef)
  const totalCount = jobs.length + pendingFiles.length

  if (totalCount === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-ink-2 p-8 text-center">
        <FileText className="w-16 h-16 mb-4 text-ink-3 opacity-40" />
        <p className="text-base font-medium text-ink">暂无文件</p>
        <p className="text-sm mt-2 text-ink-3">选择文件或文件夹开始处理</p>
      </div>
    )
  }

  const renderStageIcon = (stage: JobStage) => {
    switch (stage) {
      case 'queued':
        return <div className="w-4 h-4 rounded-full border-2 border-ink-3" />
      case 'ocr':
      case 'structuring':
      case 'summarizing':
        return <Loader2 className="w-4 h-4 text-vermilion animate-spin" />
      case 'done':
        return <Check className="w-4 h-4 text-seal" />
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500" />
    }
  }

  const renderStageText = (job: OcrJob) => {
    if (job.stage === 'error') return <span className="text-red-700 truncate font-medium" title={job.error}>{job.error || '处理失败'}</span>
    if (job.stage === 'done') return <span className="text-seal font-medium">完成</span>

    const stageNames = {
      queued: '等待中',
      ocr: '文字识别中...',
      structuring: '结构化处理中...',
      summarizing: '生成摘要中...'
    }

    const text = stageNames[job.stage] || job.stage
    if (job.progress !== undefined && job.progress > 0) {
      return <span className="font-medium">{text} ({Math.round(job.progress)}%)</span>
    }

    return <span className="font-medium">{text}</span>
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-5 py-3 border-b border-line flex justify-between items-center bg-paper-2">
        <h2 className="font-display font-bold text-ink">任务队列 ({totalCount})</h2>
        {!isProcessing && totalCount > 0 && (
          <button
            onClick={onClear}
            className="text-xs text-ink-3 hover:text-red-700 px-3 py-1.5 rounded-sm hover:bg-red-soft transition-all duration-200 font-medium"
          >
            清空
          </button>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <ul className="divide-y divide-line">
          {pendingFiles.map((file, idx) => (
            <li
              key={`pending-${idx}-${file.path}`}
              className="p-4 bg-paper hover:bg-paper-2 transition-colors duration-150"
            >
              <div className="flex items-start gap-3">
                <div className="mt-1 flex-shrink-0">
                  <Clock className="w-4 h-4 text-ink-3" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-ink truncate" title={file.fileName}>
                    {file.fileName}
                  </p>
                  <p className="text-xs text-ink-3 mt-1 font-medium">待处理</p>
                </div>
              </div>
            </li>
          ))}
          {jobs.map((job) => (
            <li
              key={job.jobId}
              onClick={() => onSelectJob(job.jobId)}
              className={`p-4 cursor-pointer transition-all duration-150 ${
                selectedJobId === job.jobId
                  ? 'bg-vermilion-soft border-l-4 border-vermilion'
                  : 'bg-paper hover:bg-paper-2'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="mt-1 flex-shrink-0">
                  {renderStageIcon(job.stage)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-ink truncate" title={job.fileName}>
                    {job.fileName}
                  </p>
                  <p className="text-xs text-ink-2 mt-1">
                    {renderStageText(job)}
                  </p>
                  {isProcessing && job.progress !== undefined && (
                    <div className="w-full bg-line rounded-full h-1.5 mt-2.5">
                      <div
                        className="bg-vermilion h-1.5 rounded-full transition-all duration-300"
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
