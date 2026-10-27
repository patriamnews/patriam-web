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
      <h1>{(intro?.titulo && intro.titulo !== 'Adhiérete' ? intro.titulo : 'Únete')}</h1>
      {intro?.contenido && <Texto>{intro.contenido}</Texto>}
      <div className="pestanas grandes">
        <button className={pestana === 'socio' ? 'activa' : ''} onClick={() => setParams({})}>Únete</button>
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

// Descuentos sobre la cuota normal. Todos llevan la cuota reducida fijada en Ajustes.
const DESCUENTOS = {
  familia_numerosa: { texto: 'Familia numerosa', doc: 'el título de familia numerosa en vigor' },
  estudiante: { texto: 'Estudiante', doc: null },
  jubilado: { texto: 'Jubilado o pensionista', doc: 'el documento que acredite la jubilación o la pensión' },
  desempleado: { texto: 'Desempleado', doc: 'el certificado de inscripción como demandante de empleo (SEPE o servicio autonómico)' },
  familiar: { texto: 'Tengo un familiar afiliado a PATRIAM', doc: 'un documento que acredite el parentesco (por ejemplo, el libro de familia)' },
}
// Correos personales: un estudiante debe afiliarse con el correo de su centro educativo
const CORREOS_PERSONALES = /@(gmail|googlemail|hotmail|outlook|live|msn|yahoo|ymail|icloud|me|mac|aol|gmx|proton|protonmail|yandex|mail|zoho|telefonica|movistar|orange|vodafone)\./i
const PROVINCIAS = ['Álava', 'Albacete', 'Alicante', 'Almería', 'Asturias', 'Ávila', 'Badajoz', 'Baleares', 'Barcelona', 'Burgos', 'Cáceres', 'Cádiz', 'Cantabria', 'Castellón', 'Ceuta', 'Ciudad Real', 'Córdoba', 'Cuenca', 'Gerona', 'Granada', 'Guadalajara', 'Guipúzcoa', 'Huelva', 'Huesca', 'Jaén', 'La Coruña', 'La Rioja', 'Las Palmas', 'León', 'Lérida', 'Lugo', 'Madrid', 'Málaga', 'Melilla', 'Murcia', 'Navarra', 'Orense', 'Palencia', 'Pontevedra', 'Salamanca', 'Santa Cruz de Tenerife', 'Segovia', 'Sevilla', 'Soria', 'Tarragona', 'Teruel', 'Toledo', 'Valencia', 'Valladolid', 'Vizcaya', 'Zamora', 'Zaragoza']

// DNI / NIE con letra de control
function documentoValido(v) {
  const x = v.toUpperCase().replace(/[\s-]/g, '')
  const m = x.match(/^([XYZ]?)(\d{7,8})([A-Z])$/)
  if (!m) return false
  const n = Number((m[1] ? 'XYZ'.indexOf(m[1]) : '') + m[2])
  return 'TRWAGMYFPDXBNJZSQVHLCKE'[n % 23] === m[3]
}
const edad = (f) => {
  const n = new Date(f), h = new Date()
  let e = h.getFullYear() - n.getFullYear()
  if (h < new Date(h.getFullYear(), n.getMonth(), n.getDate())) e--
  return e
}

