import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { getAjustes, getPagina, enviarSocio, registrarDonativo, referencia, euros } from '../lib/data'
import { Metodos, Instrucciones } from '../components/Pago'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { huella } from '../lib/documentos'
import { enviarCorreo } from '../lib/correo'
import FirmaDocumentos from '../components/FirmaDocumentos'
import Texto from '../components/Texto'

const PERIODOS = { mensual: 'al mes', trimestral: 'al trimestre', anual: 'al año' }
const lista = (s) => (s || '').split(',').map((x) => Number(x.trim())).filter(Boolean)

export default function Adhesion() {
  const [params, setParams] = useSearchParams()
  const pestana = params.get('tipo') === 'donativo' ? 'donativo' : 'socio'
  const [intro, setIntro] = useState(null)
  const [aj, setAj] = useState(null)
  const { tipo, socio } = useAuth()

  useEffect(() => {
    getPagina('adhesion').then(setIntro)
    getAjustes().then(setAj)
  }, [])

  return (
    <div className="contenedor estrecho bloque">
      <h1>{intro?.titulo || 'Adhiérete'}</h1>
      {intro?.contenido && <Texto>{intro.contenido}</Texto>}
      <div className="pestanas grandes">
        <button className={pestana === 'socio' ? 'activa' : ''} onClick={() => setParams({})}>Hazte socio</button>
        <button className={pestana === 'donativo' ? 'activa' : ''} onClick={() => setParams({ tipo: 'donativo' })}>Haz un donativo</button>
      </div>
      {aj && pestana === 'socio' && socio && tipo !== 'equipo' ? (
        <div className="aviso-ok grande">
          <h2>Ya es asociado</h2>
          <p>Consulte su carnet, su cuota y sus pagos en <Link to="/mi-cuenta">su área de asociado</Link>.</p>
        </div>
      ) : (
        aj && (pestana === 'socio' ? <Socio aj={aj} /> : <Donativo aj={aj} />)
      )}
    </div>
  )
}

function Importes({ opciones, valor, onChange, sufijo = '' }) {
  const [otro, setOtro] = useState(false)
  return (
    <div className="importes">
      {opciones.map((n) => (
        <button type="button" key={n} className={!otro && valor === n ? 'activo' : ''} onClick={() => { setOtro(false); onChange(n) }}>
          {euros(n)}{sufijo}
        </button>
      ))}
      <button type="button" className={otro ? 'activo' : ''} onClick={() => setOtro(true)}>Otro</button>
      {otro && <input type="number" min="1" step="1" placeholder="€" value={valor || ''} onChange={(e) => onChange(Number(e.target.value))} />}
    </div>
  )
}

