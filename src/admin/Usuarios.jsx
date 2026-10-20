import { confirmar } from '../lib/confirmar'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { ROLES, SECCIONES } from '../lib/config'
import { fecha } from '../lib/data'

export default function Usuarios() {
  const { perfil } = useAuth()
  const [lista, setLista] = useState([])
  const [msg, setMsg] = useState('')

  const cargar = () => supabase.from('perfiles').select('*').order('creado_at').then(({ data }) => setLista(data || []))
  useEffect(() => {
    cargar()
  }, [])

  const cambiar = async (u, cambios) => {
    setMsg('')
    if (u.id === perfil.id && cambios.rol && cambios.rol !== 'admin' && !confirmar('Va a quitarse a sí mismo el rol de administrador. ¿Seguro?'))
      return
    const { error } = await supabase.from('perfiles').update(cambios).eq('id', u.id)
    setMsg(error ? 'Error: ' + error.message : 'Cambios guardados.')
    cargar()
  }

  return (
    <>
      <h1>Usuarios y permisos</h1>
      <div className="caja-info">
        <p>
          <b>Alta de usuarios:</b> la persona solicita acceso desde <i>Acceso miembros › Solicitar acceso</i>, o se la invita desde Supabase (Authentication › Users › Invite user). Después se activa aquí y se le asigna un rol.
        </p>
        <ul>
          <li><b>Autor / colaborador:</b> escribe artículos y los envía a revisión. No publica.</li>
          <li><b>Editor de área:</b> revisa y publica en su área (ciudadana, cultural o social).</li>
          <li><b>Director de la revista:</b> revisa y publica en todas las secciones y edita las páginas.</li>
          <li><b>Administrador:</b> todo lo anterior, más usuarios, junta, documentos y mensajes.</li>
          <li><b>Redes:</b> permiso adicional para el gestor de redes sociales; se puede dar a cualquier rol.</li>
          <li><b>Tienda:</b> permiso adicional para gestionar productos y pedidos.</li>
        </ul>
      </div>
      {msg && <p className="aviso-ok">{msg}</p>}
      <div className="tabla-scroll">
        <table className="tabla">
          <thead>
            <tr><th>Nombre</th><th>Email</th><th>Rol</th><th>Área</th><th>Redes</th><th>Tienda</th><th>Activo</th><th>Alta</th></tr>
          </thead>
          <tbody>
            {lista.map((u) => (
              <tr key={u.id}>
                <td>
                  <input className="input-tabla" defaultValue={u.nombre} onBlur={(e) => e.target.value !== u.nombre && cambiar(u, { nombre: e.target.value })} />
                </td>
                <td>{u.email}</td>
                <td>
                  <select value={u.rol} onChange={(e) => cambiar(u, { rol: e.target.value, area: e.target.value === 'editor' ? u.area || 'ciudadana' : null })}>
                    {Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </td>
                <td>
                  {u.rol === 'editor' ? (
                    <select value={u.area || ''} onChange={(e) => cambiar(u, { area: e.target.value })}>
                      {['ciudadana', 'cultural', 'social'].map((s) => <option key={s} value={s}>{SECCIONES[s].nombre}</option>)}
                    </select>
                  ) : '—'}
                </td>
                <td><input type="checkbox" checked={!!u.gestiona_redes} onChange={(e) => cambiar(u, { gestiona_redes: e.target.checked })} /></td>
                <td><input type="checkbox" checked={!!u.gestiona_tienda} onChange={(e) => cambiar(u, { gestiona_tienda: e.target.checked })} /></td>
                <td><input type="checkbox" checked={u.activo} onChange={(e) => cambiar(u, { activo: e.target.checked })} /></td>
                <td>{fecha(u.creado_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="letra-pequena">
        Para cambiar el email de un usuario: Supabase › Authentication › Users. El cambio se refleja aquí automáticamente. Para dar de baja a alguien, desmarque "Activo": pierde el acceso al momento.
      </p>
    </>
  )
}
