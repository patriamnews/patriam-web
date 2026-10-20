import { confirmar } from '../lib/confirmar'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { fecha, slugify } from '../lib/data'
import { puedeAprobar, equipo } from '../lib/permissions'
import { pedirAprobacion } from '../lib/correo'
import { APROBADOR } from '../lib/config'

const NUEVA = {
  titulo: '', resumen: '', texto: '', destinatario: '', objetivo: 1000, activa: true,
  modo: 'externo', enlace_externo: '', firmas_externas: 0,
}

// Formulario de creación de peticiones de CitizenGO (comprobar la dirección si cambia)
const CITIZENGO_CREAR = 'https://www.citizengo.org/es/create-your-petition'

// Texto ordenado según los campos del formulario de CitizenGO: qué se pide, a quién y por qué
const textoCitizenGO = (c) =>
  `TÍTULO\n${c.titulo}\n\nDESTINATARIO (a quién se dirige)\n${c.destinatario || ''}\n\nQUÉ PEDIMOS (resumen)\n${c.resumen || ''}\n\nPOR QUÉ (texto de la petición)\n${(c.texto || '').replace(/^#+\s*/gm, '').replace(/\*\*/g, '')}`

function PrepararCitizenGO({ c, cerrar }) {
  const texto = textoCitizenGO(c)
  const [copiado, setCopiado] = useState(false)
  const copiar = () =>
    navigator.clipboard?.writeText(texto).then(() => setCopiado(true), () => setCopiado(false))
  return (
    <div className="tarjeta-form caja-citizengo">
      <h3>Lanzar "{c.titulo}" en CitizenGO</h3>
      <ol>
        <li>Copie el texto preparado y abra el formulario de CitizenGO.</li>
        <li>Pegue cada parte en su campo: título, destinatario, qué pedimos y por qué. Añada una imagen.</li>
        <li>Cree la cuenta de la asociación (solo la primera vez), revise la vista previa y publique.</li>
        <li>Copie el enlace de la petición publicada y péguelo en esta campaña (botón Editar). Actualice el contador de firmas de vez en cuando.</li>
      </ol>
      <textarea readOnly rows={9} value={texto} onFocus={(e) => e.target.select()} />
      <div className="acciones">
        <button type="button" className="btn" onClick={copiar}>{copiado ? 'Copiado ✓' : 'Copiar texto'}</button>
        <a className="btn btn-claro" href={CITIZENGO_CREAR} target="_blank" rel="noopener noreferrer">Abrir CitizenGO ↗</a>
        <button type="button" className="btn-texto" onClick={cerrar}>Cerrar</button>
      </div>
      <p className="letra-pequena">CitizenGO no ofrece una API pública para crear peticiones: se publican a mano. La plataforma es responsable de los datos de los firmantes.</p>
    </div>
  )
}

