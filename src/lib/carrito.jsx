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

  const anadir = (p, opcion, cantidad = 1) =>
    setItems((l) => {
      const k = clave(p, opcion)
      const ya = l.find((i) => i.k === k)
      if (ya) return l.map((i) => (i.k === k ? { ...i, cantidad: i.cantidad + cantidad } : i))
      return [...l, { k, id: p.id, nombre: p.nombre, categoria: p.categoria, precio: Number(p.precio), opcion: opcion || null, cantidad, fecha: p.fecha || null }]
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
