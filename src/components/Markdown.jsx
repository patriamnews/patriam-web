// Muestra texto con formato sencillo (títulos, listas, tablas, citas, negrita y cursiva)
// sin insertar HTML: todo se convierte en elementos de React, así que es seguro.

function enLinea(texto, k = 0) {
  const partes = []
  const re = /(\*\*([^*]+)\*\*|\*([^*]+)\*)/g
  let ultimo = 0
  let m
  while ((m = re.exec(texto))) {
    if (m.index > ultimo) partes.push(texto.slice(ultimo, m.index))
    partes.push(m[2] ? <strong key={`${k}-${m.index}`}>{m[2]}</strong> : <em key={`${k}-${m.index}`}>{m[3]}</em>)
    ultimo = re.lastIndex
  }
  if (ultimo < texto.length) partes.push(texto.slice(ultimo))
  return partes
}

const celdas = (linea) => linea.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim())

export function bloques(texto = '') {
  const lineas = texto.replace(/\r/g, '').split('\n')
  const out = []
  let i = 0
  while (i < lineas.length) {
    const l = lineas[i]
    if (!l.trim()) { i++; continue }
    const h = l.match(/^(#{2,4})\s+(.*)/)
    if (h) { out.push({ t: 'h', nivel: h[1].length, texto: h[2] }); i++; continue }
    if (l.trim().startsWith('|')) {
      const filas = []
      while (i < lineas.length && lineas[i].trim().startsWith('|')) filas.push(lineas[i++])
      const [cab, , ...cuerpo] = filas
      out.push({ t: 'tabla', cab: celdas(cab), filas: cuerpo.map(celdas) })
      continue
    }
    if (l.startsWith('>')) {
      const dentro = []
      while (i < lineas.length && lineas[i].startsWith('>')) dentro.push(lineas[i++].replace(/^>\s?/, ''))
      out.push({ t: 'cita', hijos: bloques(dentro.join('\n')) })
      continue
    }
    if (/^- /.test(l)) {
      const items = []
      while (i < lineas.length && /^- /.test(lineas[i])) items.push(lineas[i++].slice(2))
      const check = items.every((x) => /^\[[ x]\] /.test(x))
      out.push({ t: 'lista', check, items: check ? items.map((x) => x.slice(4)) : items })
      continue
    }
    const par = []
    while (i < lineas.length && lineas[i].trim() && !/^(#{2,4}\s|\||>|- )/.test(lineas[i])) par.push(lineas[i++])
    out.push({ t: 'p', texto: par.join(' ') })
  }
  return out
}

function Bloque({ b, k }) {
  if (b.t === 'h') { const H = `h${b.nivel}`; return <H>{enLinea(b.texto, k)}</H> }
  if (b.t === 'p') return <p>{enLinea(b.texto, k)}</p>
  if (b.t === 'cita') return <blockquote>{b.hijos.map((x, j) => <Bloque key={j} b={x} k={`${k}-${j}`} />)}</blockquote>
  if (b.t === 'lista')
    return (
      <ul className={b.check ? 'lista-check' : undefined}>
        {b.items.map((x, j) => <li key={j}>{enLinea(x, `${k}-${j}`)}</li>)}
      </ul>
    )
  return (
    <div className="tabla-scroll">
      <table className="tabla">
        <thead><tr>{b.cab.map((c, j) => <th key={j}>{enLinea(c)}</th>)}</tr></thead>
        <tbody>{b.filas.map((f, j) => <tr key={j}>{f.map((c, n) => <td key={n}>{enLinea(c, `${k}-${j}-${n}`)}</td>)}</tr>)}</tbody>
      </table>
    </div>
  )
}

export default function Markdown({ texto, className = 'prosa' }) {
  return <div className={className}>{bloques(texto).map((b, k) => <Bloque key={k} b={b} k={k} />)}</div>
}

// Esquema: cada "### Título" se convierte en una tarjeta
export function Esquema({ texto }) {
  const tarjetas = []
  for (const b of bloques(texto)) {
    if (b.t === 'h') tarjetas.push({ titulo: b.texto, cuerpo: [] })
    else if (tarjetas.length) tarjetas[tarjetas.length - 1].cuerpo.push(b)
  }
  return (
    <div className="esquema">
      {tarjetas.map((t, k) => (
        <section key={k} className="esquema-tarjeta">
          <h3>{t.titulo}</h3>
          {t.cuerpo.map((b, j) => <Bloque key={j} b={b} k={`${k}-${j}`} />)}
        </section>
      ))}
    </div>
  )
}
