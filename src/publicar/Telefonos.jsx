// Teléfonos para mandar por WhatsApp el boletín quincenal y «España al día» (diaria).
// Es la misma lista que usan las comunicaciones de Carlos y el editor del boletín (no se duplica nada).
// Sin WhatsApp Business: cada persona tiene su botón, que abre WhatsApp con el mensaje ya escrito,
// y queda apuntado a quién se le ha mandado cada número. Solo lo ven Carlos e Isabel.
import { useEffect, useState } from 'react'
import { llamarBoletin } from './boletinApi'

const api = (accion, cuerpo) => llamarBoletin('telefonos.php', accion, cuerpo)
const ENLACE = 'https://boletin.movimientopatriam.es/'
const ENLACE_DIA = 'https://boletin.movimientopatriam.es/mipatriaaldia'
const fechaHoy = () => new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Madrid' })
const sinTildes = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

// Una persona por línea: «Nombre; móvil; correo» (también vale con comas, tabuladores o pegado de Excel)
function leerPegado(t) {
  return t.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((l) => {
    const partes = l.split(/\t|;|,(?!\d{2}\b)/).map((x) => x.trim()).filter(Boolean)
    const email = partes.find((x) => /@/.test(x)) || ''
    const movil = partes.find((x) => (x.replace(/\D/g, '').length >= 9) && !/@/.test(x)) || ''
    const nombre = partes.filter((x) => x !== email && x !== movil).join(' ')
    return { nombre, movil, email }
  })
}

