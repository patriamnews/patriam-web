import { supabase } from '../lib/supabase'

// Sube un archivo al almacenamiento de Supabase y devuelve su URL pública
export async function subirArchivo(bucket, file) {
  const ext = file.name.split('.').pop().toLowerCase()
  const ruta = `${new Date().getFullYear()}/${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage.from(bucket).upload(ruta, file, { upsert: false })
  if (error) throw error
  return supabase.storage.from(bucket).getPublicUrl(ruta).data.publicUrl
}
