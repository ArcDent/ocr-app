import { app, BrowserWindow, Menu } from 'electron'
import path from 'path'
import { registerIpcHandlers } from './ipc-handlers'

let mainWindow: BrowserWindow | null = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    // Hide the default OS title bar. On Windows/Linux the system-provided
    // min/max/close controls are re-exposed via titleBarOverlay with colors
    // drawn from the app's paper/ink palette so the control strip blends
    // with the custom header rendered in App.tsx. On macOS the native
    // traffic lights are retained (titleBarStyle: 'hidden' leaves them in
    // place) and this overlay option is ignored.
    titleBarStyle: 'hidden',
    ...(process.platform !== 'darwin'
      ? {
          titleBarOverlay: {
            color: '#f3eee2', // --paper-2, matches <header> background
            symbolColor: '#1a1815', // --ink, control glyph color
            height: 40, // matches <header> py-5 visual band
          },
        }
      : {}),
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null)
  registerIpcHandlers()
  createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})
