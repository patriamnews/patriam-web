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
import Recamara from './Recamara'
import ArchivoBoletin from './ArchivoBoletin'
import CalendarioBoletin from './CalendarioBoletin'
import Telefonos from './Telefonos'

const SECCIONES = ['Actualidad', 'Historia', 'Sociedad', 'Análisis']
const TIPOS_REC = [['Podcast', 'Podcast'], ['Vídeo', 'Vídeo o documental'], ['Libro', 'Libro'], ['Película', 'Película']]
const QUE = {
  noticia: { titulo: 'Una noticia', texto: 'Pega el enlace de la noticia: el titular, el resumen y la foto se rellenan solos.', icono: '📰' },
  firma: { titulo: 'Un artículo con firma', texto: 'Un texto propio o de un colaborador, como «Yo fui a un cole de monjas».', icono: '✍️' },
  recomendacion: { titulo: 'Una recomendación', texto: 'El podcast, el vídeo, el libro o la película de la semana.', icono: '⭐' },
  editorial: { titulo: 'La editorial', texto: 'El texto que abre el boletín.', icono: '🖋️' },
  espana: { titulo: 'Una noticia para España al día', texto: 'Una que no puede faltar (también de Instagram, X o YouTube). Sale destacada toda la semana.', icono: '🇪🇸' },
}
const fechaLarga = (f) => { try { return new Date(f + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }) } catch { return f } }
// Cada uno firma en el boletín como lo hace siempre: Isabel O.C., LOC (Laura)…
const firmaDe = (p) => {
  const n = p?.nombre || '', e = (p?.email || '').toLowerCase()
  if (/^isabel olivares/i.test(n)) return 'Isabel O.C.'
  if (/^laura olivares/i.test(n) || e === 'lauraolivareses@yahoo.es') return 'LOC'
  return n
}
const tituloDe = (it) => it.datos.titular || it.datos.titulo || '(sin título)'

