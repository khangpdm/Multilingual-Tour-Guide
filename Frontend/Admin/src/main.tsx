import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AdminToaster } from './shared/notifications'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AdminToaster />
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)

