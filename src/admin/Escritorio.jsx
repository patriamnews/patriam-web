import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { puedeRevisar, puedeVerMensajes } from '../lib/permissions'

export default function Escritorio() {
  const { perfil } = useAuth()
  const [n, setN] = useState({})

  useEffect(() => {
    const contar = async (q) => (await q).count || 0
    ;(async () => {
      const r = {
        mios: await contar(supabase.from('articulos').select('id', { count: 'exact', head: true }).eq('autor_id', perfil.id)),
        devueltos: await contar(
          supabase.from('articulos').select('id', { count: 'exact', head: true }).eq('autor_id', perfil.id).eq('estado', 'rechazado'),
        ),
      }
      if (puedeRevisar(perfil))
        r.revision =
          (await contar(supabase.from('articulos').select('id', { count: 'exact', head: true }).eq('estado', 'revision'))) +
          (await contar(supabase.from('acciones').select('id', { count: 'exact', head: true }).eq('aprobada', false))) +
          (await contar(supabase.from('campanas').select('id', { count: 'exact', head: true }).eq('aprobada', false))) +
          (await contar(supabase.from('sedes').select('id', { count: 'exact', head: true }).eq('aprobada', false))) +
          (await contar(supabase.from('productos').select('id', { count: 'exact', head: true }).eq('aprobada', false))) +
          (await contar(supabase.from('cargos').select('id', { count: 'exact', head: true }).eq('aprobada', false))) +
          (await contar(supabase.from('documentos').select('id', { count: 'exact', head: true }).eq('aprobada', false)))
      if (puedeVerMensajes(perfil))
        r.mensajes = await contar(supabase.from('contactos').select('id', { count: 'exact', head: true }).eq('atendido', false))
      setN(r)
    })()
  }, [perfil])

  return (
    <>
      <h1>Hola, {perfil.nombre || perfil.email}</h1>
      <div className="cifras">
        <Link to="/gestion/articulos" className="cifra"><b>{n.mios ?? '–'}</b>Mis artículos</Link>
        <Link to="/gestion/articulos" className="cifra"><b>{n.devueltos ?? '–'}</b>Devueltos con comentarios</Link>
        {'revision' in n && <Link to="/gestion/aprobaciones" className="cifra destacada"><b>{n.revision}</b>Pendientes de su aprobación</Link>}
        {'mensajes' in n && <Link to="/gestion/mensajes" className="cifra"><b>{n.mensajes}</b>Mensajes sin atender</Link>}
      </div>
      <div className="caja-info">
        <h3>Cómo funciona la publicación</h3>
        <ol>
          <li>Cualquier miembro del equipo escribe el artículo, la acción o la campaña y lo <b>envía a aprobación</b>.</li>
          <li>Le llega un aviso por correo a <b>Carlos Rubio</b>, que lo revisa y lo <b>aprueba y publica</b> o lo <b>devuelve</b> con comentarios. El autor recibe la respuesta por correo.</li>
          <li>Nada se publica sin la aprobación de una persona responsable. Queda registrado quién y cuándo lo aprobó.</li>
          <li>Si se ha usado inteligencia artificial, hay que indicarlo en el artículo. Es obligatorio por el Reglamento europeo de IA.</li>
        </ol>
      </div>
    </>
  )
}
