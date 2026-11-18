// Boletín «Lo que hay que saber» (web aparte: boletin.movimientopatriam.es).
// Se lee su archivo boletines.js publicado, así la web muestra siempre el último boletín
// sin tener que volver a publicar la web cada semana.
export const BOLETIN_POR_DEFECTO = 'https://boletin.movimientopatriam.es/'

export const urlBoletin = (aj) => {
  // Las direcciones antiguas de Netlify ya no sirven: el boletín está en boletin.movimientopatriam.es
  let u = (aj?.boletin_url || BOLETIN_POR_DEFECTO).trim()
  if (/netlify\.app/i.test(u)) u = BOLETIN_POR_DEFECTO
  return u.endsWith('/') ? u : u + '/'
}

let cache = null
export function cargarBoletin(base) {
  if (cache && cache.base === base) return cache.promesa
  const promesa = new Promise((resolver) => {
    const cargar = (src) => new Promise((ok) => {
      const s = document.createElement('script')
      s.src = src
      s.async = true
      s.onload = () => ok(true)
      s.onerror = () => ok(false)
      document.head.appendChild(s)
    })
    const hora = Math.floor(Date.now() / 3600000)   // se renueva cada hora para coger el boletín nuevo
    const alListo = (hay) => {
      if (!hay) return resolver(null)
      // Los boletines abiertos desde Publicar («Boletín paso a paso») y lo que se les mete no están en boletines.js:
      // llegan en aportaciones.js y se unen igual que en la web del boletín. Si falla, se queda lo de boletines.js.
      try { if (window.unirAportaciones) window.unirAportaciones(window.BOLETINES || [], window.PATRIAM_CONFIG, { lectores: true }) } catch { /* sigue con lo que haya */ }
      const cfg = window.PATRIAM_CONFIG || {}
      const lista = (window.BOLETINES || [])
        // Solo los que ya han salido: el número siguiente se ve únicamente en la vista previa temporal del equipo
        .filter((b) => (!b.estado || b.estado === 'aprobado') && (!b.fecha || String(b.fecha).slice(0, 10) <= new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' })))
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
    cargar(`${base}boletines.js?h=${hora}`).then(async (hay) => {
      if (hay) {
        await cargar(`${base}aportaciones.js?h=${hora}`)
        await cargar(`${base}aportaciones-unir.js?h=${hora}`)
      }
      alListo(hay)
    })
  })
  cache = { base, promesa }
  return promesa
}
