/* API del editor del boletín. Todo se guarda en Netlify Blobs (almacén «boletin»). */
import {
  almacen, asegurar, json, hoy, sha256, limpio, idValido, huellaCorreo, cifrarClave,
  comprobarClave, enmascarar, firmar, sesion, sacarImagenes
  , claveCorreo, firmaBaja, enlaceBaja, darDeBaja
} from "../lib/comun.mjs";
import { accionComunicaciones } from "../lib/comunicaciones.mjs";

export const config = { path: "/api/:accion" };

const esAdmin = u => u && u.rol === "admin";
/* «Al momento»: solo un administrador puede dejar un envío como publicado */
const sinEstado = x => JSON.stringify(Object.assign({}, x, { estado: 0, aprobadoPor: 0, aprobadoEl: 0, enviadoPor: 0, enviadoEl: 0 }));
function protegerAlMomento(cfg, ant) {
  const antes = new Map(((ant && ant.alMomento) || []).map(x => [x.id, x]));
  (cfg.alMomento || []).forEach(x => {
    const p = antes.get(x.id);
    if (x.estado === "aprobado") {
      if (p && p.estado === "aprobado" && sinEstado(p) === sinEstado(x)) { x.aprobadoPor = p.aprobadoPor; x.aprobadoEl = p.aprobadoEl; }
      else { x.estado = "borrador"; delete x.aprobadoPor; delete x.aprobadoEl; }
    } else if (x.estado !== "pendiente") x.estado = "borrador";
  });
}
const rolValido = r => (["admin", "redes", "editor"].includes(r) ? r : "editor");
const correoValido = c => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(c || "").trim());
const publico = u => ({ id: u.id, nombre: u.nombre, rol: u.rol, cambiar: !!u.cambiar });
const ESTADO = ["estado", "aprobadoPor", "aprobadoEl", "enviadoPor", "enviadoEl", "fraseMes", "fraseMesAutor", "tarjeta"];

async function leerBoletin(s, id) {
  const r = await s.getWithMetadata("b/" + id, { type: "json" });
  return r ? { b: r.data, etag: r.etag } : null;
}
async function sinPublicar(s, b) {
  if (b.estado !== "aprobado") return false;
  const p = await s.get("pub/" + b.id, { type: "json" });
  return !p || JSON.stringify(limpio(p)) !== JSON.stringify(limpio(b));
}

