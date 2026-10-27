import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getPagina, listarPublicados } from '../lib/data'
import { SECCIONES } from '../lib/config'
import Calendario, { claveDia, MESES } from '../components/Calendario'
import Texto from '../components/Texto'
import Tarjeta from '../components/Tarjeta'
import { Foto } from '../components/ImagenPrueba'
import NoEncontrado from './NoEncontrado'

const diaSemana = (d) => new Date(d).toLocaleDateString('es-ES', { weekday: 'long' })
const hora = (d) => new Date(d).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
const fechaLarga = (d) => new Date(d).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
const esPasada = (a) => new Date(a.fecha_fin || a.fecha_inicio) < new Date()

function FechaBloque({ d }) {
  const f = new Date(d)
  return (
    <div className="fecha-bloque">
      <span className="fb-dia">{f.getDate()}</span>
      <span className="fb-mes">{MESES[f.getMonth()].slice(0, 3)}</span>
    </div>
  )
}

function FilaAccion({ a, enlaces }) {
  const pasada = esPasada(a)
  return (
    <article className={`accion ${pasada ? 'pasada' : ''} ${a.estado === 'cancelada' ? 'cancelada' : ''} ${a.imagen_url ? 'con-cartel' : ''}`}>
      <FechaBloque d={a.fecha_inicio} />
      <div className="accion-cuerpo">
        <div className="meta">
          <span className="cap">{diaSemana(a.fecha_inicio)} · {hora(a.fecha_inicio)}</span>
          {a.lugar && <span>{a.lugar}</span>}
          {a.dirigida === 'mujeres' && <span className="estado estado-mujeres">Solo mujeres</span>}
          {a.dirigida === 'hombres' && <span className="estado estado-mujeres">Solo hombres</span>}
          {a.estado === 'cancelada' && <span className="estado estado-rechazado">Cancelada</span>}
        </div>
        <h3><Link to={`/accion/${a.slug}`}>{a.titulo}</Link></h3>
        {a.resumen && <p>{a.resumen}</p>}
        <div className="accion-enlaces">
          {enlaces[a.porque_id] && <Link to={`/articulo/${enlaces[a.porque_id]}`}>Por qué lo hacemos →</Link>}
          {pasada && enlaces[a.cronica_id] && <Link to={`/articulo/${enlaces[a.cronica_id]}`} className="cronica">Crónica de la acción →</Link>}
          {!pasada && <Link to={`/accion/${a.slug}`}>Ver detalles →</Link>}
          {a.video_url && <a href={a.video_url} target="_blank" rel="noopener noreferrer">▶ Ver el vídeo ↗</a>}
        </div>
      </div>
      {a.imagen_url && (
        <Link to={`/accion/${a.slug}`} className="accion-cartel" tabIndex={-1}>
          <img src={a.imagen_url} alt={`Cartel: ${a.titulo}`} loading="lazy" />
          {a.imagen_ia && <span className="chip-ia">Imagen IA</span>}
        </Link>
      )}
    </article>
  )
}

