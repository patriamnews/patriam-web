// Publicar › RRSS: crear diseños para las redes y descargarlos, las cuentas de redes de cada persona
// con el seguimiento de seguidores, y el registro de publicaciones con sus métricas.
import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { tokenEquipo } from '../lib/equipo'
import { useAuth } from '../lib/auth'
import { REDES } from '../lib/config'
import logo from '../assets/logo.png'
import logoClaro from '../assets/logo-claro.png'
import Redes from '../admin/Redes'

export default function Rrss() {
  const [pestana, setPestana] = useState('disenar')
  return (
    <>
      <div className="pestanas grandes">
        <button className={pestana === 'disenar' ? 'activa' : ''} onClick={() => setPestana('disenar')}>Crear diseño</button>
        <button className={pestana === 'cuentas' ? 'activa' : ''} onClick={() => setPestana('cuentas')}>Mis cuentas</button>
        <button className={pestana === 'seguimiento' ? 'activa' : ''} onClick={() => setPestana('seguimiento')}>Publicaciones</button>
      </div>
      <div className="rrss-cuerpo">
        {pestana === 'disenar' && <Disenar />}
        {pestana === 'cuentas' && <Cuentas />}
        {pestana === 'seguimiento' && <Redes />}
      </div>
    </>
  )
}

/* ---------------------------------------------------------------- Crear diseño */

const FORMATOS = {
  ig: { nombre: 'Instagram · cuadrado', w: 1080, h: 1080, red: 'instagram' },
  ig45: { nombre: 'Instagram · vertical', w: 1080, h: 1350, red: 'instagram' },
  historia: { nombre: 'Historia o reel', w: 1080, h: 1920, red: 'instagram' },
  x: { nombre: 'X (Twitter)', w: 1600, h: 900, red: 'x' },
  fb: { nombre: 'Facebook · LinkedIn · Telegram', w: 1200, h: 630, red: 'facebook' },
}
const FONDOS = {
  granate: { nombre: 'Granate', fondo: '#7b1c2c', texto: '#fffaf0', acento: '#d9b65c', claro: false },
  crema: { nombre: 'Crema', fondo: '#f7f1e6', texto: '#2a211d', acento: '#7b1c2c', claro: true },
  negro: { nombre: 'Negro', fondo: '#1d1a18', texto: '#fffaf0', acento: '#d9b65c', claro: false },
  foto: { nombre: 'Con foto', fondo: '#1d1a18', texto: '#ffffff', acento: '#e6c56d', claro: false },
}
const ABRIR = {
  x: (t) => `https://x.com/intent/post?text=${encodeURIComponent(t)}`,
  instagram: () => 'https://www.instagram.com/',
  facebook: () => 'https://www.facebook.com/',
  tiktok: () => 'https://www.tiktok.com/upload',
  youtube: () => 'https://studio.youtube.com/',
  telegram: () => 'https://web.telegram.org/',
  whatsapp: (t) => `https://wa.me/?text=${encodeURIComponent(t)}`,
  linkedin: () => 'https://www.linkedin.com/feed/',
}
const LIMITE = { x: 280, instagram: 2200, facebook: 5000, tiktok: 2200, youtube: 5000, telegram: 4096, whatsapp: 4096, linkedin: 3000 }

const cargarImagen = (src) => new Promise((ok, mal) => { const i = new Image(); i.onload = () => ok(i); i.onerror = mal; i.src = src })

// Parte el texto en líneas que caben en el ancho
function lineas(ctx, texto, ancho) {
  const res = []
  for (const parrafo of String(texto || '').split('\n')) {
    let linea = ''
    for (const palabra of parrafo.split(/\s+/).filter(Boolean)) {
      const prueba = linea ? `${linea} ${palabra}` : palabra
      if (ctx.measureText(prueba).width > ancho && linea) { res.push(linea); linea = palabra } else linea = prueba
    }
    res.push(linea)
  }
  return res
}
// Busca el tamaño de letra más grande con el que el texto cabe en la caja
function ajustar(ctx, texto, peso, max, min, ancho, alto, interlineado) {
  for (let t = max; t >= min; t -= 2) {
    ctx.font = `${peso} ${t}px Spectral, Georgia, serif`
    const ls = lineas(ctx, texto, ancho)
    if (ls.length * t * interlineado <= alto) return { t, ls }
  }
  ctx.font = `${peso} ${min}px Spectral, Georgia, serif`
  return { t: min, ls: lineas(ctx, texto, ancho) }
}

