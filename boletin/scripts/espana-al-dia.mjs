// «España al día»: recopila cada día los titulares de política y economía española de
// The Objective, El Debate, La Gaceta, El Español, ABC, El Mundo y Adelante España; agrupa los que cuentan lo mismo (un botón por medio)
// y guarda la última semana en web/espana-al-dia.js, que leen el boletín y su columna lateral.
// Lo ejecuta GitHub cada 3 horas (.github/workflows/espana-al-dia.yml). Sin dependencias.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'

const DIAS = 7
const MEDIOS = [
  { medio: 'The Objective', dominio: 'theobjective.com', fuentes: [
    ['https://theobjective.com/espana/feed/', 'Política'], ['https://theobjective.com/espana/politica/feed/', 'Política'],
    ['https://theobjective.com/economia/feed/', 'Economía'], ['https://theobjective.com/feed/', ''] ] },
  { medio: 'El Debate', dominio: 'eldebate.com', fuentes: [
    ['https://www.eldebate.com/rss/espana.xml', 'Política'], ['https://www.eldebate.com/rss/economia.xml', 'Economía'],
    ['https://www.eldebate.com/rss/portada.xml', ''], ['https://www.eldebate.com/rss/', ''],
    ['https://www.eldebate.com/sitemap_google_news.xml', ''], ['https://www.eldebate.com/sitemap-news.xml', ''], ['https://www.eldebate.com/news-sitemap.xml', ''] ] },
  { medio: 'La Gaceta', dominio: 'gaceta.es', fuentes: [
    ['https://gaceta.es/espana/feed/', 'Política'], ['https://gaceta.es/economia/feed/', 'Economía'], ['https://gaceta.es/feed/', ''] ] },
  { medio: 'El Español', dominio: 'elespanol.com', fuentes: [
    ['https://www.elespanol.com/rss/espana/', 'Política'], ['https://www.elespanol.com/rss/espana/politica/', 'Política'],
    ['https://www.elespanol.com/rss/invertia/', 'Economía'], ['https://www.elespanol.com/rss/economia/', 'Economía'], ['https://www.elespanol.com/rss/', ''] ] },
  { medio: 'ABC', dominio: 'abc.es', fuentes: [
    ['https://www.abc.es/rss/2.0/espana/', 'Política'], ['https://www.abc.es/rss/feeds/abc_EspanaEspana.xml', 'Política'],
    ['https://www.abc.es/rss/2.0/economia/', 'Economía'], ['https://www.abc.es/rss/feeds/abc_Economia.xml', 'Economía'],
    ['https://www.abc.es/rss/2.0/portada/', ''], ['https://www.abc.es/sitemap-news.xml', ''] ] },
  { medio: 'El Mundo', dominio: 'elmundo.es', fuentes: [
    ['https://e00-elmundo.uecdn.es/elmundo/rss/espana.xml', 'Política'], ['https://e00-elmundo.uecdn.es/elmundo/rss/economia.xml', 'Economía'],
    ['https://e00-elmundo.uecdn.es/elmundo/rss/portada.xml', ''], ['https://www.elmundo.es/sitemaps/sitemap-news.xml', ''] ] },
  { medio: 'Adelante España', dominio: 'adelanteespana.com', todo: true, fuentes: [
    ['https://adelanteespana.com/category/espana/feed/', 'Política'], ['https://adelanteespana.com/category/politica/feed/', 'Política'],
    ['https://adelanteespana.com/category/economia/feed/', 'Economía'], ['https://adelanteespana.com/feed/', ''], ['https://www.adelanteespana.com/feed/', ''] ] },
]
// Si la fuente es general, solo entra lo que por su dirección es de política o economía de España
const SI = /\/(espana|nacional|politica|economia|invertia|empresas|mercados|macroeconomia|vivienda|trabajo|fiscal|hacienda|tribunales|justicia|elecciones|gobierno|congreso)\b/i
const NO = /\/(internacional|mundo|america|europa|deportes|cultura|gente|television|tv|ocio|gastronomia|viajes|salud|ciencia|tecnologia|motor|loterias|horoscopo|tiempo|sociedad|religion|opinion|blogs|corazon|famosos|estilo|series|cine|libros|toros|virales)\b/i
// Secciones que nunca son política ni economía, venga del feed que venga (se mira la carpeta entera: /deportes/, no «/deportes-…»)
const NUNCA = /\/(deportes|sucesos|cultura|gente|television|tv|ocio|gastronomia|viajes|motor|loterias|horoscopo|tiempo|religion|religion-y-cofradias|cofradias|corazon|famosos|estilo|series|cine|libros|toros|virales|obituarios|necrologicas|esquelas|espectaculos|teatro|musica)(?=\/)/i
// Aunque venga de un feed de España, fuera lo que por el titular es espectáculo, famosos o deporte (esquelas de actores, series, galas…)
const NO_TITULO = /\b(actriz|actor|actores|cantante|cantautor[a]?|futbolista|torero|presentador[a]?|influencer|reality|telenovela|estudio 1|pel[ií]cula|concierto|festival|gala de|premios goya|eurovisi[oó]n|loter[ií]a|hor[oó]scopo|famos[oa]s?|euromillones|bonoloto|gran hermano|exposici[oó]n|fiesta del|career fair)\b/i
// Noticias quitadas a mano: una dirección por línea en datos/espana-fuera.txt (las líneas con # no cuentan)
const FUERA = new Set((() => { try { return readFileSync(new URL('../datos/espana-fuera.txt', import.meta.url).pathname, 'utf8') } catch { return '' } })()
  .split('\n').map((l) => l.trim().split('#')[0].split('?')[0]).filter(Boolean))
