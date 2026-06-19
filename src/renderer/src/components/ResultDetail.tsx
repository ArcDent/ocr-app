import { useState } from 'react'
import { AlertTriangle, ChevronDown, ChevronRight, Copy, FileText } from 'lucide-react'
import { JobResult } from '../../../shared/types'

interface ResultDetailProps {
  result: JobResult | null
}

export function ResultDetail({ result }: ResultDetailProps) {
  const [showThoughts, setShowThoughts] = useState(false)
  const [activeTab, setActiveTab] = useState<'structured' | 'summary' | 'raw'>('structured')

  if (!result) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-gray-500 p-8 h-full">
        <FileText className="w-16 h-16 mb-4 text-gray-200" />
        <p className="text-lg">Select a completed file to view results</p>
      </div>
    )
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).catch(err => {
      console.error('Failed to copy text: ', err)
    })
  }

  const renderContent = () => {
    let content = ''
    let thoughts = ''

    switch (activeTab) {
      case 'structured':
        content = result.structuredText
        thoughts = result.structuredThoughts || ''
        break
      case 'summary':
        content = result.summary
        thoughts = result.summaryThoughts || ''
        break
      case 'raw':
        content = result.rawText
        break
    }

    return (
      <div className="flex flex-col h-full">
        {result.hasPlaceholderWarning && (
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4 flex items-start gap-3">
            <AlertTriangle className="text-yellow-500 w-5 h-5 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-medium text-yellow-800">Warning</h3>
              <p className="text-sm text-yellow-700 mt-1">
                The AI may have missed some sections of the document or used placeholders instead of full text.
                Please review the output carefully.
              </p>
            </div>
          </div>
        )}

        {thoughts && (
          <div className="mb-4 border border-gray-200 rounded-md overflow-hidden">
            <button
              onClick={() => setShowThoughts(!showThoughts)}
              className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 text-sm font-medium text-gray-700"
            >
              <span className="flex items-center gap-2">
                {showThoughts ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                View AI Reasoning (Thoughts)
              </span>
            </button>
            {showThoughts && (
              <div className="p-4 bg-white border-t border-gray-200 text-sm text-gray-600 whitespace-pre-wrap font-mono">
                {thoughts}
              </div>
            )}
          </div>
        )}

        <div className="flex-1 relative border border-gray-200 rounded-md bg-white shadow-sm overflow-hidden flex flex-col">
          <div className="absolute top-2 right-2">
            <button
              onClick={() => copyToClipboard(content)}
              className="p-2 bg-white/80 hover:bg-gray-100 rounded-md shadow-sm border border-gray-200 text-gray-600 transition-colors"
              title="Copy to clipboard"
            >
              <Copy className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 p-4 overflow-y-auto font-mono text-sm whitespace-pre-wrap">
            {content || <span className="text-gray-400 italic">No content generated</span>}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-xl font-semibold text-gray-800 truncate" title={result.fileName}>
          {result.fileName}
        </h2>
        <div className="flex items-center gap-2 mt-2">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            {result.mode === 'enhanced' ? 'Enhanced Summary' : 'Faithful Extraction'}
          </span>
          <span className="text-xs text-gray-500">
            {new Date(result.createdAt).toLocaleString()}
          </span>
        </div>
      </div>

      <div className="px-6 pt-4">
        <div className="flex border-b border-gray-200">
          <button
            className={`py-2 px-4 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'structured'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
            onClick={() => setActiveTab('structured')}
          >
            Structured Content
          </button>
          <button
            className={`py-2 px-4 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'summary'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
            onClick={() => setActiveTab('summary')}
          >
            Summary
          </button>
          <button
            className={`py-2 px-4 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'raw'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
            onClick={() => setActiveTab('raw')}
          >
            Raw OCR
          </button>
        </div>
      </div>

      <div className="flex-1 p-6 overflow-hidden">
        {renderContent()}
      </div>
    </div>
  )
}