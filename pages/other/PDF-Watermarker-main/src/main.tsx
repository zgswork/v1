import './polyfills'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './ui/App'
import { registerSW } from 'virtual:pwa-register'
// Service workers don't run from file:// — only register when served over http(s).
if (location.protocol !== 'file:' && 'serviceWorker' in navigator) {
  registerSW({ immediate: true })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
