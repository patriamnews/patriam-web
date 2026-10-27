import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getArticulo, fecha } from '../lib/data'
import { SECCIONES } from '../lib/config'
import Texto from '../components/Texto'
import { Foto } from '../components/ImagenPrueba'
import NoEncontrado from './NoEncontrado'

export default function Articulo() {
  const { slug } = useParams()
  const [a, setA] = useState(undefined)

  useEffect(() => {
    getArticulo(slug).then(setA)
  }, [slug])

  if (a === undefined) return <p className="contenedor vacio">Cargando…</p>
  if (!a) return <NoEncontrado />

  const s = SECCIONES[a.seccion]
  return (
    <article className={`contenedor estrecho bloque articulo articulo-${a.seccion}`}>
      <Link to={s.ruta} className="etiqueta">{s.nombre}</Link>
      <h1 className="titulo-articulo">{a.titulo}</h1>
      {a.resumen && <p className="entradilla">{a.resumen}</p>}
      <div className="meta">
        {a.medio && <span className="medio">{a.medio}</span>}
        {a.firma && !a.medio && <span>{a.firma}</span>}
        <span>{fecha(a.fecha || a.publicado_at)}</span>
      </div>
      {!a.imagen_url && <Foto className="imagen-articulo" />}
      {a.imagen_url && (
        <figure className="imagen-articulo">
          <img src={a.imagen_url} alt="" />
        </figure>
      )}
      <Texto>{a.contenido}</Texto>
      {a.enlace_externo && (
        <p>
          <a className="btn" href={a.enlace_externo} target="_blank" rel="noopener noreferrer">
            Leer la noticia completa{a.medio ? ` en ${a.medio}` : ''} ↗
          </a>
        </p>
      )}
      {a.seccion === 'revista' && (
        <p className="nota-opinion">
          Los artículos de opinión expresan el criterio de sus autores. La publicación ha sido revisada y aprobada por la dirección de la revista.
        </p>
      )}
    </article>
  )
}
