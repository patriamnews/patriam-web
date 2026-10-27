import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { SECCIONES } from '../lib/config'
import { fecha } from '../lib/data'
import { enviarCorreo } from '../lib/correo'

// Bandeja del aprobador: todo lo que espera su visto bueno antes de publicarse
export default function Aprobaciones({ base = '/gestion' }) {
  const [d, setD] = useState(null)
  const [msg, setMsg] = useState('')

  const cargar = async () => {
    const [{ data: arts }, { data: acc }, { data: camp }, { data: perf }, { data: sedes }, { data: prod }, { data: junta }, { data: docs }] = await Promise.all([
      supabase.from('articulos').select('id, titulo, seccion, firma, autor_id, actualizado_at').eq('estado', 'revision').order('actualizado_at'),
      supabase.from('acciones').select('*').eq('aprobada', false).order('fecha_inicio'),
      supabase.from('campanas').select('*').eq('aprobada', false),
      supabase.from('perfiles').select('id, nombre, email'),
      supabase.from('sedes').select('*').eq('aprobada', false),
      supabase.from('productos').select('*').eq('aprobada', false).order('orden'),
      supabase.from('cargos').select('*').eq('aprobada', false).order('orden'),
      supabase.from('documentos').select('*').eq('aprobada', false),
    ])
    setD({ arts: arts || [], acc: acc || [], camp: camp || [], sedes: sedes || [], prod: prod || [], junta: junta || [], docs: docs || [], gente: Object.fromEntries((perf || []).map((p) => [p.id, p])) })
  }
  useEffect(() => {
    cargar()
  }, [])

  const aprobar = async (tabla, x, que) => {
    await supabase.from(tabla).update({ aprobada: true }).eq('id', x.id)
    if (!x.titulo) x = { ...x, titulo: x.ciudad || x.nombre }
    const autor = d.gente[x.creado_por]
    let aviso = ''
    if (autor?.email) aviso = await enviarCorreo({ para: autor.email, asunto: `Aprobado: ${que} «${x.titulo}»`, cuerpo: 'Ya está publicado en la web.', enlace: '/gestion' })
    setMsg(`«${x.titulo}» aprobado y publicado. ${aviso}`)
    cargar()
  }

  if (!d) return <p>Cargando…</p>
  const total = d.arts.length + d.acc.length + d.camp.length + d.sedes.length + d.prod.length + d.junta.length + d.docs.length
  const bloque = (titulo, lista, tabla, que, enlace, linea) => (
    <>
      <h2 className="titulo-seccion espacio">{titulo} ({lista.length})</h2>
      {lista.length ? (
        <div className="lista-pedidos">
          {lista.map((x) => (
            <div key={x.id} className="pedido">
              <div className="pedido-cab">
                <span>{linea(x)}</span>
                <span className="acciones-fila">
                  <button className="btn" onClick={() => aprobar(tabla, x, que)}>Aprobar y publicar</button>
                  <Link to={enlace}>Editar</Link>
                </span>
              </div>
              {x.creado_por && d.gente[x.creado_por] && <div className="pedido-detalle"><p className="letra-pequena">Propuesto por {d.gente[x.creado_por].nombre}</p></div>}
            </div>
          ))}
        </div>
      ) : <p className="vacio">Ninguno.</p>}
    </>
  )

  return (
    <>
      <h1>Pendientes de aprobación</h1>
      <p>{total ? `${total} contenido${total > 1 ? 's' : ''} esperando su aprobación.` : 'No hay nada pendiente. Todo está al día.'}</p>
      {msg && <p className="aviso-ok">{msg}</p>}

      <h2 className="titulo-seccion">Artículos ({d.arts.length})</h2>
      {d.arts.length ? (
        <div className="tabla-scroll">
          <table className="tabla">
            <thead><tr><th>Título</th><th>Sección</th><th>Autor</th><th>Enviado</th><th></th></tr></thead>
            <tbody>
              {d.arts.map((a) => (
                <tr key={a.id}>
                  <td>{a.titulo}</td><td>{SECCIONES[a.seccion]?.nombre}</td><td>{d.gente[a.autor_id]?.nombre || a.firma}</td><td>{fecha(a.actualizado_at)}</td>
                  <td><Link to={`${base}/editar/${a.id}`}>Revisar y aprobar →</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className="vacio">Ninguno.</p>}

      <h2 className="titulo-seccion espacio">Acciones ({d.acc.length})</h2>
      {d.acc.length ? (
        <div className="lista-pedidos">
          {d.acc.map((a) => (
            <div key={a.id} className="pedido">
              <div className="pedido-cab">
                <span><b>{a.titulo}</b> · {SECCIONES[a.seccion]?.nombre} · {fecha(a.fecha_inicio)}{a.lugar ? ` · ${a.lugar}` : ''}</span>
                <span className="acciones-fila">
                  <button className="btn" onClick={() => aprobar('acciones', a, 'acción')}>Aprobar y publicar</button>
                  <Link to={`${base}/acciones`}>Editar</Link>
                </span>
              </div>
              <div className="pedido-detalle"><p>{a.resumen}</p><p className="letra-pequena">Propuesta por {d.gente[a.creado_por]?.nombre || '—'}</p></div>
            </div>
          ))}
        </div>
      ) : <p className="vacio">Ninguna.</p>}

      <h2 className="titulo-seccion espacio">Campañas ({d.camp.length})</h2>
      {d.camp.length ? (
        <div className="lista-pedidos">
          {d.camp.map((c) => (
            <div key={c.id} className="pedido">
              <div className="pedido-cab">
                <span><b>{c.titulo}</b> · {c.modo === 'externo' ? 'CitizenGO' : 'formulario propio'}</span>
                <span className="acciones-fila">
                  <button className="btn" onClick={() => aprobar('campanas', c, 'campaña')}>Aprobar y publicar</button>
                  <Link to={`${base}/campanas`}>Editar</Link>
                </span>
              </div>
              <div className="pedido-detalle"><p>{c.resumen}</p></div>
            </div>
          ))}
        </div>
      ) : <p className="vacio">Ninguna.</p>}

      <h2 className="titulo-seccion espacio">Sedes ({d.sedes.length})</h2>
      {d.sedes.length ? (
        <div className="lista-pedidos">
          {d.sedes.map((s) => (
            <div key={s.id} className="pedido">
              <div className="pedido-cab">
                <span><b>{s.ciudad}</b> · {s.email}{s.direccion ? ` · ${s.direccion}` : ''}</span>
                <span className="acciones-fila">
                  <button className="btn" onClick={() => aprobar('sedes', s, 'sede')}>Aprobar y publicar</button>
                  <Link to="/gestion/sedes">Editar</Link>
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : <p className="vacio">Ninguna.</p>}

      {bloque('Tienda: productos y actividades', d.prod, 'productos', 'producto', '/gestion/tienda', (p) => <><b>{p.nombre}</b> · {p.categoria} · {Number(p.precio).toFixed(2)} €</>)}
      {bloque('Junta directiva', d.junta, 'cargos', 'cambio en la junta', '/gestion/junta', (c) => <><b>{c.nombre}</b> · {c.cargo}</>)}
      {bloque('Documentos de transparencia', d.docs, 'documentos', 'documento', '/gestion/documentos', (x) => <><b>{x.titulo}</b> · {x.categoria}</>)}
    </>
  )
}
