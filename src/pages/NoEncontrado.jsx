import { Link } from 'react-router-dom'
import { useSeo } from '../lib/seo'

export default function NoEncontrado() {
  useSeo({ titulo: 'Página no encontrada', noindex: true })
  return (
    <div className="contenedor estrecho bloque">
      <h1>Página no encontrada</h1>
      <p>
        <Link to="/">Volver al inicio</Link>
      </p>
    </div>
  )
}
