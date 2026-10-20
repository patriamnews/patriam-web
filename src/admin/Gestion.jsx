import { Link, Navigate, NavLink, Route, Routes } from 'react-router-dom'
import logoClaro from '../assets/logo-claro.png'
import { useAuth } from '../lib/auth'
import { ROLES, SECCIONES } from '../lib/config'
import { activo, puedeEditarPaginas, puedeGestionarUsuarios, puedeRedes, puedeTienda, puedeGestionarArea, puedeAprobar, puedeCampanas, puedeVerCorreos, puedeVerMensajes, puedeAdministracion } from '../lib/permissions'
import Escritorio from './Escritorio'
import Articulos from './Articulos'
import Editor from './Editor'
import Paginas from './Paginas'
import Junta from './Junta'
import SedesAdmin from './SedesAdmin'
import Documentos from './Documentos'
import Usuarios from './Usuarios'
import Mensajes from './Mensajes'
import Cuenta from './Cuenta'
import Redes from './Redes'
import CampanasAdmin from './CampanasAdmin'
import Socios from './Socios'
import Ajustes from './Ajustes'
import TiendaAdmin from './TiendaAdmin'
import AccionesAdmin from './AccionesAdmin'
import Aprobaciones from './Aprobaciones'
import Correos from './Correos'
import RecomendacionesAdmin from './RecomendacionesAdmin'
import Administracion from './Administracion'

export default function Gestion() {
  const { session, perfil, tipo, cargando, salir } = useAuth()

  if (cargando) return <div className="gestion-centro">Cargando…</div>
  if (!session) return <Navigate to="/acceso" replace />
  // Asociados y clientes no tienen panel: se les lleva a su área
  if (tipo !== 'equipo' && perfil?.rol !== 'pendiente') return <Navigate to="/mi-cuenta" replace />
  if (!activo(perfil))
    return (
      <div className="gestion-centro">
        <h1>Acceso pendiente</h1>
        <p>Su cuenta está creada, pero un administrador debe activarla y asignarle permisos.</p>
        <button className="btn" onClick={salir}>Salir</button>
      </div>
    )

  const p = perfil
  return (
    <div className="gestion">
      <aside className="gestion-menu">
        <Link to="/" className="logo"><img src={logoClaro} alt="PATRIAM" className="logo-img" /></Link>
        <div className="quien">
          <strong>{p.nombre || p.email}</strong>
          <span>
            {ROLES[p.rol]}
            {p.rol === 'editor' && p.area ? ` · ${SECCIONES[p.area].nombre}` : ''}
          </span>
        </div>
        <nav>
          <NavLink end to="/gestion">Escritorio</NavLink>
          <NavLink to="/gestion/articulos">Artículos</NavLink>
          <NavLink to="/gestion/nuevo">+ Nuevo artículo</NavLink>
          <NavLink to="/gestion/recomendaciones">Recomendaciones</NavLink>
          {puedeAprobar(p) && <NavLink to="/gestion/aprobaciones">Pendientes de aprobación</NavLink>}
          {['ciudadana', 'cultural', 'social'].some((a) => puedeGestionarArea(p, a)) && <NavLink to="/gestion/acciones">Agenda de acciones</NavLink>}
          {puedeRedes(p) && <NavLink to="/gestion/redes">Redes sociales</NavLink>}
          {puedeCampanas(p) && <NavLink to="/gestion/campanas">Campañas de firmas</NavLink>}
          {puedeTienda(p) && <NavLink to="/gestion/tienda">Tienda y pedidos</NavLink>}
          {puedeAdministracion(p) && <NavLink to="/gestion/administracion">Gestión administrativa</NavLink>}
          {puedeGestionarUsuarios(p) && <NavLink to="/gestion/socios">Socios y donativos</NavLink>}
          {puedeEditarPaginas(p) && <NavLink to="/gestion/paginas">Páginas</NavLink>}
          {puedeGestionarUsuarios(p) && <NavLink to="/gestion/sedes">Sedes</NavLink>}
          {puedeGestionarUsuarios(p) && <NavLink to="/gestion/junta">Junta directiva</NavLink>}
          {puedeGestionarUsuarios(p) && <NavLink to="/gestion/documentos">Documentos</NavLink>}
          {puedeGestionarUsuarios(p) && <NavLink to="/gestion/usuarios">Usuarios y permisos</NavLink>}
          {puedeVerMensajes(p) && <NavLink to="/gestion/mensajes">Mensajes recibidos</NavLink>}
          {puedeVerCorreos(p) && <NavLink to="/gestion/correos">Correos enviados</NavLink>}
          {puedeGestionarUsuarios(p) && <NavLink to="/gestion/ajustes">Ajustes (pagos y redes)</NavLink>}
          <NavLink to="/gestion/cuenta">Mi cuenta (equipo)</NavLink>
        </nav>
        <button className="btn-texto" onClick={salir}>Cerrar sesión</button>
      </aside>
      <section className="gestion-contenido">
        <Routes>
          <Route index element={<Escritorio />} />
          <Route path="articulos" element={<Articulos />} />
          <Route path="revision" element={<Articulos soloRevision />} />
          <Route path="nuevo" element={<Editor />} />
          <Route path="editar/:id" element={<Editor />} />
          <Route path="redes" element={<Redes />} />
          <Route path="campanas" element={<CampanasAdmin />} />
          <Route path="socios" element={<Socios />} />
          <Route path="tienda" element={<TiendaAdmin />} />
          <Route path="acciones" element={<AccionesAdmin />} />
          <Route path="aprobaciones" element={<Aprobaciones />} />
          <Route path="correos" element={<Correos />} />
          <Route path="recomendaciones" element={<RecomendacionesAdmin />} />
          <Route path="ajustes" element={<Ajustes />} />
          <Route path="administracion" element={puedeAdministracion(p) ? <Administracion /> : <Navigate to="/gestion" replace />} />
          <Route path="paginas" element={<Paginas />} />
          <Route path="sedes" element={<SedesAdmin />} />
          <Route path="junta" element={<Junta />} />
          <Route path="documentos" element={<Documentos />} />
          <Route path="usuarios" element={<Usuarios />} />
          <Route path="mensajes" element={<Mensajes />} />
          <Route path="cuenta" element={<Cuenta />} />
        </Routes>
      </section>
    </div>
  )
}
