// Prepara los datos de España al día para la App PATRIAM (panel privado en claude.ai).
// Lo usa la tarea programada de Claude cada mañana:
//   node scripts/app-patriam-datos.mjs [miniaturas.json] [carpeta]
// Escribe en <carpeta> (por defecto ./app-datos):
//   espana.json      {actualizado, total, grupos:[{t, r, f, tema, a, k, m:[{n, u}]}]}  (solo las de hoy, máx. 240 KB)
//   img-0.json, img-1.json…  {fotos:{k: data URI}}  trozos de ≤ 220 KB con las fotos originales reducidas
// miniaturas.json es el que deja GitHub en la rama app-miniaturas (datos/espana-miniaturas.json). Sin dependencias.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'

const [, , rutaMini, carpeta = 'app-datos'] = process.argv
const claveFoto = (url) => createHash('sha1').update(url).digest('hex').slice(0, 12)
const js = readFileSync(new URL('../web/espana-al-dia.js', import.meta.url).pathname, 'utf8')
const d = JSON.parse(js.slice(js.indexOf('{'), js.lastIndexOf('}') + 1))
const mini = rutaMini && existsSync(rutaMini) ? JSON.parse(readFileSync(rutaMini, 'utf8')).fotos || {} : {}
const ref = Date.parse(d.actualizado) || Date.now()
// Solo las de HOY (hora de Madrid); a primera hora, si aún no hay, las de las últimas 24 horas
const diaMadrid = (t) => new Date(t).toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' })
const hoy = diaMadrid(Date.now())
let base = (d.grupos || []).filter((g) => diaMadrid(g.fecha) === hoy)
if (!base.length) base = (d.grupos || []).filter((g) => ref - Date.parse(g.fecha) < 24 * 3600e3)
let grupos = base
  .sort((a, b) => b.fecha.localeCompare(a.fecha))
  .map((g) => {
    const k = /^https?:/.test(g.imagen || '') ? claveFoto(g.imagen) : ''
    return { t: g.titulo, r: (g.resumen || '').slice(0, 180), f: g.fecha, tema: g.tema === 'Economía' ? 'Economía' : 'Política', a: g.asunto || 'Otros',
      ...(mini[k] ? { k } : {}), m: (g.medios || []).map((m) => ({ n: m.medio, u: m.url })) }
  })
const salida = () => JSON.stringify({ actualizado: d.actualizado, total: (d.grupos || []).length, grupos })
while (grupos.length && Buffer.byteLength(salida()) > 240 * 1024) grupos = grupos.slice(0, Math.floor(grupos.length * 0.9))
mkdirSync(carpeta, { recursive: true })
writeFileSync(`${carpeta}/espana.json`, salida())
// fotos en trozos
const trozos = [{}]; let tam = 0
for (const k of new Set(grupos.map((g) => g.k).filter(Boolean))) {
  const v = mini[k]; if (tam + v.length > 220 * 1024) { trozos.push({}); tam = 0 }
  trozos[trozos.length - 1][k] = v; tam += v.length + 20
}
trozos.forEach((t, i) => writeFileSync(`${carpeta}/img-${i}.json`, JSON.stringify({ fotos: t })))
const c = {}; for (const g of grupos) if (g.a !== 'Otros') c[g.a] = (c[g.a] || 0) + 1
console.log(JSON.stringify({ semana: (d.grupos || []).length, hoy: grupos.length, conFoto: grupos.filter((g) => g.k).length, trozosDeFotos: trozos.length,
  top: Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => k) }))