async function dibujar(canvas, d) {
  const F = FORMATOS[d.formato]
  const E = FONDOS[d.fondo]
  canvas.width = F.w
  canvas.height = F.h
  const ctx = canvas.getContext('2d')
  const W = F.w, H = F.h
  const u = Math.min(W, H) / 1080 // unidad para que todo escale igual en cada formato
  const margen = 80 * u

  await Promise.all(['400', '600', '700'].map((p) => document.fonts?.load(`${p} 40px Spectral`).catch(() => {})))

  // Fondo
  ctx.fillStyle = E.fondo
  ctx.fillRect(0, 0, W, H)
  if (d.fondo === 'foto' && d.foto) {
    const im = await cargarImagen(d.foto).catch(() => null)
    if (im) {
      const k = Math.max(W / im.width, H / im.height)
      ctx.drawImage(im, (W - im.width * k) / 2, (H - im.height * k) / 2, im.width * k, im.height * k)
      const g = ctx.createLinearGradient(0, 0, 0, H)
      g.addColorStop(0, 'rgba(15,10,8,0.55)')
      g.addColorStop(0.45, 'rgba(15,10,8,0.25)')
      g.addColorStop(1, 'rgba(15,10,8,0.85)')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, W, H)
    }
  }
  // Marco fino
  ctx.strokeStyle = E.acento
  ctx.globalAlpha = 0.55
  ctx.lineWidth = 3 * u
  ctx.strokeRect(36 * u, 36 * u, W - 72 * u, H - 72 * u)
  ctx.globalAlpha = 1

  // Logo arriba
  const lg = await cargarImagen(E.claro ? logo : logoClaro).catch(() => null)
  let y = margen
  if (lg) {
    const lh = 92 * u
    ctx.drawImage(lg, margen, y, (lg.width / lg.height) * lh, lh)
    y += lh + 40 * u
  }

  // Pie: lema y cuenta
  const pieAlto = 70 * u
  const pieY = H - margen
  ctx.fillStyle = E.acento
  ctx.fillRect(margen, pieY - pieAlto, 90 * u, 4 * u)
  ctx.font = `600 ${30 * u}px Spectral, Georgia, serif`
  ctx.fillStyle = E.texto
  ctx.textBaseline = 'alphabetic'
  ctx.fillText(d.firma || '', margen, pieY - 10 * u)
  ctx.textAlign = 'right'
  ctx.font = `italic 400 ${30 * u}px Spectral, Georgia, serif`
  ctx.fillStyle = E.acento
  ctx.fillText('Dios, Patria, Justicia', W - margen, pieY - 10 * u)
  ctx.textAlign = 'left'

  // Bloque de texto, centrado en el espacio libre
  const ancho = W - margen * 2
  const libre = pieY - pieAlto - 40 * u - y
  const ante = d.antetitulo.trim()
  const anteAlto = ante ? 34 * u * 1.9 : 0
  const cuerpoMax = d.texto.trim() ? libre * 0.32 : 0
  const tit = ajustar(ctx, d.titular || ' ', 700, 118 * u, 40 * u, ancho, libre - anteAlto - cuerpoMax - 30 * u, 1.12)
  const cue = d.texto.trim() ? ajustar(ctx, d.texto, 400, 44 * u, 24 * u, ancho, cuerpoMax, 1.35) : { t: 0, ls: [] }
  const total = anteAlto + tit.ls.length * tit.t * 1.12 + (cue.ls.length ? 30 * u + cue.ls.length * cue.t * 1.35 : 0)
  let cy = y + Math.max(0, (libre - total) / (d.fondo === 'foto' ? 1 : 2))

  ctx.textBaseline = 'top'
  if (ante) {
    ctx.font = `600 ${32 * u}px Spectral, Georgia, serif`
    ctx.fillStyle = E.acento
    ctx.fillText(ante.toUpperCase().split('').join(String.fromCharCode(8202)), margen, cy)
    cy += anteAlto
  }
  ctx.font = `700 ${tit.t}px Spectral, Georgia, serif`
  ctx.fillStyle = E.texto
  for (const l of tit.ls) { ctx.fillText(l, margen, cy); cy += tit.t * 1.12 }
  if (cue.ls.length) {
    cy += 30 * u
    ctx.font = `400 ${cue.t}px Spectral, Georgia, serif`
    ctx.globalAlpha = 0.92
    for (const l of cue.ls) { ctx.fillText(l, margen, cy); cy += cue.t * 1.35 }
    ctx.globalAlpha = 1
  }
}

