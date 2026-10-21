import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getPagina, getAjustes, listarPublicados, listarCampanas, totalFirmas, fecha, euros } from '../lib/data'
import { SECCIONES } from '../lib/config'
import Texto from '../components/Texto'
import { ImagenProducto } from './Tienda'
import { Foto } from '../components/ImagenPrueba'
import BloqueBoletin from '../components/BloqueBoletin'
import { urlBoletin } from '../lib/boletin'

const I = {
  socio: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 21a8 8 0 0116 0',
  firma: 'M4 20h16M6 16l9-9 3 3-9 9H6z',
  tienda: 'M5 8h14l-1 12H6zM9 8V6a3 3 0 016 0v2',
  revista: 'M5 4h11l3 3v13H5zM8 9h8M8 13h8M8 17h5',
}
const Icono = ({ d }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={d} />
  </svg>
)

const ACCESOS = [
  { ruta: '/adhierete', icono: I.socio, titulo: 'Hazte socio', texto: 'Forma parte de la asociación' },
  { ruta: '/campanas', icono: I.firma, titulo: 'Firma una campaña', texto: 'Apoya nuestras iniciativas' },
  { ruta: '/tienda', icono: I.tienda, titulo: 'Tienda', texto: 'Libros, ropa y actividades' },
  { ruta: '/revista', icono: I.revista, titulo: 'Revista', texto: 'Artículos y opinión' },
]

// Imagen del artículo o, si no tiene, un fondo granate con el nombre de la sección
function Portadilla({ a, grande }) {
  return <Foto src={a.imagen_url} ratio={grande ? '16 / 9' : '4 / 3'} className="portadilla" />
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
  const [aj, setAj] = useState({})

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
  const [principal, ...resto] = ultimos.filter((a) => ['revista', 'noticias', 'ciudadana', 'cultural', 'social'].includes(a.seccion))
  const laterales = resto.slice(0, 3)

  const itemArticulo = (a) => (
    <li key={a.id}>
      <Link to={a.seccion === 'recomendaciones' && a.enlace_externo ? '/revista/recomendaciones' : `/articulo/${a.slug}`}>
        <span className="mini-fecha">{fecha(a.publicado_at)}</span>
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
            {laterales.map((a) => (
              <Link key={a.id} to={`/articulo/${a.slug}`} className="destacado-lateral">
                <Portadilla a={a} />
                <div>
                  <span className="etiqueta">{SECCIONES[a.seccion]?.nombre}</span>
                  <h3>{a.titulo}</h3>
                  <span className="mini-fecha">{fecha(a.publicado_at)}</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Boletín de la semana (web aparte, se abre en pestaña nueva) */}
      <BloqueBoletin base={urlBoletin(aj)} />

      {/* Presentación breve */}
      <section className="presentacion">
        <div className="contenedor presentacion-in">
          <div>
            <h2>{intro?.titulo || 'PATRIAM'}</h2>
            <Texto className="presentacion-texto">{intro?.contenido}</Texto>
          </div>
          <div className="botones">
            <Link to="/sobre-patriam" className="btn btn-oro">Conócenos</Link>
            <Link to="/adhierete" className="btn btn-claro-blanco">Únete</Link>
          </div>
        </div>
      </section>

      <section className="contenedor bloque">
        <div className="accesos">
          {ACCESOS.map((a) => (
            <Link key={a.ruta} to={a.ruta} className="acceso">
              <Icono d={a.icono} />
              <div>
                <b>{a.titulo}</b>
                <span>{a.texto}</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Bloques por sección */}
      <div className="contenedor bloques-seccion">
        <Bloque titulo="Noticias y comunicados" ruta="/noticias" items={de('noticias')} render={itemArticulo} />
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
        <Bloque titulo="En los medios" ruta="/en-los-medios" items={de('medios')} render={itemArticulo} />
        <Bloque titulo="Cultura" ruta="/accion-cultural" items={de('cultural')} render={itemArticulo} />
        <Bloque titulo="Recomendaciones" ruta="/revista/recomendaciones" items={de('recomendaciones')} render={itemArticulo} />
      </div>

      {campana && (
        <section className="banda-campana">
          <div className="contenedor banda-in">
            <div>
              <span className="etiqueta">Campaña activa</span>
              <h2>{campana.titulo}</h2>
              <p>{campana.resumen}</p>
            </div>
            <div className="banda-accion">
              <b>{campana.n.toLocaleString('es-ES')}</b> firmas
              <Link to={`/campanas/${campana.slug}`} className="btn">Firma ahora</Link>
            </div>
          </div>
        </section>
      )}

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
            <h2>Hazte socio</h2>
            <p>Forma parte de la asociación con una cuota periódica.</p>
            <Link to="/adhierete" className="btn">Quiero ser socio</Link>
          </div>
          <div>
            <h2>Haz un donativo</h2>
            <p>Tarjeta, Bizum o transferencia. Puede ser anónimo.</p>
            <Link to="/adhierete?tipo=donativo" className="btn btn-claro">Donar</Link>
          </div>
        </div>
      </section>
    </>
  )
}
