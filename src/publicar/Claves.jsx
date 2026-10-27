import { useEffect, useState } from 'react'
import { useAuth } from '../lib/auth'
import { tokenEquipo } from '../lib/equipo'

// Cuentas y claves de todas las aplicaciones que usan la web y el boletín.
// Cada una: para qué sirve, dónde se entra, usuario, contraseña, claves de API y notas.
// Se guardan solo en el servidor (fuera de la web y de GitHub) y las ve el equipo al entrar en Publicar.
// Las «claves de API» marcadas son las que usan de verdad la web y el boletín para funcionar.
const APPS = [
  { id: 'hostinger', nombre: 'Hostinger', para: 'Alojamiento de la web y del boletín, dominios movimientopatriam (.es, .org, .com, .net) y subdominios', url: 'https://hpanel.hostinger.com' },
  { id: 'hostinger-correo', nombre: 'Hostinger · correo', para: 'Buzón hola@movimientopatriam.com: recibe todo el correo de PATRIAM y los avisos de pedidos', url: 'https://mail.hostinger.com' },
  { id: 'github', nombre: 'GitHub', para: 'Código de la web (patriam-web) y del boletín (boletin.patriam). Cada cambio se publica solo', url: 'https://github.com/patriamnews' },
  { id: 'netlify', nombre: 'Netlify', para: 'Servidor del boletín: sesiones del editor, suscriptores y datos', url: 'https://app.netlify.com' },
  { id: 'supabase', nombre: 'Supabase', para: 'Base de datos de la web (pendiente de conectar)', url: 'https://supabase.com/dashboard',
    claves: [['supabaseUrl', 'Dirección del proyecto (Project URL)', 'https://xxxx.supabase.co'], ['supabaseAnon', 'Clave pública (anon key)', 'eyJ…']],
    nota: 'Para conectarla de verdad, estas dos también se ponen en GitHub › patriam-web › Settings › Secrets and variables › Actions.' },
  { id: 'brevo', nombre: 'Brevo', para: 'Envía por correo el boletín y las comunicaciones', url: 'https://app.brevo.com',
    claves: [['brevo', 'Clave de la API (xkeysib-…)', 'xkeysib-…', true]] },
  { id: 'meta', nombre: 'Meta · WhatsApp Business', para: 'Envío de las comunicaciones por WhatsApp', url: 'https://business.facebook.com',
    claves: [['waToken', 'Token de acceso', 'EAA…', true], ['waPhone', 'Identificador del número (Phone number ID)', '', true], ['waPlantilla', 'Nombre de la plantilla', 'comunicacion_patriam', true]] },
  { id: 'stripe', nombre: 'Stripe', para: 'Cobros con tarjeta: cuotas, donativos y tienda', url: 'https://dashboard.stripe.com',
    claves: [['stripe', 'Clave secreta (sk_live_…)', 'sk_live_…', true], ['stripePublica', 'Clave publicable (pk_live_…)', 'pk_live_…'], ['stripeWebhook', 'Secreto del webhook (whsec_…)', 'whsec_…', true]],
    nota: 'Webhook: https://movimientopatriam.es/api/stripe-webhook.php con el evento checkout.session.completed.' },
  { id: 'gelato', nombre: 'Gelato', para: 'Fabrica y envía camisetas, sudaderas y tazas de la tienda', url: 'https://dashboard.gelato.com',
    claves: [['gelato', 'Clave de la API (secret key)', '', true], ['gelatoTienda', 'Identificador de la tienda (Store ID)', '', true]] },
  { id: 'awin', nombre: 'Awin · Casa del Libro', para: 'Enlaces de afiliado de los libros recomendados', url: 'https://ui.awin.com',
    claves: [['awin', 'Identificador de publisher', '', true]] },
  { id: 'citizengo', nombre: 'CitizenGO', para: 'Campañas de recogida de firmas', url: 'https://www.citizengo.org' },
  { id: 'gmail-contacto', nombre: 'Gmail · contacto', para: 'movimientopatriam@gmail.com: contacto público y delegado de protección de datos', url: 'https://mail.google.com' },
  { id: 'gmail-tecnico', nombre: 'Gmail · técnico', para: 'boletin.patriam@gmail.com: cuenta de GitHub y Netlify', url: 'https://mail.google.com' },
  { id: 'vercel', nombre: 'Vercel', para: 'Cuenta creada para PATRIAM (ahora no se usa)', url: 'https://vercel.com' },
  { id: 'x', nombre: 'X (Twitter)', para: 'Cuenta oficial @patriam_es', url: 'https://x.com' },
  { id: 'instagram', nombre: 'Instagram', para: 'Cuenta oficial', url: 'https://instagram.com' },
  { id: 'telegram', nombre: 'Telegram', para: 'Canal oficial', url: 'https://web.telegram.org' },
]