const csv = (filas, cols, nombre) => {
  const t = [cols.join(';'), ...filas.map((r) => cols.map((c) => `"${String(r[c] ?? '').replace(/"/g, '""')}"`).join(';'))].join('\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob(['﻿' + t], { type: 'text/csv;charset=utf-8' }))
  a.download = nombre
  a.click()
}

export default function CampanasAdmin() {
  const { perfil } = useAuth()
  const esAdmin = equipo(perfil)
  const aprueba = puedeAprobar(perfil)
  const [msg, setMsg] = useState('')
  const [lista, setLista] = useState([])
  const [cuentas, setCuentas] = useState({})
  const [f, setF] = useState(null)
  const [error, setError] = useState('')
  const [preparar, setPreparar] = useState(null)

  const cargar = async () => {
    const { data } = await supabase.from('campanas').select('*').order('creado_at', { ascending: false })
    setLista(data || [])
    const c = {}
    for (const x of data || []) c[x.id] = x.modo === 'externo' ? x.firmas_externas : (await supabase.rpc('contar_firmas', { campana: x.id })).data
    setCuentas(c)
  }
  useEffect(() => {
    cargar()
  }, [])

  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })

  const guardar = async (e) => {
    e.preventDefault()
    setError('')
    const { id, creado_at, ...datos } = f
    datos.objetivo = Number(datos.objetivo) || null
    datos.firmas_externas = Number(datos.firmas_externas) || 0
    const res = id
      ? await supabase.from('campanas').update(datos).eq('id', id)
      : await supabase.from('campanas').insert({ ...datos, slug: `${slugify(datos.titulo)}-${Date.now().toString(36).slice(-4)}` })
    if (res.error) return setError(res.error.message)
    setF(null)
    setMsg(aprueba ? 'Campaña guardada y publicada.' : `Campaña enviada a ${APROBADOR.nombre} para su aprobación. ` + (await pedirAprobacion({ tipo: 'campaña', titulo: datos.titulo, de: perfil.email, enlace: '/gestion/aprobaciones' })))
    cargar()
  }

  const aprobar = async (c) => {
    await supabase.from('campanas').update({ aprobada: true }).eq('id', c.id)
    setMsg(`Campaña «${c.titulo}» aprobada.`)
    cargar()
  }

  const exportar = async (c) => {
    const { data } = await supabase.from('firmas').select('*').eq('campana_id', c.id).order('creado_at')
    csv(data || [], ['creado_at', 'nombre', 'email', 'municipio', 'quiere_info'], `firmas-${c.slug}.csv`)
  }

  const borrarFirmas = async (c) => {
    if (!confirmar(`¿Borrar definitivamente los datos de todas las personas que firmaron "${c.titulo}" (excepto las que pidieron recibir información)? Hágalo al cerrar la campaña.`)) return
    await supabase.from('firmas').delete().eq('campana_id', c.id).eq('quiere_info', false)
    cargar()
  }

  return (
    <>
      <div className="titulo-bloque">
        <h1>Campañas de firmas</h1>
        <button className="btn" onClick={() => setF({ ...NUEVA })}>+ Nueva campaña</button>
      </div>
      {msg && <p className="aviso-ok">{msg}</p>}
      <div className="caja-info">
        <b>Dos formas de recoger firmas:</b>
        <ul>
          <li><b>Plataforma externa (CitizenGO u otra)</b>, recomendada: la asociación no guarda ningún dato de los firmantes. El contador se actualiza a mano.</li>
          <li><b>Formulario propio</b>: la asociación guarda nombre, email y municipio (opcional). Hay que borrar los datos al cerrar la campaña.</li>
        </ul>
      </div>

      {f && (
        <form className="formulario tarjeta-form" onSubmit={guardar}>
          <h3>{f.id ? 'Editar campaña' : 'Nueva campaña'}</h3>
          <label>Título<input required value={f.titulo} onChange={set('titulo')} /></label>
          <label>Resumen (aparece en el listado)<textarea rows={2} value={f.resumen || ''} onChange={set('resumen')} /></label>
          <label>Texto de la campaña<textarea rows={8} value={f.texto || ''} onChange={set('texto')} /></label>
          <div className="dos-col">
            <label>Dirigida a<input value={f.destinatario || ''} onChange={set('destinatario')} placeholder="Ayuntamiento de…, Ministerio de…" /></label>
            <label>Objetivo de firmas<input type="number" min="0" value={f.objetivo || ''} onChange={set('objetivo')} /></label>
          </div>
          <fieldset className="grupo">
            <legend>¿Dónde se firma?</legend>
            <label className="check"><input type="radio" checked={f.modo === 'externo'} onChange={() => setF({ ...f, modo: 'externo' })} /><span>En una plataforma externa (CitizenGO…)</span></label>
            <label className="check"><input type="radio" checked={f.modo === 'propio'} onChange={() => setF({ ...f, modo: 'propio' })} /><span>En esta web (formulario propio)</span></label>
            {f.modo === 'externo' && (
              <div className="dos-col">
                <label>Enlace a la petición (déjelo vacío hasta publicarla)<input type="url" value={f.enlace_externo || ''} onChange={set('enlace_externo')} placeholder="https://citizengo.org/…" /></label>
                <label>Firmas actuales (actualizar a mano)<input type="number" min="0" value={f.firmas_externas || 0} onChange={set('firmas_externas')} /></label>
              </div>
            )}
          </fieldset>
          <label className="check"><input type="checkbox" checked={f.activa} onChange={set('activa')} /><span>Campaña activa (visible en la web)</span></label>
          {error && <p className="error">{error}</p>}
          <div className="acciones">
            <button className="btn">Guardar</button>
            <button type="button" className="btn-texto" onClick={() => setF(null)}>Cancelar</button>
          </div>
        </form>
      )}

      {preparar && <PrepararCitizenGO c={preparar} cerrar={() => setPreparar(null)} />}

      <div className="tabla-scroll">
        <table className="tabla">
          <thead><tr><th>Campaña</th><th>Dónde</th><th>Firmas</th><th>Estado</th><th>Creada</th><th></th></tr></thead>
          <tbody>
            {lista.map((c) => (
              <tr key={c.id}>
                <td>{c.titulo}</td>
                <td>{c.modo === 'externo' ? 'Externa' : 'Propia'}</td>
                <td>{(cuentas[c.id] ?? 0).toLocaleString('es-ES')}{c.objetivo ? ` / ${c.objetivo.toLocaleString('es-ES')}` : ''}</td>
                <td>{c.aprobada === false ? <span className="estado estado-revision">Pendiente de aprobación</span> : <span className={`estado ${c.activa ? 'estado-publicado' : ''}`}>{c.activa ? 'Activa' : 'Cerrada'}</span>}</td>
                <td>{fecha(c.creado_at)}</td>
                <td className="acciones-fila">
                  {aprueba && c.aprobada === false && <button className="btn-texto" onClick={() => aprobar(c)}>Aprobar</button>}
                  <button className="btn-texto" onClick={() => setF({ ...NUEVA, ...c })}>Editar</button>
                  {c.modo === 'externo' && <button className="btn-texto" onClick={() => setPreparar(c)}>Preparar en CitizenGO</button>}
                  {esAdmin && c.modo === 'propio' && <button className="btn-texto" onClick={() => exportar(c)}>Exportar firmas</button>}
                  {esAdmin && c.modo === 'propio' && <button className="btn-texto peligro" onClick={() => borrarFirmas(c)}>Borrar datos</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
