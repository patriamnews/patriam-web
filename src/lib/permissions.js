// Reglas de permisos en el navegador (las reglas reales se aplican en la base de datos, ver supabase/schema.sql)

// Miembro del equipo con acceso al panel (los clientes y asociados usan Mi cuenta)
export const activo = (p) => p && p.activo && !['pendiente', 'cliente'].includes(p.rol)
// Todo el equipo tiene la misma gestión
export const equipo = (p) => activo(p) && ['autor', 'editor', 'director', 'admin'].includes(p.rol)

// Solo una persona aprueba y publica: el rol "director" (Carlos Rubio)
export const puedeAprobar = (p) => equipo(p) && p.rol === 'director'
// eslint-disable-next-line no-unused-vars
export const puedePublicar = (p, _seccion) => puedeAprobar(p)
export const puedeRevisar = (p) => puedeAprobar(p)
// Los textos de las páginas también son publicaciones
export const puedePublicarPaginas = (p) => puedeAprobar(p)

// Gestión: igual para todo el equipo
export const puedeGestionarArea = (p) => equipo(p)
export const puedeVerCorreos = (p) => equipo(p)
export const puedeGestionarUsuarios = (p) => equipo(p)
export const puedeEditarPaginas = (p) => equipo(p)
export const puedeCampanas = (p) => equipo(p)
export const puedeVerMensajes = (p) => equipo(p)
export const puedeRedes = (p) => equipo(p)
export const puedeTienda = (p) => equipo(p)
export const puedeAdministracion = (p) => equipo(p)

// Secciones en las que se puede escribir
export const seccionesDisponibles = (p) =>
  equipo(p) ? ['ciudadana', 'cultural', 'social', 'revista', 'recomendaciones', 'noticias', 'medios'] : []
