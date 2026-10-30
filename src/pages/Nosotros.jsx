import { useEffect, useState } from 'react'
import { getPagina, listarCargos, listarDocumentos, fecha } from '../lib/data'
import { CATEGORIAS_DOC } from '../lib/config'
import Texto from '../components/Texto'
import { useSeo } from '../lib/seo'

export default function Nosotros() {
  const [intro, setIntro] = useState(null)
  const [cargos, setCargos] = useState([])
  const [docs, setDocs] = useState([])
  useSeo({ titulo: 'Nosotros', descripcion: 'Quiénes somos en PATRIAM: junta directiva, estatutos, ideario y transparencia de la asociación.', ruta: '/nosotros' })

  useEffect(() => {
    getPagina('nosotros').then(setIntro)
    listarCargos().then(setCargos)
    listarDocumentos().then(setDocs)
  }, [])

  const porCategoria = Object.keys(CATEGORIAS_DOC)
    .map((c) => [c, docs.filter((d) => d.categoria === c)])
    .filter(([, l]) => l.length)

  return (
    <div className="contenedor bloque">
      <h1>{intro?.titulo || 'Nosotros'}</h1>
      {intro?.contenido && <Texto>{intro.contenido}</Texto>}

      <section className="bloque" id="junta">
        <h2>Junta directiva</h2>
        {cargos.length ? (
          <div className="cargos">
            {cargos.map((c) => (
              <div key={c.id} className="cargo">
                {c.foto_url ? <img src={c.foto_url} alt={`Ilustración de ${c.nombre.replace(/\s*\[.*\]/, '')}`} /> : <div className="cargo-inicial">{/^\[/.test(c.nombre) ? <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden><path d="M12 12a4 4 0 100-8 4 4 0 000 8zM4 21a8 8 0 0116 0" /></svg> : c.nombre[0]}</div>}
                <div>
                  <strong>{c.nombre.split(/(\[[^\]]+\])/).map((t, i) => (/^\[/.test(t) ? <mark key={i} className="hueco">{t}</mark> : t))}</strong>
                  <span>{c.cargo}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="vacio">Pendiente de publicar.</p>
        )}
      </section>

      <section className="bloque" id="transparencia">
        <h2>Transparencia y documentos</h2>
        {porCategoria.length ? (
          porCategoria.map(([c, lista]) => (
            <div key={c} className="grupo-docs">
              <h3>{CATEGORIAS_DOC[c]}</h3>
              <ul className="docs">
                {lista.map((d) => (
                  <li key={d.id}>
                    {d.archivo_url && d.archivo_url !== '#' ? (
                      <a href={d.archivo_url} target="_blank" rel="noopener noreferrer">{d.titulo}</a>
                    ) : (
                      <span className="doc-pendiente">{d.titulo} <em>(pendiente de subir)</em></span>
                    )}
                    {d.fecha && <span>{fecha(d.fecha)}</span>}
                  </li>
                ))}
              </ul>
            </div>
          ))
        ) : (
          <p className="vacio">Pendiente de publicar.</p>
        )}
      </section>
    </div>
  )
}
