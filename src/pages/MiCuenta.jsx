import { useEffect, useState } from 'react'
import { Link, Navigate, NavLink, Route, Routes } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { ESTADOS_PEDIDO } from '../lib/config'
import { euros, fecha } from '../lib/data'
import { confirmar } from '../lib/confirmar'
import { huella } from '../lib/documentos'
import Texto from '../components/Texto'

const PERIODO = { mensual: 'al mes', trimestral: 'al trimestre', anual: 'al año' }
const fechaHora = (d) => new Date(d).toLocaleString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })

// Datos de la persona: pedidos, inscripciones, pagos y donativos (la base de datos solo devuelve los suyos)
function useMisDatos() {
  const { session, socio } = useAuth()
  const [d, setD] = useState(null)
  useEffect(() => {
    if (!session) return
    const email = (session.user.email || '').toLowerCase()
    const mio = (r) => r.usuario_id === session.user.id || (r.email || '').toLowerCase() === email
    ;(async () => {
      const [{ data: ped }, { data: prods }, { data: don }, { data: pag }, { data: fir }] = await Promise.all([
        supabase.from('pedidos').select('*').order('creado_at', { ascending: false }),
        supabase.from('productos').select('id, fecha, lugar, slug'),
        supabase.from('donativos').select('*').order('creado_at', { ascending: false }),
        socio ? supabase.from('pagos').select('*').eq('socio_id', socio.id).order('fecha', { ascending: false }) : Promise.resolve({ data: [] }),
        supabase.from('firmas_adhesion').select('*').order('firmado_at', { ascending: false }),
      ])
      const pedidos = (ped || []).filter(mio)
      const porId = Object.fromEntries((prods || []).map((p) => [p.id, p]))
      const eventos = pedidos
        .filter((p) => p.estado !== 'cancelada')
        .flatMap((p) => p.items.filter((i) => i.categoria === 'actividades').map((i) => ({ ...i, ...porId[i.id], pedido: p })))
        .sort((a, b) => new Date(a.fecha) - new Date(b.fecha))
      setD({ pedidos, eventos, donativos: (don || []).filter(mio), pagos: pag || [], firmas: (fir || []).filter(mio) })
    })()
  }, [session, socio])
  return d
}

export default function MiCuenta() {
  const { session, perfil, socio, tipo, cargando, salir } = useAuth()
  const datos = useMisDatos()

  if (cargando) return <p className="contenedor bloque">Cargando…</p>
  if (!session) return <Navigate to="/acceso" replace />

  const asociado = tipo === 'asociado' || (tipo === 'equipo' && socio)
  const nombre = perfil?.nombre || socio?.nombre || session.user.email

  return (
    <div className="contenedor bloque">
      <div className="mi-cab">
        <div>
          <span className="etiqueta">{asociado ? 'Área del asociado' : 'Área del cliente'}</span>
          <h1>Hola, {nombre.split(' ')[0]}</h1>
        </div>
        <div className="acciones">
          {tipo === 'equipo' && <Link to="/gestion" className="btn btn-claro">Ir al panel de gestión</Link>}
          <button className="btn-texto" onClick={salir}>Cerrar sesión</button>
        </div>
      </div>

      <nav className="mi-nav">
        <NavLink end to="/mi-cuenta">Resumen</NavLink>
        <NavLink to="/mi-cuenta/pedidos">Mis compras</NavLink>
        <NavLink to="/mi-cuenta/eventos">Mis eventos</NavLink>
        {asociado && <NavLink to="/mi-cuenta/pagos">Mis pagos</NavLink>}
        {(asociado || datos?.firmas.length > 0) && <NavLink to="/mi-cuenta/documentos">Mis documentos</NavLink>}
        <NavLink to="/mi-cuenta/datos">Mis datos</NavLink>
      </nav>

      {!datos ? (
        <p className="vacio">Cargando…</p>
      ) : (
        <Routes>
          <Route index element={<Resumen datos={datos} asociado={asociado} />} />
          <Route path="pedidos" element={<Pedidos pedidos={datos.pedidos} />} />
          <Route path="eventos" element={<Eventos eventos={datos.eventos} />} />
          <Route path="pagos" element={asociado ? <Pagos pagos={datos.pagos} donativos={datos.donativos} /> : <Navigate to="/mi-cuenta" replace />} />
          <Route path="documentos" element={<Documentos firmas={datos.firmas} />} />
          <Route path="datos" element={<Datos />} />
        </Routes>
      )}
    </div>
  )
}