async function llamar(cuerpo) {
  const r = await fetch('/api/claves.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: tokenEquipo(), ...cuerpo }) })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(d.error === 'sesion' ? 'sesion' : d.error || 'No se ha podido conectar con el servidor.')
  return d
}

function Campo({ etiqueta, valor, onChange, secreto, placeholder }) {
  const [ver, setVer] = useState(false)
  const copiar = () => navigator.clipboard?.writeText(valor || '')
  return (
    <label className="cuenta-campo">
      <span>{etiqueta}</span>
      <span className="cuenta-input">
        <input type={secreto && !ver ? 'password' : 'text'} value={valor || ''} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} autoComplete="off" spellCheck={false} />
        {secreto && <button type="button" className="btn-texto" onClick={() => setVer(!ver)}>{ver ? 'Ocultar' : 'Ver'}</button>}
        {valor && <button type="button" className="btn-texto" onClick={copiar}>Copiar</button>}
      </span>
    </label>
  )
}

export default function Claves() {
  const { salir } = useAuth()
  const [claves, setClaves] = useState(null)
  const [cuentas, setCuentas] = useState({})
  const [abierta, setAbierta] = useState(null)
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    llamar({}).then((d) => { setClaves(d.claves || {}); setCuentas(d.cuentas || {}) }).catch((err) => setError(err.message))
  }, [])

  const guardar = async (app) => {
    setError(''); setMsg('')
    const valores = Object.fromEntries((app.claves || []).map(([k]) => [k, claves[k] || '']))
    try {
      const d = await llamar({ valores, cuentas: { [app.id]: cuentas[app.id] || {} } })
      setClaves(d.claves || {}); setCuentas(d.cuentas || {}); setMsg(`${app.nombre}: guardado.`)
    } catch (err) { setError(err.message) }
  }

  if (error === 'sesion')
    return (
      <div>
        <p>Por seguridad, para ver las claves hay que volver a entrar con su email y su contraseña.</p>
        <button className="btn" onClick={salir}>Volver a entrar</button>
      </div>
    )
  if (!claves) return error ? <p className="error">{error}</p> : <p className="vacio">Cargando…</p>

  const setCuenta = (id, k, v) => setCuentas({ ...cuentas, [id]: { ...(cuentas[id] || {}), [k]: v } })
  const completa = (a) => (cuentas[a.id]?.usuario ? 1 : 0) + (a.claves || []).filter(([k, , , usada]) => usada && claves[k]).length

  return (
    <div className="cuentas">
      <p className="caja-aviso">
        Aquí están el usuario, la contraseña y las claves de cada aplicación, para poder pasárselas a los responsables. Las ve todo el equipo al entrar en
        Publicar: cuando cada responsable tenga su acceso, conviene que cambie la contraseña. Se guardan solo en el servidor, no en la web ni en GitHub.
      </p>
      {msg && <p className="aviso-ok">{msg}</p>}
      {error && <p className="error">{error}</p>}
      {APPS.map((a) => (
        <div key={a.id} className={`cuenta ${abierta === a.id ? 'abierta' : ''}`}>
          <button type="button" className="cuenta-cab" onClick={() => setAbierta(abierta === a.id ? null : a.id)}>
            <span><b>{a.nombre}</b><small>{a.para}</small></span>
            <span className="mini">{completa(a) ? '✓ ' : ''}{abierta === a.id ? 'Cerrar' : 'Abrir'}</span>
          </button>
          {abierta === a.id && (
            <div className="cuenta-cuerpo">
              <p className="mini"><a href={a.url} target="_blank" rel="noopener noreferrer">{a.url.replace('https://', '')} ↗</a></p>
              <Campo etiqueta="Usuario o email de acceso" valor={cuentas[a.id]?.usuario} onChange={(v) => setCuenta(a.id, 'usuario', v)} />
              <Campo etiqueta="Contraseña" valor={cuentas[a.id]?.clave} onChange={(v) => setCuenta(a.id, 'clave', v)} secreto />
              {(a.claves || []).map(([k, t, ph, usada]) => (
                <Campo key={k} etiqueta={t + (usada ? ' · la usa la web' : '')} valor={claves[k]} onChange={(v) => setClaves({ ...claves, [k]: v })} secreto={!['gelatoTienda', 'waPhone', 'waPlantilla', 'awin', 'supabaseUrl'].includes(k)} placeholder={ph} />
              ))}
              {a.nota && <p className="letra-pequena">{a.nota}</p>}
              <label className="cuenta-campo">
                <span>Notas (verificación en dos pasos, móvil de recuperación…)</span>
                <textarea rows={2} value={cuentas[a.id]?.notas || ''} onChange={(e) => setCuenta(a.id, 'notas', e.target.value)} />
              </label>
              <button type="button" className="btn" onClick={() => guardar(a)}>Guardar {a.nombre}</button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
