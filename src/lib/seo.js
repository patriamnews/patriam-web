// Posicionamiento (SEO): título, descripción, dirección canónica, vista previa al compartir
// y datos estructurados (JSON-LD) de cada página. Google lee lo que deja la página ya pintada.
import { useEffect } from 'react'

export const SITIO = 'https://movimientopatriam.es'
export const NOMBRE = 'PATRIAM'
const TITULO_BASE = 'PATRIAM · Dios, Patria, Justicia'
const DESC_BASE = 'PATRIAM: movimiento de acción ciudadana, cultural y social en España. Agenda, revista, campañas, boletín de noticias y tienda.'
const IMG_BASE = SITIO + '/og-patriam.jpg'

export const recorta = (t, n = 158) => {
  const s = String(t || '').replace(/[#*_>[\]()`]/g, '').replace(/\s+/g, ' ').trim()
  return s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…' : s
}
const absoluta = (u) => (!u ? '' : /^https?:\/\//.test(u) ? u : SITIO + (u.startsWith('/') ? u : '/' + u))

function meta(attr, clave, valor) {
  let el = document.head.querySelector(`meta[${attr}="${clave}"]`)
  if (!valor) { if (el) el.remove(); return }
  if (!el) { el = document.createElement('meta'); el.setAttribute(attr, clave); document.head.appendChild(el) }
  el.setAttribute('content', valor)
}
function enlace(rel, href) {
  let el = document.head.querySelector(`link[rel="${rel}"]`)
  if (!href) { if (el) el.remove(); return }
  if (!el) { el = document.createElement('link'); el.setAttribute('rel', rel); document.head.appendChild(el) }
  el.setAttribute('href', href)
}
function datos(json) {
  let el = document.getElementById('ld-pagina')
  if (!json) { if (el) el.remove(); return }
  if (!el) { el = document.createElement('script'); el.type = 'application/ld+json'; el.id = 'ld-pagina'; document.head.appendChild(el) }
  el.textContent = JSON.stringify(json)
}

/** useSeo({ titulo, descripcion, imagen, tipo, ruta, jsonld, noindex }) — se llama arriba de cada página */
export function useSeo({ titulo, descripcion, imagen, tipo = 'website', ruta, jsonld, noindex = false } = {}) {
  const clave = JSON.stringify([titulo, descripcion, imagen, tipo, ruta, jsonld, noindex])
  useEffect(() => {
    const t = titulo ? `${titulo} · ${NOMBRE}` : TITULO_BASE
    const d = recorta(descripcion || DESC_BASE)
    const url = SITIO + (ruta ?? location.pathname).replace(/\/+$/, '') || SITIO + '/'
    const img = absoluta(imagen) || IMG_BASE
    document.title = t
    meta('name', 'description', d)
    meta('name', 'robots', noindex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large')
    enlace('canonical', noindex ? '' : url === SITIO ? SITIO + '/' : url)
    meta('property', 'og:title', t)
    meta('property', 'og:description', d)
    meta('property', 'og:url', url)
    meta('property', 'og:type', tipo)
    meta('property', 'og:image', img)
    meta('name', 'twitter:title', t)
    meta('name', 'twitter:description', d)
    meta('name', 'twitter:image', img)
    datos(jsonld || null)
  }, [clave]) // eslint-disable-line react-hooks/exhaustive-deps
}

// Datos estructurados reutilizables
export const migas = (items) => ({
  '@context': 'https://schema.org', '@type': 'BreadcrumbList',
  itemListElement: items.map(([nombre, ruta], i) => ({ '@type': 'ListItem', position: i + 1, name: nombre, item: SITIO + ruta })),
})
export function productoLd(p, { envio } = {}) {
  const fotos = []
  if (p.imagen_url) fotos.push(absoluta(p.imagen_url))
  ;(Array.isArray(p.galeria) ? p.galeria : []).forEach((g) => fotos.push(absoluta(g)))
  Object.values(p.fotos || {}).forEach((v) => (Array.isArray(v) ? v : [v]).forEach((g) => g && fotos.push(absoluta(g))))
  const url = `${SITIO}/tienda/${p.slug}`
  const oferta = {
    '@type': 'Offer', url, priceCurrency: 'EUR', price: Number(p.precio || 0).toFixed(2),
    availability: p.stock === 0 ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock',
    itemCondition: 'https://schema.org/NewCondition',
    seller: { '@type': 'Organization', name: NOMBRE },
  }
  if (envio != null) oferta.shippingDetails = {
    '@type': 'OfferShippingDetails',
    shippingRate: { '@type': 'MonetaryAmount', value: Number(envio).toFixed(2), currency: 'EUR' },
    shippingDestination: { '@type': 'DefinedRegion', addressCountry: 'ES' },
  }
  return {
    '@context': 'https://schema.org', '@type': 'Product',
    name: p.nombre, description: recorta(p.descripcion, 500), sku: p.slug,
    image: [...new Set(fotos)].slice(0, 8), brand: { '@type': 'Brand', name: NOMBRE },
    category: p.categoria === 'regalos' ? 'Regalos' : p.categoria === 'libros' ? 'Libros' : 'Ropa',
    offers: oferta,
  }
}