function Carnet({ socio, nombre }) {
  return (
    <div className="carnet">
      <div className="carnet-cab">PATRIAM <span>Carnet de asociado</span></div>
      <div className="carnet-nombre">{nombre}</div>
      <div className="carnet-datos">
        <div><span>Nº de socio</span><b>{socio.numero_socio || 'Pendiente'}</b></div>
        <div><span>Alta</span><b>{socio.alta_at ? fecha(socio.alta_at) : 'Pendiente'}</b></div>
        <div><span>Estado</span><b className={socio.estado === 'alta' ? 'ok' : ''}>{socio.estado === 'alta' ? 'Al corriente' : 'Pendiente de primer pago'}</b></div>
      </div>
    </div>
  )
}

function Resumen({ datos, asociado }) {
  const { perfil, socio, session } = useAuth()
  const proximos = datos.eventos.filter((e) => e.fecha && new Date(e.fecha) >= new Date())
  const ultimoPago = datos.pagos[0]
  return (
    <div className="mi-resumen">
      {asociado && socio ? (
        <>
          <Carnet socio={socio} nombre={socio.nombre || perfil?.nombre} />
          <div className="cifras">
            <div className="cifra"><b>{euros(socio.cuota)}</b>Cuota {PERIODO[socio.periodicidad]}</div>
            <div className="cifra"><b>{ultimoPago ? fecha(ultimoPago.fecha) : '—'}</b>Último pago</div>
            <div className="cifra"><b>{proximos.length}</b>Próximos eventos</div>
            <div className="cifra"><b>{datos.pedidos.length}</b>Compras e inscripciones</div>
          </div>
          {socio.baja_solicitada && <p className="caja-aviso">Ha solicitado la baja como asociado. La administración la tramitará en breve.</p>}
        </>
      ) : (
        <>
          <div className="cifras">
            <div className="cifra"><b>{datos.pedidos.length}</b>Compras e inscripciones</div>
            <div className="cifra"><b>{proximos.length}</b>Próximos eventos</div>
          </div>
          <div className="caja-info invitacion">
            <div>
              <b>¿Quiere hacerse asociado?</b>
              <p>Si se da de alta con este mismo correo ({session.user.email}), aquí verá también su carnet, su cuota y sus pagos.</p>
            </div>
            <Link to="/adhierete" className="btn">Hacerme asociado</Link>
          </div>
        </>
      )}

      <h2 className="titulo-seccion">Próximos eventos</h2>
      {proximos.length ? (
        <ListaEventos eventos={proximos.slice(0, 3)} />
      ) : (
        <p className="vacio">No tiene inscripciones próximas. <Link to="/tienda?cat=actividades">Ver cursos y actividades</Link></p>
      )}

      <h2 className="titulo-seccion espacio">Últimas compras</h2>
      {datos.pedidos.length ? <TablaPedidos pedidos={datos.pedidos.slice(0, 3)} /> : <p className="vacio">Aún no ha hecho ninguna compra. <Link to="/tienda">Ir a la tienda</Link></p>}
    </div>
  )
}

