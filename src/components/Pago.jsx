import { useEffect, useRef, useState } from 'react'
// Medios de pago comunes (adhesión, donativos y tienda).
// PROTOTIPO: los pagos no están conectados. En producción:
//  - Tarjeta, Google Pay y Apple Pay: con PayPal (o Stripe si PayPal no está activado). La asociación no ve los datos de la tarjeta.
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

// ---------- Pago con PayPal: tarjeta (sin cuenta de PayPal), Google Pay y Apple Pay ----------
// Los datos de la tarjeta se escriben en campos de PayPal incrustados en la página: la web nunca los ve.
// El importe lo fija el servidor (api/paypal.php). Si PayPal no está activado, se usa Stripe (abajo).
const scripts = {}
function cargarScript(src) {
  if (!scripts[src])
    scripts[src] = new Promise((ok, mal) => {
      const s = document.createElement('script')
      s.src = src
      s.async = true
      s.onload = ok
      s.onerror = () => { delete scripts[src]; mal(new Error('script')) }
      document.head.appendChild(s)
    })
  return scripts[src]
}
async function apiPayPal(cuerpo) {
  const r = await fetch('/api/paypal.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) })
  const d = await r.json().catch(() => ({}))
  if (!r.ok || d.error) throw new Error(d.error || 'No se ha podido conectar con el pago. Inténtelo de nuevo.')
  return d
}
let configPP = null
const configPayPal = () => (configPP ||= apiPayPal({ accion: 'config' }).catch(() => ({ activo: false })))

const ESTILO_CAMPOS = {
  input: { 'font-size': '16px', 'font-family': 'Georgia, serif', color: '#2b2118', padding: '0.6rem' },
  '.invalid': { color: '#a4262c' },
}

function PagoPayPal({ pago, importe, conf }) {
  const [error, setError] = useState('')
  const [pagando, setPagando] = useState(false)
  const [tarjeta, setTarjeta] = useState(null) // null: cargando · false: no disponible · objeto: campos listos
  const [carteras, setCarteras] = useState(false)
  const r = { nombre: useRef(null), numero: useRef(null), caducidad: useRef(null), cvv: useRef(null), gpay: useRef(null), apay: useRef(null) }
  const esCuota = pago.tipo === 'cuota'
  const total = Number(importe).toFixed(2)

  const crear = async (metodo) => (await apiPayPal({ accion: 'crear', metodo, ...pago })).id
  const capturar = async (id) => apiPayPal({ accion: 'capturar', id })
  const terminar = (d) => { window.location.href = `/pago-correcto?ref=${encodeURIComponent(d.ref)}&tipo=${d.tipo}` }
  const fallo = (e) => { setError(e?.message && !/^script$/.test(e.message) ? e.message : 'No se ha podido completar el pago. Inténtelo de nuevo.'); setPagando(false) }

  useEffect(() => {
    let vivo = true
    const sdk = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(conf.clientId)}&components=card-fields,googlepay,applepay&currency=EUR&intent=capture&locale=es_ES`
    cargarScript(sdk)
      .then(() => {
        if (!vivo) return
        const pp = window.paypal
        // Tarjeta
        const cf = pp.CardFields({
          createOrder: () => crear('tarjeta'),
          onApprove: async (d) => { try { terminar(await capturar(d.orderID)) } catch (e) { fallo(e) } },
          onError: (e) => fallo(e),
          style: ESTILO_CAMPOS,
        })
        if (cf.isEligible()) {
          cf.NameField({ placeholder: 'Nombre como aparece en la tarjeta' }).render(r.nombre.current)
          cf.NumberField({ placeholder: 'Número de la tarjeta' }).render(r.numero.current)
          cf.ExpiryField({ placeholder: 'MM/AA' }).render(r.caducidad.current)
          cf.CVVField({ placeholder: 'CVV' }).render(r.cvv.current)
          setTarjeta(cf)
        } else setTarjeta(false)
        // Google Pay y Apple Pay (pagos sueltos: tienda y donativos)
        if (!esCuota) { googlePay(pp); applePay(pp) }
      })
      .catch(() => vivo && setTarjeta(false))
    return () => { vivo = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function googlePay(pp) {
    try {
      await cargarScript('https://pay.google.com/gp/p/js/pay.js')
      const gp = pp.Googlepay()
      const c = await gp.config()
      if (!c.isEligible) return
      const cliente = new window.google.payments.api.PaymentsClient({ environment: conf.modo === 'live' ? 'PRODUCTION' : 'TEST' })
      const base = { apiVersion: c.apiVersion, apiVersionMinor: c.apiVersionMinor, allowedPaymentMethods: c.allowedPaymentMethods }
      if (!(await cliente.isReadyToPay(base)).result) return
      const boton = cliente.createButton({
        buttonType: 'pay', buttonLocale: 'es', buttonSizeMode: 'fill', allowedPaymentMethods: c.allowedPaymentMethods,
        onClick: async () => {
          setError('')
          let datos
          try {
            datos = await cliente.loadPaymentData({ ...base, merchantInfo: c.merchantInfo,
              transactionInfo: { countryCode: c.countryCode || 'ES', currencyCode: 'EUR', totalPriceStatus: 'FINAL', totalPrice: total, totalPriceLabel: 'Total' } })
          } catch { return } // cancelado por quien paga
          setPagando(true)
          try {
            const id = await crear('googlepay')
            const { status } = await gp.confirmOrder({ orderId: id, paymentMethodData: datos.paymentMethodData })
            if (status === 'PAYER_ACTION_REQUIRED') await gp.initiatePayerAction({ orderId: id })
            terminar(await capturar(id))
          } catch (e) { fallo(e) }
        },
      })
      r.gpay.current?.replaceChildren(boton)
      setCarteras(true)
    } catch { /* Google Pay no disponible en este navegador */ }
  }

  async function applePay(pp) {
    try {
      await cargarScript('https://applepay.cdn-apple.com/jsapi/1.latest/apple-pay-sdk.js')
      const APS = window.ApplePaySession
      if (!APS || !APS.canMakePayments()) return
      const ap = pp.Applepay()
      const c = await ap.config()
      if (!c.isEligible) return
      const boton = document.createElement('apple-pay-button')
      boton.setAttribute('buttonstyle', 'black')
      boton.setAttribute('type', 'pay')
      boton.setAttribute('locale', 'es-ES')
      boton.addEventListener('click', () => {
        setError('')
        const s = new APS(4, {
          countryCode: c.countryCode, currencyCode: 'EUR', merchantCapabilities: c.merchantCapabilities, supportedNetworks: c.supportedNetworks,
          requiredBillingContactFields: ['postalAddress'], total: { label: 'PATRIAM', type: 'final', amount: total },
        })
        s.onvalidatemerchant = (ev) => ap.validateMerchant({ validationUrl: ev.validationURL }).then((v) => s.completeMerchantValidation(v.merchantSession)).catch(() => s.abort())
        s.onpaymentauthorized = async (ev) => {
          setPagando(true)
          try {
            const id = await crear('applepay')
            await ap.confirmOrder({ orderId: id, token: ev.payment.token, billingContact: ev.payment.billingContact })
            const d = await capturar(id)
            s.completePayment(APS.STATUS_SUCCESS)
            terminar(d)
          } catch (e) { s.completePayment(APS.STATUS_FAILURE); fallo(e) }
        }
        s.begin()
      })
      r.apay.current?.replaceChildren(boton)
      setCarteras(true)
    } catch { /* Apple Pay no disponible en este navegador */ }
  }

  const pagarTarjeta = () => {
    setError(''); setPagando(true)
    tarjeta.submit().catch((e) => fallo(e?.message?.includes('INVALID') ? new Error('Revise los datos de la tarjeta.') : e))
  }

  return (
    <div className="pago-paypal">
      <div className="pago-carteras" hidden={!carteras}>
        <div ref={r.apay} />
        <div ref={r.gpay} />
        {carteras && <p className="pago-o"><span>o con tarjeta</span></p>}
      </div>
      <div className="pago-tarjeta" hidden={tarjeta === false}>
        <div ref={r.nombre} />
        <div ref={r.numero} />
        <div className="pago-fila"><div ref={r.caducidad} /><div ref={r.cvv} /></div>
        {tarjeta === null && <p className="vacio">Cargando el pago seguro…</p>}
        {tarjeta && (
          <button type="button" className="btn btn-bloque" disabled={pagando} onClick={pagarTarjeta}>
            {pagando ? 'Procesando el pago…' : `Pagar ${euros(importe)}${esCuota ? ' al mes' : ''}`}
          </button>
        )}
      </div>
      {tarjeta === false && !carteras && <p className="error">El pago con tarjeta no está disponible en este momento. Inténtelo más tarde o escríbanos.</p>}
      {error && <p className="error">{error}</p>}
      <p className="letra-pequena">
        Pago seguro gestionado por PayPal. No necesita cuenta de PayPal. PATRIAM no ve ni guarda los datos de su tarjeta.
        {esCuota && ' Su tarjeta queda guardada en PayPal para cobrar la cuota cada mes; puede pedir la baja cuando quiera desde su área de asociado.'}
      </p>
    </div>
  )
}

function Pagar({ pago, importe }) {
  const [conf, setConf] = useState(null)
  useEffect(() => { configPayPal().then(setConf) }, [])
  if (!conf) return <p className="vacio">Cargando el pago seguro…</p>
  return conf.activo ? <PagoPayPal pago={pago} importe={importe} conf={conf} /> : <BotonPagar pago={pago} />
}

// Respaldo: pago con Stripe Checkout (solo si PayPal no está activado): la web pide al servidor (api/pago.php) una página de pago segura de Stripe
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
          <p>Importe: {cuanto}.</p>
          {pago && <Pagar pago={{ referencia: refe, ...pago }} importe={importe} />}
        </>
      )}
      {!(metodo === 'tarjeta' && pago) && <AvisoPrototipo />}
    </>
  )
}
