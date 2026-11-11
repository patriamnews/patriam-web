// RRSS › publicar con las cuentas de cada uno (X, Facebook, Instagram), lo preparado en el boletín y el seguimiento.
// El servidor (api/rrss-publicar.php) guarda las claves de cada persona en la carpeta privada y nunca las devuelve.
import { useEffect, useState } from 'react'
import { tokenEquipo } from '../lib/equipo'

export const NOMBRE_RED = { x: 'X', facebook: 'Facebook', instagram: 'Instagram' }
const fecha = (f) => { try { return new Date(f).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) } catch { return f } }

export async function rrss(accion, cuerpo = {}) {
  const r = await fetch('/api/rrss-publicar.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: tokenEquipo(), accion, ...cuerpo }) })
  const d = await r.json().catch(() => null)
  if (!d) throw new Error('No se ha podido conectar con el servidor.')
  if (!r.ok) throw new Error(d.error === 'sesion' ? 'La sesión ha caducado: sal y vuelve a entrar.' : d.error || 'Error ' + r.status)
  return d
}

/* Botones «Publicar en X / Facebook / Instagram» (si la cuenta está conectada) */
export function BotonesPublicar({ texto, imagen, conexion, redes = ['x', 'facebook', 'instagram'], origen, onHecho }) {
  const [enviando, setEnviando] = useState('')
  const [msg, setMsg] = useState('')
  const publicar = async (red) => {
    const img = typeof imagen === 'function' ? await imagen() : imagen
    if (!window.confirm(`¿Publicar ahora en ${NOMBRE_RED[red]}${img ? ' con la imagen' : ''}?`)) return
    setEnviando(red); setMsg('')
    try { const d = await rrss('publicar', { red, texto, imagen: img || '', origen }); setMsg('✔ Publicado en ' + NOMBRE_RED[red]); onHecho?.(d) }
    catch (e) { setMsg('✗ ' + e.message) }
    setEnviando('')
  }
  if (!conexion) return null
  return (
    <div className="rrss-publicar">
      {redes.filter((r) => NOMBRE_RED[r]).map((r) => (
        <button key={r} type="button" className="btn" disabled={!!enviando || !conexion[r] || !texto} title={conexion[r] ? '' : 'Conecta antes tu cuenta'} onClick={() => publicar(r)}>
          {enviando === r ? 'Publicando…' : `Publicar en ${NOMBRE_RED[r]}`}
        </button>
      ))}
      {msg && <span className={msg.startsWith('✔') ? 'ok' : 'error'}>{msg}</span>}
    </div>
  )
}

/* Conectar mis cuentas: las claves de la app de X y de la página de Facebook/Instagram */
export function Conectar({ conexion, onCambio }) {
  const [abierto, setAbierto] = useState(false)
  const [f, setF] = useState({ x: {}, meta: {} })
  const [prueba, setPrueba] = useState(null)
  const [error, setError] = useState('')
  const set = (g, k) => (e) => setF({ ...f, [g]: { ...f[g], [k]: e.target.value } })
  const guardar = async () => {
    setError(''); setPrueba(null)
    try { const d = await rrss('conectar', f); setPrueba(d.prueba); onCambio(d.conexion); setF({ x: {}, meta: {} }) } catch (e) { setError(e.message) }
  }
  const resumen = conexion ? Object.entries(NOMBRE_RED).map(([k, v]) => `${conexion[k] ? '✔' : '—'} ${v}`).join(' · ') : 'Cargando…'
  return (
    <div className="rrss-conectar">
      <button type="button" className="btn-texto" onClick={() => setAbierto(!abierto)}>🔑 Conectar mis cuentas <small>({resumen})</small> {abierto ? '▲' : '▼'}</button>
      {abierto && (
        <div className="formulario">
          <p className="letra-pequena">Cada uno conecta sus propias cuentas. Las claves se guardan solo en el servidor y no se vuelven a enseñar: para cambiar una, escríbela de nuevo; para quitarla, pon un guion (-). Los campos vacíos se quedan como están.</p>
          <h4>X (Twitter)</h4>
          <p className="letra-pequena">En developer.x.com › tu app › «Keys and tokens»: API Key y Secret, y Access Token y Secret (con permiso de lectura y escritura). X cobra por uso: unos 0,015 $ por publicación y 0,20 $ si lleva enlace.</p>
          <div className="dos-col">
            <label>API Key<input value={f.x.apiKey || ''} onChange={set('x', 'apiKey')} autoComplete="off" /></label>
            <label>API Key Secret<input type="password" value={f.x.apiSecret || ''} onChange={set('x', 'apiSecret')} autoComplete="new-password" /></label>
            <label>Access Token<input value={f.x.token || ''} onChange={set('x', 'token')} autoComplete="off" /></label>
            <label>Access Token Secret<input type="password" value={f.x.tokenSecret || ''} onChange={set('x', 'tokenSecret')} autoComplete="new-password" /></label>
          </div>
          <h4>Facebook e Instagram</h4>
          <p className="letra-pequena">Hace falta una página de Facebook y la cuenta de Instagram profesional unida a ella. En la app de Meta (developers.facebook.com) se saca el «token de acceso de la página» (de larga duración) con los permisos pages_manage_posts, pages_read_engagement, instagram_basic, instagram_content_publish e instagram_manage_comments.</p>
          <div className="dos-col">
            <label>Id. de la página de Facebook<input value={f.meta.pageId || ''} onChange={set('meta', 'pageId')} autoComplete="off" /></label>
            <label>Id. de la cuenta de Instagram<input value={f.meta.igId || ''} onChange={set('meta', 'igId')} autoComplete="off" /></label>
          </div>
          <label>Token de acceso de la página<input type="password" value={f.meta.pageToken || ''} onChange={set('meta', 'pageToken')} autoComplete="new-password" /></label>
          <button type="button" className="btn" onClick={guardar}>Guardar y comprobar</button>
          {prueba && <p className="letra-pequena">{Object.entries(prueba).map(([k, v]) => `${NOMBRE_RED[k]}: ${v}`).join(' · ') || 'Guardado.'}</p>}
          {error && <p className="error">{error}</p>}
        </div>
      )}
    </div>
  )
}

/* ---------------------------------------------------------------- Boletín */
export function DelBoletin({ conexion }) {
  const [posts, setPosts] = useState(null)
  const [textos, setTextos] = useState({})
  const [error, setError] = useState('')
  useEffect(() => { rrss('boletin').then((d) => setPosts(d.posts)).catch((e) => setError(e.message)) }, [])
  if (error) return <p className="error">{error}</p>
  if (!posts) return <p>Cargando lo preparado en el boletín…</p>
  if (!posts.length) return <p>Todavía no hay publicaciones preparadas en el boletín.</p>
  const grupos = [...new Set(posts.map((p) => p.grupo))]
  return (
    <div className="rrss-boletin">
      <p className="letra-pequena">Las publicaciones que se preparan con cada boletín. Puedes retocar el texto antes de publicar.</p>
      {grupos.map((g) => (
        <section key={g}>
          <h3>{g}</h3>
          {posts.filter((p) => p.grupo === g).map((p) => {
            const t = textos[p.id] ?? p.texto
            return (
              <article key={p.id} className="rrss-post-bol">
                {p.imagen && <img src={p.imagen} alt="" loading="lazy" />}
                <div>
                  <b>{p.red}</b>{p.nota && <small> · {p.nota}</small>}
                  <textarea rows={6} value={t} onChange={(e) => setTextos({ ...textos, [p.id]: e.target.value })} />
                  <div className="acciones">
                    <button type="button" className="btn btn-claro" onClick={() => navigator.clipboard?.writeText(t)}>Copiar texto</button>
                    {p.imagen && <a className="btn btn-claro" href={p.imagen} download target="_blank" rel="noopener noreferrer">Descargar imagen</a>}
                  </div>
                  <BotonesPublicar texto={t} imagen={p.imagen} conexion={conexion} redes={p.clave !== 'otra' ? [p.clave] : []} origen={'boletín · ' + g} />
                  {p.clave === 'otra' && <p className="letra-pequena">{p.red}: se publica a mano (copia el texto y descarga la imagen).</p>}
                </div>
              </article>
            )
          })}
        </section>
      ))}
    </div>
  )
}

/* ---------------------------------------------------------------- Seguimiento */
export function Seguimiento() {
  const [lista, setLista] = useState(null)
  const [abierto, setAbierto] = useState({})
  const [error, setError] = useState('')
  useEffect(() => { rrss('publicados').then((d) => setLista(d.publicados)).catch((e) => setError(e.message)) }, [])
  const ver = async (id) => {
    if (abierto[id]) return setAbierto({ ...abierto, [id]: null })
    setAbierto({ ...abierto, [id]: { cargando: true } })
    try { const d = await rrss('seguimiento', { id }); setAbierto((a) => ({ ...a, [id]: d })) }
    catch (e) { setAbierto((a) => ({ ...a, [id]: { aviso: e.message, comentarios: [], cifras: {} } })) }
  }
  if (error) return <p className="error">{error}</p>
  if (!lista) return <p>Cargando…</p>
  if (!lista.length) return <p>Todavía no se ha publicado nada desde aquí. Lo que publiques en «Boletín» o «Nuevos» saldrá en esta lista con sus comentarios.</p>
  return (
    <ul className="rrss-seguimiento">
      {lista.map((x) => {
        const d = abierto[x.id]
        return (
          <li key={x.id}>
            <div className="rrss-seg-cab">
              {x.imagen && <img src={x.imagen} alt="" loading="lazy" />}
              <div>
                <b>{NOMBRE_RED[x.red]}</b> <small>· {fecha(x.fecha)} · {x.quien}{x.origen ? ' · ' + x.origen : ''}</small>
                <p>{x.texto.length > 220 ? x.texto.slice(0, 220) + '…' : x.texto}</p>
                <div className="acciones">
                  <a href={x.url} target="_blank" rel="noopener noreferrer">Ver en {NOMBRE_RED[x.red]} ↗</a>
                  <button type="button" className="btn-texto" onClick={() => ver(x.id)}>{d ? 'Ocultar comentarios' : 'Cifras y comentarios'}</button>
                </div>
              </div>
            </div>
            {d && (
              <div className="rrss-seg-detalle">
                {d.cargando ? <p>Cargando…</p> : (
                  <>
                    {Object.keys(d.cifras || {}).length > 0 && <p className="rrss-cifras">{Object.entries(d.cifras).map(([k, v]) => <span key={k}><b>{v}</b> {k}</span>)}</p>}
                    {d.comentarios?.length ? (
                      <ul>{d.comentarios.map((c, i) => <li key={i}><b>{c.autor}</b> <small>{c.fecha && fecha(c.fecha)}</small><br />{c.texto}</li>)}</ul>
                    ) : <p className="letra-pequena">Sin comentarios todavía.</p>}
                    {d.aviso && <p className="error">{d.aviso}</p>}
                  </>
                )}
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
