import { useState } from 'react'

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
  const r = await fetch('/api/claves.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(d.error || 'No se ha podido conectar con el servidor.')
  return d
}

export default function Claves() {
  const [clave, setClave] = useState('')
  const [dentro, setDentro] = useState(false)
  const [cambiar, setCambiar] = useState(false)
  const [nueva, setNueva] = useState({ a: '', b: '' })
  const [estado, setEstado] = useState(null)
  const [v, setV] = useState({})
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')

  const entrar = async (e) => {
    e.preventDefault(); setError(''); setMsg('')
    try {
      const d = await llamar({ clave })
      if (d.cambiar) { setCambiar(true); return }
      setEstado(d.estado); setDentro(true)
    } catch (err) { setError(err.message) }
  }
  const cambiarClave = async (e) => {
    e.preventDefault(); setError('')
    if (nueva.a !== nueva.b) return setError('Las dos contraseñas no coinciden.')
    try {
      const d = await llamar({ clave, nueva: nueva.a })
      setClave(nueva.a); setCambiar(false); setEstado(d.estado); setDentro(true); setMsg('Contraseña cambiada. Guárdela en un lugar seguro.')
    } catch (err) { setError(err.message) }
  }
  const guardar = async (e) => {
    e.preventDefault(); setError(''); setMsg('')
    try {
      const d = await llamar({ clave, valores: v })
      setEstado(d.estado); setV({}); setMsg('Claves guardadas en el servidor.')
    } catch (err) { setError(err.message) }
  }

  if (cambiar)
    return (
      <form className="formulario" onSubmit={cambiarClave}>
        <p>Es la primera vez: ponga una contraseña nueva para las claves (al menos 10 caracteres). Solo la necesitarán quienes vayan a cambiar las claves de pago.</p>
        <label>Nueva contraseña<input type="password" required minLength={10} value={nueva.a} onChange={(e) => setNueva({ ...nueva, a: e.target.value })} autoComplete="new-password" /></label>
        <label>Repítala<input type="password" required minLength={10} value={nueva.b} onChange={(e) => setNueva({ ...nueva, b: e.target.value })} autoComplete="new-password" /></label>
        {error && <p className="error">{error}</p>}
        <button className="btn">Guardar contraseña</button>
      </form>
    )

  if (!dentro)
    return (
      <form className="formulario" onSubmit={entrar}>
        <p>Por seguridad, las claves de pago tienen su propia contraseña, que comprueba el servidor. La primera vez es <b>patriam12345</b> y le pedirá cambiarla.</p>
        <label>Contraseña de claves<input type="password" required value={clave} onChange={(e) => setClave(e.target.value)} autoComplete="current-password" /></label>
        {error && <p className="error">{error}</p>}
        <button className="btn">Entrar</button>
      </form>
    )

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