// Sucesos (crímenes, detenciones, juicios a particulares…): fuera, salvo que toquen a la política (ETA, Interior, un partido, el Gobierno…)
const SUCESO = /(asesin|apu[ñn]al|machete|coca[ií]na|narco|hach[ií]s|detenid|secuestr|violaci[oó]n|violad|agresi[oó]n sexual|abuso sexual|retener|retuvo|retenida|espos[oó]|atropell|homicid|cad[aá]ver|beb[eé]|congelador|su novio|su pareja|expareja|maltrat|apu[ñn]ala|tiroteo|\brobo\b|ladr[oó]n|estafa a|incendio en una vivienda)/i
const POLITICO = /(psoe|\bpp\b|\bvox\b|sumar|podemos|s[aá]nchez|feij[oó]o|abascal|gobierno|ministr|marlaska|interior|koldo|[aá]balos|cerd[aá]n|\beta\b|etarra|terroris|bildu|congreso|senado|fiscal general|guardia civil|polic[ií]a nacional|frontex|inmigra|huelga|piquete|sindic|ccoo|\bugt\b|alta velocidad|adif|renfe)/i
const sobra = (n) => { try { const t = (n.titulo || '') + ' ' + (n.resumen || ''); return FUERA.has(n.url.split('#')[0].split('?')[0]) || NUNCA.test(new URL(n.url).pathname) || NO_TITULO.test(n.titulo || '') || (SUCESO.test(t) && !POLITICO.test(t)) } catch { return true } }

