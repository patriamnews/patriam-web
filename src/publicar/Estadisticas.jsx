// Estadísticas del boletín (las mismas que en el editor del boletín), para todo el equipo.
// Se leen de est.php del boletín con la sesión de la web: no hace falta entrar otra vez.
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { getAjustes } from '../lib/data'
import { urlBoletin } from '../lib/boletin'

const RED = { whatsapp: 'WhatsApp', x: 'X', facebook: 'Facebook', instagram: 'Instagram', enlace: 'Copiar enlace', otro: 'Otro' }
const fecha = (f) => { try { return new Date(f).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) } catch { return f } }
function pagina(r) {
  r = String(r || '#/')
  if (r === '#/' || r === '/') return 'Portada del boletín'
  const [, sec, id] = r.split('/')
  const N = { noticias: 'Actualidad', historia: 'Historia', sociedad: 'Sociedad', criterio: 'Criterio', analisis: 'Análisis', podcasts: 'Podcasts y vídeos', libros: 'Libros', peliculas: 'Películas', colaboraciones: 'Quién es quién', colaboracion: 'Colaboración', iniciativas: 'Iniciativas', boletines: 'Boletines anteriores', boletin: 'Boletín', editorial: 'Editorial', ver: 'Recomendación', leer: 'Noticia', suscribirse: 'Suscripción', al: 'Al momento' }
  return (N[sec] || sec || r) + (id ? ' · ' + decodeURIComponent(id) : '')
}

