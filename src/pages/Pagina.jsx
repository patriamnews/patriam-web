import { useEffect, useState } from 'react'
import { getPagina } from '../lib/data'
import { LEGALES } from '../lib/legales'
import Texto from '../components/Texto'
import Ideario from '../components/Ideario'

// Páginas de texto editables desde el panel (Quiénes somos, legales, etc.)
export default function Pagina({ clave }) {
  const [p, setP] = useState(undefined)

  useEffect(() => {
    setP(undefined)
    getPagina(clave).then((d) => setP(d || LEGALES[clave] || { titulo: '', contenido: 'Contenido pendiente.' }))
  }, [clave])

  if (p === undefined) return <p className="contenedor vacio">Cargando…</p>
  return (
    <div className="contenedor estrecho bloque">
      <h1>{p.titulo}</h1>
      {clave === 'sobre-patriam' && <Ideario />}
      <Texto>{p.contenido}</Texto>
    </div>
  )
}