const hoy = () => new Date().toISOString().slice(0, 10)

function Disenar() {
  const canvas = useRef(null)
  const [d, setD] = useState({ formato: 'ig', fondo: 'granate', antetitulo: '', titular: '', texto: '', firma: '@patriam_es · movimientopatriam.es', foto: '' })
  const [post, setPost] = useState({ red: 'instagram', texto: '' })
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')
  const set = (k) => (e) => setD({ ...d, [k]: e.target.value })

  useEffect(() => { if (canvas.current) dibujar(canvas.current, d) }, [d])

  const subirFoto = (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    const r = new FileReader()
    r.onload = () => setD((x) => ({ ...x, foto: r.result, fondo: 'foto' }))
    r.readAsDataURL(f)
  }

  const nombreArchivo = () => `patriam-${d.formato}-${hoy()}.png`
  const comoArchivo = () => new Promise((ok) => canvas.current.toBlob((b) => ok(b), 'image/png'))

  const descargar = async () => {
    const b = await comoArchivo()
    const a = document.createElement('a')
    a.href = URL.createObjectURL(b)
    a.download = nombreArchivo()
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 2000)
  }
  // En el móvil abre el menú de compartir del teléfono (Instagram, WhatsApp, X…) con la imagen y el texto
  const archivoCompartible = typeof navigator !== 'undefined' && navigator.canShare?.({ files: [new File([''], 'a.png', { type: 'image/png' })] })
  const compartir = async () => {
    const b = await comoArchivo()
    try { await navigator.share({ files: [new File([b], nombreArchivo(), { type: 'image/png' })], text: post.texto }) } catch { /* cancelado */ }
  }
  const copiar = async () => { await navigator.clipboard?.writeText(post.texto); setMsg('Texto copiado.') }

  const apuntar = async (estado) => {
    setError(''); setMsg('')
    const { error } = await supabase.from('redes_posts').insert({
      red: post.red, estado, fecha: hoy(), texto: post.texto || d.titular, enlace: '', articulo_id: null,
      uso_ia: 'ninguno', imagen_ia: false, me_gusta: 0, comentarios: 0, compartidos: 0, visualizaciones: 0, notas: d.titular ? `Diseño: ${d.titular}` : '',
    })
    if (error) return setError(error.message)
    setMsg(estado === 'publicado' ? 'Apuntado como publicado. Las cifras se ponen en «Publicaciones».' : 'Apuntado como programado en «Publicaciones».')
  }

  const limite = LIMITE[post.red]
  return (
    <div className="rrss-disenar">
      <div className="formulario">
        <label>Formato
          <select value={d.formato} onChange={(e) => { setD({ ...d, formato: e.target.value }); setPost({ ...post, red: FORMATOS[e.target.value].red }) }}>
            {Object.entries(FORMATOS).map(([k, v]) => <option key={k} value={k}>{v.nombre} ({v.w}×{v.h})</option>)}
          </select>
        </label>
        <div className="rrss-fondos">
          {Object.entries(FONDOS).map(([k, v]) => (
            <button key={k} type="button" className={d.fondo === k ? 'activa' : ''} onClick={() => setD({ ...d, fondo: k })}>
              <i style={{ background: v.fondo }} />{v.nombre}
            </button>
          ))}
        </div>
        {d.fondo === 'foto' && (
          <label>Foto de fondo<input type="file" accept="image/*" onChange={subirFoto} /></label>
        )}
        <label>Antetítulo (opcional)<input value={d.antetitulo} onChange={set('antetitulo')} placeholder="Comunicado · Agenda · Opinión…" maxLength={60} /></label>
        <label>Titular<textarea rows={3} value={d.titular} onChange={set('titular')} placeholder="La frase principal del diseño" /></label>
        <label>Texto (opcional)<textarea rows={3} value={d.texto} onChange={set('texto')} placeholder="Fecha, lugar o una explicación breve" /></label>
        <label>Pie<input value={d.firma} onChange={set('firma')} maxLength={70} /></label>
      </div>

      <div className="rrss-vista">
        <canvas ref={canvas} className={`rrss-lienzo f-${d.formato}`} aria-label="Vista previa del diseño" />
        <div className="acciones">
          <button type="button" className="btn" onClick={descargar} disabled={!d.titular.trim()}>Descargar imagen</button>
          {archivoCompartible && <button type="button" className="btn btn-claro" onClick={compartir} disabled={!d.titular.trim()}>Compartir…</button>}
        </div>

        <div className="formulario rrss-post">
          <h3>Texto para la publicación</h3>
          <div className="dos-col">
            <label>Red<select value={post.red} onChange={(e) => setPost({ ...post, red: e.target.value })}>{Object.entries(REDES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          </div>
          <label>
            Texto
            <textarea rows={4} value={post.texto} onChange={(e) => setPost({ ...post, texto: e.target.value })} placeholder="Lo que acompaña a la imagen, con enlaces y etiquetas" />
            <small className={post.texto.length > limite ? 'error' : 'mini'}>{post.texto.length} / {limite}</small>
          </label>
          <div className="acciones">
            <button type="button" className="btn btn-claro" onClick={copiar} disabled={!post.texto}>Copiar texto</button>
            <a className="btn btn-claro" href={ABRIR[post.red](post.texto)} target="_blank" rel="noopener noreferrer">Abrir {REDES[post.red]} ↗</a>
          </div>
          <p className="letra-pequena">Descargue la imagen, abra la red y súbala con el texto. Después apúntela aquí para llevar el seguimiento.</p>
          <div className="acciones">
            <button type="button" className="btn" onClick={() => apuntar('publicado')}>Apuntar como publicado</button>
            <button type="button" className="btn-texto" onClick={() => apuntar('programado')}>Apuntar como programado</button>
          </div>
          {msg && <p className="aviso-ok">{msg}</p>}
          {error && <p className="error">{error}</p>}
        </div>
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------- Mis cuentas */

const LOCAL = 'patriam-rrss-cuentas'
async function llamar(cuerpo) {
  const r = await fetch('/api/rrss.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: tokenEquipo(), ...cuerpo }) })
  const d = await r.json().catch(() => null)
  if (!d) throw new Error('sin-servidor')
  if (!r.ok) throw new Error(d.error === 'sesion' ? 'sesion' : d.error || 'No se ha podido guardar.')
  return d.cuentas || []
}
const leerLocal = () => { try { return JSON.parse(localStorage.getItem(LOCAL) || '[]') } catch { return [] } }
const guardarLocal = (c) => { try { localStorage.setItem(LOCAL, JSON.stringify(c)) } catch { /* sin almacenamiento */ } }
const nuevoId = () => Math.random().toString(36).slice(2, 10)
const num = (n) => new Intl.NumberFormat('es-ES').format(n)

function Cuentas() {
  const { salir } = useAuth()
  const [cuentas, setCuentas] = useState(null)
  const [local, setLocal] = useState(false)
  const [nueva, setNueva] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    llamar({}).then(setCuentas).catch((e) => {
      if (e.message === 'sin-servidor') { setLocal(true); setCuentas(leerLocal()) } else setError(e.message)
    })
  }, [])

  const guardar = useCallback(async (lista) => {
    setError('')
    if (local) { guardarLocal(lista); return setCuentas(lista) }
    try { setCuentas(await llamar({ cuentas: lista })) } catch (e) { setError(e.message) }
  }, [local])

  if (error === 'sesion')
    return (
      <div>
        <p>Por seguridad hay que volver a entrar con su email y su contraseña.</p>
        <button className="btn" onClick={salir}>Volver a entrar</button>
      </div>
    )
  if (!cuentas) return error ? <p className="error">{error}</p> : <p className="vacio">Cargando…</p>

  const anadir = (e) => {
    e.preventDefault()
    let enlace = nueva.enlace.trim()
    if (enlace && !/^https:\/\//i.test(enlace)) enlace = 'https://' + enlace.replace(/^http:\/\//i, '')
    guardar([...cuentas, { id: nuevoId(), red: nueva.red, usuario: nueva.usuario.trim(), enlace, registro: [] }])
    setNueva(null)
  }
  const apuntarSeguidores = (c, valor) => {
    const n = Math.max(0, parseInt(valor, 10) || 0)
    const registro = [...(c.registro || []).filter((r) => r.fecha !== hoy()), { fecha: hoy(), seguidores: n }]
    guardar(cuentas.map((x) => (x.id === c.id ? { ...x, registro } : x)))
  }
  const quitar = (c) => { if (window.confirm(`¿Quitar la cuenta ${c.usuario || REDES[c.red]}?`)) guardar(cuentas.filter((x) => x.id !== c.id)) }

  return (
    <div className="rrss-cuentas">
      <div className="titulo-bloque">
        <h1>Mis cuentas</h1>
        <div className="acciones"><button className="btn" onClick={() => setNueva({ red: 'x', usuario: '', enlace: '' })}>+ Añadir cuenta</button></div>
      </div>
      <p className="mini">Cada persona ve solo sus cuentas. Apunte los seguidores de vez en cuando para ver cómo crecen.{local ? ' (Modo de prueba: se guardan solo en este navegador.)' : ''}</p>
      {error && <p className="error">{error}</p>}

      {nueva && (
        <form className="formulario tarjeta-form" onSubmit={anadir}>
          <div className="tres-col">
            <label>Red<select value={nueva.red} onChange={(e) => setNueva({ ...nueva, red: e.target.value })}>{Object.entries(REDES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
            <label>Usuario<input required value={nueva.usuario} onChange={(e) => setNueva({ ...nueva, usuario: e.target.value })} placeholder="@patriam_es" /></label>
            <label>Enlace al perfil<input value={nueva.enlace} onChange={(e) => setNueva({ ...nueva, enlace: e.target.value })} placeholder="https://x.com/patriam_es" /></label>
          </div>
          <div className="acciones"><button className="btn">Guardar</button><button type="button" className="btn-texto" onClick={() => setNueva(null)}>Cancelar</button></div>
        </form>
      )}

      {cuentas.length === 0 && !nueva && <p className="vacio">Todavía no hay cuentas. Pulse «Añadir cuenta».</p>}
      <div className="rrss-lista">
        {cuentas.map((c) => {
          const reg = c.registro || []
          const ult = reg[reg.length - 1]
          const ant = reg[reg.length - 2]
          const dif = ult && ant ? ult.seguidores - ant.seguidores : null
          return (
            <div key={c.id} className="rrss-cuenta">
              <div className="rrss-cuenta-cab">
                <span><b>{REDES[c.red]}</b> {c.enlace ? <a href={c.enlace} target="_blank" rel="noopener noreferrer">{c.usuario} ↗</a> : c.usuario}</span>
                <button className="btn-texto peligro" onClick={() => quitar(c)}>Quitar</button>
              </div>
              <div className="rrss-cifra">
                <b>{ult ? num(ult.seguidores) : '—'}</b> seguidores
                {dif !== null && <span className={dif >= 0 ? 'sube' : 'baja'}>{dif >= 0 ? '+' : ''}{num(dif)} desde el {ant.fecha.split('-').reverse().join('/')}</span>}
              </div>
              <Seguidores onApuntar={(v) => apuntarSeguidores(c, v)} />
              {reg.length > 1 && <Grafica registro={reg.slice(-12)} />}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Seguidores({ onApuntar }) {
  const [v, setV] = useState('')
  return (
    <form className="rrss-apuntar" onSubmit={(e) => { e.preventDefault(); if (v !== '') { onApuntar(v); setV('') } }}>
      <input type="number" min="0" inputMode="numeric" value={v} onChange={(e) => setV(e.target.value)} placeholder="Seguidores hoy" aria-label="Seguidores hoy" />
      <button className="btn btn-claro">Apuntar</button>
    </form>
  )
}

function Grafica({ registro }) {
  const vals = registro.map((r) => r.seguidores)
  const min = Math.min(...vals), max = Math.max(...vals)
  const W = 280, H = 60
  const pts = registro.map((r, i) => `${(i / (registro.length - 1)) * W},${H - 6 - (max === min ? 0.5 : (r.seguidores - min) / (max - min)) * (H - 12)}`).join(' ')
  return (
    <svg className="rrss-grafica" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="Evolución de seguidores">
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}
