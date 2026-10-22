import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { confirmar } from '../lib/confirmar'
import { fecha } from '../lib/data'

// Drive del equipo: carpetas y documentos internos. Todo se guarda en un almacenamiento
// PRIVADO (bucket «drive» de Supabase): solo lo ve el equipo y los enlaces de descarga caducan.
const MAX = 50 * 1024 * 1024 // 50 MB por archivo
const kb = (n) => (n == null ? '' : n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`)
const limpio = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.-]+/g, '-').replace(/-+/g, '-').slice(-80)

function icono(tipo = '', nombre = '') {
  const ext = nombre.split('.').pop().toLowerCase()
  if (tipo.startsWith('image/')) return '🖼'
  if (ext === 'pdf') return 'PDF'
  if (['doc', 'docx', 'odt', 'rtf', 'txt'].includes(ext)) return 'DOC'
  if (['xls', 'xlsx', 'ods', 'csv'].includes(ext)) return 'XLS'
  if (['ppt', 'pptx', 'odp'].includes(ext)) return 'PPT'
  if (['zip', 'rar', '7z'].includes(ext)) return 'ZIP'
  if (tipo.startsWith('video/')) return '▶'
  if (tipo.startsWith('audio/')) return '♪'
  return '•'
}

export default function Drive() {
  const { perfil } = useAuth()
  const [carpetas, setCarpetas] = useState([])
  const [archivos, setArchivos] = useState([])
  const [actual, setActual] = useState(null) // id de carpeta; null = inicio
  const [busca, setBusca] = useState('')
  const [nueva, setNueva] = useState(null) // nombre de carpeta nueva en edición
  const [renombra, setRenombra] = useState(null) // { tabla, id, nombre }
  const [subiendo, setSubiendo] = useState([]) // nombres en curso
  const [aviso, setAviso] = useState('')
  const [error, setError] = useState('')
  const [arrastra, setArrastra] = useState(false)
  const input = useRef(null)

  const cargar = useCallback(async () => {
    const [{ data: c }, { data: a }] = await Promise.all([
      supabase.from('drive_carpetas').select('*').order('nombre'),
      supabase.from('drive_archivos').select('*').order('nombre'),
    ])
    setCarpetas(c || [])
    setArchivos(a || [])
  }, [])
  useEffect(() => {
    cargar()
  }, [cargar])

  const porId = useMemo(() => Object.fromEntries(carpetas.map((c) => [c.id, c])), [carpetas])
  const ruta = useMemo(() => {
    const r = []
    let c = porId[actual]
    while (c) {
      r.unshift(c)
      c = porId[c.padre_id]
    }
    return r
  }, [actual, porId])
  const nombreRuta = (id) => {
    const r = []
    let c = porId[id]
    while (c) {
      r.unshift(c.nombre)
      c = porId[c.padre_id]
    }
    return ['Inicio', ...r].join(' › ')
  }
  // Para «Mover a…»: todas las carpetas con su ruta completa
  const destinos = useMemo(() => [{ id: '', nombre: 'Inicio' }, ...carpetas.map((c) => ({ id: c.id, nombre: nombreRuta(c.id) })).sort((a, b) => a.nombre.localeCompare(b.nombre))], [carpetas]) // eslint-disable-line react-hooks/exhaustive-deps

  const mismo = (v) => (v ?? null) === (actual ?? null)
  const subcarpetas = carpetas.filter((c) => mismo(c.padre_id))
  const q = busca.trim().toLowerCase()
  const lista = q ? archivos.filter((a) => a.nombre.toLowerCase().includes(q)) : archivos.filter((a) => mismo(a.carpeta_id))
  const carpetasBuscadas = q ? carpetas.filter((c) => c.nombre.toLowerCase().includes(q)) : subcarpetas
  const cuenta = (id) => archivos.filter((a) => a.carpeta_id === id).length + carpetas.filter((c) => c.padre_id === id).length

  const mensaje = (t) => {
    setAviso(t)
    setTimeout(() => setAviso(''), 4000)
  }

  // ---------- carpetas ----------
  const crearCarpeta = async (e) => {
    e.preventDefault()
    const nombre = nueva.trim()
    if (!nombre) return
    if (subcarpetas.some((c) => c.nombre.toLowerCase() === nombre.toLowerCase())) return setError('Ya hay una carpeta con ese nombre aquí.')
    const { error } = await supabase.from('drive_carpetas').insert({ nombre, padre_id: actual })
    if (error) return setError(error.message)
    setNueva(null)
    setError('')
    cargar()
  }
  const borrarCarpeta = async (c) => {
    if (cuenta(c.id)) return setError(`La carpeta «${c.nombre}» no está vacía. Mueva o elimine antes lo que tiene dentro.`)
    if (!confirmar(`¿Eliminar la carpeta «${c.nombre}»?`)) return
    const { error } = await supabase.from('drive_carpetas').delete().eq('id', c.id)
    if (error) return setError(error.message)
    cargar()
  }

  // ---------- archivos ----------
  const subir = async (files) => {
    setError('')
    const grandes = files.filter((f) => f.size > MAX)
    if (grandes.length) setError(`No se han subido (más de 50 MB): ${grandes.map((f) => f.name).join(', ')}`)
    const validos = files.filter((f) => f.size <= MAX)
    if (!validos.length) return
    setSubiendo(validos.map((f) => f.name))
    let ok = 0
    for (const f of validos) {
      const camino = `${actual ?? 'inicio'}/${crypto.randomUUID()}-${limpio(f.name)}`
      const { error: e1 } = await supabase.storage.from('drive').upload(camino, f, { upsert: false, contentType: f.type || undefined })
      if (e1) {
        setError(`No se pudo subir «${f.name}»: ${e1.message}`)
        continue
      }
      const { error: e2 } = await supabase.from('drive_archivos').insert({
        carpeta_id: actual, nombre: f.name, ruta: camino, tamano: f.size, tipo: f.type || null, subido_por_nombre: perfil?.nombre || perfil?.email || null,
      })
      if (e2) {
        await supabase.storage.from('drive').remove([camino])
        setError(`No se pudo guardar «${f.name}»: ${e2.message}`)
        continue
      }
      ok++
      setSubiendo((s) => s.filter((n) => n !== f.name))
    }
    setSubiendo([])
    if (ok) mensaje(ok === 1 ? 'Archivo subido.' : `${ok} archivos subidos.`)
    cargar()
  }
  const elegir = (e) => {
    subir([...e.target.files])
    e.target.value = ''
  }
  const soltar = (e) => {
    e.preventDefault()
    setArrastra(false)
    if (e.dataTransfer.files.length) subir([...e.dataTransfer.files])
  }

  const enlace = async (a, descargar) => {
    const { data, error } = await supabase.storage.from('drive').createSignedUrl(a.ruta, 300, descargar ? { download: a.nombre } : undefined)
    if (error) return setError(error.message)
    const el = document.createElement('a')
    el.href = data.signedUrl
    el.target = '_blank'
    el.rel = 'noopener'
    if (descargar) el.download = a.nombre
    document.body.appendChild(el)
    el.click()
    el.remove()
  }
  const borrarArchivo = async (a) => {
    if (!confirmar(`¿Eliminar «${a.nombre}»? No se puede deshacer.`)) return
    await supabase.storage.from('drive').remove([a.ruta])
    const { error } = await supabase.from('drive_archivos').delete().eq('id', a.id)
    if (error) return setError(error.message)
    cargar()
  }
  const mover = async (a, destino) => {
    const carpeta_id = destino === '' ? null : Number(destino)
    const { error } = await supabase.from('drive_archivos').update({ carpeta_id }).eq('id', a.id)
    if (error) return setError(error.message)
    mensaje(`«${a.nombre}» movido a ${nombreRuta(carpeta_id)}.`)
    cargar()
  }
  const guardarNombre = async (e) => {
    e.preventDefault()
    const nombre = renombra.nombre.trim()
    if (!nombre) return
    const { error } = await supabase.from(renombra.tabla).update({ nombre }).eq('id', renombra.id)
    if (error) return setError(error.message)
    setRenombra(null)
    cargar()
  }

  const ocupado = archivos.reduce((t, a) => t + (a.tamano || 0), 0)

  return (
    <div className="drive" onDragOver={(e) => { e.preventDefault(); setArrastra(true) }} onDragLeave={(e) => { if (e.currentTarget === e.target) setArrastra(false) }} onDrop={soltar}>
      <div className="titulo-bloque">
        <h1>Drive del equipo</h1>
        <div className="acciones-fila">
          <button className="btn btn-claro" onClick={() => setNueva('')}>+ Carpeta</button>
          <button className="btn" onClick={() => input.current.click()}>Subir archivos</button>
          <input ref={input} type="file" multiple hidden onChange={elegir} />
        </div>
      </div>
      <p className="letra-pequena">
        Documentos internos de la asociación. Solo los ve el equipo; los archivos se guardan en un almacenamiento privado. Puede arrastrar archivos aquí. Máximo 50 MB por archivo. En uso: {kb(ocupado) || '0 KB'} en {archivos.length} archivo{archivos.length === 1 ? '' : 's'}.
      </p>

      <div className="drive-barra">
        <nav className="drive-ruta" aria-label="Carpeta actual">
          <button className={actual == null ? 'activa' : ''} onClick={() => { setActual(null); setBusca('') }}>Inicio</button>
          {ruta.map((c) => (
            <span key={c.id}>
              <span aria-hidden> › </span>
              <button className={c.id === actual ? 'activa' : ''} onClick={() => { setActual(c.id); setBusca('') }}>{c.nombre}</button>
            </span>
          ))}
        </nav>
        <input className="drive-busca" type="search" placeholder="Buscar en todo el Drive…" value={busca} onChange={(e) => setBusca(e.target.value)} />
      </div>

      {error && <p className="error" role="alert">{error} <button className="btn-texto" onClick={() => setError('')}>Cerrar</button></p>}
      {aviso && <p className="aviso-ok">{aviso}</p>}
      {subiendo.length > 0 && <p className="caja-aviso">Subiendo: {subiendo.join(', ')}…</p>}

      {nueva !== null && (
        <form className="drive-nueva" onSubmit={crearCarpeta}>
          <input autoFocus required maxLength={120} placeholder="Nombre de la carpeta" value={nueva} onChange={(e) => setNueva(e.target.value)} />
          <button className="btn">Crear</button>
          <button type="button" className="btn-texto" onClick={() => setNueva(null)}>Cancelar</button>
        </form>
      )}

      <div className={`drive-zona ${arrastra ? 'arrastra' : ''}`}>
        {q && <p className="letra-pequena">Resultados para «{busca}»</p>}

        {carpetasBuscadas.length > 0 && (
          <div className="drive-carpetas">
            {carpetasBuscadas.map((c) =>
              renombra?.tabla === 'drive_carpetas' && renombra.id === c.id ? (
                <form key={c.id} className="drive-carpeta" onSubmit={guardarNombre}>
                  <input autoFocus value={renombra.nombre} onChange={(e) => setRenombra({ ...renombra, nombre: e.target.value })} />
                  <button className="btn-texto">Guardar</button>
                </form>
              ) : (
                <div key={c.id} className="drive-carpeta">
                  <button className="drive-carpeta-abrir" onClick={() => { setActual(c.id); setBusca('') }} title={q ? nombreRuta(c.id) : c.nombre}>
                    <span className="drive-icono-carpeta" aria-hidden>📁</span>
                    <span className="drive-carpeta-nombre">{c.nombre}</span>
                    <span className="letra-pequena">{cuenta(c.id) || 'vacía'}{cuenta(c.id) ? ` elemento${cuenta(c.id) === 1 ? '' : 's'}` : ''}</span>
                  </button>
                  <span className="drive-carpeta-acciones">
                    <button className="btn-texto" onClick={() => setRenombra({ tabla: 'drive_carpetas', id: c.id, nombre: c.nombre })}>Renombrar</button>
                    <button className="btn-texto peligro" onClick={() => borrarCarpeta(c)}>Eliminar</button>
                  </span>
                </div>
              ),
            )}
          </div>
        )}

        {lista.length > 0 ? (
          <div className="tabla-scroll">
            <table className="tabla drive-tabla">
              <thead><tr><th>Nombre</th>{q && <th>Carpeta</th>}<th>Tamaño</th><th>Subido</th><th></th></tr></thead>
              <tbody>
                {lista.map((a) => (
                  <tr key={a.id}>
                    <td>
                      {renombra?.tabla === 'drive_archivos' && renombra.id === a.id ? (
                        <form className="drive-renombra" onSubmit={guardarNombre}>
                          <input autoFocus value={renombra.nombre} onChange={(e) => setRenombra({ ...renombra, nombre: e.target.value })} />
                          <button className="btn-texto">Guardar</button>
                          <button type="button" className="btn-texto" onClick={() => setRenombra(null)}>Cancelar</button>
                        </form>
                      ) : (
                        <button className="drive-archivo" onClick={() => enlace(a, false)} title="Abrir">
                          <span className="drive-icono" aria-hidden>{icono(a.tipo || '', a.nombre)}</span>
                          {a.nombre}
                        </button>
                      )}
                    </td>
                    {q && <td className="letra-pequena">{nombreRuta(a.carpeta_id)}</td>}
                    <td className="letra-pequena">{kb(a.tamano)}</td>
                    <td className="letra-pequena">{fecha(a.creado_at)}{a.subido_por_nombre ? ` · ${a.subido_por_nombre}` : ''}</td>
                    <td className="acciones-fila">
                      <button className="btn-texto" onClick={() => enlace(a, true)}>Descargar</button>
                      <button className="btn-texto" onClick={() => setRenombra({ tabla: 'drive_archivos', id: a.id, nombre: a.nombre })}>Renombrar</button>
                      <select className="drive-mover" aria-label={`Mover ${a.nombre}`} value="" onChange={(e) => mover(a, e.target.value)}>
                        <option value="" disabled>Mover a…</option>
                        {destinos.filter((d) => String(d.id) !== String(a.carpeta_id ?? '')).map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
                      </select>
                      <button className="btn-texto peligro" onClick={() => borrarArchivo(a)}>Eliminar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          !carpetasBuscadas.length && (
            <div className="drive-vacio">
              <p>{q ? 'No hay nada con ese nombre.' : 'Esta carpeta está vacía.'}</p>
              {!q && <p className="letra-pequena">Arrastre archivos aquí o pulse «Subir archivos».</p>}
            </div>
          )
        )}
      </div>
    </div>
  )
}
