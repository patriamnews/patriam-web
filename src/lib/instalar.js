// La Gestión se puede instalar como aplicación (PC, Android, iPhone).
// El aviso de instalación del navegador llega una sola vez al cargar: se guarda aquí.
let aviso = null
const oyentes = new Set()
const avisar = () => oyentes.forEach((f) => f())

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    aviso = e
    avisar()
  })
  window.addEventListener('appinstalled', () => {
    aviso = null
    avisar()
  })
}

export const instalada = () =>
  typeof window !== 'undefined' && (window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true)
export const esIOS = () => typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent) && !/crios|fxios/i.test(navigator.userAgent)
export const puedeInstalar = () => !!aviso
export const escuchar = (f) => {
  oyentes.add(f)
  return () => oyentes.delete(f)
}
export async function instalar() {
  if (!aviso) return false
  aviso.prompt()
  const { outcome } = await aviso.userChoice
  aviso = null
  avisar()
  return outcome === 'accepted'
}

// Añade el manifiesto de la app y registra el service worker (solo en la Gestión y en Acceso)
export function activarApp() {
  if (typeof document === 'undefined' || document.querySelector('link[rel="manifest"]')) return
  const add = (tag, attrs) => {
    const el = document.createElement(tag)
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v))
    document.head.appendChild(el)
  }
  const publicar = /^publicar\./i.test(location.hostname) || /^\/publicar/.test(location.pathname)
  add('link', { rel: 'manifest', href: publicar ? '/publicar.webmanifest' : '/gestion.webmanifest' })
  add('meta', { name: 'theme-color', content: '#7b1c2c' })
  add('meta', { name: 'apple-mobile-web-app-capable', content: 'yes' })
  add('meta', { name: 'mobile-web-app-capable', content: 'yes' })
  add('meta', { name: 'apple-mobile-web-app-title', content: publicar ? 'Publicar' : 'PATRIAM' })
  add('meta', { name: 'apple-mobile-web-app-status-bar-style', content: 'default' })
  document.querySelectorAll('link[rel="apple-touch-icon"]').forEach((l) => l.setAttribute('href', '/gestion-apple-180.png'))
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('/sw.js').catch(() => {})
}
