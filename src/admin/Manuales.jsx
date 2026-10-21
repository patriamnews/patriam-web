import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { confirmar } from '../lib/confirmar'
import Markdown, { Esquema } from '../components/Markdown'

const AREAS = {
  'proteccion-datos': 'Protección de datos',
  'blanqueo': 'Prevención del blanqueo',
  'ia': 'Inteligencia artificial',
  'seguridad': 'Seguridad de la información',
  'otros': 'Otros',
}
const NUEVO = { titulo: '', area: 'proteccion-datos', version: '1.0', fecha: new Date().toISOString().slice(0, 10), esquema: '', contenido: '', orden: 0 }
const fechaLarga = (f) => (f ? new Date(f + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }) : '')

export default function Manuales() {
  const [lista, setLista] = useState([])
  const [abierto, setAbierto] = useState(null)
  const [vista, setVista] = useState('esquema')
  const [f, setF] = useState(null)
  const [error, setError] = useState('')

  const cargar = () =>
    supabase.from('manuales').select('*').order('orden').order('titulo').then(({ data }) => {
      setLista(data || [])
      return data || []
    })
  useEffect(() => {
    cargar()
  }, [])

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  const guardar = async (e) => {
    e.preventDefault()
    setError('')
    const { id, actualizado_at: _a, ...datos } = f
    datos.orden = Number(datos.orden) || 0
    datos.actualizado_at = new Date().toISOString()
    const res = id ? await supabase.from('manuales').update(datos).eq('id', id).select() : await supabase.from('manuales').insert(datos).select()
    if (res.error) return setError(res.error.message)
    const nuevos = await cargar()
    setAbierto(nuevos.find((m) => m.id === (id || res.data?.[0]?.id)) || null)
    setF(null)
  }

  const borrar = async (m) => {
    if (!confirmar(`¿Borrar el manual "${m.titulo}"? No se puede deshacer.`)) return
    await supabase.from('manuales').delete().eq('id', m.id)
    setAbierto(null)
    cargar()
  }

  if (f)
    return (
      <>
        <h1>{f.id ? 'Editar manual' : 'Nuevo manual'}</h1>
        <form className="formulario tarjeta-form" onSubmit={guardar}>
          <label>Título<input required value={f.titulo} onChange={set('titulo')} /></label>
          <div className="dos-col">
            <label>
              Materia
              <select value={f.area} onChange={set('area')}>
                {Object.entries(AREAS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <label>Orden en la lista<input type="number" value={f.orden} onChange={set('orden')} /></label>
          </div>
          <div className="dos-col">
            <label>Versión<input value={f.version} onChange={set('version')} /></label>
            <label>Fecha de la versión<input type="date" value={f.fecha} onChange={set('fecha')} /></label>
          </div>
          <label>
            Esquema (lo más importante)
            <textarea rows={12} value={f.esquema} onChange={set('esquema')} placeholder={'### Título de la tarjeta\n- Punto clave\n- Otro punto'} />
          </label>
          <label>
            Manual completo
            <textarea rows={24} value={f.contenido} onChange={set('contenido')} />
          </label>
          <p className="letra-pequena">
            Formato: <code>## Epígrafe</code>, <code>### Tarjeta del esquema</code>, <code>- punto</code>, <code>**negrita**</code>, <code>*cursiva*</code>, <code>&gt; cita</code> y tablas con <code>|</code>.
          </p>
          {error && <p className="error">{error}</p>}
          <div className="acciones">
            <button className="btn">Guardar</button>
            <button type="button" className="btn-texto" onClick={() => setF(null)}>Cancelar</button>
          </div>
        </form>
      </>
    )

  if (abierto)
    return (
      <article className="manual">
        <div className="manual-barra no-imprimir">
          <button className="btn-texto" onClick={() => setAbierto(null)}>← Manuales de cumplimiento</button>
          <div className="acciones">
            <button className="btn-texto" onClick={() => window.print()}>Imprimir o guardar en PDF</button>
            <button className="btn-texto" onClick={() => setF({ ...NUEVO, ...abierto })}>Editar</button>
            <button className="btn-texto peligro" onClick={() => borrar(abierto)}>Borrar</button>
          </div>
        </div>
        <header className="manual-cab">
          <span className="manual-area">{AREAS[abierto.area] || abierto.area}</span>
          <h1>{abierto.titulo}</h1>
          <p className="letra-pequena">Versión {abierto.version} · {fechaLarga(abierto.fecha)} · Documento interno de la Asociación PATRIAM</p>
        </header>
        <div className="pestanas no-imprimir">
          <button className={vista === 'esquema' ? 'activa' : ''} onClick={() => setVista('esquema')}>Esquema</button>
          <button className={vista === 'completo' ? 'activa' : ''} onClick={() => setVista('completo')}>Manual completo</button>
        </div>
        <div className={vista === 'esquema' ? '' : 'solo-imprimir'}>
          <h2 className="titulo-seccion">Lo más importante</h2>
          <Esquema texto={abierto.esquema} />
        </div>
        <div className={vista === 'completo' ? '' : 'solo-imprimir'}>
          <Markdown texto={abierto.contenido} className="prosa manual-texto" />
        </div>
      </article>
    )

  return (
    <>
      <h1>Manuales de cumplimiento</h1>
      <p>Manuales internos de la asociación. Solo los ve el equipo de gestión. Cada uno tiene un esquema con lo esencial y el texto completo.</p>
      <div className="acciones"><button className="btn" onClick={() => setF(NUEVO)}>+ Nuevo manual</button></div>
      <div className="manuales-lista">
        {lista.map((m) => (
          <button key={m.id} className="manual-ficha" onClick={() => { setAbierto(m); setVista('esquema') }}>
            <span className="manual-area">{AREAS[m.area] || m.area}</span>
            <strong>{m.titulo}</strong>
            <span className="letra-pequena">Versión {m.version} · {fechaLarga(m.fecha)}</span>
          </button>
        ))}
        {!lista.length && <p>Todavía no hay manuales.</p>}
      </div>
    </>
  )
}
