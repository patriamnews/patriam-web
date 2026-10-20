import { confirmar } from '../lib/confirmar'
import { Fragment, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { euros, fecha } from '../lib/data'
import { DOCUMENTOS_ADHESION, huella } from '../lib/documentos'
import Texto from '../components/Texto'

const OBLIGATORIOS = DOCUMENTOS_ADHESION.filter((d) => d.obligatorio).map((d) => d.clave)
const fechaHora = (d) => new Date(d).toLocaleString('es-ES', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })

const ESTADOS = { pendiente: 'Pendiente de primer pago', alta: 'Alta', baja: 'Baja' }
const hoy = () => new Date().toISOString().slice(0, 10)

export default function Socios() {
  const [vista, setVista] = useState('socios')
  const [socios, setSocios] = useState([])
  const [dons, setDons] = useState([])
  const [pagos, setPagos] = useState([])
  const [abierto, setAbierto] = useState(null)
  const [nuevoPago, setNuevoPago] = useState(null)
  const [firmas, setFirmas] = useState([])
  const [verFirma, setVerFirma] = useState(null)
  const [aviso, setAviso] = useState('')

  const cargar = () => {
    supabase.from('socios').select('*').order('creado_at', { ascending: false }).then(({ data }) => setSocios(data || []))
    supabase.from('donativos').select('*').order('creado_at', { ascending: false }).then(({ data }) => setDons(data || []))
    supabase.from('pagos').select('*').order('fecha', { ascending: false }).then(({ data }) => setPagos(data || []))
    supabase.from('firmas_adhesion').select('*').order('firmado_at', { ascending: false }).then(({ data }) => setFirmas(data || []))
  }
  useEffect(cargar, [])

  const cambiar = async (tabla, id, v) => {
    await supabase.from(tabla).update(v).eq('id', id)
    cargar()
  }

  // Documentos firmados por cada socio (por referencia de su solicitud o por su correo)
  const firmasDe = (s) => firmas.filter((f) => f.referencia === s.referencia || (f.email || '').toLowerCase() === (s.email || '').toLowerCase())
  const faltanDocs = (s) => OBLIGATORIOS.filter((k) => !firmasDe(s).some((f) => f.documento === k))

  // Al dar de alta se asigna número de socio y fecha de alta. Sin todos los documentos firmados no hay alta.
  const cambiarEstado = async (s, estado) => {
    setAviso('')
    if (estado === 'alta' && faltanDocs(s).length) return setAviso(`No se puede dar de alta a ${s.nombre}: faltan documentos firmados (${faltanDocs(s).length}).`)
    const v = { estado }
    if (estado === 'alta' && !s.numero_socio) {
      const max = socios.reduce((m, x) => Math.max(m, Number(x.numero_socio) || 0), 0)
      v.numero_socio = String(max + 1).padStart(4, '0')
      v.alta_at = new Date().toISOString()
    }
    if (estado === 'baja') v.baja_solicitada = false
    cambiar('socios', s.id, v)
  }

  const registrarPago = async (e) => {
    e.preventDefault()
    const { socio, ...d } = nuevoPago
    await supabase.from('pagos').insert({ ...d, socio_id: socio.id, importe: Number(d.importe), estado: 'cobrado' })
    if (socio.estado === 'pendiente' && !faltanDocs(socio).length) await cambiarEstado(socio, 'alta')
    setNuevoPago(null)
    cargar()
  }

  const borrar = async (id) => {
    if (!confirmar('¿Eliminar definitivamente los datos de este socio? (derecho de supresión)')) return
    await supabase.from('socios').delete().eq('id', id)
    cargar()
  }

  const altas = socios.filter((s) => s.estado === 'alta')
  const bajas = socios.filter((s) => s.baja_solicitada && s.estado !== 'baja')
  const mensual = altas.reduce((t, s) => t + s.cuota / ({ mensual: 1, trimestral: 3, anual: 12 }[s.periodicidad] || 1), 0)
  const donado = dons.filter((d) => d.estado === 'confirmado').reduce((t, d) => t + Number(d.importe), 0)

  return (
    <>
      <h1>Socios y donativos</h1>
      <div className="cifras">
        <div className="cifra"><b>{altas.length}</b>Socios de alta</div>
        <div className="cifra"><b>{socios.filter((s) => s.estado === 'pendiente').length}</b>Solicitudes pendientes</div>
        <div className="cifra"><b>{euros(Math.round(mensual))}</b>Cuotas al mes (estimado)</div>
        <div className="cifra"><b>{euros(donado)}</b>Donativos confirmados</div>
      </div>
      {aviso && <p className="error">{aviso}</p>}
      {bajas.length > 0 && (
        <p className="caja-aviso"><b>{bajas.length} solicitud{bajas.length > 1 ? 'es' : ''} de baja</b> pendiente{bajas.length > 1 ? 's' : ''} de tramitar (marcadas abajo). Cambie su estado a "Baja".</p>
      )}
      <p className="letra-pequena">
        Compruebe el pago en el banco o la pasarela con la <b>referencia</b> y regístrelo con "Registrar pago": el asociado lo verá en su área. Al registrar el primer pago, el socio pasa a "Alta" y recibe número. Acceso limitado al administrador.
      </p>

      {nuevoPago && (
        <form className="formulario tarjeta-form" onSubmit={registrarPago}>
          <h3>Registrar pago de {nuevoPago.socio.nombre}</h3>
          <div className="cuatro-col">
            <label>Fecha<input type="date" required value={nuevoPago.fecha} onChange={(e) => setNuevoPago({ ...nuevoPago, fecha: e.target.value })} /></label>
            <label>Importe (€)<input type="number" min="0" step="0.01" required value={nuevoPago.importe} onChange={(e) => setNuevoPago({ ...nuevoPago, importe: e.target.value })} /></label>
            <label>Concepto<input value={nuevoPago.concepto} onChange={(e) => setNuevoPago({ ...nuevoPago, concepto: e.target.value })} /></label>
            <label>
              Forma de pago
              <select value={nuevoPago.metodo} onChange={(e) => setNuevoPago({ ...nuevoPago, metodo: e.target.value })}>
                <option value="tarjeta">Tarjeta</option><option value="bizum">Bizum</option><option value="transferencia">Transferencia</option><option value="efectivo">Efectivo</option>
              </select>
            </label>
          </div>
          <div className="acciones">
            <button className="btn">Registrar</button>
            <button type="button" className="btn-texto" onClick={() => setNuevoPago(null)}>Cancelar</button>
          </div>
        </form>
      )}

      <div className="pestanas">
        <button className={vista === 'socios' ? 'activa' : ''} onClick={() => setVista('socios')}>Socios ({socios.length})</button>
        <button className={vista === 'donativos' ? 'activa' : ''} onClick={() => setVista('donativos')}>Donativos ({dons.length})</button>
        <button className={vista === 'firmas' ? 'activa' : ''} onClick={() => setVista('firmas')}>Registro de firmas ({firmas.length})</button>
      </div>
      <div className="tabla-scroll">
        {vista === 'socios' ? (
          <table className="tabla">
            <thead><tr><th>Nº</th><th>Nombre</th><th>Email</th><th>Cuota</th><th>Documentos</th><th>Referencia</th><th>Estado</th><th>Solicitud</th><th></th></tr></thead>
            <tbody>
              {socios.map((s) => {
                const susPagos = pagos.filter((p) => p.socio_id === s.id)
                return (
                  <Fragment key={s.id}>
                    <tr>
                      <td>{s.numero_socio || '—'}</td>
                      <td>{s.nombre}{s.baja_solicitada && s.estado !== 'baja' && <span className="estado estado-rechazado"> Pide la baja</span>}{s.usuario_id && <span className="mini"> · con cuenta</span>}</td>
                      <td><a href={`mailto:${s.email}`}>{s.email}</a></td>
                      <td>{euros(s.cuota)} / {s.periodicidad}</td>
                      <td>{faltanDocs(s).length ? <span className="estado estado-rechazado">Faltan {faltanDocs(s).length}</span> : <span className="estado estado-publicado">Firmados ✓</span>}</td>
                      <td><code>{s.referencia}</code></td>
                      <td>
                        <select value={s.estado} onChange={(e) => cambiarEstado(s, e.target.value)}>
                          {Object.entries(ESTADOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                      </td>
                      <td>{fecha(s.creado_at)}</td>
                      <td className="acciones-fila">
                        <button className="btn-texto" onClick={() => setNuevoPago({ socio: s, fecha: hoy(), importe: s.cuota, concepto: `Cuota ${s.periodicidad}`, metodo: s.metodo })}>Registrar pago</button>
                        <button className="btn-texto" onClick={() => setAbierto(abierto === s.id ? null : s.id)}>Pagos ({susPagos.length})</button>
                        <button className="btn-texto peligro" onClick={() => borrar(s.id)}>Eliminar</button>
                      </td>
                    </tr>
                    {abierto === s.id && (
                      <tr className="detalle">
                        <td colSpan={9}>
                          {susPagos.length ? (
                            <ul>{susPagos.map((p) => <li key={p.id}>{fecha(p.fecha)} · {p.concepto} · {euros(p.importe)} · {p.metodo}</li>)}</ul>
                          ) : (
                            'Sin pagos registrados.'
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        ) : vista === 'firmas' ? (
          <RegistroFirmas firmas={firmas} ver={verFirma} setVer={setVerFirma} />
        ) : (
          <table className="tabla">
            <thead><tr><th>Fecha</th><th>Importe</th><th>Método</th><th>Referencia</th><th>Email</th><th>Estado</th></tr></thead>
            <tbody>
              {dons.map((d) => (
                <tr key={d.id}>
                  <td>{fecha(d.creado_at)}</td>
                  <td>{euros(d.importe)}</td>
                  <td>{d.metodo}</td>
                  <td><code>{d.referencia}</code></td>
                  <td>{d.email || 'Anónimo'}</td>
                  <td>
                    <select value={d.estado} onChange={(e) => cambiar('donativos', d.id, { estado: e.target.value })}>
                      <option value="pendiente">Pendiente</option>
                      <option value="confirmado">Confirmado</option>
                      <option value="no_recibido">No recibido</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}

// Registro de firmas: prueba de qué documento firmó cada persona, cuándo y con qué texto exacto
function RegistroFirmas({ firmas, ver, setVer }) {
  const [verificacion, setVerificacion] = useState({})
  const verificar = async (f) => {
    const ok = (await huella(f.texto)) === f.hash_documento
    setVerificacion({ ...verificacion, [f.id]: ok })
  }
  return (
    <>
      <p className="letra-pequena">
        Registro inalterable: no se puede modificar ni borrar. Cada fila guarda el texto exacto firmado, su huella SHA-256, la firma tecleada, la fecha y hora del servidor y el navegador. "Comprobar" vuelve a calcular la huella para demostrar que el texto no ha cambiado.
      </p>
      <table className="tabla">
        <thead><tr><th>Fecha y hora</th><th>Firmante</th><th>Documento</th><th>Referencia</th><th>Huella del documento</th><th></th></tr></thead>
        <tbody>
          {firmas.map((f) => (
            <Fragment key={f.id}>
              <tr>
                <td>{fechaHora(f.firmado_at)}</td>
                <td>{f.nombre_firmante}<br /><span className="mini">{f.email}</span></td>
                <td>{f.titulo}</td>
                <td><code>{f.referencia}</code></td>
                <td><code className="hash">{f.hash_documento?.slice(0, 16)}…</code></td>
                <td className="acciones-fila">
                  <button className="btn-texto" onClick={() => verificar(f)}>
                    {verificacion[f.id] === undefined ? 'Comprobar' : verificacion[f.id] ? 'Íntegro ✓' : 'NO coincide ✗'}
                  </button>
                  <button className="btn-texto" onClick={() => setVer(ver === f.id ? null : f.id)}>{ver === f.id ? 'Ocultar' : 'Ver texto'}</button>
                </td>
              </tr>
              {ver === f.id && (
                <tr className="detalle">
                  <td colSpan={6}>
                    <p className="letra-pequena">
                      Firma tecleada: <b>{f.firma}</b> · Método: {f.metodo} · IP: {f.ip || '—'} · Navegador: {f.navegador}<br />
                      Huella del documento: <code className="hash">{f.hash_documento}</code><br />
                      Huella encadenada del registro: <code className="hash">{f.hash_cadena}</code>
                    </p>
                    <div className="doc-texto"><Texto>{f.texto}</Texto></div>
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </>
  )
}
