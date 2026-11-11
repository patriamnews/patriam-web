// Recámara del boletín: artículos, noticias, libros y películas preparados que todavía no van a ningún número.
// Se sube con calma y, al preparar cada boletín, se elige lo que va con «Usar en el nº…».
// Los datos están en el servidor del boletín (aportar.php), igual que lo demás de «Boletín paso a paso».
import { useEffect, useState } from 'react'

const TIPOS = [
  ['', 'Todo'], ['firma', 'Artículos'], ['noticia', 'Noticias'], ['Libro', 'Libros'], ['Película', 'Películas'], ['Podcast', 'Podcasts y vídeos'], ['editorial', 'Editoriales'],
]
const etiqueta = (x) => x.tipo === 'firma' ? 'Artículo' : x.tipo === 'noticia' ? 'Noticia' : x.tipo === 'editorial' ? 'Editorial' : (x.datos.tipo || 'Recomendación')
const encaja = (x, t) => !t || x.tipo === t || (x.tipo === 'recomendacion' && (t === 'Podcast' ? /podcast|v[ií]deo|documental/i.test(x.datos.tipo || '') : new RegExp(t, 'i').test(x.datos.tipo || '')))
const titulo = (x) => x.datos.titulo || x.datos.titular || '(sin título)'
const dia = (f) => { try { return new Date(f).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) } catch { return '' } }

export default function Recamara({ api, abierto, onSubir, onUsado }) {
  const [d, setD] = useState(null)
  const [error, setError] = useState('')
  const [tipo, setTipo] = useState('')
  const [sec, setSec] = useState('')
  const cargar = () => api('recamara').then(setD).catch((x) => setError(x.message))
  useEffect(() => { cargar() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const usar = async (x) => {
    try { const j = await api('usar', { id: x.id }); onUsado(j, `«${titulo(x)}» está en el boletín nº ${abierto.numero}, esperando que alguien lo apruebe.`) } catch (e) { setError(e.message) }
  }
  const quitar = async (x) => {
    if (!window.confirm(`¿Quitar «${titulo(x)}» de la recámara?`)) return
    try { await api('quitar-recamara', { id: x.id }); cargar() } catch (e) { setError(e.message) }
  }

  if (error && !d) return <p className="error">No se ha podido abrir la recámara: {error}</p>
  if (!d) return <p>Cargando la recámara…</p>
  const secciones = [...new Set(d.items.map((x) => x.datos.seccion).filter(Boolean))]
  const vistos = d.items.filter((x) => encaja(x, tipo) && (!sec || x.datos.seccion === sec))
  const cuenta = (t) => d.items.filter((x) => encaja(x, t)).length

  return (
    <div className="bp rec">
      {error && <p className="error">{error}</p>}
      <section className="bp-caja">
        <span className="bp-num">R</span>
        <div>
          <h2>Recámara <small>({d.items.length})</small></h2>
          <p>Lo que está preparado y todavía no va en ningún boletín. Cuando prepares un número, elige aquí lo que entra.
            {abierto ? <> Ahora está abierto el <b>nº {abierto.numero}</b>.</> : <> Para usar algo, primero abre el boletín en «Este boletín».</>}</p>
          <button type="button" className="btn" onClick={onSubir}>+ Subir algo a la recámara</button>
          <div className="bp-opciones rec-filtros">
            {TIPOS.map(([k, t]) => <button key={k} type="button" className={tipo === k ? 'activo' : ''} onClick={() => setTipo(k)}>{t} <small>{cuenta(k)}</small></button>)}
          </div>
          {secciones.length > 1 && (
            <div className="bp-opciones rec-filtros">
              <button type="button" className={!sec ? 'activo' : ''} onClick={() => setSec('')}>Todas las secciones</button>
              {secciones.map((s) => <button key={s} type="button" className={sec === s ? 'activo' : ''} onClick={() => setSec(s)}>{s}</button>)}
            </div>
          )}
          {!vistos.length ? <p className="bp-nota">{d.items.length ? 'No hay nada con ese filtro.' : 'La recámara está vacía. Sube artículos, libros o películas para tener reserva.'}</p> : (
            <ul className="bp-lista">
              {vistos.map((x) => (
                <li key={x.id}>
                  {x.datos.imagen ? <img src={x.datos.imagen} alt="" /> : <span className="bp-sinimg" />}
                  <div>
                    <small>{etiqueta(x)}{x.datos.seccion ? ' · ' + x.datos.seccion : ''} · {x.datos.autor || x.datos.comenta || x.datos.firma || x.autor} · subido el {dia(x.creado)}</small>
                    <b>{titulo(x)}</b>
                    {x.ya_en && <em className="bp-espera">Ya salió en el nº {x.ya_en}</em>}
                    {(x.datos.texto || x.datos.comentario || x.datos.resumen) && (
                      <details className="bp-leer"><summary>Leer</summary>
                        {(x.datos.entradilla) && <p><i>{x.datos.entradilla}</i></p>}
                        {String(x.datos.texto || x.datos.comentario || x.datos.resumen).split(/\n\s*\n/).map((b, i) => <p key={i}>{b.replace(/\*\*|\*/g, '').replace(/^##\s+/, '')}</p>)}
                      </details>
                    )}
                  </div>
                  <span className="bp-acc">
                    {abierto && <button type="button" className="btn" onClick={() => usar(x)}>Usar en el nº {abierto.numero}</button>}
                    <button type="button" className="btn-texto" onClick={() => quitar(x)}>Quitar</button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {d.programado?.length > 0 && (
        <section className="bp-caja">
          <span className="bp-num">→</span>
          <div>
            <h2>Ya preparado para los próximos números</h2>
            <ul className="bp-lista">
              {d.programado.map((x) => (
                <li key={x.id}>
                  {x.datos.imagen ? <img src={x.datos.imagen} alt="" /> : <span className="bp-sinimg" />}
                  <div><small>{etiqueta(x)} · {x.datos.autor || x.datos.comenta || ''}</small><b>{titulo(x)}</b><em className="bp-espera">Sale en el nº {x.numero}</em></div>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </div>
  )
}
