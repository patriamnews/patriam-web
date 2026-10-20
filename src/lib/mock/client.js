// Cliente SIMULADO con la misma interfaz que Supabase (la parte que usa la web).
// Guarda los datos en el navegador. Al conectar Supabase, este archivo deja de usarse.
// Reproduce las reglas de permisos más importantes de supabase/schema.sql.

import { semilla } from './seed'

const CLAVE = 'patriam-demo-v17'
const SESION = 'patriam-demo-sesion'

const leer = (k) => {
  try {
    return JSON.parse(localStorage.getItem(k))
  } catch {
    return null
  }
}
const escribir = (k, v) => {
  try {
    localStorage.setItem(k, JSON.stringify(v))
  } catch {
    /* sin almacenamiento: los cambios duran hasta recargar */
  }
}

let db = leer(CLAVE) || semilla()
// Tablas añadidas después: se completan sin borrar lo que ya hay en la demostración
for (const [k, v] of Object.entries(semilla())) if (!db[k]) db[k] = v
const guardar = () => escribir(CLAVE, db)
export const reiniciarDemo = () => {
  db = semilla()
  guardar()
  location.reload()
}

let sesion = leer(SESION)
const oyentes = new Set()
const avisar = () => oyentes.forEach((f) => f('CHANGE', sesion))

const uid = () => sesion?.user?.id || null
const yo = () => db.perfiles.find((p) => p.id === uid() && p.activo && p.rol !== 'pendiente') || null
const miEmail = () => (sesion?.user?.email || '').toLowerCase()
const esMio = (r) => !!uid() && (r.usuario_id === uid() || (r.email || '').toLowerCase() === miEmail())
const miSocio = () => db.socios.find((s) => esMio(s))
const rol = () => yo()?.rol || null
// Equipo interno: todos con la misma gestión. Solo 'director' (Carlos) aprueba y publica.
const equipo = () => ['autor', 'editor', 'director', 'admin'].includes(rol())
// Solo el aprobador (rol director: Carlos Rubio) publica y aprueba contenidos
const puedePublicar = () => rol() === 'director'
// Pueden proponer acciones: administración, aprobador y el editor del área
// eslint-disable-next-line no-unused-vars
const puedeArea = (_s) => equipo()
const puedeTienda = () => equipo()
const puedeRedes = () => equipo()
// Copia profunda compatible con navegadores antiguos (iPad/iPhone con iOS < 15.4)
const clonar = (v) => (typeof structuredClone === 'function' ? structuredClone(v) : JSON.parse(JSON.stringify(v)))
const ahora = () => new Date().toISOString()
// Huella rápida para la demostración (en producción: SHA-256 en el servidor)
const fnv = (s) => {
  let h = 0xcbf29ce484222325n
  for (const c of s) h = BigInt.asUintN(64, (h ^ BigInt(c.codePointAt(0))) * 0x100000001b3n)
  return h.toString(16).padStart(16, '0')
}

// ---------- Reglas de lectura (equivalen a las políticas RLS) ----------
const visible = {
  articulos: (a) =>
    a.estado === 'publicado' ||
    a.autor_id === uid() ||
    equipo(),
  perfiles: (p) => p.id === uid() || equipo() || puedeRedes(),
  contactos: () => equipo(),
  cargos: (c) => (c.visible && c.consentimiento_publicacion && c.aprobada !== false) || equipo(),
  sedes: (s) => (s.activa && s.aprobada) || equipo(),
  documentos: (d) => (d.publico && d.aprobada !== false) || equipo(),
  redes_posts: () => puedeRedes(),
  campanas: (c) => (c.activa && c.aprobada !== false) || equipo(),
  firmas: () => equipo(),
  socios: (s) => equipo() || esMio(s),
  donativos: (d) => equipo() || esMio(d),
  pagos: (p) => equipo() || p.socio_id === miSocio()?.id,
  firmas_adhesion: (f) => equipo() || esMio(f),
  productos: (p) => (p.activo && p.aprobada !== false) || puedeTienda() || equipo(),
  acciones: (a) => (a.publicada && a.aprobada !== false) || puedeArea(a.seccion),
  correos: () => equipo(),
  pedidos: (p) => puedeTienda() || equipo() || esMio(p),
  // Gestión administrativa: solo el equipo
  facturas_recibidas: () => equipo(),
  extractos: () => equipo(),
  impuestos: () => equipo(),
  apuntes: () => equipo(),
  archivos_web: () => equipo(),
}

