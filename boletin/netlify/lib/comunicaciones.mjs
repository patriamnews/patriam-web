/* Comunicaciones personalizadas («Buenos días, Nombre: …» + firma) por correo (Brevo) y WhatsApp (API de WhatsApp Cloud).
   Solo administradores. Todo queda en el almacén privado (clave «com»): nunca se publica en la web.

   Variables de Netlify:
   - BREVO_API_KEY           clave de la API de Brevo (para los correos)
   - WHATSAPP_TOKEN          token permanente de la app de Meta (WhatsApp Cloud API)
   - WHATSAPP_PHONE_ID       identificador del número de teléfono de WhatsApp Business
   - WHATSAPP_PLANTILLA      (opcional) nombre de la plantilla aprobada; por defecto «comunicacion_patriam»
   - WHATSAPP_IDIOMA         (opcional) idioma de la plantilla; por defecto «es»
*/
import { json, sacarImagenes, enlaceBaja, claveCorreo } from "./comun.mjs";

const env = k => (globalThis.Netlify ? Netlify.env.get(k) : process.env[k]) || "";
const correoValido = c => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(c || "").trim());
const escHtml = t => String(t == null ? "" : t).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* Móvil a formato internacional sin «+» (34600111222). Los de 9 cifras se entienden españoles. */
export function movilInternacional(m) {
  let d = String(m || "").trim();
  const mas = d.startsWith("+");
  d = d.replace(/\D/g, "");
  if (!mas && d.startsWith("00")) d = d.slice(2);
  if (!mas && d.length === 9 && /^[67]/.test(d)) d = "34" + d;
  return d.length >= 10 && d.length <= 15 ? d : "";
}

const VACIO = () => ({
  ajustes: {
    remitenteNombre: "PATRIAM", remitente: "comunicacion@movimientopatriam.es", responderA: "hola@movimientopatriam.com",
    saludo: "Buenos días", firmaImagen: "", firmaTexto: "", soloNombre: true
  },
  contactos: [], lista: []
});

async function leer(s) {
  const r = await s.getWithMetadata("com", { type: "json" });
  if (!r) return { data: VACIO(), etag: null };
  const d = Object.assign(VACIO(), r.data);
  d.ajustes = Object.assign(VACIO().ajustes, r.data.ajustes || {});
  return { data: d, etag: r.etag };
}
/* Guarda aplicando un cambio sobre lo último que haya (por si dos personas tocan a la vez) */
async function cambiar(s, fn) {
  for (let i = 0; i < 5; i++) {
    const { data, etag } = await leer(s);
    fn(data);
    const r = await s.setJSON("com", data, etag ? { onlyIfMatch: etag } : { onlyIfNew: true });
    if (r.modified) return { data, etag: r.etag };
  }
  throw new Error("No se ha podido guardar (demasiados cambios a la vez). Inténtalo otra vez.");
}

function estadoServicios() {
  return {
    correo: !!env("BREVO_API_KEY"),
    whatsapp: !!(env("WHATSAPP_TOKEN") && env("WHATSAPP_PHONE_ID")),
    plantilla: env("WHATSAPP_PLANTILLA") || "comunicacion_patriam"
  };
}

/* ---------- envío de un correo por Brevo ---------- */
async function enviarCorreo(aj, para, asunto, html, texto) {
  const r = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": env("BREVO_API_KEY"), "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      sender: { name: aj.remitenteNombre || "PATRIAM", email: aj.remitente },
      replyTo: correoValido(aj.responderA) ? { email: aj.responderA } : undefined,
      to: [{ email: para.email, name: para.nombre || undefined }],
      subject: asunto, htmlContent: html, textContent: texto,
      headers: para.baja ? { "List-Unsubscribe": "<" + para.baja + ">" } : undefined,
      tags: ["comunicacion"]
    })
  });
  if (r.ok) return { ok: true };
  const d = await r.json().catch(() => ({}));
  return { ok: false, motivo: d.message || ("Brevo respondió " + r.status) };
}

/* ---------- envío de un WhatsApp con la plantilla aprobada ---------- */
/* La plantilla tiene dos huecos: {{1}} = el nombre y {{2}} = el texto (WhatsApp no deja saltos de línea dentro de un hueco). */
async function enviarWhatsapp(movil, nombre, texto) {
  const cuerpo = String(texto || "").replace(/\r/g, "").split(/\n\s*\n/).map(p => p.replace(/\s*\n\s*/g, " ").trim()).filter(Boolean).join(" — ")
    .replace(/\t/g, " ").replace(/ {4,}/g, "   ").slice(0, 1000);
  const r = await fetch("https://graph.facebook.com/v21.0/" + encodeURIComponent(env("WHATSAPP_PHONE_ID")) + "/messages", {
    method: "POST",
    headers: { Authorization: "Bearer " + env("WHATSAPP_TOKEN"), "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp", to: movil, type: "template",
      template: {
        name: env("WHATSAPP_PLANTILLA") || "comunicacion_patriam",
        language: { code: env("WHATSAPP_IDIOMA") || "es" },
        components: [{ type: "body", parameters: [{ type: "text", text: nombre || "amigo" }, { type: "text", text: cuerpo || "." }] }]
      }
    })
  });
  if (r.ok) return { ok: true };
  const d = await r.json().catch(() => ({}));
  return { ok: false, motivo: (d.error && (d.error.error_data && d.error.error_data.details || d.error.message)) || ("WhatsApp respondió " + r.status) };
}

