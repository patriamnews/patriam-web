import { supabase, DEMO } from './supabase'

// Entrada del equipo comprobada en el servidor (api/equipo.php): la misma contraseña sirve para Publicar,
// la Gestión y las claves secretas. Asociados y clientes entran como siempre.
const T = 'patriam-equipo-token'
export const tokenEquipo = () => { try { return sessionStorage.getItem(T) || '' } catch { return '' } }
const guardarToken = (t) => { try { t ? sessionStorage.setItem(T, t) : sessionStorage.removeItem(T) } catch { /* sin almacenamiento */ } }

async function api(cuerpo) {
  const r = await fetch('/api/equipo.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) })
  const d = await r.json().catch(() => null)
  return { r, d }
}

export async function entrar(email, clave) {
  let res
  try { res = await api({ accion: 'entrar', email, clave }) } catch { res = null }
  // Sin servidor (pruebas en local) o no es del equipo: entrada normal
  if (!res || !res.d || res.d.equipo === false) return supabase.auth.signInWithPassword({ email, password: clave })
  if (!res.r.ok) return { error: { message: res.d.error || 'Email o contraseña incorrectos.' } }
  guardarToken(res.d.token)
  if (DEMO) return supabase.auth.entrarEquipo(email, res.d.cambiar)
  const primero = await supabase.auth.signInWithPassword({ email, password: clave })
  if (!primero.error) return primero
  // La contraseña buena es la del servidor: se copia a la base de datos y se vuelve a entrar
  const { data: ok } = await supabase.rpc('sincronizar_clave_equipo', { p_email: email, p_clave: clave })
  return ok ? supabase.auth.signInWithPassword({ email, password: clave }) : primero
}

export async function cambiarClaveEquipo(nueva) {
  const token = tokenEquipo()
  if (!token) return { ok: true }
  const { r, d } = await api({ accion: 'cambiar', token, nueva })
  return r.ok ? { ok: true } : { error: d?.error === 'sesion' ? 'La sesión ha caducado: vuelva a entrar.' : d?.error || 'No se ha podido cambiar.' }
}

export const salirEquipo = () => guardarToken('')
