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

if (import.meta.env.PROD) {
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      updateSW(true)
    },
  })
}
