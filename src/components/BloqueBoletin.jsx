import { useEffect, useState } from 'react'
import { cargarBoletin } from '../lib/boletin'

const fechaLarga = (f) => (f ? new Date(f + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }) : '')

// Bloque de la portada: el boletín de esta semana. Todo se abre en una pestaña nueva y la web sigue abierta.
export default function BloqueBoletin({ base }) {
  const [b, setB] = useState(undefined)
  useEffect(() => {
    let vivo = true
    cargarBoletin(base).then((x) => vivo && setB(x))
    return () => {
      vivo = false
    }
  }, [base])

  const abrir = { target: '_blank', rel: 'noopener noreferrer' }
  return (
    <section className="bloque-boletin">
      <div className="contenedor boletin-in">
        <div className="boletin-texto">
          <span className="etiqueta">Boletín semanal{b?.numero ? ` · nº ${b.numero}` : ''}{b?.fecha ? ` · ${fechaLarga(b.fecha)}` : ''}</span>
          <h2>{b?.cabecera || 'Lo que hay que saber'}<em>, {b?.claim || 'con criterio'}</em></h2>
          {b?.editorial ? (
            <>
              <p className="boletin-editorial"><b>Editorial:</b> {b.editorial.titulo}{b.editorial.firma ? <span> · {b.editorial.firma}</span> : null}</p>
              {b.noticias.length > 0 && (
                <ul className="boletin-titulares">
                  {b.noticias.map((n, i) => (
                    <li key={i}><span>{n.seccion}</span>{n.titular}</li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <p className="boletin-editorial">La editorial de PATRIAM y las noticias de la semana, con resumen y comentario propio.</p>
          )}
          <div className="botones">
            <a className="btn" href={base} {...abrir}>Leer el boletín ↗</a>
            <a className="btn btn-claro" href={`${base}#/suscribirse`} {...abrir}>Suscríbete</a>
          </div>
          <small>Se abre en una pestaña nueva; la web de PATRIAM sigue abierta.</small>
        </div>
        {(b?.tarjeta || b?.editorial?.imagen) && (
          <a className="boletin-img" href={base} {...abrir} tabIndex={-1}>
            <img src={b.tarjeta || b.editorial.imagen} alt={`Boletín Nº ${b.numero || ""}`} loading="lazy" />
          </a>
        )}
      </div>
    </section>
  )
}
