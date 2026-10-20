import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { SECCIONES } from '../lib/config'
import { DEMO } from '../lib/supabase'
import { getAjustes } from '../lib/data'
import Redes from './Redes'
import logo from '../assets/logo.png'
import logoClaro from '../assets/logo-claro.png'
import { useAuth, destino } from '../lib/auth'
import { urlBoletin } from '../lib/boletin'

const sec = (k) => ({ texto: SECCIONES[k].nombre, ruta: SECCIONES[k].ruta })
const MENU = [
  { texto: 'Sobre PATRIAM', ruta: '/sobre-patriam' },
  { texto: 'Nosotros', ruta: '/nosotros' },
  { texto: 'Acción', hijos: [sec('ciudadana'), sec('cultural'), sec('social'), { texto: 'Campañas de firmas', ruta: '/campanas' }] },
  { texto: 'Actualidad', hijos: [sec('noticias'), sec('revista'), sec('recomendaciones'), sec('medios')] },
  { texto: 'Tienda', ruta: '/tienda' },
  { texto: 'Contacto', ruta: '/contacto' },
]

function Desplegable({ item, cerrar }) {
  const { pathname } = useLocation()
  const activo = item.hijos.some((h) => h.ruta && pathname.startsWith(h.ruta))
  return (
    <div className="despl">
      <button className={`despl-btn ${activo ? 'active' : ''}`} aria-haspopup="true">
        {item.texto} <span aria-hidden>▾</span>
      </button>
      <div className="despl-menu">
        {item.hijos.map((h) =>
          h.externo ? (
            <a key={h.externo} href={h.externo} target="_blank" rel="noopener noreferrer" onClick={cerrar}>
              {h.texto} ↗
            </a>
          ) : (
            <NavLink key={h.ruta} to={h.ruta} onClick={cerrar}>
              {h.texto}
            </NavLink>
          ),
        )}
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
  const menu = MENU.map((m) => (m.texto === 'Actualidad' ? { ...m, hijos: [...m.hijos, { texto: 'Boletín semanal', externo: urlBoletin(aj) }] } : m))
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
            <Link to="/adhierete" className="btn btn-cabecera">Adhiérete</Link>
          </div>
        </div>
        {/* Menú principal: siempre visible arriba, también en móvil */}
        <nav className="menu-principal" aria-label="Menú principal">
          <div className="contenedor menu-in">
            <NavLink end to="/">Inicio</NavLink>
            {menu.map((m) =>
              m.hijos ? (
                <Desplegable key={m.texto} item={m} cerrar={cerrar} />
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
      <main>
        <Outlet />
      </main>
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
