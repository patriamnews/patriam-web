import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { enviarContacto, getPagina } from '../lib/data'
import Texto from '../components/Texto'
import Sedes from '../components/Sedes'
import { useSeo } from '../lib/seo'

const INTERESES = {
  informacion: 'Recibir información',
  voluntariado: 'Colaborar como voluntario',
  revista: 'Escribir en la revista',
  otro: 'Otro',
}

export default function Colabora() {
  const [intro, setIntro] = useState(null)
  useSeo({ titulo: 'Contacto', descripcion: 'Escribe a PATRIAM: información, colaboración, prensa o voluntariado.', ruta: '/contacto' })
  const [f, setF] = useState({ nombre: '', email: '', interes: 'informacion', mensaje: '' })
  const [ok, setOk] = useState(false)
  const [consiente, setConsiente] = useState(false)
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    getPagina('colabora').then(setIntro)
  }, [])

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  const enviar = async (e) => {
    e.preventDefault()
    if (!consiente) return setError('Debe aceptar la política de privacidad.')
    setEnviando(true)
    const { error } = await enviarContacto({ ...f, consentimiento: true })
    setEnviando(false)
    if (error) setError('No se ha podido enviar. Inténtelo más tarde.')
    else setOk(true)
  }

  return (
    <div className="contenedor estrecho bloque">
      <h1>{intro?.titulo || 'Contacto'}</h1>
      <Texto>{intro?.contenido || 'Si quiere colaborar con la asociación o recibir información, escríbanos.'}</Texto>

      {ok ? (
        <div className="aviso-ok">Gracias. Hemos recibido su mensaje y le responderemos.</div>
      ) : (
        <form className="formulario" onSubmit={enviar}>
          <label>
            Nombre
            <input required maxLength={120} value={f.nombre} onChange={set('nombre')} />
          </label>
          <label>
            Email
            <input required type="email" maxLength={200} value={f.email} onChange={set('email')} />
          </label>
          <label>
            Me interesa
            <select value={f.interes} onChange={set('interes')}>
              {Object.entries(INTERESES).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </label>
          <label>
            Mensaje
            <textarea rows={5} maxLength={3000} value={f.mensaje} onChange={set('mensaje')} />
          </label>
          <label className="check">
            <input type="checkbox" checked={consiente} onChange={(e) => setConsiente(e.target.checked)} />
            <span>
              Consiento expresamente el tratamiento de mis datos, que pueden revelar mis opiniones o convicciones, para
              que la asociación atienda mi solicitud, según la <Link to="/privacidad">política de privacidad</Link>.
            </span>
          </label>
          <p className="letra-pequena">
            Responsable: la asociación. Finalidad: atender su solicitud. Base: su consentimiento explícito. Sin cesiones a
            terceros. Puede ejercer sus derechos en cualquier momento.
          </p>
          {error && <p className="error">{error}</p>}
          <button className="btn" disabled={enviando}>
            {enviando ? 'Enviando…' : 'Enviar'}
          </button>
        </form>
      )}

      <Sedes />
    </div>
  )
}
