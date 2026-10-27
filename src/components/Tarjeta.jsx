import { Link } from 'react-router-dom'
import { SECCIONES } from '../lib/config'
import { fecha } from '../lib/data'
import { Foto } from './ImagenPrueba'

export default function Tarjeta({ a }) {
  return (
    <article className="tarjeta">
      <Link to={`/articulo/${a.slug}`} className="tarjeta-img" tabIndex={-1}>
        <Foto src={a.imagen_url} />
      </Link>
      <div className="tarjeta-cuerpo">
        <span className="etiqueta">{SECCIONES[a.seccion]?.nombre}</span>
        <h3>
          <Link to={`/articulo/${a.slug}`}>{a.titulo}</Link>
        </h3>
        {a.resumen && <p>{a.resumen}</p>}
        <div className="meta">
          {a.medio && <span className="medio">{a.medio}</span>}
          {a.firma && !a.medio && <span>{a.firma}</span>}
          <span>{fecha(a.fecha || a.publicado_at)}</span>
        </div>
      </div>
    </article>
  )
}