export default function Telefonos({ numeros }) {
  const [d, setD] = useState(null)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const [pegado, setPegado] = useState('')
  const [q, setQ] = useState('')
  const [numero, setNumero] = useState(numeros?.[0] || 1)
  const [texto, setTexto] = useState('')
  const [textoDia, setTextoDia] = useState('')
  const [verTexto, setVerTexto] = useState(false)
  const [editando, setEditando] = useState(null)

  const cargar = (j) => { setD(j); setTexto(j.texto); setTextoDia(j.textoDia) }
  useEffect(() => { api('datos').then(cargar).catch((e) => setError(e.message)) }, [])
  const hacer = async (accion, cuerpo, ok) => {
    setAviso('')
    try { const j = await api(accion, cuerpo); cargar(j); if (ok) setAviso(typeof ok === 'function' ? ok(j) : ok) } catch (e) { setAviso('No se ha podido: ' + e.message) }
  }

  if (error) return <p className="error">{error}</p>
  if (!d) return <p>Cargando los teléfonos…</p>

  const esDia = numero === 'dia'
  const clave = esDia ? d.hoyDia : numero
  const enviados = d.envios?.[String(clave)] || {}
  const conWa = d.contactos.filter((c) => (esDia ? c.waDiaria : c.wa))
  const txt = esDia ? textoDia : texto
  const b = sinTildes(q.trim())
  const lista = d.contactos.filter((c) => !b || sinTildes(c.nombre + ' ' + c.movil + ' ' + c.email + ' ' + c.nota).includes(b))
  const mensaje = (c) => txt
    .replaceAll('{nombre}', (c.nombre || '').split(/\s+/)[0] || '').replace(/Buenos días, :/, 'Buenos días:')
    .replaceAll('{numero}', numero).replaceAll('{fecha}', fechaHoy()).replaceAll('{enlace}', esDia ? ENLACE_DIA : ENLACE)
  const abrirWa = (c) => {
    window.open(`https://wa.me/${c.movil.replace(/\D/g, '')}?text=${encodeURIComponent(mensaje(c))}`, '_blank', 'noopener')
    if (!enviados[c.id]) hacer('enviado', { numero: clave, id: c.id })
  }
  const siguiente = conWa.find((c) => !enviados[c.id])
  const nEnv = conWa.filter((c) => enviados[c.id]).length

  return (
    <div className="bp tel">
      {aviso && <p className="bp-nota"><b>{aviso}</b></p>}

      <section className="bp-caja abierto">
        <span className="bp-num">1</span>
        <div>
          <h2>Mandar por WhatsApp</h2>
          <label className="bp-fecha">Qué se manda{' '}
            <select value={numero} onChange={(e) => setNumero(e.target.value === 'dia' ? 'dia' : +e.target.value)}>
              <option value="dia">«España al día» de hoy</option>
              {(numeros || [1]).map((n) => <option key={n} value={n}>Boletín nº {n}</option>)}
            </select>
          </label>
          <p>Por WhatsApp: enviado a <b>{nEnv}</b> de <b>{conWa.length}</b> personas{esDia ? ' que reciben «España al día» por WhatsApp' : ' con móvil'}.{d.whatsappApi ? (esDia ? ' Con la API de WhatsApp Business sale sola cada mañana, con el correo.' : ' Con la API de WhatsApp Business se manda solo el día que sale el boletín.') : ''}</p>
          <p className="bp-nota">Por correo: el boletín se manda solo el día que sale, a las 8:00, a los <b>{d.suscriptores}</b> suscriptores. «España al día» sale cada mañana a sus <b>{d.diarios}</b> suscriptores.{!d.brevo && ' Falta la clave de Brevo: sin ella no sale ningún correo.'}
            {!esDia && d.enviosAuto?.[String(numero)] && <> Nº {numero}: {d.enviosAuto[String(numero)].correo} correos enviados.</>}</p>
          {siguiente
            ? <button type="button" className="btn bp-grande" onClick={() => abrirWa(siguiente)}>Mandar al siguiente: {siguiente.nombre || siguiente.movil} ↗</button>
            : conWa.length ? <p className="bp-ok">✓ Ya se ha mandado a todos.</p>
            : esDia ? <p className="bp-nota">Todavía nadie recibe «España al día» por WhatsApp: márcalo al añadir a una persona o con «Mandar España al día» en la lista.</p> : null}
          <p className="bp-nota">Cada botón abre WhatsApp con el mensaje ya escrito: solo hay que pulsar «Enviar». Así se manda desde el WhatsApp normal, sin WhatsApp Business.</p>
          <button type="button" className="btn-texto" onClick={() => setVerTexto(!verTexto)}>{verTexto ? 'Cerrar el mensaje' : 'Ver o cambiar el mensaje'}</button>
          {verTexto && (
            <div>
              <textarea rows={9} style={{ width: '100%' }} value={txt} onChange={(e) => (esDia ? setTextoDia : setTexto)(e.target.value)} />
              <small>{'{nombre}'} es el nombre de cada persona, {esDia ? <>{'{fecha}'} la fecha de hoy</> : <>{'{numero}'} el número del boletín</>} y {'{enlace}'} la dirección {esDia ? 'de «España al día»' : 'del boletín'}.</small>
              <p>
                <button type="button" className="btn btn-sec" onClick={() => hacer('texto', { texto: txt, cual: esDia ? 'dia' : '' }, 'Mensaje guardado ✓')}>Guardar el mensaje</button>{' '}
                <button type="button" className="btn-texto" onClick={() => (esDia ? setTextoDia(d.textoDiaBase) : setTexto(d.textoBase))}>Volver al de siempre</button>
              </p>
            </div>
          )}
        </div>
      </section>

      <section className="bp-caja">
        <span className="bp-num">2</span>
        <div>
          <h2>Añadir una persona</h2>
          <Alta hacer={hacer} />
          <details className="bp-leer"><summary>Pegar muchas a la vez (de un Excel)</summary>
            <p>Una persona por línea: <b>nombre; móvil; correo</b>. Entran en el boletín quincenal (si tienen correo) y en WhatsApp (si tienen móvil).</p>
            <textarea rows={5} style={{ width: '100%' }} value={pegado} onChange={(e) => setPegado(e.target.value)} placeholder={'María López; 600 123 456; maria@correo.es'} />
            <p><button type="button" className="btn btn-sec" disabled={!pegado.trim()} onClick={() => hacer('anadir', { personas: leerPegado(pegado) }, (j) => {
              setPegado('')
              return `${j.anadidos} nuevos` + (j.repetidos ? ` · ${j.repetidos} ya estaban (actualizados)` : '') + (j.malos?.length ? ` · sin móvil ni correo válido: ${j.malos.join(', ')}` : '')
            })}>Añadir a la lista</button></p>
          </details>
        </div>
      </section>

      <section className="bp-caja">
        <span className="bp-num">3</span>
        <div>
          <h2>La lista <small>({d.contactos.length})</small></h2>
          <input type="search" className="arch-buscar" placeholder="Buscar por nombre, móvil o correo…" value={q} onChange={(e) => setQ(e.target.value)} />
          <ul className="bp-lista tel-lista">
            {lista.map((c) => (
              <li key={c.id}>
                <span className="bp-sinimg tel-ini">{(c.nombre || '#').charAt(0).toUpperCase()}</span>
                {editando?.id === c.id ? (
                  <div className="tel-editar">
                    <input value={editando.nombre} onChange={(e) => setEditando({ ...editando, nombre: e.target.value })} placeholder="Nombre" />
                    <input value={editando.movil} onChange={(e) => setEditando({ ...editando, movil: e.target.value })} placeholder="Móvil" />
                    <input value={editando.email} onChange={(e) => setEditando({ ...editando, email: e.target.value })} placeholder="Correo" />
                    <button type="button" className="btn" onClick={() => { hacer('editar', editando, 'Guardado ✓'); setEditando(null) }}>Guardar</button>
                    <button type="button" className="btn-texto" onClick={() => setEditando(null)}>Cancelar</button>
                  </div>
                ) : (
                  <div>
                    <small>{c.movil || 'sin móvil'}{c.email ? ' · ' + c.email : ''}{c.abonado ? ' · abonado' : ''}{c.quincenal ? ' · boletín' : ''}{c.diaria ? ' · España al día' : ''}{c.waDiaria ? ' · España al día por WhatsApp' : ''}</small>
                    <b>{c.nombre || '(sin nombre)'}</b>
                    {enviados[c.id] && <em className="bp-espera tel-ok">✓ {esDia ? 'España al día de hoy' : `nº ${numero}`} enviado</em>}
                    {!c.wa && c.movil && <em className="bp-espera">No recibe el boletín por WhatsApp</em>}
                  </div>
                )}
                {editando?.id !== c.id && (
                  <span className="bp-acc">
                    {(esDia ? c.waDiaria : c.wa) && <button type="button" className="btn" onClick={() => abrirWa(c)}>WhatsApp ↗</button>}
                    {enviados[c.id] && <button type="button" className="btn-texto" onClick={() => hacer('enviado', { numero: clave, id: c.id, quitar: true })}>No enviado</button>}
                    <button type="button" className="btn-texto" onClick={() => setEditando({ id: c.id, nombre: c.nombre, movil: c.movil, email: c.email })}>Cambiar</button>
                    {c.movil && <button type="button" className="btn-texto" onClick={() => hacer('editar', { id: c.id, wa: !c.wa })}>{c.wa ? 'No mandar boletín' : 'Mandar boletín'}</button>}
                    {c.movil && <button type="button" className="btn-texto" onClick={() => hacer('editar', { id: c.id, waDiaria: !c.waDiaria })}>{c.waDiaria ? 'No mandar España al día' : 'Mandar España al día'}</button>}
                    <button type="button" className="btn-texto" onClick={() => { if (window.confirm(`¿Quitar a ${c.nombre || c.movil} de la lista? También deja de recibir las comunicaciones.`)) hacer('quitar', { id: c.id }) }}>Quitar</button>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  )
}

// Formulario corto: nombre, apellidos, correo, teléfono, si es abonado y qué recibe
function Alta({ hacer }) {
  const vacio = { nombre: '', apellidos: '', email: '', movil: '', abonado: false, quincenal: true, diaria: false, whatsapp: true, waDiaria: false, permiso: false }
  const [f, setF] = useState(vacio)
  const pon = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })
  const enviar = (ev) => {
    ev.preventDefault()
    hacer('anadir', { personas: [f] }, (j) => { setF(vacio); return j.anadidos ? `${f.nombre} añadido ✓` : j.repetidos ? `${f.nombre} ya estaba: actualizado ✓` : 'Falta un móvil o un correo válido.' })
  }
  return (
    <form className="tel-alta" onSubmit={enviar}>
      <label>Nombre<input value={f.nombre} onChange={pon('nombre')} required /></label>
      <label>Apellidos<input value={f.apellidos} onChange={pon('apellidos')} /></label>
      <label>Correo<input type="email" value={f.email} onChange={pon('email')} /></label>
      <label>Teléfono<input type="tel" value={f.movil} onChange={pon('movil')} placeholder="600 123 456" /></label>
      <label className="tel-check"><input type="checkbox" checked={f.abonado} onChange={pon('abonado')} /> Es abonado</label>
      <fieldset className="tel-recibe"><legend>Recibe</legend>
        <label className="tel-check"><input type="checkbox" checked={f.quincenal} onChange={pon('quincenal')} disabled={!f.email} /> El boletín quincenal por correo</label>
        <label className="tel-check"><input type="checkbox" checked={f.diaria} onChange={pon('diaria')} disabled={!f.email} /> «España al día» cada mañana por correo</label>
        <label className="tel-check"><input type="checkbox" checked={f.whatsapp} onChange={pon('whatsapp')} disabled={!f.movil} /> El boletín por WhatsApp</label>
        <label className="tel-check"><input type="checkbox" checked={f.waDiaria} onChange={pon('waDiaria')} disabled={!f.movil} /> «España al día» cada mañana por WhatsApp</label>
      </fieldset>
      <label className="tel-check"><input type="checkbox" checked={f.permiso} onChange={pon('permiso')} required /> Nos ha dado su permiso para enviárselo</label>
      <button className="btn" disabled={!f.email && !f.movil}>Añadir</button>
    </form>
  )
}
