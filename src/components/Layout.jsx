import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { SECCIONES } from '../lib/config'
import { DEMO } from '../lib/supabase'
import { getAjustes } from '../lib/data'
import Redes from './Redes'
import Lateral from './Lateral'
import logo from '../assets/logo.png'
import logoClaro from '../assets/logo-claro.png'
import { useAuth, destino } from '../lib/auth'
import { urlBoletin } from '../lib/boletin'

const sec = (k, desc, icono) => ({ texto: SECCIONES[k].nombre, ruta: SECCIONES[k].ruta, desc, icono })

// Iconos sencillos (trazo) para el menú desplegable
const ICONOS = {
  arco: 'M4 20V11a8 8 0 0116 0v9M8 20v-7a4 4 0 018 0v7M2 20h20',
  personas: 'M9 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM2.5 20a6.5 6.5 0 0113 0M16 4.5a3.5 3.5 0 010 6.5M18 13.5a6.5 6.5 0 013.5 6.5',
  sede: 'M12 21s7-6.2 7-11.5a7 7 0 10-14 0C5 14.8 12 21 12 21zM12 12a2.5 2.5 0 100-5 2.5 2.5 0 000 5z',
  bandera: 'M5 21V4M5 4h11l-2 4 2 4H5',
  libro: 'M4 5.5A2.5 2.5 0 016.5 3H20v15H6.5A2.5 2.5 0 004 20.5zM4 20.5A2.5 2.5 0 016.5 23H20',
  mano: 'M12 21l-7-6.5A4.5 4.5 0 0112 8.6a4.5 4.5 0 017 5.9z',
  firma: 'M3 17c3-4 5-9 7-9s-1 9 2 9 3-5 5-5 2 3 4 3M3 21h18',
  periodico: 'M4 5h13v14a2 2 0 002 2H6a2 2 0 01-2-2zM17 9h3v10a2 2 0 01-2 2M7.5 9h6M7.5 13h6M7.5 17h4',
  pluma: 'M20 4c-7 0-12 5-13 12l-3 4M7 16c4 0 9-3 10-8',
  estrella: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z',
  micro: 'M12 3a3 3 0 00-3 3v6a3 3 0 006 0V6a3 3 0 00-3-3zM5 11a7 7 0 0014 0M12 18v3',
  sobre: 'M3 6h18v12H3zM3 7l9 6 9-6',
}
const Icono = ({ n }) => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={ICONOS[n] || ICONOS.estrella} />
  </svg>
)

const MENU = [
  {
    texto: 'Quiénes somos',
    intro: 'Una asociación de acción ciudadana, cultural y social. No somos un partido.',
    hijos: [
      { texto: 'Sobre PATRIAM', ruta: '/sobre-patriam', desc: 'Quiénes somos, ideario y lema', icono: 'arco' },
      { texto: 'Nosotros', ruta: '/nosotros', desc: 'Junta directiva y transparencia', icono: 'personas' },
      { texto: 'Sedes y contacto', ruta: '/contacto', desc: 'Dónde estamos y cómo escribirnos', icono: 'sede' },
    ],
    destacado: { etiqueta: 'Únete', titulo: 'Hazte socio de PATRIAM', texto: 'Forma parte del cambio.', ruta: '/adhierete', boton: 'Únete' },
  },
  {
    texto: 'Acción',
    intro: 'Calle, cultura y servicio: la agenda de lo que hacemos.',
    hijos: [
      sec('ciudadana', 'Concentraciones, mesas y recogidas de firmas', 'bandera'),
      sec('cultural', 'Conferencias, libros, rutas y formación', 'libro'),
      sec('social', 'Alimentos, mayores y familias', 'mano'),
      { texto: 'Campañas de firmas', ruta: '/campanas', desc: 'Apoya con tu firma nuestras campañas', icono: 'firma' },
    ],
    destacado: { etiqueta: 'Agenda', titulo: 'Próximas acciones', texto: 'Consulta el calendario y apúntate.', ruta: '/accion-ciudadana', boton: 'Ver la agenda' },
  },
  {
    texto: 'Actualidad',
    intro: 'Opinión, noticias y lecturas, con criterio.',
    hijos: [
      sec('noticias', 'Comunicados y convocatorias', 'periodico'),
      sec('revista', 'Artículos de opinión y formación', 'pluma'),
      sec('recomendaciones', 'Lo que recomendamos leer y escuchar', 'estrella'),
      sec('medios', 'PATRIAM en prensa, radio y televisión', 'micro'),
    ],
    destacado: { etiqueta: 'Boletín semanal', titulo: 'Lo que hay que saber', texto: 'La editorial y las noticias de la semana.', boletin: true, boton: 'Leer el boletín ↗' },
  },
  { texto: 'Tienda', ruta: '/tienda' },
  { texto: 'Contacto', ruta: '/contacto' },
]

