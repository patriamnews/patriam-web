import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getAjustes, getPagina, euros, fecha, referencia } from '../lib/data'
import { CATEGORIAS_TIENDA } from '../lib/config'
import { useCarrito } from '../lib/carrito'
import { useAuth } from '../lib/auth'
import { Metodos, Instrucciones } from '../components/Pago'
import Texto from '../components/Texto'
import NoEncontrado from './NoEncontrado'
import { Foto } from '../components/ImagenPrueba'

const ICONOS = {
  libros: 'M4 5a2 2 0 012-2h5v16H6a2 2 0 00-2 2zM20 5a2 2 0 00-2-2h-5v16h5a2 2 0 012 2z',
  ropa: 'M8 3l-5 3 2 4 2-1v12h10V9l2 1 2-4-5-3a4 4 0 01-8 0z',
  actividades: 'M4 5h16v12H4zM8 21h8M12 17v4',
}

export function ImagenProducto({ p, grande }) {
  return <Foto src={p.imagen_url} alt={p.nombre} ratio="1 / 1" className={`prod-img ${grande ? 'grande' : ''}`} />
  // eslint-disable-next-line no-unreachable
  return (
    <div className={`prod-img prod-sin-img cat-${p.categoria} ${grande ? 'grande' : ''}`} aria-hidden>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round">
        <path d={ICONOS[p.categoria]} />
      </svg>
    </div>
  )
}

const precio = (n) => (Number(n) === 0 ? 'Gratuito' : euros(n))
const opciones = (p) => (p.opciones || '').split(',').map((x) => x.trim()).filter(Boolean)

function Rejilla({ items, vacio }) {
  if (!items.length) return <p className="vacio">{vacio}</p>
  return (
    <div className="rejilla-tienda">
      {items.map((p) => (
        <Link key={p.id} to={`/tienda/${p.slug}`} className="producto">
          <ImagenProducto p={p} />
          <div className="producto-cuerpo">
            <span className="etiqueta">{CATEGORIAS_TIENDA[p.categoria]}</span>
            <h3>{p.nombre}</h3>
            {Number(p.precio) > 0 && <b className="precio">{euros(p.precio)}</b>}
          </div>
        </Link>
      ))}
    </div>
  )
}

export function Tienda() {
  const [intro, setIntro] = useState(null)
  const [lista, setLista] = useState(null)

  useEffect(() => {
    getPagina('tienda').then(setIntro)
    supabase.from('productos').select('*').eq('activo', true).order('orden').then(({ data }) => setLista(data || []))
  }, [])

  return (
    <div className="contenedor bloque">
      <div className="titulo-bloque">
        <h1>{intro?.titulo || 'Tienda'}</h1>
        <BotonCarrito />
      </div>
      {intro?.contenido && <Texto>{intro.contenido}</Texto>}
      {lista === null ? (
        <p className="vacio">Cargando…</p>
      ) : (
        <>
          <section className="tienda-apartado">
            <h2 className="titulo-seccion">Colección PATRIAM</h2>
            <p className="letra-pequena">Camisetas, sudaderas, tazas y regalos. Se pagan aquí con tarjeta y te los enviamos a casa.</p>
            <Rejilla items={lista.filter((p) => p.categoria !== 'libros')} vacio="Muy pronto, nuestras camisetas y tazas." />
          </section>
          <section className="tienda-apartado">
            <h2 className="titulo-seccion">Libros recomendados</h2>
            <p className="letra-pequena">Lecturas que recomendamos. Se compran en la librería online: si lo haces desde aquí, PATRIAM recibe una pequeña comisión sin que te cueste más.</p>
            <Rejilla items={lista.filter((p) => p.categoria === 'libros')} vacio="Pronto añadiremos los libros que recomendamos." />
          </section>
        </>
      )}
    </div>
  )
}

function BotonCarrito() {
  const { unidades } = useCarrito()
  return (
    <Link to="/tienda/carrito" className="btn btn-claro">
      Carrito{unidades ? ` (${unidades})` : ''}
    </Link>
  )
}

