import { useState, useEffect } from 'react'
import { X, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import { useSettingsStore } from '../stores/useSettingsStore'
import { AppSettings } from '../../../shared/types'

interface ConfigDialogProps {
  isOpen: boolean
  onClose: () => void
}

export function ConfigDialog({ isOpen, onClose }: ConfigDialogProps) {
  const { settings, updateSettings, testOcrConnection, testLlmConnection, isLoading } = useSettingsStore()
  const [activeTab, setActiveTab] = useState<'textin' | 'llm' | 'advanced'>('textin')
  const [formData, setFormData] = useState<AppSettings>(settings)
  const [testStatus, setTestStatus] = useState<{
    type: 'ocr' | 'llm' | null
    status: 'idle' | 'testing' | 'success' | 'error'
    message: string
  }>({ type: null, status: 'idle', message: '' })

  // Sync form data with store when settings load/change
  useEffect(() => {
    if (isOpen) {
      setFormData(settings)
      setTestStatus({ type: null, status: 'idle', message: '' })
    }
  }, [isOpen, settings])

  if (!isOpen) return null

  const handleSave = async () => {
    await updateSettings(formData)
    onClose()
  }

  const handleTestConnection = async (type: 'ocr' | 'llm') => {
    // First save the current form data so the backend uses the latest keys
    await updateSettings(formData)

    setTestStatus({ type, status: 'testing', message: 'Testing connection...' })

    try {
      const result = type === 'ocr'
        ? await testOcrConnection()
        : await testLlmConnection()

      setTestStatus({
        type,
        status: result.success ? 'success' : 'error',
        message: result.message
      })
    } catch (err) {
      setTestStatus({
        type,
        status: 'error',
        message: (err as Error).message || 'Connection failed'
      })
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-800">Settings</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 p-1 rounded-md hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <div className="w-48 border-r border-gray-200 bg-gray-50 p-2">
            <button
              onClick={() => setActiveTab('textin')}
              className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium mb-1 ${
                activeTab === 'textin' ? 'bg-blue-100 text-blue-700' : 'text-gray-700 hover:bg-gray-200'
              }`}
            >
              TextIn OCR
            </button>
            <button
              onClick={() => setActiveTab('llm')}
              className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium mb-1 ${
                activeTab === 'llm' ? 'bg-blue-100 text-blue-700' : 'text-gray-700 hover:bg-gray-200'
              }`}
            >
              LLM API
            </button>
            <button
              onClick={() => setActiveTab('advanced')}
              className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium ${
                activeTab === 'advanced' ? 'bg-blue-100 text-blue-700' : 'text-gray-700 hover:bg-gray-200'
              }`}
            >
              Advanced
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 p-6 overflow-y-auto">
            {activeTab === 'textin' && (
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-gray-900 mb-4">TextIn API Configuration</h3>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">App ID</label>
                  <input
                    type="text"
                    value={formData.textin.appId}
                    onChange={(e) => setFormData({
                      ...formData,
                      textin: { ...formData.textin, appId: e.target.value }
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter TextIn App ID"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Secret Code</label>
                  <input
                    type="password"
                    value={formData.textin.secretCode}
                    onChange={(e) => setFormData({
                      ...formData,
                      textin: { ...formData.textin, secretCode: e.target.value }
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter TextIn Secret Code"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Base URL</label>
                  <input
                    type="text"
                    value={formData.textin.baseUrl}
                    onChange={(e) => setFormData({
                      ...formData,
                      textin: { ...formData.textin, baseUrl: e.target.value }
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="pt-4 border-t border-gray-200 mt-6">
                  <button
                    onClick={() => handleTestConnection('ocr')}
                    disabled={testStatus.status === 'testing' || !formData.textin.appId || !formData.textin.secretCode}
                    className="flex items-center justify-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none disabled:opacity-50"
                  >
                    {testStatus.type === 'ocr' && testStatus.status === 'testing' ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : null}
                    Test Connection
                  </button>

                  {testStatus.type === 'ocr' && testStatus.status !== 'idle' && testStatus.status !== 'testing' && (
                    <div className={`mt-3 p-3 rounded-md text-sm flex items-start gap-2 ${
                      testStatus.status === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
                    }`}>
                      {testStatus.status === 'success' ? (
                        <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
                      ) : (
                        <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
                      )}
                      <span>{testStatus.message}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'llm' && (
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-gray-900 mb-4">LLM API Configuration</h3>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
                  <input
                    type="password"
                    value={formData.llm.apiKey}
                    onChange={(e) => setFormData({
                      ...formData,
                      llm: { ...formData.llm, apiKey: e.target.value }
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter OpenAI-compatible API Key"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Base URL</label>
                  <input
                    type="text"
                    value={formData.llm.baseUrl}
                    onChange={(e) => setFormData({
                      ...formData,
                      llm: { ...formData.llm, baseUrl: e.target.value }
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="https://api.openai.com/v1"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Model Name</label>
                  <input
                    type="text"
                    value={formData.llm.model}
                    onChange={(e) => setFormData({
                      ...formData,
                      llm: { ...formData.llm, model: e.target.value }
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. gpt-4o"
                  />
                  <p className="text-xs text-gray-500 mt-1">Recommended: model supporting large context window</p>
                </div>

                <div className="pt-4 border-t border-gray-200 mt-6">
                  <button
                    onClick={() => handleTestConnection('llm')}
                    disabled={testStatus.status === 'testing' || !formData.llm.apiKey}
                    className="flex items-center justify-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none disabled:opacity-50"
                  >
                    {testStatus.type === 'llm' && testStatus.status === 'testing' ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : null}
                    Test Connection
                  </button>

                  {testStatus.type === 'llm' && testStatus.status !== 'idle' && testStatus.status !== 'testing' && (
                    <div className={`mt-3 p-3 rounded-md text-sm flex items-start gap-2 ${
                      testStatus.status === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
                    }`}>
                      {testStatus.status === 'success' ? (
                        <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
                      ) : (
                        <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
                      )}
                      <span>{testStatus.message}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'advanced' && (
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Advanced Settings</h3>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Concurrency
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={formData.concurrency}
                    onChange={(e) => setFormData({
                      ...formData,
                      concurrency: parseInt(e.target.value) || 3
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">Number of files to process simultaneously</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Chunk Threshold (Tokens)
                  </label>
                  <input
                    type="number"
                    min="1000"
                    step="1000"
                    value={formData.chunkThreshold}
                    onChange={(e) => setFormData({
                      ...formData,
                      chunkThreshold: parseInt(e.target.value) || 12000
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">Split document if token count exceeds this value</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="p-4 border-t border-gray-200 flex justify-end gap-3 bg-gray-50 rounded-b-lg">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isLoading}
            className="px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none disabled:opacity-50 flex items-center"
          >
            {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Save Settings
          </button>
        </div>
      </div>
    </div>
  )
}