/* ---------- acciones (llamadas desde api.mjs, ya comprobado que es administrador) ---------- */
export async function accionComunicaciones(accion, s, cuerpo, yo, req) {
  if (accion === "com-datos") {
    const { data, etag } = await leer(s);
    return json({ com: data, etag, servicios: estadoServicios() });
  }

  if (accion === "com-guardar") {
    const ant = await leer(s);
    if (ant.etag && cuerpo.etag !== ant.etag) return json({ error: "conflicto", que: "com" }, 409);
    const nuevo = cuerpo.com || {};
    const d = VACIO();
    d.ajustes = Object.assign(d.ajustes, nuevo.ajustes || {});
    d.contactos = (nuevo.contactos || []).slice(0, 5000).map(c => ({
      id: String(c.id || "").slice(0, 40), nombre: String(c.nombre || "").slice(0, 120),
      email: String(c.email || "").trim().toLowerCase().slice(0, 160), movil: String(c.movil || "").slice(0, 40), nota: String(c.nota || "").slice(0, 120)
    }));
    // Lo que ya se ha enviado no lo puede cambiar el editor: se conserva lo del servidor
    const antes = new Map(ant.data.lista.map(x => [x.id, x]));
    d.lista = (nuevo.lista || []).slice(0, 500).map(x => {
      const p = antes.get(x.id) || {};
      return Object.assign({}, x, { envios: p.envios || [], enviados: p.enviados || { correo: [], whatsapp: [] }, estado: p.estado === "enviado" ? "enviado" : (x.estado || "borrador") });
    });
    const mapa = await sacarImagenes(s, d);
    const r = await s.setJSON("com", d, ant.etag ? { onlyIfMatch: ant.etag } : { onlyIfNew: true });
    if (!r.modified) return json({ error: "conflicto", que: "com" }, 409);
    return json({ etag: r.etag, mapa });
  }

  if (accion === "com-enviar") {
    const canal = cuerpo.canal;
    if (!["correo", "whatsapp"].includes(canal)) return json({ error: "Canal no válido" }, 400);
    const sv = estadoServicios();
    if (canal === "correo" && !sv.correo) return json({ error: "Falta la clave de Brevo (BREVO_API_KEY) en Netlify." }, 400);
    if (canal === "whatsapp" && !sv.whatsapp) return json({ error: "Falta conectar la API de WhatsApp (WHATSAPP_TOKEN y WHATSAPP_PHONE_ID en Netlify)." }, 400);
    const { data } = await leer(s);
    const com = data.lista.find(x => x.id === cuerpo.id);
    if (!com) return json({ error: "No existe esa comunicación. Espera a que ponga «Guardado ✓» y vuelve a intentarlo." }, 404);
    if (canal === "correo" && !correoValido(data.ajustes.remitente)) return json({ error: "Falta el correo del remitente en Ajustes." }, 400);
    const para = (cuerpo.para || []).slice(0, 25);
    const html = String(cuerpo.html || ""), texto = String(cuerpo.texto || ""), asunto = String(com.asunto || "").slice(0, 200);
    if (canal === "correo" && (!asunto || !html)) return json({ error: "Falta el asunto o el texto." }, 400);
    const origen = "https://" + (req.headers.get("x-forwarded-host") || new URL(req.url).host);

    const resultados = [];
    for (const p of para) {
      const nombre = String(p.nombre || "").trim().slice(0, 80);
      try {
        if (canal === "correo") {
          const email = String(p.email || "").trim().toLowerCase();
          if (!correoValido(email)) { resultados.push({ id: p.id, ok: false, motivo: "Correo no válido" }); continue; }
          // Si está apuntado al boletín, su correo lleva el enlace para darse de baja
          const apuntado = await s.get("sus/" + claveCorreo(email));
          const baja = apuntado !== null ? enlaceBaja(origen, email) : "";
          const pon = t => (nombre ? t : t.split(", %%NOMBRE%%").join("")).split("%%NOMBRE%%").join(escHtml(nombre)).split("%%BAJA%%").join(escHtml(baja));
          const htmlP = pon(baja ? html : html.replace(/<!--BAJA-->[\s\S]*?<!--\/BAJA-->/g, ""));
          const textoP = (nombre ? texto : texto.split(", %%NOMBRE%%").join("")).split("%%NOMBRE%%").join(nombre) + (baja ? "\n\nPara dejar de recibir correos: " + baja : "");
          const r = await enviarCorreo(data.ajustes, { email, nombre, baja }, asunto, htmlP, textoP);
          resultados.push(Object.assign({ id: p.id, clave: email }, r));
        } else {
          const movil = movilInternacional(p.movil);
          if (!movil) { resultados.push({ id: p.id, ok: false, motivo: "Móvil no válido" }); continue; }
          const r = await enviarWhatsapp(movil, nombre, cuerpo.textoWa || "");
          resultados.push(Object.assign({ id: p.id, clave: movil }, r));
        }
      } catch (e) { resultados.push({ id: p.id, ok: false, motivo: e.message }); }
    }

    // Se anota quién lo ha enviado, cuándo y a quién (para no repetir)
    const ok = resultados.filter(r => r.ok), mal = resultados.filter(r => !r.ok);
    const g = await cambiar(s, d => {
      const x = d.lista.find(y => y.id === com.id);
      if (!x) return;
      x.enviados = x.enviados || { correo: [], whatsapp: [] };
      const ya = new Set(x.enviados[canal] || []);
      ok.forEach(r => ya.add(r.clave));
      x.enviados[canal] = [...ya];
      x.envios = (x.envios || []).concat([{ fecha: new Date().toISOString(), canal, por: yo.nombre || "", ok: ok.length,
        errores: mal.map(r => ({ id: r.id, motivo: String(r.motivo || "").slice(0, 200) })) }]).slice(-200);
      x.estado = "enviado";
    });
    const x = g.data.lista.find(y => y.id === com.id) || {};
    return json({ resultados, etag: g.etag, enviados: x.enviados, envios: x.envios });
  }

  return null;
}
