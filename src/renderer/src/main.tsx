import React from 'react'
import ReactDOM from 'react-dom/client'
import { Toaster } from 'sonner'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
    <Toaster
      position="bottom-right"
      toastOptions={{
        style: {
          borderRadius: '12px',
          border: '1px solid rgb(251 191 36 / 0.3)',
        },
      }}
    />
  </React.StrictMode>
)
