// Archivo del boletín: todo lo ya publicado, ordenado por sección o por tema, con un buscador.
// «Recuperar» lo copia a la recámara (marcado con el número en que salió) para volver a usarlo.
import { useEffect, useState } from 'react'

const TIPO = { firma: 'Artículo', noticia: 'Noticia', editorial: 'Editorial', recomendacion: 'Recomendación' }
const sinTildes = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export default function ArchivoBoletin({ api }) {
  const [d, setD] = useState(null)
  const [error, setError] = useState('')
  const [por, setPor] = useState('seccion')
  const [q, setQ] = useState('')
  const [hecho, setHecho] = useState({})
  useEffect(() => { api('archivo').then(setD).catch((x) => setError(x.message)) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const recuperar = async (x) => {
    try { await api('a-recamara', { id: x.id, pieza: x.pieza }); setHecho((h) => ({ ...h, [x.id]: true })) } catch (e) { setError(e.message) }
  }

  if (error && !d) return <p className="error">No se ha podido abrir el archivo: {error}</p>
  if (!d) return <p>Cargando el archivo…</p>
  const b = sinTildes(q.trim())
  const lista = d.items.filter((x) => !b || sinTildes([x.titulo, x.firma, x.seccion, x.tema].join(' ')).includes(b))
  const clave = (x) => (por === 'seccion' ? (x.tipo === 'recomendacion' ? 'Recomendaciones' : x.seccion) : x.tema) || 'Sin ' + (por === 'seccion' ? 'sección' : 'tema')
  const grupos = {}
  lista.forEach((x) => { (grupos[clave(x)] = grupos[clave(x)] || []).push(x) })

  return (
    <div className="bp arch">
      {error && <p className="error">{error}</p>}
      <section className="bp-caja">
        <span className="bp-num">A</span>
        <div>
          <h2>Archivo por temas <small>({d.items.length})</small></h2>
          <p>Todo lo que ya ha salido en el boletín. Si quieres volver a usar algo, pulsa «Recuperar»: pasa a la recámara marcado con el número en que salió, para que no se repita sin querer.</p>
          <input type="search" className="arch-buscar" placeholder="Buscar por título, firma o palabra…" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="bp-opciones rec-filtros">
            <button type="button" className={por === 'seccion' ? 'activo' : ''} onClick={() => setPor('seccion')}>Por sección</button>
            <button type="button" className={por === 'tema' ? 'activo' : ''} onClick={() => setPor('tema')}>Por tema</button>
          </div>
          {!lista.length && <p className="bp-nota">No hay nada con eso.</p>}
          {Object.keys(grupos).sort((a, b) => a.localeCompare(b, 'es')).map((g) => (
            <details key={g} className="arch-grupo" open={!!b || Object.keys(grupos).length < 4}>
              <summary><b>{g}</b> <small>{grupos[g].length}</small></summary>
              <ul className="bp-lista">
                {grupos[g].map((x) => (
                  <li key={x.id}>
                    {x.imagen ? <img src={x.imagen} alt="" /> : <span className="bp-sinimg" />}
                    <div><small>{TIPO[x.tipo] || x.tipo}{x.firma ? ' · ' + x.firma : ''} · nº {x.numero}</small><b>{x.titulo}</b></div>
                    <span className="bp-acc">
                      {hecho[x.id] ? <em className="bp-espera">✓ En la recámara</em> : <button type="button" className="btn btn-sec" onClick={() => recuperar(x)}>Recuperar</button>}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          ))}
        </div>
      </section>
    </div>
  )
}
