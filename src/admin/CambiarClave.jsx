import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import logoClaro from '../assets/logo-claro.png'

// Primera entrada: obligatorio cambiar la contraseña inicial antes de usar el panel
export default function CambiarClave() {
  const { perfil, recargar, salir } = useAuth()
  const [f, setF] = useState({ a: '', b: '' })
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  const guardar = async (e) => {
    e.preventDefault()
    setError('')
    if (f.a.length < 10) return setError('La contraseña debe tener al menos 10 caracteres.')
    if (f.a !== f.b) return setError('Las dos contraseñas no coinciden.')
    setEnviando(true)
    const { error: e1 } = await supabase.auth.updateUser({ password: f.a })
    if (!e1) await supabase.from('perfiles').update({ cambiar_clave: false }).eq('id', perfil.id)
    setEnviando(false)
    if (e1) return setError('No se ha podido cambiar: ' + e1.message)
    recargar()
  }

  return (
    <div className="gestion-centro cambiar-clave">
      <img src={logoClaro} alt="PATRIAM" className="logo-img" />
      <h1>Cambie su contraseña</h1>
      <p>Es la primera vez que entra, {perfil?.nombre}. Por seguridad, elija una contraseña nueva y personal antes de continuar.</p>
      <form className="formulario" onSubmit={guardar}>
        <label>Nueva contraseña (mínimo 10 caracteres)<input type="password" autoComplete="new-password" required value={f.a} onChange={(e) => setF({ ...f, a: e.target.value })} /></label>
        <label>Repita la contraseña<input type="password" autoComplete="new-password" required value={f.b} onChange={(e) => setF({ ...f, b: e.target.value })} /></label>
        {error && <p className="error">{error}</p>}
        <div className="acciones">
          <button className="btn" disabled={enviando}>{enviando ? 'Guardando…' : 'Guardar y entrar'}</button>
          <button type="button" className="btn-texto" onClick={salir}>Salir</button>
        </div>
      </form>
    </div>
  )
}
