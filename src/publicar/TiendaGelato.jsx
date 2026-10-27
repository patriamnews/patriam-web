import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { slugify } from '../lib/data'
import { tokenEquipo } from '../lib/equipo'

// Los productos que se van haciendo en la tienda de Gelato (en su web) salen aquí solos:
// basta con ponerles el precio de venta y pulsar «Poner a la venta» para que estén en la tienda de PATRIAM.
async function gelato(cuerpo) {
  const r = await fetch('/api/gelato.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: tokenEquipo(), ...cuerpo }) })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(d.error === 'sesion' ? 'Por seguridad, vuelva a entrar en Publicar con su email y contraseña.' : d.error || 'No se ha podido conectar con el servidor.')
  return d
}
const limpio = (t) => String(t || 'Única').replace(/[,=#]/g, ' ').replace(/\s+/g, ' ').trim()
// Del título de la variante («Camiseta - M - Blanco») se queda lo que cambia entre variantes
function etiquetas(vs) {
  const partes = vs.map((v) => limpio(v.titulo).split(/\s[-–|/]\s/))
  const comun = partes[0].filter((p, i) => partes.every((x) => x[i] === p))
  return partes.map((x) => limpio(x.filter((p) => !comun.includes(p)).join(' / ') || x.join(' / ')))
}

export default function TiendaGelato() {
  const [lista, setLista] = useState(null)
  const [sinTienda, setSinTienda] = useState(false)
  const [enWeb, setEnWeb] = useState({})
  const [datos, setDatos] = useState({})
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')
  const [enviando, setEnviando] = useState('')

  const cargar = async () => {
    setError('')
    try {
      const [{ productos, sinTienda: st }, { data }] = await Promise.all([gelato({ accion: 'tienda' }), supabase.from('productos').select('id, gelato_producto, precio, activo, aprobada').not('gelato_producto', 'is', null)])
      setLista(productos || []); setSinTienda(!!st)
      setEnWeb(Object.fromEntries((data || []).map((p) => [p.gelato_producto, p])))
    } catch (e) { setError(e.message); setLista([]) }
  }
  useEffect(() => { cargar() }, [])

  const set = (id, k, v) => setDatos({ ...datos, [id]: { categoria: 'ropa', ...(datos[id] || {}), [k]: v } })

  const poner = async (p) => {
    setError(''); setMsg('')
    const d = { categoria: 'ropa', ...(datos[p.id] || {}) }
    const precio = Number(String(d.precio || '').replace(',', '.'))
    if (!(precio > 0)) return setError(`Ponga el precio de venta de «${p.titulo}».`)
    if (!p.variantes.length) return setError(`Gelato todavía no ha terminado de preparar «${p.titulo}». Pruebe en un minuto.`)
    setEnviando(p.id)
    const et = etiquetas(p.variantes)
    const unico = p.variantes.length === 1
    const fila = {
      nombre: p.titulo,
      slug: `${slugify(p.titulo)}-${Date.now().toString(36).slice(-4)}`,
      categoria: d.categoria,
      descripcion: p.descripcion,
      precio,
      opciones: unico ? '' : et.join(', '),
      gelato_uids: unico ? `${p.variantes[0].uid}#${p.variantes[0].id}` : p.variantes.map((v, i) => `${et[i]}=${v.uid}#${v.id}`).join('\n'),
      gelato_producto: p.id,
      imagen_url: p.foto || null,
      activo: true,
    }
    const { error: err } = await supabase.from('productos').insert(fila)
    setEnviando('')
    if (err) return setError(err.message)
    setMsg(`«${p.titulo}» puesto a la venta.`)
    cargar()
  }

  if (!lista) return <p className="vacio">Mirando la tienda de Gelato…</p>
  if (sinTienda)
    return (
      <div className="formulario">
        <p>
          Vuestra cuenta de Gelato no tiene ninguna tienda conectada, y no hace falta: la tienda es la web de PATRIAM. Gelato solo fabrica y envía.
        </p>
        <p>
          Los productos se crean en <Link to="/publicar/gelato">Camiseta, taza… con Gelato</Link>: se elige la plantilla hecha en Gelato, se sube el diseño, se pone el precio
          y sale a la venta en la web.
        </p>
      </div>
    )
  const nuevos = lista.filter((p) => !enWeb[p.id])
  const ya = lista.filter((p) => enWeb[p.id])
  return (
    <div className="formulario">
      {msg && <p className="aviso-ok">{msg}</p>}
      {error && <p className="error">{error}</p>}
      <div className="acciones"><button type="button" className="btn btn-claro" onClick={cargar}>Volver a mirar en Gelato</button></div>
      <h3>Nuevos en Gelato ({nuevos.length})</h3>
      {!nuevos.length && <p className="vacio">No hay productos nuevos. Los que haga en Gelato aparecerán aquí.</p>}
      {nuevos.map((p) => (
        <fieldset key={p.id} className="grupo">
          <legend>{p.titulo}</legend>
          {p.foto && <img src={p.foto} alt="" style={{ maxWidth: 180, borderRadius: 8 }} />}
          <p className="mini">{p.variantes.length ? etiquetas(p.variantes).join(' · ') : 'Gelato lo está preparando…'}</p>
          <label>Precio de venta en la web (€, IVA incluido)<input inputMode="decimal" value={datos[p.id]?.precio || ''} onChange={(e) => set(p.id, 'precio', e.target.value)} placeholder="25" /></label>
          <label>
            Sección de la tienda
            <select value={datos[p.id]?.categoria || 'ropa'} onChange={(e) => set(p.id, 'categoria', e.target.value)}>
              <option value="ropa">Ropa</option>
              <option value="regalos">Regalos (tazas, bolsas…)</option>
            </select>
          </label>
          <button type="button" className="btn" disabled={enviando === p.id} onClick={() => poner(p)}>{enviando === p.id ? 'Guardando…' : 'Poner a la venta'}</button>
        </fieldset>
      ))}
      {ya.length > 0 && (
        <>
          <h3>Ya en la web ({ya.length})</h3>
          {ya.map((p) => (
            <p key={p.id} className="mini">✓ {p.titulo} · {Number(enWeb[p.id].precio).toFixed(2)} € {enWeb[p.id].aprobada ? '' : '· pendiente de aprobar por Carlos'}</p>
          ))}
          <p className="letra-pequena">Para cambiar el precio o quitarlo de la venta: Publicar › Producto de la tienda.</p>
        </>
      )}
    </div>
  )
}
