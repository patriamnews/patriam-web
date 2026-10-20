import { confirmar } from '../lib/confirmar'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { subirArchivo } from './subir'

const NUEVO = { nombre: '', cargo: '', orden: 0, visible: true, consentimiento_publicacion: false, foto_url: '' }

export default function Junta() {
  const [lista, setLista] = useState([])
  const [f, setF] = useState(NUEVO)
  const [error, setError] = useState('')

  const cargar = () => supabase.from('cargos').select('*').order('orden').then(({ data }) => setLista(data || []))
  useEffect(() => {
    cargar()
  }, [])

  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })

  const guardar = async (e) => {
    e.preventDefault()
    setError('')
    const { id, ...datos } = f
    const res = id ? await supabase.from('cargos').update(datos).eq('id', id) : await supabase.from('cargos').insert(datos)
    if (res.error) return setError(res.error.message)
    setF(NUEVO)
    cargar()
  }

  const borrar = async (id) => {
    if (!confirmar('¿Eliminar este cargo?')) return
    await supabase.from('cargos').delete().eq('id', id)
    cargar()
  }

  const foto = async (e) => {
    const file = e.target.files[0]
    if (file) setF({ ...f, foto_url: await subirArchivo('imagenes', file) })
  }

  return (
    <>
      <h1>Junta directiva</h1>
      <div className="caja-aviso">
        Solo se muestran en la web los cargos marcados como visibles <b>y</b> con el consentimiento de publicación de la persona (RGPD). Guarde el consentimiento firmado.
      </div>
      <form className="formulario tarjeta-form" onSubmit={guardar}>
        <div className="dos-col">
          <label>Nombre y apellidos<input required value={f.nombre} onChange={set('nombre')} /></label>
          <label>Cargo<input required value={f.cargo} onChange={set('cargo')} placeholder="Presidente, Secretario…" /></label>
        </div>
        <div className="dos-col">
          <label>Orden<input type="number" value={f.orden} onChange={set('orden')} /></label>
          <label>Foto (opcional)<input type="file" accept="image/*" onChange={foto} /></label>
        </div>
        <label className="check"><input type="checkbox" checked={f.visible} onChange={set('visible')} /><span>Visible en la web</span></label>
        <label className="check">
          <input type="checkbox" checked={f.consentimiento_publicacion} onChange={set('consentimiento_publicacion')} />
          <span>Consta su consentimiento para publicar nombre, cargo y foto</span>
        </label>
        {error && <p className="error">{error}</p>}
        <div className="acciones">
          <button className="btn">{f.id ? 'Guardar cambios' : 'Añadir'}</button>
          {f.id && <button type="button" className="btn-texto" onClick={() => setF(NUEVO)}>Cancelar</button>}
        </div>
      </form>
      <table className="tabla">
        <thead><tr><th>Orden</th><th>Nombre</th><th>Cargo</th><th>En la web</th><th></th></tr></thead>
        <tbody>
          {lista.map((c) => (
            <tr key={c.id}>
              <td>{c.orden}</td>
              <td>{c.nombre}</td>
              <td>{c.cargo}</td>
              <td>{c.visible && c.consentimiento_publicacion ? 'Sí' : c.visible ? 'Falta consentimiento' : 'No'}</td>
              <td className="acciones-fila">
                <button className="btn-texto" onClick={() => setF({ ...NUEVO, ...c, foto_url: c.foto_url || '' })}>Editar</button>
                <button className="btn-texto peligro" onClick={() => borrar(c.id)}>Eliminar</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}
