import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { vi } from 'vitest'
import { FileQueueList } from '../../components/FileQueueList'
import { OcrJob } from '../../../../shared/types'

describe('FileQueueList', () => {
  const mockJobs: OcrJob[] = [
    { jobId: '1', fileName: 'test1.pdf', filePath: '/test1.pdf', stage: 'queued' },
    { jobId: '2', fileName: 'test2.pdf', filePath: '/test2.pdf', stage: 'ocr', progress: 50 },
    { jobId: '3', fileName: 'test3.pdf', filePath: '/test3.pdf', stage: 'done' }
  ]

  const mockOnSelectJob = vi.fn()
  const mockOnClear = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders empty state when no jobs', () => {
    render(
      <FileQueueList
        jobs={[]}
        pendingFiles={[]}
        selectedJobId={null}
        onSelectJob={mockOnSelectJob}
        onClear={mockOnClear}
        isProcessing={false}
      />
    )
    expect(screen.getByText('暂无文件')).toBeInTheDocument()
  })

  it('renders list of jobs', () => {
    render(
      <FileQueueList
        jobs={mockJobs}
        pendingFiles={[]}
        selectedJobId={null}
        onSelectJob={mockOnSelectJob}
        onClear={mockOnClear}
        isProcessing={true}
      />
    )
    expect(screen.getByText(/任务队列/)).toBeInTheDocument()
    expect(screen.getByText('test1.pdf')).toBeInTheDocument()
    expect(screen.getByText('test2.pdf')).toBeInTheDocument()
    expect(screen.getByText('test3.pdf')).toBeInTheDocument()
  })

  it('calls onSelectJob when a job is clicked', () => {
    render(
      <FileQueueList
        jobs={mockJobs}
        pendingFiles={[]}
        selectedJobId={null}
        onSelectJob={mockOnSelectJob}
        onClear={mockOnClear}
        isProcessing={false}
      />
    )

    fireEvent.click(screen.getByText('test1.pdf'))
    expect(mockOnSelectJob).toHaveBeenCalledWith('1')
  })

  it('calls onClear when clear button is clicked', () => {
    render(
      <FileQueueList
        jobs={mockJobs}
        pendingFiles={[]}
        selectedJobId={null}
        onSelectJob={mockOnSelectJob}
        onClear={mockOnClear}
        isProcessing={false}
      />
    )

    fireEvent.click(screen.getByText('清空'))
    expect(mockOnClear).toHaveBeenCalled()
  })

  it('hides clear button when processing', () => {
    render(
      <FileQueueList
        jobs={mockJobs}
        pendingFiles={[]}
        selectedJobId={null}
        onSelectJob={mockOnSelectJob}
        onClear={mockOnClear}
        isProcessing={true}
      />
    )

    expect(screen.queryByText('清空')).not.toBeInTheDocument()
  })

  it('renders pending files without jobId and not clickable', () => {
    render(
      <FileQueueList
        jobs={[]}
        pendingFiles={[
          { path: '/a.pdf', fileName: 'a.pdf' },
          { path: '/b.pdf', fileName: 'b.pdf' },
        ]}
        selectedJobId={null}
        onSelectJob={mockOnSelectJob}
        onClear={mockOnClear}
        isProcessing={false}
      />
    )
    expect(screen.getByText(/任务队列/)).toBeInTheDocument()
    expect(screen.getByText('a.pdf')).toBeInTheDocument()
    expect(screen.getAllByText('待处理')).toHaveLength(2)
    // Clicking pending file name should NOT call onSelectJob
    fireEvent.click(screen.getByText('a.pdf'))
    expect(mockOnSelectJob).not.toHaveBeenCalled()
  })
})
