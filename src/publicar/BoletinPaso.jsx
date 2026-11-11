// «Boletín paso a paso»: abrir el boletín de la semana y meter en él cada cosa sin tocar el editor.
// 1) Se ve cuál es el boletín abierto (o se abre el siguiente con un botón).
// 2) Se elige qué se quiere añadir: noticia, artículo con firma, recomendación o editorial.
// 3) Se rellenan los datos que hacen falta (título, imagen, firma…) y se pulsa «Meter en el boletín».
// Lo de Carlos e Isabel sale directamente; lo de los demás espera su visto bueno.
// Los datos los guarda el propio boletín (aportar.php) y entran solos en la web del boletín y en el correo.
import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { getAjustes } from '../lib/data'
import { urlBoletin } from '../lib/boletin'
import { subirArchivo } from '../admin/subir'

const SECCIONES = ['Actualidad', 'Historia', 'Sociedad', 'Análisis']
const TIPOS_REC = [['Podcast', 'Podcast'], ['Vídeo', 'Vídeo o documental'], ['Libro', 'Libro'], ['Película', 'Película']]
const QUE = {
  noticia: { titulo: 'Una noticia', texto: 'Pega el enlace de la noticia: el titular, el resumen y la foto se rellenan solos.', icono: '📰' },
  firma: { titulo: 'Un artículo con firma', texto: 'Un texto propio o de un colaborador, como «Yo fui a un cole de monjas».', icono: '✍️' },
  recomendacion: { titulo: 'Una recomendación', texto: 'El podcast, el vídeo, el libro o la película de la semana.', icono: '⭐' },
  editorial: { titulo: 'La editorial', texto: 'El texto que abre el boletín.', icono: '🖋️' },
}
const fechaLarga = (f) => { try { return new Date(f + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }) } catch { return f } }
const firmaDe = (p) => (/^isabel olivares/i.test(p?.nombre || '') ? 'Isabel O.C.' : p?.nombre || '')
const tituloDe = (it) => it.datos.titular || it.datos.titulo || '(sin título)'

