import { useState } from 'react'
// Medios de pago comunes (adhesión, donativos y tienda).
// PROTOTIPO: los pagos no están conectados. En producción:
//  - Tarjeta: pasarela (Stripe o TPV virtual del banco/Redsys). La asociación no ve los datos de la tarjeta.
//  - Bizum: alta de la asociación en "Bizum ONG" o Bizum para comercios a través del banco.
//  - Transferencia: se muestra el IBAN de la asociación y una referencia para conciliar.
import { euros } from '../lib/data'

// Por ahora solo se paga con tarjeta. Bizum y transferencia están desactivados:
// para volver a ofrecerlos, añadirlos de nuevo a esta lista.
export const METODOS = {
  tarjeta: 'Tarjeta (Visa, Mastercard, Apple Pay, Google Pay)',
}
export const METODOS_DESACTIVADOS = { bizum: 'Bizum', transferencia: 'Transferencia bancaria' }

const PERIODOS = { mensual: 'al mes', trimestral: 'al trimestre', anual: 'al año' }

export function Metodos({ valor, onChange }) {
  return (
    <div className="metodos">
      {Object.entries(METODOS).map(([m, texto]) => (
        <label key={m} className={`metodo ${valor === m ? 'activo' : ''}`}>
          <input type="radio" name="metodo" value={m} checked={valor === m} onChange={() => onChange(m)} />
          {texto}
        </label>
      ))}
    </div>
  )
}

export function AvisoPrototipo() {
  return <p className="caja-aviso">Prototipo: el pago todavía no está conectado. No se realizará ningún cargo.</p>
}

// Pago con tarjeta con Stripe Checkout: la web pide al servidor (api/pago.php) una página de pago segura de Stripe
// con el importe total (todos los artículos juntos). La clave de Stripe solo está en el servidor.
async function irAPagar(pago, setError, setYendo) {
  setError(''); setYendo(true)
  try {
    const r = await fetch('/api/pago.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(pago) })
    const d = await r.json().catch(() => ({}))
    if (d.url) { window.location.href = d.url; return }
    setError(d.error || 'No se ha podido abrir el pago.')
  } catch { setError('No se ha podido conectar con el pago. Inténtelo de nuevo.') }
  setYendo(false)
}

function BotonPagar({ pago }) {
  const [error, setError] = useState('')
  const [yendo, setYendo] = useState(false)
  return (
    <>
      <p><button type="button" className="btn" disabled={yendo} onClick={() => irAPagar(pago, setError, setYendo)}>{yendo ? 'Abriendo el pago…' : 'Pagar con tarjeta'}</button></p>
      {error && <p className="error">{error}</p>}
    </>
  )
}

export function Instrucciones({ metodo, importe, refe, aj, periodo, pago }) {
  const cuanto = (
    <>
      <b>{euros(importe)}</b>
      {periodo ? ` ${PERIODOS[periodo]}` : ''}
    </>
  )
  return (
    <>
      {metodo === 'transferencia' && (
        <ul>
          <li>IBAN: <b>{aj.iban || '[IBAN DE LA ASOCIACIÓN]'}</b></li>
          <li>Titular: {aj.titular_cuenta || '[DENOMINACIÓN]'}</li>
          <li>Importe: {cuanto}</li>
          <li>Concepto: <b>{refe}</b></li>
          {periodo && <li>Puede programar una transferencia periódica en su banco.</li>}
        </ul>
      )}
      {metodo === 'bizum' && (
        <ul>
          <li>Código Bizum: <b>{aj.bizum || '[CÓDIGO]'}</b></li>
          <li>Importe: {cuanto}</li>
          <li>Concepto: <b>{refe}</b></li>
        </ul>
      )}
      {metodo === 'tarjeta' && (
        <>
          <p>
            Importe: {cuanto}. El pago se completa en la pasarela segura de Stripe. La asociación no recibe ni guarda los datos de su tarjeta.
          </p>
          {pago && <BotonPagar pago={{ referencia: refe, ...pago }} />}
        </>
      )}
      {!(metodo === 'tarjeta' && pago) && <AvisoPrototipo />}
    </>
  )
}
