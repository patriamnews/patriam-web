import { entrar as entrarEquipo } from '../lib/equipo'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase, DEMO } from '../lib/supabase'
import { useAuth, destino } from '../lib/auth'
import { USUARIOS_DEMO, CLIENTES_DEMO } from '../lib/mock/seed'
import { reiniciarDemo } from '../lib/mock/client'
import { useSeo } from '../lib/seo'

// Acceso único para todos: equipo, asociados y clientes.
// Tras entrar, se reconoce el tipo de cuenta por el correo y se lleva a cada uno a su área.
export default function Acceso() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { session, tipo, cargando } = useAuth()
  const [modo, setModo] = useState(params.get('modo') || 'entrar') // entrar | registro | olvido
  const [f, setF] = useState({ nombre: '', email: '', clave: '' })
  const [msg, setMsg] = useState('')
  useSeo({ titulo: 'Acceder', noindex: true })
  const [error, setError] = useState('')

  // Redirección automática según el tipo de cuenta
  useEffect(() => {
    if (session && !cargando && tipo) navigate(destino(tipo), { replace: true })
  }, [session, tipo, cargando, navigate])

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  const enviar = async (e) => {
    e.preventDefault()
    setMsg('')
    setError('')
    if (modo === 'entrar') {
      const { error } = await entrarEquipo(f.email.trim(), f.clave)
      if (error) setError(error.message && !/Credenciales/.test(error.message) ? error.message : 'Email o contraseña incorrectos.')
    } else if (modo === 'registro') {
      const { error } = await supabase.auth.signUp({
        email: f.email.trim(),
        password: f.clave,
        options: { data: { nombre: f.nombre.trim(), tipo: 'cliente' }, emailRedirectTo: window.location.origin + '/#/acceso' },
      })
      if (error) setError(error.message)
      else if (!DEMO) setMsg('Le hemos enviado un email para confirmar su cuenta. Después podrá entrar.')
    } else {
      const { error } = await supabase.auth.resetPasswordForEmail(f.email.trim(), { redirectTo: window.location.origin + '/#/mi-cuenta/datos' })
      if (error) setError(error.message)
      else setMsg('Si el email existe, recibirá un enlace para crear una nueva contraseña.')
    }
  }

  if (session && cargando) return <div className="contenedor estrecho bloque">Entrando…</div>

  const entrarDemo = (u) => supabase.auth.signInWithPassword({ email: u.email, password: u.password })

  return (
    <div className="contenedor bloque pagina-acceso">
      <div className="acceso-caja">
        <h1>{modo === 'entrar' ? 'Acceder' : modo === 'registro' ? 'Crear cuenta' : 'Recuperar contraseña'}</h1>
        <p className="entradilla">
          {modo === 'entrar'
            ? 'Asociados, clientes y equipo de la asociación. Entre con su correo y le llevaremos a su área.'
            : modo === 'registro'
              ? 'Cree su cuenta para ver sus compras e inscripciones. Si ya es asociado, use el mismo correo con el que se dio de alta y verá también su cuota y sus pagos.'
              : 'Le enviaremos un enlace para crear una contraseña nueva.'}
        </p>
        <form className="formulario" onSubmit={enviar}>
          {modo === 'registro' && <label>Nombre y apellidos<input required value={f.nombre} onChange={set('nombre')} autoComplete="name" /></label>}
          <label>Email<input required type="email" value={f.email} onChange={set('email')} autoComplete="email" /></label>
          {modo !== 'olvido' && (
            <label>
              Contraseña{modo === 'registro' ? ' (mínimo 10 caracteres)' : ''}
              <input required type="password" minLength={modo === 'registro' ? 10 : undefined} value={f.clave} onChange={set('clave')} autoComplete={modo === 'entrar' ? 'current-password' : 'new-password'} />
            </label>
          )}
          {error && <p className="error">{error}</p>}
          {msg && <p className="aviso-ok">{msg}</p>}
          <button className="btn btn-bloque">{modo === 'entrar' ? 'Entrar' : modo === 'registro' ? 'Crear cuenta' : 'Enviar enlace'}</button>
        </form>
        <div className="enlaces-acceso">
          {modo !== 'entrar' && <button className="btn-texto" onClick={() => setModo('entrar')}>Ya tengo cuenta</button>}
          {modo !== 'registro' && <button className="btn-texto" onClick={() => setModo('registro')}>Crear una cuenta</button>}
          {modo !== 'olvido' && <button className="btn-texto" onClick={() => setModo('olvido')}>He olvidado mi contraseña</button>}
        </div>
        <p className="letra-pequena">
          ¿Aún no es asociado? <Link to="/adhierete">Hágase socio</Link>. Para formar parte del equipo de la web, pida acceso a la administración de la asociación.
        </p>
      </div>

      {DEMO && modo === 'entrar' && (
        <div className="caja-info cuentas-demo-caja">
          <b>Demostración: entre con una cuenta de prueba</b>
          <p className="letra-pequena">La web reconoce el tipo de cuenta y le lleva a su área.</p>
          <span className="etiqueta">Asociados y clientes</span>
          <div className="cuentas-demo">
            {CLIENTES_DEMO.map((u) => <button key={u.id} className="btn btn-claro" onClick={() => entrarDemo(u)}>{u.nombre} · {u.etiqueta}</button>)}
          </div>
          <span className="etiqueta">Equipo (panel de gestión)</span>
          <p className="letra-pequena">Isabel, Carlos, Álvaro y Laura entran con su propio correo y la contraseña inicial que se les ha comunicado. La primera vez, la web les pide cambiarla.</p>
          <ul className="letra-pequena equipo-demo">
            {USUARIOS_DEMO.map((u) => <li key={u.id}><b>{u.nombre}</b> · {u.etiqueta}</li>)}
          </ul>
          <button className="btn-texto" onClick={reiniciarDemo}>Reiniciar los datos de prueba</button>
        </div>
      )}
    </div>
  )
}
