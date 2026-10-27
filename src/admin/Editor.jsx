import { confirmar } from '../lib/confirmar'
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { ESTADOS, SECCIONES, USO_IA, TIPOS_RECOMENDACION } from '../lib/config'
import { puedePublicar, seccionesDisponibles } from '../lib/permissions'
import { slugify } from '../lib/data'
import { subirArchivo } from './subir'
import Texto from '../components/Texto'
import { pedirAprobacion, avisarAutor } from '../lib/correo'
import { APROBADOR } from '../lib/config'

const VACIO = {
  titulo: '',
  resumen: '',
  contenido: '',
  seccion: 'revista',
  firma: '',
  uso_ia: 'ninguno',
  imagen_url: '',
  imagen_ia: false,
  estado: 'borrador',
  nota_revision: '',
}

export default function Editor({ seccionInicial, base = '/gestion' }) {
  const { id } = useParams()
  const { perfil } = useAuth()
  const navigate = useNavigate()
  const [a, setA] = useState(id ? null : { ...VACIO, firma: perfil.nombre, seccion: seccionesDisponibles(perfil).includes(seccionInicial) ? seccionInicial : seccionesDisponibles(perfil)[0] })
  const [vista, setVista] = useState(false)
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (!id) return
    supabase.from('articulos').select('*').eq('id', id).single().then(({ data }) => setA(data))
  }, [id])

  if (!a) return <p>Cargando…</p>

  const esMio = !id || a.autor_id === perfil.id
  const publica = puedePublicar(perfil, a.seccion)
  const soloLectura = !publica && !(esMio && ['borrador', 'revision', 'rechazado'].includes(a.estado))
  const set = (k) => (e) => setA({ ...a, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })

  const subirImagen = async (e) => {
    const f = e.target.files[0]
    if (!f) return
    try {
      setMsg('Subiendo imagen…')
      const url = await subirArchivo('imagenes', f)
      setA({ ...a, imagen_url: url })
      setMsg('')
    } catch {
      setError('No se pudo subir la imagen.')
    }
  }

  const guardar = async (estado) => {
    setError('')
    setMsg('')
    if (!a.titulo.trim()) return setError('Falta el título.')
    if (['noticias', 'medios'].includes(a.seccion) && !a.fecha) return setError(a.seccion === 'noticias' ? 'Falta la fecha del comunicado.' : 'Falta la fecha de la aparición en el medio.')
    setGuardando(true)
    const datos = {
      titulo: a.titulo.trim(),
      resumen: a.resumen,
      contenido: a.contenido,
      seccion: a.seccion,
      firma: a.firma,
      uso_ia: a.uso_ia,
      imagen_url: a.imagen_url || null,
      imagen_ia: a.imagen_ia,
      estado,
      nota_revision: a.nota_revision,
      medio: ['medios', 'recomendaciones'].includes(a.seccion) ? a.medio : null,
      enlace_externo: ['medios', 'recomendaciones'].includes(a.seccion) ? a.enlace_externo : null,
      tipo_recomendacion: a.seccion === 'recomendaciones' ? a.tipo_recomendacion || 'articulo' : null,
      fecha: ['noticias', 'medios'].includes(a.seccion) ? a.fecha || null : null,
    }
    let res
    if (id) res = await supabase.from('articulos').update(datos).eq('id', id).select().single()
    else
      res = await supabase
        .from('articulos')
        .insert({ ...datos, slug: `${slugify(a.titulo)}-${Date.now().toString(36)}` })
        .select()
        .single()
    setGuardando(false)
    if (res.error) return setError('No se ha podido guardar: ' + res.error.message)
    setA(res.data)
    let aviso = ''
    if (estado === 'revision')
      aviso = await pedirAprobacion({ tipo: 'artículo', titulo: res.data.titulo, de: perfil.email, enlace: `/gestion/editar/${res.data.id}` })
    if (['publicado', 'rechazado'].includes(estado) && res.data.autor_id && res.data.autor_id !== perfil.id) {
      const { data: autor } = await supabase.from('perfiles').select('email').eq('id', res.data.autor_id).maybeSingle()
      if (autor?.email) aviso = await avisarAutor({ para: autor.email, titulo: res.data.titulo, aprobado: estado === 'publicado', nota: a.nota_revision })
    }
    setMsg(
      (estado === 'publicado' ? 'Aprobado y publicado.' : estado === 'revision' ? `Enviado a ${APROBADOR.nombre} para su aprobación.` : estado === 'rechazado' ? 'Devuelto al autor.' : 'Guardado.') +
        (aviso ? ' ' + aviso : ''),
    )
    if (!id) navigate(`${base}/editar/${res.data.id}`, { replace: true })
  }

  const borrar = async () => {
    if (!confirmar('¿Borrar definitivamente este artículo?')) return
    const { error } = await supabase.from('articulos').delete().eq('id', id)
    if (error) setError('No se ha podido borrar.')
    else navigate(base === '/gestion' ? '/gestion/articulos' : base)
  }

  return (
    <>
      <div className="titulo-bloque">
        <h1>{id ? 'Editar artículo' : 'Nuevo artículo'}</h1>
        <span className={`estado estado-${a.estado}`}>{ESTADOS[a.estado]}</span>
      </div>

      {a.nota_revision && a.estado === 'rechazado' && esMio && (
        <div className="caja-aviso"><b>Comentarios del revisor:</b> {a.nota_revision}</div>
      )}

      <div className="pestanas">
        <button className={!vista ? 'activa' : ''} onClick={() => setVista(false)}>Escribir</button>
        <button className={vista ? 'activa' : ''} onClick={() => setVista(true)}>Vista previa</button>
      </div>

      {vista ? (
        <div className="vista-previa">
          <h1 className="titulo-articulo">{a.titulo}</h1>
          <p className="entradilla">{a.resumen}</p>
          {a.imagen_url && <img src={a.imagen_url} alt="" className="imagen-articulo" />}
          <Texto>{a.contenido}</Texto>
        </div>
      ) : (
        <fieldset className="formulario" disabled={soloLectura}>
          <label>
            Título
            <input value={a.titulo} onChange={set('titulo')} maxLength={200} />
          </label>
          <div className="dos-col">
            <label>
              Sección
              <select value={a.seccion} onChange={set('seccion')}>
                {seccionesDisponibles(perfil).map((s) => <option key={s} value={s}>{SECCIONES[s].nombre}</option>)}
              </select>
            </label>
            <label>
              Firma (nombre que aparece publicado)
              <input value={a.firma || ''} onChange={set('firma')} />
            </label>
          </div>
          {['noticias', 'medios'].includes(a.seccion) && (
            <label>
              {a.seccion === 'noticias' ? 'Fecha del comunicado' : 'Fecha en que salió en el medio'}
              <input type="date" required value={(a.fecha || '').slice(0, 10)} onChange={set('fecha')} max={new Date().toISOString().slice(0, 10)} />
              <small>{a.seccion === 'noticias' ? 'Con esta fecha se ordena. Los de más de un mes pasan solos a «Comunicados anteriores».' : 'Con esta fecha se ordena. Las de más de un mes pasan solas a «Anteriores».'}</small>
            </label>
          )}
          {a.seccion === 'medios' && (
            <div className="dos-col">
              <label>
                Medio de comunicación
                <input value={a.medio || ''} onChange={set('medio')} placeholder="Nombre del periódico, radio, TV…" />
              </label>
              <label>
                Enlace a la noticia original
                <input type="url" value={a.enlace_externo || ''} onChange={set('enlace_externo')} placeholder="https://" />
              </label>
            </div>
          )}
          {a.seccion === 'recomendaciones' && (
            <div className="tres-col">
              <label>
                Tipo
                <select value={a.tipo_recomendacion || 'articulo'} onChange={set('tipo_recomendacion')}>
                  {Object.entries(TIPOS_RECOMENDACION).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </label>
              <label>
                Fuente (web, periódico, revista o editorial)
                <input value={a.medio || ''} onChange={set('medio')} placeholder="Nombre de la publicación o editorial" />
              </label>
              <label>
                Enlace (opcional en libros)
                <input type="url" value={a.enlace_externo || ''} onChange={set('enlace_externo')} placeholder="https://" />
              </label>
            </div>
          )}
          {a.seccion === 'recomendaciones' && (
            <p className="letra-pequena">Ponga en "Firma" el autor del original. En "Resumen" escriba por qué lo recomendamos. No copie el texto original: enlace a él (derechos de autor).</p>
          )}
          {a.seccion === 'medios' && (
            <p className="letra-pequena">Escriba solo un resumen breve y enlace al original. No copie el texto completo del medio (derechos de autor).</p>
          )}
          <label>
            Resumen / entradilla
            <textarea rows={2} value={a.resumen || ''} onChange={set('resumen')} maxLength={400} />
          </label>
          <label>
            Texto
            <textarea rows={16} value={a.contenido} onChange={set('contenido')} />
            <small>Formato: línea en blanco = nuevo párrafo · ## Subtítulo · **negrita** · *cursiva* · - lista · [texto](https://enlace)</small>
          </label>
          <label>
            Imagen principal
            <input type="file" accept="image/*" onChange={subirImagen} />
            {a.imagen_url && <img src={a.imagen_url} alt="" className="miniatura" />}
          </label>

          <div className="caja-ia">
            <h3>Uso de inteligencia artificial (registro interno)</h3>
            <p className="letra-pequena">No se muestra en la web: el uso de IA se explica en la página general «Transparencia IA» del pie. Se anota aquí solo como registro interno.</p>
            {Object.entries(USO_IA).map(([k, v]) => (
              <label key={k} className="check">
                <input type="radio" name="uso_ia" value={k} checked={a.uso_ia === k} onChange={set('uso_ia')} />
                <span>{v}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {publica && a.estado !== 'publicado' && (
        <label className="formulario">
          Comentarios para el autor (si se devuelve)
          <textarea rows={2} value={a.nota_revision || ''} onChange={set('nota_revision')} />
        </label>
      )}

      {error && <p className="error">{error}</p>}
      {msg && <p className="aviso-ok">{msg}</p>}

      <div className="acciones">
        {!soloLectura && a.estado !== 'publicado' && (
          <button className="btn btn-claro" disabled={guardando} onClick={() => guardar('borrador')}>Guardar borrador</button>
        )}
        {!soloLectura && !publica && (
          <button className="btn" disabled={guardando} onClick={() => guardar('revision')}>Enviar a {APROBADOR.nombre} para aprobar</button>
        )}
        {publica && a.estado === 'publicado' && (
          <>
            <button className="btn" disabled={guardando} onClick={() => guardar('publicado')}>Guardar cambios</button>
            <button className="btn btn-claro" disabled={guardando} onClick={() => guardar('borrador')}>Retirar de la web</button>
          </>
        )}
        {publica && a.estado !== 'publicado' && (
          <>
            <button className="btn" disabled={guardando} onClick={() => guardar('publicado')}>Aprobar y publicar</button>
            {id && !esMio && (
              <button className="btn btn-claro" disabled={guardando} onClick={() => guardar('rechazado')}>Devolver al autor</button>
            )}
          </>
        )}
        {id && (['autor', 'editor', 'director', 'admin'].includes(perfil.rol) || (esMio && a.estado === 'borrador')) && (
          <button className="btn-texto peligro" onClick={borrar}>Borrar</button>
        )}
      </div>
    </>
  )
}
