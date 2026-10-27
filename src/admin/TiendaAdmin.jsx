import { Fragment, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { CATEGORIAS_TIENDA, ESTADOS_PEDIDO } from '../lib/config'
import { euros, fecha, slugify } from '../lib/data'
import { confirmar } from '../lib/confirmar'
import { subirArchivo } from './subir'

const NUEVO = { nombre: '', categoria: 'ropa', descripcion: '', precio: 0, opciones: '', stock: '', fecha: '', lugar: '', plazas: '', imagen_url: '', activo: true, orden: 0 }

export default function TiendaAdmin({ nuevo }) {
  const [vista, setVista] = useState('pedidos')
  const [productos, setProductos] = useState([])
  const [pedidos, setPedidos] = useState([])
  const [f, setF] = useState(nuevo ? { ...NUEVO } : null)
  const [abierto, setAbierto] = useState(null)
  const [error, setError] = useState('')

  const cargar = () => {
    supabase.from('productos').select('*').order('orden').then(({ data }) => setProductos(data || []))
    supabase.from('pedidos').select('*').order('creado_at', { ascending: false }).then(({ data }) => setPedidos(data || []))
  }
  useEffect(cargar, [])

  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })

  const guardar = async (e) => {
    e.preventDefault()
    setError('')
    const { id, creado_at, ...d } = f
    d.precio = Number(d.precio) || 0
    d.stock = d.stock === '' || d.stock == null ? null : Number(d.stock)
    d.plazas = d.plazas === '' || d.plazas == null ? null : Number(d.plazas)
    d.orden = Number(d.orden) || 0
    d.fecha = d.categoria === 'actividades' && d.fecha ? d.fecha : null
    const res = id
      ? await supabase.from('productos').update(d).eq('id', id)
      : await supabase.from('productos').insert({ ...d, slug: `${slugify(d.nombre)}-${Date.now().toString(36).slice(-4)}` })
    if (res.error) return setError(res.error.message)
    setF(null)
    cargar()
  }

  const borrar = async (p) => {
    if (!confirmar(`¿Eliminar "${p.nombre}"? Si solo quiere ocultarlo, desmarque "A la venta".`)) return
    await supabase.from('productos').delete().eq('id', p.id)
    cargar()
  }

  const estado = async (p, v) => {
    await supabase.from('pedidos').update({ estado: v }).eq('id', p.id)
    cargar()
  }

  const imagen = async (e) => {
    const file = e.target.files[0]
    if (file) setF({ ...f, imagen_url: await subirArchivo('imagenes', file) })
  }

  const pendientes = pedidos.filter((p) => p.estado === 'pendiente').length
  const porEnviar = pedidos.filter((p) => p.estado === 'pagado' && p.entrega === 'envio').length
  const ventas = pedidos.filter((p) => !['pendiente', 'cancelado'].includes(p.estado)).reduce((t, p) => t + Number(p.total), 0)

  return (
    <>
      <h1>Tienda</h1>
      <div className="cifras">
        <div className="cifra"><b>{pendientes}</b>Pedidos pendientes de pago</div>
        <div className="cifra"><b>{porEnviar}</b>Pagados por enviar</div>
        <div className="cifra"><b>{euros(Math.round(ventas * 100) / 100)}</b>Ventas cobradas</div>
        <div className="cifra"><b>{productos.filter((p) => p.activo).length}</b>Productos a la venta</div>
      </div>
      <div className="pestanas">
        <button className={vista === 'pedidos' ? 'activa' : ''} onClick={() => setVista('pedidos')}>Pedidos e inscripciones</button>
        <button className={vista === 'productos' ? 'activa' : ''} onClick={() => setVista('productos')}>Productos y actividades</button>
      </div>

      {vista === 'pedidos' ? (
        <div className="tabla-scroll">
          <table className="tabla">
            <thead><tr><th>Fecha</th><th>Referencia</th><th>Cliente</th><th>Total</th><th>Pago</th><th>Entrega</th><th>Estado</th><th></th></tr></thead>
            <tbody>
              {pedidos.map((p) => (
                <Fragment key={p.id}>
                  <tr>
                    <td>{fecha(p.creado_at)}</td>
                    <td><code>{p.referencia}</code></td>
                    <td>{p.nombre}</td>
                    <td>{euros(p.total)}</td>
                    <td>{p.metodo}</td>
                    <td>{{ envio: 'Envío', recogida: 'Recogida', no_aplica: '—' }[p.entrega]}</td>
                    <td>
                      <select value={p.estado} onChange={(e) => estado(p, e.target.value)}>
                        {Object.entries(ESTADOS_PEDIDO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    </td>
                    <td><button className="btn-texto" onClick={() => setAbierto(abierto === p.id ? null : p.id)}>{abierto === p.id ? 'Ocultar' : 'Ver'}</button></td>
                  </tr>
                  {abierto === p.id && (
                    <tr className="detalle">
                      <td colSpan={8}>
                        <ul>
                          {p.items.map((i) => (
                            <li key={i.k}>{i.cantidad} × {i.nombre}{i.opcion ? ` (talla ${i.opcion})` : ''} · {euros(i.precio * i.cantidad)}</li>
                          ))}
                        </ul>
                        <p>Email: <a href={`mailto:${p.email}`}>{p.email}</a>{p.direccion ? ` · Dirección: ${p.direccion}` : ''} · Envío: {euros(p.envio || 0)}</p>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
          {pedidos.length === 0 && <p className="vacio">Aún no hay pedidos.</p>}
        </div>
      ) : (
        <>
          <div className="acciones"><button className="btn" onClick={() => setF({ ...NUEVO })}>+ Nuevo producto o actividad</button></div>
          {f && (
            <form className="formulario tarjeta-form" onSubmit={guardar}>
              <h3>{f.id ? 'Editar' : 'Nuevo'}</h3>
              <div className="dos-col">
                <label>Nombre<input required value={f.nombre} onChange={set('nombre')} /></label>
                <label>
                  Categoría
                  <select value={f.categoria} onChange={set('categoria')}>
                    {Object.entries(CATEGORIAS_TIENDA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </label>
              </div>
              <label>Descripción<textarea rows={4} value={f.descripcion || ''} onChange={set('descripcion')} /></label>
              <div className="tres-col">
                <label>Precio (€, 0 = gratuito)<input type="number" min="0" step="0.01" value={f.precio} onChange={set('precio')} /></label>
                {f.categoria === 'actividades' ? (
                  <label>Plazas<input type="number" min="0" value={f.plazas ?? ''} onChange={set('plazas')} /></label>
                ) : (
                  <label>Stock (vacío = sin control)<input type="number" min="0" value={f.stock ?? ''} onChange={set('stock')} /></label>
                )}
                <label>Orden en la tienda<input type="number" value={f.orden} onChange={set('orden')} /></label>
              </div>
              {f.categoria === 'ropa' && (
                <label>Tallas (separadas por comas; vacío = talla única)<input value={f.opciones || ''} onChange={set('opciones')} placeholder="S,M,L,XL,XXL" /></label>
              )}
              {f.categoria === 'actividades' && (
                <div className="dos-col">
                  <label>Fecha<input type="date" value={(f.fecha || '').slice(0, 10)} onChange={set('fecha')} /></label>
                  <label>Lugar<input value={f.lugar || ''} onChange={set('lugar')} /></label>
                </div>
              )}
              {f.categoria !== 'actividades' && (
                <label>
                  Enlace de La Tostadora (opcional)
                  <input type="url" value={f.enlace_externo || ''} onChange={set('enlace_externo')} placeholder="https://www.latostadora.com/…" />
                  <small>Si el producto se vende en La Tostadora, pegue aquí el enlace a su página. El botón de compra llevará allí: La Tostadora cobra, fabrica y envía. Si lo deja vacío, se compra en esta web.</small>
                </label>
              )}
              <label>Imagen<input type="file" accept="image/*" onChange={imagen} />{f.imagen_url && <img src={f.imagen_url} alt="" className="miniatura" />}</label>
              <label className="check"><input type="checkbox" checked={f.activo} onChange={set('activo')} /><span>A la venta (visible en la tienda)</span></label>
              {error && <p className="error">{error}</p>}
              <div className="acciones">
                <button className="btn">Guardar</button>
                <button type="button" className="btn-texto" onClick={() => setF(null)}>Cancelar</button>
              </div>
            </form>
          )}
          <div className="tabla-scroll">
            <table className="tabla">
              <thead><tr><th>Producto</th><th>Categoría</th><th>Precio</th><th>Stock / plazas</th><th>A la venta</th><th></th></tr></thead>
              <tbody>
                {productos.map((p) => (
                  <tr key={p.id}>
                    <td>{p.nombre}{p.opciones ? <span className="mini"> · {p.opciones}</span> : ''}</td>
                    <td>{CATEGORIAS_TIENDA[p.categoria]}</td>
                    <td>{Number(p.precio) ? euros(p.precio) : 'Gratuito'}</td>
                    <td>{p.categoria === 'actividades' ? p.plazas ?? '—' : p.stock ?? '—'}</td>
                    <td>{p.activo ? 'Sí' : 'No'}</td>
                    <td className="acciones-fila">
                      <button className="btn-texto" onClick={() => setF({ ...NUEVO, ...p, imagen_url: p.imagen_url || '' })}>Editar</button>
                      <button className="btn-texto peligro" onClick={() => borrar(p)}>Eliminar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  )
}
