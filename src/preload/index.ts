import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS, type IpcRequest, type IpcResponse, type IpcEvents } from '../shared/types'

// Setup event mapping
type EventCallback<K extends keyof IpcEvents> = (event: any, data: IpcEvents[K]) => void

const api = {
  // Methods
  invoke: <K extends keyof IpcRequest>(
    channel: K,
    data: IpcRequest[K]
  ): Promise<IpcResponse[K]> => {
    return ipcRenderer.invoke(channel, data)
  },

  // Event listeners
  on: <K extends keyof IpcEvents>(channel: K, callback: EventCallback<K>) => {
    const listener = (event: any, data: IpcEvents[K]) => callback(event, data)
    ipcRenderer.on(channel, listener)
    // Return unsubscribe function
    return () => {
      ipcRenderer.removeListener(channel, listener)
    }
  },

  // One-time event listeners
  once: <K extends keyof IpcEvents>(channel: K, callback: EventCallback<K>) => {
    const listener = (event: any, data: IpcEvents[K]) => callback(event, data)
    ipcRenderer.once(channel, listener)
  },

  // Remove listeners
  removeAllListeners: <K extends keyof IpcEvents>(channel: K) => {
    ipcRenderer.removeAllListeners(channel)
  }
}

contextBridge.exposeInMainWorld('api', api)

export type WindowApi = typeof api
