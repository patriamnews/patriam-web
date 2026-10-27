import { createContext, useContext, useEffect, useState } from 'react'

// Carrito de la tienda. Se recuerda en este navegador (si el navegador lo permite).
const Ctx = createContext(null)
const CLAVE = 'patriam-carrito'

const leer = () => {
  try {
    return JSON.parse(localStorage.getItem(CLAVE)) || []
  } catch {
    return []
  }
}

// Suplemento por talla (p. ej. {"XXL": 2.5}): el precio sube solo en esa talla
export const suplemento = (p, opcion) => {
  const partes = String(opcion || '').split(' / ')
  const talla = partes.pop()
  const corte = partes[0]?.includes(' · ') ? partes[0].split(' · ')[0] : ''
  return (Number(p?.suplementos?.[talla]) || 0) + (corte ? Number(p?.suplementos?.[corte]) || 0 : 0)
}
// Envío de Gelato: la tarifa de «primera prenda» más alta del pedido y, por cada prenda más, su tarifa de «prenda adicional».
// Cada producto puede tener su propia tarifa (las sudaderas vienen de Italia); si no, se usa la de Ajustes.
export function calcularEnvio(items, aj) {
  const unidades = []
  for (const i of items) if (i.gelato) for (let n = 0; n < i.cantidad; n++)
    unidades.push([Number(i.envio1 ?? aj?.envio_coste) || 0, Number(i.envio2 ?? aj?.envio_adicional) || 0])
  if (!unidades.length) return 0
  unidades.sort((a, b) => b[0] - a[0])
  const total = unidades[0][0] + unidades.slice(1).reduce((t, u) => t + u[1], 0)
  return Math.round(total * 100) / 100
}
export const precioCon = (p, opcion) => Math.round((Number(p.precio) + suplemento(p, opcion)) * 100) / 100

export function CarritoProvider({ children }) {
  const [items, setItems] = useState(leer)

  useEffect(() => {
    try {
      localStorage.setItem(CLAVE, JSON.stringify(items))
    } catch {
      /* sin almacenamiento */
    }
  }, [items])

  const clave = (p, opcion) => `${p.id}|${opcion || ''}`

  // Productos de Gelato: código de producto (cambia con la talla) y archivo del diseño
  const datosGelato = (p, opcion) => {
    // Cada código puede ir con «#variante» si el producto se hizo en la tienda de Gelato (allí ya está el diseño)
    if (!p.gelato_uids) return null
    const lineas = String(p.gelato_uids).split('\n').map((l) => l.trim()).filter(Boolean)
    const conTalla = lineas.map((l) => l.split('=')).find(([t]) => opcion && t.trim().toLowerCase() === String(opcion).toLowerCase())
    const uid = conTalla ? conTalla.slice(1).join('=').trim() : lineas.length === 1 && !lineas[0].includes('=') ? lineas[0] : ''
    if (!uid) return null
    // «código#variante» (producto de la tienda de Gelato) o «código@archivo» (diseño propio de esa talla/color)
    const [conVariante, archivoPropio] = uid.split('@')
    const [codigo, variante] = conVariante.split('#')
    return { uid: codigo.trim(), variante: variante?.trim() || null, archivo: archivoPropio?.trim() || p.gelato_archivo || null }
  }

  const anadir = (p, opcion, cantidad = 1) =>
    setItems((l) => {
      const k = clave(p, opcion)
      const ya = l.find((i) => i.k === k)
      if (ya) return l.map((i) => (i.k === k ? { ...i, cantidad: i.cantidad + cantidad } : i))
      return [...l, { k, id: p.id, nombre: p.nombre, categoria: p.categoria, precio: precioCon(p, opcion), opcion: opcion || null, cantidad, fecha: p.fecha || null, gelato: datosGelato(p, opcion), envio1: p.envio_primera ?? null, envio2: p.envio_extra ?? null }]
    })

  const cambiar = (k, cantidad) =>
    setItems((l) => (cantidad <= 0 ? l.filter((i) => i.k !== k) : l.map((i) => (i.k === k ? { ...i, cantidad } : i))))

  const vaciar = () => setItems([])
  const unidades = items.reduce((t, i) => t + i.cantidad, 0)
  const subtotal = items.reduce((t, i) => t + i.precio * i.cantidad, 0)
  const conEnvio = items.some((i) => i.categoria !== 'actividades')

  return <Ctx.Provider value={{ items, anadir, cambiar, vaciar, unidades, subtotal, conEnvio }}>{children}</Ctx.Provider>
}

export const useCarrito = () => useContext(Ctx)