export default function BoletinPaso() {
  const { perfil } = useAuth()
  const [base, setBase] = useState('')
  const [e, setE] = useState(null)
  const [error, setError] = useState('')
  const [que, setQue] = useState('')
  const [hecho, setHecho] = useState('')
  const [fecha, setFecha] = useState('')
  const [previa, setPrevia] = useState(null)
  const [copiado, setCopiado] = useState('')
  const pedirPrevia = async (nueva) => {
    setError('')
    try { const p = await api('previa', nueva ? { nueva: true } : {}); setPrevia(p); return p } catch (x) { setError(x.message) }
  }
  // El número que aún no ha salido solo se ve en la vista previa temporal con clave, nunca en la dirección pública
  const verPrevia = async () => {
    const w = window.open('', '_blank')
    const p = previa || await pedirPrevia(false)
    if (p?.url && w) { w.location.href = p.url; if (!copiado) copiar(p.clave, 'clave') } else if (w) w.close()
  }
  const copiar = (t, que) => { try { navigator.clipboard.writeText(t); setCopiado(que); setTimeout(() => setCopiado(''), 2000) } catch { /* sin portapapeles */ } }
  const [pest, setPest] = useState('este')
  const [aRecamara, setARecamara] = useState(false)
  const [editar, setEditar] = useState(null)

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
  useEffect(() => { window.scrollTo(0, 0) }, [que, hecho, pest])

  const [aviso, setAviso] = useState('')
  const aprobar = async (id) => {
    setAviso('')
    try { setE(await api('aprobar', { id })) } catch (x) { setAviso(x.message) }
  }
  const hacerPrincipal = async (id) => {
    setAviso('')
    try { setE(await api('principal', { id })) } catch (x) { setAviso(x.message) }
  }
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(null)
  const enviar = async () => {
    const p = e.items.find((x) => x.id === e.principal)
    const sale = ab.fecha > e.hoy ? ` El boletín sale HOY en la web (estaba previsto para el ${fechaLarga(ab.fecha)}).` : ''
    if (!window.confirm(`Se manda ya el boletín nº ${ab.numero} por correo a ${e.suscriptores || 0} suscriptores${p ? `, con «${tituloDe(p)}» como noticia principal` : ''}.${sale} ¿Seguimos?`)) return
    setEnviando(true); setAviso('')
    try { const j = await api('enviar'); setE(j); setEnviado(j.enviados) } catch (x) { setAviso(x.message) }
    setEnviando(false)
  }
  const accion = async (a, cuerpo) => {
    setError('')
    try { setE(await api(a, cuerpo)) } catch (x) { setError(x.message) }
  }

  if (error && !e) return <p className="error">No se ha podido abrir: {error}</p>
  if (!e) return <p>Cargando el boletín…</p>
  const ab = e.abierto

  const pestanas = [['este', ab ? `Este boletín (nº ${ab.numero})` : 'Este boletín'], ['recamara', 'Recámara'], ['archivo', 'Archivo por temas'], ['calendario', 'Calendario'],
    ...(e.puedeAprobar ? [['telefonos', 'Teléfonos WhatsApp']] : [])]
  const barra = (
    <nav className="bp-pestanas">
      {pestanas.map(([k, t]) => <button key={k} type="button" className={pest === k && !que && !hecho ? 'activa' : ''} onClick={() => { setQue(''); setHecho(''); setPest(k) }}>{t}</button>)}
    </nav>
  )
  const maxNum = Math.max(ab?.numero || 0, e.ultimo?.numero || 0, 1)
  const numeros = Array.from({ length: maxNum }, (_, i) => maxNum - i)
    .filter((n) => !ab || n !== ab.numero || ab.fecha <= e.hoy)   // el abierto, solo el día que sale

  if (hecho) {
    return (
      <>{barra}
      <div className="bp-hecho">
        <p className="bp-ok">✓ {hecho}</p>
        <div className="bp-botones">
          <button type="button" className="btn" onClick={() => setHecho('')}>Añadir otra cosa</button>
          <button type="button" className="btn btn-sec" onClick={verPrevia}>Ver cómo va el boletín (vista previa) ↗</button>
          <button type="button" className="btn btn-sec" onClick={() => { setHecho(''); setPest('recamara') }}>Ver la recámara</button>
        </div>
      </div>
      </>
    )
  }

  if (editar) {
    return (
      <>{barra}
      <Formulario
        que={editar.tipo} perfil={perfil} api={api} numero={ab?.numero} editar={editar}
        onCancelar={() => setEditar(null)}
        onHecho={(j, texto) => { setE(j); setEditar(null); setHecho(texto) }}
      />
      </>
    )
  }

  if (que && (ab || aRecamara)) {
    return (
      <>{barra}
      <Formulario
        que={que} perfil={perfil} api={api} numero={aRecamara ? null : ab.numero}
        onCancelar={() => { setQue(''); setARecamara(false) }}
        onHecho={(j, texto) => { setE(j); setQue(''); setARecamara(false); setHecho(texto) }}
      />
      </>
    )
  }

  if (aRecamara) {
    return (
      <>{barra}
      <div className="bp">
        <section className="bp-caja">
          <span className="bp-num">R</span>
          <div>
            <button type="button" className="pub-volver bp-atras" onClick={() => setARecamara(false)}>← Volver a la recámara</button>
            <h2>¿Qué guardas en la recámara?</h2>
            <div className="bp-que">
              {Object.entries(QUE).filter(([k]) => k !== 'espana').map(([k, q]) => (
                <button key={k} type="button" onClick={() => setQue(k)}><span aria-hidden>{q.icono}</span><b>{q.titulo}</b><small>{q.texto}</small></button>
              ))}
            </div>
          </div>
        </section>
      </div>
      </>
    )
  }

  if (pest === 'recamara') return <>{barra}<Recamara api={api} abierto={ab} onSubir={() => setARecamara(true)} onUsado={(j, t) => { setE(j); setHecho(t) }} /></>
  if (pest === 'archivo') return <>{barra}<ArchivoBoletin api={api} /></>
  if (pest === 'calendario') return <>{barra}<CalendarioBoletin /></>
  if (pest === 'telefonos' && e.puedeAprobar) return <>{barra}<Telefonos numeros={numeros} /></>

  const delAbierto = ab ? e.items.filter((x) => x.numero === ab.numero && ['aprobado', 'pendiente'].includes(x.estado)) : []
  const pendientes = e.items.filter((x) => x.estado === 'pendiente' && !delAbierto.includes(x))
  const aRec = async (x) => { try { await api('a-recamara', { id: x.id }); cargar() } catch (z) { setError(z.message) } }

  return (
    <>{barra}
    <div className="bp">
      {error && <p className="error">{error}</p>}

      {/* Paso 1: el boletín */}
      <section className={`bp-caja ${ab ? 'abierto' : ''}`}>
        <span className="bp-num">1</span>
        {ab ? (
          <div>
            <h2>Boletín nº {ab.numero} · abierto</h2>
            <p>Sale el <b>{fechaLarga(ab.fecha)}</b>. Todo lo que añadas ahora va en este boletín. Hasta ese día solo lo ve el equipo.</p>
            {!previa ? (
              <button type="button" className="btn bp-grande" onClick={() => pedirPrevia(false)}>👁 Vista previa del nº {ab.numero} para el equipo</button>
            ) : (
              <div className="bp-previa">
                <p><b>Enlace:</b> <a href={previa.url} target="_blank" rel="noopener noreferrer">{previa.url}</a> <button type="button" className="btn btn-sec" onClick={() => copiar(previa.url, 'url')}>{copiado === 'url' ? '✓ Copiado' : 'Copiar'}</button></p>
                <p><b>Clave:</b> <code>{previa.clave}</code> <button type="button" className="btn btn-sec" onClick={() => copiar(previa.clave, 'clave')}>{copiado === 'clave' ? '✓ Copiada' : 'Copiar'}</button></p>
                <p><button type="button" className="btn btn-sec" onClick={() => copiar(`Vista previa del boletín nº ${previa.numero} (solo equipo PATRIAM)\n${previa.url}\nClave: ${previa.clave}`, 'todo')}>{copiado === 'todo' ? '✓ Copiado' : 'Copiar enlace y clave para mandarlo'}</button>{' '}
                  <a className="btn" href={previa.url} target="_blank" rel="noopener noreferrer">Abrir ↗</a></p>
                <p className="bp-nota">Vale hasta el {new Date(previa.expira).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}. <button type="button" className="btn-texto" onClick={() => pedirPrevia(true)}>Cambiar la clave</button> (el enlace anterior deja de valer).</p>
              </div>
            )}
            <p className="bp-nota">La vista previa enseña todo lo que lleva el número, también lo pendiente de aprobar, y solo se abre con la clave. Los lectores verán solo lo aprobado, el día que salga.</p>
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
            <p className="bp-nota">También puedes coger algo ya preparado de la <button type="button" className="btn-texto" onClick={() => setPest('recamara')}>recámara</button>.</p>
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

      {/* Lo que ya hay */}
      {ab && (
        <section className="bp-caja">
          <span className="bp-num">3</span>
          <div>
            <h2>Lo que ya hay en el nº {ab.numero} <small>({delAbierto.length + (e.delEditor?.items?.length || 0)})</small></h2>
            <p className="bp-nota">Todo lo que va en este número, lo haya subido quien sea y como sea. Nada sale en el boletín hasta que alguien lo aprueba, tampoco los cambios.</p>
            {e.puedeAprobar && (
              <div className="bp-tope">
                <p>Pulsa <b>«Aprobar»</b> en cada cosa que tiene que salir. Lo que no apruebes no sale. Cuando esté todo, abajo tienes <b>«Enviar»</b>.</p>
                <p className="bp-cuenta"><b>{e.articulosAprobados || 0} de {e.maxArticulos || 10} artículos aprobados</b>{(e.articulosAprobados || 0) >= (e.maxArticulos || 10) ? ' · ya está lleno: para aprobar otro, pasa uno a la recámara' : ''}</p>
                {aviso && <p className="error">{aviso}</p>}
              </div>
            )}
            {(delAbierto.length || pendientes.length || e.delEditor?.items?.length) ? (
              <ul className="bp-lista">
                {(e.delEditor?.items || []).map((x, i) => (
                  <li key={'ed' + i} className="bp-del-editor">
                    <span><b>{x.titulo}</b><small>{[x.tipo, x.firma, x.medio].filter(Boolean).join(' · ')} · desde el editor</small></span>
                  </li>
                ))}
                {[...delAbierto, ...(e.puedeAprobar ? pendientes : [])].map((x) => (
                  <Fila key={x.id} x={x} leer api={api} onCambio={setE}>
                    {e.puedeAprobar && x.estado === 'pendiente' && <button type="button" className="btn" onClick={() => aprobar(x.id)}>✓ Aprobar</button>}
                    {e.puedeAprobar && x.tipo === 'firma' && x.numero === ab.numero && (x.id === e.principal
                      ? <span className="bp-principal">★ Noticia principal</span>
                      : <button type="button" className="btn btn-sec" onClick={() => hacerPrincipal(x.id)}>★ Hacer principal</button>)}
                    {QUE[x.tipo] && <button type="button" className="btn btn-sec" onClick={() => setEditar(x)}>Cambiar</button>}
                    {x.numero === ab.numero && x.tipo !== 'espana' && <button type="button" className="btn btn-sec" onClick={() => aRec(x)}>A la recámara</button>}
                  </Fila>
                ))}
              </ul>
            ) : <p>Todavía no hay nada en este boletín.</p>}
            {e.delEditor && !e.delEditor.aprobado && <p className="bp-nota">Lo que haya en el editor del boletín para el nº {ab.numero} saldrá aquí en cuanto se apruebe allí.</p>}
            <p className="bp-nota"><button type="button" className="btn-texto" onClick={() => { pedirPrevia(false); window.scrollTo(0, 0) }}>Vista previa del nº {ab.numero} para el equipo (con todo, también lo pendiente)</button></p>
          </div>
        </section>
      )}

      {/* Enviar */}
      {ab && e.puedeAprobar && (() => {
        const p = e.items.find((x) => x.id === e.principal)
        const env = e.envio || {}
        return (
          <section className="bp-caja">
            <span className="bp-num">4</span>
            <div>
              <h2>Enviar el nº {ab.numero}</h2>
              <p>El correo y el WhatsApp abren con <b>una noticia principal</b> a lo grande; debajo, el resto de lo aprobado; y al final, <b>«Leer el boletín completo»</b>.</p>
              {p ? (
                <div className="bp-envio-principal">
                  {p.datos.imagen ? <img src={p.datos.imagen} alt="" /> : null}
                  <div><small>★ Noticia principal{e.principalElegida ? '' : ' · propuesta: la que más puede correr'}</small><b>{tituloDe(p)}</b>
                    {p.estado !== 'aprobado' && <em className="bp-espera">Sin aprobar todavía: apruébala arriba para que salga</em>}
                    <span className="bp-nota">Para cambiarla, pulsa «★ Hacer principal» en otro artículo.</span></div>
                </div>
              ) : <p className="bp-nota">Todavía no hay ningún artículo de PATRIAM para abrir el envío.</p>}
              {env.enviado && <p className="aviso-ok">Ya enviado: {env.correos} correos{env.whatsapp ? ` y ${env.whatsapp} WhatsApp` : ''} ({new Date(env.enviado).toLocaleString('es-ES', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}). Si vuelves a pulsar, solo se manda a quien falte.</p>}
              {enviado && <p className="aviso-ok">Hecho: {enviado.correos} correos{enviado.whatsapp ? ` y ${enviado.whatsapp} WhatsApp` : ''} enviados{enviado.errores ? ` · ${enviado.errores} no se han podido mandar` : ''}.</p>}
              {(env.errores || []).length > 0 && <p className="bp-nota">Últimos fallos: {env.errores.map((x) => `${x.a} (${x.motivo})`).join(' · ')}</p>}
              <button type="button" className="btn bp-grande" disabled={enviando} onClick={enviar}>{enviando ? 'Enviando…' : `✉ Enviar ahora a ${e.suscriptores || 0} suscriptores`}</button>
              <p className="bp-nota">Si no lo envías tú, sale solo el {fechaLarga(ab.fecha)} a las 8:00 con lo que esté aprobado. Por WhatsApp, sin la API de Meta, se manda desde <button type="button" className="btn-texto" onClick={() => setPest('telefonos')}>Teléfonos WhatsApp</button>.</p>
            </div>
          </section>
        )
      })()}
    </div>
    </>
  )
}

function Fila({ x, children, leer, api, onCambio }) {
  const T = { noticia: 'Noticia', firma: 'Artículo', recomendacion: x.datos.tipo || 'Recomendación', editorial: 'Editorial', ficha: 'Presentación', espana: 'España al día' }
  const [bio, setBio] = useState(x.datos.bio || '')
  const [abierto, setAbierto] = useState(false)
  const cuerpo = x.datos.texto || x.datos.critica || x.datos.comentario || x.datos.resumen || ''
  const bajarCv = async () => {
    try {
      const j = await api('cv', { id: x.id })
      const a = document.createElement('a'); a.href = 'data:application/octet-stream;base64,' + j.datos; a.download = j.nombre || 'cv'; a.click()
    } catch (e) { window.alert(e.message) }
  }
  return (
    <li>
      <span className="bp-foto">
        {x.datos.imagen ? <img src={x.datos.imagen} alt="" /> : <span className="bp-sinimg" />}
      </span>
      <div>
        <small>{T[x.tipo]}{x.datos.seccion && x.tipo !== 'recomendacion' ? ' · ' + x.datos.seccion : ''} · {x.datos.comenta || x.datos.autor || x.datos.firma || x.autor}</small>
        <b>{tituloDe(x)}</b>
        {x.estado === 'aprobado' && <em className="bp-espera bp-aprobado">✓ Aprobado</em>}
        {x.estado === 'pendiente' && <em className="bp-espera">{x.propuestaDe ? `Cambio de ${x.propuestaDe}, esperando aprobación` : 'Esperando aprobación'}</em>}
        {x.origen === 'correo' && <em className="bp-espera bp-correo">✉ por correo{x.remite ? ' · ' + x.remite : ''}</em>}
        {leer && x.tipo === 'ficha' && (
          <details className="bp-leer" open={!x.datos.bio}>
            <summary>Ver y preparar la presentación</summary>
            {x.datos.cargo && <p><i>{x.datos.cargo}</i></p>}
            {x.tieneCv && <p><button type="button" className="btn btn-sec" onClick={bajarCv}>Descargar su CV</button></p>}
            <textarea rows={6} value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Escribe aquí su presentación a partir del CV (es lo que verán los lectores)" style={{ width: '100%' }} />
            <p><button type="button" className="btn btn-sec" onClick={async () => { try { onCambio(await api('editar-ficha', { id: x.id, bio })) } catch (e) { window.alert(e.message) } }}>Guardar presentación</button></p>
          </details>
        )}
        {leer && x.tipo !== 'ficha' && (cuerpo || x.datos.entradilla) && (
          <button type="button" className="btn-texto bp-abrir" onClick={() => setAbierto(!abierto)}>{abierto ? 'Cerrar' : 'Abrir y leer'}</button>
        )}
        {abierto && (
          <div className="bp-lector">
            {x.datos.imagen && <img src={x.datos.imagen} alt="" />}
            <h3>{tituloDe(x)}</h3>
            {(x.datos.autor || x.datos.comenta) && <p className="bp-lector-firma">{x.datos.autor || x.datos.comenta}{x.datos.cargo ? ' · ' + x.datos.cargo : ''}</p>}
            {x.datos.entradilla && <p><i>{x.datos.entradilla}</i></p>}
            {x.datos.url && <p><a href={x.datos.url} target="_blank" rel="noopener noreferrer">Abrir el enlace ↗</a></p>}
            {x.tipo === 'recomendacion' && x.datos.comentario && x.datos.critica && <p>{x.datos.comentario.replace(/\*\*|\*/g, '')}</p>}
            {cuerpo.split(/\n\s*\n/).map((b, i) => /^##\s/.test(b) ? <h4 key={i}>{b.replace(/^##\s+/, '')}</h4> : <p key={i}>{b.replace(/\*\*|\*/g, '').replace(/^>\s?/gm, '').replace(/^-\s+/gm, '• ')}</p>)}
            <button type="button" className="btn-texto" onClick={() => setAbierto(false)}>Cerrar</button>
          </div>
        )}
        {!['ficha', 'espana'].includes(x.tipo) && api && <OpcionesImagen x={x} api={api} onCambio={onCambio} />}
      </div>
      <span className="bp-acc">{children}</span>
    </li>
  )
}

/* Imágenes de un artículo: se suben una o varias; elige la que va quien subió el artículo (si solo hay una, se queda esa) */
function OpcionesImagen({ x, api, onCambio }) {
  const ops = x.imagenesOpciones || []
  const [subiendo, setSubiendo] = useState(false)
  const anadir = async (ev) => {
    const f = ev.target.files?.[0]; if (!f) return
    setSubiendo(true)
    try { onCambio(await api('imagen-anadir', { id: x.id, url: await subirArchivo('imagenes', f) })) } catch (e) { window.alert(e.message) }
    setSubiendo(false); ev.target.value = ''
  }
  const elegir = async (url) => { try { onCambio(await api('imagen-elegir', { id: x.id, url })) } catch (e) { window.alert(e.message) } }
  return (
    <div className="bp-imgs">
      {ops.length > 0 && <small>{x.puedoElegirImagen ? (ops.length > 1 ? 'Elige la imagen que va (la marcada es la que sale):' : 'Imagen (añade otras para poder elegir):') : 'Imágenes propuestas (elige quien subió el artículo):'}</small>}
      {ops.length > 0 && (
        <div className="bp-imgs-lista">
          {ops.map((u) => (
            <button key={u} type="button" className={u === x.datos.imagen ? 'elegida' : ''} disabled={!x.puedoElegirImagen || u === x.datos.imagen} onClick={() => elegir(u)} title={u === x.datos.imagen ? 'La que va' : 'Elegir esta'}>
              <img src={u} alt="" loading="lazy" />{u === x.datos.imagen && <span>✓</span>}
            </button>
          ))}
        </div>
      )}
      <label className="btn-texto">{subiendo ? 'Subiendo…' : ops.length ? '+ Añadir otra imagen para elegir' : '+ Añadir imagen'}<input type="file" accept="image/*" hidden onChange={anadir} /></label>
    </div>
  )
}

/* ---------- el formulario de cada cosa ---------- */
function Formulario({ que, perfil, api, numero, editar, onCancelar, onHecho }) {
  const [d, setD] = useState(editar
    ? { seccion: 'Actualidad', tipo: 'Libro', ...editar.datos, titular: editar.datos.titular || (editar.tipo === 'espana' ? editar.datos.titulo : undefined), firma: editar.datos.autor || editar.datos.comenta || editar.datos.firma || '' }
    : { seccion: 'Actualidad', tipo: 'Libro', firma: firmaDe(perfil) })
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

  const destino = useRef(numero ? 'boletin' : 'recamara')
  const enviar = async (ev) => {
    ev.preventDefault()
    setError(''); setEnviando(true)
    try {
      if (editar) {
        const j = await api('editar', { id: editar.id, datos: d })
        const x = j.items.find((y) => y.id === editar.id)
        onHecho(j, 'Cambio guardado. No sale hasta que alguien pulse «Aprobar».')
        setEnviando(false)
        return
      }
      const j = await api('subir', { tipo: que, datos: d, destino: destino.current })
      const nuevo = j.items.find((x) => x.id === j.nuevo)
      onHecho(j, j.recamara ? 'Guardado en la recámara. Cuando prepares un boletín, lo eliges allí con «Usar en el nº…».' : nuevo?.estado === 'pendiente' && nuevo
        ? `Guardado en el boletín nº ${numero}. No sale hasta que alguien pulse «Aprobar».`
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
      <h2>{QUE[que].icono} {editar ? 'Cambiar: ' + (editar.datos.titulo || editar.datos.titular || '') : QUE[que].titulo} <small>{editar ? '' : numero ? `para el boletín nº ${numero}` : 'para la recámara'}</small></h2>

      {que === 'espana' && <>
        {enlace('Enlace', 'De un periódico, Instagram, X, YouTube… Si es de Instagram o X, el titular y la foto hay que ponerlos a mano.')}
        <P t="Titular"><input value={d.titular || ''} onChange={pon('titular')} required /></P>
        <P t="Resumen" ayuda="Una o dos líneas."><textarea rows={3} value={d.resumen || ''} onChange={pon('resumen')} /></P>
        <P t="Foto"><Imagen valor={d.imagen} cambiar={pon('imagen')} /></P>
        <P t="Nombre del botón" ayuda="El medio o la cuenta: «El Debate», «Instagram de Vox»…"><input value={d.medio || ''} onChange={pon('medio')} /></P>
        <P t="¿De qué es?">
          <div className="bp-opciones">{['Política', 'Economía'].map((t) => <button key={t} type="button" className={(d.tema || 'Política') === t ? 'activo' : ''} onClick={() => pon('tema')(t)}>{t}</button>)}</div>
        </P>
      </>}

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
      {editar ? <button type="submit" className="btn bp-grande" disabled={enviando}>{enviando ? 'Guardando…' : 'Guardar el cambio'}</button> :
      <div className="bp-botones">
        {numero && <button type="submit" className="btn bp-grande" disabled={enviando} onClick={() => { destino.current = 'boletin' }}>{enviando ? 'Guardando…' : `Meter en el boletín nº ${numero}`}</button>}
        {que !== 'espana' && <button type="submit" className={numero ? 'btn btn-sec bp-grande' : 'btn bp-grande'} disabled={enviando} onClick={() => { destino.current = 'recamara' }}>{enviando && !numero ? 'Guardando…' : 'Guardar en la recámara'}</button>}
      </div>
      }
      {!editar && numero && que !== 'espana' && <small className="bp-nota">«Guardar en la recámara» lo deja preparado para otro número, sin meterlo en este.</small>}
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
