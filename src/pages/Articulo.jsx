import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getArticulo, fecha, convocatoriaPasada } from '../lib/data'
import { SECCIONES } from '../lib/config'
import Texto from '../components/Texto'
import { Foto } from '../components/ImagenPrueba'
import NoEncontrado from './NoEncontrado'
import { useSeo } from '../lib/seo'

export default function Articulo() {
  const { slug } = useParams()
  const [a, setA] = useState(undefined)

  useEffect(() => {
    getArticulo(slug).then(setA)
  }, [slug])

  useSeo(a ? {
    titulo: a.titulo, descripcion: a.resumen || a.contenido, imagen: a.imagen_url, tipo: 'article', ruta: `/articulo/${a.slug}`,
    jsonld: [{ '@context': 'https://schema.org', '@type': 'Article', headline: a.titulo, description: (a.resumen || '').slice(0, 300),
      image: a.imagen_url ? [a.imagen_url] : undefined, datePublished: a.publicado_at || a.fecha, dateModified: a.actualizado_at || a.publicado_at,
      author: { '@type': a.firma ? 'Person' : 'Organization', name: a.firma || 'PATRIAM' },
      publisher: { '@type': 'Organization', name: 'PATRIAM', logo: { '@type': 'ImageObject', url: 'https://movimientopatriam.es/og-patriam.jpg' } },
      mainEntityOfPage: `https://movimientopatriam.es/articulo/${a.slug}`, inLanguage: 'es-ES' }],
  } : { titulo: a === null ? 'Página no encontrada' : '', noindex: a === null })

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
      {convocatoriaPasada(a) && <p className="caja-aviso">Esta convocatoria ya se celebró. Mira las próximas acciones en la agenda.</p>}
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
