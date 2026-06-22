import { useState, useRef } from 'react'
import { AlertTriangle, ChevronDown, ChevronRight, Copy, FileText } from 'lucide-react'
import { JobResult } from '../../../shared/types'
import { useScrollOverlay } from '../hooks/useScrollOverlay'

interface ResultDetailProps {
  result: JobResult | null
}

export function ResultDetail({ result }: ResultDetailProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  useScrollOverlay(scrollRef)
  const [showThoughts, setShowThoughts] = useState(false)
  const [activeTab, setActiveTab] = useState<'structured' | 'summary' | 'raw'>('structured')
  const [copySuccess, setCopySuccess] = useState(false)

  if (!result) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-ink-2 p-8 h-full">
        <FileText className="w-20 h-20 mb-4 text-ink-3 opacity-40" />
        <p className="text-lg font-medium text-ink">选择已完成的文件查看结果</p>
        <p className="text-sm text-ink-3 mt-2">从左侧队列中选择一个已完成的任务</p>
      </div>
    )
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
      .then(() => {
        setCopySuccess(true)
        setTimeout(() => setCopySuccess(false), 2000)
      })
      .catch(err => {
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
          <div className="bg-seal-soft border-l-4 border-seal p-4 mb-4 flex items-start gap-3 rounded-sm">
            <AlertTriangle className="text-seal w-5 h-5 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-bold text-seal">⚠️ 注意</h3>
              <p className="text-sm text-seal mt-1">
                AI 可能遗漏了文档的某些部分或使用了占位符。请仔细检查输出内容。
              </p>
            </div>
          </div>
        )}

        {thoughts && (
          <div className="mb-4 border border-line rounded-md overflow-hidden">
            <button
              onClick={() => setShowThoughts(!showThoughts)}
              className="w-full flex items-center justify-between p-4 bg-paper-2 hover:bg-paper text-sm font-semibold text-ink-2 transition-all duration-200"
            >
              <span className="flex items-center gap-2">
                {showThoughts ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                查看 AI 推理过程
              </span>
            </button>
            {showThoughts && (
              <div className="p-4 bg-paper border-t border-line text-sm text-ink-2 whitespace-pre-wrap font-mono leading-relaxed">
                {thoughts}
              </div>
            )}
          </div>
        )}

        <div className="flex-1 relative border border-line rounded-md bg-paper shadow-card overflow-hidden flex flex-col">
          <div className="absolute top-3 right-3 z-10">
            <button
              onClick={() => copyToClipboard(content)}
              className={`p-2.5 rounded-sm border transition-all duration-200 ${
                copySuccess
                  ? 'bg-seal border-seal text-white'
                  : 'bg-paper hover:bg-vermilion-soft border-line text-ink-2 hover:border-vermilion hover:text-vermilion'
              }`}
              title="复制到剪贴板"
            >
              <Copy className="w-4 h-4" />
            </button>
          </div>
          <div ref={scrollRef} className="flex-1 p-6 overflow-y-auto font-mono text-sm whitespace-pre-wrap leading-relaxed text-ink scroll-overlay">
            {content || <span className="text-ink-3 italic">无内容</span>}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-5 border-b border-line bg-paper-2">
        <h2 className="font-display text-xl font-bold text-ink truncate" title={result.fileName}>
          {result.fileName}
        </h2>
        <div className="flex items-center gap-2 mt-2.5">
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border ${
            result.mode === 'enhanced'
              ? 'bg-vermilion-soft text-vermilion border-vermilion-soft'
              : 'bg-seal-soft text-seal border-seal-soft'
          }`}>
            {result.mode === 'enhanced' ? '增强摘要' : '忠实提取'}
          </span>
          <span className="text-xs text-ink-3 font-medium">
            {new Date(result.createdAt).toLocaleString('zh-CN')}
          </span>
        </div>
      </div>

      <div className="px-6 pt-4 bg-paper">
        <div className="flex border-b-2 border-line">
          <button
            className={`py-3 px-5 text-sm font-bold border-b-4 transition-all duration-200 ${
              activeTab === 'structured'
                ? 'border-vermilion text-vermilion'
                : 'border-transparent text-ink-3 hover:text-ink hover:bg-paper-2'
            }`}
            onClick={() => setActiveTab('structured')}
          >
            结构化内容
          </button>
          <button
            className={`py-3 px-5 text-sm font-bold border-b-4 transition-all duration-200 ${
              activeTab === 'summary'
                ? 'border-vermilion text-vermilion'
                : 'border-transparent text-ink-3 hover:text-ink hover:bg-paper-2'
            }`}
            onClick={() => setActiveTab('summary')}
          >
            摘要
          </button>
          <button
            className={`py-3 px-5 text-sm font-bold border-b-4 transition-all duration-200 ${
              activeTab === 'raw'
                ? 'border-vermilion text-vermilion'
                : 'border-transparent text-ink-3 hover:text-ink hover:bg-paper-2'
            }`}
            onClick={() => setActiveTab('raw')}
          >
            原始 OCR
          </button>
        </div>
      </div>

      <div className="flex-1 p-6 overflow-hidden bg-paper">
        {renderContent()}
      </div>
    </div>
  )
}