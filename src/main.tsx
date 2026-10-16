import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'
import './ambient.css'
import { initializePwa } from './services/pwa'
import { isLocalDevelopment } from './services/developmentMode'

const companionPreview = import.meta.env.DEV && isLocalDevelopment(import.meta.env.DEV, window.location.hostname)
  && new URLSearchParams(window.location.search).get('preview') === 'companion'
const root = createRoot(document.getElementById('root')!)
if (companionPreview) {
  void import('./components/CompanionPreview').then(({ default: Preview }) => root.render(<StrictMode><Preview /></StrictMode>))
} else {
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  )

  void initializePwa(import.meta.env.PROD)
}