// Página de cada área de acción: agenda con calendario + próximas y pasadas + publicaciones
export function AgendaSeccion({ seccion }) {
  const s = SECCIONES[seccion]
  const [intro, setIntro] = useState(null)
  const [acciones, setAcciones] = useState(null)
  const [enlaces, setEnlaces] = useState({})
  const [articulos, setArticulos] = useState([])
  const hoy = new Date()
  const [mes, setMes] = useState([hoy.getFullYear(), hoy.getMonth()])
  const [dia, setDia] = useState(null)
  const [verPasadas, setVerPasadas] = useState(6)

  useEffect(() => {
    setAcciones(null)
    setDia(null)
    getPagina(seccion).then(setIntro)
    listarPublicados({ seccion, limite: 6 }).then(setArticulos)
    supabase
      .from('acciones')
      .select('*')
      .eq('seccion', seccion)
      .eq('publicada', true)
      .eq('aprobada', true)
      .order('fecha_inicio')
      .then(async ({ data }) => {
        const l = data || []
        setAcciones(l)
        // Slugs de los artículos enlazados ("por qué" y crónicas)
        const ids = [...new Set(l.flatMap((a) => [a.porque_id, a.cronica_id]).filter(Boolean))]
        if (ids.length) {
          const { data: arts } = await supabase.from('articulos').select('id, slug').in('id', ids).eq('estado', 'publicado')
          setEnlaces(Object.fromEntries((arts || []).map((x) => [x.id, x.slug])))
        }
      })
  }, [seccion])

  const delMes = useMemo(
    () => (acciones || []).filter((a) => { const f = new Date(a.fecha_inicio); return f.getFullYear() === mes[0] && f.getMonth() === mes[1] }),
    [acciones, mes],
  )
  const proximas = (acciones || []).filter((a) => !esPasada(a))
  const pasadas = (acciones || []).filter(esPasada).reverse()
  const delDia = dia ? (acciones || []).filter((a) => claveDia(a.fecha_inicio) === dia) : null

  return (
    <>
      <section className="cabecera-seccion">
        <div className="contenedor">
          <span className="etiqueta">{s.lema}</span>
          <h1>{intro?.titulo || s.nombre}</h1>
          {intro?.contenido && <Texto>{intro.contenido}</Texto>}
        </div>
      </section>

      <div className="contenedor bloque agenda">
        <aside className="agenda-lateral">
          <Calendario mes={mes} setMes={setMes} acciones={acciones || []} dia={dia} setDia={setDia} />
          <div className="agenda-mes">
            <h3>{delDia ? `Acciones del ${new Date(dia).getDate()} de ${MESES[mes[1]].toLowerCase()}` : `En ${MESES[mes[1]].toLowerCase()}`}</h3>
            {(delDia || delMes).length ? (
              <ul>
                {(delDia || delMes).map((a) => (
                  <li key={a.id}>
                    <span>{new Date(a.fecha_inicio).getDate()}</span>
                    <Link to={`/accion/${a.slug}`}>{a.titulo}</Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="vacio">No hay acciones este mes.</p>
            )}
            {dia && <button className="btn-texto" onClick={() => setDia(null)}>Ver todo el mes</button>}
          </div>
        </aside>

        <div className="agenda-central">
          {acciones === null ? (
            <p className="vacio">Cargando…</p>
          ) : (
            <>
              <h2 className="titulo-seccion">Próximas acciones</h2>
              {proximas.length ? (
                <div className="lista-acciones">{proximas.map((a) => <FilaAccion key={a.id} a={a} enlaces={enlaces} />)}</div>
              ) : (
                <p className="vacio">Pronto anunciaremos nuevas acciones.</p>
              )}

              <h2 className="titulo-seccion espacio">Acciones realizadas</h2>
              {pasadas.length ? (
                <>
                  <div className="lista-acciones">{pasadas.slice(0, verPasadas).map((a) => <FilaAccion key={a.id} a={a} enlaces={enlaces} />)}</div>
                  {pasadas.length > verPasadas && (
                    <button className="btn btn-claro" onClick={() => setVerPasadas(verPasadas + 6)}>Ver más acciones realizadas</button>
                  )}
                </>
              ) : (
                <p className="vacio">Todavía no hay acciones realizadas.</p>
              )}
            </>
          )}
        </div>
      </div>

      {articulos.length > 0 && (
        <section className="contenedor bloque sin-arriba">
          <h2 className="titulo-seccion">Publicaciones de {s.nombre.toLowerCase()}</h2>
          <div className="rejilla">{articulos.map((a) => <Tarjeta key={a.id} a={a} />)}</div>
        </section>
      )}
    </>
  )
}

// Ficha de una acción
export function FichaAccion() {
  const { slug } = useParams()
  const [a, setA] = useState(undefined)
  const [rel, setRel] = useState({})

  useEffect(() => {
    supabase.from('acciones').select('*').eq('slug', slug).eq('publicada', true).eq('aprobada', true).maybeSingle().then(async ({ data }) => {
      setA(data)
      if (!data) return
      const ids = [data.porque_id, data.cronica_id].filter(Boolean)
      const r = {}
      if (ids.length) {
        const { data: arts } = await supabase.from('articulos').select('id, slug, titulo, resumen').in('id', ids).eq('estado', 'publicado')
        ;(arts || []).forEach((x) => (x.id === data.porque_id ? (r.porque = x) : (r.cronica = x)))
      }
      if (data.campana_id) {
        const { data: c } = await supabase.from('campanas').select('slug, titulo').eq('id', data.campana_id).maybeSingle()
        r.campana = c
      }
      setRel(r)
    })
  }, [slug])

  if (a === undefined) return <p className="contenedor vacio">Cargando…</p>
  if (!a) return <NoEncontrado />

  const s = SECCIONES[a.seccion]
  const pasada = esPasada(a)
  const gcal = (() => {
    const f = (d) => new Date(d).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
    const fin = a.fecha_fin || new Date(new Date(a.fecha_inicio).getTime() + 2 * 3600e3).toISOString()
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(a.titulo)}&dates=${f(a.fecha_inicio)}/${f(fin)}&location=${encodeURIComponent(a.lugar || '')}`
  })()

  return (
    <article className="contenedor bloque ficha-accion">
      <Link to={s.ruta} className="etiqueta">← {s.nombre}</Link>
      <div className="ficha-accion-cab">
        <FechaBloque d={a.fecha_inicio} />
        <div>
          <h1>{a.titulo}</h1>
          <p className="entradilla">
            <span className="cap">{fechaLarga(a.fecha_inicio)}</span> · {hora(a.fecha_inicio)}
            {a.lugar ? ` · ${a.lugar}` : ''}
          </p>
          {a.dirigida === 'mujeres' && <p className="caja-aviso">Acción dirigida solo a mujeres.</p>}
          {a.dirigida === 'hombres' && <p className="caja-aviso">Acción dirigida solo a hombres.</p>}
          {a.estado === 'cancelada' && <p className="caja-aviso">Esta acción se ha cancelado.</p>}
          {pasada && a.estado !== 'cancelada' && <span className="estado estado-publicado">Acción realizada</span>}
        </div>
      </div>

      <div className="ficha-accion-cuerpo">
        <div>
          {a.imagen_url ? (
            <figure className="cartel-accion">
              <img src={a.imagen_url} alt={`Cartel: ${a.titulo}`} />
              {a.imagen_ia && <figcaption>Imagen generada o manipulada con inteligencia artificial (art. 50 del Reglamento europeo de IA).</figcaption>}
            </figure>
          ) : (
            <Foto src={a.imagen_url} className="imagen-articulo" />
          )}
          <Texto>{a.descripcion}</Texto>
        </div>
        <aside className="ficha-accion-lateral">
          {rel.porque && (
            <Link to={`/articulo/${rel.porque.slug}`} className="enlace-tarjeta">
              <span className="etiqueta">Por qué lo hacemos</span>
              <b>{rel.porque.titulo}</b>
              {rel.porque.resumen && <span>{rel.porque.resumen}</span>}
            </Link>
          )}
          {pasada && rel.cronica && (
            <Link to={`/articulo/${rel.cronica.slug}`} className="enlace-tarjeta cronica">
              <span className="etiqueta">Crónica de la acción</span>
              <b>{rel.cronica.titulo}</b>
              {rel.cronica.resumen && <span>{rel.cronica.resumen}</span>}
            </Link>
          )}
          {rel.campana && (
            <Link to={`/campanas/${rel.campana.slug}`} className="enlace-tarjeta">
              <span className="etiqueta">Campaña relacionada</span>
              <b>{rel.campana.titulo}</b>
              <span>Firma la campaña →</span>
            </Link>
          )}
          {a.video_url && <a className="btn btn-bloque" href={a.video_url} target="_blank" rel="noopener noreferrer">▶ Ver el vídeo de la convocatoria ↗</a>}
          {!pasada && a.estado !== 'cancelada' && (
            <a className="btn btn-claro btn-bloque" href={gcal} target="_blank" rel="noopener noreferrer">Añadir a mi calendario ↗</a>
          )}
        </aside>
      </div>
    </article>
  )
}
