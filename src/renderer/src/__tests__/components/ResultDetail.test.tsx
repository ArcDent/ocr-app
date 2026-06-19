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
    expect(screen.getByText('Select a completed file to view results')).toBeInTheDocument()
  })

  it('renders result details', () => {
    render(<ResultDetail result={mockResult} />)
    expect(screen.getByText('test.pdf')).toBeInTheDocument()
    expect(screen.getByText('Enhanced Summary')).toBeInTheDocument()
    expect(screen.getByText('This is structured text')).toBeInTheDocument()
  })

  it('shows warning when hasPlaceholderWarning is true', () => {
    render(<ResultDetail result={mockResult} />)
    expect(screen.getByText('Warning')).toBeInTheDocument()
  })

  it('switches tabs correctly', () => {
    render(<ResultDetail result={mockResult} />)
    
    // Default is structured
    expect(screen.getByText('This is structured text')).toBeInTheDocument()
    expect(screen.queryByText('This is a summary')).not.toBeInTheDocument()
    
    // Switch to summary
    fireEvent.click(screen.getByText('Summary'))
    expect(screen.getByText('This is a summary')).toBeInTheDocument()
    expect(screen.queryByText('This is structured text')).not.toBeInTheDocument()
    
    // Switch to raw
    fireEvent.click(screen.getByText('Raw OCR'))
    expect(screen.getByText('This is raw text')).toBeInTheDocument()
  })

  it('toggles thoughts visibility', () => {
    render(<ResultDetail result={mockResult} />)
    
    // Thoughts button should be present
    const thoughtsButton = screen.getByText('View AI Reasoning (Thoughts)')
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
