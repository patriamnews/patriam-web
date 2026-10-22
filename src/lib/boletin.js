// Boletín «Lo que hay que saber» (web aparte: boletin.movimientopatriam.es).
// Se lee su archivo boletines.js publicado, así la web muestra siempre el último boletín
// sin tener que volver a publicar la web cada semana.
export const BOLETIN_POR_DEFECTO = 'https://boletin.movimientopatriam.es/'

export const urlBoletin = (aj) => {
  const u = (aj?.boletin_url || BOLETIN_POR_DEFECTO).trim()
  return u.endsWith('/') ? u : u + '/'
}

let cache = null
export function cargarBoletin(base) {
  if (cache && cache.base === base) return cache.promesa
  const promesa = new Promise((resolver) => {
    const s = document.createElement('script')
    // Se renueva cada hora para coger el boletín nuevo
    s.src = `${base}boletines.js?h=${Math.floor(Date.now() / 3600000)}`
    s.async = true
    s.onload = () => {
      const cfg = window.PATRIAM_CONFIG || {}
      const lista = (window.BOLETINES || [])
        .filter((b) => !b.estado || b.estado === 'aprobado')
        .sort((a, b) => String(b.fecha || '').localeCompare(String(a.fecha || '')) || (b.numero || 0) - (a.numero || 0))
      const abs = (r) => (!r ? '' : /^https?:/i.test(r) ? r : base + r.replace(/^\.?\//, ''))
      const ultimo = lista[0]
      resolver(ultimo ? {
        base,
        cabecera: cfg.cabecera || 'Lo que hay que saber',
        claim: cfg.claim || 'con criterio',
        numero: ultimo.numero,
        fecha: ultimo.fecha,
        editorial: ultimo.editorial ? { ...ultimo.editorial, imagen: abs(ultimo.editorial.imagen) } : null,
        noticias: (ultimo.noticias || []).slice(0, 3).map((n) => ({ ...n, imagen: abs(n.imagen) })),
        banner: abs(cfg.banner),
        tarjeta: abs(ultimo.tarjeta),
        frase: String(ultimo.fraseMes || cfg.fraseMes || '').replace(/^["«“]+|["»”]+$/g, ''),
        fraseAutor: ultimo.fraseMes ? ultimo.fraseMesAutor : cfg.fraseMesAutor,
      } : null)
    }
    s.onerror = () => resolver(null)
    document.head.appendChild(s)
  })
  cache = { base, promesa }
  return promesa
}
