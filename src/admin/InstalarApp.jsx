import { useEffect, useState } from 'react'
import { escuchar, esIOS, instalada, instalar, puedeInstalar } from '../lib/instalar'

// Botón del menú de Gestión para instalarla como aplicación en el PC o el móvil
export default function InstalarApp() {
  const [, refrescar] = useState(0)
  const [ayuda, setAyuda] = useState(false)
  useEffect(() => escuchar(() => refrescar((n) => n + 1)), [])

  if (instalada()) return null
  if (puedeInstalar())
    return (
      <button className="btn btn-instalar" onClick={instalar}>
        Instalar la app
      </button>
    )
  return (
    <div className="instalar-ayuda">
      <button className="btn-texto" onClick={() => setAyuda(!ayuda)}>Instalar la app ▾</button>
      {ayuda && (
        <div className="instalar-pasos">
          {esIOS() ? (
            <p>En iPhone o iPad, con <b>Safari</b>: pulse <b>Compartir</b> (el cuadrado con la flecha) y luego <b>Añadir a pantalla de inicio</b>.</p>
          ) : (
            <p>En Chrome o Edge: pulse el icono de instalar de la barra de direcciones, o el menú <b>⋮</b> › <b>Instalar PATRIAM</b> (en el móvil: <b>Añadir a pantalla de inicio</b>).</p>
          )}
        </div>
      )}
    </div>
  )
}