// ---------- Reglas de escritura ----------
const error = (message) => {
  throw { message }
}

const soloEquipo = (nuevo, viejo) => {
  if (!equipo()) error('Solo el equipo de la asociación puede acceder a la gestión administrativa')
  if (!viejo) nuevo.creado_por = uid()
  nuevo.actualizado_at = ahora()
}

const antes = {
  facturas_recibidas: soloEquipo,
  extractos: soloEquipo,
  impuestos: soloEquipo,
  apuntes: soloEquipo,
  archivos_web: soloEquipo,
  articulos(nuevo, viejo) {
    if (!rol()) error('Debe iniciar sesión')
    if (viejo && !puedePublicar(viejo.seccion) && !(viejo.autor_id === uid() && ['borrador', 'revision', 'rechazado'].includes(viejo.estado)))
      error('No tiene permiso para editar este artículo')
    nuevo.actualizado_at = ahora()
    if (nuevo.estado === 'publicado' && viejo?.estado !== 'publicado') {
      if (!puedePublicar(nuevo.seccion)) error('Solo el responsable de aprobación (Carlos Rubio) puede publicar')
      nuevo.revisado_por = uid()
      nuevo.publicado_at = nuevo.publicado_at || ahora()
    }
    if (!viejo) {
      nuevo.autor_id = uid()
      nuevo.creado_at = ahora()
    }
  },
  perfiles(nuevo, viejo) {
    const cambiaPermisos = ['rol', 'area', 'activo', 'gestiona_redes', 'gestiona_tienda'].some((k) => k in nuevo && nuevo[k] !== viejo[k])
    if (cambiaPermisos && !equipo()) error('Solo el equipo puede cambiar roles o permisos')
    if (viejo.id !== uid() && !equipo()) error('Sin permiso')
  },
  paginas: () => rol() === 'director' || error('Solo Carlos (dirección) puede publicar cambios en las páginas'),
  cargos: (n, v) => { if (!equipo()) error('Sin permiso'); n.aprobada = rol() === 'director'; if (!v) n.creado_por = uid() },
  sedes: (n, v) => {
    if (!equipo()) error('Sin permiso')
    n.aprobada = rol() === 'director' // las de los demás esperan la aprobación de Carlos
    if (!v) n.creado_por = uid()
  },
  documentos: (n, v) => { if (!equipo()) error('Sin permiso'); n.aprobada = rol() === 'director'; if (!v) n.creado_por = uid() },
  campanas: (n) => {
    if (!equipo()) error('Sin permiso')
    if (rol() !== 'director') n.aprobada = false // necesita la aprobación de Carlos
  },
  correos: () => (uid() ? null : error('Sin permiso')),
  ajustes: () => equipo() || error('Sin permiso'),
  redes_posts: (n, v) => {
    if (!puedeRedes()) error('Sin permiso')
    n.actualizado_at = ahora()
    if (!v) n.responsable_id = uid()
  },
  // Formularios públicos: cualquiera puede insertar, solo admin modifica
  contactos: (n, v) => (v ? equipo() || error('Sin permiso') : n.consentimiento || error('Falta el consentimiento')),
  firmas: (n, v) => {
    if (v) return equipo() || error('Sin permiso')
    if (!n.consentimiento) error('Falta el consentimiento')
    const c = db.campanas.find((x) => x.id === Number(n.campana_id))
    if (!c?.activa || c.modo !== 'propio') error('La campaña no admite firmas en esta web')
    n.campana_id = c.id
    if (db.firmas.some((f) => f.campana_id === c.id && f.email.toLowerCase() === n.email.toLowerCase()))
      error('Este email ya ha firmado esta campaña')
    n.confirmada = true // en producción: tras confirmar el email
  },
  socios: (n, v) => {
    if (!v) {
      if (!n.consentimiento) error('Falta el consentimiento')
      n.usuario_id = uid()
      return
    }
    if (equipo()) return
    // El propio socio solo puede cambiar su municipio o pedir la baja
    if (!esMio(v) || Object.keys(n).some((k) => !['municipio', 'baja_solicitada'].includes(k))) error('Sin permiso')
  },
  donativos: (n, v) => (v ? equipo() || error('Sin permiso') : (n.usuario_id = uid())),
  pagos: () => equipo() || error('Sin permiso'),
  // Registro de firmas: solo se añade, nunca se modifica ni se borra (ni siquiera la administración)
  firmas_adhesion: (n, v) => {
    if (v) error('El registro de firmas no se puede modificar')
    if (!n.aceptado) error('Falta la aceptación')
    n.usuario_id = uid()
    n.firmado_at = ahora() // hora del servidor
    n.ip = '(registrada por el servidor)'
    // Encadenado: cada registro incluye la huella del anterior (en producción, SHA-256 calculado en la base de datos)
    const previo = db.firmas_adhesion?.[db.firmas_adhesion.length - 1]?.hash_cadena || ''
    n.hash_cadena = fnv(previo + JSON.stringify([n.referencia, n.documento, n.hash_documento, n.firma, n.firmado_at]))
  },
  productos: (n, v) => { if (!puedeTienda()) error('Sin permiso'); n.aprobada = rol() === 'director'; if (!v) n.creado_por = uid() },
  acciones: (n, v) => {
    if (!puedeArea((v || n).seccion) || (n.seccion && !puedeArea(n.seccion))) error('No tiene permiso en esta sección')
    if (rol() !== 'director') n.aprobada = false // necesita la aprobación de Carlos
    else if (n.aprobada === undefined && !v) n.aprobada = true
    if (!v) n.creado_por = uid()
  },
  pedidos: (n, v) => {
    if (v) return puedeTienda() || error('Sin permiso')
    if (!n.consentimiento) error('Falta la aceptación de las condiciones')
    n.usuario_id = uid()
    // El servidor recalcula los precios a partir del catálogo (no se fía del navegador)
    let sub = 0
    for (const it of n.items) {
      const p = db.productos.find((x) => x.id === it.id && x.activo)
      if (!p) error('Un producto ya no está disponible')
      it.precio = Number(p.precio)
      sub += it.precio * it.cantidad
    }
    n.subtotal = Math.round(sub * 100) / 100
    n.total = Math.round((n.subtotal + Number(n.envio || 0)) * 100) / 100
    n.estado = n.total === 0 ? 'pagado' : 'pendiente'
  },
}

