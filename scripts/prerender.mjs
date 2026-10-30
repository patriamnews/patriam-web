// Después de compilar: una página HTML por cada dirección importante (tienda, productos, artículos, campañas…)
// con su título, descripción, vista previa y datos estructurados ya puestos, y un resumen del contenido.
// Así Google, Bing, WhatsApp o X leen cada página aunque no ejecuten la web. También crea sitemap.xml y robots.txt.
// Se ejecuta en GitHub (publicación en Hostinger) con las variables VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { SEO_TIENDA } from '../src/lib/seoTienda.js'

const SITIO = 'https://movimientopatriam.es'
const BOLETIN = 'https://boletin.movimientopatriam.es'
const URL_SB = process.env.VITE_SUPABASE_URL
const KEY = process.env.VITE_SUPABASE_ANON_KEY
const DIST = new URL('../dist/', import.meta.url).pathname
const plantilla = readFileSync(DIST + 'index.html', 'utf8')
// La página «vacía» de la web, para cualquier dirección que no tenga su propia página (la usa el .htaccess)
writeFileSync(DIST + 'app.html', plantilla)

const esc = (t) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const limpio = (t) => String(t || '').replace(/[#*_>`]/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\s+/g, ' ').trim()
const recorta = (t, n = 158) => { const s = limpio(t); return s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…' : s }
const abs = (u) => (!u ? '' : /^https?:/.test(u) ? u : SITIO + (u.startsWith('/') ? '' : '/') + u)
const euros = (n) => Number(n || 0).toFixed(2).replace('.', ',') + ' €'
const parrafos = (t, n = 6) => String(t || '').split(/\n\s*\n/).map(limpio).filter(Boolean).slice(0, n).map((p) => `<p>${esc(p)}</p>`).join('')

async function sb(tabla, filtro) {
  if (process.env.PRERENDER_PRUEBA) { try { return JSON.parse(readFileSync(process.env.PRERENDER_PRUEBA + '/' + tabla + '.json', 'utf8')) } catch { return [] } }
  if (!URL_SB || !KEY) return []
  try {
    const r = await fetch(`${URL_SB}/rest/v1/${tabla}?${filtro}`, { headers: { apikey: KEY, Authorization: 'Bearer ' + KEY } })
    return r.ok ? await r.json() : []
  } catch { return [] }
}
const migas = (items) => ({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: items.map(([n, r], i) => ({ '@type': 'ListItem', position: i + 1, name: n, item: SITIO + r })) })

const urls = [] // para el sitemap
function pagina(ruta, { titulo, desc, imagen, tipo = 'website', jsonld = [], cuerpo = '', prioridad = 0.6, cambia = 'weekly', fecha, imagenes = [] }) {
  const t = titulo ? `${titulo} · PATRIAM` : 'PATRIAM · Dios, Patria, Justicia'
  const d = recorta(desc)
  const url = ruta === '/' ? SITIO + '/' : SITIO + ruta
  const img = abs(imagen) || SITIO + '/og-patriam.jpg'
  let h = plantilla
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(t)}</title>`)
    .replace(/(<meta name="description" content=")[^"]*/, `$1${esc(d)}`)
    .replace(/(<meta property="og:type" content=")[^"]*/, `$1${tipo}`)
    .replace(/(<meta property="og:title" content=")[^"]*/, `$1${esc(t)}`)
    .replace(/(<meta property="og:description" content=")[^"]*/, `$1${esc(d)}`)
    .replace(/(<meta property="og:url" content=")[^"]*/, `$1${esc(url)}`)
    .replace(/(<meta property="og:image" content=")[^"]*/, `$1${esc(img)}`)
    .replace(/(<meta name="twitter:title" content=")[^"]*/, `$1${esc(t)}`)
    .replace(/(<meta name="twitter:description" content=")[^"]*/, `$1${esc(d)}`)
    .replace(/(<meta name="twitter:image" content=")[^"]*/, `$1${esc(img)}`)
  const extra = `<link rel="canonical" href="${esc(url)}" />\n    <meta name="robots" content="index, follow, max-image-preview:large" />\n` +
    (jsonld.length ? `    <script type="application/ld+json" id="ld-pagina">${JSON.stringify(jsonld.length === 1 ? jsonld[0] : jsonld).replace(/</g, '\\u003c')}</script>\n` : '')
  h = h.replace('</head>', '    ' + extra + '  </head>')
  // Contenido para quien no ejecuta la web (la web lo sustituye al cargar)
  h = h.replace('<div id="root"></div>', `<div id="root"><main class="prerender">${cuerpo}</main></div>`)
  const dir = ruta === '/' ? DIST : DIST + ruta.replace(/^\//, '') + '/'
  mkdirSync(dir, { recursive: true })
  writeFileSync(dir + 'index.html', h)
  urls.push({ url, prioridad, cambia, fecha, imagenes: [img, ...imagenes].filter((x, i, a) => x && a.indexOf(x) === i && !x.endsWith('og-patriam.jpg')) })
}

const menu = `<nav><a href="/">Inicio</a> · <a href="/sobre-patriam">Sobre PATRIAM</a> · <a href="/revista">Revista</a> · <a href="/comunicados">Comunicados</a> · <a href="/campanas">Campañas</a> · <a href="/tienda">Tienda</a> · <a href="${BOLETIN}/">Boletín</a> · <a href="/adhierete">Únete</a></nav>`

const [productos, articulos, campanas, acciones, paginas] = await Promise.all([
  sb('productos', 'select=*&activo=eq.true&order=orden'),
  sb('articulos', 'select=slug,titulo,resumen,contenido,imagen_url,seccion,firma,publicado_at,actualizado_at,enlace_externo&estado=eq.publicado&order=publicado_at.desc&limit=500'),
  sb('campanas', 'select=slug,titulo,resumen,texto,imagen_url,creado_at&activa=eq.true&aprobada=eq.true'),
  sb('acciones', 'select=slug,titulo,resumen,descripcion,imagen_url,lugar,fecha_inicio,fecha_fin&publicada=eq.true&aprobada=eq.true&order=fecha_inicio.desc&limit=300'),
  sb('paginas', 'select=clave,titulo,contenido'),
])
const pag = Object.fromEntries(paginas.map((p) => [p.clave, p]))
console.log(`Prerender: ${productos.length} productos, ${articulos.length} artículos, ${campanas.length} campañas, ${acciones.length} acciones`)

// ---------- Inicio ----------
pagina('/', {
  desc: 'PATRIAM es un movimiento de acción ciudadana, cultural y social en España: Dios, Patria, Justicia. Agenda de acciones, revista, campañas de firmas, boletín semanal y tienda.',
  prioridad: 1, cambia: 'daily',
  jsonld: [
    { '@context': 'https://schema.org', '@type': 'Organization', name: 'PATRIAM', alternateName: 'Asociación PATRIAM', url: SITIO + '/', logo: SITIO + '/og-patriam.jpg', slogan: 'Dios, Patria, Justicia',
      email: 'movimientopatriam@gmail.com', address: { '@type': 'PostalAddress', streetAddress: 'C/ Tórtola, 21', addressLocality: 'Valladolid', addressCountry: 'ES' }, sameAs: ['https://x.com/patriam_es', BOLETIN + '/'] },
    { '@context': 'https://schema.org', '@type': 'WebSite', name: 'PATRIAM', url: SITIO + '/', inLanguage: 'es-ES' },
  ],
  cuerpo: `<h1>PATRIAM · Dios, Patria, Justicia</h1>${menu}<p>Movimiento de acción ciudadana, cultural y social en España.</p>` +
    (articulos.length ? '<h2>Lo último</h2><ul>' + articulos.slice(0, 10).map((a) => `<li><a href="/articulo/${esc(a.slug)}">${esc(a.titulo)}</a></li>`).join('') + '</ul>' : '') +
    (productos.length ? '<h2>Tienda</h2><ul>' + productos.filter((p) => p.categoria !== 'libros').slice(0, 8).map((p) => `<li><a href="/tienda/${esc(p.slug)}">${esc(p.nombre)}</a> · ${euros(p.precio)}</li>`).join('') + '</ul>' : ''),
})

// ---------- Tienda ----------
const deTienda = productos.filter((p) => p.categoria !== 'libros')
const fichaLista = (lista) => '<ul>' + lista.map((p) => `<li><a href="/tienda/${esc(p.slug)}"><img src="${esc(abs(p.imagen_url))}" alt="${esc(p.nombre)}" width="300" height="300" loading="lazy" /> ${esc(p.nombre)}</a> · ${euros(p.precio)}</li>`).join('') + '</ul>'
const itemList = (lista) => ({ '@context': 'https://schema.org', '@type': 'ItemList', itemListElement: lista.map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: `${SITIO}/tienda/${p.slug}`, name: p.nombre })) })
pagina('/tienda', {
  titulo: 'Tienda: camisetas patrióticas, sudaderas y regalos',
  desc: 'Tienda de PATRIAM: camisetas patrióticas españolas, camisetas oversize, sudaderas con capucha, tazas y botellas. Fabricado bajo pedido y enviado a toda España. Con cada compra apoyas a PATRIAM.',
  prioridad: 0.95, cambia: 'daily', imagen: deTienda[0]?.imagen_url,
  jsonld: [migas([['Inicio', '/'], ['Tienda', '/tienda']]), itemList(deTienda)],
  cuerpo: `<h1>Tienda PATRIAM: camisetas patrióticas, sudaderas y regalos</h1>${menu}` +
    Object.entries(SEO_TIENDA).map(([k, s]) => { const l = deTienda.filter((p) => p.seccion === k); return l.length ? `<h2><a href="/tienda/categoria/${k}">${esc(s.h1)}</a></h2>${fichaLista(l)}` : '' }).join('') +
    fichaLista(deTienda.filter((p) => !SEO_TIENDA[p.seccion])),
})
for (const [k, s] of Object.entries(SEO_TIENDA)) {
  const l = deTienda.filter((p) => p.seccion === k)
  if (!l.length) continue
  pagina('/tienda/categoria/' + k, {
    titulo: s.h1, desc: s.desc, prioridad: 0.85, cambia: 'weekly', imagen: l[0].imagen_url, imagenes: l.map((p) => abs(p.imagen_url)),
    jsonld: [migas([['Inicio', '/'], ['Tienda', '/tienda'], [s.h1, '/tienda/categoria/' + k]]), itemList(l)],
    cuerpo: `<h1>${esc(s.h1)}</h1>${menu}<p>${esc(s.desc)}</p>${fichaLista(l)}`,
  })
}
for (const p of productos) {
  const s = SEO_TIENDA[p.seccion]
  const fotos = [abs(p.imagen_url), ...(Array.isArray(p.galeria) ? p.galeria : []).map(abs), ...Object.values(p.fotos || {}).flatMap((v) => (Array.isArray(v) ? v : [v])).map(abs)].filter((x, i, a) => x && a.indexOf(x) === i)
  const titulo = `${p.nombre}${s && !/camiseta|sudadera|taza|botella/i.test(p.nombre) ? ' · ' + s.tipo : ''} · Tienda`
  const oferta = { '@type': 'Offer', url: `${SITIO}/tienda/${p.slug}`, priceCurrency: 'EUR', price: Number(p.precio || 0).toFixed(2),
    availability: p.stock === 0 ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock', itemCondition: 'https://schema.org/NewCondition', seller: { '@type': 'Organization', name: 'PATRIAM' } }
  if (p.gelato_uids && p.envio_primera != null) oferta.shippingDetails = { '@type': 'OfferShippingDetails', shippingRate: { '@type': 'MonetaryAmount', value: Number(p.envio_primera).toFixed(2), currency: 'EUR' }, shippingDestination: { '@type': 'DefinedRegion', addressCountry: 'ES' } }
  pagina('/tienda/' + p.slug, {
    titulo, desc: `${s ? s.tipo + ' «' + p.nombre + '». ' : ''}${p.descripcion || ''}`, tipo: 'product', imagen: p.imagen_url, imagenes: fotos, prioridad: 0.8, cambia: 'weekly', fecha: p.creado_at,
    jsonld: [
      { '@context': 'https://schema.org', '@type': 'Product', name: p.nombre, description: recorta(p.descripcion, 500), sku: p.slug, image: fotos.slice(0, 8),
        brand: { '@type': 'Brand', name: 'PATRIAM' }, category: p.categoria === 'regalos' ? 'Regalos' : p.categoria === 'libros' ? 'Libros' : 'Ropa', offers: oferta },
      migas([['Inicio', '/'], ['Tienda', '/tienda'], ...(s ? [[s.h1, '/tienda/categoria/' + p.seccion]] : []), [p.nombre, '/tienda/' + p.slug]]),
    ],
    cuerpo: `<h1>${esc(p.nombre)}</h1>${menu}<p><b>${euros(p.precio)}</b></p><img src="${esc(abs(p.imagen_url))}" alt="${esc(p.nombre)}" width="600" height="600" />${parrafos(p.descripcion)}<p><a href="/tienda${s ? '/categoria/' + p.seccion : ''}">← ${esc(s ? s.h1 : 'Tienda')}</a></p>`,
  })
}

// ---------- Artículos y secciones ----------
const SECC = { revista: ['/revista', 'Revista', 'Artículos de opinión, análisis y formación de PATRIAM.'], noticias: ['/comunicados', 'Comunicados', 'Comunicados oficiales de la asociación PATRIAM.'],
  medios: ['/medios', 'PATRIAM en los medios', 'Entrevistas, noticias y tertulias en las que sale PATRIAM.'], recomendaciones: ['/revista/recomendaciones', 'Recomendaciones', 'Lecturas, artículos, libros y vídeos que recomienda PATRIAM.'] }
for (const [k, [ruta, titulo, desc]] of Object.entries(SECC)) {
  const l = articulos.filter((a) => a.seccion === k)
  pagina(ruta, { titulo, desc: pag[k]?.contenido || desc, prioridad: 0.7, cambia: 'daily',
    cuerpo: `<h1>${esc(titulo)}</h1>${menu}<ul>` + l.slice(0, 50).map((a) => `<li><a href="/articulo/${esc(a.slug)}">${esc(a.titulo)}</a>${a.resumen ? ' — ' + esc(recorta(a.resumen, 160)) : ''}</li>`).join('') + '</ul>' })
}
for (const a of articulos) {
  if (a.seccion === 'recomendaciones' && a.enlace_externo) continue
  pagina('/articulo/' + a.slug, {
    titulo: a.titulo, desc: a.resumen || a.contenido, tipo: 'article', imagen: a.imagen_url, prioridad: 0.6, cambia: 'monthly', fecha: a.actualizado_at || a.publicado_at,
    jsonld: [{ '@context': 'https://schema.org', '@type': 'Article', headline: a.titulo, description: recorta(a.resumen, 300), image: a.imagen_url ? [abs(a.imagen_url)] : undefined,
      datePublished: a.publicado_at, dateModified: a.actualizado_at || a.publicado_at, author: { '@type': a.firma ? 'Person' : 'Organization', name: a.firma || 'PATRIAM' },
      publisher: { '@type': 'Organization', name: 'PATRIAM', logo: { '@type': 'ImageObject', url: SITIO + '/og-patriam.jpg' } }, mainEntityOfPage: SITIO + '/articulo/' + a.slug, inLanguage: 'es-ES' }],
    cuerpo: `<article><h1>${esc(a.titulo)}</h1>${menu}${a.firma ? `<p>${esc(a.firma)}</p>` : ''}${parrafos(a.contenido, 40)}</article>`,
  })
}

// ---------- Campañas y agenda ----------
pagina('/campanas', { titulo: 'Campañas de firmas', desc: 'Campañas de recogida de firmas de PATRIAM: firma y comparte las peticiones que defendemos.', prioridad: 0.7, cambia: 'weekly',
  cuerpo: `<h1>Campañas de firmas</h1>${menu}<ul>` + campanas.map((c) => `<li><a href="/campanas/${esc(c.slug)}">${esc(c.titulo)}</a></li>`).join('') + '</ul>' })
for (const c of campanas) pagina('/campanas/' + c.slug, { titulo: c.titulo, desc: c.resumen || c.texto, imagen: c.imagen_url, prioridad: 0.6, cambia: 'weekly',
  cuerpo: `<h1>${esc(c.titulo)}</h1>${menu}${parrafos(c.texto || c.resumen, 20)}` })
const AG = { ciudadana: 'Acción ciudadana', cultural: 'Acción cultural', social: 'Acción social' }
for (const [k, t] of Object.entries(AG)) pagina('/accion-' + k, { titulo: t, desc: pag[k]?.contenido || `${t} de PATRIAM: agenda de convocatorias y actividades.`, prioridad: 0.6, cambia: 'weekly', cuerpo: `<h1>${esc(t)}</h1>${menu}${parrafos(pag[k]?.contenido, 4)}` })
for (const a of acciones) pagina('/accion/' + a.slug, { titulo: a.titulo, desc: a.resumen || a.descripcion, imagen: a.imagen_url, prioridad: 0.5, cambia: 'monthly',
  jsonld: [{ '@context': 'https://schema.org', '@type': 'Event', name: a.titulo, description: recorta(a.resumen || a.descripcion, 300), startDate: a.fecha_inicio, endDate: a.fecha_fin || undefined,
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode', eventStatus: 'https://schema.org/EventScheduled', location: a.lugar ? { '@type': 'Place', name: a.lugar, address: a.lugar } : undefined,
    image: a.imagen_url ? [abs(a.imagen_url)] : undefined, organizer: { '@type': 'Organization', name: 'PATRIAM', url: SITIO + '/' } }],
  cuerpo: `<h1>${esc(a.titulo)}</h1>${menu}${a.lugar ? `<p>${esc(a.lugar)}</p>` : ''}${parrafos(a.descripcion || a.resumen, 20)}` })

// ---------- Páginas fijas ----------
const FIJAS = [['/sobre-patriam', 'sobre-patriam', 'Sobre PATRIAM', 0.8], ['/nosotros', 'nosotros', 'Nosotros', 0.6], ['/adhierete', 'adhierete', 'Únete a PATRIAM', 0.8], ['/contacto', 'contacto', 'Contacto', 0.5],
  ['/condiciones-de-venta', 'condiciones-de-venta', 'Condiciones de venta', 0.3], ['/aviso-legal', 'aviso-legal', 'Aviso legal', 0.2], ['/privacidad', 'privacidad', 'Privacidad', 0.2], ['/cookies', 'cookies', 'Cookies', 0.2], ['/transparencia-ia', 'transparencia-ia', 'Transparencia IA', 0.2]]
for (const [ruta, clave, titulo, prio] of FIJAS) {
  const p = pag[clave]
  pagina(ruta, { titulo: p?.titulo || titulo, desc: p?.contenido || titulo, prioridad: prio, cambia: 'monthly', cuerpo: `<h1>${esc(p?.titulo || titulo)}</h1>${menu}${parrafos(p?.contenido, 12)}` })
}

// ---------- sitemap.xml y robots.txt ----------
const hoy = new Date().toISOString().slice(0, 10)
writeFileSync(DIST + 'sitemap.xml', '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n' +
  urls.map((u) => `  <url><loc>${esc(u.url)}</loc><lastmod>${(u.fecha || hoy).slice(0, 10)}</lastmod><changefreq>${u.cambia}</changefreq><priority>${u.prioridad.toFixed(2)}</priority>` +
    u.imagenes.slice(0, 10).map((i) => `<image:image><image:loc>${esc(i)}</image:loc></image:image>`).join('') + '</url>').join('\n') + '\n</urlset>\n')
writeFileSync(DIST + 'robots.txt', `User-agent: *
Allow: /
Disallow: /gestion
Disallow: /publicar
Disallow: /acceso
Disallow: /mi-cuenta
Disallow: /tienda/carrito
Disallow: /pago-correcto
Disallow: /pago-cancelado
Disallow: /api/

Sitemap: ${SITIO}/sitemap.xml
Sitemap: ${BOLETIN}/sitemap.xml
`)
console.log(`Prerender: ${urls.length} páginas y sitemap.xml`)
