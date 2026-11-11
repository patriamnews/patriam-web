// Al entrar en Publicar, a quien escribe en el boletín y todavía no tiene presentación se le pide su CV
// y unas líneas sobre sí mismo para «Colaboraciones y quién es quién».
// Lo guarda el propio boletín (aportar.php): la presentación sale cuando Carlos o Isabel la aprueban;
// el CV no se publica nunca, solo lo pueden descargar ellos dos.
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { getAjustes } from '../lib/data'
import { urlBoletin } from '../lib/boletin'

// Quién tiene que presentarse, con la firma que usa en el boletín y su cargo
const PIDE_FICHA = {
  'lauraolivareses@yahoo.es': { firma: 'LOC', cargo: 'Compliance Officer en el sector bancario' },
}

async function llamar(accion, cuerpo) {
  const b = urlBoletin(await getAjustes())
  const { data } = await supabase.auth.getSession()
  const r = await fetch(`${b}aportar.php?accion=${accion}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (data.session?.access_token || '') },
    body: JSON.stringify(cuerpo || {}),
  })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.error || 'Error ' + r.status)
  return j
}

const leerArchivo = (f) => new Promise((ok, mal) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = mal; r.readAsDataURL(f) })

export default function FichaColaborador({ perfil }) {
  const quien = PIDE_FICHA[(perfil?.email || '').toLowerCase()]
  const [estado, setEstado] = useState('mirando') // mirando · pedir · enviando · hecho · nada
  const [cargo, setCargo] = useState(quien?.cargo || '')
  const [bio, setBio] = useState('')
  const [cv, setCv] = useState(null)
  const [error, setError] = useState('')
  const luego = (() => { try { return sessionStorage.getItem('ficha-luego') === '1' } catch { return false } })()

  useEffect(() => {
    if (!quien || luego) { setEstado('nada'); return }
    llamar('mi-ficha').then((j) => setEstado(j.ficha ? 'nada' : 'pedir')).catch(() => setEstado('nada'))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (estado === 'nada' || estado === 'mirando') return null
  if (estado === 'hecho') return <section className="ficha-pide"><p className="bp-ok">✓ Gracias. Tu presentación saldrá en el boletín en cuanto Carlos o Isabel le den el visto bueno.</p></section>

  const enviar = async (e) => {
    e.preventDefault()
    setError('')
    if (!cv && !bio.trim()) { setError('Sube tu CV o escribe unas líneas sobre ti.'); return }
    if (cv && cv.size > 8000000) { setError('El CV pasa de 8 MB.'); return }
    setEstado('enviando')
    try {
      await llamar('ficha', { datos: { firma: quien.firma, cargo, bio }, cv: cv ? { nombre: cv.name, datos: await leerArchivo(cv) } : null })
      setEstado('hecho')
    } catch (x) { setError(x.message); setEstado('pedir') }
  }

  return (
    <section className="ficha-pide">
      <h2>Preséntate a los lectores del boletín</h2>
      <p>Tus artículos salen firmados como <b>{quien.firma}</b>. En «Colaboraciones y quién es quién» falta tu presentación: sube tu <b>CV</b> y, si quieres, escribe unas líneas sobre ti. Con eso preparamos tu ficha.</p>
      <form onSubmit={enviar}>
        <label>Tu CV <small>(PDF o Word; no se publica, solo lo ven Carlos e Isabel)</small>
          <input type="file" accept=".pdf,.doc,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword" onChange={(e) => setCv(e.target.files?.[0] || null)} />
        </label>
        <label>Lo que pondrá debajo de tu firma
          <input value={cargo} onChange={(e) => setCargo(e.target.value)} placeholder="Por ejemplo: Compliance Officer en el sector bancario" />
        </label>
        <label>Unas líneas sobre ti <small>(opcional: si no, la preparamos a partir de tu CV)</small>
          <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={5} placeholder="Tu trayectoria, de qué escribes en el boletín…" />
        </label>
        {error && <p className="error">{error}</p>}
        <div className="bp-botones">
          <button className="btn" disabled={estado === 'enviando'}>{estado === 'enviando' ? 'Enviando…' : 'Enviar'}</button>
          <button type="button" className="btn-texto" onClick={() => { try { sessionStorage.setItem('ficha-luego', '1') } catch { /* nada */ } setEstado('nada') }}>Más tarde</button>
        </div>
      </form>
    </section>
  )
}
