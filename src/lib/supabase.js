import { createClient } from '@supabase/supabase-js'
import { mockClient } from './mock/client'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

// Sin credenciales, la web funciona en "modo demostración" con una base de datos simulada
// en el navegador. Para pasar a real basta con definir las dos variables (ver README).
export const DEMO = !url || !key
export const supabase = DEMO ? mockClient : createClient(url, key)
