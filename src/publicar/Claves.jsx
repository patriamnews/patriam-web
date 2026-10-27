import { useEffect, useState } from 'react'
import { useAuth } from '../lib/auth'
import { tokenEquipo } from '../lib/equipo'

// Claves de los pagos y de la tienda. Se guardan en el servidor; aquí nunca se vuelven a ver enteras.
// Todas las claves de las aplicaciones que usan la web y el boletín, agrupadas
const GRUPOS = [
  ['Cobros con tarjeta · Stripe', [
    ['stripe', 'Clave secreta (secret key)', 'Stripe › Desarrolladores › Claves de API › Clave secreta. Empieza por sk_live_ (o sk_test_ para pruebas).', 'sk_live_…'],
    ['stripeWebhook', 'Secreto del webhook', 'Stripe › Desarrolladores › Webhooks › añadir destino https://movimientopatriam.es/api/stripe-webhook.php con el evento «checkout.session.completed». Empieza por whsec_.', 'whsec_…'],
  ]],
  ['Tienda · Gelato (camisetas y tazas)', [
    ['gelato', 'Clave de la API (secret key)', 'Gelato › Developer › API keys.', ''],
    ['gelatoTienda', 'Identificador de la tienda (Store ID)', 'El código que sale en la dirección del navegador al entrar en la tienda en Gelato.', ''],
  ]],
  ['Tienda · Awin (libros de Casa del Libro)', [
    ['awin', 'Identificador de publisher de Awin', 'Awin › tu cuenta (número de publisher). No es secreto; sirve para los enlaces de afiliado.', ''],
  ]],
  ['Correo · Brevo (boletín y comunicaciones)', [
    ['brevo', 'Clave de la API', 'Brevo › SMTP y API › Claves de API. Empieza por xkeysib-.', 'xkeysib-…'],
  ]],
  ['WhatsApp · Meta (comunicaciones)', [
    ['waToken', 'Token de acceso', 'Meta › tu app › WhatsApp (mejor el token permanente de «Usuarios del sistema»).', 'EAA…'],
    ['waPhone', 'Identificador del número (Phone number ID)', 'Meta › WhatsApp › Configuración de la API (es un número largo, no el teléfono).', ''],
    ['waPlantilla', 'Nombre de la plantilla', 'La plantilla aprobada para las comunicaciones, por ejemplo comunicacion_patriam.', 'comunicacion_patriam'],
  ]],
]
const SIN_OCULTAR = ['gelatoTienda', 'awin', 'waPhone', 'waPlantilla']

async function llamar(cuerpo) {
  const r = await fetch('/api/claves.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: tokenEquipo(), ...cuerpo }) })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(d.error === 'sesion' ? 'sesion' : d.error || 'No se ha podido conectar con el servidor.')
  return d
}

export default function Claves() {
  const { salir } = useAuth()
  const [estado, setEstado] = useState(null)
  const [v, setV] = useState({})
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    llamar({}).then((d) => setEstado(d.estado)).catch((err) => setError(err.message))
  }, [])

  const guardar = async (e) => {
    e.preventDefault(); setError(''); setMsg('')
    try {
      const d = await llamar({ valores: v })
      setEstado(d.estado); setV({}); setMsg('Claves guardadas en el servidor.')
    } catch (err) { setError(err.message) }
  }

  if (error === 'sesion')
    return (
      <div>
        <p>Por seguridad, para ver las claves hay que volver a entrar con su email y su contraseña.</p>
        <button className="btn" onClick={salir}>Volver a entrar</button>
      </div>
    )
  if (!estado && !error) return <p className="vacio">Cargando…</p>

  return (
    <form className="formulario" onSubmit={guardar}>
      <p className="letra-pequena">Se guardan solo en el servidor de Hostinger, fuera de la web y de GitHub. Una vez guardadas no se vuelven a enseñar: solo sus últimas letras. Para cambiar una, escriba la nueva y guarde; para borrarla, escriba un guion (-).</p>
      {GRUPOS.map(([grupo, campos]) => (
        <fieldset key={grupo} className="grupo">
          <legend>{grupo}</legend>
          {campos.map(([k, t, ayuda, ph]) => (
            <label key={k}>
              {t} {estado?.[k] ? <span className="estado estado-publicado">Puesta {estado[k]}</span> : <span className="estado estado-rechazado">Sin poner</span>}
              <input type={SIN_OCULTAR.includes(k) ? 'text' : 'password'} value={v[k] || ''} onChange={(e) => setV({ ...v, [k]: e.target.value })} placeholder={ph} autoComplete="off" />
              <small>{ayuda}</small>
            </label>
          ))}
        </fieldset>
      ))}
      <div className="caja-info">
        <b>Supabase (base de datos)</b> no va aquí: su dirección y su clave pública se ponen en GitHub › patriam-web › Settings › Secrets and variables › Actions
        (VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY), porque la web las necesita al construirse. Las contraseñas de las cuentas (Hostinger, GitHub, Netlify…) van en el documento de accesos, no en la web.
      </div>
      {msg && <p className="aviso-ok">{msg}</p>}
      {error && <p className="error">{error}</p>}
      <button className="btn">Guardar claves</button>
    </form>
  )
}
