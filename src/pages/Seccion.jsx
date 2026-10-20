import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getPagina, listarPublicados, fecha } from '../lib/data'
import { SECCIONES, TIPOS_RECOMENDACION } from '../lib/config'
import Texto from '../components/Texto'
import Tarjeta from '../components/Tarjeta'
import { Foto } from '../components/ImagenPrueba'

// Ficha de una recomendación: lleva directamente al original (otra web, periódico, revista o libro)
export function Recomendacion({ r }) {
  const destino = r.enlace_externo
  const verbo = r.tipo_recomendacion === 'libro' ? 'Ver el libro' : r.tipo_recomendacion === 'video' ? 'Ver o escuchar' : 'Leer'
  return (
    <article className="recomendacion">
      {destino ? (
        <a href={destino} target="_blank" rel="noopener noreferrer" className="rec-img" tabIndex={-1}><Foto src={r.imagen_url} /></a>
      ) : (
        <div className="rec-img"><Foto src={r.imagen_url} /></div>
      )}
      <div className="rec-cuerpo">
      <span className="tipo-rec">{TIPOS_RECOMENDACION[r.tipo_recomendacion] || 'Recomendación'}</span>
      <h3>{destino ? <a href={destino} target="_blank" rel="noopener noreferrer">{r.titulo}</a> : <Link to={`/articulo/${r.slug}`}>{r.titulo}</Link>}</h3>
      <div className="meta">
        {r.medio && <span className="medio">{r.medio}</span>}
        {r.firma && <span>{r.firma}</span>}
        <span>Recomendado el {fecha(r.publicado_at)}</span>
      </div>
      {r.resumen && <p>{r.resumen}</p>}
      {destino && (
        <a className="enlace-rec" href={destino} target="_blank" rel="noopener noreferrer">
          {verbo}{r.medio ? ` en ${r.medio}` : ''} ↗
        </a>
      )}
      </div>
    </article>
  )
}

export default function Seccion({ seccion }) {
  const s = SECCIONES[seccion]
  const [intro, setIntro] = useState(null)
  const [items, setItems] = useState(null)
  const [recs, setRecs] = useState([])
  const [tipo, setTipo] = useState('')

  useEffect(() => {
    setItems(null)
    setTipo('')
    getPagina(seccion).then(setIntro)
    listarPublicados({ seccion, limite: 50 }).then(setItems)
    // En la revista se muestran también las últimas recomendaciones
    if (seccion === 'revista') listarPublicados({ seccion: 'recomendaciones', limite: 4 }).then(setRecs)
    else setRecs([])
  }, [seccion])

  const esRec = seccion === 'recomendaciones'
  const visibles = (items || []).filter((r) => !tipo || r.tipo_recomendacion === tipo)

  return (
    <>
      <section className="cabecera-seccion">
        <div className="contenedor">
          <span className="etiqueta">{s.lema}</span>
          <h1>{intro?.titulo || s.nombre}</h1>
          {intro?.contenido && <Texto>{intro.contenido}</Texto>}
          {seccion === 'revista' && (
            <div className="subnav">
              <Link to="/revista" className="activo">Artículos</Link>
              <Link to="/revista/recomendaciones">Recomendaciones</Link>
            </div>
          )}
          {esRec && (
            <div className="subnav">
              <Link to="/revista">Artículos</Link>
              <Link to="/revista/recomendaciones" className="activo">Recomendaciones</Link>
            </div>
          )}
        </div>
      </section>
      <section className="contenedor bloque">
        {esRec && (
          <div className="chips">
            <button className={!tipo ? 'activo' : ''} onClick={() => setTipo('')}>Todo</button>
            {Object.entries(TIPOS_RECOMENDACION).map(([k, v]) => (
              <button key={k} className={tipo === k ? 'activo' : ''} onClick={() => setTipo(k)}>{v}</button>
            ))}
          </div>
        )}
        {items === null ? (
          <p className="vacio">Cargando…</p>
        ) : visibles.length ? (
          esRec ? (
            <div className="lista-recomendaciones">{visibles.map((r) => <Recomendacion key={r.id} r={r} />)}</div>
          ) : (
            <div className="rejilla">{visibles.map((a) => <Tarjeta key={a.id} a={a} />)}</div>
          )
        ) : (
          <p className="vacio">Todavía no hay publicaciones en esta sección.</p>
        )}
      </section>
      {recs.length > 0 && (
        <section className="contenedor bloque sin-arriba">
          <div className="bloque-cab">
            <h2 className="titulo-seccion">Recomendaciones</h2>
            <Link to="/revista/recomendaciones">Ver todas →</Link>
          </div>
          <div className="lista-recomendaciones columnas">{recs.map((r) => <Recomendacion key={r.id} r={r} />)}</div>
        </section>
      )}
    </>
  )
}
