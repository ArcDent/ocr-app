import { contextBridge } from 'electron'

// Placeholder API - will be expanded in Phase 2
const api = {
  version: '0.1.0',
}

contextBridge.exposeInMainWorld('api', api)

export type WindowApi = typeof api
