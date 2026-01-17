import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import 'leaflet/dist/leaflet.css'
import App from './App.jsx'
import { LanguageProvider } from './context/LanguageContext.jsx'
import { PacksProvider } from './context/PacksContext.jsx'
import { UserProvider } from './context/UserContext'
import { XPProvider } from './context/XPContext.jsx'
import { StreakProvider } from './context/StreakContext.jsx'
import { AchievementProvider } from './context/AchievementContext.jsx'
import { GameProvider } from './context/GameContext'
import { registerSW } from 'virtual:pwa-register'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <LanguageProvider>
      <PacksProvider>
        <UserProvider>
          <XPProvider>
            <StreakProvider>
              <AchievementProvider>
                <GameProvider>
                  <App />
                </GameProvider>
              </AchievementProvider>
            </StreakProvider>
          </XPProvider>
        </UserProvider>
      </PacksProvider>
    </LanguageProvider>
  </StrictMode>,
)

registerSW({ immediate: true })
