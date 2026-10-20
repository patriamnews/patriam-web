import { useEffect, useState } from 'react'
import { getPagina } from '../lib/data'
import { DOCUMENTOS_ADHESION, TEXTOS_ADHESION } from '../lib/documentos'
import Texto from './Texto'

// Muestra los documentos de adhesión, exige abrir y aceptar cada uno y firmar escribiendo el nombre completo.
// Devuelve (onFirmar) la lista de documentos aceptados con el texto exacto que se ha mostrado.
export default function FirmaDocumentos({ nombre, onFirmar, onVolver, enviando }) {
  const [docs, setDocs] = useState(null)
  const [abierto, setAbierto] = useState(null)
  const [leidos, setLeidos] = useState({})
  const [acepta, setAcepta] = useState({})
  const [firma, setFirma] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all(
      DOCUMENTOS_ADHESION.map(async (d) => {
        const p = await getPagina(d.clave)
        const t = p || TEXTOS_ADHESION[d.clave]
        return { ...d, titulo: t?.titulo || d.titulo, texto: t?.contenido || '' }
      }),
    ).then(setDocs)
  }, [])

  if (!docs) return <p className="vacio">Cargando documentos…</p>

  const normal = (s) => s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ')
  const faltan = docs.filter((d) => d.obligatorio && !acepta[d.clave])

  const firmar = (e) => {
    e.preventDefault()
    setError('')
    if (faltan.length) return setError(`Falta aceptar: ${faltan.map((d) => d.titulo).join(', ')}.`)
    if (normal(firma) !== normal(nombre)) return setError('Para firmar, escriba su nombre completo exactamente como en el paso anterior.')
    onFirmar(docs.filter((d) => acepta[d.clave]).map((d) => ({ clave: d.clave, titulo: d.titulo, texto: d.texto, obligatorio: d.obligatorio })), firma.trim())
  }

  const abrir = (k) => {
    setAbierto(abierto === k ? null : k)
    setLeidos({ ...leidos, [k]: true })
  }

  return (
    <form className="formulario" onSubmit={firmar}>
      <p>
        Para pertenecer a la asociación debe leer y aceptar los siguientes documentos. Ábralos uno a uno: la casilla de aceptación se activa al abrirlo.
      </p>
      <div className="docs-firma">
        {docs.map((d) => (
          <div key={d.clave} className={`doc-firma ${acepta[d.clave] ? 'aceptado' : ''}`}>
            <button type="button" className="doc-firma-cab" onClick={() => abrir(d.clave)} aria-expanded={abierto === d.clave}>
              <span>{acepta[d.clave] ? '✓ ' : ''}{d.titulo}{!d.obligatorio && !/volunt/i.test(d.titulo) && <span className="mini"> (voluntario)</span>}</span>
              <span className="mini">{abierto === d.clave ? 'Cerrar' : 'Leer'}</span>
            </button>
            {abierto === d.clave && (
              <div className="doc-texto">
                <Texto>{d.texto}</Texto>
              </div>
            )}
            <label className="check">
              <input type="checkbox" disabled={!leidos[d.clave]} checked={!!acepta[d.clave]} onChange={(e) => setAcepta({ ...acepta, [d.clave]: e.target.checked })} />
              <span>{d.obligatorio ? 'He leído y acepto este documento.' : 'Lo autorizo (puede dejarlo sin marcar).'}{!leidos[d.clave] && <span className="mini"> Ábralo primero.</span>}</span>
            </label>
          </div>
        ))}
      </div>

      <fieldset className="grupo">
        <legend>Firma</legend>
        <label>
          Escriba su nombre completo para firmar
          <input required value={firma} onChange={(e) => setFirma(e.target.value)} placeholder={nombre} autoComplete="off" />
        </label>
        <p className="letra-pequena">
          Su firma electrónica quedará registrada con la fecha y hora, el texto exacto de cada documento y su huella digital (SHA-256). Recibirá una copia por correo y podrá consultarla en su área de asociado.
        </p>
      </fieldset>
      {error && <p className="error">{error}</p>}
      <div className="acciones">
        <button type="button" className="btn btn-claro" onClick={onVolver}>← Volver</button>
        <button className="btn" disabled={enviando}>{enviando ? 'Firmando…' : 'Firmar y enviar solicitud'}</button>
      </div>
    </form>
  )
}
