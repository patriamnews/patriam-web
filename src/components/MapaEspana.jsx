// Mapa de España dibujado en la propia web (SVG): no carga Google Maps ni
// servicios externos, así que no instala cookies ni envía datos a terceros.
const ESCALA = 60
const COS = 0.766
export const proy = ([lon, lat]) => [(lon + 9.6) * COS * ESCALA, (43.9 - lat) * ESCALA]
const inv = ([x, y]) => [+(x / (COS * ESCALA) - 9.6).toFixed(2), +(43.9 - y / ESCALA).toFixed(2)]
const ruta = (pts) => 'M' + pts.map((p) => proy(p).map((v) => v.toFixed(1)).join(',')).join('L') + 'Z'

const PENINSULA = [
  [-9.3, 43.0], [-8.2, 43.6], [-7.0, 43.55], [-5.8, 43.6], [-4.5, 43.4], [-3.8, 43.45], [-3.0, 43.35],
  [-1.8, 43.38], [-1.4, 43.05], [-0.7, 42.8], [0.7, 42.85], [1.4, 42.6], [2.2, 42.43], [3.2, 42.35],
  [3.2, 41.9], [2.4, 41.4], [1.2, 41.1], [0.9, 40.7], [0.0, 40.0], [-0.3, 39.4], [0.2, 38.8],
  [-0.5, 38.3], [-0.8, 37.6], [-1.6, 37.3], [-2.1, 36.7], [-3.0, 36.75], [-4.4, 36.7], [-5.3, 36.1],
  [-5.6, 36.0], [-6.0, 36.3], [-6.4, 36.8], [-6.9, 37.2], [-7.4, 37.2], [-7.5, 37.5], [-7.0, 38.2],
  [-7.3, 38.7], [-7.0, 39.0], [-7.5, 39.7], [-6.9, 40.2], [-6.8, 41.0], [-6.2, 41.6], [-6.6, 41.95],
  [-7.5, 41.85], [-8.2, 41.9], [-8.9, 41.9], [-8.9, 42.3],
]
const ISLAS = [
  [[2.35, 39.6], [3.0, 39.95], [3.45, 39.75], [3.25, 39.35], [2.75, 39.4]],
  [[3.8, 40.05], [4.3, 39.98], [4.25, 39.82], [3.85, 39.92]],
  [[1.2, 38.95], [1.6, 39.1], [1.55, 38.85], [1.3, 38.85]],
]

// puntos: [{ ciudad, lat, lon, email? }]. Si se pasa onClicMapa, al pulsar el mapa devuelve [lat, lon].
export default function MapaEspana({ puntos, activa, setActiva = () => {}, onClicMapa, etiqueta = 'Mapa de España' }) {
  const clic = (e) => {
    if (!onClicMapa) return
    const svg = e.currentTarget
    const pt = svg.createSVGPoint()
    pt.x = e.clientX
    pt.y = e.clientY
    const p = pt.matrixTransform(svg.getScreenCTM().inverse())
    const [lon, lat] = inv([p.x, p.y])
    onClicMapa([lat, lon])
  }

  return (
    <svg viewBox="0 0 680 490" className={`mapa-sedes ${onClicMapa ? 'mapa-editable' : ''}`} role="img" aria-label={etiqueta} onClick={clic}>
      {[PENINSULA, ...ISLAS].map((p, i) => (
        <path key={i} d={ruta(p)} className="mapa-tierra" />
      ))}
      {puntos.filter((s) => s.lat != null && s.lon != null).map((s, i) => {
        const [x, y] = proy([Number(s.lon), Number(s.lat)])
        const on = activa === s.ciudad
        const punto = (
          <>
            <circle cx={x} cy={y} r={on ? 11 : 8} className="mapa-punto" />
            <text x={x} y={y - 16} textAnchor="middle" className={`mapa-nombre ${on ? 'on' : ''}`}>{s.ciudad}</text>
          </>
        )
        return s.email && !onClicMapa ? (
          <a key={i} href={`mailto:${s.email}`} onMouseEnter={() => setActiva(s.ciudad)} onMouseLeave={() => setActiva(null)} onFocus={() => setActiva(s.ciudad)} onBlur={() => setActiva(null)}>
            {punto}
          </a>
        ) : (
          <g key={i}>{punto}</g>
        )
      })}
    </svg>
  )
}