const PK = { paginas: 'clave', perfiles: 'id' }

// ---------- Constructor de consultas ----------
class Consulta {
  constructor(tabla) {
    this.tabla = tabla
    this.filtros = []
    this.op = 'select'
    this.orden = []
    this.lim = null
    this.modo = 'lista'
    this.devolver = false
  }
  select(_cols, opts = {}) {
    if (this.op === 'select') this.opts = opts
    else this.devolver = true
    return this
  }
  insert(filas) { this.op = 'insert'; this.valor = filas; return this }
  update(v) { this.op = 'update'; this.valor = v; return this }
  upsert(v) { this.op = 'upsert'; this.valor = v; return this }
  delete() { this.op = 'delete'; return this }
  eq(k, v) { this.filtros.push((r) => String(r[k]) === String(v)); return this }
  neq(k, v) { this.filtros.push((r) => String(r[k]) !== String(v)); return this }
  gte(k, v) { this.filtros.push((r) => r[k] >= v); return this }
  lt(k, v) { this.filtros.push((r) => r[k] < v); return this }
  in(k, l) { this.filtros.push((r) => l.map(String).includes(String(r[k]))); return this }
  order(k, { ascending = true } = {}) { this.orden.push([k, ascending]); return this }
  limit(n) { this.lim = n; return this }
  single() { this.modo = 'una'; return this }
  maybeSingle() { this.modo = 'quizas'; return this }

