import { confirmar } from '../lib/confirmar'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { puedeAprobar } from '../lib/permissions'
import { CIUDADES, buscarCiudad } from '../lib/ciudades'
import MapaEspana from '../components/MapaEspana'

const NUEVA = { ciudad: '', email: '', direccion: '', telefono: '', lat: '', lon: '', orden: 0, activa: true }

export default function SedesAdmin() {
  const { perfil } = useAuth()
  const aprueba = puedeAprobar(perfil)
  const [lista, setLista] = useState([])
  const [f, setF] = useState(NUEVA)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')

  const cargar = () => supabase.from('sedes').select('*').order('orden').order('ciudad').then(({ data }) => setLista(data || []))
  useEffect(() => {
    cargar()
  }, [])

  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })

  // Al escribir la ciudad, si es conocida se sitúa sola en el mapa
  // y se propone el correo ciudad@patriam.es
  const cambiaCiudad = (e) => {
    const ciudad = e.target.value
    const c = buscarCiudad(ciudad)
    const correoPropuesto = (s) => (s ? s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '') + '@patriam.es' : '')
    const email = !f.email || f.email === correoPropuesto(f.ciudad) ? correoPropuesto(ciudad) : f.email
    setF({ ...f, ciudad, email, ...(c ? { lat: c[0], lon: c[1] } : {}) })
  }

  const guardar = async (e) => {
    e.preventDefault()
    setError('')
    setMsg('')
    if (f.lat === '' || f.lon === '') return setError('Falta situar la sede: elija una ciudad de la lista o pulse sobre el mapa.')
    const { id, creado_at: _c, aprobada: _a, creado_por: _p, ...datos } = f
    datos.lat = Number(datos.lat)
    datos.lon = Number(datos.lon)
    datos.orden = Number(datos.orden) || 0
    const res = id ? await supabase.from('sedes').update(datos).eq('id', id) : await supabase.from('sedes').insert(datos)
    if (res.error) return setError(res.error.message)
    setMsg(aprueba ? 'Guardado y publicado.' : 'Guardado. Se publicará cuando Carlos lo apruebe (Pendientes de aprobación).')
    setF(NUEVA)
    cargar()
  }

  const borrar = async (s) => {
    if (!confirmar(`¿Quitar la sede de ${s.ciudad}?`)) return
    await supabase.from('sedes').delete().eq('id', s.id)
    cargar()
  }

  const enMapa = [...lista.filter((s) => s.id !== f.id), ...(f.lat !== '' ? [{ ciudad: f.ciudad || 'Nueva sede', lat: f.lat, lon: f.lon }] : [])]

  return (
    <>
      <h1>Sedes</h1>
      <p>Las sedes aparecen en la página de Contacto, con un mapa y el correo de cada una.</p>

      <form className="formulario tarjeta-form" onSubmit={guardar}>
        <h2 className="titulo-seccion">{f.id ? `Editar sede: ${f.ciudad}` : 'Añadir sede'}</h2>
        <div className="dos-col">
          <label>
            Ciudad
            <input required list="ciudades" value={f.ciudad} onChange={cambiaCiudad} placeholder="Escriba o elija de la lista" />
            <datalist id="ciudades">{Object.keys(CIUDADES).map((c) => <option key={c} value={c} />)}</datalist>
          </label>
          <label>Correo de la sede<input required type="email" value={f.email} onChange={set('email')} placeholder="ciudad@patriam.es" /></label>
        </div>
        <div className="dos-col">
          <label>Dirección (opcional)<input value={f.direccion} onChange={set('direccion')} /></label>
          <label>Teléfono (opcional)<input value={f.telefono} onChange={set('telefono')} /></label>
        </div>
        <div className="sede-mapa-admin">
          <MapaEspana puntos={enMapa} activa={f.ciudad || 'Nueva sede'} onClicMapa={([lat, lon]) => setF({ ...f, lat, lon })} etiqueta="Pulse para situar la sede" />
          <p className="letra-pequena">
            {f.lat !== '' ? 'Sede situada en el mapa. Si el punto no está bien, pulse en el lugar correcto.' : 'Si la ciudad no está en la lista, pulse sobre el mapa para situarla.'}
          </p>
        </div>
        <div className="dos-col">
          <label>Orden en la lista<input type="number" value={f.orden} onChange={set('orden')} /></label>
          <label className="check"><input type="checkbox" checked={f.activa} onChange={set('activa')} /><span>Visible en la web</span></label>
        </div>
        {!aprueba && <p className="letra-pequena">Los cambios se publican cuando los aprueba Carlos.</p>}
        {error && <p className="error">{error}</p>}
        {msg && <p className="aviso-ok">{msg}</p>}
        <div className="acciones">
          <button className="btn">{f.id ? 'Guardar cambios' : 'Añadir sede'}</button>
          {f.id && <button type="button" className="btn-texto" onClick={() => setF(NUEVA)}>Cancelar</button>}
        </div>
      </form>

      <div className="tabla-scroll">
        <table className="tabla">
          <thead><tr><th>Orden</th><th>Ciudad</th><th>Correo</th><th>En la web</th><th></th></tr></thead>
          <tbody>
            {lista.map((s) => (
              <tr key={s.id}>
                <td>{s.orden}</td>
                <td>{s.ciudad}</td>
                <td>{s.email}</td>
                <td>{!s.activa ? 'No' : s.aprobada ? 'Sí' : 'Pendiente de aprobar'}</td>
                <td className="acciones-fila">
                  <button className="btn-texto" onClick={() => setF({ ...NUEVA, ...s, direccion: s.direccion || '', telefono: s.telefono || '' })}>Editar</button>
                  <button className="btn-texto peligro" onClick={() => borrar(s)}>Quitar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
