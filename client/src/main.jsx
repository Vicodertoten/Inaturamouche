import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import 'leaflet/dist/leaflet.css'
import App from './App.jsx'
import { LanguageProvider } from './context/LanguageContext.jsx'
import { PacksProvider } from './context/PacksContext.jsx'
import { UserProvider } from './context/UserContext'
import { GameProvider } from './context/GameContext'
import { registerSW } from 'virtual:pwa-register'

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

registerSW({ immediate: true })