function Socio({ aj }) {
  const normal = Number(aj.cuota) || 10
  const reducida = Number(aj.cuota_reducida) || normal
  const { session, perfil } = useAuth()
  const [f, setF] = useState({
    nombre: perfil?.nombre || '', apellido1: '', apellido2: '', dni: '', nacimiento: '', sexo: '',
    email: session?.user?.email || '', telefono: '', direccion: '', codigo_postal: '', municipio: '', provincia: '',
    descuento: '', familiar_nombre: '', metodo: 'tarjeta',
  })
  const [paso, setPaso] = useState(1) // 1 datos · 2 documentos y firma · 3 pago
  const [ok, setOk] = useState(null)
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const cuota = f.descuento ? reducida : normal
  const completo = () => [f.nombre, f.apellido1, f.apellido2].map((x) => x.trim()).filter(Boolean).join(' ')

  const continuar = (e) => {
    e.preventDefault()
    setError('')
    if (!documentoValido(f.dni)) return setError('El DNI o NIE no es correcto. Revise los números y la letra.')
    if (!f.nacimiento || edad(f.nacimiento) < 18) return setError('Para asociarse hay que ser mayor de edad.')
    if (!f.sexo) return setError('Indique si es hombre o mujer.')
    if (!/^\d{5}$/.test(f.codigo_postal)) return setError('El código postal debe tener 5 cifras.')
    if (f.descuento === 'estudiante' && CORREOS_PERSONALES.test(f.email))
      return setError('Para la cuota de estudiante, regístrese con el correo de su centro educativo (universidad, instituto…), no con un correo personal.')
    if (f.descuento === 'familiar' && !f.familiar_nombre.trim()) return setError('Indique el nombre del familiar afiliado.')
    setPaso(2)
    window.scrollTo(0, 0)
  }

  // Firma de los documentos: se guarda la solicitud y un registro por cada documento firmado
  const firmar = async (docs, firmaTecleada) => {
    setEnviando(true)
    setError('')
    const ref = referencia('SOC')
    const datos = {
      nombre: completo(), nombre_pila: f.nombre.trim(), apellido1: f.apellido1.trim(), apellido2: f.apellido2.trim() || null,
      dni: f.dni.toUpperCase().replace(/[\s-]/g, ''), fecha_nacimiento: f.nacimiento, sexo: f.sexo,
      email: f.email.trim(), telefono: f.telefono.trim(),
      direccion: f.direccion.trim(), codigo_postal: f.codigo_postal.trim(), municipio: f.municipio.trim(), provincia: f.provincia,
      cuota, periodicidad: 'mensual', descuento: f.descuento || null, familiar_afiliado: f.descuento === 'familiar' ? f.familiar_nombre.trim() : null,
      descuento_justificado: f.descuento === 'estudiante' ? true : f.descuento ? false : null,
      metodo: f.metodo, referencia: ref, estado: 'pendiente', consentimiento: true,
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
        declaracion: d.lectura?.declaracion, abierto_at: d.lectura?.abierto_at, leido_al_final_at: d.lectura?.leido_al_final_at, aceptado_at: d.lectura?.aceptado_at,
        metodo: 'Lectura completa en ventana + casilla «He leído» + nombre tecleado', navegador: navigator.userAgent.slice(0, 250),
      })
    }
    const r = await supabase.from('firmas_adhesion').insert(registros)
    if (r.error) {
      setEnviando(false)
      return setError('No se ha podido registrar la firma: ' + r.error.message)
    }
    const fechaFirma = new Date().toLocaleString('es-ES', { dateStyle: 'long', timeStyle: 'short' })
    await enviarCorreo({
      para: datos.email,
      asunto: 'Documentos firmados para su adhesión a PATRIAM',
      cuerpo:
        `Estimado/a ${datos.nombre_pila}:\n\nLe enviamos los documentos que ha firmado electrónicamente para su adhesión a PATRIAM.\n\n` +
        `Fecha de firma: ${fechaFirma}\nFirmante: ${datos.nombre} (${datos.dni})\nReferencia: ${ref}\n\n` +
        docs.map((d) => `• ${d.titulo} — ${d.lectura?.declaracion || 'Aceptado'}`).join('\n') +
        '\n\nEl texto completo de cada documento firmado, con su fecha de firma, queda disponible en su área de asociado.',
      enlace: '/mi-cuenta/documentos',
    })
    // Descuentos que necesitan justificante: correo automático para que envíen la documentación
    const desc = DESCUENTOS[f.descuento]
    if (desc?.doc) {
      await enviarCorreo({
        para: datos.email,
        asunto: `Documentación para la cuota reducida (${desc.texto}) · ${ref}`,
        cuerpo:
          `Estimado/a ${datos.nombre_pila}:\n\nHa solicitado la cuota reducida por: ${desc.texto}. Para aplicarla, responda a este correo adjuntando ${desc.doc}.` +
          (f.descuento === 'familiar' ? ` Familiar afiliado indicado: ${datos.familiar_afiliado}.` : '') +
          `\n\nIndique en el asunto la referencia ${ref}. Mientras la asociación revisa la documentación se aplica la cuota reducida; si no se recibe o no es válida, se aplicará la cuota normal de ${euros(normal)} al mes.`,
        enlace: '/mi-cuenta',
      })
    }
    setEnviando(false)
    setOk({ ...datos, docs, fechaFirma })
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
          <h2>¡Gracias, {ok.nombre_pila}!</h2>
          <p>Ha firmado {ok.docs.length} documentos el {ok.fechaFirma}. Le hemos enviado por correo los documentos firmados con la fecha de firma.</p>
          {DESCUENTOS[ok.descuento]?.doc && (
            <p className="caja-aviso">Le hemos enviado otro correo para que nos remita la documentación que justifica la cuota reducida ({DESCUENTOS[ok.descuento].texto.toLowerCase()}).</p>
          )}
          <p>Para completar su adhesión, realice el primer pago:</p>
          <Instrucciones metodo={ok.metodo} importe={ok.cuota} refe={ok.referencia} aj={aj} periodo="mensual" />
          <p className="letra-pequena">Cuando la asociación reciba el pago, quedará dado de alta, recibirá su número de asociado y, cada mes, el recibo de su cuota. Cree su cuenta en <Link to="/acceso?modo=registro">Acceder</Link> con este mismo correo para ver su carnet, sus recibos y sus documentos firmados.</p>
        </div>
      </>
    )

  if (paso === 2)
    return (
      <>
        {pasos}
        {error && <p className="error">{error}</p>}
        <FirmaDocumentos nombre={completo()} onFirmar={firmar} onVolver={() => setPaso(1)} enviando={enviando} />
      </>
    )

  return (
    <>
      {pasos}
      <form className="formulario" onSubmit={continuar}>
        <fieldset className="grupo">
          <legend>Datos personales</legend>
          <div className="tres-col">
            <label>Nombre<input required maxLength={60} value={f.nombre} onChange={set('nombre')} autoComplete="given-name" /></label>
            <label>Primer apellido<input required maxLength={60} value={f.apellido1} onChange={set('apellido1')} autoComplete="family-name" /></label>
            <label>Segundo apellido<input maxLength={60} value={f.apellido2} onChange={set('apellido2')} /></label>
          </div>
          <div className="tres-col">
            <label>DNI o NIE<input required maxLength={12} value={f.dni} onChange={set('dni')} placeholder="12345678Z" /></label>
            <label>Fecha de nacimiento<input required type="date" value={f.nacimiento} onChange={set('nacimiento')} max={new Date().toISOString().slice(0, 10)} autoComplete="bday" /></label>
            <label>
              Sexo
              <select required value={f.sexo} onChange={set('sexo')}>
                <option value="">—</option>
                <option value="mujer">Mujer</option>
                <option value="hombre">Hombre</option>
              </select>
            </label>
          </div>
          <div className="dos-col">
            <label>Email<input required type="email" maxLength={200} value={f.email} onChange={set('email')} autoComplete="email" /></label>
            <label>Teléfono<input required type="tel" maxLength={20} value={f.telefono} onChange={set('telefono')} autoComplete="tel" /></label>
          </div>
        </fieldset>

        <fieldset className="grupo">
          <legend>Domicilio (para el recibo de la cuota)</legend>
          <label>Dirección<input required maxLength={200} value={f.direccion} onChange={set('direccion')} placeholder="Calle, número, piso" autoComplete="street-address" /></label>
          <div className="tres-col">
            <label>Código postal<input required inputMode="numeric" maxLength={5} value={f.codigo_postal} onChange={set('codigo_postal')} autoComplete="postal-code" /></label>
            <label>Municipio<input required maxLength={100} value={f.municipio} onChange={set('municipio')} autoComplete="address-level2" /></label>
            <label>
              Provincia
              <select required value={f.provincia} onChange={set('provincia')}>
                <option value="">—</option>
                {PROVINCIAS.map((p) => <option key={p}>{p}</option>)}
              </select>
            </label>
          </div>
        </fieldset>

        <fieldset className="grupo">
          <legend>Cuota</legend>
          <p className="cuota-normal">Cuota normal: <b>{euros(normal)} al mes</b></p>
          <p className="letra-pequena">Descuentos: si está en alguna de estas situaciones, la cuota es de <b>{euros(reducida)} al mes</b>.</p>
          <div className="descuentos">
            <label className="check">
              <input type="radio" name="descuento" checked={!f.descuento} onChange={() => setF({ ...f, descuento: '' })} />
              <span>Sin descuento ({euros(normal)} al mes)</span>
            </label>
            {Object.entries(DESCUENTOS).map(([k, d]) => (
              <label key={k} className="check">
                <input type="radio" name="descuento" checked={f.descuento === k} onChange={() => setF({ ...f, descuento: k })} />
                <span>{d.texto}</span>
              </label>
            ))}
          </div>
          {f.descuento === 'familiar' && (
            <label>Nombre y apellidos del familiar afiliado<input required maxLength={150} value={f.familiar_nombre} onChange={set('familiar_nombre')} /></label>
          )}
          {f.descuento && (
            <p className="caja-aviso">
              {f.descuento === 'estudiante'
                ? 'Estudiantes: basta con afiliarse con el correo de su institución educativa (universidad, instituto, escuela…). Escríbalo arriba en «Email».'
                : `Deberá remitir los documentos que justifiquen la situación que da derecho al descuento: ${DESCUENTOS[f.descuento].doc}. Al terminar el registro le enviaremos un correo automático para que pueda enviar la documentación.`}
            </p>
          )}
        </fieldset>

        <fieldset className="grupo">
          <legend>Forma de pago</legend>
          <Metodos valor={f.metodo} onChange={(m) => setF({ ...f, metodo: m })} />
        </fieldset>
        <p className="letra-pequena">
          En el siguiente paso leerá y firmará las Normas de la asociación y código de conducta, la Declaración de responsabilidad, el Ideario, los Estatutos y
          el consentimiento de datos. Pedimos estos datos para gestionar su alta, emitir los recibos de la cuota y organizar las actividades (algunas son solo para
          mujeres o solo para hombres). Más información en la <Link to="/privacidad">política de privacidad</Link>.
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
