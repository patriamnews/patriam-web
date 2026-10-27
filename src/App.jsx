import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Inicio from './pages/Inicio'
import Seccion from './pages/Seccion'
import Articulo from './pages/Articulo'
import Pagina from './pages/Pagina'
import Colabora from './pages/Colabora'
import Nosotros from './pages/Nosotros'
import Adhesion from './pages/Adhesion'
import { Tienda, Producto, Carrito } from './pages/Tienda'
import { AgendaSeccion, FichaAccion } from './pages/Acciones'
import { ListaCampanas, Campana } from './pages/Campanas'
import { Navigate } from 'react-router-dom'
import NoEncontrado from './pages/NoEncontrado'
import Gestion from './admin/Gestion'
import Acceso from './pages/Acceso'
import MiCuenta from './pages/MiCuenta'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Inicio />} />
        <Route path="/sobre-patriam" element={<Pagina clave="sobre-patriam" />} />
        <Route path="/nosotros" element={<Nosotros />} />
        <Route path="/accion-ciudadana" element={<AgendaSeccion seccion="ciudadana" />} />
        <Route path="/accion-cultural" element={<AgendaSeccion seccion="cultural" />} />
        <Route path="/accion-social" element={<AgendaSeccion seccion="social" />} />
        <Route path="/accion/:slug" element={<FichaAccion />} />
        <Route path="/revista" element={<Seccion seccion="revista" />} />
        <Route path="/revista/recomendaciones" element={<Seccion seccion="recomendaciones" />} />
        <Route path="/comunicados" element={<Seccion seccion="noticias" />} />
        <Route path="/noticias" element={<Navigate to="/comunicados" replace />} />
        <Route path="/medios" element={<Seccion seccion="medios" />} />
        <Route path="/en-los-medios" element={<Navigate to="/medios" replace />} />
        <Route path="/articulo/:slug" element={<Articulo />} />
        <Route path="/contacto" element={<Colabora />} />
        <Route path="/colabora" element={<Navigate to="/contacto" replace />} />
        <Route path="/adhierete" element={<Adhesion />} />
        <Route path="/unete" element={<Adhesion />} />
        <Route path="/campanas" element={<ListaCampanas />} />
        <Route path="/campanas/:slug" element={<Campana />} />
        <Route path="/tienda" element={<Tienda />} />
        <Route path="/tienda/carrito" element={<Carrito />} />
        <Route path="/tienda/:slug" element={<Producto />} />
        <Route path="/condiciones-de-venta" element={<Pagina clave="condiciones-de-venta" />} />
        <Route path="/aviso-legal" element={<Pagina clave="aviso-legal" />} />
        <Route path="/privacidad" element={<Pagina clave="privacidad" />} />
        <Route path="/cookies" element={<Pagina clave="cookies" />} />
        <Route path="/transparencia-ia" element={<Pagina clave="transparencia-ia" />} />
        <Route path="/acceso" element={<Acceso />} />
        <Route path="/mi-cuenta/*" element={<MiCuenta />} />
        <Route path="*" element={<NoEncontrado />} />
      </Route>
      <Route path="/gestion/*" element={<Gestion />} />
    </Routes>
  )
}
