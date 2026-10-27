import { useEffect, useRef, useState } from 'react'
import { getPagina } from '../lib/data'
import { DOCUMENTOS_ADHESION, TEXTOS_ADHESION } from '../lib/documentos'
import Texto from './Texto'

const ahora = () => new Date().toISOString()

// Cada documento se abre en una ventana emergente. Hay que bajar hasta el final del texto para poder
// marcar «He leído y acepto «Nombre del documento»». De cada documento queda un registro (log) con la hora
// de apertura, la hora en que se llegó al final y la hora de aceptación. Al final se firma tecleando el nombre.
// Devuelve (onFirmar) la lista de documentos aceptados con el texto exacto mostrado y su registro de lectura.
export default function FirmaDocumentos({ nombre, onFirmar, onVolver, enviando }) {
  const [docs, setDocs] = useState(null)
  const [abierto, setAbierto] = useState(null)
  const [log, setLog] = useState({}) // clave -> { abierto_at, leido_al_final_at, aceptado_at, declaracion }
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
  const aceptado = (k) => !!log[k]?.aceptado_at
  const faltan = docs.filter((d) => d.obligatorio && !aceptado(d.clave))
  const marcar = (k, datos) => setLog((l) => ({ ...l, [k]: { ...l[k], ...datos } }))

  const abrir = (d) => {
    if (!log[d.clave]?.abierto_at) marcar(d.clave, { abierto_at: ahora() })
    setAbierto(d)
  }

  const firmar = (e) => {
    e.preventDefault()
    setError('')
    if (faltan.length) return setError(`Falta leer y aceptar: ${faltan.map((d) => d.titulo).join(', ')}.`)
    if (normal(firma) !== normal(nombre)) return setError('Para firmar, escriba su nombre y apellidos exactamente como en el paso anterior.')
    onFirmar(
      docs.filter((d) => aceptado(d.clave)).map((d) => ({ clave: d.clave, titulo: d.titulo, texto: d.texto, obligatorio: d.obligatorio, lectura: log[d.clave] })),
      firma.trim(),
    )
  }

  return (
    <form className="formulario" onSubmit={firmar}>
      <p>
        Para pertenecer a la asociación debe leer y aceptar los siguientes documentos. Pulse <b>Leer</b> en cada uno: se abrirá el texto completo y,
        cuando llegue al final, podrá marcar que lo ha leído. Quedará constancia de la fecha y la hora.
      </p>
      <div className="docs-firma">
        {docs.map((d) => (
          <div key={d.clave} className={`doc-firma ${aceptado(d.clave) ? 'aceptado' : ''}`}>
            <button type="button" className="doc-firma-cab" onClick={() => abrir(d)}>
              <span>
                {aceptado(d.clave) ? '✓ ' : ''}
                {d.titulo}
                {!d.obligatorio && !/volunt/i.test(d.titulo) && <span className="mini"> (voluntario)</span>}
              </span>
              <span className="mini">{aceptado(d.clave) ? 'Leído · volver a ver' : 'Leer'}</span>
            </button>
            {aceptado(d.clave) && (
              <p className="mini doc-log">
                {log[d.clave].declaracion} · {new Date(log[d.clave].aceptado_at).toLocaleString('es-ES')}
              </p>
            )}
          </div>
        ))}
      </div>

      <fieldset className="grupo">
        <legend>Firma</legend>
        <label>
          Escriba su nombre y apellidos para firmar
          <input required value={firma} onChange={(e) => setFirma(e.target.value)} placeholder={nombre} autoComplete="off" />
        </label>
        <p className="letra-pequena">
          Su firma electrónica quedará registrada con la fecha y hora, el texto exacto de cada documento, su huella digital (SHA-256) y el registro de
          lectura. Al terminar recibirá por correo los documentos firmados con la fecha de firma, y podrá consultarlos en su área de asociado.
        </p>
      </fieldset>
      {error && <p className="error">{error}</p>}
      <div className="acciones">
        <button type="button" className="btn btn-claro" onClick={onVolver}>← Volver</button>
        <button className="btn" disabled={enviando}>{enviando ? 'Firmando…' : 'Firmar y continuar al pago'}</button>
      </div>

      {abierto && (
        <VentanaDocumento
          d={abierto}
          registro={log[abierto.clave] || {}}
          onFinal={() => !log[abierto.clave]?.leido_al_final_at && marcar(abierto.clave, { leido_al_final_at: ahora() })}
          onAceptar={(si) =>
            marcar(abierto.clave, si
              ? { aceptado_at: ahora(), declaracion: `${abierto.obligatorio ? 'He leído y acepto' : 'He leído y autorizo'} «${abierto.titulo}»` }
              : { aceptado_at: null, declaracion: null })
          }
          cerrar={() => setAbierto(null)}
        />
      )}
    </form>
  )
}

function VentanaDocumento({ d, registro, onFinal, onAceptar, cerrar }) {
  const caja = useRef(null)
  const alFinal = !!registro.leido_al_final_at

  // Si el texto es corto y cabe entero, ya está «al final»
  useEffect(() => {
    const c = caja.current
    if (c && c.scrollHeight <= c.clientHeight + 4) onFinal()
    const esc = (e) => e.key === 'Escape' && cerrar()
    document.addEventListener('keydown', esc)
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', esc); document.body.style.overflow = '' }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const desplazar = (e) => {
    const c = e.currentTarget
    if (c.scrollTop + c.clientHeight >= c.scrollHeight - 8) onFinal()
  }

  return (
    <div className="ventana-fondo" role="dialog" aria-modal="true" aria-labelledby="ventana-titulo" onClick={(e) => e.target === e.currentTarget && cerrar()}>
      <div className="ventana">
        <div className="ventana-cab">
          <h2 id="ventana-titulo">{d.titulo}</h2>
          <button type="button" className="ventana-cerrar" onClick={cerrar} aria-label="Cerrar">×</button>
        </div>
        <div className="ventana-texto" ref={caja} onScroll={desplazar} tabIndex={0}>
          <Texto>{d.texto}</Texto>
          <p className="fin-documento">— Fin del documento —</p>
        </div>
        <div className="ventana-pie">
          {!alFinal && <p className="mini">Baje hasta el final del documento para poder marcarlo como leído.</p>}
          <label className="check">
            <input type="checkbox" disabled={!alFinal} checked={!!registro.aceptado_at} onChange={(e) => onAceptar(e.target.checked)} />
            <span>{d.obligatorio ? 'He leído y acepto' : 'He leído y autorizo'} «{d.titulo}»{!d.obligatorio && ' (voluntario: puede dejarlo sin marcar)'}</span>
          </label>
          <button type="button" className="btn" onClick={cerrar}>{registro.aceptado_at ? 'Hecho' : 'Cerrar'}</button>
        </div>
      </div>
    </div>
  )
}
