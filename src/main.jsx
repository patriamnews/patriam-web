import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
// Tipografías alojadas en la propia web (sin llamadas a Google: mejor para el RGPD)
import '@fontsource/spectral/latin-400.css'
import '@fontsource/spectral/latin-400-italic.css'
import '@fontsource/spectral/latin-600.css'
import '@fontsource/spectral/latin-700.css'
import '@fontsource/inter/latin-400.css'
import '@fontsource/inter/latin-500.css'
import '@fontsource/inter/latin-600.css'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './lib/auth.jsx'
import { CarritoProvider } from './lib/carrito.jsx'

// Rutas con # (patriam.netlify.app/#/sobre-patriam): funcionan en cualquier
// alojamiento, aunque se suba solo la carpeta dist y sin reglas de redirección.
const Router = HashRouter

// Si alguien entra con una dirección sin # (p. ej. /sobre-patriam), se le lleva a /#/sobre-patriam
if (window.location.pathname !== '/' && window.location.pathname !== '/index.html' && !window.location.hash && !window.location.protocol.startsWith('file')) {
  window.location.replace('/#' + window.location.pathname + window.location.search)
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Router>
      <AuthProvider>
        <CarritoProvider>
          <App />
        </CarritoProvider>
      </AuthProvider>
    </Router>
  </StrictMode>,
)
