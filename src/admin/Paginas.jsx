import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { puedePublicarPaginas } from '../lib/permissions'
import { enviarCorreo } from '../lib/correo'
import { APROBADOR } from '../lib/config'
import { LEGALES } from '../lib/legales'
import { TEXTOS_ADHESION } from '../lib/documentos'

const PLANTILLAS = { ...LEGALES, ...TEXTOS_ADHESION }

const CLAVES = {
  inicio: 'Inicio (texto de portada)',
  'sobre-patriam': 'Sobre PATRIAM',
  nosotros: 'Nosotros (introducción)',
  ciudadana: 'Acción ciudadana (introducción)',
  cultural: 'Acción cultural (introducción)',
  social: 'Acción social (introducción)',
  revista: 'Revista (introducción)',
  noticias: 'Noticias (introducción)',
  recomendaciones: 'Recomendaciones (introducción)',
  medios: 'Medios (introducción)',
  colabora: 'Contacto (introducción)',
  adhesion: 'Únete (introducción)',
  campanas: 'Campañas (introducción)',
  tienda: 'Tienda (introducción)',
  'condiciones-de-venta': 'Condiciones de venta',
  'aviso-legal': 'Aviso legal',
  privacidad: 'Política de privacidad',
  cookies: 'Política de cookies',
  'transparencia-ia': 'Transparencia IA',
  'doc-normas': 'Adhesión · Normas de la asociación',
  'doc-descargo': 'Adhesión · Declaración de responsabilidad',
  ideario: 'Adhesión · Ideario',
  'doc-estatutos': 'Adhesión · Aceptación de Estatutos',
  'doc-datos': 'Adhesión · Consentimiento de datos',
  'doc-imagen': 'Adhesión · Uso de imagen',
}

export default function Paginas() {
  const [clave, setClave] = useState('inicio')
  const [p, setP] = useState(null)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    setP(null)
    setMsg('')
    supabase
      .from('paginas')
      .select('*')
      .eq('clave', clave)
      .maybeSingle()
      .then(({ data }) => setP(data || { clave, ...(PLANTILLAS[clave] || { titulo: CLAVES[clave], contenido: '' }) }))
  }, [clave])

  const { perfil } = useAuth()
  const publica = puedePublicarPaginas(perfil)
  // Quien no es Carlos propone el cambio: le llega por correo con el texto nuevo
  const proponer = async () => {
    const aviso = await enviarCorreo({
      para: APROBADOR.email,
      de: perfil.email,
      asunto: `Pendiente de aprobación: página «${p.titulo}»`,
      cuerpo: `${perfil.email} propone este texto para la página «${p.titulo}»:\n\n${p.contenido}`,
      enlace: '/gestion/paginas',
    })
    setMsg(`Propuesta enviada a ${APROBADOR.nombre} para su aprobación. ${aviso || ''}`)
  }

  const guardar = async () => {
    const { error } = await supabase
      .from('paginas')
      .upsert({ clave, titulo: p.titulo, contenido: p.contenido, actualizado_at: new Date().toISOString() })
    setMsg(error ? 'Error al guardar: ' + error.message : 'Guardado.')
  }

  return (
    <>
      <h1>Páginas</h1>
      <div className="filtros">
        <select value={clave} onChange={(e) => setClave(e.target.value)}>
          {Object.entries(CLAVES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      {PLANTILLAS[clave] && (
        <div className="caja-aviso">Texto legal: complete los datos entre [corchetes] y revíselo antes de publicarlo.{clave.startsWith('doc-') || clave === 'ideario' ? ' Si cambia un documento de adhesión, actualice su número de versión: las firmas ya hechas conservan el texto que se firmó.' : ''}</div>
      )}
      {p && (
        <div className="formulario">
          <label>
            Título
            <input value={p.titulo} onChange={(e) => setP({ ...p, titulo: e.target.value })} />
          </label>
          <label>
            Contenido
            <textarea rows={20} value={p.contenido} onChange={(e) => setP({ ...p, contenido: e.target.value })} />
            <small>Formato: línea en blanco = nuevo párrafo · ## Subtítulo · **negrita** · - lista</small>
          </label>
          {msg && <p className="aviso-ok">{msg}</p>}
          {publica ? (
            <div className="acciones"><button className="btn" onClick={guardar}>Guardar y publicar</button></div>
          ) : (
            <div className="acciones">
              <button className="btn" onClick={proponer}>Enviar a {APROBADOR.nombre} para aprobar</button>
              <small>Los cambios en las páginas son publicaciones: solo los publica {APROBADOR.nombre}.</small>
            </div>
          )}
        </div>
      )}
    </>
  )
}
