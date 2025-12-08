import './styles.css'

import React from 'react'
import ReactDOM from 'react-dom/client'

import App from './App'
import { ToastProvider } from './Toast'

// Render the sidepanel app
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ToastProvider>
      <App />
    </ToastProvider>
  </React.StrictMode>
)