export default function BoletinPaso() {
  const { perfil } = useAuth()
  const [base, setBase] = useState('')
  const [e, setE] = useState(null)
  const [error, setError] = useState('')
  const [que, setQue] = useState('')
  const [hecho, setHecho] = useState('')
  const [fecha, setFecha] = useState('')

  const api = async (accion, cuerpo) => {
    const b = base || urlBoletin(await getAjustes())
    if (!base) setBase(b)
    const { data } = await supabase.auth.getSession()
    const r = await fetch(`${b}aportar.php?accion=${accion}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (data.session?.access_token || '') },
      body: JSON.stringify(cuerpo || {}),
    })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(r.status === 401 ? 'La sesión ha caducado: sal y vuelve a entrar.' : j.error || 'Error ' + r.status)
    return j
  }
  const cargar = () => api('estado').then(setE).catch((x) => setError(x.message))
  useEffect(() => { cargar() }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { window.scrollTo(0, 0) }, [que, hecho])

  const accion = async (a, cuerpo) => {
    setError('')
    try { setE(await api(a, cuerpo)) } catch (x) { setError(x.message) }
  }

  if (error && !e) return <p className="error">No se ha podido abrir: {error}</p>
  if (!e) return <p>Cargando el boletín…</p>
  const ab = e.abierto
  const vista = ab ? `${base}?vista=${ab.numero}` : base

  if (hecho) {
    return (
      <div className="bp-hecho">
        <p className="bp-ok">✓ {hecho}</p>
        <div className="bp-botones">
          <button type="button" className="btn" onClick={() => setHecho('')}>Añadir otra cosa</button>
          <a className="btn btn-sec" href={vista} target="_blank" rel="noopener noreferrer">Ver cómo va el boletín ↗</a>
        </div>
      </div>
    )
  }

  if (que && ab) {
    return (
      <Formulario
        que={que} perfil={perfil} api={api} numero={ab.numero}
        onCancelar={() => setQue('')}
        onHecho={(j, texto) => { setE(j); setQue(''); setHecho(texto) }}
      />
    )
  }

  const pendientes = e.items.filter((x) => x.estado === 'pendiente')
  const delAbierto = ab ? e.items.filter((x) => x.numero === ab.numero && ['aprobado', 'pendiente'].includes(x.estado)) : []

  return (
    <div className="bp">
      {error && <p className="error">{error}</p>}

      {/* Paso 1: el boletín */}
      <section className={`bp-caja ${ab ? 'abierto' : ''}`}>
        <span className="bp-num">1</span>
        {ab ? (
          <div>
            <h2>Boletín nº {ab.numero} · abierto</h2>
            <p>Sale el <b>{fechaLarga(ab.fecha)}</b>. Todo lo que añadas ahora va en este boletín. Hasta ese día solo lo ve el equipo.</p>
            <a href={vista} target="_blank" rel="noopener noreferrer">Ver cómo va ↗</a>
          </div>
        ) : (
          <div>
            <h2>Abrir el boletín nº {e.siguiente.numero}</h2>
            <p>{e.ultimo ? `El último que salió es el nº ${e.ultimo.numero} (${fechaLarga(e.ultimo.fecha)}). ` : ''}El siguiente es el <b>nº {e.siguiente.numero}</b> y saldrá el <b>{fechaLarga(fecha || e.siguiente.fecha)}</b>.</p>
            <label className="bp-fecha">¿Otro día? <input type="date" min={e.hoy} value={fecha || e.siguiente.fecha} onChange={(x) => setFecha(x.target.value)} /></label>
            <button type="button" className="btn bp-grande" onClick={() => accion('abrir', { fecha: fecha || e.siguiente.fecha })}>Abrir el boletín nº {e.siguiente.numero}</button>
          </div>
        )}
      </section>

      {/* Paso 2: qué se añade */}
      {ab && (
        <section className="bp-caja">
          <span className="bp-num">2</span>
          <div>
            <h2>¿Qué quieres añadir?</h2>
            <div className="bp-que">
              {Object.entries(QUE).map(([k, q]) => (
                <button key={k} type="button" onClick={() => setQue(k)}>
                  <span aria-hidden>{q.icono}</span><b>{q.titulo}</b><small>{q.texto}</small>
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Aprobar (Carlos e Isabel) */}
      {e.puedeAprobar && pendientes.length > 0 && (
        <section className="bp-caja bp-pend">
          <span className="bp-num">!</span>
          <div>
            <h2>Esperan tu visto bueno ({pendientes.length})</h2>
            {pendientes.some((x) => x.origen === 'correo') && <p className="bp-nota">Los marcados «por correo» han llegado a hola@movimientopatriam.com con el asunto «ARTICULO» y el nombre de quien firma. Ábrelos con «Leer» antes de aprobar.</p>}
            <ul className="bp-lista">
              {pendientes.map((x) => (
                <Fila key={x.id} x={x} leer>
                  {x.tipo === 'firma' && (
                    <select value={x.datos.seccion || 'Análisis'} onChange={(v) => accion('seccion', { id: x.id, seccion: v.target.value })} aria-label="Sección">
                      {SECCIONES.map((s) => <option key={s}>{s}</option>)}
                    </select>
                  )}
                  <button type="button" className="btn" onClick={() => accion('aprobar', { id: x.id })}>Aprobar</button>
                  <button type="button" className="btn btn-sec" onClick={() => accion('rechazar', { id: x.id })}>No publicar</button>
                </Fila>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* Lo que ya hay */}
      {ab && (
        <section className="bp-caja">
          <span className="bp-num">3</span>
          <div>
            <h2>Lo que ya hay en el nº {ab.numero}</h2>
            {delAbierto.length ? (
              <ul className="bp-lista">
                {delAbierto.map((x) => (
                  <Fila key={x.id} x={x}>
                    {(x.mio || e.puedeAprobar) && <button type="button" className="btn-texto" onClick={() => { if (window.confirm('¿Quitar «' + tituloDe(x) + '» del boletín?')) accion('borrar', { id: x.id }) }}>Quitar</button>}
                  </Fila>
                ))}
              </ul>
            ) : <p>Todavía no se ha añadido nada desde aquí.</p>}
            <p className="bp-nota">Lo que se haya puesto desde el editor del boletín no sale en esta lista, pero está en el boletín.</p>
          </div>
        </section>
      )}
    </div>
  )
}

function Fila({ x, children, leer }) {
  const T = { noticia: 'Noticia', firma: 'Artículo', recomendacion: x.datos.tipo || 'Recomendación', editorial: 'Editorial' }
  return (
    <li>
      {x.datos.imagen ? <img src={x.datos.imagen} alt="" /> : <span className="bp-sinimg" />}
      <div>
        <small>{T[x.tipo]}{x.datos.seccion && x.tipo !== 'recomendacion' ? ' · ' + x.datos.seccion : ''} · {x.datos.comenta || x.datos.autor || x.datos.firma || x.autor}</small>
        <b>{tituloDe(x)}</b>
        {x.estado === 'pendiente' && <em className="bp-espera">Esperando aprobación</em>}
        {x.origen === 'correo' && <em className="bp-espera bp-correo">✉ por correo{x.remite ? ' · ' + x.remite : ''}</em>}
        {leer && (x.datos.texto || x.datos.entradilla) && (
          <details className="bp-leer">
            <summary>Leer</summary>
            {x.datos.entradilla && <p><i>{x.datos.entradilla}</i></p>}
            {(x.datos.texto || '').split(/\n\s*\n/).map((b, i) => /^##\s/.test(b) ? <h4 key={i}>{b.replace(/^##\s+/, '')}</h4> : <p key={i}>{b.replace(/\*\*|\*/g, '').replace(/^>\s?/gm, '').replace(/^-\s+/gm, '• ')}</p>)}
          </details>
        )}
      </div>
      <span className="bp-acc">{children}</span>
    </li>
  )
}

/* ---------- el formulario de cada cosa ---------- */
function Formulario({ que, perfil, api, numero, onCancelar, onHecho }) {
  const [d, setD] = useState({ seccion: 'Actualidad', tipo: 'Libro', firma: firmaDe(perfil) })
  const [enviando, setEnviando] = useState(false)
  const [leyendo, setLeyendo] = useState(false)
  const [error, setError] = useState('')
  const pon = (k) => (x) => setD((v) => ({ ...v, [k]: x.target ? x.target.value : x }))
  const leido = useRef('')

  // Al pegar el enlace se rellenan solos el titular, el resumen, la foto y el medio
  const leerEnlace = async () => {
    const u = (d.url || '').trim()
    if (!/^https?:\/\//i.test(u) || leido.current === u) return
    leido.current = u
    setLeyendo(true)
    try {
      const j = await api('enlace', { url: u })
      setD((v) => ({
        ...v,
        titular: v.titular || j.titular, titulo: v.titulo || (que === 'recomendacion' ? j.titular : v.titulo),
        resumen: v.resumen || j.resumen, descripcion: v.descripcion || (que === 'recomendacion' ? j.resumen : v.descripcion),
        imagen: v.imagen || j.imagen, medio: v.medio || j.medio,
      }))
    } catch { /* se rellena a mano */ }
    setLeyendo(false)
  }

  const enviar = async (ev) => {
    ev.preventDefault()
    setError(''); setEnviando(true)
    try {
      const j = await api('subir', { tipo: que, datos: d })
      const nuevo = j.items.find((x) => x.id === j.nuevo)
      onHecho(j, nuevo?.estado === 'pendiente'
        ? `Guardado en el boletín nº ${numero}. Saldrá cuando Carlos o Isabel lo aprueben.`
        : `Ya está en el boletín nº ${numero}.`)
    } catch (x) { setError(x.message) }
    setEnviando(false)
  }

  const enlace = (t, ayuda) => (
    <P t={t} ayuda={ayuda}>
      <input type="url" value={d.url || ''} onChange={pon('url')} onBlur={leerEnlace} onPaste={() => setTimeout(leerEnlace, 50)} placeholder="https://…" />
      {leyendo && <small>Leyendo la noticia…</small>}
    </P>
  )
  const seccion = (
    <P t="¿En qué sección va?">
      <div className="bp-opciones">{SECCIONES.map((s) => <button key={s} type="button" className={d.seccion === s ? 'activo' : ''} onClick={() => pon('seccion')(s)}>{s}</button>)}</div>
    </P>
  )
  const firma = (t = 'Firma') => <P t={t} ayuda="Cómo quieres que aparezca el nombre."><input value={d.firma || ''} onChange={pon('firma')} required /></P>

  return (
    <form className="bp-form" onSubmit={enviar}>
      <button type="button" className="pub-volver bp-atras" onClick={onCancelar}>← Elegir otra cosa</button>
      <h2>{QUE[que].icono} {QUE[que].titulo} <small>para el boletín nº {numero}</small></h2>

      {que === 'noticia' && <>
        <Sugerencias api={api} elegir={(g) => setD((v) => ({
          ...v, titular: g.titulo, resumen: g.resumen || '', imagen: g.imagen || '', url: g.medios[0]?.url || '',
          medio: g.medios.map((m) => m.medio).join(' · '),
          enlaces: g.medios.map((m) => ({ medio: m.medio, url: m.url })),
        }))} />
        {enlace('Enlace de la noticia', 'Cópialo del periódico y pégalo aquí.')}
        <P t="Titular"><input value={d.titular || ''} onChange={pon('titular')} required /></P>
        <P t="Resumen" ayuda="Dos o tres líneas."><textarea rows={3} value={d.resumen || ''} onChange={pon('resumen')} /></P>
        <P t="Foto"><Imagen valor={d.imagen} cambiar={pon('imagen')} /></P>
        <P t="Medio"><input value={d.medio || ''} onChange={pon('medio')} placeholder="El Debate, The Objective…" /></P>
        <P t="Comentario de PATRIAM (si quieres)" ayuda="Lo que pensamos de la noticia. Sale debajo, con tu firma."><textarea rows={3} value={d.comentario || ''} onChange={pon('comentario')} /></P>
        {seccion}
        {firma('Quién la comenta')}
      </>}

      {que === 'firma' && <>
        <P t="Título"><input value={d.titulo || ''} onChange={pon('titulo')} required /></P>
        <P t="Entradilla (si quieres)" ayuda="Una o dos frases que invitan a leerlo."><textarea rows={2} value={d.entradilla || ''} onChange={pon('entradilla')} /></P>
        <P t="Texto" ayuda="Pégalo tal cual. Una línea en blanco separa los párrafos."><textarea rows={14} value={d.texto || ''} onChange={pon('texto')} required /></P>
        <P t="Foto"><Imagen valor={d.imagen} cambiar={pon('imagen')} /></P>
        {seccion}
        {firma()}
        <P t="Cargo o presentación (si quieres)"><input value={d.cargo || ''} onChange={pon('cargo')} placeholder="Abogada, colaboradora de PATRIAM…" /></P>
      </>}

      {que === 'recomendacion' && <>
        <P t="¿Qué es?">
          <div className="bp-opciones">{TIPOS_REC.map(([k, t]) => <button key={k} type="button" className={d.tipo === k ? 'activo' : ''} onClick={() => pon('tipo')(k)}>{t}</button>)}</div>
          <small>Sale una de cada tipo por boletín: si ya había otra del mismo tipo, esta la sustituye.</small>
        </P>
        {enlace('Enlace (si lo hay)', 'Donde se escucha, se ve o se compra.')}
        <P t="Título"><input value={d.titulo || ''} onChange={pon('titulo')} required /></P>
        <P t={d.tipo === 'Película' ? 'Director, año y reparto' : d.tipo === 'Libro' ? 'Autor y editorial' : 'Autor o canal'}><input value={d.medio || ''} onChange={pon('medio')} /></P>
        <P t="Foto o cartel"><Imagen valor={d.imagen} cambiar={pon('imagen')} /></P>
        <P t="¿Por qué la recomendamos?" ayuda={d.tipo === 'Película' ? 'Sin contar el final.' : undefined}><textarea rows={4} value={d.comentario || ''} onChange={pon('comentario')} required /></P>
        {d.tipo === 'Película' && <P t="Crítica completa (si la tienes)" ayuda="Esta sí puede contar el final: sale sola en el boletín siguiente."><textarea rows={10} value={d.critica || ''} onChange={pon('critica')} /></P>}
        {firma()}
      </>}

      {que === 'editorial' && <>
        <P t="Título"><input value={d.titulo || ''} onChange={pon('titulo')} required /></P>
        <P t="Texto" ayuda="Una línea en blanco separa los párrafos."><textarea rows={14} value={d.texto || ''} onChange={pon('texto')} required /></P>
        <P t="Foto (si quieres)"><Imagen valor={d.imagen} cambiar={pon('imagen')} /></P>
        {firma()}
      </>}

      {error && <p className="error">{error}</p>}
      <button type="submit" className="btn bp-grande" disabled={enviando}>{enviando ? 'Guardando…' : `Meter en el boletín nº ${numero}`}</button>
    </form>
  )
}

// «España al día»: las noticias de la semana que se recogen solas; se elige una y se rellena el formulario
function Sugerencias({ api, elegir }) {
  const [lista, setLista] = useState(null)
  const [abierto, setAbierto] = useState(false)
  const [buscar, setBuscar] = useState('')
  const [elegida, setElegida] = useState('')
  useEffect(() => {
    if (abierto && !lista) api('sugerencias').then((j) => setLista(j.grupos || [])).catch(() => setLista([]))
  }, [abierto]) // eslint-disable-line react-hooks/exhaustive-deps
  const q = buscar.trim().toLowerCase()
  const vistas = (lista || []).filter((g) => !q || (g.titulo + ' ' + (g.resumen || '')).toLowerCase().includes(q)).slice(0, 12)
  return (
    <div className="bp-sug">
      <button type="button" className="bp-sug-abrir" onClick={() => setAbierto(!abierto)}>
        📰 <b>Coger una noticia de «España al día»</b> <small>Las de esta semana en The Objective, El Debate, La Gaceta y El Español. {abierto ? '▲' : '▼'}</small>
      </button>
      {abierto && (
        <div>
          <input type="search" placeholder="Buscar: huelga, Sánchez, vivienda…" value={buscar} onChange={(e) => setBuscar(e.target.value)} />
          {!lista ? <p>Cargando…</p> : !vistas.length ? <p>No hay ninguna con eso.</p> : (
            <ul>
              {vistas.map((g, i) => (
                <li key={i} className={elegida === g.titulo ? 'activa' : ''}>
                  <button type="button" onClick={() => { elegir(g); setElegida(g.titulo); setAbierto(false) }}>
                    {g.imagen ? <img src={g.imagen} alt="" loading="lazy" /> : <span className="bp-sinimg" />}
                    <span><b>{g.titulo}</b><small>{g.medios.map((m) => m.medio).join(' · ')} · {new Date(g.fecha).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}</small></span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {elegida && !abierto && <small className="bp-sug-ok">✓ Rellenado con «{elegida}». Revisa los datos y añade el comentario.</small>}
    </div>
  )
}

// Cada pregunta del formulario, numerada (el número lo pone la hoja de estilos)
function P({ t, ayuda, children }) {
  return <div className="bp-campo"><span className="bp-n" /><div><label>{t}</label>{ayuda && <small>{ayuda}</small>}{children}</div></div>
}

function Imagen({ valor, cambiar }) {
  const [subiendo, setSubiendo] = useState(false)
  const [error, setError] = useState('')
  const subir = async (ev) => {
    const f = ev.target.files?.[0]
    if (!f) return
    setError(''); setSubiendo(true)
    try { cambiar(await subirArchivo('imagenes', f)) } catch (x) { setError('No se ha podido subir: ' + x.message) }
    setSubiendo(false)
  }
  return (
    <div className="bp-imagen">
      {valor && <img src={valor} alt="" />}
      <div>
        <label className="btn btn-sec">{subiendo ? 'Subiendo…' : valor ? 'Cambiar la foto' : 'Subir una foto'}<input type="file" accept="image/*" hidden onChange={subir} /></label>
        {valor && <button type="button" className="btn-texto" onClick={() => cambiar('')}>Quitar</button>}
        <input type="url" value={valor || ''} onChange={cambiar} placeholder="…o pega la dirección de la imagen" />
        {error && <small className="error">{error}</small>}
      </div>
    </div>
  )
}
