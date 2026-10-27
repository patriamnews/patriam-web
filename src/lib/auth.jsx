import { salirEquipo } from './equipo'
import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase'

const AuthCtx = createContext(null)

// Tipo de cuenta según el correo con el que se entra:
//  - 'equipo':   miembro activo del equipo (rol autor, editor, director o admin) → panel de gestión
//  - 'asociado': tiene ficha de socio (alta o pendiente)                          → Mi cuenta, vista de asociado
//  - 'cliente':  cualquier otra cuenta (compras, inscripciones)                   → Mi cuenta, vista de cliente
export const tipoCuenta = (perfil, socio) => {
  if (perfil?.activo && ['autor', 'editor', 'director', 'admin'].includes(perfil.rol)) return 'equipo'
  if (socio && socio.estado !== 'baja') return 'asociado'
  return 'cliente'
}

export const destino = (tipo) => (tipo === 'equipo' ? '/gestion' : '/mi-cuenta')

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [perfil, setPerfil] = useState(null)
  const [socio, setSocio] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [version, setVersion] = useState(0)
  const [cargadoPara, setCargadoPara] = useState(null) // id del usuario cuyos datos ya se han cargado

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      if (!data.session) setCargando(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) {
      setPerfil(null)
      setSocio(null)
      setCargando(false)
      return
    }
    setCargando(true)
    ;(async () => {
      const { data: p } = await supabase.from('perfiles').select('*').eq('id', session.user.id).maybeSingle()
      // La ficha de socio se reconoce por la cuenta o por el correo (las reglas de la base de datos solo devuelven la propia)
      const email = (session.user.email || '').toLowerCase()
      const { data: s } = await supabase.from('socios').select('*').neq('estado', 'baja').order('creado_at', { ascending: false })
      setPerfil(p)
      setSocio((s || []).find((x) => x.usuario_id === session.user.id || (x.email || '').toLowerCase() === email) || null)
      setCargadoPara(session.user.id)
      setCargando(false)
    })()
  }, [session, version])

  const salir = () => { salirEquipo(); return supabase.auth.signOut() }
  const recargar = () => setVersion((v) => v + 1)
  // Mientras no se han cargado los datos de la sesión actual, no se decide el tipo de cuenta
  const listo = !session || cargadoPara === session.user.id
  const tipo = session && listo ? tipoCuenta(perfil, socio) : null

  return (
    <AuthCtx.Provider value={{ session, perfil, socio, tipo, cargando: cargando || !listo, salir, recargar }}>
      {children}
    </AuthCtx.Provider>
  )
}

export const useAuth = () => useContext(AuthCtx)
