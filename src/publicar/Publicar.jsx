// «Publicar»: la forma más sencilla de publicar en la web, el boletín y la tienda.
// Se abre en publicar.movimientopatriam.es (o en /#/publicar). Cada uno entra con su email y su contraseña
// del equipo. Todo lo que se publica aquí pasa por la aprobación de Carlos, igual que desde la Gestión.
import { useEffect, useState } from 'react'
import { Link, Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { entrar as entrarEquipo } from '../lib/equipo'
import { useAuth } from '../lib/auth'
import { getAjustes } from '../lib/data'
import { urlBoletin } from '../lib/boletin'
import { activo, puedeAprobar } from '../lib/permissions'
import { APROBADOR } from '../lib/config'
import logo from '../assets/logo.png'
import CambiarClave from '../admin/CambiarClave'
import Editor from '../admin/Editor'
import Articulos from '../admin/Articulos'
import AccionesAdmin from '../admin/AccionesAdmin'
import CampanasAdmin from '../admin/CampanasAdmin'
import TiendaAdmin from '../admin/TiendaAdmin'
import RecomendacionesAdmin from '../admin/RecomendacionesAdmin'
import Paginas from '../admin/Paginas'
import Redes from '../admin/Redes'
import Aprobaciones from '../admin/Aprobaciones'
import Claves from './Claves'
import InstalarApp from '../admin/InstalarApp'

// Iconos de trazo (los mismos del menú de la web)
const ICONOS = {
  pluma: 'M20 4c-7 0-12 5-13 12l-3 4M7 16c4 0 9-3 10-8',
  periodico: 'M4 5h13v14a2 2 0 002 2H6a2 2 0 01-2-2zM17 9h3v10a2 2 0 01-2 2M7.5 9h6M7.5 13h6M7.5 17h4',
  micro: 'M12 3a3 3 0 00-3 3v6a3 3 0 006 0V6a3 3 0 00-3-3zM5 11a7 7 0 0014 0M12 18v3',
  calendario: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  firma: 'M3 17c3-4 5-9 7-9s-1 9 2 9 3-5 5-5 2 3 4 3M3 21h18',
  bolsa: 'M5 8h14l-1 12H6zM9 8V6a3 3 0 016 0v2',
  estrella: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z',
  texto: 'M5 5h14M12 5v14M8 19h8',
  sobre: 'M3 6h18v12H3zM3 7l9 6 9-6',
  red: 'M18 8a3 3 0 100-6 3 3 0 000 6zM6 15a3 3 0 100-6 3 3 0 000 6zM18 22a3 3 0 100-6 3 3 0 000 6zM8.6 13.5l6.8 4M15.4 6.5l-6.8 4',
  check: 'M4 12l5 5L20 6',
  lista: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  llave: 'M15 7a4 4 0 11-3.9 4.9L4 19v-3h3v-3h3l1.1-1.1A4 4 0 0115 7z',
}
const Icono = ({ n }) => (
  <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={ICONOS[n]} />
  </svg>
)

// Cada cosa que se puede publicar: título, explicación y dónde sale en la web
const COSAS = [
  { ruta: 'articulo', titulo: 'Artículo de la revista', texto: 'Opinión, análisis y formación.', sale: 'Revista', icono: 'pluma', grupo: 'web' },
  { ruta: 'comunicado', titulo: 'Comunicado', texto: 'Un comunicado oficial de PATRIAM.', sale: 'Comunicados', icono: 'periodico', grupo: 'web' },
  { ruta: 'medios', titulo: 'Salida en medios', texto: 'Una entrevista, noticia o tertulia en la que sale PATRIAM.', sale: 'Medios', icono: 'micro', grupo: 'web' },
  { ruta: 'accion', titulo: 'Acción en la agenda', texto: 'Concentración, conferencia, recogida, taller…', sale: 'Agenda', icono: 'calendario', grupo: 'web' },
  { ruta: 'campana', titulo: 'Campaña de firmas', texto: 'Enlace a la petición de CitizenGO.', sale: 'Campañas', icono: 'firma', grupo: 'web' },
  { ruta: 'recomendacion', titulo: 'Recomendación', texto: 'Un libro, artículo, pódcast o vídeo.', sale: 'Recomendaciones', icono: 'estrella', grupo: 'web' },
  { ruta: 'producto', titulo: 'Producto de la tienda', texto: 'Ropa, libros, cursos o actividades.', sale: 'Tienda', icono: 'bolsa', grupo: 'tienda' },
  { ruta: 'textos', titulo: 'Cambiar textos de la web', texto: 'Inicio, Sobre PATRIAM, Únete, Contacto…', sale: 'Páginas', icono: 'texto', grupo: 'web' },
  { ruta: 'redes', titulo: 'Redes sociales', texto: 'Preparar y apuntar publicaciones en X, Instagram…', sale: 'Redes', icono: 'red', grupo: 'otros' },
  { ruta: 'claves', titulo: 'Claves secretas (APIs)', texto: 'Stripe, Gelato, Awin, Brevo y WhatsApp. Se ponen una vez y quedan en el servidor.', sale: 'Solo en el servidor', icono: 'llave', grupo: 'otros' },
]

// En publicar.movimientopatriam.es los enlaces a la web van a la web principal
const EN_SUBDOMINIO = typeof location !== 'undefined' && /^publicar\./i.test(location.hostname)
const WEB = EN_SUBDOMINIO ? 'https://' + location.hostname.replace(/^publicar\./i, '') : ''

export default function Publicar() {
  const { session, perfil, tipo, cargando, salir } = useAuth()

  if (cargando) return <div className="pub-centro">Cargando…</div>
  if (!session) return <Entrar />
  if (tipo !== 'equipo' || !activo(perfil))
    return (
      <div className="pub-centro">
        <h1>Sin acceso</h1>
        <p>Esta página es solo para el equipo de PATRIAM.</p>
        <button className="btn" onClick={salir}>Salir</button>
      </div>
    )
  if (perfil.cambiar_clave) return <CambiarClave />

  return (
    <div className="pub">
      <header className="pub-cab">
        <Link to="/publicar" className="pub-logo"><img src={logo} alt="PATRIAM" /><span>Publicar</span></Link>
        <div className="pub-quien">
          <InstalarApp />
          <span>{perfil.nombre || perfil.email}</span>
          <button className="btn-texto" onClick={salir}>Salir</button>
        </div>
      </header>
      <main className="pub-main">
        <Routes>
          <Route index element={<Inicio />} />
          <Route path="articulo" element={<Paso titulo="Nuevo artículo de la revista"><Editor key="revista" seccionInicial="revista" base="/publicar" /></Paso>} />
          <Route path="comunicado" element={<Paso titulo="Nuevo comunicado"><Editor key="noticias" seccionInicial="noticias" base="/publicar" /></Paso>} />
          <Route path="medios" element={<Paso titulo="Nueva salida en medios" ayuda="Ponga el nombre del medio y el enlace a la noticia, entrevista o vídeo."><Editor key="medios" seccionInicial="medios" base="/publicar" /></Paso>} />
          <Route path="nuevo" element={<Paso titulo="Nuevo artículo"><Editor key="nuevo" base="/publicar" /></Paso>} />
          <Route path="editar/:id" element={<EditarArticulo />} />
          <Route path="accion" element={<Paso titulo="Nueva acción en la agenda" ayuda="Rellene título, fecha, lugar y un resumen. Puede añadir el cartel."><AccionesAdmin nuevo /></Paso>} />
          <Route path="acciones" element={<Paso titulo="Agenda de acciones"><AccionesAdmin /></Paso>} />
          <Route path="campana" element={<Paso titulo="Nueva campaña de firmas" ayuda="Cree la petición en CitizenGO y pegue aquí el enlace."><CampanasAdmin nuevo /></Paso>} />
          <Route path="campanas" element={<Paso titulo="Campañas de firmas"><CampanasAdmin /></Paso>} />
          <Route path="recomendacion" element={<Paso titulo="Nueva recomendación"><RecomendacionesAdmin nuevo /></Paso>} />
          <Route path="producto" element={<Paso titulo="Nuevo producto de la tienda"><TiendaAdmin nuevo /></Paso>} />
          <Route path="textos" element={<Paso titulo="Cambiar textos de la web" ayuda="Elija la página, cambie el texto y guarde. Una línea en blanco separa los párrafos."><Paginas /></Paso>} />
          <Route path="redes" element={<Paso titulo="Redes sociales"><Redes /></Paso>} />
          <Route path="claves" element={<Paso titulo="Claves secretas de las aplicaciones" ayuda="Todas las claves de API que usan la web y el boletín. Se ponen una vez y quedan guardadas solo en el servidor."><Claves /></Paso>} />
          <Route path="mis-publicaciones" element={<Paso titulo="Lo publicado y en revisión"><Articulos base="/publicar" /></Paso>} />
          <Route path="aprobar" element={puedeAprobar(perfil) ? <Paso titulo="Pendiente de aprobar"><Aprobaciones base="/publicar" /></Paso> : <Navigate to="/publicar" replace />} />
          <Route path="*" element={<Navigate to="/publicar" replace />} />
        </Routes>
      </main>
    </div>
  )
}

function Inicio() {
  const { perfil } = useAuth()
  const [aj, setAj] = useState({})
  const [pendientes, setPendientes] = useState(null)
  const aprueba = puedeAprobar(perfil)

  useEffect(() => {
    getAjustes().then(setAj)
    if (!aprueba) return
    Promise.all([
      supabase.from('articulos').select('id').eq('estado', 'revision'),
      ...['acciones', 'campanas', 'productos', 'sedes', 'cargos', 'documentos'].map((t) => supabase.from(t).select('id').eq('aprobada', false)),
    ]).then((rs) => setPendientes(rs.reduce((n, r) => n + (r.data?.length || 0), 0)))
  }, [aprueba])

  const boletin = urlBoletin(aj)
  const nombre = (perfil.nombre || '').split(' ')[0]

  return (
    <>
      <div className="pub-saludo">
        <h1>Hola{nombre ? `, ${nombre}` : ''}. ¿Qué quieres publicar?</h1>
        <p>
          Elige una opción, rellena el formulario y pulsa guardar.{' '}
          {aprueba ? 'Lo que publiques sale directamente en la web.' : `Antes de salir en la web, ${APROBADOR.nombre} lo revisa y lo aprueba; te llegará un aviso.`}
        </p>
      </div>

      {aprueba && (
        <Link to="/publicar/aprobar" className={`pub-aprobar ${pendientes ? 'hay' : ''}`}>
          <Icono n="check" />
          <span><b>Pendiente de aprobar</b><small>{pendientes === null ? '…' : pendientes ? `${pendientes} ${pendientes === 1 ? 'cosa espera' : 'cosas esperan'} tu visto bueno` : 'No hay nada pendiente'}</small></span>
          {pendientes > 0 && <em>{pendientes}</em>}
        </Link>
      )}

      <h2 className="pub-grupo">En la web</h2>
      <div className="pub-rejilla">
        {COSAS.filter((c) => c.grupo === 'web').map((c) => <Baldosa key={c.ruta} c={c} />)}
      </div>

      <h2 className="pub-grupo">Boletín y tienda</h2>
      <div className="pub-rejilla">
        <a className="pub-baldosa" href={`${boletin}editor.html`} target="_blank" rel="noopener noreferrer">
          <span className="pub-icono"><Icono n="sobre" /></span>
          <b>Boletín semanal ↗</b>
          <small>Editorial, noticias, colaboraciones… Se abre el editor del boletín con tu usuario del boletín.</small>
        </a>
        {COSAS.filter((c) => c.grupo !== 'web').map((c) => <Baldosa key={c.ruta} c={c} />)}
      </div>

      <h2 className="pub-grupo">Revisar</h2>
      <div className="pub-enlaces">
        <Link to="/publicar/mis-publicaciones"><Icono n="lista" /> Artículos, comunicados y medios</Link>
        <Link to="/publicar/acciones"><Icono n="calendario" /> Toda la agenda</Link>
        <Link to="/publicar/campanas"><Icono n="firma" /> Todas las campañas</Link>
        <a href={`${WEB}/#/`} target="_blank" rel="noopener noreferrer">Ver la web ↗</a>
        <a href={`${WEB}/#/gestion`} target={EN_SUBDOMINIO ? '_blank' : undefined} rel="noopener noreferrer">Ir a la Gestión completa{EN_SUBDOMINIO ? ' ↗' : ' →'}</a>
      </div>
    </>
  )
}

function Baldosa({ c }) {
  return (
    <Link to={`/publicar/${c.ruta}`} className="pub-baldosa">
      <span className="pub-icono"><Icono n={c.icono} /></span>
      <b>{c.titulo}</b>
      <small>{c.texto}</small>
      <span className="pub-sale">Sale en: {c.sale}</span>
    </Link>
  )
}

function Paso({ titulo, ayuda, children }) {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return (
    <div className="pub-paso">
      <Link to="/publicar" className="pub-volver">← Volver a Publicar</Link>
      <h1>{titulo}</h1>
      {ayuda && <p className="pub-ayuda">{ayuda}</p>}
      <div className="pub-formulario">{children}</div>
    </div>
  )
}

function EditarArticulo() {
  const { id } = useParams()
  return <Paso titulo="Editar"><Editor key={id} base="/publicar" /></Paso>
}

function Entrar() {
  const [f, setF] = useState({ email: '', clave: '' })
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)
  const entrar = async (e) => {
    e.preventDefault()
    setError('')
    setEnviando(true)
    const { error } = await entrarEquipo(f.email.trim(), f.clave)
    setEnviando(false)
    if (error) setError(error.message && !/Credenciales/.test(error.message) ? error.message : 'Email o contraseña incorrectos.')
  }
  return (
    <div className="pub-entrar">
      <form className="pub-entrar-caja formulario" onSubmit={entrar}>
        <img src={logo} alt="PATRIAM" />
        <h1>Publicar</h1>
        <p>Entra con tu email y tu contraseña del equipo para publicar en la web, el boletín y la tienda.</p>
        <label>Email<input type="email" required autoComplete="username" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></label>
        <label>Contraseña<input type="password" required autoComplete="current-password" value={f.clave} onChange={(e) => setF({ ...f, clave: e.target.value })} /></label>
        {error && <p className="error">{error}</p>}
        <button className="btn btn-bloque" disabled={enviando}>{enviando ? 'Entrando…' : 'Entrar'}</button>
        <div className="pub-instalar"><InstalarApp /></div>
      </form>
    </div>
  )
}
