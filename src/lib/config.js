// Secciones de la web. Para cambiar nombres o textos breves, editar aquí.
export const SECCIONES = {
  ciudadana: {
    corto: 'Ciudadana',
    nombre: 'Acción ciudadana',
    lema: 'Participación cívica, sin ser partido político',
    ruta: '/accion-ciudadana',
  },
  cultural: {
    corto: 'Cultural',
    nombre: 'Acción cultural',
    lema: 'Historia, pensamiento y tradición',
    ruta: '/accion-cultural',
  },
  social: {
    corto: 'Social',
    nombre: 'Acción social',
    lema: 'Servicio a los más vulnerables',
    ruta: '/accion-social',
  },
  revista: {
    corto: 'Revista',
    nombre: 'Revista',
    lema: 'Artículos y opinión',
    ruta: '/revista',
  },
  noticias: {
    corto: 'Comunicados',
    nombre: 'Comunicados',
    lema: 'Comunicados oficiales de la asociación',
    ruta: '/comunicados',
  },
  recomendaciones: {
    corto: 'Recomendaciones',
    nombre: 'Recomendaciones',
    lema: 'Lecturas que recomendamos: artículos, prensa, revistas y libros',
    ruta: '/revista/recomendaciones',
  },
  medios: {
    corto: 'Medios',
    nombre: 'Medios',
    lema: 'PATRIAM en prensa, radio, televisión y redes',
    ruta: '/medios',
  },
}

// Responsable de aprobar todo el contenido antes de publicarse
// En producción el aviso se envía al correo del perfil con rol 'director' (Carlos Rubio); aquí no se escribe el correo real
export const APROBADOR = { nombre: 'Carlos', email: 'car…@yahoo.es' }

// Tipos de recomendación (sección Recomendaciones de la revista)
export const TIPOS_RECOMENDACION = {
  articulo: 'Artículo web',
  prensa: 'Prensa',
  revista: 'Revista',
  libro: 'Libro',
  video: 'Vídeo o pódcast',
}

export const ROLES = {
  pendiente: 'Pendiente de aprobación',
  cliente: 'Cliente / asociado (sin acceso al panel)',
  autor: 'Autor / colaborador',
  editor: 'Editor de área',
  director: 'Gestión · aprueba y publica',
  admin: 'Gestión',
}

export const ESTADOS = {
  borrador: 'Borrador',
  revision: 'Enviado a revisión',
  publicado: 'Publicado',
  rechazado: 'Devuelto',
}

export const REDES = {
  x: 'X (Twitter)',
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  telegram: 'Telegram',
  whatsapp: 'WhatsApp',
  linkedin: 'LinkedIn',
}

export const ESTADOS_POST = { idea: 'Idea', programado: 'Programado', publicado: 'Publicado' }

// Categorías de documentos de transparencia
export const CATEGORIAS_DOC = {
  constitucion: 'Constitución y estatutos',
  organizacion: 'Organización y cargos',
  economica: 'Información económica (cuentas, presupuestos)',
  subvenciones: 'Subvenciones, contratos y convenios',
  memorias: 'Memorias de actividades',
  otros: 'Otros documentos',
}

// Transparencia sobre el uso de IA (art. 50 Reglamento UE 2024/1689)
export const USO_IA = {
  ninguno: 'Sin inteligencia artificial',
  asistido: 'Redactado con apoyo de IA y revisado por la redacción',
  generado: 'Contenido generado mediante inteligencia artificial',
}

// Tienda
export const CATEGORIAS_TIENDA = {
  libros: 'Libros',
  ropa: 'Ropa',
  actividades: 'Cursos y actividades',
}

export const ESTADOS_PEDIDO = {
  pendiente: 'Pendiente de pago',
  pagado: 'Pagado',
  enviado: 'Enviado',
  entregado: 'Entregado / realizado',
  cancelado: 'Cancelado',
}

