// Medios de pago comunes (adhesión, donativos y tienda).
// PROTOTIPO: los pagos no están conectados. En producción:
//  - Tarjeta: pasarela (Stripe o TPV virtual del banco/Redsys). La asociación no ve los datos de la tarjeta.
//  - Bizum: alta de la asociación en "Bizum ONG" o Bizum para comercios a través del banco.
//  - Transferencia: se muestra el IBAN de la asociación y una referencia para conciliar.
import { euros } from '../lib/data'

export const METODOS = {
  tarjeta: 'Tarjeta (Visa, Mastercard, Apple Pay, Google Pay)',
  bizum: 'Bizum',
  transferencia: 'Transferencia bancaria',
}

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

export function Instrucciones({ metodo, importe, refe, aj, periodo }) {
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
        <p>
          Importe: {cuanto}. El pago se completa en la pasarela segura del banco. La asociación no recibe ni guarda los datos de su tarjeta.
        </p>
      )}
      <AvisoPrototipo />
    </>
  )
}
