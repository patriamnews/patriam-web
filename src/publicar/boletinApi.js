// Llamadas al servidor del boletín (aportar.php, telefonos.php…) con la sesión de la web.
import { supabase } from '../lib/supabase'
import { getAjustes } from '../lib/data'
import { urlBoletin } from '../lib/boletin'

export async function llamarBoletin(archivo, accion, cuerpo) {
  const b = urlBoletin(await getAjustes())
  const { data } = await supabase.auth.getSession()
  const r = await fetch(`${b}${archivo}?accion=${accion}`, {
    method: cuerpo === undefined ? 'GET' : 'POST',
    headers: { Authorization: 'Bearer ' + (data.session?.access_token || ''), ...(cuerpo === undefined ? {} : { 'Content-Type': 'application/json' }) },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(r.status === 401 ? 'La sesión ha caducado: sal y vuelve a entrar.' : j.error || 'Error ' + r.status)
  return j
}
