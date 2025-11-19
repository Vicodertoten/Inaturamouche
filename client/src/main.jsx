import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import 'leaflet/dist/leaflet.css'
import App from './App.jsx'
import { UserProvider } from './context/UserContext'
import { GameProvider } from './context/GameContext'
import { registerSW } from 'virtual:pwa-register'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <UserProvider>
      <GameProvider>
        <App />
      </GameProvider>
    </UserProvider>
  </StrictMode>,
)

registerSW({ immediate: true })
