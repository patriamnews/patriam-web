import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getCampana, getPagina, listarCampanas, totalFirmas, enviarFirma } from '../lib/data'
import Texto from '../components/Texto'
import NoEncontrado from './NoEncontrado'
import { Foto } from '../components/ImagenPrueba'

function Progreso({ n, objetivo }) {
  const pct = objetivo ? Math.min(100, Math.round((n / objetivo) * 100)) : 0
  return (
    <div className="progreso">
      <div className="progreso-barra"><span style={{ width: `${pct}%` }} /></div>
      <div className="progreso-texto">
        <b>{n.toLocaleString('es-ES')}</b> firmas{objetivo ? ` de ${objetivo.toLocaleString('es-ES')}` : ''}
      </div>
    </div>
  )
}

export function ListaCampanas() {
  const [intro, setIntro] = useState(null)
  const [lista, setLista] = useState(null)

  useEffect(() => {
    getPagina('campanas').then(setIntro)
    listarCampanas().then(async (cs) => setLista(await Promise.all(cs.map(async (c) => ({ ...c, n: await totalFirmas(c) })))))
  }, [])

  return (
    <div className="contenedor bloque">
      <h1>{intro?.titulo || 'Campañas'}</h1>
      {intro?.contenido && <Texto>{intro.contenido}</Texto>}
      {lista === null ? (
        <p className="vacio">Cargando…</p>
      ) : lista.length === 0 ? (
        <p className="vacio">No hay campañas activas en este momento.</p>
      ) : (
        <div className="rejilla">
          {lista.map((c) => (
            <article key={c.id} className="tarjeta">
              <div className="tarjeta-cuerpo">
                <span className="etiqueta">Campaña</span>
                <h3><Link to={`/campanas/${c.slug}`}>{c.titulo}</Link></h3>
                <p>{c.resumen}</p>
                <Progreso n={c.n} objetivo={c.objetivo} />
                <Link to={`/campanas/${c.slug}`} className="btn">Firmar</Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}

export function Campana() {
  const { slug } = useParams()
  const [c, setC] = useState(undefined)
  const [n, setN] = useState(0)

  useEffect(() => {
    getCampana(slug).then(async (d) => {
      setC(d)
      if (d) setN(await totalFirmas(d))
    })
  }, [slug])

  if (c === undefined) return <p className="contenedor vacio">Cargando…</p>
  if (!c) return <NoEncontrado />

  return (
    <div className="contenedor bloque campana">
      <div className="campana-texto">
        <Link to="/campanas" className="etiqueta">Campañas</Link>
        <h1>{c.titulo}</h1>
        {c.destinatario && <p className="entradilla">Dirigida a: {c.destinatario}</p>}
        <Foto src={c.imagen_url} className="imagen-articulo" />
        <Texto>{c.texto}</Texto>
      </div>
      <aside className="campana-firma">
        <Progreso n={n} objetivo={c.objetivo} />
        {c.modo === 'externo' && !c.enlace_externo ? (
          <p className="caja-aviso">Muy pronto podrás firmar esta petición en CitizenGO.</p>
        ) : c.modo === 'externo' ? (
          <>
            <a className="btn btn-bloque" href={c.enlace_externo} target="_blank" rel="noopener noreferrer">
              Firmar en CitizenGO ↗
            </a>
            <p className="letra-pequena">
              La firma se recoge en la plataforma externa, que es responsable de sus datos. La asociación no recibe datos de los firmantes.
            </p>
          </>
        ) : (
          <FormularioFirma campana={c} onFirma={() => setN(n + 1)} />
        )}
        <p className="letra-pequena">
          Esta recogida de firmas es una muestra de apoyo ciudadano. No equivale a las firmas certificadas que exige la ley para una Iniciativa Legislativa Popular.
        </p>
      </aside>
    </div>
  )
}

function FormularioFirma({ campana, onFirma }) {
  const [f, setF] = useState({ nombre: '', email: '', municipio: '' })
  const [acepta, setAcepta] = useState(false)
  const [info, setInfo] = useState(false)
  const [ok, setOk] = useState(false)
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  const enviar = async (e) => {
    e.preventDefault()
    setError('')
    if (!acepta) return setError('Debe aceptar la política de privacidad.')
    setEnviando(true)
    const { error } = await enviarFirma({
      campana_id: campana.id,
      nombre: f.nombre.trim(),
      email: f.email.trim().toLowerCase(),
      municipio: f.municipio.trim() || null,
      quiere_info: info,
      consentimiento: true,
    })
    setEnviando(false)
    if (error) return setError(error.message)
    setOk(true)
    onFirma()
  }

  if (ok) return <div className="aviso-ok">Gracias por firmar. Le hemos enviado un email para confirmar su firma.</div>

  return (
    <form className="formulario" onSubmit={enviar}>
      <label>Nombre<input required maxLength={120} value={f.nombre} onChange={set('nombre')} autoComplete="name" /></label>
      <label>Email<input required type="email" maxLength={200} value={f.email} onChange={set('email')} autoComplete="email" /></label>
      <label>Municipio (opcional)<input maxLength={100} value={f.municipio} onChange={set('municipio')} /></label>
      <label className="check">
        <input type="checkbox" checked={acepta} onChange={(e) => setAcepta(e.target.checked)} />
        <span>Consiento expresamente el tratamiento de mis datos, que pueden revelar mi opinión, para registrar mi firma en esta campaña (<Link to="/privacidad">privacidad</Link>).</span>
      </label>
      <label className="check">
        <input type="checkbox" checked={info} onChange={(e) => setInfo(e.target.checked)} />
        <span>Quiero recibir información de otras campañas (opcional).</span>
      </label>
      {error && <p className="error">{error}</p>}
      <button className="btn btn-bloque" disabled={enviando}>{enviando ? 'Enviando…' : 'Firmar'}</button>
      <p className="letra-pequena">Su nombre y email no se publican. Los datos se borran al terminar la campaña, salvo que pida recibir información.</p>
    </form>
  )
}
