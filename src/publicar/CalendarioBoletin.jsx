// Calendario de boletines (cada dos viernes desde el nº 2, el 13 de noviembre de 2026) y aviso a los colaboradores.
// Una semana antes de cada boletín, a cada colaborador le llega un correo para que mande su artículo.
// Los datos están en el servidor del boletín (calendario.php) y se leen con la sesión de la web.
// Sale en Gestión › Calendario de boletines y en Publicar › Calendario de boletines.
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { getAjustes } from '../lib/data'
import { urlBoletin } from '../lib/boletin'

const largo = (ymd) => new Date(ymd + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
const corto = (ymd) => new Date(ymd + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })
const nuevoId = () => 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5)

async function llamar(accion, cuerpo) {
  const aj = await getAjustes()
  const { data } = await supabase.auth.getSession()
  const r = await fetch(`${urlBoletin(aj)}calendario.php?accion=${accion}`, {
    method: cuerpo ? 'POST' : 'GET',
    headers: { Authorization: 'Bearer ' + (data.session?.access_token || ''), ...(cuerpo ? { 'Content-Type': 'application/json' } : {}) },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(r.status === 401 ? 'La sesión ha caducado: sal y vuelve a entrar.' : j.error || 'Error ' + r.status)
  return j
}

export default function CalendarioBoletin() {
  const [d, setD] = useState(null)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const [pestana, setPestana] = useState('calendario')
  const [col, setCol] = useState([])
  const [aj, setAj] = useState(null)
  const [cambios, setCambios] = useState({})
  const [guardando, setGuardando] = useState(false)

  const cargar = (j) => { setD(j); setCol(j.colaboradores); setAj(j.ajustes); setCambios(j.cambios || {}) }
  useEffect(() => { llamar('datos').then(cargar).catch((e) => setError(e.message)) }, [])

  async function guardar(extra) {
    setGuardando(true); setAviso('')
    try { cargar(await llamar('guardar', { ajustes: aj, colaboradores: col, cambios, ...extra })); setAviso('Guardado ✓') } catch (e) { setAviso('No se ha podido guardar: ' + e.message) }
    setGuardando(false)
  }
  async function probar() {
    const email = prompt('¿A qué correo mando el aviso de prueba?')
    if (!email) return
    try { await llamar('probar', { email }); setAviso('Aviso de prueba enviado a ' + email) } catch (e) { setAviso('No se ha podido enviar: ' + e.message) }
  }

  if (error) return <p className="error">No se ha podido cargar el calendario: {error}</p>
  if (!d) return <p>Cargando…</p>
  const hoy = d.hoy
  const proximo = d.boletines.find((b) => b.numero && b.fecha >= hoy)
  const ponCambio = (orig, c) => setCambios((x) => ({ ...x, [orig]: { ...(x[orig] || {}), ...c } }))

  return (
    <div className="cal-bol">
      {proximo && (
        <div className="cal-proximo">
          <span>Próximo boletín</span>
          <b>Nº {proximo.numero} · {largo(proximo.fecha)}</b>
          <small>{proximo.aviso >= hoy ? `Aviso a los colaboradores el ${largo(proximo.aviso)}` : 'Aviso a los colaboradores: ' + (Object.keys(proximo.avisados || {}).length ? `enviado a ${Object.keys(proximo.avisados).length}` : 'su fecha ya pasó')}</small>
        </div>
      )}
      <div className="pestanas">
        {[['calendario', 'Calendario'], ['colaboradores', `Colaboradores (${col.filter((c) => c.activo).length})`], ['aviso', 'El correo de aviso']].map(([k, t]) => (
          <button key={k} type="button" className={pestana === k ? 'activa' : ''} onClick={() => setPestana(k)}>{t}</button>
        ))}
      </div>

      {pestana === 'calendario' && (
        <>
          <p className="ayuda">Sale cada {aj.cadaDias === 14 ? 'dos viernes' : aj.cadaDias + ' días'}. Si uno cae en fiesta, cámbiale la fecha o quítalo: los siguientes se renumeran solos.</p>
          <table className="cal-tabla">
            <thead><tr><th>Nº</th><th>Sale</th><th>Aviso</th><th>Avisados</th><th></th></tr></thead>
            <tbody>
              {d.boletines.map((b) => {
                const c = cambios[b.original] || {}
                const pasado = b.fecha < hoy
                return (
                  <tr key={b.original} className={(pasado ? 'pasado ' : '') + (b.saltado ? 'saltado' : '')}>
                    <td><b>{b.numero ? b.numero : '—'}</b></td>
                    <td>
                      <input type="date" value={c.fecha || b.fecha} disabled={pasado || b.saltado} onChange={(e) => ponCambio(b.original, { fecha: e.target.value })} />
                      {(b.fecha.slice(5) === '12-25' || b.fecha.slice(5) === '01-01' || b.fecha.slice(5) === '01-06') && !b.saltado && <small className="cal-fiesta"> · festivo</small>}
                      {b.nota && <small> · {b.nota}</small>}
                    </td>
                    <td>{b.aviso ? corto(b.aviso) : ''}</td>
                    <td>{b.saltado ? 'No sale' : Object.keys(b.avisados || {}).length || (b.aviso && b.aviso < hoy ? '—' : '')}</td>
                    <td>{!pasado && <button type="button" className="btn-texto" onClick={() => ponCambio(b.original, { saltar: !c.saltar })}>{c.saltar ? 'Volver a ponerlo' : 'Quitar'}</button>}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <button className="btn" disabled={guardando} onClick={() => guardar()}>{guardando ? 'Guardando…' : 'Guardar cambios'}</button>
        </>
      )}

      {pestana === 'colaboradores' && (
        <>
          <p className="ayuda">A cada colaborador activo le llega el aviso {aj.avisoDias} días antes de cada boletín. «Firma» es el nombre con el que firma (va en el asunto «ARTICULO …» que tiene que poner).</p>
          {col.map((c, i) => (
            <div key={c.id} className="cal-colab">
              <label className="cal-check"><input type="checkbox" checked={!!c.activo} onChange={(e) => setCol(col.map((x, j) => j === i ? { ...x, activo: e.target.checked } : x))} /> Avisar</label>
              {['nombre', 'firma', 'email', 'seccion'].map((k) => (
                <input key={k} type={k === 'email' ? 'email' : 'text'} placeholder={{ nombre: 'Nombre', firma: 'Firma', email: 'Correo', seccion: 'Sección' }[k]} value={c[k] || ''}
                  onChange={(e) => setCol(col.map((x, j) => j === i ? { ...x, [k]: e.target.value } : x))} />
              ))}
              <button type="button" className="btn-texto" title="Quitar" onClick={() => confirm('¿Quitar a ' + (c.nombre || 'este colaborador') + '?') && setCol(col.filter((_, j) => j !== i))}>✕</button>
            </div>
          ))}
          <div className="botones">
            <button type="button" className="btn btn-claro" onClick={() => setCol([...col, { id: nuevoId(), nombre: '', firma: '', email: '', seccion: '', activo: true }])}>+ Añadir colaborador</button>
            <button className="btn" disabled={guardando} onClick={() => guardar()}>{guardando ? 'Guardando…' : 'Guardar'}</button>
          </div>
        </>
      )}

      {pestana === 'aviso' && (
        <>
          <label className="cal-check"><input type="checkbox" checked={!!aj.activo} onChange={(e) => setAj({ ...aj, activo: e.target.checked })} /> Mandar los avisos solos</label>
          <div className="dos-col">
            <label>Días antes del boletín<input type="number" min="1" max="21" value={aj.avisoDias} onChange={(e) => setAj({ ...aj, avisoDias: +e.target.value })} /></label>
            <label>A partir de la hora<input type="number" min="6" max="22" value={aj.horaAviso} onChange={(e) => setAj({ ...aj, horaAviso: +e.target.value })} /></label>
          </div>
          <label>Asunto<input type="text" value={aj.asunto} onChange={(e) => setAj({ ...aj, asunto: e.target.value })} /></label>
          <label>Texto<textarea rows="12" value={aj.texto} onChange={(e) => setAj({ ...aj, texto: e.target.value })} /></label>
          <p className="ayuda">Se cambian solos: <code>{'{nombre}'}</code> (nombre de pila), <code>{'{numero}'}</code>, <code>{'{fecha}'}</code> (el viernes en que sale) y <code>{'{firma}'}</code>.</p>
          <div className="botones">
            <button className="btn" disabled={guardando} onClick={() => guardar()}>{guardando ? 'Guardando…' : 'Guardar'}</button>
            <button type="button" className="btn btn-claro" onClick={probar}>Mandarme una prueba</button>
          </div>
        </>
      )}
      {aviso && <p className={aviso.startsWith('No') ? 'error' : 'aviso-ok'}>{aviso}</p>}
      {d.errores?.length > 0 && <p className="error">Últimos avisos que no salieron: {d.errores.map((e) => `${e.email} (nº ${e.numero}): ${e.motivo}`).join(' · ')}</p>}
    </div>
  )
}
