import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { LanguageProvider } from './context/LanguageContext.jsx'
import { PacksProvider } from './context/PacksContext.jsx'
import { UserProvider } from './context/UserContext'
import { GameProvider } from './context/GameContext'
import { registerSW } from 'virtual:pwa-register'
import { initClientObservability } from './services/metrics.js'

initClientObservability()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <LanguageProvider>
      <PacksProvider>
        <UserProvider>
          <GameProvider>
            <App />
          </GameProvider>
        </UserProvider>
      </PacksProvider>
    </LanguageProvider>
  </StrictMode>,
)

if (import.meta.env.PROD && typeof window !== 'undefined') {
  const registerServiceWorker = () => {
    const updateSW = registerSW({
      onNeedRefresh() {
        updateSW(true)
      },
    })
  }

  if (document.readyState === 'complete') {
    registerServiceWorker()
  } else {
    window.addEventListener('load', registerServiceWorker, { once: true })
  }
}
