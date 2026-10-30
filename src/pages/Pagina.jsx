import { useEffect, useState } from 'react'
import { getPagina } from '../lib/data'
import { LEGALES } from '../lib/legales'
import Texto from '../components/Texto'
import Ideario from '../components/Ideario'
import { useSeo } from '../lib/seo'

// Páginas de texto editables desde el panel (Quiénes somos, legales, etc.)
export default function Pagina({ clave }) {
  const [p, setP] = useState(undefined)

  useEffect(() => {
    setP(undefined)
    getPagina(clave).then((d) => setP(d || LEGALES[clave] || { titulo: '', contenido: 'Contenido pendiente.' }))
  }, [clave])

  const legal = ['aviso-legal', 'privacidad', 'cookies', 'transparencia-ia', 'condiciones-de-venta'].includes(clave)
  useSeo({ titulo: p?.titulo || '', descripcion: p?.contenido, ruta: '/' + clave, noindex: false, jsonld: legal ? null : undefined })

  if (p === undefined) return <p className="contenedor vacio">Cargando…</p>
  return (
    <div className="contenedor estrecho bloque">
      <h1>{p.titulo}</h1>
      {clave === 'sobre-patriam' && <Ideario />}
      <Texto>{p.contenido}</Texto>
    </div>
  )
}
