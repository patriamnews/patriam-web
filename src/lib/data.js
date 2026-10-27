import { supabase } from './supabase'

// Lecturas públicas (funcionan igual con la base simulada y con Supabase)

export async function getPagina(clave) {
  const { data } = await supabase.from('paginas').select('*').eq('clave', clave).maybeSingle()
  return data
}

export async function listarPublicados({ seccion, limite = 20 } = {}) {
  let q = supabase
    .from('articulos')
    .select('id, titulo, slug, resumen, seccion, firma, medio, enlace_externo, tipo_recomendacion, imagen_url, imagen_ia, uso_ia, publicado_at, fecha')
    .eq('estado', 'publicado')
    .order('publicado_at', { ascending: false })
    .limit(limite)
  if (seccion) q = q.eq('seccion', seccion)
  const { data } = await q
  return data || []
}

export async function getArticulo(slug) {
  const { data } = await supabase.from('articulos').select('*').eq('slug', slug).eq('estado', 'publicado').maybeSingle()
  return data
}

export async function listarCargos() {
  const { data } = await supabase.from('cargos').select('*').eq('visible', true).order('orden')
  return data || []
}

export async function listarSedes() {
  const { data } = await supabase.from('sedes').select('*').eq('activa', true).eq('aprobada', true).order('orden').order('ciudad')
  return data || []
}

export async function listarDocumentos() {
  const { data } = await supabase.from('documentos').select('*').eq('publico', true).order('fecha', { ascending: false })
  return data || []
}

export async function getAjustes() {
  const { data } = await supabase.from('ajustes').select('*').eq('id', 1).maybeSingle()
  return data || {}
}

export async function listarCampanas() {
  const { data } = await supabase.from('campanas').select('*').eq('activa', true).eq('aprobada', true).order('creado_at', { ascending: false })
  return data || []
}

export async function getCampana(slug) {
  const { data } = await supabase.from('campanas').select('*').eq('slug', slug).eq('activa', true).eq('aprobada', true).maybeSingle()
  return data
}

// Número de firmas sin exponer los datos de los firmantes
export async function totalFirmas(c) {
  if (c.modo === 'externo') return c.firmas_externas || 0
  const { data } = await supabase.rpc('contar_firmas', { campana: c.id })
  return data || 0
}

// Envíos de formularios públicos
export const enviarContacto = (datos) => supabase.from('contactos').insert(datos)
export const enviarFirma = (datos) => supabase.from('firmas').insert(datos)
export const enviarSocio = (datos) => supabase.from('socios').insert(datos)
export const registrarDonativo = (datos) => supabase.from('donativos').insert(datos)

export const referencia = (prefijo) => `${prefijo}-${Date.now().toString(36).slice(-5).toUpperCase()}`

export const slugify = (t) =>
  t
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 80)

export const fecha = (d) =>
  d ? new Date(d).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }) : ''

export const euros = (n) => `${Number(n).toLocaleString('es-ES')} €`

// Convocatorias (concentraciones, manifestaciones, actos…) cuya fecha, escrita en el título o en el resumen
// («… el 8 de octubre», «jueves 8 de octubre de 2026»), ya ha pasado: no deben salir como novedad.
const MESES_ES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
export function fechaEnTexto(a) {
  const texto = `${a.titulo || ''} ${a.resumen || ''}`.toLowerCase()
  const m = texto.match(/(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)(?:\s+de\s+(\d{4}))?/)
  if (!m) return a.fecha ? new Date(a.fecha) : null
  const mes = m[2] === 'setiembre' ? 8 : MESES_ES.indexOf(m[2])
  const base = new Date(a.publicado_at || Date.now())
  let ano = m[3] ? Number(m[3]) : base.getFullYear()
  // Sin año: si el mes queda muy por detrás de la publicación, es del año siguiente
  if (!m[3] && mes < base.getMonth() - 6) ano += 1
  return new Date(ano, mes, Number(m[1]), 23, 59)
}
export const esConvocatoria = (a) => /convoca|concentraci|manifestaci|movilizaci|\bacto\b|homenaje|misa|jornada/i.test(a.titulo || '')
export function convocatoriaPasada(a, ahora = new Date()) {
  if (!esConvocatoria(a)) return false
  const f = fechaEnTexto(a)
  return !!f && f < ahora
}
