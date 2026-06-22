import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { describe, it, expect, vi } from 'vitest'
import { ResultDetail, ResultTab } from '../../components/ResultDetail'
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
    render(<ResultDetail result={null} activeTab="structured" onActiveTabChange={() => {}} />)
    expect(screen.getByText('选择已完成的文件查看结果')).toBeInTheDocument()
  })

  it('renders result details', () => {
    render(<ResultDetail result={mockResult} activeTab="structured" onActiveTabChange={() => {}} />)
    expect(screen.getByText('test.pdf')).toBeInTheDocument()
    expect(screen.getByText('增强摘要')).toBeInTheDocument()
    expect(screen.getByText('This is structured text')).toBeInTheDocument()
  })

  it('shows warning when hasPlaceholderWarning is true', () => {
    render(<ResultDetail result={mockResult} activeTab="structured" onActiveTabChange={() => {}} />)
    expect(screen.getByText('⚠️ 注意')).toBeInTheDocument()
  })

  it('renders content for the active tab', () => {
    // structured (default)
    const { rerender } = render(<ResultDetail result={mockResult} activeTab="structured" onActiveTabChange={() => {}} />)
    expect(screen.getByText('This is structured text')).toBeInTheDocument()
    expect(screen.queryByText('This is a summary')).not.toBeInTheDocument()

    // switch to summary via controlled prop
    rerender(<ResultDetail result={mockResult} activeTab="summary" onActiveTabChange={() => {}} />)
    expect(screen.getByText('This is a summary')).toBeInTheDocument()
    expect(screen.queryByText('This is structured text')).not.toBeInTheDocument()

    // switch to raw
    rerender(<ResultDetail result={mockResult} activeTab="raw" onActiveTabChange={() => {}} />)
    expect(screen.getByText('This is raw text')).toBeInTheDocument()
  })

  it('calls onActiveTabChange when a tab is clicked', () => {
    const onActiveTabChange = vi.fn() as unknown as (tab: ResultTab) => void
    render(<ResultDetail result={mockResult} activeTab="structured" onActiveTabChange={onActiveTabChange} />)

    fireEvent.click(screen.getByText('摘要'))
    expect(onActiveTabChange).toHaveBeenCalledWith('summary')

    fireEvent.click(screen.getByText('原始 OCR'))
    expect(onActiveTabChange).toHaveBeenCalledWith('raw')
  })

  it('toggles thoughts visibility', () => {
    render(<ResultDetail result={mockResult} activeTab="structured" onActiveTabChange={() => {}} />)

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
