// Miniaturas de las fotos de los medios para la App PATRIAM (la App no puede cargar fotos de otras webs).
// Lo ejecuta GitHub después de recoger las noticias. Baja la foto original de cada noticia de las últimas 48 horas,
// la reduce a 160x107 y la guarda como data: URI en datos/espana-miniaturas.json  ({clave: "data:image/jpeg;base64,…"}).
// La clave es la de cada noticia en la App (ver claveFoto). Necesita sharp (npm i --no-save sharp).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import sharp from 'sharp'

export const claveFoto = (url) => createHash('sha1').update(url).digest('hex').slice(0, 12)
const js = readFileSync(new URL('../web/espana-al-dia.js', import.meta.url).pathname, 'utf8')
const d = JSON.parse(js.slice(js.indexOf('{'), js.lastIndexOf('}') + 1))
const ref = Date.parse(d.actualizado) || Date.now()
const fotos = [...new Set((d.grupos || []).filter((g) => ref - Date.parse(g.fecha) < 48 * 3600e3 && /^https?:/.test(g.imagen || '')).map((g) => g.imagen))]
const UA = 'Mozilla/5.0 (compatible; PatriamBoletin/1.0; +https://boletin.movimientopatriam.es)'
const out = {}
let ok = 0, mal = 0
async function una(url) {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA, Referer: new URL(url).origin + '/' }, signal: AbortSignal.timeout(12000) })
    if (!r.ok) throw new Error(r.status)
    const buf = Buffer.from(await r.arrayBuffer())
    const jpg = await sharp(buf).resize(160, 107, { fit: 'cover' }).jpeg({ quality: 58, mozjpeg: true }).toBuffer()
    out[claveFoto(url)] = 'data:image/jpeg;base64,' + jpg.toString('base64'); ok++
  } catch { mal++ }
}
for (let i = 0; i < fotos.length; i += 8) await Promise.all(fotos.slice(i, i + 8).map(una))
mkdirSync(new URL('../datos/', import.meta.url).pathname, { recursive: true })
writeFileSync(new URL('../datos/espana-miniaturas.json', import.meta.url).pathname, JSON.stringify({ actualizado: d.actualizado, fotos: out }))
console.log(`Miniaturas: ${ok} bien, ${mal} sin poder bajar, ${fotos.length} fotos distintas`)
