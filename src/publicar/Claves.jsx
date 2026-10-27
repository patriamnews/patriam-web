import { useState } from 'react'

// Claves de los pagos y de la tienda. Se guardan en el servidor; aquí nunca se vuelven a ver enteras.
const CAMPOS = [
  ['stripe', 'Clave secreta de Stripe', 'Stripe › Desarrolladores › Claves de API › Clave secreta. Empieza por sk_live_ (o sk_test_ para pruebas).', 'sk_live_…'],
  ['stripeWebhook', 'Secreto del webhook de Stripe', 'Stripe › Desarrolladores › Webhooks › añadir destino https://movimientopatriam.es/api/stripe-webhook.php con el evento «checkout.session.completed». Empieza por whsec_.', 'whsec_…'],
  ['gelato', 'Clave de la API de Gelato', 'Gelato › Developer › API keys (la clave secreta).', ''],
  ['gelatoTienda', 'Identificador de la tienda de Gelato (Store ID)', 'El código que sale en la dirección del navegador al entrar en la tienda en Gelato.', ''],
]

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
      {CAMPOS.map(([k, t, ayuda, ph]) => (
        <label key={k}>
          {t} {estado?.[k] ? <span className="estado estado-publicado">Puesta {estado[k]}</span> : <span className="estado estado-rechazado">Sin poner</span>}
          <input type={k === 'gelatoTienda' ? 'text' : 'password'} value={v[k] || ''} onChange={(e) => setV({ ...v, [k]: e.target.value })} placeholder={ph} autoComplete="off" />
          <small>{ayuda}</small>
        </label>
      ))}
      {msg && <p className="aviso-ok">{msg}</p>}
      {error && <p className="error">{error}</p>}
      <button className="btn">Guardar claves</button>
    </form>
  )
}
