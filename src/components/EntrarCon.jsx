// Entrar con Google o con Microsoft (Gmail, Outlook, Hotmail, cuentas de trabajo de Microsoft 365).
// Los correos de Google/Microsoft de cada persona del equipo se apuntan en «Usuarios y permisos»:
// al entrar con ellos se tienen los mismos permisos que con el usuario de siempre.
// En Supabase › Authentication › Providers tienen que estar activados Google y Azure (Microsoft).
import { useState } from 'react'
import { supabase, DEMO } from '../lib/supabase'

const LOGOS = {
  google: <svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>,
  azure: <svg viewBox="0 0 21 21" width="18" height="18" aria-hidden="true"><path fill="#f25022" d="M1 1h9v9H1z"/><path fill="#00a4ef" d="M1 11h9v9H1z"/><path fill="#7fba00" d="M11 1h9v9h-9z"/><path fill="#ffb900" d="M11 11h9v9h-9z"/></svg>,
}

export default function EntrarCon({ volverA }) {
  const [error, setError] = useState('')
  if (DEMO) return null
  const entrar = async (provider) => {
    setError('')
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin + (volverA || window.location.pathname), ...(provider === 'azure' ? { scopes: 'email openid profile' } : {}) },
    })
    if (error) setError(/not enabled|Unsupported provider/i.test(error.message) ? 'Esta forma de entrar todavía no está activada. De momento, entre con su correo y contraseña.' : error.message)
  }
  return (
    <div className="entrar-con">
      <span className="entrar-con-o">o entre con</span>
      <button type="button" className="btn-oauth" onClick={() => entrar('google')}>{LOGOS.google} Google (Gmail)</button>
      <button type="button" className="btn-oauth" onClick={() => entrar('azure')}>{LOGOS.azure} Microsoft (Outlook)</button>
      {error && <p className="error">{error}</p>}
    </div>
  )
}