export default function Estadisticas() {
  const [dias, setDias] = useState(30)
  const [dia, setDia] = useState('')
  const [d, setD] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let vivo = true
    setD(null); setError('')
    ;(async () => {
      try {
        const aj = await getAjustes()
        const { data } = await supabase.auth.getSession()
        const r = await fetch(`${urlBoletin(aj)}est.php?accion=resumen&de=web&dias=${dias}${dia ? '&dia=' + dia : ''}`, { headers: { Authorization: 'Bearer ' + (data.session?.access_token || '') } })
        const j = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(r.status === 401 ? 'La sesión ha caducado: sal y vuelve a entrar.' : j.error || 'Error ' + r.status)
        if (vivo) setD(j)
      } catch (e) { if (vivo) setError(e.message) }
    })()
    return () => { vivo = false }
  }, [dias, dia])

  const sel = (
    <div className="est-periodo">
      {[[7, '7 días'], [30, '30 días'], [90, '3 meses'], [365, 'Un año']].map(([n, t]) => (
        <button key={n} type="button" className={!dia && n === dias ? 'activo' : ''} onClick={() => { setDia(''); setDias(n) }}>{t}</button>
      ))}
      <label className="est-dia">o un día: <input type="date" value={dia} onChange={(e) => setDia(e.target.value)} /></label>
    </div>
  )
  if (error) return <>{sel}<p className="error">No se han podido cargar: {error}</p></>
  if (!d) return <>{sel}<p>Cargando…</p></>
  const T = d.totales
  const max = Math.max(1, ...d.porDia.map((x) => x.visitas))
  return (
    <div className="est">
      {sel}
      <div className="est-cifras">
        {[['Entradas al boletín', T.entradas || 0], ['Páginas vistas', T.visitas], [d.dia ? 'Lectores' : 'Lectores (uno por día)', T.lectores], ['Veces compartido', T.compartidos], ['Visitas por reenvíos', T.porReenvio], ['Clics en enlaces', T.clics], ['Clics de comunicaciones', T.deComunicaciones]].map(([a, b]) => (
          <div key={a}><b>{b}</b><span>{a}</span></div>
        ))}
      </div>

      {d.dia && <p className="est-nota"><b>Solo el {new Date(d.dia + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</b> (hora de España). <button type="button" className="btn-texto" onClick={() => setDia('')}>Ver el periodo completo</button></p>}
      <h3>{d.porHoras ? 'Páginas vistas por hora' : <>Páginas vistas por día <small>pulsa en una barra para ver ese día</small></>}</h3>
      <div className="est-barras">{d.porDia.map((x) => <i key={x.dia} title={`${x.dia}: ${x.visitas} páginas vistas, ${x.lectores} lectores`} onClick={d.porHoras ? undefined : () => setDia(x.dia)} style={{ cursor: d.porHoras ? 'default' : 'pointer', height: Math.round((x.visitas / max) * 100) + '%' }} />)}</div>
      {d.porHoras && <div className="est-horas"><span>0 h</span><span>6 h</span><span>12 h</span><span>18 h</span><span>23 h</span></div>}

      <div className="est-cols">
        <div><h3>Cómo llegan</h3><Tabla filas={d.origen.map((x) => [x.origen, x.visitas])} vacio="Todavía no hay datos" /></div>
        <div><h3>Dónde lo comparten</h3><Tabla filas={d.redes.map((x) => [RED[x.red] || x.red, x.veces])} vacio="Nadie lo ha compartido todavía" /></div>
      </div>

      <h3>Reenvíos <small>cada vez que un lector lo comparte, y cuánta gente entra por su enlace</small></h3>
      {d.reenvios.length ? (
        <div className="est-scroll"><table className="est-tabla"><thead><tr><th>Cuándo</th><th>Qué</th><th>Por</th><th className="n">Visitas</th><th className="n">Lectores</th><th className="n">Lo vuelven a compartir</th></tr></thead>
          <tbody>{d.reenvios.map((x, i) => <tr key={i}><td>{fecha(x.fecha)}</td><td>{pagina(x.pagina)}</td><td>{x.redes.map((r) => RED[r] || r).join(', ') || '—'}</td><td className="n">{x.visitas}</td><td className="n">{x.lectores}</td><td className="n">{x.loVolvieronACompartir}</td></tr>)}</tbody></table></div>
      ) : <p className="est-nota">Todavía no hay reenvíos.</p>}

      <h3>Por página <small>cuántas veces se abre cada página y cuántos clics se hacen desde ella</small></h3>
      {(d.porPagina || []).length ? (
        <div className="est-scroll"><table className="est-tabla"><thead><tr><th>Página</th><th className="n">Vistas</th><th className="n">Clics</th><th className="n">Lectores que pinchan</th></tr></thead>
          <tbody>{d.porPagina.map((x, i) => <tr key={i}><td>{pagina(x.pagina)}</td><td className="n">{x.visitas}</td><td className="n">{x.clics}</td><td className="n">{x.lectoresClic}</td></tr>)}</tbody></table></div>
      ) : <p className="est-nota">Todavía no hay datos.</p>}

      <h3>En qué pinchan <small>noticias, vídeos y enlaces de fuera</small></h3>
      {d.clics.length ? (
        <div className="est-scroll"><table className="est-tabla"><thead><tr><th>Enlace</th><th className="n">Clics</th><th className="n">Lectores</th></tr></thead>
          <tbody>{d.clics.map((x, i) => <tr key={i}><td><a href={x.enlace} target="_blank" rel="noopener noreferrer">{x.texto || x.enlace}</a></td><td className="n">{x.veces}</td><td className="n">{x.lectores}</td></tr>)}</tbody></table></div>
      ) : <p className="est-nota">Todavía no hay clics.</p>}

      <h3>Quién pincha en las comunicaciones personales</h3>
      {d.quien.length ? (
        <div className="est-scroll"><table className="est-tabla"><thead><tr><th>Cuándo</th><th>Quién</th><th>Comunicación</th><th>Qué abrió</th></tr></thead>
          <tbody>{d.quien.map((x, i) => <tr key={i}><td>{fecha(x.fecha)}</td><td>{x.nombre}{x.como && <small> {x.como}</small>}</td><td>{x.comunicacion || '—'}</td><td><a href={x.enlace} target="_blank" rel="noopener noreferrer">{x.enlace.replace(/^https?:\/\/(www\.)?/, '').slice(0, 60)}</a></td></tr>)}</tbody></table></div>
      ) : <p className="est-nota">Nadie ha pinchado todavía en un enlace de una comunicación.</p>}
      {d.reenviosComunicacion.length > 0 && (
        <p className="est-nota"><b>Posibles reenvíos de comunicaciones:</b> {d.reenviosComunicacion.map((x) => `${x.nombre} (abierto en ${x.dispositivos} dispositivos distintos)`).join(', ')}</p>
      )}
      <p className="est-nota">Sin cookies y sin guardar la IP: los lectores del boletín son anónimos. Solo se sabe <b>quién</b> pincha en los enlaces de las comunicaciones personales, porque cada persona recibe los suyos. Los datos se guardan 13 meses.</p>
    </div>
  )
}

function Tabla({ filas, vacio }) {
  return (
    <table className="est-tabla">
      <tbody>{filas.length ? filas.map(([a, b], i) => <tr key={i}><td>{a}</td><td className="n">{b}</td></tr>) : <tr><td>{vacio}</td><td /></tr>}</tbody>
    </table>
  )
}