function Desplegable({ item, cerrar, boletin }) {
  const { pathname } = useLocation()
  const activo = item.hijos.some((h) => h.ruta && pathname.startsWith(h.ruta))
  const d = item.destacado
  return (
    <div className="despl mega">
      <button className={`despl-btn ${activo ? 'active' : ''}`} aria-haspopup="true">
        {item.texto} <span aria-hidden>▾</span>
      </button>
      <div className="despl-menu mega-panel">
        <div className="contenedor mega-in">
          <div className="mega-intro">
            <span className="mega-titulo">{item.texto}</span>
            <p>{item.intro}</p>
          </div>
          <div className="mega-items">
            {item.hijos.map((h) =>
              h.externo ? (
                <a key={h.externo} className="mega-item" href={h.externo} target="_blank" rel="noopener noreferrer" onClick={cerrar}>
                  <span className="mega-icono"><Icono n={h.icono || 'sobre'} /></span>
                  <span><b>{h.texto} ↗</b>{h.desc && <small>{h.desc}</small>}</span>
                </a>
              ) : (
                <NavLink key={h.ruta + h.texto} className="mega-item" to={h.ruta} onClick={cerrar}>
                  <span className="mega-icono"><Icono n={h.icono} /></span>
                  <span><b>{h.texto}</b>{h.desc && <small>{h.desc}</small>}</span>
                </NavLink>
              ),
            )}
          </div>
          {d && (
            <div className="mega-destacado">
              <span className="etiqueta">{d.etiqueta}</span>
              <b>{d.titulo}</b>
              <p>{d.texto}</p>
              {d.boletin ? (
                <a className="btn" href={boletin} target="_blank" rel="noopener noreferrer" onClick={cerrar}>{d.boton}</a>
              ) : (
                <Link className="btn" to={d.ruta} onClick={cerrar}>{d.boton}</Link>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function Layout() {
  const [aj, setAj] = useState({})
  const { pathname } = useLocation()
  const cerrar = () => document.activeElement?.blur()
  const { session, tipo } = useAuth()

  useEffect(() => {
    getAjustes().then(setAj)
  }, [])
  // El boletín semanal se abre en una pestaña nueva, sin cerrar la web
  const menu = MENU.map((m) => (m.texto === 'Actualidad' ? { ...m, hijos: [...m.hijos, { texto: 'Boletín semanal', externo: urlBoletin(aj), desc: 'Se abre en una pestaña nueva', icono: 'sobre' }] } : m))
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return (
    <div className="sitio">
      <header className="cabecera">
        <div className="contenedor cabecera-in">
          <Link to="/" className="logo" aria-label="PATRIAM, inicio">
            <img src={logo} alt="PATRIAM" className="logo-img" />
            <span className="lema-logo">Dios · Patria · Justicia</span>
          </Link>
          <div className="cabecera-derecha">
            <Redes aj={aj} clase="redes-mini" />
            <Link to={session ? destino(tipo) : '/acceso'} className="enlace-cuenta">
              <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden><path d="M12 12a4 4 0 100-8 4 4 0 000 8zM4 21a8 8 0 0116 0" /></svg>
              <span className="texto-cuenta">{session ? (tipo === 'equipo' ? 'Panel' : 'Mi área') : 'Acceder'}</span>
            </Link>
            <Link to="/adhierete" className="btn btn-cabecera">Únete</Link>
          </div>
        </div>
        {/* Menú principal: siempre visible arriba, también en móvil */}
        <nav className="menu-principal" aria-label="Menú principal">
          <div className="contenedor menu-in">
            <NavLink end to="/">Inicio</NavLink>
            {menu.map((m) =>
              m.hijos ? (
                <Desplegable key={m.texto} item={m} cerrar={cerrar} boletin={urlBoletin(aj)} />
              ) : (
                <NavLink key={m.ruta} to={m.ruta} onClick={cerrar}>
                  {m.texto}
                </NavLink>
              ),
            )}
          </div>
        </nav>
      </header>
      {DEMO && <div className="sello-demo" title="Los datos son simulados y se guardan solo en este navegador">Demostración</div>}
      {/* Todas las páginas llevan a la izquierda la agenda y el boletín de la semana */}
      <div className="con-lateral">
        <Lateral conCalendario={!/^\/accion-/.test(pathname)} />
        <main>
          <Outlet />
        </main>
      </div>
      <footer className="pie">
        <div className="contenedor pie-in">
          <div>
            <img src={logoClaro} alt="PATRIAM" className="logo-img logo-pie" />
            <p className="lema-pie">Dios · Patria · Justicia</p>
            <p>Asociación de acción ciudadana, cultural y social.</p>
            {aj.email_contacto && (
              <p>
                <a href={`mailto:${aj.email_contacto}`}>{aj.email_contacto}</a>
              </p>
            )}
            <Redes aj={aj} />
          </div>
          <nav>
            <Link to="/adhierete">Hazte socio</Link>
            <Link to="/adhierete?tipo=donativo">Donativos</Link>
            <Link to="/tienda">Tienda</Link>
            <Link to="/contacto">Contacto</Link>
            <a href={urlBoletin(aj)} target="_blank" rel="noopener noreferrer">Boletín semanal ↗</a>
            <a href={`${urlBoletin(aj)}#/suscribirse`} target="_blank" rel="noopener noreferrer">Suscríbete al boletín ↗</a>
          </nav>
          <nav>
            <Link to="/nosotros#transparencia">Transparencia</Link>
            <Link to="/aviso-legal">Aviso legal</Link>
            <Link to="/privacidad">Política de privacidad</Link>
            <Link to="/cookies">Cookies</Link>
            <Link to="/condiciones-de-venta">Condiciones de venta</Link>
            <Link to="/transparencia-ia">Transparencia IA</Link>
            <Link to="/acceso">Acceso socios, clientes y equipo</Link>
          </nav>
        </div>
      </footer>
    </div>
  )
}
