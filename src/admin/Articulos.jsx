import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { ESTADOS, SECCIONES } from '../lib/config'
import { fecha } from '../lib/data'

export default function Articulos({ soloRevision, base = '/gestion' }) {
  const { perfil } = useAuth()
  const [lista, setLista] = useState(null)
  const [filtro, setFiltro] = useState('')

  useEffect(() => {
    setLista(null)
    let q = supabase
      .from('articulos')
      .select('id, titulo, seccion, estado, firma, autor_id, actualizado_at, publicado_at, uso_ia')
      .order('actualizado_at', { ascending: false })
    if (soloRevision) q = q.eq('estado', 'revision')
    if (filtro) q = q.eq('estado', filtro)
    q.then(({ data }) => setLista(data || []))
  }, [soloRevision, filtro])

  return (
    <>
      <div className="titulo-bloque">
        <h1>{soloRevision ? 'Pendientes de revisión' : 'Artículos'}</h1>
        <Link to={`${base}/nuevo`} className="btn">+ Nuevo</Link>
      </div>
      {!soloRevision && (
        <div className="filtros">
          <select value={filtro} onChange={(e) => setFiltro(e.target.value)}>
            <option value="">Todos los estados</option>
            {Object.entries(ESTADOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
      )}
      {lista === null ? (
        <p>Cargando…</p>
      ) : lista.length === 0 ? (
        <p className="vacio">No hay artículos.</p>
      ) : (
        <div className="tabla-scroll">
          <table className="tabla">
            <thead>
              <tr><th>Título</th><th>Sección</th><th>Estado</th><th>Firma</th><th>Actualizado</th></tr>
            </thead>
            <tbody>
              {lista.map((a) => (
                <tr key={a.id}>
                  <td>
                    <Link to={`${base}/editar/${a.id}`}>{a.titulo}</Link>
                    {a.autor_id === perfil.id && <span className="mini"> (mío)</span>}
                    {a.uso_ia !== 'ninguno' && <span className="chip-ia">IA</span>}
                  </td>
                  <td>{SECCIONES[a.seccion]?.nombre}</td>
                  <td><span className={`estado estado-${a.estado}`}>{ESTADOS[a.estado]}</span></td>
                  <td>{a.firma}</td>
                  <td>{fecha(a.actualizado_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
