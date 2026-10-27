import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { getAjustes } from '../lib/data'

const CAMPOS = [
  ['Datos de pago', [
    ['titular_cuenta', 'Titular de la cuenta'],
    ['iban', 'IBAN de la asociación (para transferencias)'],
    ['bizum', 'Código Bizum (lo facilita el banco al dar de alta el servicio)'],
    ['cuota', 'Cuota mensual normal de asociado (€)'],
    ['cuota_reducida', 'Cuota mensual reducida (€): familia numerosa, estudiantes, jubilados, desempleados y familiares de un afiliado'],
    ['donativos', 'Donativos sugeridos (€, separados por comas)'],
  ]],
  ['Tienda', [
    ['envio_coste', 'Envío de la primera prenda (€, IVA incluido): lo que cobra Gelato'],
    ['envio_adicional', 'Envío de cada prenda más en el mismo pedido (€)'],
    ['envio_gratis_desde', 'Envío gratis a partir de (€; vacío = nunca)'],
  ]],
  ['Boletín semanal', [
    ['boletin_url', 'Dirección del boletín «Lo que hay que saber» (p. ej. https://boletin.movimientopatriam.es/)'],
  ]],
  ['Contacto y redes sociales', [
    ['email_contacto', 'Email de contacto público'],
    ['x', 'X (Twitter)'],
    ['instagram', 'Instagram'],
    ['facebook', 'Facebook'],
    ['youtube', 'YouTube'],
    ['telegram', 'Telegram'],
    ['tiktok', 'TikTok'],
  ]],
]

export default function Ajustes() {
  const [a, setA] = useState(null)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    getAjustes().then((d) => setA({ id: 1, ...d }))
  }, [])

  const guardar = async (e) => {
    e.preventDefault()
    const { error } = await supabase.from('ajustes').upsert(a)
    setMsg(error ? 'Error: ' + error.message : 'Guardado.')
  }

  if (!a) return <p>Cargando…</p>
  return (
    <>
      <h1>Ajustes de la web</h1>
      <div className="caja-info">
        <b>Pago con tarjeta (Stripe) y tienda (Gelato).</b> Sus claves se ponen en Publicar › Claves de pagos y tienda, con su propia contraseña,
        y se guardan solo en el servidor. <a href="/#/publicar/claves">Ir a las claves →</a>
      </div>
      <form className="formulario" onSubmit={guardar}>
        {CAMPOS.map(([grupo, campos]) => (
          <fieldset key={grupo} className="grupo tarjeta-form">
            <legend>{grupo}</legend>
            {campos.map(([k, l]) => (
              <label key={k}>{l}<input value={a[k] || ''} onChange={(e) => setA({ ...a, [k]: e.target.value })} /></label>
            ))}
            {grupo === 'Datos de pago' && <p className="letra-pequena">El pago con tarjeta se conectará más adelante (pasarela del banco o Stripe).</p>}
          </fieldset>
        ))}
        <p className="letra-pequena">Los campos de redes vacíos no se muestran en la web.</p>
        {msg && <p className="aviso-ok">{msg}</p>}
        <div className="acciones"><button className="btn">Guardar ajustes</button></div>
      </form>
    </>
  )
}