export function Producto() {
  const { slug } = useParams()
  const { anadir } = useCarrito()
  const [p, setP] = useState(undefined)
  const [opcion, setOpcion] = useState('')
  const [cantidad, setCantidad] = useState(1)
  const [ok, setOk] = useState(false)

  useEffect(() => {
    supabase.from('productos').select('*').eq('slug', slug).eq('activo', true).maybeSingle().then(({ data }) => setP(data))
  }, [slug])

  if (p === undefined) return <p className="contenedor vacio">Cargando…</p>
  if (!p) return <NoEncontrado />

  const ops = opciones(p)
  // Opciones «Color / Talla»: se eligen por separado y la foto cambia con el color
  const dobles = ops.length > 0 && ops.every((o) => o.includes(' / '))
  const colores = dobles ? [...new Set(ops.map((o) => o.split(' / ')[0]))] : []
  const tallas = dobles ? [...new Set(ops.map((o) => o.split(' / ')[1]))] : []
  const [colorSel, tallaSel] = dobles ? (opcion || ' / ').split(' / ') : []
  const elegir = (c, t) => setOpcion(c && t && ops.includes(`${c} / ${t}`) ? `${c} / ${t}` : `${c || ''} / ${t || ''}`)
  const foto = dobles && colorSel && p.fotos?.[colorSel] ? { ...p, imagen_url: p.fotos[colorSel] } : p
  const esActividad = p.categoria === 'actividades'
  const agregar = () => {
    if (ops.length && !ops.includes(opcion)) return
    anadir(p, opcion, cantidad)
    setOk(true)
  }

  return (
    <div className="contenedor bloque">
      <Link to="/tienda" className="etiqueta">← Tienda</Link>
      <div className="ficha">
        <ImagenProducto p={foto} grande />
        <div>
          <span className="etiqueta">{CATEGORIAS_TIENDA[p.categoria]}</span>
          <h1>{p.nombre}</h1>
          {!(p.categoria === 'libros' && !(Number(p.precio) > 0)) && <p className="precio grande">{p.categoria === 'libros' ? 'Precio orientativo: ' : ''}{precio(p.precio)}</p>}
          {esActividad && (
            <ul className="datos-actividad">
              {p.fecha && <li><b>Fecha:</b> {fecha(p.fecha)}</li>}
              {p.lugar && <li><b>Lugar:</b> {p.lugar}</li>}
              {p.plazas && <li><b>Plazas:</b> {p.plazas}</li>}
            </ul>
          )}
          <Texto>{p.descripcion}</Texto>
          {p.enlace_externo ? (
            <>
              <div className="acciones">
                <a className="btn" href={p.enlace_externo} target="_blank" rel="sponsored noopener noreferrer">Comprar el libro ↗</a>
              </div>
              <p className="letra-pequena">
                Enlace de afiliado: se abre la librería en una pestaña nueva y allí se compra. Si lo compras desde este enlace, PATRIAM recibe una pequeña
                comisión, sin que a ti te cueste más.
              </p>
            </>
          ) : (<>
          {dobles && (
            <>
              <div className="tallas">
                <span>Color</span>
                {colores.map((c) => (
                  <button key={c} type="button" className={colorSel === c ? 'activo' : ''} onClick={() => elegir(c, tallaSel)}>{c}</button>
                ))}
              </div>
              <div className="tallas">
                <span>Talla</span>
                {tallas.map((t) => (
                  <button key={t} type="button" className={tallaSel === t ? 'activo' : ''} disabled={colorSel && !ops.includes(`${colorSel} / ${t}`)} onClick={() => elegir(colorSel, t)}>{t}</button>
                ))}
              </div>
            </>
          )}
          {ops.length > 0 && !dobles && (
            <div className="tallas">
              <span>Talla</span>
              {ops.map((o) => (
                <button key={o} type="button" className={opcion === o ? 'activo' : ''} onClick={() => setOpcion(o)}>{o}</button>
              ))}
            </div>
          )}
          <div className="acciones">
            <input className="cantidad" type="number" min="1" max={esActividad ? 5 : 20} value={cantidad} onChange={(e) => setCantidad(Math.max(1, Number(e.target.value)))} aria-label="Cantidad" />
            <button className="btn" onClick={agregar} disabled={ops.length > 0 && !ops.includes(opcion)}>
              {esActividad ? (Number(p.precio) === 0 ? 'Inscribirme' : 'Reservar plaza') : 'Añadir al carrito'}
            </button>
          </div>
          {ops.length > 0 && !ops.includes(opcion) && <p className="letra-pequena">{dobles ? 'Elija color y talla.' : 'Elija una talla.'}</p>}
          </>)}
          {ok && (
            <p className="aviso-ok">
              Añadido. <Link to="/tienda/carrito">Ver el carrito</Link> · <Link to="/tienda">Seguir comprando</Link>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

export function Carrito() {
  const { items, cambiar, vaciar, subtotal, conEnvio } = useCarrito()
  const { session, perfil } = useAuth()
  const [aj, setAj] = useState(null)
  const [f, setF] = useState({ nombre: perfil?.nombre || '', email: session?.user?.email || '', entrega: 'envio', direccion: '', metodo: 'tarjeta' })
  const [acepta, setAcepta] = useState(false)
  const [ok, setOk] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    getAjustes().then(setAj)
  }, [])

  if (!aj) return <p className="contenedor vacio">Cargando…</p>

  const entrega = conEnvio ? f.entrega : 'no_aplica'
  const gratisDesde = Number(aj.envio_gratis_desde) || Infinity
  const envio = entrega === 'envio' && subtotal < gratisDesde ? Number(aj.envio_coste) || 0 : 0
  const total = subtotal + envio
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  const pedir = async (e) => {
    e.preventDefault()
    setError('')
    if (!acepta) return setError('Debe aceptar las condiciones de venta y la política de privacidad.')
    const refe = referencia('PED')
    const pedido = {
      referencia: refe,
      items,
      envio,
      subtotal,
      total,
      nombre: f.nombre.trim(),
      email: f.email.trim(),
      entrega,
      direccion: entrega === 'envio' ? f.direccion.trim() : null,
      metodo: total > 0 ? f.metodo : 'gratuito',
      consentimiento: true,
    }
    const { error } = await supabase.from('pedidos').insert(pedido)
    if (error) return setError('No se ha podido completar el pedido: ' + error.message)
    setOk(pedido)
    vaciar()
  }

  if (ok)
    return (
      <div className="contenedor estrecho bloque">
        <div className="aviso-ok grande">
          <h2>Pedido recibido</h2>
          <p>Referencia <b>{ok.referencia}</b>. Le enviaremos la confirmación a {ok.email}.</p>
          {ok.total > 0 ? (
            <Instrucciones metodo={ok.metodo} importe={ok.total} refe={ok.referencia} aj={aj} pago={{ tipo: 'pedido', email: ok.email, envio: ok.envio, items: ok.items.map((x) => ({ nombre: x.nombre, opcion: x.opcion, precio: x.precio, cantidad: x.cantidad, gelato: x.gelato || null })) }} />
          ) : (
            <p>Su inscripción es gratuita. No tiene que pagar nada.</p>
          )}
        </div>
      </div>
    )

  return (
    <div className="contenedor bloque">
      <Link to="/tienda" className="etiqueta">← Seguir comprando</Link>
      <h1>Carrito</h1>
      {items.length === 0 ? (
        <p className="vacio">El carrito está vacío. <Link to="/tienda">Ir a la tienda</Link></p>
      ) : (
        <div className="checkout">
          <div>
            <div className="tabla-scroll">
              <table className="tabla">
                <thead><tr><th>Producto</th><th>Precio</th><th>Cantidad</th><th>Total</th></tr></thead>
                <tbody>
                  {items.map((i) => (
                    <tr key={i.k}>
                      <td>{i.nombre}{i.opcion ? ` · Talla ${i.opcion}` : ''}{i.fecha ? ` · ${fecha(i.fecha)}` : ''}</td>
                      <td>{precio(i.precio)}</td>
                      <td><input className="cantidad" type="number" min="0" value={i.cantidad} onChange={(e) => cambiar(i.k, Number(e.target.value))} aria-label="Cantidad" /></td>
                      <td>{euros(i.precio * i.cantidad)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="totales">
              <div><span>Subtotal</span><span>{euros(subtotal)}</span></div>
              {conEnvio && <div><span>Envío</span><span>{envio ? euros(envio) : 'Gratis'}</span></div>}
              <div className="total"><span>Total</span><span>{euros(total)}</span></div>
              {conEnvio && Number.isFinite(gratisDesde) && <p className="letra-pequena">Envío gratis a partir de {euros(gratisDesde)}.</p>}
            </div>
          </div>

          <form className="formulario tarjeta-form" onSubmit={pedir}>
            <h3>Datos del pedido</h3>
            {session ? (
              <p className="letra-pequena">El pedido quedará en su área de <Link to="/mi-cuenta/pedidos">Mis compras</Link>.</p>
            ) : (
              <p className="letra-pequena">¿Tiene cuenta? <Link to="/acceso">Acceda</Link> y verá sus compras y eventos en su área.</p>
            )}
            <label>Nombre y apellidos<input required maxLength={150} value={f.nombre} onChange={set('nombre')} autoComplete="name" /></label>
            <label>Email<input required type="email" maxLength={200} value={f.email} onChange={set('email')} autoComplete="email" readOnly={!!session} /></label>
            {conEnvio && (
              <fieldset className="grupo">
                <legend>Entrega</legend>
                <label className="check"><input type="radio" checked={f.entrega === 'envio'} onChange={() => setF({ ...f, entrega: 'envio' })} /><span>Envío a domicilio</span></label>
                <label className="check"><input type="radio" checked={f.entrega === 'recogida'} onChange={() => setF({ ...f, entrega: 'recogida' })} /><span>{aj.recogida || 'Recogida en la sede'}</span></label>
                {items.some((i) => i.gelato) && (
                  <p className="caja-aviso">Las prendas y tazas de PATRIAM las fabrica y envía nuestro taller de impresión a la dirección que indique al pagar con tarjeta (3 a 5 días laborables).</p>
                )}
                {f.entrega === 'envio' && (
                  <label>Dirección completa (calle, número, CP, localidad)<textarea required rows={2} maxLength={300} value={f.direccion} onChange={set('direccion')} autoComplete="street-address" /></label>
                )}
              </fieldset>
            )}
            {total > 0 && (
              <fieldset className="grupo">
                <legend>Forma de pago</legend>
                <Metodos valor={f.metodo} onChange={(m) => setF({ ...f, metodo: m })} />
              </fieldset>
            )}
            <label className="check">
              <input type="checkbox" checked={acepta} onChange={(e) => setAcepta(e.target.checked)} />
              <span>
                Acepto las <Link to="/condiciones-de-venta">condiciones de venta</Link> y la <Link to="/privacidad">política de privacidad</Link>.
              </span>
            </label>
            {error && <p className="error">{error}</p>}
            <button className="btn btn-bloque">{total > 0 ? `Confirmar pedido · ${euros(total)}` : 'Confirmar inscripción'}</button>
          </form>
        </div>
      )}
    </div>
  )
}
