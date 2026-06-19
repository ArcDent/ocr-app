import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { ResultDetail } from '../../components/ResultDetail'
import { JobResult } from '../../../../shared/types'

describe('ResultDetail', () => {
  const mockResult: JobResult = {
    jobId: '1',
    fileName: 'test.pdf',
    rawText: 'This is raw text',
    structuredText: 'This is structured text',
    structuredThoughts: 'These are structured thoughts',
    summary: 'This is a summary',
    summaryThoughts: 'These are summary thoughts',
    mode: 'enhanced',
    hasPlaceholderWarning: true,
    createdAt: Date.now()
  }

  it('renders empty state when no result', () => {
    render(<ResultDetail result={null} />)
    expect(screen.getByText('选择已完成的文件查看结果')).toBeInTheDocument()
  })

  it('renders result details', () => {
    render(<ResultDetail result={mockResult} />)
    expect(screen.getByText('test.pdf')).toBeInTheDocument()
    expect(screen.getByText('增强摘要')).toBeInTheDocument()
    expect(screen.getByText('This is structured text')).toBeInTheDocument()
  })

  it('shows warning when hasPlaceholderWarning is true', () => {
    render(<ResultDetail result={mockResult} />)
    expect(screen.getByText('⚠️ 注意')).toBeInTheDocument()
  })

  it('switches tabs correctly', () => {
    render(<ResultDetail result={mockResult} />)

    // Default is structured
    expect(screen.getByText('This is structured text')).toBeInTheDocument()
    expect(screen.queryByText('This is a summary')).not.toBeInTheDocument()

    // Switch to summary
    fireEvent.click(screen.getByText('摘要'))
    expect(screen.getByText('This is a summary')).toBeInTheDocument()
    expect(screen.queryByText('This is structured text')).not.toBeInTheDocument()

    // Switch to raw
    fireEvent.click(screen.getByText('原始 OCR'))
    expect(screen.getByText('This is raw text')).toBeInTheDocument()
  })

  it('toggles thoughts visibility', () => {
    render(<ResultDetail result={mockResult} />)

    // Thoughts button should be present
    const thoughtsButton = screen.getByText('查看 AI 推理过程')
    expect(thoughtsButton).toBeInTheDocument()

    // Thoughts shouldn't be visible initially
    expect(screen.queryByText('These are structured thoughts')).not.toBeInTheDocument()

    // Click to show
    fireEvent.click(thoughtsButton)
    expect(screen.getByText('These are structured thoughts')).toBeInTheDocument()

    // Click to hide
    fireEvent.click(thoughtsButton)
    expect(screen.queryByText('These are structured thoughts')).not.toBeInTheDocument()
  })
})
