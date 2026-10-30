import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
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
import { activarApp } from './lib/instalar'

// publicar.movimientopatriam.es abre directamente la página «Publicar»
// (es una app aparte, instalable en el móvil y en el PC: siempre se queda en «Publicar»)
if (/^publicar\./i.test(location.hostname) && !/^\/publicar/.test(location.pathname)) {
  history.replaceState(null, '', '/publicar')
}

// En la Gestión y en Acceso, la web se puede instalar como aplicación
if (/^\/(gestion|acceso|publicar)/.test(location.pathname)) activarApp()

// Direcciones limpias (movimientopatriam.es/tienda), buenas para Google. El servidor (.htaccess)
// sirve index.html en cualquier ruta, y las direcciones antiguas con # se convierten en index.html.
const Router = BrowserRouter

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
