import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { ROLES } from '../lib/config'

export default function Cuenta() {
  const { perfil } = useAuth()
  const [nombre, setNombre] = useState(perfil.nombre)
  const [clave, setClave] = useState('')
  const [msg, setMsg] = useState('')

  const guardarNombre = async () => {
    const { error } = await supabase.from('perfiles').update({ nombre }).eq('id', perfil.id)
    setMsg(error ? error.message : 'Nombre actualizado.')
  }
  const guardarClave = async (e) => {
    e.preventDefault()
    const { error } = await supabase.auth.updateUser({ password: clave })
    setMsg(error ? error.message : 'Contraseña cambiada.')
    setClave('')
  }

  return (
    <>
      <h1>Mi cuenta</h1>
      <p>{perfil.email} · {ROLES[perfil.rol]}</p>
      <div className="formulario tarjeta-form">
        <label>Nombre<input value={nombre} onChange={(e) => setNombre(e.target.value)} /></label>
        <div className="acciones"><button className="btn" onClick={guardarNombre}>Guardar nombre</button></div>
      </div>
      <form className="formulario tarjeta-form" onSubmit={guardarClave}>
        <label>
          Nueva contraseña (mínimo 10 caracteres)
          <input type="password" minLength={10} required value={clave} onChange={(e) => setClave(e.target.value)} autoComplete="new-password" />
        </label>
        <div className="acciones"><button className="btn">Cambiar contraseña</button></div>
      </form>
      {msg && <p className="aviso-ok">{msg}</p>}
    </>
  )
}
