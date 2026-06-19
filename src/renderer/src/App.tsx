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

  const handleExport = async () => {
    // We would ideally let the user pick a directory, but for simplicity
    // we'll use a default export behavior based on the store's capability
    // A proper implementation would use an IPC call to show a directory picker
    try {
      const { success, exportedCount } = await exportBatch('')
      if (success) {
        alert(`Successfully exported ${exportedCount} results!`)
      } else {
        alert('Export completed with some errors.')
      }
    } catch (err) {
      alert('Failed to export: ' + (err as Error).message)
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
    <div className="h-screen flex flex-col bg-gray-100 overflow-hidden" onDragOver={handleDragOver} onDrop={handleDrop}>
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shrink-0 shadow-sm z-10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-md flex items-center justify-center">
            <span className="text-white font-bold text-lg">O</span>
          </div>
          <h1 className="text-lg font-bold text-gray-800">OCR & Document Structure App</h1>
        </div>
        <button
          onClick={() => setIsConfigOpen(true)}
          className="p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-full transition-colors"
          title="Settings"
        >
          <Settings className="w-5 h-5" />
        </button>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel: Controls & Queue */}
        <div className="w-80 flex flex-col bg-white border-r border-gray-200 z-0">
          {/* Controls */}
          <div className="p-4 border-b border-gray-200">
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => pickFiles('files')}
                disabled={isProcessing}
                className="flex-1 flex items-center justify-center gap-2 py-2 px-3 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                <Upload className="w-4 h-4" />
                Files
              </button>
              <button
                onClick={() => pickFiles('directory')}
                disabled={isProcessing}
                className="flex-1 flex items-center justify-center gap-2 py-2 px-3 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                <Folder className="w-4 h-4" />
                Folder
              </button>
            </div>

            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                Processing Mode
              </label>
              <div className="flex rounded-md shadow-sm">
                <button
                  onClick={() => setMode('faithful')}
                  disabled={isProcessing}
                  className={`flex-1 py-1.5 text-sm font-medium border rounded-l-md ${
                    mode === 'faithful'
                      ? 'bg-blue-50 border-blue-500 text-blue-700 z-10'
                      : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Faithful
                </button>
                <button
                  onClick={() => setMode('enhanced')}
                  disabled={isProcessing}
                  className={`flex-1 py-1.5 text-sm font-medium border-t border-b border-r rounded-r-md ${
                    mode === 'enhanced'
                      ? 'bg-blue-50 border-blue-500 text-blue-700 z-10'
                      : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Enhanced
                </button>
              </div>
            </div>

            {!isProcessing ? (
              <button
                onClick={startBatch}
                disabled={jobList.length === 0}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700 disabled:bg-blue-300 transition-colors shadow-sm"
              >
                <Play className="w-4 h-4" />
                Start Processing
              </button>
            ) : (
              <button
                onClick={cancelBatch}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-red-50 text-red-700 border border-red-200 rounded-md font-medium hover:bg-red-100 transition-colors"
              >
                <StopCircle className="w-4 h-4" />
                Cancel Processing
              </button>
            )}
          </div>

          {/* Queue List */}
          <div className="flex-1 overflow-hidden">
            <FileQueueList
              jobs={jobList}
              selectedJobId={selectedJobId}
              onSelectJob={selectJob}
              onClear={clearJobs}
              isProcessing={isProcessing}
            />
          </div>
        </div>

        {/* Right Panel: Result Details */}
        <div className="flex-1 flex flex-col bg-gray-50 overflow-hidden">
          <div className="flex-1 overflow-hidden">
            <ResultDetail
              result={selectedJobId ? results[selectedJobId] || null : null}
            />
          </div>

          {/* Bottom Action Bar */}
          <div className="bg-white border-t border-gray-200 p-3 flex justify-end shrink-0">
            <button
              onClick={handleExport}
              disabled={Object.keys(results).length === 0 || isProcessing}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none disabled:opacity-50 transition-colors"
            >
              <Download className="w-4 h-4" />
              Export All Results
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
