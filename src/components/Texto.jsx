// Muestra texto con un formato sencillo (## títulos, **negrita**, *cursiva*, listas con "-", [enlace](url)).
// No interpreta HTML: todo se escapa para evitar inyección de código.

const esc = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const inline = (s) =>
  esc(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\[(.+?)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    // Huecos por rellenar en plantillas: [DATO]
    .replace(/\[([^\]]+)\](?!\()/g, '<mark class="hueco">[$1]</mark>')

export function aHtml(texto = '') {
  return texto
    .trim()
    .split(/\n\s*\n/)
    .map((bloque) => {
      const lineas = bloque.split('\n')
      if (lineas.every((l) => /^\s*-\s+/.test(l))) {
        return '<ul>' + lineas.map((l) => `<li>${inline(l.replace(/^\s*-\s+/, ''))}</li>`).join('') + '</ul>'
      }
      if (/^###\s/.test(bloque)) return `<h3>${inline(bloque.replace(/^###\s/, ''))}</h3>`
      if (/^##\s/.test(bloque)) return `<h2>${inline(bloque.replace(/^##\s/, ''))}</h2>`
      if (lineas.every((l) => /^\s*\d+\.\s+/.test(l))) {
        return '<ol>' + lineas.map((l) => `<li>${inline(l.replace(/^\s*\d+\.\s+/, ''))}</li>`).join('') + '</ol>'
      }
      if (/^>\s/.test(bloque)) return `<blockquote>${inline(bloque.replace(/^>\s/gm, ''))}</blockquote>`
      return `<p>${lineas.map(inline).join('<br/>')}</p>`
    })
    .join('')
}

export default function Texto({ children, className = 'prosa' }) {
  return <div className={className} dangerouslySetInnerHTML={{ __html: aHtml(children || '') }} />
}
