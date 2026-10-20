import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { APROBADOR, ESTADOS, TIPOS_RECOMENDACION } from '../lib/config'
import { puedeAprobar } from '../lib/permissions'
import { fecha, slugify } from '../lib/data'
import { confirmar } from '../lib/confirmar'
import { pedirAprobacion } from '../lib/correo'
import { subirArchivo } from './subir'
import { Foto } from '../components/ImagenPrueba'

const NUEVA = { titulo: '', enlace_externo: '', medio: '', firma: '', tipo_recomendacion: 'prensa', resumen: '', imagen_url: '' }

// Gestión rápida de recomendaciones: enlace, título, fuente, tipo, imagen y comentario
export default function RecomendacionesAdmin() {
  const { perfil } = useAuth()
  const aprueba = puedeAprobar(perfil)
  const [lista, setLista] = useState([])
  const [f, setF] = useState(null)
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')

  const cargar = () =>
    supabase.from('articulos').select('*').eq('seccion', 'recomendaciones').order('actualizado_at', { ascending: false }).then(({ data }) => setLista(data || []))
  useEffect(() => {
    cargar()
  }, [])

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const imagen = async (e) => {
    const file = e.target.files[0]
    if (file) setF({ ...f, imagen_url: await subirArchivo('imagenes', file) })
  }

  const guardar = async (e) => {
    e.preventDefault()
    setError('')
    const estado = aprueba ? 'publicado' : 'revision'
    const datos = {
      titulo: f.titulo.trim(), enlace_externo: f.enlace_externo.trim() || null, medio: f.medio.trim() || null, firma: f.firma.trim() || null,
      tipo_recomendacion: f.tipo_recomendacion, resumen: f.resumen.trim(), imagen_url: f.imagen_url || null,
      seccion: 'recomendaciones', estado, uso_ia: 'ninguno', imagen_ia: false,
      contenido: f.resumen.trim(),
    }
    const res = f.id
      ? await supabase.from('articulos').update(datos).eq('id', f.id)
      : await supabase.from('articulos').insert({ ...datos, slug: `rec-${slugify(datos.titulo)}-${Date.now().toString(36).slice(-4)}` })
    if (res.error) return setError(res.error.message)
    setF(null)
    setMsg(aprueba ? 'Recomendación publicada.' : `Enviada a ${APROBADOR.nombre} para su aprobación. ` + (await pedirAprobacion({ tipo: 'recomendación', titulo: datos.titulo, de: perfil.email, enlace: '/gestion/aprobaciones' })))
    cargar()
  }

  const aprobar = async (r) => {
    await supabase.from('articulos').update({ estado: 'publicado' }).eq('id', r.id)
    setMsg(`«${r.titulo}» publicada.`)
    cargar()
  }

  const borrar = async (r) => {
    if (!confirmar(`¿Eliminar la recomendación «${r.titulo}»?`)) return
    const { error } = await supabase.from('articulos').delete().eq('id', r.id)
    setMsg(error ? 'No se ha podido eliminar: ' + error.message : 'Eliminada.')
    cargar()
  }

  return (
    <>
      <div className="titulo-bloque">
        <h1>Recomendaciones</h1>
        <button className="btn" onClick={() => setF({ ...NUEVA })}>+ Nueva recomendación</button>
      </div>
      <p className="letra-pequena">
        Recomiende artículos de otras webs, noticias de periódicos, revistas, libros, vídeos o pódcast. En la web se ven con su imagen, el título y su comentario, y enlazan al original. Use imágenes con permiso o de la propia fuente (portada del libro, imagen del artículo). {!aprueba && `Se publican cuando las aprueba ${APROBADOR.nombre}.`}
      </p>
      {msg && <p className="aviso-ok">{msg}</p>}

      {f && (
        <form className="formulario tarjeta-form" onSubmit={guardar}>
          <h3>{f.id ? 'Editar recomendación' : 'Nueva recomendación'}</h3>
          <label>Enlace al original<input type="url" value={f.enlace_externo || ''} onChange={set('enlace_externo')} placeholder="https://… (opcional en libros)" /></label>
          <label>Título<input required value={f.titulo} onChange={set('titulo')} placeholder="Título de la noticia, artículo, libro o programa" /></label>
          <div className="tres-col">
            <label>
              Tipo
              <select value={f.tipo_recomendacion || 'prensa'} onChange={set('tipo_recomendacion')}>
                {Object.entries(TIPOS_RECOMENDACION).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <label>Fuente<input value={f.medio || ''} onChange={set('medio')} placeholder="Periódico, web, revista, editorial…" /></label>
            <label>Autor (opcional)<input value={f.firma || ''} onChange={set('firma')} /></label>
          </div>
          <label>Por qué lo recomendamos<textarea rows={3} maxLength={400} required value={f.resumen || ''} onChange={set('resumen')} /></label>
          <div className="dos-col">
            <label>Imagen: subir archivo<input type="file" accept="image/*" onChange={imagen} /></label>
            <label>…o pegar la dirección de la imagen<input type="url" value={f.imagen_url?.startsWith('http') ? f.imagen_url : ''} onChange={set('imagen_url')} placeholder="https://…/imagen.jpg" /></label>
          </div>
          <div className="vista-rec"><Foto src={f.imagen_url} /></div>
          {error && <p className="error">{error}</p>}
          <div className="acciones">
            <button className="btn">{aprueba ? 'Publicar' : `Enviar a ${APROBADOR.nombre}`}</button>
            <button type="button" className="btn-texto" onClick={() => setF(null)}>Cancelar</button>
          </div>
        </form>
      )}

      <div className="tabla-scroll">
        <table className="tabla">
          <thead><tr><th></th><th>Título</th><th>Tipo</th><th>Fuente</th><th>Estado</th><th>Fecha</th><th></th></tr></thead>
          <tbody>
            {lista.map((r) => (
              <tr key={r.id}>
                <td className="celda-mini-img"><Foto src={r.imagen_url} ratio="4 / 3" texto="" /></td>
                <td>{r.enlace_externo ? <a href={r.enlace_externo} target="_blank" rel="noopener noreferrer">{r.titulo}</a> : r.titulo}</td>
                <td>{TIPOS_RECOMENDACION[r.tipo_recomendacion] || '—'}</td>
                <td>{r.medio || '—'}</td>
                <td><span className={`estado estado-${r.estado}`}>{ESTADOS[r.estado]}</span></td>
                <td>{fecha(r.publicado_at || r.actualizado_at)}</td>
                <td className="acciones-fila">
                  {aprueba && r.estado === 'revision' && <button className="btn-texto" onClick={() => aprobar(r)}>Aprobar</button>}
                  <button className="btn-texto" onClick={() => setF({ ...NUEVA, ...r })}>Editar</button>
                  <button className="btn-texto peligro" onClick={() => borrar(r)}>Eliminar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