function TablaPedidos({ pedidos }) {
  const [abierto, setAbierto] = useState(null)
  return (
    <div className="lista-pedidos">
      {pedidos.map((p) => (
        <div key={p.id} className="pedido">
          <button className="pedido-cab" onClick={() => setAbierto(abierto === p.id ? null : p.id)} aria-expanded={abierto === p.id}>
            <span><b>{p.referencia}</b> · {fecha(p.creado_at)}</span>
            <span>{p.items.length} artículo{p.items.length > 1 ? 's' : ''} · <b>{Number(p.total) ? euros(p.total) : 'Gratuito'}</b></span>
            <span className={`estado estado-${p.estado === 'pendiente' ? 'programado' : p.estado === 'cancelado' ? 'rechazado' : 'publicado'}`}>{ESTADOS_PEDIDO[p.estado]}</span>
          </button>
          {abierto === p.id && (
            <div className="pedido-detalle">
              <ul>
                {p.items.map((i) => (
                  <li key={i.k || i.id}>{i.cantidad} × {i.nombre}{i.opcion ? ` (talla ${i.opcion})` : ''} · {Number(i.precio) ? euros(i.precio * i.cantidad) : 'Gratuito'}</li>
                ))}
              </ul>
              <p className="letra-pequena">
                Entrega: {{ envio: `envío a ${p.direccion}`, recogida: 'recogida en la sede', no_aplica: 'no aplica' }[p.entrega]}
                {Number(p.envio) ? ` · Gastos de envío ${euros(p.envio)}` : ''} · Pago: {p.metodo}
              </p>
              {p.estado === 'pendiente' && <p className="caja-aviso">Pendiente de pago. Use la referencia <b>{p.referencia}</b> como concepto.</p>}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function Pedidos({ pedidos }) {
  return (
    <>
      <h2 className="titulo-seccion">Mis compras</h2>
      {pedidos.length ? <TablaPedidos pedidos={pedidos} /> : <p className="vacio">Aún no ha hecho ninguna compra. <Link to="/tienda">Ir a la tienda</Link></p>}
      <p className="letra-pequena">¿Algún problema con un pedido? Escríbanos desde <Link to="/contacto">Contacto</Link> indicando la referencia. Consulte las <Link to="/condiciones-de-venta">condiciones de venta</Link>.</p>
    </>
  )
}

function ListaEventos({ eventos }) {
  return (
    <div className="lista-acciones">
      {eventos.map((e, n) => {
        const f = e.fecha ? new Date(e.fecha) : null
        const pasado = f && f < new Date()
        return (
          <article key={`${e.pedido.id}-${n}`} className={`accion ${pasado ? 'pasada' : ''}`}>
            <div className="fecha-bloque">
              <span className="fb-dia">{f ? f.getDate() : '—'}</span>
              <span className="fb-mes">{f ? f.toLocaleDateString('es-ES', { month: 'short' }) : ''}</span>
            </div>
            <div className="accion-cuerpo">
              <div className="meta">
                {f && <span className="cap">{fechaHora(e.fecha)}</span>}
                {e.lugar && <span>{e.lugar}</span>}
              </div>
              <h3>{e.slug ? <Link to={`/tienda/${e.slug}`}>{e.nombre}</Link> : e.nombre}</h3>
              <p>
                {e.cantidad > 1 ? `${e.cantidad} plazas` : '1 plaza'} · Inscripción {e.pedido.referencia} ·{' '}
                {e.pedido.estado === 'pendiente' ? 'pendiente de pago' : 'confirmada'}
              </p>
            </div>
          </article>
        )
      })}
    </div>
  )
}

function Eventos({ eventos }) {
  const proximos = eventos.filter((e) => !e.fecha || new Date(e.fecha) >= new Date())
  const pasados = eventos.filter((e) => e.fecha && new Date(e.fecha) < new Date()).reverse()
  return (
    <>
      <h2 className="titulo-seccion">Próximos eventos</h2>
      {proximos.length ? <ListaEventos eventos={proximos} /> : <p className="vacio">No tiene inscripciones próximas. <Link to="/tienda?cat=actividades">Ver cursos y actividades</Link></p>}
      <h2 className="titulo-seccion espacio">Eventos a los que asistió</h2>
      {pasados.length ? <ListaEventos eventos={pasados} /> : <p className="vacio">Todavía no hay eventos pasados.</p>}
      <p className="letra-pequena">Para cancelar una inscripción, escríbanos desde <Link to="/contacto">Contacto</Link>.</p>
    </>
  )
}

function Pagos({ pagos, donativos }) {
  const total = pagos.filter((p) => p.estado === 'cobrado').reduce((t, p) => t + Number(p.importe), 0)
  return (
    <>
      <h2 className="titulo-seccion">Mis cuotas</h2>
      <p>Total aportado en cuotas: <b>{euros(total)}</b></p>
      {pagos.length ? (
        <div className="tabla-scroll">
          <table className="tabla">
            <thead><tr><th>Fecha</th><th>Concepto</th><th>Importe</th><th>Forma de pago</th><th>Estado</th></tr></thead>
            <tbody>
              {pagos.map((p) => (
                <tr key={p.id}>
                  <td>{fecha(p.fecha)}</td><td>{p.concepto}</td><td>{euros(p.importe)}</td><td>{p.metodo}</td>
                  <td><span className={`estado ${p.estado === 'cobrado' ? 'estado-publicado' : 'estado-programado'}`}>{p.estado === 'cobrado' ? 'Cobrado' : 'Pendiente'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="vacio">Aún no hay pagos registrados.</p>
      )}
      <h2 className="titulo-seccion espacio">Mis donativos</h2>
      {donativos.length ? (
        <div className="tabla-scroll">
          <table className="tabla">
            <thead><tr><th>Fecha</th><th>Importe</th><th>Forma de pago</th><th>Referencia</th><th>Estado</th></tr></thead>
            <tbody>
              {donativos.map((d) => (
                <tr key={d.id}><td>{fecha(d.creado_at)}</td><td>{euros(d.importe)}</td><td>{d.metodo}</td><td><code>{d.referencia}</code></td><td>{d.estado === 'confirmado' ? 'Recibido' : 'Pendiente'}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="vacio">No hay donativos asociados a su cuenta.</p>
      )}
      <p className="letra-pequena">Si necesita un certificado de sus cuotas o donativos, solicítelo desde <Link to="/contacto">Contacto</Link>.</p>
    </>
  )
}

function Datos() {
  const { session, perfil, socio, recargar } = useAuth()
  const [nombre, setNombre] = useState(perfil?.nombre || '')
  const [municipio, setMunicipio] = useState(socio?.municipio || '')
  const [clave, setClave] = useState('')
  const [msg, setMsg] = useState('')

  const guardarNombre = async () => {
    const { error } = await supabase.from('perfiles').update({ nombre }).eq('id', session.user.id)
    if (!error && socio) await supabase.from('socios').update({ municipio }).eq('id', socio.id)
    setMsg(error ? error.message : 'Datos guardados.')
    recargar()
  }
  const cambiarClave = async (e) => {
    e.preventDefault()
    const { error } = await supabase.auth.updateUser({ password: clave })
    setMsg(error ? error.message : 'Contraseña cambiada.')
    setClave('')
  }
  const pedirBaja = async () => {
    if (!confirmar('¿Solicitar la baja como asociado? Dejará de pagar la cuota cuando la administración la tramite.')) return
    const { error } = await supabase.from('socios').update({ baja_solicitada: true }).eq('id', socio.id)
    setMsg(error ? error.message : 'Solicitud de baja enviada.')
    recargar()
  }

  return (
    <>
      <h2 className="titulo-seccion">Mis datos</h2>
      <div className="formulario tarjeta-form">
        <label>Email<input value={session.user.email} disabled /></label>
        <label>Nombre y apellidos<input value={nombre} onChange={(e) => setNombre(e.target.value)} /></label>
        {socio && <label>Municipio<input value={municipio} onChange={(e) => setMunicipio(e.target.value)} /></label>}
        <div className="acciones"><button className="btn" onClick={guardarNombre}>Guardar</button></div>
      </div>
      <form className="formulario tarjeta-form" onSubmit={cambiarClave}>
        <label>Nueva contraseña (mínimo 10 caracteres)<input type="password" minLength={10} required value={clave} onChange={(e) => setClave(e.target.value)} autoComplete="new-password" /></label>
        <div className="acciones"><button className="btn btn-claro">Cambiar contraseña</button></div>
      </form>
      {msg && <p className="aviso-ok">{msg}</p>}
      <div className="caja-info">
        <h3>Sus derechos</h3>
        <p>Puede pedir acceso, rectificación o supresión de sus datos, o retirar su consentimiento, escribiendo desde <Link to="/contacto">Contacto</Link>. Más información en la <Link to="/privacidad">política de privacidad</Link>.</p>
        {socio && !socio.baja_solicitada && <button className="btn-texto peligro" onClick={pedirBaja}>Solicitar la baja como asociado</button>}
      </div>
    </>
  )
}

function Documentos({ firmas }) {
  const [ver, setVer] = useState(null)
  const [ok, setOk] = useState({})
  const comprobar = async (f) => setOk({ ...ok, [f.id]: (await huella(f.texto)) === f.hash_documento })
  return (
    <>
      <h2 className="titulo-seccion">Documentos firmados</h2>
      {firmas.length === 0 ? (
        <p className="vacio">No hay documentos firmados con este correo.</p>
      ) : (
        <div className="lista-pedidos">
          {firmas.map((f) => (
            <div key={f.id} className="pedido">
              <div className="pedido-cab">
                <span>✓ <b>{f.titulo}</b></span>
                <span className="mini">Firmado el {new Date(f.firmado_at).toLocaleString('es-ES')}</span>
                <span className="acciones-fila">
                  <button className="btn-texto" onClick={() => comprobar(f)}>{ok[f.id] === undefined ? 'Comprobar' : ok[f.id] ? 'Íntegro ✓' : 'No coincide'}</button>
                  <button className="btn-texto" onClick={() => setVer(ver === f.id ? null : f.id)}>{ver === f.id ? 'Ocultar' : 'Ver lo que firmé'}</button>
                </span>
              </div>
              {ver === f.id && (
                <div className="pedido-detalle">
                  <p className="letra-pequena">Firma: <b>{f.firma}</b> · Huella SHA-256: <code className="hash">{f.hash_documento}</code></p>
                  <div className="doc-texto"><Texto>{f.texto}</Texto></div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      <p className="letra-pequena">Este registro no se puede modificar. Si necesita una copia certificada, solicítela desde <Link to="/contacto">Contacto</Link>.</p>
    </>
  )
}
