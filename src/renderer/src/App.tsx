import { useEffect, useState } from 'react'
import { Folder, Play, Settings, StopCircle, Upload, Download } from 'lucide-react'
import { FileQueueList } from './components/FileQueueList'
import { ResultDetail } from './components/ResultDetail'
import { ConfigDialog } from './components/ConfigDialog'
import { useOcrStore } from './stores/useOcrStore'
import { useSettingsStore } from './stores/useSettingsStore'


export default function App() {
  const [isConfigOpen, setIsConfigOpen] = useState(false)


  // Settings state
  const { loadSettings, isLoaded: isSettingsLoaded } = useSettingsStore()

  // OCR state
  const {
    jobs,
    pendingFiles,
    results,
    isProcessing,
    mode,
    selectedJobId,
    setMode,
    selectJob,
    pickFiles,
    startBatch,
    cancelBatch,
    clearJobs,
    exportBatch
  } = useOcrStore()

  // Initialize
  useEffect(() => {
    if (!isSettingsLoaded) {
      loadSettings()
    }
  }, [isSettingsLoaded, loadSettings])

  // Convert jobs record to array for the list
  const jobList = Object.values(jobs)
  const hasQueuedFiles = jobList.length > 0 || pendingFiles.length > 0

  const handleExport = async () => {
    try {
      // Request directory picker via IPC
      const outputDir = await window.electron.ipcRenderer.invoke('dialog:pick-export-dir')
      if (!outputDir) return // User cancelled

      const { success, exportedCount } = await exportBatch(outputDir)
      if (success) {
        alert(`成功导出 ${exportedCount} 个结果！`)
      } else {
        alert('导出完成，但部分文件失败。')
      }
    } catch (err) {
      alert('导出失败: ' + (err as Error).message)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    if (isProcessing) return

    // Electron supports getting file paths from drag events
    // but the implementation requires IPC. For now, we rely on the pickFiles buttons.
    // Full implementation would extract file paths and send to a specific IPC endpoint.
  }

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 overflow-hidden" onDragOver={handleDragOver} onDrop={handleDrop}>
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200/60 px-6 py-4 flex items-center justify-between shrink-0 shadow-sm z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl flex items-center justify-center shadow-md">
            <span className="text-white font-bold text-xl">文</span>
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800 tracking-tight">智能文档识别系统</h1>
            <p className="text-xs text-amber-600">OCR + AI 结构化处理</p>
          </div>
        </div>
        <button
          onClick={() => setIsConfigOpen(true)}
          className="p-2.5 text-slate-600 hover:text-slate-800 hover:bg-amber-50 rounded-xl transition-all duration-200"
          title="设置"
        >
          <Settings className="w-5 h-5" />
        </button>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden gap-4 p-4">
        {/* Left Panel: Controls & Queue */}
        <div className="w-80 flex flex-col bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-slate-200/60 overflow-hidden">
          {/* Controls */}
          <div className="p-5 border-b border-slate-200/60">
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => pickFiles('files')}
                disabled={isProcessing}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-300 rounded-xl text-sm font-medium text-amber-700 hover:from-amber-100 hover:to-orange-100 disabled:opacity-50 transition-all duration-200 shadow-sm"
              >
                <Upload className="w-4 h-4" />
                选择文件
              </button>
              <button
                onClick={() => pickFiles('directory')}
                disabled={isProcessing}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 bg-gradient-to-r from-orange-50 to-yellow-50 border border-orange-300 rounded-xl text-sm font-medium text-orange-700 hover:from-orange-100 hover:to-yellow-100 disabled:opacity-50 transition-all duration-200 shadow-sm"
              >
                <Folder className="w-4 h-4" />
                选择文件夹
              </button>
            </div>

            <div className="mb-4">
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2.5">
                处理模式
              </label>
              <div className="flex rounded-xl shadow-sm overflow-hidden border border-slate-200">
                <button
                  onClick={() => setMode('faithful')}
                  disabled={isProcessing}
                  className={`flex-1 py-2.5 text-sm font-medium transition-all duration-200 ${
                    mode === 'faithful'
                      ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md'
                      : 'bg-white text-slate-700 hover:bg-amber-50'
                  }`}
                >
                  忠实提取
                </button>
                <button
                  onClick={() => setMode('enhanced')}
                  disabled={isProcessing}
                  className={`flex-1 py-2.5 text-sm font-medium border-l border-slate-200 transition-all duration-200 ${
                    mode === 'enhanced'
                      ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md'
                      : 'bg-white text-slate-700 hover:bg-amber-50'
                  }`}
                >
                  增强摘要
                </button>
              </div>
            </div>

            {!isProcessing ? (
              <button
                onClick={startBatch}
                disabled={!hasQueuedFiles}
                className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-semibold hover:from-amber-600 hover:to-orange-600 disabled:from-slate-300 disabled:to-slate-400 transition-all duration-200 shadow-lg shadow-amber-500/20 hover:shadow-xl disabled:shadow-none"
              >
                <Play className="w-5 h-5" />
                开始处理
              </button>
            ) : (
              <button
                onClick={cancelBatch}
                className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-red-50 to-orange-50 text-red-700 border-2 border-red-300 rounded-xl font-semibold hover:from-red-100 hover:to-orange-100 transition-all duration-200 shadow-sm"
              >
                <StopCircle className="w-5 h-5" />
                取消处理
              </button>
            )}
          </div>

          {/* Queue List */}
          <div className="flex-1 overflow-hidden">
            <FileQueueList
              jobs={jobList}
              pendingFiles={pendingFiles}
              selectedJobId={selectedJobId}
              onSelectJob={selectJob}
              onClear={clearJobs}
              isProcessing={isProcessing}
            />
          </div>
        </div>

        {/* Right Panel: Result Details */}
        <div className="flex-1 flex flex-col bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-slate-200/60 overflow-hidden">
          <div className="flex-1 overflow-hidden">
            <ResultDetail
              result={selectedJobId ? results[selectedJobId] || null : null}
            />
          </div>

          {/* Bottom Action Bar */}
          <div className="bg-gradient-to-r from-slate-50 to-blue-50 border-t border-slate-200/60 p-4 flex justify-end shrink-0">
            <button
              onClick={handleExport}
              disabled={Object.keys(results).length === 0 || isProcessing}
              className="flex items-center gap-2 px-5 py-2.5 border-2 border-emerald-300 shadow-sm text-sm font-semibold rounded-xl text-emerald-700 bg-gradient-to-r from-emerald-50 to-teal-50 hover:from-emerald-100 hover:to-teal-100 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
            >
              <Download className="w-4 h-4" />
              导出所有结果
            </button>
          </div>
        </div>
      </div>

      <ConfigDialog
        isOpen={isConfigOpen}
        onClose={() => setIsConfigOpen(false)}
      />
    </div>
  )
}
