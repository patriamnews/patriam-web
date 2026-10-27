import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { SECCIONES } from '../lib/config'
import { puedeGestionarArea, puedeAprobar } from '../lib/permissions'
import { pedirAprobacion } from '../lib/correo'
import { APROBADOR } from '../lib/config'
import { slugify } from '../lib/data'
import { confirmar } from '../lib/confirmar'
import { subirArchivo } from './subir'

const AREAS = ['ciudadana', 'cultural', 'social']
const local = (iso) => (iso ? new Date(new Date(iso).getTime() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 16) : '')
const NUEVA = (area) => ({
  seccion: area, titulo: '', resumen: '', descripcion: '', lugar: '', fecha_inicio: '', fecha_fin: '',
  porque_id: '', cronica_id: '', campana_id: '', estado: 'programada', publicada: true, imagen_url: '', imagen_ia: false, video_url: '',
})
const fechaCorta = (d) => new Date(d).toLocaleString('es-ES', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

export default function AccionesAdmin() {
  const { perfil } = useAuth()
  const areas = AREAS.filter((a) => puedeGestionarArea(perfil, a))
  const aprueba = puedeAprobar(perfil)
  const [msg, setMsg] = useState('')
  const [lista, setLista] = useState([])
  const [articulos, setArticulos] = useState([])
  const [campanas, setCampanas] = useState([])
  const [filtro, setFiltro] = useState(areas.length === 1 ? areas[0] : '')
  const [f, setF] = useState(null)
  const [error, setError] = useState('')

  const cargar = () => {
    let q = supabase.from('acciones').select('*').order('fecha_inicio', { ascending: false })
    if (filtro) q = q.eq('seccion', filtro)
    q.then(({ data }) => setLista((data || []).filter((a) => areas.includes(a.seccion))))
  }
  useEffect(cargar, [filtro])
  useEffect(() => {
    supabase.from('articulos').select('id, titulo, seccion').eq('estado', 'publicado').order('publicado_at', { ascending: false }).limit(200)
      .then(({ data }) => setArticulos(data || []))
    supabase.from('campanas').select('id, titulo').then(({ data }) => setCampanas(data || []))
  }, [])

  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })

  const guardar = async (e) => {
    e.preventDefault()
    setError('')
    const { id, creado_at, ...d } = f
    d.fecha_inicio = new Date(d.fecha_inicio).toISOString()
    d.fecha_fin = d.fecha_fin ? new Date(d.fecha_fin).toISOString() : null
    for (const k of ['porque_id', 'cronica_id', 'campana_id']) d[k] = d[k] ? Number(d[k]) : null
    const res = id
      ? await supabase.from('acciones').update(d).eq('id', id)
      : await supabase.from('acciones').insert({ ...d, slug: `${slugify(d.titulo)}-${Date.now().toString(36).slice(-4)}` })
    if (res.error) return setError(res.error.message)
    setF(null)
    setMsg(aprueba ? 'Guardada y publicada.' : `Guardada y enviada a ${APROBADOR.nombre} para su aprobación. ` + (await pedirAprobacion({ tipo: 'acción', titulo: d.titulo, de: perfil.email, enlace: '/gestion/aprobaciones' })))
    cargar()
  }

  const aprobar = async (a) => {
    await supabase.from('acciones').update({ aprobada: true }).eq('id', a.id)
    setMsg(`Acción «${a.titulo}» aprobada y publicada.`)
    cargar()
  }

  const borrar = async (a) => {
    if (!confirmar(`¿Eliminar "${a.titulo}"? Si se ha suspendido, mejor márquela como cancelada.`)) return
    await supabase.from('acciones').delete().eq('id', a.id)
    cargar()
  }

  const imagen = async (e) => {
    const file = e.target.files[0]
    if (file) setF({ ...f, imagen_url: await subirArchivo('imagenes', file) })
  }

  const ahora = new Date()
  const sinCronica = lista.filter((a) => new Date(a.fecha_inicio) < ahora && !a.cronica_id && a.estado !== 'cancelada')

  return (
    <>
      <div className="titulo-bloque">
        <h1>Agenda de acciones</h1>
        <button className="btn" onClick={() => setF(NUEVA(filtro || areas[0]))}>+ Nueva acción</button>
      </div>
      {msg && <p className="aviso-ok">{msg}</p>}
      {!aprueba && <p className="letra-pequena">Las acciones nuevas o modificadas se publican cuando las aprueba {APROBADOR.nombre} ({APROBADOR.email}).</p>}
      {sinCronica.length > 0 && (
        <div className="caja-aviso">
          <b>{sinCronica.length} acción{sinCronica.length > 1 ? 'es' : ''} ya realizada{sinCronica.length > 1 ? 's' : ''} sin crónica.</b> Escriba la crónica como artículo, publíquela y enlácela aquí (Editar › Crónica).
        </div>
      )}
      {areas.length > 1 && (
        <div className="filtros">
          <select value={filtro} onChange={(e) => setFiltro(e.target.value)}>
            <option value="">Todas las áreas</option>
            {areas.map((a) => <option key={a} value={a}>{SECCIONES[a].nombre}</option>)}
          </select>
        </div>
      )}

      {f && (
        <form className="formulario tarjeta-form" onSubmit={guardar}>
          <h3>{f.id ? 'Editar acción' : 'Nueva acción'}</h3>
          <div className="dos-col">
            <label>Título<input required value={f.titulo} onChange={set('titulo')} /></label>
            <label>
              Área
              <select value={f.seccion} onChange={set('seccion')}>
                {areas.map((a) => <option key={a} value={a}>{SECCIONES[a].nombre}</option>)}
              </select>
            </label>
          </div>
          <div className="tres-col">
            <label>Inicio<input required type="datetime-local" value={local(f.fecha_inicio) || f.fecha_inicio} onChange={set('fecha_inicio')} /></label>
            <label>Fin (opcional)<input type="datetime-local" value={local(f.fecha_fin) || f.fecha_fin || ''} onChange={set('fecha_fin')} /></label>
            <label>Lugar<input value={f.lugar || ''} onChange={set('lugar')} /></label>
          </div>
          <label>
            Dirigida a
            <select value={f.dirigida || 'todos'} onChange={set('dirigida')}>
              <option value="todos">Todos</option>
              <option value="mujeres">Solo mujeres (p. ej., talleres de costura)</option>
              <option value="hombres">Solo hombres</option>
            </select>
          </label>
          <label>Resumen (aparece en la agenda)<textarea rows={2} maxLength={300} value={f.resumen || ''} onChange={set('resumen')} /></label>
          <label>Descripción completa<textarea rows={6} value={f.descripcion || ''} onChange={set('descripcion')} /></label>
          <fieldset className="grupo">
            <legend>Enlaces</legend>
            <label>
              Por qué lo hacemos (artículo de la revista u otra sección)
              <select value={f.porque_id || ''} onChange={set('porque_id')}>
                <option value="">—</option>
                {articulos.map((a) => <option key={a.id} value={a.id}>{SECCIONES[a.seccion]?.nombre} · {a.titulo}</option>)}
              </select>
            </label>
            <label>
              Crónica o reportaje (cuando ya se ha realizado)
              <select value={f.cronica_id || ''} onChange={set('cronica_id')}>
                <option value="">—</option>
                {articulos.map((a) => <option key={a.id} value={a.id}>{SECCIONES[a.seccion]?.nombre} · {a.titulo}</option>)}
              </select>
            </label>
            <label>
              Campaña de firmas relacionada
              <select value={f.campana_id || ''} onChange={set('campana_id')}>
                <option value="">—</option>
                {campanas.map((c) => <option key={c.id} value={c.id}>{c.titulo}</option>)}
              </select>
            </label>
          </fieldset>
          <div className="dos-col">
            <label>
              Estado
              <select value={f.estado} onChange={set('estado')}>
                <option value="programada">Programada</option>
                <option value="realizada">Realizada</option>
                <option value="cancelada">Cancelada</option>
              </select>
            </label>
            <label>Imagen o cartel (opcional)<input type="file" accept="image/*" onChange={imagen} /></label>
            <label>Vídeo de la convocatoria (enlace a X, YouTube, Instagram…)<input type="url" placeholder="https://x.com/patriam_es/status/…" value={f.video_url || ''} onChange={set('video_url')} /></label>
          </div>
          {f.imagen_url && <img src={f.imagen_url} alt="" className="miniatura" />}
          {f.imagen_url && <label className="check"><input type="checkbox" checked={!!f.imagen_ia} onChange={set('imagen_ia')} /><span>La imagen está generada o manipulada con IA (se mostrará el aviso del art. 50 del Reglamento de IA)</span></label>}
          <label className="check"><input type="checkbox" checked={f.publicada} onChange={set('publicada')} /><span>Publicada en la agenda</span></label>
          {error && <p className="error">{error}</p>}
          <div className="acciones">
            <button className="btn">Guardar</button>
            <button type="button" className="btn-texto" onClick={() => setF(null)}>Cancelar</button>
          </div>
        </form>
      )}

      <div className="tabla-scroll">
        <table className="tabla">
          <thead><tr><th>Fecha</th><th>Acción</th><th>Área</th><th>Estado</th><th>Por qué</th><th>Crónica</th><th></th></tr></thead>
          <tbody>
            {lista.map((a) => {
              const pasada = new Date(a.fecha_inicio) < ahora
              return (
                <tr key={a.id}>
                  <td>{fechaCorta(a.fecha_inicio)}</td>
                  <td>{a.titulo}{!a.publicada && <span className="mini"> (oculta)</span>}</td>
                  <td>{SECCIONES[a.seccion].nombre}</td>
                  <td>
                    {a.aprobada === false ? <span className="estado estado-revision">Pendiente de aprobación</span> : <span className={`estado ${a.estado === 'cancelada' ? 'estado-rechazado' : pasada ? 'estado-publicado' : 'estado-programado'}`}>{a.estado === 'cancelada' ? 'Cancelada' : pasada ? 'Realizada' : 'Próxima'}</span>}
                  </td>
                  <td>{a.porque_id ? '✓' : '—'}</td>
                  <td>{a.cronica_id ? '✓' : pasada && a.estado !== 'cancelada' ? <span className="mini">Pendiente</span> : '—'}</td>
                  <td className="acciones-fila">
                    {aprueba && a.aprobada === false && <button className="btn-texto" onClick={() => aprobar(a)}>Aprobar</button>}
                    <button className="btn-texto" onClick={() => setF({ ...NUEVA(a.seccion), ...a, porque_id: a.porque_id || '', cronica_id: a.cronica_id || '', campana_id: a.campana_id || '', imagen_url: a.imagen_url || '' })}>Editar</button>
                    <button className="btn-texto peligro" onClick={() => borrar(a)}>Eliminar</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}