  ejecutar() {
    const tabla = (db[this.tabla] ||= [])
    const pasa = (r) => this.filtros.every((f) => f(r))
    const ver = visible[this.tabla] || (() => true)
    const regla = antes[this.tabla] || (() => {})
    let res = []

    if (this.op === 'select') {
      res = tabla.filter((r) => ver(r) && pasa(r))
    } else if (this.op === 'insert' || (this.op === 'upsert' && !tabla.find((r) => r[PK[this.tabla] || 'id'] === this.valor[PK[this.tabla] || 'id']))) {
      const filas = Array.isArray(this.valor) ? this.valor : [this.valor]
      for (const f of filas) {
        const n = { creado_at: ahora(), ...clonar(f) }
        if (!PK[this.tabla] && n.id == null) n.id = tabla.reduce((m, r) => Math.max(m, Number(r.id) || 0), 0) + 1
        regla(n, null)
        tabla.push(n)
        res.push(n)
      }
    } else if (this.op === 'update' || this.op === 'upsert') {
      const k = PK[this.tabla] || 'id'
      const objetivo = this.op === 'upsert' ? tabla.filter((r) => r[k] === this.valor[k]) : tabla.filter((r) => ver(r) && pasa(r))
      for (const r of objetivo) {
        const n = { ...clonar(this.valor) }
        regla(n, r)
        Object.assign(r, n)
        res.push(r)
      }
    } else if (this.op === 'delete') {
      const borrar = tabla.filter((r) => ver(r) && pasa(r))
      if (borrar.length && ['contactos', 'firmas', 'socios', 'donativos', 'cargos', 'sedes', 'documentos', 'ajustes'].includes(this.tabla) && !equipo())
        error('Sin permiso')
      if (this.tabla === 'articulos')
        borrar.forEach((a) => equipo() || (a.autor_id === uid() && a.estado === 'borrador') || error('Sin permiso'))
      if (this.tabla === 'redes_posts' && !puedeRedes()) error('Sin permiso')
      if (['productos', 'pedidos'].includes(this.tabla) && !puedeTienda()) error('Sin permiso')
      if (['facturas_recibidas', 'extractos', 'impuestos', 'apuntes', 'archivos_web'].includes(this.tabla) && borrar.length && !equipo()) error('Sin permiso')
      if (this.tabla === 'firmas_adhesion' && borrar.length) error('El registro de firmas no se puede borrar')
      if (this.tabla === 'acciones') borrar.forEach((a) => puedeArea(a.seccion) || error('Sin permiso'))
      db[this.tabla] = tabla.filter((r) => !borrar.includes(r))
      res = borrar
    }
    if (this.op !== 'select') guardar()

    for (const [k, asc] of [...this.orden].reverse())
      res = [...res].sort((a, b) => ((a[k] ?? '') > (b[k] ?? '') ? 1 : (a[k] ?? '') < (b[k] ?? '') ? -1 : 0) * (asc ? 1 : -1))
    const count = res.length
    if (this.lim) res = res.slice(0, this.lim)
    res = clonar(res)

    if (this.opts?.head) return { data: null, count, error: null }
    if (this.modo === 'una') return res.length ? { data: res[0], error: null } : { data: null, error: { message: 'No encontrado' } }
    if (this.modo === 'quizas') return { data: res[0] || null, error: null }
    if (this.op !== 'select' && !this.devolver) return { data: null, error: null }
    return { data: res, count, error: null }
  }

  then(ok, ko) {
    let r
    try {
      r = this.ejecutar()
    } catch (e) {
      r = { data: null, error: { message: e.message || String(e) } }
    }
    return new Promise((res) => setTimeout(() => res(r), 60)).then(ok, ko)
  }
}

