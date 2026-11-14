// Service worker mínimo para que la Gestión se pueda instalar como aplicación.
// No guarda nada en caché: siempre se usa la versión publicada y los datos al día.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))
self.addEventListener('fetch', (e) => {
  if (e.request.mode !== 'navigate') return
  e.respondWith(
    fetch(e.request).catch(
      () => new Response('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Sin conexión</title><body style="font-family:system-ui;padding:2rem;text-align:center;color:#1d1719;background:#f7f3ec"><h1 style="color:#7b1c2c">Sin conexión</h1><p>La gestión de PATRIAM necesita internet. Compruebe la conexión y vuelva a intentarlo.</p>', { headers: { 'Content-Type': 'text/html; charset=utf-8' } }),
    ),
  )
})