const UA = 'Mozilla/5.0 (compatible; PatriamBoletin/1.0; +https://boletin.movimientopatriam.es)'
async function bajar(url, ms = 15000) {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/rss+xml, application/xml, text/xml, text/html;q=0.8, */*;q=0.5' }, signal: AbortSignal.timeout(ms), redirect: 'follow' })
    if (!r.ok) return null
    return await r.text()
  } catch { return null }
}
const ent = (s) => String(s || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&quot;/g, '"').replace(/&apos;|&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
const sinEtiquetas = (s) => ent(ent(s)).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
const etiqueta = (x, n) => { const m = x.match(new RegExp(`<${n}\\b[^>]*>([\\s\\S]*?)</${n}>`, 'i')); return m ? m[1] : '' }
const atributo = (x, n, a) => { const m = x.match(new RegExp(`<${n}\\b[^>]*\\b${a}=["']([^"']+)["']`, 'i')); return m ? ent(m[1]) : '' }
const resumir = (t, n = 240) => { const s = sinEtiquetas(t); return s.length > n ? s.slice(0, n).replace(/\s+\S*$/, '') + '…' : s }

function leerFeed(xml, medio, tema) {
  const out = []
  // RSS / Atom
  for (const it of xml.match(/<item\b[\s\S]*?<\/item>|<entry\b[\s\S]*?<\/entry>/gi) || []) {
    const titulo = sinEtiquetas(etiqueta(it, 'title'))
    let url = sinEtiquetas(etiqueta(it, 'link')) || atributo(it, 'link', 'href')
    const fecha = sinEtiquetas(etiqueta(it, 'pubDate') || etiqueta(it, 'published') || etiqueta(it, 'updated') || etiqueta(it, 'dc:date'))
    const desc = etiqueta(it, 'description') || etiqueta(it, 'summary') || etiqueta(it, 'content:encoded')
    const img = atributo(it, 'media:content', 'url') || atributo(it, 'media:thumbnail', 'url') || atributo(it, 'enclosure', 'url') || (ent(desc).match(/<img[^>]+src=["']([^"']+)/i) || [])[1] || ''
    const cats = (it.match(/<category\b[^>]*>([\s\S]*?)<\/category>/gi) || []).map(sinEtiquetas).join(' ')
    if (titulo && url) out.push({ medio, url: url.trim(), titulo, fecha, resumen: resumir(desc), imagen: /^https?:/.test(img) ? img : '', tema, cats })
  }
  // Sitemap de Google News
  for (const u of xml.match(/<url>[\s\S]*?<\/url>/gi) || []) {
    const titulo = sinEtiquetas(etiqueta(u, 'news:title')); const url = sinEtiquetas(etiqueta(u, 'loc'))
    if (!titulo || !url) continue
    out.push({ medio, url, titulo, fecha: sinEtiquetas(etiqueta(u, 'news:publication_date') || etiqueta(u, 'lastmod')), resumen: '', imagen: sinEtiquetas(etiqueta(u, 'image:loc')), tema, cats: sinEtiquetas(etiqueta(u, 'news:keywords')) })
  }
  return out
}

const temaDe = (n) => {
  if (n.tema) return n.tema
  const t = (n.url + ' ' + n.cats).toLowerCase()
  return /econom|invertia|empresa|mercado|vivienda|fiscal|hacienda|impuesto|empleo|paro|inflaci|banco|bolsa/.test(t) ? 'Economía' : 'Política'
}
const valeGeneral = (n) => SI.test(new URL(n.url).pathname) && !NO.test(new URL(n.url).pathname)

// ---------- agrupar lo que cuenta lo mismo ----------
const VACIAS = new Set('el la los las un una unos unas de del al a ante bajo con contra desde en entre hacia hasta para por segun sin sobre tras y e o u ni que se su sus lo le les es son ser fue han ha hay mas muy ya no si como cuando donde quien porque pero tambien este esta estos estas ese esa eso ese aqui asi tras sus nos os mi tu te me sera esta estan tiene tienen hace hacen dice dicen va van'.split(' '))
const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9ñ ]+/g, ' ')
const claves = (t) => new Set(norm(t).split(/\s+/).filter((w) => w.length > 3 && !VACIAS.has(w)).map((w) => w.slice(0, 7)))
// Las palabras que salen en muchos titulares de la semana («huelga», «general», «gobierno»…) no cuentan para juntar
let COMUNES = new Set()
function parecidas(a, b) {
  let c = 0; for (const w of a) if (b.has(w) && !COMUNES.has(w)) c++
  const fa = [...a].filter((w) => !COMUNES.has(w)).length, fb = [...b].filter((w) => !COMUNES.has(w)).length
  return c >= 3 && c / Math.max(1, Math.min(fa, fb)) >= 0.5
}

// ---------- imagen y resumen de la propia noticia, si el feed no los trae ----------
async function completar(n) {
  const html = await bajar(n.url, 12000)
  if (!html) return
  const meta = (p) => (html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${p}["'][^>]*content=["']([^"']+)`, 'i')) || html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']${p}["']`, 'i')) || [])[1]
  if (!n.imagen) { const i = meta('og:image') || meta('twitter:image'); if (i && /^https?:/.test(ent(i))) n.imagen = ent(i) }
  if (!n.resumen) { const d = meta('og:description') || meta('description'); if (d) n.resumen = resumir(d) }
}

// ---------- principal ----------
const RUTA_DATOS = new URL('../datos/espana-al-dia.json', import.meta.url).pathname
const RUTA_WEB = new URL('../web/espana-al-dia.js', import.meta.url).pathname
const antes = existsSync(RUTA_DATOS) ? JSON.parse(readFileSync(RUTA_DATOS, 'utf8')) : { noticias: [] }
const limite = Date.now() - DIAS * 86400e3
const nuevas = []
for (const m of MEDIOS) {
  let n0 = 0
  for (const [url, tema] of m.fuentes) {
    const xml = await bajar(url)
    if (!xml || !/<(rss|feed|urlset|rdf)/i.test(xml.slice(0, 3000))) { console.log(`  ✗ ${url}`); continue }
    const items = leerFeed(xml, m.medio, tema).filter((n) => { try { return new URL(n.url).hostname.endsWith(m.dominio) } catch { return false } })
      .filter((n) => tema || m.todo || valeGeneral(n))
    console.log(`  ✓ ${url}: ${items.length}`)
    nuevas.push(...items); n0 += items.length
  }
  console.log(`${m.medio}: ${n0}`)
}
// juntar con lo que ya había (para tener la semana entera aunque los feeds solo den lo último)
const porUrl = new Map()
for (const n of [...antes.noticias, ...nuevas]) {
  const t = Date.parse(n.fecha) || Date.now()
  if (t < limite || t > Date.now() + 36e5 || sobra(n)) continue
  const u = n.url.split('#')[0].split('?')[0]
  const ya = porUrl.get(u)
  porUrl.set(u, { ...(ya || {}), ...n, url: u, fecha: new Date(t).toISOString(), tema: temaDe(n), imagen: n.imagen || ya?.imagen || '', resumen: n.resumen || ya?.resumen || '' })
}
const todas = [...porUrl.values()].sort((a, b) => b.fecha.localeCompare(a.fecha))
// Imágenes: arreglar direcciones mal formadas y quitar las genéricas (logos del periódico)
const GENERICA = /\/(images|img|assets)\/[^/]*(logo|el-debate|default|placeholder|og-default|share)[^/]*\.(png|jpe?g|svg|webp)$|logo/i
for (const n of todas) {
  if (n.imagen) n.imagen = n.imagen.replace(/^(https?:\/\/[^/]+)\/(?:[a-z0-9.-]+\.[a-z]{2,})(\/wp-content\/)/i, '$1$2')
  if (n.imagen && GENERICA.test(n.imagen)) n.imagen = ''
}
// Fotos actuales: si la dirección de la foto lleva fecha (…/2026/09/13/…) y es de más de 4 días antes que la noticia,
// es una foto de archivo reutilizada. Se busca la de la propia noticia (og:image) y, si tampoco es actual, se quita.
const fechaFoto = (u) => { const m = String(u || '').match(/\/(20\d\d)[\/_-](0[1-9]|1[0-2])(?:[\/_-](0[1-9]|[12]\d|3[01]))?(?=[\/_-])/); return m ? Date.UTC(+m[1], +m[2] - 1, m[3] ? +m[3] : 28) : 0 }
const vieja = (u, fecha) => { const f = fechaFoto(u); return !!f && (Date.parse(fecha) || Date.now()) - f > 4 * 86400e3 }
let kv = 0
for (const n of todas) {
  if (!n.imagen || !vieja(n.imagen, n.fecha)) continue
  if (!n.miradaFoto && kv < 60) {
    kv++; n.miradaFoto = 1
    const html = await bajar(n.url, 12000)
    const og = html && ((html.match(/<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image)["'][^>]*content=["']([^"']+)/i) || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["'](?:og:image|twitter:image)["']/i) || [])[1])
    if (og && /^https?:/.test(ent(og)) && !vieja(ent(og), n.fecha) && !GENERICA.test(ent(og))) { n.imagen = ent(og); continue }
  }
  n.imagenVieja = n.imagen; n.imagen = ''
}
// completar imagen/resumen de las que no lo traen (como mucho 60 por pasada)
let k = 0
for (const n of todas) { if ((n.imagen && n.resumen) || n.mirada || k >= 60) continue; await completar(n); n.mirada = 1; k++ }
for (const n of todas) if (n.imagen && vieja(n.imagen, n.fecha)) { n.imagenVieja = n.imagen; n.imagen = '' }
// agrupar
const df = new Map()
for (const n of todas) for (const w of claves(n.titulo)) df.set(w, (df.get(w) || 0) + 1)
COMUNES = new Set([...df].filter(([, c]) => c > Math.max(6, todas.length * 0.02)).map(([w]) => w))
const grupos = []
for (const n of todas) {
  const cl = claves(n.titulo)
  const g = grupos.find((x) => Math.abs(Date.parse(x.fecha) - Date.parse(n.fecha)) < 2.5 * 86400e3 && parecidas(x.cl, cl))
  if (g) {
    if (!g.medios.some((x) => x.medio === n.medio)) g.medios.push({ medio: n.medio, url: n.url, titulo: n.titulo })
    if (!g.imagen && n.imagen) g.imagen = n.imagen
    if (n.imagen) g.imgs.push(n.imagen)
    if (!g.resumen && n.resumen) g.resumen = n.resumen
  } else grupos.push({ titulo: n.titulo, resumen: n.resumen, imagen: n.imagen, imgs: n.imagen ? [n.imagen] : [], fecha: n.fecha, tema: n.tema, medios: [{ medio: n.medio, url: n.url, titulo: n.titulo }], cl })
}
// asunto de cada noticia (huelga, elecciones…): el primero de web/espana-asuntos.json que encaje en titular o resumen
const ASUNTOS = (() => { try { return JSON.parse(readFileSync(new URL('../web/espana-asuntos.json', import.meta.url).pathname, 'utf8')).asuntos.map((a) => ({ nombre: a.nombre, re: new RegExp(a.patron, 'i') })) } catch { return [] } })()
const sinTildes = (s) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
for (const g of grupos) { const t = sinTildes(g.titulo + ' ' + (g.resumen || '')); g.asunto = (ASUNTOS.find((a) => a.re.test(t)) || {}).nombre || 'Otros' }
// La misma foto no se repite: si ya la lleva otra noticia (los periódicos reutilizan la de agencia),
// se usa la de otro medio del grupo; si no hay otra, va el pantallazo de la portada del medio
const ordenGrupos = grupos.slice().sort((a, b) => b.medios.length - a.medios.length || b.fecha.localeCompare(a.fecha))
const usadas = new Set()
for (const g of ordenGrupos) {
  const base = (u) => u.split('?')[0].replace(/-\d+x\d+(?=\.\w+$)/, '').replace(/\.r_d\.[\d-]+(?=\.\w+$)/, '')
  const libre = g.imgs.find((u) => !usadas.has(base(u)) && !vieja(u, g.fecha))
  g.imagen = libre || ''
  if (libre) usadas.add(base(libre))
}
// Noticias sin foto propia: va un pantallazo de la portada (home) del medio.
// Los pantallazos los hace scripts/espana-pantallazos.mjs en cada pasada y se guardan en la rama «portadas».
const PANTALLAZOS = 'https://raw.githubusercontent.com/patriamnews/boletin.patriam/portadas/'
const slugMedio = (m) => m.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const vez = new Date().toISOString().slice(0, 13).replace(/\D/g, '')
// Solo si hay pantallazo de ese medio (si el medio no deja hacerlo, la noticia va sin foto, con el recuadro de color)
const DIR_PANTALLAZOS = process.env.PORTADAS_DIR
const hayPantallazo = (m) => !!DIR_PANTALLAZOS && existsSync(`${DIR_PANTALLAZOS}/${slugMedio(m)}.jpg`)
let conPantallazo = 0
// el pantallazo de cualquiera de sus medios (no solo del primero)
for (const g of grupos) if (!g.imagen) { const m = g.medios.find((x) => hayPantallazo(x.medio)); if (m) { g.imagen = `${PANTALLAZOS}${slugMedio(m.medio)}.jpg?v=${vez}`; g.pantallazo = true; conPantallazo++ } }
// Fotos de reserva: si la principal no carga en el navegador, se prueban estas (otras fotos del grupo y los pantallazos de sus medios)
for (const g of grupos) {
  const alt = [...new Set([...(g.imgs || []), ...g.medios.filter((x) => hayPantallazo(x.medio)).map((x) => `${PANTALLAZOS}${slugMedio(x.medio)}.jpg?v=${vez}`)])].filter((u) => u && u !== g.imagen)
  if (alt.length) g.alt = alt.slice(0, 4)
}
// Fotos puestas a mano (web/espana-imagenes.json): mandan sobre todo lo anterior
const A_MANO = (() => { try { return JSON.parse(readFileSync(new URL('../web/espana-imagenes.json', import.meta.url).pathname, 'utf8')).imagenes || {} } catch { return {} } })()
for (const g of grupos) { const m = g.medios.find((x) => A_MANO[x.url]); if (m) { if (g.imagen && g.imagen !== A_MANO[m.url]) g.alt = [g.imagen, ...(g.alt || [])].slice(0, 4); g.imagen = A_MANO[m.url]; g.pantallazo = false; g.aMano = true } }
console.log(`Con pantallazo de la portada del medio: ${conPantallazo}`)
const salida = grupos.map(({ cl, imgs, ...g }) => g)
  .sort((a, b) => b.fecha.slice(0, 10).localeCompare(a.fecha.slice(0, 10)) || b.medios.length - a.medios.length || b.fecha.localeCompare(a.fecha))
  .slice(0, 1200)   // con siete medios, la semana entera cabe holgada
mkdirSync(new URL('../datos/', import.meta.url).pathname, { recursive: true })
writeFileSync(RUTA_DATOS, JSON.stringify({ actualizado: new Date().toISOString(), noticias: todas }, null, 0))
writeFileSync(RUTA_WEB, '/* España al día — se genera solo (scripts/espana-al-dia.mjs). No editar a mano. */\nwindow.ESPANA_AL_DIA = ' +
  JSON.stringify({ actualizado: new Date().toISOString(), dias: DIAS, grupos: salida }) + ';\n')
console.log(`Noticias: ${todas.length} · grupos: ${salida.length} · con varios medios: ${salida.filter((g) => g.medios.length > 1).length}`)