// ---------- Autenticación simulada ----------
// Huella SHA-256 (las cuentas del equipo no guardan el correo ni la clave en claro)
const sha = async (t) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t)))).map((b) => b.toString(16).padStart(2, '0')).join('')

const auth = {
  async getSession() {
    return { data: { session: sesion } }
  },
  onAuthStateChange(fn) {
    oyentes.add(fn)
    return { data: { subscription: { unsubscribe: () => oyentes.delete(fn) } } }
  },
  async signInWithPassword({ email, password }) {
    const correo = email.trim().toLowerCase()
    const eh = await sha(correo)
    const ch = await sha(correo + ':' + password)
    const u = db.usuarios.find((x) => (x.email_hash ? x.email_hash === eh && x.clave_hash === ch : x.email.toLowerCase() === correo && x.password === password))
    if (!u) return { error: { message: 'Credenciales incorrectas' } }
    if (u.email_hash) {
      // Se muestra el correo real solo en este navegador, una vez que la persona ha entrado
      const p = db.perfiles.find((x) => x.id === u.id)
      if (p) p.email = correo
      guardar()
    }
    sesion = { user: { id: u.id, email: u.email_hash ? correo : u.email } }
    escribir(SESION, sesion)
    avisar()
    return { data: { session: sesion }, error: null }
  },
  async signUp({ email, password, options }) {
    const eh = await sha(email.trim().toLowerCase())
    if (db.usuarios.some((x) => x.email_hash === eh || (x.email || '').toLowerCase() === email.toLowerCase())) return { error: { message: 'Ese email ya está registrado' } }
    const id = crypto.randomUUID()
    db.usuarios.push({ id, email, password })
    const cliente = options?.data?.tipo === 'cliente'
    db.perfiles.push({ id, email, nombre: options?.data?.nombre || '', rol: cliente ? 'cliente' : 'pendiente', area: null, activo: cliente, gestiona_redes: false, creado_at: ahora() })
    guardar()
    // En la demostración no hay email de confirmación: el cliente entra directamente
    if (cliente) {
      sesion = { user: { id, email } }
      escribir(SESION, sesion)
      avisar()
    }
    return { data: {}, error: null }
  },
  async signOut() {
    sesion = null
    escribir(SESION, null)
    avisar()
  },
  async resetPasswordForEmail() {
    return { error: null }
  },
  async updateUser({ password }) {
    const u = db.usuarios.find((x) => x.id === uid())
    if (u && password) {
      if (u.email_hash) {
        const nueva = await sha(miEmail() + ':' + password)
        if (nueva === u.clave_hash) return { error: { message: 'elija una contraseña distinta de la actual' } }
        u.clave_hash = nueva
      }
      else u.password = password
      const p = db.perfiles.find((x) => x.id === uid())
      if (p) p.cambiar_clave = false
    }
    guardar()
    return { error: null }
  },
}

// ---------- Archivos simulados ----------
const archivos = new Map()
const storage = {
  from: () => ({
    async upload(ruta, file) {
      const url = await new Promise((res) => {
        if (file.size > 400_000) return res(URL.createObjectURL(file)) // grande: solo esta sesión
        const r = new FileReader()
        r.onload = () => res(r.result)
        r.readAsDataURL(file)
      })
      archivos.set(ruta, url)
      return { error: null }
    },
    getPublicUrl: (ruta) => ({ data: { publicUrl: archivos.get(ruta) || '#' } }),
  }),
}

// Funciones del servidor (equivalen a las funciones SQL de schema.sql)
const rpc = async (nombre, args) => {
  if (nombre === 'contar_firmas')
    return { data: db.firmas.filter((f) => f.campana_id === Number(args.campana) && f.confirmada).length, error: null }
  return { data: null, error: { message: 'Función no disponible' } }
}

export const mockClient = { from: (t) => new Consulta(t), auth, storage, rpc }
