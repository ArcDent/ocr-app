import { useEffect, useState, useRef } from 'react'
import { X, AlertCircle, CheckCircle2 } from 'lucide-react'
import { useSettingsStore } from '../stores/useSettingsStore'
import { useScrollOverlay } from '../hooks/useScrollOverlay'

interface ConfigDialogProps {
  isOpen: boolean
  onClose: () => void
}

export function ConfigDialog({ isOpen, onClose }: ConfigDialogProps) {
  const { settings, saveSettings, testOcrConnection, testLlmConnection } = useSettingsStore()
  const [localSettings, setLocalSettings] = useState(settings)
  const [ocrTestResult, setOcrTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [llmTestResult, setLlmTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [isTesting, setIsTesting] = useState(false)

  const contentRef = useRef<HTMLDivElement>(null)
  useScrollOverlay(contentRef)

  useEffect(() => {
    if (isOpen) {
      setLocalSettings(settings)
      setOcrTestResult(null)
      setLlmTestResult(null)
    }
  }, [isOpen, settings])

  if (!isOpen) return null

  const handleSave = async () => {
    await saveSettings(localSettings)
    onClose()
  }

  const handleTestOcr = async () => {
    setIsTesting(true)
    setOcrTestResult(null)
    const result = await testOcrConnection(localSettings)
    setOcrTestResult(result)
    setIsTesting(false)
  }

  const handleTestLlm = async () => {
    setIsTesting(true)
    setLlmTestResult(null)
    const result = await testLlmConnection(localSettings)
    setLlmTestResult(result)
    setIsTesting(false)
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-overlay-fade-in">
      <div className="bg-paper rounded-xl shadow-float border border-line w-full max-w-2xl max-h-[90vh] flex flex-col animate-zoom-in overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-line flex justify-between items-center bg-paper-2">
          <h2 className="font-display text-2xl font-bold text-ink">系统配置</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-paper rounded-md transition-colors text-ink-3"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div ref={contentRef} className="flex-1 overflow-y-auto p-6 space-y-8 scroll-overlay">
          {/* TextIn OCR Config */}
          <section className="bg-paper-2 border border-line rounded-lg p-5 shadow-card">
            <h3 className="font-display text-lg font-bold text-ink mb-4 flex items-center gap-2.5">
              <span className="w-1.5 h-1.5 bg-vermilion rounded-sm"></span>
              TextIn OCR 配置
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-ink-2 mb-2">
                  App ID
                </label>
                <input
                  type="text"
                  value={localSettings.textin.appId}
                  onChange={(e) =>
                    setLocalSettings({
                      ...localSettings,
                      textin: { ...localSettings.textin, appId: e.target.value },
                    })
                  }
                  className="w-full px-4 py-2.5 bg-paper border border-line rounded-sm focus:outline-none focus:border-vermilion focus:ring-2 focus:ring-vermilion-soft transition-colors"
                  placeholder="输入 TextIn App ID"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-ink-2 mb-2">
                  Secret Code
                </label>
                <input
                  type="password"
                  value={localSettings.textin.secretCode}
                  onChange={(e) =>
                    setLocalSettings({
                      ...localSettings,
                      textin: { ...localSettings.textin, secretCode: e.target.value },
                    })
                  }
                  className="w-full px-4 py-2.5 bg-paper border border-line rounded-sm focus:outline-none focus:border-vermilion focus:ring-2 focus:ring-vermilion-soft transition-colors"
                  placeholder="输入 Secret Code"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-ink-2 mb-2">
                  Base URL
                </label>
                <input
                  type="text"
                  value={localSettings.textin.baseUrl}
                  onChange={(e) =>
                    setLocalSettings({
                      ...localSettings,
                      textin: { ...localSettings.textin, baseUrl: e.target.value },
                    })
                  }
                  className="w-full px-4 py-2.5 bg-paper border border-line rounded-sm focus:outline-none focus:border-vermilion focus:ring-2 focus:ring-vermilion-soft transition-colors"
                  placeholder="https://api.textin.com"
                />
              </div>
              <button
                onClick={handleTestOcr}
                disabled={isTesting}
                className="w-full py-2.5 bg-paper border border-vermilion-soft text-vermilion rounded-md font-semibold hover:bg-vermilion-soft disabled:opacity-50 transition-all duration-200"
              >
                {isTesting ? '测试中...' : '测试 OCR 连接'}
              </button>
              {ocrTestResult && (
                <div
                  className={`flex items-start gap-3 p-4 rounded-md ${
                    ocrTestResult.success
                      ? 'bg-seal-soft border border-seal'
                      : 'bg-red-soft border border-red-300'
                  }`}
                >
                  {ocrTestResult.success ? (
                    <CheckCircle2 className="w-5 h-5 text-seal flex-shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  )}
                  <p className={`text-sm font-medium ${ocrTestResult.success ? 'text-seal' : 'text-red-800'}`}>
                    {ocrTestResult.message}
                  </p>
                </div>
              )}
            </div>
          </section>

          {/* LLM Config */}
          <section className="bg-paper-2 border border-line rounded-lg p-5 shadow-card">
            <h3 className="font-display text-lg font-bold text-ink mb-4 flex items-center gap-2.5">
              <span className="w-1.5 h-1.5 bg-vermilion rounded-sm"></span>
              LLM 配置
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-ink-2 mb-2">
                  Base URL
                </label>
                <input
                  type="text"
                  value={localSettings.llm.baseUrl}
                  onChange={(e) =>
                    setLocalSettings({
                      ...localSettings,
                      llm: { ...localSettings.llm, baseUrl: e.target.value },
                    })
                  }
                  className="w-full px-4 py-2.5 bg-paper border border-line rounded-sm focus:outline-none focus:border-vermilion focus:ring-2 focus:ring-vermilion-soft transition-colors"
                  placeholder="https://api.openai.com/v1"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-ink-2 mb-2">
                  API Key
                </label>
                <input
                  type="password"
                  value={localSettings.llm.apiKey}
                  onChange={(e) =>
                    setLocalSettings({
                      ...localSettings,
                      llm: { ...localSettings.llm, apiKey: e.target.value },
                    })
                  }
                  className="w-full px-4 py-2.5 bg-paper border border-line rounded-sm focus:outline-none focus:border-vermilion focus:ring-2 focus:ring-vermilion-soft transition-colors"
                  placeholder="输入 API Key"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-ink-2 mb-2">
                  模型
                </label>
                <input
                  type="text"
                  value={localSettings.llm.model}
                  onChange={(e) =>
                    setLocalSettings({
                      ...localSettings,
                      llm: { ...localSettings.llm, model: e.target.value },
                    })
                  }
                  className="w-full px-4 py-2.5 bg-paper border border-line rounded-sm focus:outline-none focus:border-vermilion focus:ring-2 focus:ring-vermilion-soft transition-colors"
                  placeholder="gpt-4"
                />
              </div>
              <button
                onClick={handleTestLlm}
                disabled={isTesting}
                className="w-full py-2.5 bg-paper border border-vermilion-soft text-vermilion rounded-md font-semibold hover:bg-vermilion-soft disabled:opacity-50 transition-all duration-200"
              >
                {isTesting ? '测试中...' : '测试 LLM 连接'}
              </button>
              {llmTestResult && (
                <div
                  className={`flex items-start gap-3 p-4 rounded-md ${
                    llmTestResult.success
                      ? 'bg-seal-soft border border-seal'
                      : 'bg-red-soft border border-red-300'
                  }`}
                >
                  {llmTestResult.success ? (
                    <CheckCircle2 className="w-5 h-5 text-seal flex-shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  )}
                  <p className={`text-sm font-medium ${llmTestResult.success ? 'text-seal' : 'text-red-800'}`}>
                    {llmTestResult.message}
                  </p>
                </div>
              )}
            </div>
          </section>

          {/* Processing Config */}
          <section className="bg-paper-2 border border-line rounded-lg p-5 shadow-card">
            <h3 className="font-display text-lg font-bold text-ink mb-4 flex items-center gap-2.5">
              <span className="w-1.5 h-1.5 bg-seal rounded-sm"></span>
              处理参数
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-ink-2 mb-2">
                  并发数量
                </label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={localSettings.concurrency}
                  onChange={(e) =>
                    setLocalSettings({
                      ...localSettings,
                      concurrency: parseInt(e.target.value, 10),
                    })
                  }
                  className="w-full px-4 py-2.5 bg-paper border border-line rounded-sm focus:outline-none focus:border-vermilion focus:ring-2 focus:ring-vermilion-soft transition-colors"
                />
                <p className="text-xs text-ink-3 mt-2">同时处理的文件数量（1-10）</p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-ink-2 mb-2">
                  分块阈值（字符数）
                </label>
                <input
                  type="number"
                  min="500"
                  max="10000"
                  step="100"
                  value={localSettings.chunkThreshold}
                  onChange={(e) =>
                    setLocalSettings({
                      ...localSettings,
                      chunkThreshold: parseInt(e.target.value, 10),
                    })
                  }
                  className="w-full px-4 py-2.5 bg-paper border border-line rounded-sm focus:outline-none focus:border-vermilion focus:ring-2 focus:ring-vermilion-soft transition-colors"
                />
                <p className="text-xs text-ink-3 mt-2">超过此长度的文本将分块处理</p>
              </div>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-line flex justify-end gap-3 bg-paper-2">
          <button
            onClick={onClose}
            className="px-5 py-2.5 border border-line text-ink-2 rounded-md font-semibold hover:bg-paper transition-all duration-200"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-2.5 bg-vermilion text-white rounded-md font-semibold hover:bg-vermilion-2 shadow-card active:animate-seal-press transition-all duration-200"
          >
            保存配置
          </button>
        </div>
      </div>
    </div>
  )
}
