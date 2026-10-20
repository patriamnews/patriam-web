import { useEffect, useState } from 'react'
import { listarSedes } from '../lib/data'
import MapaEspana from './MapaEspana'

// Sedes de la asociación. Se gestionan en el panel: Gestión › Sedes.
export default function Sedes() {
  const [sedes, setSedes] = useState([])
  const [activa, setActiva] = useState(null)

  useEffect(() => {
    listarSedes().then(setSedes)
  }, [])

  if (!sedes.length) return null

  return (
    <section className="bloque sedes" id="sedes">
      <h2>Nuestras sedes</h2>
      <div className="sedes-in">
        <MapaEspana puntos={sedes} activa={activa} setActiva={setActiva} etiqueta="Mapa de España con las sedes de PATRIAM" />
        <ul className="lista-sedes">
          {sedes.map((s) => (
            <li key={s.id} className={activa === s.ciudad ? 'on' : ''} onMouseEnter={() => setActiva(s.ciudad)} onMouseLeave={() => setActiva(null)}>
              <strong>{s.ciudad}</strong>
              <span className="sede-datos">
                {s.direccion && <span>{s.direccion}</span>}
                {s.telefono && <a href={`tel:${s.telefono.replace(/\s/g, '')}`}>{s.telefono}</a>}
                <a href={`mailto:${s.email}`}>{s.email}</a>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
