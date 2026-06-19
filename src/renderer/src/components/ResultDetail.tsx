import { useState } from 'react'
import { AlertTriangle, ChevronDown, ChevronRight, Copy, FileText } from 'lucide-react'
import { JobResult } from '../../../shared/types'

interface ResultDetailProps {
  result: JobResult | null
}

export function ResultDetail({ result }: ResultDetailProps) {
  const [showThoughts, setShowThoughts] = useState(false)
  const [activeTab, setActiveTab] = useState<'structured' | 'summary' | 'raw'>('structured')
  const [copySuccess, setCopySuccess] = useState(false)

  if (!result) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-slate-500 p-8 h-full">
        <FileText className="w-20 h-20 mb-4 text-slate-200" />
        <p className="text-lg font-medium">选择已完成的文件查看结果</p>
        <p className="text-sm text-slate-400 mt-2">从左侧队列中选择一个已完成的任务</p>
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
          <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border-l-4 border-amber-400 p-4 mb-4 flex items-start gap-3 rounded-lg shadow-sm">
            <AlertTriangle className="text-amber-600 w-5 h-5 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-bold text-amber-900">⚠️ 注意</h3>
              <p className="text-sm text-amber-800 mt-1">
                AI 可能遗漏了文档的某些部分或使用了占位符。请仔细检查输出内容。
              </p>
            </div>
          </div>
        )}

        {thoughts && (
          <div className="mb-4 border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <button
              onClick={() => setShowThoughts(!showThoughts)}
              className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-amber-50 to-orange-50 hover:from-amber-100 hover:to-orange-100 text-sm font-semibold text-slate-700 transition-all duration-200"
            >
              <span className="flex items-center gap-2">
                {showThoughts ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                查看 AI 推理过程
              </span>
            </button>
            {showThoughts && (
              <div className="p-4 bg-white border-t border-slate-200 text-sm text-slate-600 whitespace-pre-wrap font-mono leading-relaxed">
                {thoughts}
              </div>
            )}
          </div>
        )}

        <div className="flex-1 relative border-2 border-slate-200 rounded-xl bg-white shadow-md overflow-hidden flex flex-col">
          <div className="absolute top-3 right-3 z-10">
            <button
              onClick={() => copyToClipboard(content)}
              className={`p-2.5 rounded-lg shadow-md border transition-all duration-200 ${
                copySuccess
                  ? 'bg-emerald-500 border-emerald-600 text-white'
                  : 'bg-white/95 hover:bg-slate-100 border-slate-300 text-slate-700'
              }`}
              title="复制到剪贴板"
            >
              <Copy className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 p-6 overflow-y-auto font-mono text-sm whitespace-pre-wrap leading-relaxed text-slate-800">
            {content || <span className="text-slate-400 italic">无内容</span>}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-5 border-b border-slate-200/60 bg-gradient-to-r from-amber-50 to-orange-50">
        <h2 className="text-xl font-bold text-slate-800 truncate" title={result.fileName}>
          {result.fileName}
        </h2>
        <div className="flex items-center gap-2 mt-2.5">
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold shadow-sm ${
            result.mode === 'enhanced'
              ? 'bg-gradient-to-r from-amber-100 to-yellow-100 text-amber-800 border border-amber-300'
              : 'bg-gradient-to-r from-orange-100 to-amber-100 text-orange-800 border border-orange-300'
          }`}>
            {result.mode === 'enhanced' ? '增强摘要' : '忠实提取'}
          </span>
          <span className="text-xs text-slate-500 font-medium">
            {new Date(result.createdAt).toLocaleString('zh-CN')}
          </span>
        </div>
      </div>

      <div className="px-6 pt-4 bg-white">
        <div className="flex border-b-2 border-slate-200">
          <button
            className={`py-3 px-5 text-sm font-bold border-b-4 transition-all duration-200 ${
              activeTab === 'structured'
                ? 'border-amber-500 text-amber-700 bg-amber-50/50'
                : 'border-transparent text-slate-600 hover:text-slate-800 hover:bg-amber-50'
            }`}
            onClick={() => setActiveTab('structured')}
          >
            结构化内容
          </button>
          <button
            className={`py-3 px-5 text-sm font-bold border-b-4 transition-all duration-200 ${
              activeTab === 'summary'
                ? 'border-amber-500 text-amber-700 bg-amber-50/50'
                : 'border-transparent text-slate-600 hover:text-slate-800 hover:bg-amber-50'
            }`}
            onClick={() => setActiveTab('summary')}
          >
            摘要
          </button>
          <button
            className={`py-3 px-5 text-sm font-bold border-b-4 transition-all duration-200 ${
              activeTab === 'raw'
                ? 'border-amber-500 text-amber-700 bg-amber-50/50'
                : 'border-transparent text-slate-600 hover:text-slate-800 hover:bg-amber-50'
            }`}
            onClick={() => setActiveTab('raw')}
          >
            原始 OCR
          </button>
        </div>
      </div>

      <div className="flex-1 p-6 overflow-hidden bg-white">
        {renderContent()}
      </div>
    </div>
  )
}