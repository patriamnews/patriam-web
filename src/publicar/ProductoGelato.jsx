import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { slugify } from '../lib/data'
import { tokenEquipo } from '../lib/equipo'
import { useAuth } from '../lib/auth'
import { puedeAprobar } from '../lib/permissions'
import { subirArchivo } from '../admin/subir'

// Crear un producto de Gelato sin entrar en Gelato: se elige la plantilla (camiseta, sudadera, taza…),
// se sube el diseño, se pone nombre y precio, y queda creado en la tienda de Gelato y a la venta en la web.
async function gelato(cuerpo) {
  const r = await fetch('/api/gelato.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: tokenEquipo(), ...cuerpo }) })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(d.error === 'sesion' ? 'Por seguridad, vuelva a entrar en Publicar con su email y contraseña.' : d.error || 'No se ha podido conectar con el servidor.')
  return d
}
const espera = (ms) => new Promise((r) => setTimeout(r, ms))
// Nombre de cada talla/color para la web (sin comas ni «=», que separan las opciones)
const etiqueta = (v) => (v.opciones?.length ? v.opciones.map((o) => o.valor).join(' / ') : v.titulo || 'Única').replace(/[,=]/g, ' ').trim()

export default function ProductoGelato() {
  const { perfil } = useAuth()
  const [plantillas, setPlantillas] = useState([])
  const [nuevaId, setNuevaId] = useState('')
  const [nuevaNombre, setNuevaNombre] = useState('')
  const [pl, setPl] = useState(null) // plantilla leída
  const [elegidas, setElegidas] = useState({})
  const [f, setF] = useState({ titulo: '', descripcion: '', precio: '', categoria: 'ropa' })
  const [archivo, setArchivo] = useState('')
  const [paso, setPaso] = useState('')
  const [error, setError] = useState('')
  const [hecho, setHecho] = useState(null)

  useEffect(() => { gelato({ accion: 'plantillas' }).then((d) => setPlantillas(d.plantillas || [])).catch((e) => setError(e.message)) }, [])

  const leer = async (id, nombre) => {
    setError(''); setPaso('Leyendo la plantilla en Gelato…')
    try {
      const d = await gelato({ accion: 'plantilla', id: id.trim(), nombre })
      setPl(d); setPlantillas(d.plantillas || [])
      setElegidas(Object.fromEntries(d.variantes.map((v) => [v.id, true])))
      setF((x) => ({ ...x, titulo: x.titulo || d.titulo || '', descripcion: x.descripcion || (d.descripcion || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() }))
      setNuevaId(''); setNuevaNombre('')
    } catch (e) { setError(e.message) }
    setPaso('')
  }

  const olvidar = async (id) => {
    const d = await gelato({ accion: 'olvidarPlantilla', id }).catch((e) => setError(e.message))
    if (d) setPlantillas(d.plantillas || [])
  }

  const subir = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setError(''); setPaso('Subiendo el diseño…')
    try { setArchivo(await subirArchivo('imagenes', file)) } catch (err) { setError('No se ha podido subir el diseño: ' + (err.message || err)) }
    setPaso('')
  }

  const crear = async (e) => {
    e.preventDefault()
    setError('')
    const variantes = pl.variantes.filter((v) => elegidas[v.id])
    if (!variantes.length) return setError('Marque al menos una talla o color.')
    if (!archivo) return setError('Suba el archivo del diseño.')
    const precio = Number(String(f.precio).replace(',', '.'))
    if (!(precio > 0)) return setError('Ponga el precio de venta en la web.')
    try {
      setPaso('Preparando el producto…')
      const c = await gelato({ accion: 'crear', plantilla: pl.id, titulo: f.titulo, descripcion: f.descripcion, archivo, variantes })
      // Si hay tienda en Gelato, Gelato prepara allí las fotos de muestra en unos segundos
      let foto = c.preview || ''
      for (let i = 0; i < 8 && !foto && c.id; i++) {
        setPaso('Gelato está preparando las fotos de muestra…')
        await espera(4000)
        const d = await gelato({ accion: 'producto', id: c.id }).catch(() => null)
        foto = d?.preview || ''
      }
      setPaso('Poniéndolo a la venta en la web…')
      const unico = variantes.length === 1 && !variantes[0].opciones?.length
      const fila = {
        nombre: f.titulo.trim(),
        slug: `${slugify(f.titulo)}-${Date.now().toString(36).slice(-4)}`,
        categoria: f.categoria,
        descripcion: f.descripcion.trim(),
        precio,
        opciones: unico ? '' : variantes.map(etiqueta).join(', '),
        gelato_uids: unico ? variantes[0].uid : variantes.map((v) => `${etiqueta(v)}=${v.uid}`).join('\n'),
        gelato_archivo: archivo,
        imagen_url: foto || pl.preview || archivo,
        activo: true,
      }
      const { error: err } = await supabase.from('productos').insert(fila)
      if (err) throw new Error('Creado en Gelato, pero no se ha podido guardar en la web: ' + err.message)
      setHecho({ ...fila, gelatoId: c.id })
    } catch (err) { setError(err.message) }
    setPaso('')
  }

  if (hecho)
    return (
      <div className="formulario">
        <p className="aviso-ok">✓ «{hecho.nombre}» guardado en la tienda de la web.</p>
        {hecho.imagen_url && <img src={hecho.imagen_url} alt="" style={{ maxWidth: 260, borderRadius: 8 }} />}
        <p className="mini">
          {puedeAprobar(perfil) ? 'Ya está a la venta.' : 'Saldrá a la venta en cuanto lo apruebe Carlos (Pendiente de aprobar).'} Cuando alguien lo compre, se cobra con
          tarjeta y Gelato lo fabrica y lo envía solo, con vuestra etiqueta y embalaje.
        </p>
        <div className="acciones">
          <button className="btn" onClick={() => { setHecho(null); setArchivo(''); setF({ titulo: '', descripcion: '', precio: '', categoria: f.categoria }) }}>Crear otro con esta plantilla</button>
          <Link className="btn btn-claro" to="/publicar">Volver al inicio</Link>
        </div>
      </div>
    )

  return (
    <div className="formulario">
      <fieldset className="grupo">
        <legend>1. Qué artículo es</legend>
        {plantillas.length > 0 && (
          <div className="docs-firma">
            {plantillas.map((t) => (
              <div key={t.id} className={`doc-firma ${pl?.id === t.id ? 'aceptado' : ''}`}>
                <button type="button" className="doc-firma-cab" onClick={() => leer(t.id)}>
                  <span>{pl?.id === t.id ? '✓ ' : ''}{t.nombre}</span>
                  <span className="mini">{pl?.id === t.id ? 'Elegida' : 'Elegir'}</span>
                </button>
                <button type="button" className="btn-texto mini" onClick={() => olvidar(t.id)}>Quitar de la lista</button>
              </div>
            ))}
          </div>
        )}
        <details open={!plantillas.length}>
          <summary>Añadir una plantilla de Gelato</summary>
          <p className="letra-pequena">
            Una plantilla es el artículo base (por ejemplo, «camiseta blanca con el diseño en el pecho»). Se hace una sola vez en Gelato › Templates y sirve para
            todos los diseños que se quieran poner después. Copie aquí su identificador (Template ID).
          </p>
          <label>Nombre para reconocerla<input value={nuevaNombre} onChange={(e) => setNuevaNombre(e.target.value)} placeholder="Camiseta blanca" /></label>
          <label>Identificador de la plantilla (Template ID)<input value={nuevaId} onChange={(e) => setNuevaId(e.target.value)} placeholder="c12a363e-0d4e-4d96-be4b-bf4138eb8743" spellCheck={false} /></label>
          <button type="button" className="btn btn-claro" disabled={!nuevaId.trim()} onClick={() => leer(nuevaId, nuevaNombre)}>Leer plantilla</button>
        </details>
      </fieldset>

      {pl && (
        <form onSubmit={crear}>
          <fieldset className="grupo">
            <legend>2. Tallas y colores que se venden</legend>
            {pl.preview && <img src={pl.preview} alt="" style={{ maxWidth: 160, borderRadius: 8 }} />}
            {pl.variantes.map((v) => (
              <label key={v.id} className="check">
                <input type="checkbox" checked={!!elegidas[v.id]} onChange={(e) => setElegidas({ ...elegidas, [v.id]: e.target.checked })} />
                <span>{etiqueta(v)}</span>
              </label>
            ))}
          </fieldset>

          <fieldset className="grupo">
            <legend>3. El diseño</legend>
            <p className="letra-pequena">Archivo PNG con fondo transparente, a buena resolución (por ejemplo 4500 × 5400 píxeles para una camiseta). Se coloca donde indica la plantilla.</p>
            <input type="file" accept="image/png,image/jpeg" onChange={subir} />
            {archivo && <img src={archivo} alt="Diseño" style={{ maxWidth: 160, background: '#eee', borderRadius: 8, marginTop: 8 }} />}
          </fieldset>

          <fieldset className="grupo">
            <legend>4. Cómo sale en la tienda</legend>
            <label>Nombre del producto<input required value={f.titulo} onChange={(e) => setF({ ...f, titulo: e.target.value })} placeholder="Camiseta Dios, Patria, Justicia" /></label>
            <label>Descripción<textarea rows={3} value={f.descripcion} onChange={(e) => setF({ ...f, descripcion: e.target.value })} /></label>
            <label>Precio de venta en la web (€, IVA incluido)<input required inputMode="decimal" value={f.precio} onChange={(e) => setF({ ...f, precio: e.target.value })} placeholder="25" /></label>
            <p className="letra-pequena">El precio tiene que cubrir lo que cobra Gelato por fabricarlo y enviarlo; si no lo cubre, el pedido no se manda y os llega un aviso.</p>
            <label>
              Sección de la tienda
              <select value={f.categoria} onChange={(e) => setF({ ...f, categoria: e.target.value })}>
                <option value="ropa">Ropa</option>
                <option value="regalos">Regalos (tazas, bolsas…)</option>
              </select>
            </label>
          </fieldset>
          {error && <p className="error">{error}</p>}
          <div className="acciones">
            <button className="btn" disabled={!!paso}>{paso || 'Crear el producto'}</button>
          </div>
        </form>
      )}
      {!pl && paso && <p className="vacio">{paso}</p>}
      {!pl && error && <p className="error">{error}</p>}
    </div>
  )
}
