import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getPagina, getAjustes, listarPublicados, listarCampanas, totalFirmas, fecha, euros } from '../lib/data'
import { SECCIONES } from '../lib/config'
import Texto from '../components/Texto'
import { ImagenProducto } from './Tienda'
import { Foto } from '../components/ImagenPrueba'

// Imagen del artículo o, si no tiene, un fondo granate con el nombre de la sección
function Portadilla({ a, grande }) {
  return <Foto src={a.imagen_url} ratio={grande ? '21 / 9' : '4 / 3'} className="portadilla" />
}

function Bloque({ titulo, ruta, items, render }) {
  return (
    <section className="bloque-seccion">
      <div className="bloque-cab">
        <h2>{titulo}</h2>
        <Link to={ruta}>Ver todo →</Link>
      </div>
      {items.length ? <ul className="bloque-lista">{items.map(render)}</ul> : <p className="vacio">Próximamente.</p>}
    </section>
  )
}

export default function Inicio() {
  const [intro, setIntro] = useState(null)
  const [ultimos, setUltimos] = useState([])
  const [campana, setCampana] = useState(null)
  const [acciones, setAcciones] = useState([])
  const [productos, setProductos] = useState([])
  const [, setAj] = useState({})

  useEffect(() => {
    getPagina('inicio').then(setIntro)
    getAjustes().then((x) => setAj(x || {}))
    listarPublicados({ limite: 40 }).then(setUltimos)
    listarCampanas().then(async ([c]) => c && setCampana({ ...c, n: await totalFirmas(c) }))
    supabase.from('acciones').select('*').eq('publicada', true).eq('aprobada', true).gte('fecha_inicio', new Date().toISOString()).order('fecha_inicio').limit(4)
      .then(({ data }) => setAcciones(data || []))
    supabase.from('productos').select('*').eq('activo', true).order('orden').limit(4).then(({ data }) => setProductos(data || []))
  }, [])

  const de = (s, n = 3) => ultimos.filter((a) => a.seccion === s).slice(0, n)
  const [principal] = ultimos.filter((a) => ['revista', 'noticias', 'ciudadana', 'cultural', 'social'].includes(a.seccion))
  // A la derecha, el resumen de lo más importante: próxima acción, recogida de firmas, último comunicado y lo último de la Revista
  const otro = (s) => ultimos.find((a) => a.seccion === s && a !== principal)
  const latRevista = otro('revista'), latNoticia = otro('noticias')
  const proxima = acciones[0]

  const itemArticulo = (a) => (
    <li key={a.id}>
      <Link to={a.seccion === 'recomendaciones' && a.enlace_externo ? '/revista/recomendaciones' : `/articulo/${a.slug}`}>
        <span className="mini-fecha">{fecha(a.fecha || a.publicado_at)}</span>
        <b>{a.titulo}</b>
        {a.medio && <span className="mini">{a.medio}</span>}
      </Link>
    </li>
  )

  return (
    <>
      {/* Destacados, como la portada de una revista */}
      {principal && (
        <section className="destacados contenedor">
          <Link to={`/articulo/${principal.slug}`} className="destacado-principal">
            <Portadilla a={principal} grande />
            <div className="destacado-texto">
              <span className="etiqueta">{SECCIONES[principal.seccion]?.nombre}</span>
              <h1>{principal.titulo}</h1>
              {principal.resumen && <p>{principal.resumen}</p>}
              <span className="mini-fecha">{fecha(principal.publicado_at)}{principal.firma ? ` · ${principal.firma}` : ''}</span>
            </div>
          </Link>
          <div className="destacados-laterales">
            {proxima && (
              <Link to={`/accion/${proxima.slug}`} className="destacado-lateral lat-accion">
                <span className="firmas-num lat-dia"><b>{new Date(proxima.fecha_inicio).getDate()}</b>{new Date(proxima.fecha_inicio).toLocaleDateString('es-ES', { month: 'short' }).replace('.', '')}</span>
                <div>
                  <span className="etiqueta">Próxima acción</span>
                  <h3>{proxima.titulo}</h3>
                  <span className="mini-fecha">{new Date(proxima.fecha_inicio).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}{proxima.lugar ? ` · ${proxima.lugar}` : ''}</span>
                </div>
              </Link>
            )}
            {campana && (
              <Link to={`/campanas/${campana.slug}`} className="destacado-lateral lat-firmas">
                <span className="firmas-num"><b>{campana.n.toLocaleString('es-ES')}</b>firmas</span>
                <div>
                  <span className="etiqueta">Recogida de firmas</span>
                  <h3>{campana.titulo}</h3>
                  <span className="firmas-btn">Firma ahora →</span>
                </div>
              </Link>
            )}
            {latNoticia && (
              <Link to={`/articulo/${latNoticia.slug}`} className="destacado-lateral">
                <Portadilla a={latNoticia} />
                <div>
                  <span className="etiqueta">Noticias y comunicados</span>
                  <h3>{latNoticia.titulo}</h3>
                  <span className="mini-fecha">{fecha(latNoticia.fecha || latNoticia.publicado_at)}</span>
                </div>
              </Link>
            )}
            {latRevista && (
              <Link to={`/articulo/${latRevista.slug}`} className="destacado-lateral">
                <Portadilla a={latRevista} />
                <div>
                  <span className="etiqueta">Revista</span>
                  <h3>{latRevista.titulo}</h3>
                  <span className="mini-fecha">{fecha(latRevista.publicado_at)}{latRevista.firma ? ` · ${latRevista.firma}` : ''}</span>
                </div>
              </Link>
            )}
          </div>
        </section>
      )}


      {/* Presentación breve */}
      <section className="presentacion">
        <div className="contenedor presentacion-in">
          <div>
            <h2>{intro?.titulo || 'PATRIAM'}</h2>
            <Texto className="presentacion-texto">{intro?.contenido}</Texto>
          </div>
          <div className="botones">
            <Link to="/sobre-patriam" className="btn btn-oro">Conócenos</Link>
          </div>
        </div>
      </section>


      {/* Bloques por sección */}
      <div className="contenedor bloques-seccion">
        <Bloque titulo="Comunicados" ruta="/comunicados" items={de('noticias')} render={itemArticulo} />
        <Bloque
          titulo="Próximas acciones"
          ruta="/accion-ciudadana"
          items={acciones}
          render={(a) => (
            <li key={a.id}>
              <Link to={`/accion/${a.slug}`} className="con-fecha">
                <span className="fecha-mini">
                  <b>{new Date(a.fecha_inicio).getDate()}</b>
                  {new Date(a.fecha_inicio).toLocaleDateString('es-ES', { month: 'short' })}
                </span>
                <span>
                  <b>{a.titulo}</b>
                  <span className="mini">{SECCIONES[a.seccion]?.nombre}{a.lugar ? ` · ${a.lugar}` : ''}</span>
                </span>
              </Link>
            </li>
          )}
        />
        <Bloque titulo="Revista" ruta="/revista" items={de('revista')} render={itemArticulo} />
      </div>


      {productos.length > 0 && (
        <section className="contenedor bloque">
          <div className="bloque-cab">
            <h2>Tienda</h2>
            <Link to="/tienda">Ver toda la tienda →</Link>
          </div>
          <div className="rejilla-tienda">
            {productos.map((p) => (
              <Link key={p.id} to={`/tienda/${p.slug}`} className="producto">
                <ImagenProducto p={p} />
                <div className="producto-cuerpo">
                  <h3>{p.nombre}</h3>
                  <b className="precio">{Number(p.precio) ? euros(p.precio) : 'Gratuito'}</b>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="contenedor bloque sin-arriba">
        <div className="cta-doble">
          <div>
            <h2>Únete</h2>
            <p>Forma parte de la asociación con una cuota periódica.</p>
            <Link to="/unete" className="btn">Únete</Link>
          </div>
          <div>
            <h2>Haz un donativo</h2>
            <p>Con tarjeta, de forma segura. Puede ser anónimo.</p>
            <Link to="/adhierete?tipo=donativo" className="btn btn-claro">Donar</Link>
          </div>
        </div>
      </section>
    </>
  )
}
