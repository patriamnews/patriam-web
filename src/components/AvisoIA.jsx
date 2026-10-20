import { Link } from 'react-router-dom'
import { USO_IA } from '../lib/config'

// Etiqueta de transparencia (art. 50 Reglamento UE 2024/1689 de Inteligencia Artificial)
export default function AvisoIA({ uso, imagenIA }) {
  if ((!uso || uso === 'ninguno') && !imagenIA) return null
  return (
    <div className="aviso-ia" role="note">
      <strong>Transparencia IA.</strong>{' '}
      {uso && uso !== 'ninguno' && <span>{USO_IA[uso]}. </span>}
      {imagenIA && <span>La imagen ha sido generada o manipulada con inteligencia artificial. </span>}
      <Link to="/transparencia-ia">Más información</Link>
    </div>
  )
}
