import { confirmar } from '../lib/confirmar'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { ESTADOS_POST, REDES, USO_IA } from '../lib/config'
import { fecha } from '../lib/data'

const hoy = () => new Date().toISOString().slice(0, 10)
const NUEVO = {
  red: 'x', estado: 'idea', fecha: hoy(), texto: '', enlace: '', articulo_id: '', uso_ia: 'ninguno', imagen_ia: false,
  me_gusta: 0, comentarios: 0, compartidos: 0, visualizaciones: 0, notas: '',
}
const METRICAS = { me_gusta: 'Me gusta', comentarios: 'Comentarios', compartidos: 'Compartidos', visualizaciones: 'Visualizaciones' }

export default function Redes() {
  const [lista, setLista] = useState([])
  const [articulos, setArticulos] = useState([])
  const [equipo, setEquipo] = useState({})
  const [f, setF] = useState(null)
  const [filtro, setFiltro] = useState({ red: '', estado: '', mes: '' })
  const [error, setError] = useState('')

  const cargar = () => {
    let q = supabase.from('redes_posts').select('*').order('fecha', { ascending: false })
    if (filtro.red) q = q.eq('red', filtro.red)
    if (filtro.estado) q = q.eq('estado', filtro.estado)
    if (filtro.mes) {
      const [y, m] = filtro.mes.split('-').map(Number)
      const fin = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10)
      q = q.gte('fecha', `${filtro.mes}-01`).lt('fecha', fin)
    }
    q.then(({ data }) => setLista(data || []))
  }

  useEffect(cargar, [filtro])
  useEffect(() => {
    supabase.from('articulos').select('id, titulo').eq('estado', 'publicado').order('publicado_at', { ascending: false }).limit(100)
      .then(({ data }) => setArticulos(data || []))
    supabase.from('perfiles').select('id, nombre, email').then(({ data }) =>
      setEquipo(Object.fromEntries((data || []).map((p) => [p.id, p.nombre || p.email]))))
  }, [])

  const resumen = useMemo(() => {
    const r = {}
    lista.filter((p) => p.estado === 'publicado').forEach((p) => {
      r[p.red] ??= { posts: 0, me_gusta: 0, comentarios: 0, compartidos: 0, visualizaciones: 0 }
      r[p.red].posts++
      Object.keys(METRICAS).forEach((k) => (r[p.red][k] += p[k] || 0))
    })
    return r
  }, [lista])

  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })

  const guardar = async (e) => {
    e.preventDefault()
    setError('')
    const { id, creado_at, responsable_id, ...datos } = f
    datos.articulo_id = datos.articulo_id || null
    datos.actualizado_at = new Date().toISOString()
    Object.keys(METRICAS).forEach((k) => (datos[k] = Number(datos[k]) || 0))
    const res = id
      ? await supabase.from('redes_posts').update(datos).eq('id', id)
      : await supabase.from('redes_posts').insert(datos)
    if (res.error) return setError(res.error.message)
    setF(null)
    cargar()
  }

  const borrar = async (id) => {
    if (!confirmar('¿Eliminar este registro?')) return
    await supabase.from('redes_posts').delete().eq('id', id)
    cargar()
  }

  const exportar = () => {
    const cols = ['fecha', 'red', 'estado', 'texto', 'enlace', ...Object.keys(METRICAS), 'uso_ia', 'imagen_ia']
    const csv = [cols.join(';'), ...lista.map((p) => cols.map((c) => `"${String(p[c] ?? '').replace(/"/g, '""')}"`).join(';'))].join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }))
    a.download = `redes-${filtro.mes || 'todo'}.csv`
    a.click()
  }

  return (
    <>
      <div className="titulo-bloque">
        <h1>Redes sociales</h1>
        <div className="acciones">
          <button className="btn btn-claro" onClick={exportar}>Exportar a Excel (CSV)</button>
          <button className="btn" onClick={() => setF({ ...NUEVO })}>+ Nuevo post</button>
        </div>
      </div>

      <div className="filtros">
        <input type="month" value={filtro.mes} onChange={(e) => setFiltro({ ...filtro, mes: e.target.value })} />
        <select value={filtro.red} onChange={(e) => setFiltro({ ...filtro, red: e.target.value })}>
          <option value="">Todas las redes</option>
          {Object.entries(REDES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={filtro.estado} onChange={(e) => setFiltro({ ...filtro, estado: e.target.value })}>
          <option value="">Todos los estados</option>
          {Object.entries(ESTADOS_POST).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        {filtro.mes && <button className="btn-texto" onClick={() => setFiltro({ ...filtro, mes: '' })}>Todos los meses</button>}
      </div>

      {Object.keys(resumen).length > 0 && (
        <div className="cifras">
          {Object.entries(resumen).map(([red, r]) => (
            <div key={red} className="cifra">
              <b>{r.posts}</b>
              {REDES[red]}
              <small>{r.me_gusta} me gusta · {r.compartidos} compartidos · {r.visualizaciones} vistas</small>
            </div>
          ))}
        </div>
      )}

      {f && (
        <form className="formulario tarjeta-form" onSubmit={guardar}>
          <h3>{f.id ? 'Editar post' : 'Nuevo post'}</h3>
          <div className="tres-col">
            <label>Red<select value={f.red} onChange={set('red')}>{Object.entries(REDES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
            <label>Estado<select value={f.estado} onChange={set('estado')}>{Object.entries(ESTADOS_POST).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
            <label>Fecha<input type="date" value={f.fecha} onChange={set('fecha')} /></label>
          </div>
          <label>Texto del post<textarea rows={4} value={f.texto || ''} onChange={set('texto')} /></label>
          <div className="dos-col">
            <label>Enlace al post publicado<input type="url" value={f.enlace || ''} onChange={set('enlace')} placeholder="https://" /></label>
            <label>
              Artículo de la web que difunde (opcional)
              <select value={f.articulo_id || ''} onChange={set('articulo_id')}>
                <option value="">—</option>
                {articulos.map((a) => <option key={a.id} value={a.id}>{a.titulo}</option>)}
              </select>
            </label>
          </div>
          {f.estado === 'publicado' && (
            <div className="cuatro-col">
              {Object.entries(METRICAS).map(([k, v]) => (
                <label key={k}>{v}<input type="number" min="0" value={f[k]} onChange={set(k)} /></label>
              ))}
            </div>
          )}
          <div className="caja-ia">
            <label>
              Uso de IA en el texto
              <select value={f.uso_ia} onChange={set('uso_ia')}>{Object.entries(USO_IA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
            </label>
            <label className="check"><input type="checkbox" checked={f.imagen_ia} onChange={set('imagen_ia')} /><span>Imagen o vídeo generado/modificado con IA (márquelo también en la red: "Contenido generado con IA")</span></label>
          </div>
          <label>Notas internas<textarea rows={2} value={f.notas || ''} onChange={set('notas')} /></label>
          {error && <p className="error">{error}</p>}
          <div className="acciones">
            <button className="btn">Guardar</button>
            <button type="button" className="btn-texto" onClick={() => setF(null)}>Cancelar</button>
          </div>
        </form>
      )}

      {lista.length === 0 ? (
        <p className="vacio">No hay posts en este periodo.</p>
      ) : (
        <div className="tabla-scroll">
          <table className="tabla">
            <thead>
              <tr><th>Fecha</th><th>Red</th><th>Texto</th><th>Estado</th><th>Me gusta</th><th>Compart.</th><th>Vistas</th><th>Responsable</th><th></th></tr>
            </thead>
            <tbody>
              {lista.map((p) => (
                <tr key={p.id}>
                  <td>{fecha(p.fecha)}</td>
                  <td>{REDES[p.red] || p.red}</td>
                  <td className="celda-texto">
                    {p.enlace ? <a href={p.enlace} target="_blank" rel="noopener noreferrer">{(p.texto || 'Ver post').slice(0, 80)}</a> : (p.texto || '').slice(0, 80)}
                    {(p.uso_ia !== 'ninguno' || p.imagen_ia) && <span className="chip-ia">IA</span>}
                  </td>
                  <td><span className={`estado estado-${p.estado}`}>{ESTADOS_POST[p.estado]}</span></td>
                  <td>{p.me_gusta}</td>
                  <td>{p.compartidos}</td>
                  <td>{p.visualizaciones}</td>
                  <td>{equipo[p.responsable_id] || ''}</td>
                  <td className="acciones-fila">
                    <button className="btn-texto" onClick={() => setF({ ...NUEVO, ...p })}>Editar</button>
                    <button className="btn-texto peligro" onClick={() => borrar(p.id)}>Eliminar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