export default async (req, context) => {
  const accion = context.params.accion;
  const s = almacen();
  try {
    await asegurar(s);

    /* ---------- suscripción (pública) ---------- */
    if (accion === "suscribir") {
      if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);
      const f = new URLSearchParams(await req.text());
      if (f.get("bot-field")) return json({ ok: true });
      const email = String(f.get("email") || "").trim().toLowerCase();
      if (!correoValido(email) || !f.get("privacidad")) return json({ error: "Faltan datos" }, 400);
      // Si se había dado de baja y vuelve a apuntarse, sale de la lista de bajas y queda anotado
      const k = claveCorreo(email), ahora = new Date().toISOString();
      const baja = await s.get("bajas/" + k, { type: "json" });
      const historial = baja ? (baja.historial || []).concat([{ que: "vuelve a darse de alta", fecha: ahora }]) : [{ que: "alta", fecha: ahora }];
      await s.setJSON("sus/" + k, {
        nombre: String(f.get("nombre") || "").trim().slice(0, 120), email,
        movil: String(f.get("movil") || "").trim().slice(0, 40), privacidad: "acepta", fecha: ahora, historial
      });
      if (baja) await s.delete("bajas/" + k);
      return json({ ok: true });
    }

    /* ---------- darse de baja (pública): con el enlace firmado del correo o escribiendo el correo ---------- */
    if (accion === "baja") {
      if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);
      const b = await req.json().catch(() => ({}));
      const email = String(b.email || "").trim().toLowerCase();
      if (!correoValido(email)) return json({ error: "Escribe un correo válido." }, 400);
      const conEnlace = b.t && b.t === firmaBaja(email);
      await darDeBaja(s, email, conEnlace ? "enlace del correo" : "formulario de la web");
      return json({ ok: true }); // no se dice si el correo estaba o no en la lista
    }

    if (req.method !== "GET" && req.method !== "POST") return json({ error: "Método no permitido" }, 405);
    const cuerpo = req.method === "POST" ? await req.json().catch(() => ({})) : {};

    /* ---------- entrar ---------- */
    if (accion === "entrar") {
      const usuarios = (await s.get("usuarios", { type: "json" })) || [];
      const u = usuarios.find(x => x.id === huellaCorreo(cuerpo.correo || ""));
      if (!u || !comprobarClave(u, cuerpo.correo, String(cuerpo.clave || ""))) {
        await new Promise(r => setTimeout(r, 600));
        return json({ error: "El correo o la contraseña no son correctos." }, 401);
      }
      if (!u.clave.startsWith("s$")) { // contraseña con el cifrado antiguo: se pasa al cifrado fuerte (scrypt con sal)
        u.clave = cifrarClave(String(cuerpo.clave || "")); await s.setJSON("usuarios", usuarios);
      }
      return json({ token: firmar(u), usuario: publico(u) });
    }

    const yo = await sesion(req, s);
    if (!yo) return json({ error: "sesion" }, 401);

    /* ---------- cambiar mi contraseña ---------- */
    if (accion === "clave") {
      const nueva = String(cuerpo.nueva || "");
      if (nueva.length < 8) return json({ error: "Usa al menos 8 caracteres." }, 400);
      const usuarios = (await s.get("usuarios", { type: "json" })) || [];
      const u = usuarios.find(x => x.id === yo.id);
      if (cuerpo.correo && comprobarClave(u, cuerpo.correo, nueva)) return json({ error: "Tiene que ser distinta de la anterior." }, 400);
      u.clave = cifrarClave(nueva); u.cambiar = false;
      await s.setJSON("usuarios", usuarios);
      return json({ token: firmar(u), usuario: publico(u) });
    }
    if (yo.cambiar) return json({ error: "Primero tienes que cambiar la contraseña provisional." }, 403);

    /* ---------- cargar todo para el editor ---------- */
    if (accion === "datos") {
      const cfg = await s.getWithMetadata("cfg", { type: "json" });
      const { blobs } = await s.list({ prefix: "b/" });
      const boletines = [];
      for (const { key } of blobs) {
        const r = await s.getWithMetadata(key, { type: "json" });
        if (!r) continue;
        r.data._etag = r.etag;
        r.data._sinPublicar = await sinPublicar(s, r.data);
        boletines.push(r.data);
      }
      return json({ cfg: cfg ? cfg.data : {}, cfgEtag: cfg ? cfg.etag : null, boletines, usuario: publico(yo) });
    }

    /* ---------- guardar (se llama solo mientras se escribe) ---------- */
    if (accion === "guardar") {
      const resp = {};
      if (cuerpo.cfg) {
        const ant = await s.getWithMetadata("cfg", { type: "json" });
        if (ant && cuerpo.cfgEtag !== ant.etag) return json({ error: "conflicto", que: "cfg" }, 409);
        const cfg = limpio(cuerpo.cfg); delete cfg.usuarios;
        if (!esAdmin(yo)) protegerAlMomento(cfg, ant ? ant.data : {});
        resp.mapa = await sacarImagenes(s, cfg);
        const r = await s.setJSON("cfg", cfg, ant ? { onlyIfMatch: ant.etag } : { onlyIfNew: true });
        if (!r.modified) return json({ error: "conflicto", que: "cfg" }, 409);
        resp.cfgEtag = r.etag;
        if (esAdmin(yo)) await s.setJSON("pubcfg", cfg); // lo que cambia un administrador (p. ej. la frase del mes) sale al momento
      }
      if (cuerpo.boletin) {
        const b = limpio(cuerpo.boletin);
        if (!idValido(b.id)) return json({ error: "Boletín no válido" }, 400);
        const ant = await leerBoletin(s, b.id);
        if (ant ? cuerpo.etag !== ant.etag : !!cuerpo.etag) return json({ error: "conflicto", que: b.id }, 409);
        // El estado (borrador / pendiente / aprobado) solo cambia con «Enviar» y «Aprobar»
        ESTADO.forEach(k => { delete b[k]; if (ant && ant.b[k] !== undefined) b[k] = ant.b[k]; });
        if (!b.estado) b.estado = "borrador";
        if (!esAdmin(yo) && b.estado === "aprobado") { b.estado = "borrador"; delete b.aprobadoPor; delete b.aprobadoEl; }
        Object.assign(resp.mapa || (resp.mapa = {}), await sacarImagenes(s, b));
        const r = await s.setJSON("b/" + b.id, b, ant ? { onlyIfMatch: ant.etag } : { onlyIfNew: true });
        if (!r.modified) return json({ error: "conflicto", que: b.id }, 409);
        Object.assign(resp, { etag: r.etag, estado: b.estado, sinPublicar: await sinPublicar(s, b) });
      }
      return json(resp);
    }

    /* ---------- enviar a aprobación ---------- */
    if (accion === "enviar" || accion === "aprobar") {
      if (accion === "aprobar" && !esAdmin(yo)) return json({ error: "Solo los administradores pueden aprobar." }, 403);
      const ant = idValido(cuerpo.id) && await leerBoletin(s, cuerpo.id);
      if (!ant) return json({ error: "No existe ese boletín." }, 404);
      const b = ant.b;
      if (accion === "enviar") {
        b.estado = "pendiente"; delete b.aprobadoPor; delete b.aprobadoEl;
        b.enviadoPor = yo.nombre || ""; b.enviadoEl = hoy();
      } else {
        b.estado = "aprobado"; b.aprobadoPor = yo.nombre || ""; b.aprobadoEl = hoy();
        if (!b.fraseMes) { // el boletín se queda con la frase del mes en que se publica
          const c = (await s.get("cfg", { type: "json" })) || {};
          if (c.fraseMes) { b.fraseMes = c.fraseMes; b.fraseMesAutor = c.fraseMesAutor || ""; }
        }
      }
      const r = await s.setJSON("b/" + b.id, b, { onlyIfMatch: ant.etag });
      if (!r.modified) return json({ error: "conflicto", que: b.id }, 409);
      if (accion === "aprobar") {
        await s.setJSON("pub/" + b.id, b);
        const cfg = await s.get("cfg", { type: "json" });
        if (cfg) await s.setJSON("pubcfg", cfg);
      }
      return json({ etag: r.etag, boletin: b });
    }

    /* ---------- eliminar un boletín ---------- */
    if (accion === "borrar") {
      if (!idValido(cuerpo.id)) return json({ error: "Boletín no válido" }, 400);
      const ant = await leerBoletin(s, cuerpo.id);
      const pub = await s.get("pub/" + cuerpo.id);
      if ((pub !== null || (ant && ant.b.estado === "aprobado")) && !esAdmin(yo))
        return json({ error: "Este boletín está publicado: solo un administrador puede eliminarlo." }, 403);
      await s.delete("b/" + cuerpo.id); await s.delete("pub/" + cuerpo.id);
      return json({ ok: true });
    }

    /* ---------- tarjeta para X y vista previa de enlaces (la genera el editor al aprobar) ---------- */
    if (accion === "tarjeta") {
      if (!esAdmin(yo)) return json({ error: "Solo para administradores." }, 403);
      const img = String(cuerpo.imagen || "");
      if (!idValido(cuerpo.id) || !/^data:image\/jpeg;base64,/.test(img) || img.length > 3e6) return json({ error: "Imagen no válida" }, 400);
      const ant = await leerBoletin(s, cuerpo.id);
      if (!ant) return json({ error: "No existe ese boletín." }, 404);
      const o = { imagen: img }; await sacarImagenes(s, o);
      const b = ant.b; b.tarjeta = o.imagen;
      const r = await s.setJSON("b/" + b.id, b, { onlyIfMatch: ant.etag });
      if (!r.modified) return json({ error: "conflicto", que: b.id }, 409);
      const pub = await s.get("pub/" + b.id, { type: "json" });
      if (pub) { pub.tarjeta = o.imagen; await s.setJSON("pub/" + b.id, pub); }
      return json({ etag: r.etag, tarjeta: o.imagen });
    }

    /* ---------- a partir de aquí, solo administradores ---------- */
    if (!esAdmin(yo)) return json({ error: "Solo para administradores." }, 403);
    if (accion.startsWith("com-")) {
      const r = await accionComunicaciones(accion, s, cuerpo, yo, req);
      if (r) return r;
    }
    const usuarios = (await s.get("usuarios", { type: "json" })) || [];

    if (accion === "usuarios") return json({ usuarios: usuarios.map(publico), yo: yo.id });
    if (accion === "usuario-nuevo") {
      const c = String(cuerpo.correo || "").trim(), k = String(cuerpo.clave || "").trim();
      if (!correoValido(c)) return json({ error: "Escribe un correo válido." }, 400);
      if (k.length < 8) return json({ error: "La contraseña provisional necesita al menos 8 caracteres." }, 400);
      if (usuarios.some(u => u.id === huellaCorreo(c))) return json({ error: "Ese correo ya tiene acceso." }, 400);
      usuarios.push({ id: huellaCorreo(c), clave: cifrarClave(k), cambiar: true, rol: rolValido(cuerpo.rol), nombre: enmascarar(c) });
      await s.setJSON("usuarios", usuarios);
      return json({ usuarios: usuarios.map(publico), yo: yo.id });
    }
    if (accion === "usuario-baja") {
      const u = usuarios.find(x => x.id === cuerpo.id);
      if (!u) return json({ error: "No existe ese usuario." }, 404);
      if (u.id === yo.id) return json({ error: "No puedes darte de baja a ti misma." }, 400);
      if (u.rol === "admin" && usuarios.filter(x => x.rol === "admin").length === 1) return json({ error: "Tiene que quedar al menos un administrador." }, 400);
      const quedan = usuarios.filter(x => x.id !== u.id);
      await s.setJSON("usuarios", quedan);
      return json({ usuarios: quedan.map(publico), yo: yo.id });
    }
    if (accion === "usuario-rol") {
      const u = usuarios.find(x => x.id === cuerpo.id);
      if (!u) return json({ error: "No existe ese usuario." }, 404);
      const rol = rolValido(cuerpo.rol);
      if (u.rol === "admin" && rol !== "admin" && usuarios.filter(x => x.rol === "admin").length === 1) return json({ error: "Tiene que quedar al menos un administrador." }, 400);
      u.rol = rol; await s.setJSON("usuarios", usuarios);
      return json({ usuarios: usuarios.map(publico), yo: yo.id });
    }
    if (accion === "usuario-reset") {
      const u = usuarios.find(x => x.id === cuerpo.id);
      if (!u) return json({ error: "No existe ese usuario." }, 404);
      if (huellaCorreo(cuerpo.correo || "") !== u.id) return json({ error: "Ese correo no corresponde a este usuario." }, 400);
      if (String(cuerpo.clave || "").length < 8) return json({ error: "La contraseña provisional necesita al menos 8 caracteres." }, 400);
      u.clave = cifrarClave(String(cuerpo.clave)); u.cambiar = true;
      await s.setJSON("usuarios", usuarios);
      return json({ usuarios: usuarios.map(publico), yo: yo.id });
    }
    if (accion === "suscriptores") {
      const { blobs } = await s.list({ prefix: "sus/" });
      const lista = [];
      const origen = new URL(req.url).origin;
      for (const { key } of blobs) { const d = await s.get(key, { type: "json" }); if (d) lista.push({ clave: key.slice(4), ...d, enlaceBaja: enlaceBaja(origen, d.email) }); }
      lista.sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
      const bajas = [];
      for (const { key } of (await s.list({ prefix: "bajas/" })).blobs) { const d = await s.get(key, { type: "json" }); if (d) bajas.push(d); }
      bajas.sort((a, b) => String(b.baja).localeCompare(String(a.baja)));
      return json({ suscriptores: lista, bajas });
    }
    if (accion === "suscriptor-baja") {
      if (!/^[0-9a-f]{32}$/.test(cuerpo.clave || "")) return json({ error: "No válido" }, 400);
      const d = await s.get("sus/" + cuerpo.clave, { type: "json" });
      if (d) await darDeBaja(s, d.email, "administrador (" + (yo.nombre || "") + ")");
      return json({ ok: true });
    }

    return json({ error: "No existe" }, 404);
  } catch (e) {
    console.error(e);
    return json({ error: "Error del servidor: " + e.message }, 500);
  }
};