function Socio({ aj }) {
  const cuotas = lista(aj.cuotas)
  const { session, perfil } = useAuth()
  const [f, setF] = useState({ nombre: perfil?.nombre || '', email: session?.user?.email || '', municipio: '', cuota: cuotas[1] || cuotas[0] || 10, periodicidad: 'mensual', metodo: 'tarjeta' })
  const [paso, setPaso] = useState(1) // 1 datos · 2 documentos y firma · 3 hecho
  const [ok, setOk] = useState(null)
  const [mayor, setMayor] = useState(false)
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  const continuar = (e) => {
    e.preventDefault()
    setError('')
    if (!mayor) return setError('Debe declarar que es mayor de edad.')
    if (!(f.cuota > 0)) return setError('Indique la cuota.')
    setPaso(2)
    window.scrollTo(0, 0)
  }

  // Firma de los documentos: se guarda la solicitud y un registro por cada documento firmado
  const firmar = async (docs, firmaTecleada) => {
    setEnviando(true)
    setError('')
    const ref = referencia('SOC')
    const datos = {
      nombre: f.nombre.trim(), email: f.email.trim(), municipio: f.municipio.trim() || null,
      cuota: f.cuota, periodicidad: f.periodicidad, metodo: f.metodo, referencia: ref,
      estado: 'pendiente', consentimiento: true,
    }
    const { error } = await enviarSocio(datos)
    if (error) {
      setEnviando(false)
      return setError('No se ha podido enviar: ' + error.message)
    }
    const registros = []
    for (const d of docs) {
      registros.push({
        referencia: ref, nombre_firmante: datos.nombre, email: datos.email, documento: d.clave, titulo: d.titulo,
        texto: d.texto, hash_documento: await huella(d.texto), firma: firmaTecleada, aceptado: true,
        metodo: 'Casilla de aceptación + nombre tecleado', navegador: navigator.userAgent.slice(0, 250),
      })
    }
    const r = await supabase.from('firmas_adhesion').insert(registros)
    if (r.error) {
      setEnviando(false)
      return setError('No se ha podido registrar la firma: ' + r.error.message)
    }
    await enviarCorreo({
      para: datos.email,
      asunto: 'Copia de los documentos firmados para su adhesión',
      cuerpo: `Ha firmado: ${docs.map((d) => d.titulo).join(' · ')}. Referencia ${ref}.`,
      enlace: '/mi-cuenta/documentos',
    })
    setEnviando(false)
    setOk({ ...datos, docs })
    setPaso(3)
    window.scrollTo(0, 0)
  }

  const pasos = (
    <ol className="pasos">
      <li className={paso === 1 ? 'activo' : 'hecho'}>Datos y cuota</li>
      <li className={paso === 2 ? 'activo' : paso > 2 ? 'hecho' : ''}>Documentos y firma</li>
      <li className={paso === 3 ? 'activo' : ''}>Pago</li>
    </ol>
  )

  if (paso === 3 && ok)
    return (
      <>
        {pasos}
        <div className="aviso-ok grande">
          <h2>¡Gracias, {ok.nombre.split(' ')[0]}!</h2>
          <p>Ha firmado {ok.docs.length} documentos. Le hemos enviado una copia por correo. Para completar su adhesión, realice el primer pago:</p>
          <Instrucciones metodo={ok.metodo} importe={ok.cuota} refe={ok.referencia} aj={aj} periodo={ok.periodicidad} />
          <p className="letra-pequena">Cuando la asociación reciba el pago, quedará dado de alta y recibirá su número de socio. Cree su cuenta en <Link to="/acceso?modo=registro">Acceder</Link> con este mismo correo para ver su carnet, sus pagos y sus documentos firmados.</p>
        </div>
      </>
    )

  if (paso === 2)
    return (
      <>
        {pasos}
        {error && <p className="error">{error}</p>}
        <FirmaDocumentos nombre={f.nombre} onFirmar={firmar} onVolver={() => setPaso(1)} enviando={enviando} />
      </>
    )

  return (
    <>
      {pasos}
      <form className="formulario" onSubmit={continuar}>
        <label>Nombre y apellidos<input required maxLength={150} value={f.nombre} onChange={set('nombre')} autoComplete="name" /></label>
        <div className="dos-col">
          <label>Email<input required type="email" maxLength={200} value={f.email} onChange={set('email')} autoComplete="email" /></label>
          <label>Municipio (opcional)<input maxLength={100} value={f.municipio} onChange={set('municipio')} /></label>
        </div>
        <fieldset className="grupo">
          <legend>Cuota</legend>
          <Importes opciones={cuotas} valor={f.cuota} onChange={(n) => setF({ ...f, cuota: n })} />
          <select value={f.periodicidad} onChange={set('periodicidad')}>
            {Object.entries(PERIODOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </fieldset>
        <fieldset className="grupo">
          <legend>Forma de pago</legend>
          <Metodos valor={f.metodo} onChange={(m) => setF({ ...f, metodo: m })} />
        </fieldset>
        <label className="check">
          <input type="checkbox" checked={mayor} onChange={(e) => setMayor(e.target.checked)} />
          <span>Declaro ser mayor de edad.</span>
        </label>
        <p className="letra-pequena">
          En el siguiente paso leerá y firmará las Normas de la asociación, la Declaración de responsabilidad, el Ideario, los Estatutos y el consentimiento de datos. Solo pedimos los datos imprescindibles (<Link to="/privacidad">privacidad</Link>).
        </p>
        {error && <p className="error">{error}</p>}
        <button className="btn">Continuar: documentos y firma →</button>
      </form>
    </>
  )
}

function Donativo({ aj }) {
  const opciones = lista(aj.donativos)
  const [importe, setImporte] = useState(opciones[1] || opciones[0] || 25)
  const [metodo, setMetodo] = useState('tarjeta')
  const [email, setEmail] = useState('')
  const [ok, setOk] = useState(null)
  const [error, setError] = useState('')

  const enviar = async (e) => {
    e.preventDefault()
    if (!(importe > 0)) return setError('Indique el importe.')
    const ref = referencia('DON')
    const { error } = await registrarDonativo({ importe, metodo, referencia: ref, email: email.trim() || null, estado: 'pendiente' })
    if (error) return setError('No se ha podido registrar: ' + error.message)
    setOk({ importe, metodo, ref })
  }

  if (ok)
    return (
      <div className="aviso-ok grande">
        <h2>¡Gracias por su apoyo!</h2>
        <Instrucciones metodo={ok.metodo} importe={ok.importe} refe={ok.ref} aj={aj} />
      </div>
    )

  return (
    <form className="formulario" onSubmit={enviar}>
      <fieldset className="grupo">
        <legend>Importe</legend>
        <Importes opciones={opciones} valor={importe} onChange={setImporte} />
      </fieldset>
      <fieldset className="grupo">
        <legend>Forma de pago</legend>
        <Metodos valor={metodo} onChange={setMetodo} />
      </fieldset>
      <label>
        Email (opcional, solo si quiere recibir confirmación)
        <input type="email" maxLength={200} value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <p className="letra-pequena">Puede donar de forma anónima. Los datos de la tarjeta los gestiona la pasarela de pago; la asociación no los recibe.</p>
      {error && <p className="error">{error}</p>}
      <button className="btn">Donar {importe > 0 ? euros(importe) : ''}</button>
    </form>
  )
}
