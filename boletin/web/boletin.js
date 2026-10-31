/* PATRIAM · Plantilla del boletín (la usan index.html y editor.html).
   Portada = boletín de la semana. Menú = archivo por secciones.
   No hace falta tocar este archivo para crear boletines. */

/* ---------- utilidades ---------- */
function esc(t) {
  return String(t == null ? "" : t).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function parrafos(t) {
  return String(t || "").split(/\n\s*\n/).map(p => p.trim()).filter(Boolean)
    .map(p => "<p>" + esc(p).replace(/\n/g, "<br>") + "</p>").join("");
}
function fechaLarga(f) {
  if (!f) return "";
  const d = new Date(f + "T12:00:00");
  if (isNaN(d)) return f;
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
}
function urlSegura(u) {
  u = String(u || "").trim();
  return /^(https?:|mailto:|data:image\/)/i.test(u) || /^[\w\-./#]+$/.test(u) ? u : "";
}
function dosCifras(n) { n = String(n || ""); return n.length === 1 ? "0" + n : n; }
function primerParrafo(t) { return (String(t || "").split(/\n\s*\n/).map(p => p.trim()).filter(Boolean)[0]) || ""; }
function recortar(t, n) { t = String(t || ""); return t.length > n ? t.slice(0, n).replace(/\s+\S*$/, "") + "…" : t; }
function sinAcentos(t) { return String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""); }
function hoyISO() { return new Date().toISOString().slice(0, 10); }
function ordenar(lista) {
  return (lista || []).slice().sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)) || (b.numero || 0) - (a.numero || 0));
}
function irA(id) { const el = document.getElementById(id); if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); return false; }
function buscarDesde(input) { const q = input.value.trim(); if (q) location.hash = "#/buscar/" + encodeURIComponent(q); return false; }

/* Maquetación sencilla para textos largos:
   ## Subtítulo   > Cita destacada   **negrita**   *cursiva*   [texto](https://enlace)   línea en blanco = párrafo nuevo */
function enLinea(t) {
  return esc(t)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, txt, url) => {
      const u = urlSegura(url.replace(/&amp;/g, "&"));
      if (!u) return txt;
      return u.startsWith("#") ? '<a href="' + esc(u) + '">' + txt + "</a>" : '<a href="' + esc(u) + '" target="_blank" rel="noopener">' + txt + "</a>";
    });
}
function maquetar(t) {
  return String(t || "").split(/\n\s*\n/).map(b => b.trim()).filter(Boolean).map(b => {
    if (/^##\s+/.test(b)) return "<h2>" + enLinea(b.replace(/^##\s+/, "")) + "</h2>";
    if (/^>\s?/.test(b)) return "<blockquote>" + enLinea(b.replace(/^>\s?/gm, "")).replace(/\n/g, "<br>") + "</blockquote>";
    if (/^-\s+/.test(b)) return "<ul>" + b.split(/\n/).map(l => "<li>" + enLinea(l.replace(/^-\s+/, "")) + "</li>").join("") + "</ul>";
    return "<p>" + enLinea(b).replace(/\n/g, "<br>") + "</p>";
  }).join("");
}
function parrafosRicos(t) {
  return String(t || "").split(/\n\s*\n/).map(p => p.trim()).filter(Boolean).map(p => "<p>" + enLinea(p).replace(/\n/g, "<br>") + "</p>").join("");
}
function textoPlano(t) { return String(t || "").replace(/^##\s+|^>\s?/gm, "").replace(/\*\*|\*/g, "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1"); }

/* ---------- lema: siempre «Dios · Patria · Justicia» (sin «Familia», aunque esté guardado así) ---------- */
function lemaDe(cfg) {
  const partes = String((cfg && cfg.lema) || "Dios · Patria · Justicia").split(/\s*[·•|]\s*/).map(x => x.trim()).filter(x => x && !/^familia$/i.test(x));
  return partes.length ? partes.join(" · ") : "Dios · Patria · Justicia";
}

/* ---------- secciones ---------- */
const SECCIONES = [
  { clave: "actualidad", nombre: "Actualidad", menu: "Actualidad", ruta: "noticias", texto: "Las noticias de la semana, con el comentario de nuestro editor." },
  { clave: "historia", nombre: "Historia", menu: "Historia", ruta: "historia", texto: "Episodios, personas y lugares que forjaron nuestra identidad." },
  { clave: "sociedad", nombre: "Sociedad", menu: "Sociedad", ruta: "sociedad", texto: "Cómo vivimos y cómo vivíamos: costumbres, familia, pueblos y la España de antes y de ahora." },
  { clave: "analisis", nombre: "Análisis", menu: "Análisis", ruta: "analisis", texto: "Reflexión rigurosa para un debate necesario." }
];
function claveSeccion(n) { const s = sinAcentos(n.seccion || "Actualidad"); return SECCIONES.find(x => x.clave === s) ? s : "actualidad"; }
function seccionDe(n) { return SECCIONES.find(x => x.clave === claveSeccion(n)); }
/* Podcasts y libros tienen su propia página, vengan de la biblioteca o de una noticia */
const ES_PODCAST = t => /podcast|v[ií]deo|documental/i.test(t || "");
const ES_LIBRO = t => /libro/i.test(t || "");

const ICONOS = {
  editorial: '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M10 12h6M10 15.5h6M10 19h4"/>',
  noticias: '<rect x="3" y="5" width="18" height="14" rx="1.5"/><path d="M6.5 9h5v4h-5zM14 9h4M14 12h4M6.5 16h11.5"/>',
  historia: '<path d="M12 6.5C10 5 6.5 4.5 3 5v13.5c3.5-.5 7 0 9 1.5 2-1.5 5.5-2 9-1.5V5c-3.5-.5-7 0-9 1.5zM12 6.5V20"/>',
  analisis: '<path d="M3 20h18M4.5 9.5h15M12 4l8 4.5H4zM6.5 9.5v8M10 9.5v8M14 9.5v8M17.5 9.5v8"/>',
  iniciativas: '<circle cx="12" cy="8" r="3"/><path d="M6.5 19.5a5.5 5.5 0 0 1 11 0"/><circle cx="5.5" cy="10" r="2.2"/><circle cx="18.5" cy="10" r="2.2"/><path d="M2 18a3.6 3.6 0 0 1 4-3.2M22 18a3.6 3.6 0 0 0-4-3.2"/>',
  correo: '<rect x="3" y="5.5" width="18" height="13" rx="1.5"/><path d="m3.5 6.5 8.5 6.5 8.5-6.5"/>',
  x: '<path d="M4 4l16 16M20 4 4 20" stroke-width="1.8"/>',
  instagram: '<rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r=".6" fill="currentColor"/>',
  buscar: '<circle cx="10.5" cy="10.5" r="6"/><path d="m15 15 5 5"/>',
  flecha: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  inicio: '<path d="M4 5h13v14H6a2 2 0 0 1-2-2z"/><path d="M17 8h3v9a2 2 0 0 1-2 2h-1M7 8.5h7M7 11.5h7M7 14.5h4"/>',
  facebook: '<path d="M14 8.5h2.5V5H14a3.5 3.5 0 0 0-3.5 3.5V11H8v3.5h2.5V21H14v-6.5h2.5L17 11h-3V8.5z"/>',
  tiktok: '<path d="M14 3v11.5a3.5 3.5 0 1 1-3.5-3.5"/><path d="M14 3c.5 2.8 2.3 4.5 5 4.8"/>',
  youtube: '<rect x="2.5" y="5.5" width="19" height="13" rx="3.5"/><path d="m10 9 5 3-5 3z" fill="currentColor"/>',
  telegram: '<path d="M21 4 3 11l6 2.2L19 7l-8 7.5.3 5.5 3-3.6 4.2 3.1z"/>',
  boletines: '<rect x="3.5" y="4" width="17" height="4" rx="1"/><path d="M5 8v11h14V8M10 12h4"/>',
  enlace: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  whatsapp: '<path d="M4 20l1.3-4A8 8 0 1 1 8.4 19z"/><path d="M9.2 8.6c.2 2.6 2.6 5 5.2 5.2l1.1-1.2-1.6-.9-.8.7c-.9-.4-1.9-1.4-2.3-2.3l.7-.8-.9-1.6z"/>',
  sociedad: '<path d="M3.5 20V10l8.5-6 8.5 6v10"/><path d="M9.5 20v-5.5h5V20M3 20h18"/>',
  podcasts: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7"/>',
  tienda: '<path d="M5 8h14l-1.2 12H6.2z"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8"/>',
  libros: '<path d="M4 4h4v16H4zM9.5 4h4v16h-4z"/><path d="m15 5.2 3.8-1 3.2 15.6-3.8 1z"/>',
  colaboraciones: '<path d="M4 20l1.2-4.6L15.8 4.8a2 2 0 0 1 2.9 0l.5.5a2 2 0 0 1 0 2.9L8.6 18.8z"/><path d="M13.8 6.8l3.4 3.4M4 20h7"/>'
};
function icono(n, cls) { return '<svg class="ico ' + (cls || "") + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICONOS[n] + "</svg>"; }

/* ---------- datos para el archivo ---------- */
function todasNoticias(lista, clave) {
  const r = [];
  ordenar(lista).forEach(b => (b.noticias || []).filter(n => n.titular || n.url).forEach(n => { if (!clave || claveSeccion(n) === clave) r.push({ n, b }); }));
  return r;
}
function todasEditoriales(lista) {
  return ordenar(lista).filter(b => b.editorial && (b.editorial.titulo || b.editorial.texto)).map(b => ({ ed: b.editorial, b }));
}
function notaColab(cfg) { return cfg && cfg.notaColaboradores ? '<p class="bol-nota-colab">' + esc(cfg.notaColaboradores) + "</p>" : ""; }
function todasColaboraciones(lista) {
  const r = [];
  ordenar(lista).forEach(b => (b.colaboraciones || []).filter(c => c.titulo).forEach(c => r.push({ c, b })));
  return r;
}
function enlaceColaboracion(c) { return "#/colaboracion/" + encodeURIComponent(c.id); }
function tarjetaColaboracion(c, b) {
  const img = urlSegura(c.imagen);
  return '<a class="bol-colab" href="' + enlaceColaboracion(c) + '">' +
    '<div class="bol-colab-img"' + (img ? ' style="background-image:url(\'' + esc(img) + '\')"' : "") + ">" + (img ? "" : icono("colaboraciones", "grande")) + "</div>" +
    '<div class="bol-colab-txt"><div class="bol-etiqueta"><span>Firma invitada</span>' + (b ? "<em>" + esc(fechaLarga(b.fecha)) + "</em>" : "") + "</div>" +
    "<h3>" + esc(c.titulo) + "</h3>" + (c.entradilla ? "<p>" + esc(recortar(c.entradilla, 150)) + "</p>" : "<p>" + esc(recortar(textoPlano(primerParrafo(c.texto)), 150)) + "</p>") +
    '<span class="bol-colab-autor"><span class="bol-avatar">' + esc((c.autor || "?").charAt(0).toUpperCase()) + "</span><span><b>" + esc(c.autor || "") + "</b>" + (c.cargo ? "<small>" + esc(c.cargo) + "</small>" : "") + "</span></span></div></a>";
}
/* Sección de una firma: la que tenga marcada; si no tiene, Actualidad */
function claveColab(c) { const k = sinAcentos(c.seccion || ""); return SECCIONES.some(x => x.clave === k) ? k : "actualidad"; }
/* Fichas de los colaboradores («quién es quién»): vienen de importar.js (PATRIAM_COLABORADORES) o de los ajustes */
function fichasColaboradores(cfg) {
  return ((typeof window !== "undefined" && window.PATRIAM_COLABORADORES) || []).concat((cfg && cfg.colaboradores) || []);
}
function paginaColaboraciones(lista, cfg) {
  const cs = todasColaboraciones(lista), fichas = fichasColaboradores(cfg);
  const autores = [...new Set(cs.map(({ c }) => (c.autor || "").trim()).filter(Boolean))];
  fichas.forEach(f => { if (f.firma && !autores.includes(f.firma)) autores.push(f.firma); });
  let h = '<div class="bol-pagina">' + cabPagina("Colaboraciones y quién es quién", "Quiénes escriben en el boletín y todo lo que han firmado.", cs.length) + notaColab(cfg);
  if (autores.length) {
    h += '<div class="pt-rotulo"><span>Quién es quién</span></div><div class="qeq">';
    autores.forEach(a => {
      const f = fichas.find(x => x.firma === a) || {};
      const suyos = cs.filter(({ c }) => (c.autor || "").trim() === a);
      const cargo = f.cargo || (suyos.find(({ c }) => c.cargo) || { c: {} }).c.cargo || "";
      const foto = urlSegura(f.foto);
      h += '<article class="qeq-ficha" id="quien-' + esc(sinAcentos(a).replace(/[^a-z0-9]+/g, "-")) + '">' +
        (foto ? '<img class="qeq-foto" src="' + esc(foto) + '" alt="">' : '<span class="bol-avatar qeq-avatar">' + esc(a.charAt(0).toUpperCase()) + "</span>") +
        '<div><h3>' + esc(a) + "</h3>" + (cargo ? "<small>" + esc(cargo) + "</small>" : "") +
        (f.bio ? parrafosRicos(f.bio) : '<p class="qeq-pend">Pronto, su presentación.</p>') +
        (suyos.length ? '<ul class="pt-mas">' + suyos.map(({ c }) => '<li><a href="' + enlaceColaboracion(c) + '">' + esc(c.titulo) + "</a><small>" + esc((SECCIONES.find(x => x.clave === claveColab(c)) || {}).nombre || "") + "</small></li>").join("") + "</ul>" : "") +
        "</div></article>";
    });
    h += "</div>";
  }
  h += '<div class="pt-rotulo"><span>Todas las colaboraciones</span></div>';
  return h + (cs.length ? '<div class="bol-colab-rejilla">' + cs.map(({ c, b }) => tarjetaColaboracion(c, b)).join("") + "</div>" : '<p class="bol-vacio">Todavía no hay colaboraciones.</p>') + "</div>";
}
/* Para que cada lector lo comparta en SU propio WhatsApp, X, Facebook o Instagram */
function enlaceParaCompartir(cfg, destino) {
  const base = typeof location !== "undefined" && /^https?:$/.test(location.protocol) ? location.origin + "/" : String(cfg.direccion || "").replace(/\/?$/, "/");
  const am = ((cfg && cfg.alMomento) || []).find(x => x.estado === "aprobado" && x.destino === destino && x.slug);
  return am ? base + "a/" + encodeURIComponent(am.slug) : base + destino;   // el de «Al momento» lleva su propia imagen
}
/* Estadísticas: lo que comparte un lector lleva su código (?c=…), para saber cuánta gente entra por cada reenvío.
   Solo en la web publicada (en el editor no hay código y el enlace queda igual). */
function conCodigo(u) {
  const c = typeof window !== "undefined" && window.__codigoLector;
  u = String(u || "");
  if (!c || !/^https?:/i.test(u)) return u;
  const [antes, hash] = u.split("#");
  return antes + (antes.includes("?") ? "&" : "?") + "c=" + c + (hash !== undefined ? "#" + hash : "");
}
function barraLector(rotulo, titulo, url) {
  const t = String(titulo || ""), u = conCodigo(url);
  return '<div class="bol-compartir bol-compartir-lector"><span>' + esc(rotulo) + "</span><div>" +
    '<a class="bol-comp wa" href="https://wa.me/?text=' + encodeURIComponent(t + "\n" + u) + '" target="_blank" rel="noopener">' + icono("whatsapp") + "WhatsApp</a>" +
    '<a class="bol-comp xx" href="https://x.com/intent/post?text=' + encodeURIComponent(t) + "&url=" + encodeURIComponent(u) + '" target="_blank" rel="noopener">' + icono("x") + "X</a>" +
    '<a class="bol-comp fb" href="https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(u) + '" target="_blank" rel="noopener">' + icono("facebook") + "Facebook</a>" +
    '<button type="button" class="bol-comp ig" data-t="' + esc(t) + '" data-u="' + esc(u) + '" onclick="compartirInstagram(this)">' + icono("instagram") + "Instagram</button>" +
    '<button type="button" class="bol-comp en" onclick="copiarEnlace(this,\'' + esc(u) + '\')">' + icono("enlace") + "Copiar enlace</button></div></div>";
}
function compartirInstagram(boton) {
  const t = boton.dataset.t, u = boton.dataset.u;
  if (navigator.share) { navigator.share({ title: t, text: t, url: u }).catch(() => {}); return; }   // en el móvil: se elige Instagram en el menú
  const texto = t + "\n" + u;
  (navigator.clipboard ? navigator.clipboard.writeText(texto) : Promise.reject()).catch(() => {});
  alert("Instagram no deja publicar desde el ordenador con un enlace. Hemos copiado el título y el enlace: ábrelo en el móvil o pégalo en tu historia (con el sticker «Enlace»).");
}

function paginaColaboracion(lista, id, cfg) {
  const cs = todasColaboraciones(lista), x = cs.find(y => y.c.id === id);
  if (!x) return '<div class="bol-pagina"><p class="bol-vacio">No se encuentra este texto. <a href="#/colaboraciones">Ver todas las colaboraciones</a></p></div>';
  const { c, b } = x, img = urlSegura(c.imagen);
  let h = '<div class="bol-pagina"><article class="bol-articulo">';
  h += '<a class="bol-volver" href="#/colaboraciones">← Todas las colaboraciones</a>';
  h += '<div class="bol-etiqueta"><span>Firma invitada</span><em>' + esc(fechaLarga(b.fecha)) + "</em></div>";
  h += "<h1>" + esc(c.titulo) + "</h1>";
  if (c.entradilla) h += '<p class="bol-entradilla">' + esc(c.entradilla) + "</p>";
  h += '<div class="bol-firma"><span class="bol-avatar">' + esc((c.autor || "?").charAt(0).toUpperCase()) + "</span><span><b>" + esc(c.autor || "") + "</b>" + (c.cargo ? "<small>" + esc(c.cargo) + "</small>" : "") + "</span></div>";
  if (img) h += '<img class="bol-articulo-img" src="' + esc(img) + '" alt="">';
  h += '<div class="bol-articulo-texto">' + maquetar(c.texto) + "</div>";
  if (c.bio) h += '<div class="bol-bio"><b>Sobre ' + esc(c.autor || "el autor") + "</b><p>" + esc(c.bio) + "</p></div>";
  h += barraLector("Compártelo en tus redes", c.titulo + (c.autor ? " — " + c.autor : ""), enlaceParaCompartir(cfg, "#/colaboracion/" + encodeURIComponent(c.id)));
  h += notaColab(cfg);
  h += '<div class="bol-articulo-pie"><a class="bol-btn claro" href="#/boletin/' + encodeURIComponent(b.id) + '">Ver el boletín de esa semana ' + icono("flecha") + "</a></div>";
  return h + "</article></div>";
}

function todosEventos(lista) {
  const vistos = {}, r = [];
  ordenar(lista).forEach(b => (b.eventos || []).filter(e => e.titulo).forEach(e => {
    const k = sinAcentos(e.titulo) + "|" + (e.fecha || "");
    if (!vistos[k]) { vistos[k] = 1; r.push(e); }
  }));
  const hoy = hoyISO();
  return {
    proximos: r.filter(e => !e.fecha || e.fecha >= hoy).sort((a, b) => (a.fecha || "9999").localeCompare(b.fecha || "9999")),
    pasados: r.filter(e => e.fecha && e.fecha < hoy).sort((a, b) => b.fecha.localeCompare(a.fecha))
  };
}

/* ---------- cabecera ---------- */
/* Frase del mes bajo «con criterio». Cada boletín guarda la que tenía al publicarse. */
function fraseMes(cfg, b) {
  const f = (b && b._frasePropia && b.fraseMes) ? { t: b.fraseMes, a: b.fraseMesAutor } : { t: cfg.fraseMes, a: cfg.fraseMesAutor };
  if (f.t && String(f.t).trim()) return '<div class="bol-mancheta-inf bol-frase-mes"><q>' + esc(String(f.t).trim().replace(/^["«“]+|["»”]+$/g, "")) + "</q>" +
    (f.a ? "<span>" + esc(f.a) + "</span>" : "") + "</div>";
  return cfg.secciones ? '<div class="bol-mancheta-inf">' + esc(cfg.secciones) + "</div>" : "";
}
function enlaceBoletin(b, cfg) { return String((cfg && cfg.direccion) || "https://boletin.movimientopatriam.es/").replace(/\/?$/, "/") + "boletin/" + encodeURIComponent(b.numero); }
function copiarEnlace(boton, url) {
  const t = boton.innerHTML, ok = () => { boton.textContent = "¡Enlace copiado!"; setTimeout(() => boton.innerHTML = t, 1600); };
  (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(ok).catch(() => prompt("Copia el enlace:", url));
}

function cabecera(cfg, b, activo) {
  cfg = cfg || {};
  const lema = lemaDe(cfg);
  const banner = urlSegura(cfg.banner);
  let h = '<header class="bol-cab"><div class="bol-cab-in">';

  // Panel del logo
  const webUrl = urlSegura(cfg.web) || "https://movimientopatriam.es/";
  const afiliaUrl = urlSegura(cfg.unete) || webUrl.replace(/\/?$/, "/") + "#/unete";
  h += '<div class="bol-panel"><a class="bol-panel-logo" href="#/"><img src="' + esc(cfg.logo || "logo.png") + '" alt="PATRIAM">' +
       '<span class="bol-lema">' + esc(lema) + '</span></a>' +
       '<span class="bol-panel-btns"><a class="bol-pbtn" href="' + esc(webUrl) + '" target="_blank" rel="noopener">Web</a>' +
       '<a class="bol-pbtn lleno" href="' + esc(afiliaUrl) + '" target="_blank" rel="noopener">Únete</a></span>' +
       '<span class="bol-orla"><i></i></span>';
  if (cfg.frase) h += '<span class="bol-frase">' + esc(cfg.frase).replace(/\n/g, "<br>") + "</span>";
  h += "</div>";

  // Imagen con la cabecera encima
  h += '<div class="bol-imagen"' + (banner ? ' style="--foto:url(\'' + esc(banner) + '\')"' : "") + ">";
  const nombre = cfg.cabecera || "Lo que hay que saber";
  h += '<div class="bol-mancheta"><div class="bol-mancheta-sup"><i></i>' + esc(cfg.subtitulo || "Boletín de noticias") + '<i></i></div>' +
       '<div class="bol-mancheta-nombre' + (nombre.length > 12 ? " largo" : "") + '">' + esc(nombre) + "</div>" +
       (cfg.claim ? '<div class="bol-claim"><i></i>' + esc(cfg.claim) + "<i></i></div>" : "") +
       fraseMes(cfg, b) + "</div>";
  if (b) h += '<a class="bol-numero" href="#/boletines" title="Ver todos los boletines"><span><small>Nº</small>' + esc(dosCifras(b.numero)) + "</span><em>" + esc(fechaLarga(b.fecha)) + "</em></a>";
  h += "</div></div></header>";

  // Menú
  const op = [["inicio", "#/", "Este boletín"], ["noticias", "#/noticias", "Actualidad"], ["historia", "#/historia", "Historia"],
              ["sociedad", "#/sociedad", "Sociedad"], ["criterio", "#/criterio", "Criterio"],
              ["iniciativas", "#/iniciativas", "Iniciativas"], ["boletines", "#/boletines", "Boletines"],
              ["tienda", (cfg && cfg.tienda) || "https://movimientopatriam.es/tienda", "Tienda"]];
  h += '<nav class="bol-menu" aria-label="Secciones del boletín"><div class="bol-menu-in">';
  const ICO_MENU = { criterio: "analisis" };
  op.forEach(o => h += '<a href="' + o[1] + '"' + (/^https?:/.test(o[1]) ? ' target="_blank" rel="noopener"' : "") + (o[0] === activo ? ' class="activo" aria-current="page"' : "") + ">" + icono(ICO_MENU[o[0]] || o[0]) + "<span>" + o[2] + "</span></a>");
  h += '<form class="bol-buscar" role="search" onsubmit="return buscarDesde(this.q)"><input name="q" type="search" placeholder="Buscar…" aria-label="Buscar en el boletín"><button aria-label="Buscar">' + icono("buscar") + "</button></form>";
  h += "</div></nav>";
  return h;
}

/* ---------- piezas ---------- */
function tituloDosTonos(t) {
  const p = String(t || "").trim().split(/\s+/);
  if (p.length < 3) return '<span class="tono2">' + esc(t) + "</span>";
  const corte = Math.ceil(p.length / 2);
  return esc(p.slice(0, corte).join(" ")) + '<br><span class="tono2">' + esc(p.slice(corte).join(" ")) + "</span>";
}

/* ---------- vídeos y podcasts de YouTube ---------- */
function idYoutube(u) {
  const m = String(u || "").match(/(?:youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/);
  return m ? m[1] : "";
}
function reproductorYoutube(yt, titulo, url) {
  // Abierto como archivo local (doble clic), YouTube no deja reproducir dentro (error 153): se muestra la miniatura con un botón
  if (typeof location !== "undefined" && location.protocol === "file:") {
    return '<a class="leer-video sin-embed" href="' + esc(url || "https://www.youtube.com/watch?v=" + yt) + '" target="_blank" rel="noopener" style="background-image:url(\'https://i.ytimg.com/vi/' + yt + '/hqdefault.jpg\')">' +
      '<span class="bol-play"><svg viewBox="0 0 24 24"><path d="M8 5.5v13l11-6.5z" fill="currentColor"/></svg></span><em>En la web publicada se ve aquí mismo. Ahora se abre en YouTube.</em></a>';
  }
  return '<div class="leer-video"><iframe src="https://www.youtube-nocookie.com/embed/' + yt + '?rel=0&modestbranding=1" title="' + esc(titulo || "Vídeo") +
    '" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe></div>';
}
function logoMedio(n, cfg) {
  const l = urlSegura(n.logoMedio) || urlSegura(((cfg && cfg.logos) || {})[String(n.medio || "").trim().toLowerCase()]);
  return l ? '<img class="medio-logo" src="' + esc(l) + '" alt="' + esc(n.medio || "") + '">' : "";
}
/* Si la noticia no tiene imagen (o no carga), se ve el logo del medio sobre fondo crema */
function urlLogoMedio(n, cfg, url) {
  const propio = urlSegura(n.logoMedio) || urlSegura(((cfg && cfg.logos) || {})[String(n.medio || "").trim().toLowerCase()]);
  if (propio) return propio;
  try { const host = new URL(url).hostname; return host ? "https://www.google.com/s2/favicons?domain=" + encodeURIComponent(host) + "&sz=128" : ""; } catch (e) { return ""; }
}
function sinFoto(n, cfg, sec, url) {
  const logo = url && !idYoutube(url) ? urlLogoMedio(n, cfg, url) : "";
  return '<div class="bol-sinfoto">' + (logo ? '<img class="sinfoto-logo" src="' + esc(logo) + '" alt="" onerror="this.remove()">' : icono(sec.ruta === "noticias" ? "noticias" : sec.clave)) +
    "<span>" + esc(n.medio || sec.nombre) + "</span></div>";
}
function autorComentario(n, cfg) { return n.comenta || (cfg && cfg.editor) || "LODLC"; }
function bloqueComentario(n, cfg) {
  if (!n.comentario) return "";
  const a = autorComentario(n, cfg);
  return '<div class="bol-comentario"><div class="bol-com-cab"><span class="bol-avatar">' + esc(a.charAt(0).toUpperCase()) + "</span><b>" + esc(a) + " opina</b></div>" + parrafosRicos(n.comentario) + "</div>";
}

function tarjetaNoticia(n, i, cfg, b, conBoletin, idAncla) {
  const url = urlSegura(n.url), yt = idYoutube(url), sec = seccionDe(n);
  const img = urlSegura(n.imagen) || (yt ? "https://i.ytimg.com/vi/" + yt + "/hqdefault.jpg" : "");
  const k = b ? (b.noticias || []).indexOf(n) : -1;
  // Las noticias se abren en su propia web (pestaña nueva): muchos periódicos rechazan mostrarse dentro de otra página.
  // Solo vídeos y podcasts de YouTube se ven dentro del boletín.
  const dentro = yt && k >= 0 ? "#/leer/" + encodeURIComponent(b.id) + "/" + k : "";
  const destino = dentro || url;
  const fuera = !dentro && url && !url.startsWith("#") ? ' target="_blank" rel="noopener"' : "";
  let h = '<article class="bol-tarjeta' + (yt ? " es-video" : "") + '"' + (idAncla ? ' id="' + idAncla + '"' : "") + ">";
  const play = '<span class="bol-play" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M8 5.5v13l11-6.5z" fill="currentColor"/></svg></span>';
  if (yt) {
    // Podcast o vídeo: sello «recomendado por PATRIAM» y debajo la imagen del vídeo entera (16:9)
    const tipo = (n.formato && n.formato !== "Noticia" ? n.formato : "Vídeo");
    h += '<a class="bol-foto bol-foto-pod" href="' + esc(destino || "#/") + '"' + fuera + ' tabindex="-1" aria-hidden="true">' +
         '<span class="pod-sello"><img src="' + esc((cfg && cfg.logoClaro) || "logo-claro.png") + '" alt=""><b>' + esc(tipo) + " recomendado</b><small>por PATRIAM</small></span>" +
         '<span class="pod-mini">' + (img ? '<img src="' + esc(img) + '" alt="" loading="lazy" onerror="this.remove()">' : "") + play + "</span>" +
         (i != null ? '<span class="bol-n">' + dosCifras(i + 1) + "</span>" : "") + "</a>";
  } else {
    h += '<a class="bol-foto" href="' + esc(destino || "#/") + '"' + fuera + ' tabindex="-1" aria-hidden="true">' +
         sinFoto(n, cfg, sec, url) + (img ? '<img src="' + esc(img) + '" alt="" loading="lazy" onerror="this.remove()">' : "") +
         (i != null ? '<span class="bol-n">' + dosCifras(i + 1) + "</span>" : "") + "</a>";
  }
  h += '<div class="bol-tarjeta-in"><div class="bol-etiqueta"><span>' + esc(sec.nombre) + "</span>" + (yt || (n.formato && n.formato !== "Noticia") ? '<b class="bol-tipo">' + esc(n.formato && n.formato !== "Noticia" ? n.formato : "Vídeo") + "</b>" : "") +
       (conBoletin && b ? '<a href="#/boletin/' + encodeURIComponent(b.id) + '">Nº ' + esc(b.numero || "") + " · " + esc(fechaLarga(b.fecha)) + "</a>" : "") + "</div>";
  if (n.medio) h += '<div class="bol-medio-linea">' + logoMedio(n, cfg) + "<span>" + esc(n.medio) + "</span></div>";
  h += "<h3>" + (url ? '<a href="' + esc(destino) + '"' + fuera + ">" + esc(n.titular || url) + "</a>" : esc(n.titular)) + "</h3>";
  if (n.resumen) h += '<div class="bol-resumen">' + parrafosRicos(n.resumen) + "</div>";
  h += bloqueComentario(n, cfg);
  if (url) h += '<a class="bol-leer" href="' + esc(destino) + '"' + fuera + ">" + (yt ? "Ver y escuchar " : "Leer la noticia ") + icono("flecha") + "</a>";
  return h + "</div></article>";
}

function filaEvento(e) {
  const url = urlSegura(e.url);
  const d = e.fecha ? new Date(e.fecha + "T12:00:00") : null, ok = d && !isNaN(d);
  let h = '<div class="bol-ev"><div class="bol-ev-fecha' + (ok ? "" : " sin") + '">' +
          (ok ? "<b>" + d.getDate() + "</b><span>" + d.toLocaleDateString("es-ES", { month: "short" }).replace(".", "") + "</span>" : "<b>✦</b>") + "</div>";
  h += '<div class="bol-ev-txt">' + (e.tipo ? '<em class="bol-ev-tipo">' + esc(e.tipo) + "</em>" : "");
  h += "<b>" + (url ? '<a href="' + esc(url) + '" target="_blank" rel="noopener">' + esc(e.titulo) + "</a>" : esc(e.titulo)) + "</b>";
  const det = [ok ? fechaLarga(e.fecha) : "", e.hora, e.lugar].filter(Boolean).join(" · ");
  if (det) h += "<small>" + esc(det) + "</small>";
  if (e.descripcion) h += "<p>" + esc(e.descripcion) + "</p>";
  return h + "</div></div>";
}

function tarjetaEditorial(ed, b, cfg) {
  const editor = (cfg && cfg.editor) || "LODLC", img = urlSegura(ed.imagen);
  return '<a class="bol-ed-item" href="#/editorial/' + encodeURIComponent(b.id) + '">' +
    (img ? '<div class="bol-ed-item-img" style="background-image:url(\'' + esc(img) + '\')"></div>' : "") +
    '<div class="bol-ed-item-txt"><div class="bol-etiqueta"><span>Editorial · Nº ' + esc(b.numero || "") + "</span><em>" + esc(fechaLarga(b.fecha)) + "</em></div>" +
    "<h3>" + esc(ed.titulo || "Editorial") + "</h3><p>" + esc(recortar(textoPlano(primerParrafo(ed.texto)), 200)) + "</p>" +
    '<span class="bol-mas">' + esc(ed.firma || editor) + " · Leer editorial " + icono("flecha") + "</span></div></a>";
}

function tarjetaBoletin(x, actual) {
  const ns = (x.noticias || []).filter(n => n.titular || n.url).length;
  return '<a class="bol-arch' + (actual ? " actual" : "") + '" href="#/boletin/' + encodeURIComponent(x.id) + '">' +
    '<span class="bol-arch-n"><small>Nº</small>' + esc(dosCifras(x.numero)) + "</span>" +
    "<span><em>" + esc(fechaLarga(x.fecha)) + "</em><b>" + esc((x.editorial || {}).titulo || x.titulo || "Boletín nº " + (x.numero || "")) + "</b>" +
    "<small>" + ns + (ns === 1 ? " noticia" : " noticias") + "</small></span></a>";
}

/* ---------- redes ---------- */
const REDES = [["x", "X"], ["instagram", "Instagram"], ["facebook", "Facebook"], ["tiktok", "TikTok"], ["youtube", "YouTube"], ["telegram", "Telegram"], ["whatsapp", "WhatsApp"]];
function usuarioDe(url, red) {
  if (red === "whatsapp") return "Canal de WhatsApp";
  const m = String(url).replace(/[?#].*$/, "").replace(/\/+$/, "").split("/").pop() || "";
  return m ? (m.startsWith("@") ? m : "@" + m) : "";
}
/* Las cuentas de X e Instagram se pueden escribir como @usuario: aquí se convierten en el enlace al perfil */
function perfil(cfg, k) {
  const v = String(cfg[k] || "").trim();
  if (!v || /^https?:\/\//i.test(v)) return v;
  if (k === "x") return "https://x.com/" + v.replace(/^@/, "");
  if (k === "instagram") return "https://instagram.com/" + v.replace(/^@/, "");
  return v;
}
function bloqueRedes(cfg) {
  const rs = REDES.filter(r => urlSegura(perfil(cfg, r[0])));
  if (!rs.length) return "";
  let h = '<section class="bol-redes" id="redes"><div class="bol-sec-cab"><h2 class="bol-tit-sec">PATRIAM en las redes</h2></div><div class="bol-redes-rejilla">';
  rs.forEach(([k, n]) => {
    h += '<a class="bol-red bol-red-' + k + '" href="' + esc(perfil(cfg, k)) + '" target="_blank" rel="noopener"><span class="bol-red-ico">' + icono(k) + "</span>" +
         "<span><b>" + n + "</b><small>" + esc(usuarioDe(perfil(cfg, k), k)) + '</small></span><em>Seguir ' + icono("flecha") + "</em></a>";
  });
  return h + "</div></section>";
}

/* ---------- agenda ---------- */
function filaAgenda(e) {
  const url = urlSegura(e.url);
  const d = e.fecha ? new Date(e.fecha + "T12:00:00") : null, ok = d && !isNaN(d);
  let h = '<div class="bol-ag' + (ok ? "" : " sin-fecha") + '">';
  h += '<div class="bol-ag-fecha">' + (ok ? "<b>" + d.getDate() + "</b><span>" + d.toLocaleDateString("es-ES", { month: "long" }) + "</span><em>" + d.toLocaleDateString("es-ES", { weekday: "long" }) + "</em>"
                                         : "<b>✦</b><span>" + esc(e.tipo || "Iniciativa") + "</span>") + "</div>";
  h += '<div class="bol-ag-txt">' + (e.tipo ? '<span class="bol-ag-tipo">' + esc(e.tipo) + "</span>" : "") + "<h3>" + esc(e.titulo) + "</h3>";
  const det = [e.hora, e.lugar].filter(Boolean).join(" · ");
  if (det) h += '<div class="bol-ag-det">' + esc(det) + "</div>";
  if (e.descripcion) h += "<p>" + esc(e.descripcion) + "</p>";
  h += "</div>";
  h += url ? '<a class="bol-btn claro bol-ag-btn" href="' + esc(url) + '"' + (url.startsWith("#") ? "" : ' target="_blank" rel="noopener"') + ">Ver evento " + icono("flecha") + "</a>" : "<span></span>";
  return h + "</div>";
}

/* ---------- columna fija: editorial + calendario ---------- */
function miniCalendario(eventos, ref) {
  const base = ref ? new Date(ref + "T12:00:00") : new Date();
  const y = base.getFullYear(), m = base.getMonth();
  const dias = {}; eventos.forEach(e => { if (e.fecha && e.fecha.slice(0, 7) === y + "-" + String(m + 1).padStart(2, "0")) dias[+e.fecha.slice(8, 10)] = e.titulo; });
  const primero = (new Date(y, m, 1).getDay() + 6) % 7, total = new Date(y, m + 1, 0).getDate();
  const hoy = new Date(), esHoy = d => hoy.getFullYear() === y && hoy.getMonth() === m && hoy.getDate() === d;
  const mes = base.toLocaleDateString("es-ES", { month: "long", year: "numeric" });
  let h = '<div class="cal"><div class="cal-mes">' + mes.charAt(0).toUpperCase() + mes.slice(1) + "</div><div class=\"cal-rejilla\">";
  ["L", "M", "X", "J", "V", "S", "D"].forEach(d => h += "<b>" + d + "</b>");
  for (let i = 0; i < primero; i++) h += "<span></span>";
  for (let d = 1; d <= total; d++) h += '<span class="' + (dias[d] ? "con" : "") + (esHoy(d) ? " hoy" : "") + '"' + (dias[d] ? ' title="' + esc(dias[d]) + '"' : "") + ">" + d + "</span>";
  return h + "</div></div>";
}
function lateral(b, cfg, ls) {
  const ed = (b && b.editorial) || {};
  let h = '<aside class="bol-lateral"><div class="bol-lateral-in">';
  if (ed.titulo || ed.texto) {
    const img = urlSegura(ed.imagen);
    h += '<article class="lat-ed">' + (img ? '<a class="lat-ed-img" href="#/editorial/' + encodeURIComponent(b.id) + '" style="--img:url(\'' + esc(img) + '\')" aria-label="Leer editorial"></a>' : "");
    h += '<div class="lat-ed-txt"><div class="bol-etiqueta"><span>Editorial</span><em>Nº ' + esc(dosCifras(b.numero)) + "</em></div>";
    h += "<h2>" + tituloDosTonos(ed.titulo || "Editorial") + "</h2>";
    h += "<p>" + esc(recortar(textoPlano(primerParrafo(ed.texto)), 230)) + "</p>";
    h += '<div class="lat-ed-pie"><span class="bol-firma-mini"><span class="bol-avatar">' + esc((ed.firma || cfg.editor || "L").charAt(0).toUpperCase()) + "</span>" + esc(ed.firma || cfg.editor || "LODLC") + "</span>";
    h += '<a class="bol-btn" href="#/editorial/' + encodeURIComponent(b.id) + '">Leer ' + icono("flecha") + "</a></div></div></article>";
  }
  const evs = todosEventos(ls && ls.length ? ls : (b ? [b] : [])).proximos;
  h += '<section class="lat-cal"><div class="bol-sec-cab claro"><h2 class="bol-tit-sec">Calendario</h2><a href="#/iniciativas">Todo</a></div>';
  h += miniCalendario(evs, (evs.find(e => e.fecha) || {}).fecha);
  h += evs.length ? '<div class="lat-ev">' + evs.slice(0, 5).map(filaEvento).join("") + "</div>" : '<p class="bol-ev-vacio">Pronto anunciaremos nuevas convocatorias.</p>';
  h += "</section></div></aside>";
  return h;
}

/* ---------- centro de la portada ---------- */
/* Noticias del boletín agrupadas por sección (Actualidad, Historia, Sociedad, Análisis), numeradas seguidas */
/* Orden de lectura de cada número: primero lo de actualidad, luego el análisis y el fondo histórico, y al final la vida y las costumbres */
const ORDEN_LECTURA = ["actualidad", "analisis", "historia", "sociedad"];
const pesoLectura = clave => { const k = ORDEN_LECTURA.indexOf(clave); return k < 0 ? ORDEN_LECTURA.length : k; };
function claveTexto(s) { return String(s || "actualidad").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(); }
function ordenarFirmas(cols) { return cols.map((c, k) => ({ c, k })).sort((a, b) => pesoLectura(claveTexto(a.c.seccion)) - pesoLectura(claveTexto(b.c.seccion)) || a.k - b.k).map(x => x.c); }
function gruposNoticias(ns) {
  let i = 0;
  return SECCIONES.slice().sort((a, b) => pesoLectura(a.clave) - pesoLectura(b.clave)).map(sec => ({ sec, items: ns.filter(n => claveSeccion(n) === sec.clave) })).filter(g => g.items.length)
    .map(g => ({ sec: g.sec, items: g.items.map(n => ({ n, i: i++ })) }));
}
/* Recomendados de la semana: UNA por tipo (podcast o vídeo, libro, película y otros).
   Si se marcan varias del mismo tipo, va la última que se marcó. */
const ES_PELI = t => /pel[ií]cula|cine|serie de tv|serie de televisi/i.test(t || "");
const TIPOS_REC = [
  { t: "Podcast o vídeo", clave: "podcasts", ruta: "#/podcasts", ico: "podcasts", es: x => ES_PODCAST(x.tipo) && !ES_PELI(x.tipo) },
  { t: "Libro", clave: "libros", ruta: "#/libros", ico: "libros", es: x => ES_LIBRO(x.tipo) },
  { t: "Película", clave: "peliculas", ruta: "#/peliculas", ico: "podcasts", es: x => ES_PELI(x.tipo) }
];
function tipoRec(x) { return TIPOS_REC.find(g => g.es(x)) || { t: "Recomendado", clave: "recomendado", ruta: "", ico: "historia" }; }
function gruposRecomendados(recs) {
  const orden = TIPOS_REC.map(g => g.clave).concat("recomendado"), uno = {};
  recs.forEach(x => { uno[tipoRec(x).clave] = x; });
  return orden.filter(k => uno[k]).map(k => { const g = tipoRec(uno[k]); return { t: g.t, clave: g.clave, ruta: g.ruta, ico: g.ico, xs: [uno[k]] }; });
}
function enEditor() { return typeof location !== "undefined" && location.pathname.indexOf("editor") >= 0; }
/* «Entrar en el boletín»: se abre el boletín completo y baja hasta lo elegido */
function entrarBoletin(ancla) {
  const c = document.getElementById("completo"); if (!c) return false;
  c.classList.remove("plegado");
  const e = document.querySelector(".sum-entrar"); if (e) e.hidden = true;
  const destino = (ancla && document.getElementById(ancla)) || c;
  const menu = document.querySelector(".bol-menu"), alto = menu && getComputedStyle(menu).position === "sticky" ? menu.offsetHeight : 0;
  window.scrollTo({ top: destino.getBoundingClientRect().top + window.scrollY - alto - 14, behavior: "smooth" });
  return false;
}
/* «Este boletín»: la portada del número, como la de un periódico digital
   (la editorial ya va en la columna de la izquierda, así que aquí no se repite) */
function sumarioBoletin(b, cfg, grupos, cols, recs, evs) {
  const fotoDe = x => urlSegura(x && x.imagen) || ((y => y ? "https://i.ytimg.com/vi/" + y + "/hqdefault.jpg" : "")(idYoutube(urlSegura(x && x.url))));
  const ancla = a => ' href="#' + a + '" onclick="return entrarBoletin(\'' + a + '\')"';
  const foto = (img, enl, cls, ico) => '<a class="pt-foto ' + (cls || "") + (img ? "" : " vacia") + '"' + enl + ' tabindex="-1" aria-hidden="true">' +
    (img ? '<img src="' + esc(img) + '" alt="" loading="lazy" onerror="this.parentNode.classList.add(\'vacia\');this.remove()">' : "") + icono(ico || "historia", "grande") + "</a>";
  const firma = (autor, cargo) => autor ? '<span class="pt-autor"><span class="bol-avatar">' + esc(autor.charAt(0).toUpperCase()) + "</span><span><b>" + esc(autor) + "</b>" + (cargo ? "<small>" + esc(cargo) + "</small>" : "") + "</span></span>" : "";
  const extracto = (t, n) => t ? "<p>" + esc(recortar(textoPlano(t), n)) + "</p>" : "";

  // Cabecera de la portada: número, fecha y lo que trae
  const total = grupos.reduce((t, g) => t + g.items.length, 0);
  const cuenta = [cols.length ? cols.length + (cols.length === 1 ? " firma" : " firmas") : "", total ? total + (total === 1 ? " noticia" : " noticias") : "",
    recs.length ? recs.length + (recs.length === 1 ? " recomendación" : " recomendaciones") : "", evs.length ? evs.length + (evs.length === 1 ? " cita" : " citas") : ""].filter(Boolean).join(" · ");
  let h = '<section class="bol-sumario pt" id="sumario"><header class="pt-cab"><span>Nº ' + esc(dosCifras(b.numero)) + "</span><b>" + esc(fechaLarga(b.fecha)) + "</b><span>" + esc(cuenta) + "</span></header>";
  const temas = [...new Set(grupos.flatMap(g => g.items.map(({ n }) => (n.tema || "").trim())).filter(Boolean))];
  if (temas.length) h += '<div class="sum-temas"><span>En este número</span>' + temas.map(t => {
    const x = grupos.flatMap(g => g.items).find(({ n }) => (n.tema || "").trim() === t);
    return "<a" + ancla("n" + (x.i + 1)) + ">" + esc(t) + "</a>";
  }).join("") + "</div>";

  // Apertura: la firma más reciente con imagen, a lo grande; el resto de firmas, al lado/debajo
  // Apertura: la primera firma en orden de lectura que tenga imagen
  const ap = cols.find(c => urlSegura(c.imagen)) || cols[0];
  const otras = cols.filter(c => c !== ap);
  if (ap) {
    const enl = ' href="' + enlaceColaboracion(ap) + '"';
    h += '<article class="pt-apertura">' + foto(urlSegura(ap.imagen), enl, "", "colaboraciones") +
      '<div class="pt-ap-txt"><span class="pt-kicker">' + esc(ap.seccion || "Firma invitada") + (ap.tema ? " · " + esc(ap.tema) : "") + "</span>" +
      "<h2><a" + enl + ">" + esc(ap.titulo) + "</a></h2>" + extracto(ap.entradilla || primerParrafo(ap.texto), 240) + firma(ap.autor, ap.cargo) + "</div></article>";
  }
  if (otras.length) h += '<div class="pt-firmas">' + otras.map(c => {
    const enl = ' href="' + enlaceColaboracion(c) + '"', img = urlSegura(c.imagen);
    return '<article class="pt-firma' + (img ? "" : " sin-foto") + '">' + (img ? foto(img, enl, "", "colaboraciones") : "") +
      '<div><span class="pt-kicker">' + esc(c.seccion || "Firma invitada") + "</span><h3><a" + enl + ">" + esc(c.titulo) + "</a></h3>" +
      extracto(c.entradilla || primerParrafo(c.texto), img ? 120 : 200) + firma(c.autor, c.cargo) + "</div></article>";
  }).join("") + "</div>";

  // Lo que hay que saber: una columna por sección, con su noticia principal y los demás titulares
  if (grupos.length) {
    h += '<div class="pt-rotulo"><span>Lo que hay que saber</span></div><div class="pt-secciones">';
    grupos.forEach(g => {
      const [{ n, i }, ...r] = g.items;
      const ico = g.sec.clave === "actualidad" ? "noticias" : g.sec.clave;
      h += '<article class="pt-sec"><a class="pt-sec-nom" href="#/' + g.sec.ruta + '">' + esc(g.sec.nombre) + "</a>" + foto(fotoDe(n), ancla("n" + (i + 1)), "apaisada", ico) +
        "<h3><a" + ancla("n" + (i + 1)) + ">" + esc(n.titular || n.url) + "</a></h3>" + extracto(n.resumen, 140) +
        (n.medio ? '<small class="pt-medio">' + esc(n.medio) + "</small>" : "") +
        (r.length ? '<ul class="pt-mas">' + r.map(({ n, i }) => "<li><a" + ancla("n" + (i + 1)) + ">" + esc(n.titular || n.url) + "</a>" + (n.medio ? "<small>" + esc(n.medio) + "</small>" : "") + "</li>").join("") + "</ul>" : "") +
        "</article>";
    });
    h += "</div>";
  }

  // Recomendados: una franja al final
  const gr = gruposRecomendados(recs);
  if (gr.length) h += '<div class="pt-recs">' + gr.map(g => g.xs.map(x =>
    '<a class="pt-rec"' + ancla("rec-" + g.clave) + ">" + foto(urlSegura(x.imagen) || fotoDe({ url: ((x.capitulos || [])[0] || x).url }), "", "mini", g.ico).replace(/^<a /, "<span ").replace(/<\/a>$/, "</span>") +
    '<span><span class="pt-kicker">' + esc(g.clave === "recomendado" ? "Recomendado" : g.t + " de la semana" + (x.tipo && x.tipo !== g.t ? " · " + x.tipo : "")) + "</span><b>" + esc(x.titulo) + "</b>" +
    (x.medio ? "<small>" + esc(x.medio) + "</small>" : "") + "</span></a>").join("")).join("") + "</div>";

  h += '<div class="sum-entrar"><a class="bol-btn grande" href="#completo" onclick="return entrarBoletin()">Leer el boletín completo ' + icono("flecha") + "</a></div></section>";
  return h;
}
/* En cada sección, la pieza principal (la primera con imagen) va en grande y el resto en pequeño, a dos columnas */
function listaJerarquica(xs, tieneFoto, pinta, cls) {
  if (xs.length < 2) return '<div class="' + cls + '">' + xs.map(pinta).join("") + "</div>";
  const k = Math.max(0, xs.findIndex(x => tieneFoto(x)));
  const resto = xs.filter((x, j) => j !== k);
  return '<div class="' + cls + '"><div class="pieza-principal">' + pinta(xs[k]) + '</div><div class="piezas-menores">' + resto.map(pinta).join("") + "</div></div>";
}
function centroInicio(b, cfg, todos) {
  // Lo que ya sale abajo como recomendado (podcast, serie, libro…) no se repite en las noticias
  const urlsRec = new Set((b.recomendados || []).map(id => itemBib(cfg, id)).filter(Boolean)
    .flatMap(x => [x.url].concat((x.capitulos || []).map(c => c.url))).filter(Boolean).map(u => String(u).trim()));
  const ns = (b.noticias || []).filter(n => (n.titular || n.url) && !urlsRec.has(String(n.url || "").trim()));
  const cols = ordenarFirmas((b.colaboraciones || []).filter(c => c.titulo));
  const grupos = gruposNoticias(ns);
  const recs = (b.recomendados || []).map(id => itemBib(cfg, id)).filter(Boolean);
  const evs = todosEventos([b]).proximos;
  const editor = enEditor();
  let h = editor ? "" : barraCompartir(b, cfg);
  h += sumarioBoletin(b, cfg, grupos, cols, recs, evs);
  // El boletín completo: plegado hasta pulsar «Entrar» (en la vista previa del editor se ve siempre)
  h += '<div class="bol-completo' + (editor ? "" : " plegado") + '" id="completo">';
  if (cols.length) h += '<section class="bol-firmas" id="colaboraciones"><div class="bol-sec-cab"><h2 class="bol-tit-sec">' + (cols.length > 1 ? "Firmas invitadas" : "Firma invitada") + '</h2>' +
                        (cols.length > 1 ? "" : '<a href="#/colaboraciones">Todas ' + icono("flecha") + "</a>") + "</div>" +
                        listaJerarquica(cols, c => urlSegura(c.imagen), c => tarjetaColaboracion(c, b), "bol-firmas-lista") + notaColab(cfg) + "</section>";
  grupos.forEach(g => {
    h += '<section class="bol-noticias" id="sec-' + g.sec.clave + '"><div class="bol-sec-cab"><h2 class="bol-tit-sec">' + esc(g.sec.nombre) + "</h2>" +
         '<a href="#/' + g.sec.ruta + '">Ver más en ' + esc(g.sec.menu) + " " + icono("flecha") + "</a></div>";
    h += listaJerarquica(g.items, ({ n }) => urlSegura(n.imagen) || idYoutube(urlSegura(n.url)), ({ n, i }) => tarjetaNoticia(n, i, cfg, b, false, "n" + (i + 1)), "bol-lista") + "</section>";
  });
  // Un bloque por tipo: «Podcasts y vídeos recomendados», «Libros recomendados»…
  gruposRecomendados(recs).forEach(g => {
    const titulo = g.clave === "recomendado" ? "Recomendado esta semana" : g.t + " de la semana";
    h += '<section class="bol-recomendados" id="rec-' + g.clave + '"><div class="bol-sec-cab"><h2 class="bol-tit-sec">' + esc(titulo) + "</h2>" +
         (g.ruta ? '<a href="' + g.ruta + '">Ver todos ' + icono("flecha") + "</a>" : "") + "</div>" +
         '<div class="bib-lista">' + g.xs.map(x => tarjetaBib(x, cfg, true)).join("") + "</div></section>";
  });
  h += bloqueRedes(cfg);
  h += '<div class="bol-unete"><span class="bol-unete-ico">' + icono("correo") + "</span>" +
       '<div><b>' + esc(cfg.uneteTitulo || "Únete a PATRIAM") + "</b><p>" + esc(cfg.uneteTexto || "Recibe cada semana nuestro boletín y forma parte del cambio.") + "</p></div>" +
       '<a class="bol-btn" href="#/suscribirse">Suscríbete ' + icono("flecha") + "</a></div>";
  const otros = ordenar(todos || []).filter(x => x.id !== b.id).slice(0, 4);
  if (otros.length) h += '<section class="bol-otros"><div class="bol-sec-cab"><h2 class="bol-tit-sec">Boletines anteriores</h2><a href="#/boletines">Ver todos ' + icono("flecha") + "</a></div>" +
                        '<div class="bol-archivo">' + otros.map(x => tarjetaBoletin(x, false)).join("") + "</div></section>";
  return h + "</div>";
}

/* ---------- noticia de otra web, dentro de la nuestra ---------- */
function paginaLeer(ls, cfg, bid, k) {
  const b = ls.find(x => x.id === bid), n = b && (b.noticias || [])[+k];
  const url = n && urlSegura(n.url);
  if (!url) return '<div class="bol-pagina"><p class="bol-vacio">No se encuentra esta noticia. <a href="#/">Volver al boletín</a></p></div>';
  const yt = idYoutube(url);
  let h = '<div class="bol-pagina bol-leer-pag">';
  h += '<div class="leer-barra"><span></span>' +
       '<a class="bol-btn claro" href="' + esc(url) + '" target="_blank" rel="noopener">' + (yt ? "Ver en YouTube" : "Abrir en " + esc(n.medio || "su web")) + " ↗</a></div>";
  h += '<div class="bol-etiqueta"><span>' + esc(seccionDe(n).nombre) + "</span>" + (yt || (n.formato && n.formato !== "Noticia") ? '<b class="bol-tipo">' + esc(n.formato && n.formato !== "Noticia" ? n.formato : "Vídeo") + "</b>" : "") + "</div>";
  if (n.medio) h += '<div class="bol-medio-linea grande">' + logoMedio(n, cfg) + "<span>" + esc(n.medio) + "</span></div>";
  h += '<h1 class="leer-tit">' + esc(n.titular || "") + "</h1>";
  if (yt) {
    h += reproductorYoutube(yt, n.titular, url);
    if (n.resumen) h += '<div class="bol-resumen grande">' + parrafosRicos(n.resumen) + "</div>";
    h += bloqueComentario(n, cfg);
  } else {
    if (n.resumen) h += '<div class="bol-resumen grande">' + parrafosRicos(n.resumen) + "</div>";
    h += bloqueComentario(n, cfg);
    h += '<div class="leer-marco"><iframe src="' + esc(url) + '" title="' + esc(n.titular || "Noticia") + '" loading="lazy" referrerpolicy="no-referrer"></iframe></div>';
    h += '<p class="leer-nota">Algunos periódicos no dejan mostrar sus noticias dentro de otras webs. Si aquí no se ve, pulsa «Abrir en ' + esc(n.medio || "su web") + '».</p>';
  }
  return h + "</div>";
}

/* ---------- textos legales (los de la web de PATRIAM) ---------- */
const LEGALES_ORDEN = [["aviso-legal", "Aviso legal"], ["privacidad", "Privacidad"], ["cookies", "Cookies"], ["transparencia-ia", "Transparencia IA"]];
function paginaLegal(clave, cfg) {
  const L = (window.PATRIAM_LEGALES || {})[clave];
  if (!L) return '<div class="bol-pagina"><p class="bol-vacio">Texto no disponible.</p></div>';
  const web = (cfg.web || "").replace(/\/$/, "");
  let html = maquetar(L.contenido).replace(/\[([^\]<]{2,80})\]/g, '<mark class="pendiente">[$1]</mark>');
  let h = '<div class="bol-pagina"><article class="bol-articulo bol-legal">';
  h += '<div class="bol-etiqueta"><span>Textos legales</span></div><h1>' + esc(L.titulo) + "</h1>";
  h += '<nav class="bol-legal-nav">' + LEGALES_ORDEN.map(([k, n]) => '<a href="#/legal/' + k + '"' + (k === clave ? ' class="activo"' : "") + ">" + n + "</a>").join("") + "</nav>";
  h += '<div class="bol-articulo-texto">' + html + "</div>";
  if (web) h += '<p class="leer-nota">Es el mismo texto que figura en la <a href="' + esc(web) + "/#/" + clave + '" target="_blank" rel="noopener">web de PATRIAM</a>.</p>';
  return h + "</article></div>";
}

/* ---------- montaje: cabecera · columna fija · centro · pie ---------- */
function barraVolver(abajo) {
  return '<div class="bol-volver-barra' + (abajo ? " abajo" : "") + '"><a class="bol-btn" href="#/">← Volver al boletín</a></div>';
}
function marco(cfg, b, ls, activo, centro) {
  const interior = activo !== "inicio";
  return cabecera(cfg, b, activo) + '<main class="ancho bol-marco">' + lateral(b, cfg, ls) + '<div class="bol-centro" id="centro">' +
    (interior ? barraVolver(false) : "") + centro + (interior ? barraVolver(true) : "") + "</div></main>" + pie(cfg);
}

/* Lo usa el editor para la vista previa */
function renderBoletin(b, cfg, lista) {
  cfg = cfg || {};
  if (!b) return cabecera(cfg, null, "") + '<p class="bol-vacio">Todavía no hay boletines.</p>' + pie(cfg);
  return marco(cfg, b, lista && lista.length ? lista : [b], "inicio", centroInicio(b, cfg, lista));
}

/* ---------- páginas del archivo ---------- */
function cabPagina(titulo, texto, cuenta) {
  return '<div class="bol-pag-cab"><h1>' + esc(titulo) + "</h1>" + (texto ? "<p>" + esc(texto) + "</p>" : "") + (cuenta != null ? "<span>" + cuenta + "</span>" : "") + "</div>";
}

/* ---------- series (podcasts por capítulos) ---------- */
/* ---------- biblioteca: podcasts, series, libros, vídeos… (no dependen del boletín) ---------- */
const TIPOS_BIB = ["Podcast", "Serie de podcast", "Vídeo", "Documental", "Libro", "Artículo"];
function biblioteca(cfg, seccion) {
  let b = (cfg.biblioteca || []).slice();
  if (!b.length && cfg.series) b = cfg.series.map((x, i) => Object.assign({ id: "s" + i, tipo: "Serie de podcast" }, x));
  return seccion ? b.filter(x => (x.seccion || "Historia") === seccion) : b;
}
/* Críticas con final: la recomendación lleva un adelanto sin destripar («comentario») y la crítica completa («critica»).
   La crítica completa entra SOLA en el boletín siguiente, como firma, sin que nadie tenga que acordarse. */
function prepararCriticas(lista, cfg) {
  (lista || []).forEach(b => {
    const prev = (lista || []).find(x => Number(x.numero) === Number(b.numero) - 1);
    if (!prev) return;
    (prev.recomendados || []).forEach(id => {
      const x = itemBib(cfg, id), cid = "crit-" + id;
      if (!x || !String(x.critica || "").trim()) return;
      if ((lista || []).some(bb => (bb.colaboraciones || []).some(c => c.id === cid))) return;
      const ficha = /^\*\*/.test(primerParrafo(x.descripcion)) ? primerParrafo(x.descripcion) + "\n\n" : "";
      b.colaboraciones = b.colaboraciones || [];
      b.colaboraciones.push({ id: cid, autor: x.comenta || (cfg && cfg.editor) || "LODLC", cargo: "", titulo: x.tituloCritica || ("La crítica: " + x.titulo),
        entradilla: "La recomendamos en el boletín anterior. Aquí va la crítica completa" + (x.tipo ? " de la " + String(x.tipo).toLowerCase() : "") + ".",
        imagen: x.imagen || "", seccion: "Análisis", tema: x.tema || "Cine",
        texto: "*Atención: este texto cuenta el final.*\n\n**" + x.titulo + "**" + (x.medio ? " (" + x.medio + ")" : "") + "\n\n" + ficha + x.critica, bio: "" });
    });
  });
  return lista;
}
function itemBib(cfg, id) { return biblioteca(cfg).find(x => x.id === id); }
function urlItem(x) {
  const u = urlSegura(x.url), yt = idYoutube(u);
  if ((x.capitulos || []).length) return { href: "#/ver/" + encodeURIComponent(x.id), fuera: false, yt: "" };
  return yt ? { href: "#/ver/" + encodeURIComponent(x.id), fuera: false, yt } : { href: u, fuera: !!u, yt: "" };
}
function verboItem(x) {
  const t = x.tipo || "";
  if (/libro/i.test(t)) return "Ver el libro";
  if ((x.capitulos || []).length) return "Ver los capítulos";
  if (idYoutube(urlSegura(x.url))) return "Ver y escuchar";
  if (/art/i.test(t)) return "Leer";
  return "Abrir";
}
function tarjetaBib(x, cfg, destacada) {
  const d = urlItem(x);
  const ytCap = (x.capitulos || []).map(c => idYoutube(urlSegura(c.url))).find(Boolean) || d.yt;
  const img = urlSegura(x.imagen) || (ytCap ? "https://i.ytimg.com/vi/" + ytCap + "/hqdefault.jpg" : "");
  const esLibro = /libro/i.test(x.tipo || "");
  const n = { medio: x.medio, logoMedio: x.logo };
  const at = d.fuera ? ' target="_blank" rel="noopener"' : "";
  let h = '<article class="bib' + (esLibro ? " bib-libro" : "") + (ES_PELI(x.tipo) && img ? " bib-con-peli" : "") + (destacada ? " destacada" : "") + '" data-tipo="' + esc(x.tipo || "") + '">';
  h += '<a class="bib-img" href="' + esc(d.href || "#/") + '"' + at + ' tabindex="-1" aria-hidden="true">';
  if (ES_PELI(x.tipo) && img) h += '<img class="bib-peli" src="' + esc(img) + '" alt="" loading="lazy" onerror="this.remove()">';
  else if (esLibro) h += img ? '<img src="' + esc(img) + '" alt="" loading="lazy" onerror="this.remove()">' : '<span class="bib-sinimg">' + icono("historia", "grande") + "</span>";
  else h += '<span class="pod-sello"><img src="' + esc(cfg.logoClaro || "logo-claro.png") + '" alt=""><b>' + esc(x.tipo || "Recomendado") + "</b><small>recomendado por PATRIAM</small></span>" +
            (img ? '<span class="pod-mini"><img src="' + esc(img) + '" alt="" loading="lazy" onerror="this.remove()">' +
            (ytCap ? '<span class="bol-play"><svg viewBox="0 0 24 24"><path d="M8 5.5v13l11-6.5z" fill="currentColor"/></svg></span>' : "") + "</span>" : "");
  h += '</a><div class="bib-txt"><div class="bol-etiqueta"><span>' + esc(x.seccion || "Historia") + '</span><b class="bol-tipo">' + esc(x.tipo || "") + "</b>" +
       ((x.capitulos || []).length ? "<em>" + x.capitulos.length + " capítulos</em>" : "") + "</div>";
  if (x.medio) h += '<div class="bol-medio-linea">' + logoMedio(n, cfg) + "<span>" + esc(x.medio) + "</span></div>";
  h += "<h3>" + (d.href ? '<a href="' + esc(d.href) + '"' + at + ">" + esc(x.titulo) + "</a>" : esc(x.titulo)) + "</h3>";
  if (x.descripcion) h += '<div class="bol-resumen">' + parrafosRicos(x.descripcion) + "</div>";
  h += bloqueComentario(x, cfg);
  if (d.href) h += '<a class="bol-leer" href="' + esc(d.href) + '"' + at + ">" + verboItem(x) + (d.fuera ? " ↗" : " " + icono("flecha")) + "</a>";
  if (destacada && String(x.critica || "").trim()) h += '<p class="bib-aviso-critica">La crítica completa, con el final, en el próximo boletín.</p>';
  return h + "</div></article>";
}
function bloqueBiblioteca(cfg, seccion) {
  const items = biblioteca(cfg, seccion).slice().reverse();
  if (!items.length) return "";
  const tipos = [...new Set(items.map(x => x.tipo).filter(Boolean))];
  let h = '<section class="bol-biblioteca" id="biblioteca"><div class="bol-sec-cab"><h2 class="bol-tit-sec">Biblioteca: podcasts, libros y más</h2><span>' + items.length + "</span></div>";
  if (tipos.length > 1) h += '<div class="bib-filtros" role="group" aria-label="Filtrar"><button class="activo" data-t="">Todo</button>' + tipos.map(t => '<button data-t="' + esc(t) + '">' + esc(t) + "</button>").join("") + "</div>";
  return h + '<div class="bib-lista">' + items.map(x => tarjetaBib(x, cfg)).join("") + "</div></section>";
}
function filtrarBib(btn) {
  const t = btn.dataset.t;
  btn.parentNode.querySelectorAll("button").forEach(b => b.classList.toggle("activo", b === btn));
  document.querySelectorAll(".bib-lista > .bol-item, .bib-lista > .bib").forEach(el => el.hidden = !!t && el.dataset.tipo !== t);
}
if (typeof document !== "undefined") document.addEventListener("click", e => {
  const b = e.target.closest(".bib-filtros button"); if (!b) return;
  if (b.closest("[data-filtro]")) { b.parentNode.querySelectorAll("button").forEach(x => x.classList.toggle("activo", x === b)); aplicarFiltros(); }
  else filtrarBib(b);
});

function paginaVer(cfg, id, ci) {
  const x = itemBib(cfg, id);
  if (!x) return '<div class="bol-pagina"><p class="bol-vacio">No se encuentra este contenido.</p></div>';
  const caps = x.capitulos || [], n = { medio: x.medio, logoMedio: x.logo };
  // Serie sin capítulo elegido: lista de capítulos
  if (caps.length && ci == null) {
    let h = '<div class="bol-pagina bol-leer-pag"><div class="bol-etiqueta"><span>' + esc(x.seccion || "Historia") + '</span><b class="bol-tipo">' + esc(x.tipo || "Serie") + "</b><em>" + caps.length + " capítulos</em></div>";
    if (x.medio) h += '<div class="bol-medio-linea grande">' + logoMedio(n, cfg) + "<span>" + esc(x.medio) + "</span></div>";
    h += '<h1 class="leer-tit">' + esc(x.titulo) + "</h1>" + (x.descripcion ? '<div class="bol-resumen grande">' + parrafosRicos(x.descripcion) + "</div>" : "") + bloqueComentario(x, cfg);
    h += '<ol class="serie-lista suelta">' + caps.map((c, i) => {
      const u = urlSegura(c.url), y = idYoutube(u);
      return '<li><a href="' + esc(y ? "#/ver/" + encodeURIComponent(x.id) + "/" + i : u) + '"' + (y ? "" : ' target="_blank" rel="noopener"') + '><span class="serie-n">' + esc(c.etiqueta || dosCifras(i + 1)) +
             '</span><span class="serie-t">' + esc(c.titulo) + "</span><em>" + (y ? "Ver aquí" : "Escuchar en " + esc(c.donde || "su web") + " ↗") + "</em></a></li>";
    }).join("") + "</ol>";
    return h + "</div>";
  }
  const c = caps.length ? caps[+ci] : x;
  const u = c && urlSegura(c.url), yt = idYoutube(u);
  if (!yt) return '<div class="bol-pagina"><p class="bol-vacio">No se encuentra este capítulo.</p></div>';
  let h = '<div class="bol-pagina bol-leer-pag"><div class="leer-barra">' + (caps.length ? '<a class="bol-volver" href="#/ver/' + encodeURIComponent(x.id) + '">← Todos los capítulos</a>' : "<span></span>") +
          '<a class="bol-btn claro" href="' + esc(u) + '" target="_blank" rel="noopener">Ver en YouTube ↗</a></div>';
  h += '<div class="bol-etiqueta"><span>' + esc(caps.length ? x.titulo : (x.seccion || "Historia")) + '</span><b class="bol-tipo">' + esc(caps.length ? (c.etiqueta || "Capítulo " + (+ci + 1)) : (x.tipo || "Vídeo")) + "</b></div>";
  if (x.medio) h += '<div class="bol-medio-linea grande">' + logoMedio(n, cfg) + "<span>" + esc(x.medio) + "</span></div>";
  h += '<h1 class="leer-tit">' + esc(c.titulo) + "</h1>" + reproductorYoutube(yt, c.titulo, u);
  if (!caps.length) h += (x.descripcion ? '<div class="bol-resumen grande">' + parrafosRicos(x.descripcion) + "</div>" : "") + bloqueComentario(x, cfg);
  if (caps.length) {
    const ant = caps[+ci - 1], sig = caps[+ci + 1];
    const enl = (cc, i, txt, der) => { const y = idYoutube(urlSegura(cc.url)); return "<a" + (der ? ' class="der"' : "") + (y ? ' href="#/ver/' + encodeURIComponent(x.id) + "/" + i + '"' : ' href="' + esc(urlSegura(cc.url)) + '" target="_blank" rel="noopener"') + "><small>" + txt + "</small>" + esc((cc.etiqueta ? cc.etiqueta + ". " : "") + cc.titulo) + "</a>"; };
    h += '<nav class="bol-anterior-siguiente" style="margin-top:1.6rem">' + (ant ? enl(ant, +ci - 1, "← Anterior") : "<span></span>") + (sig ? enl(sig, +ci + 1, "Siguiente →", true) : "<span></span>") + "</nav>";
  }
  return h + "</div>";
}

function lineaPublicado(b, verbo) {
  return '<p class="bol-publicado">' + (verbo || "Publicado") + ' en el <a href="#/boletin/' + encodeURIComponent(b.id) + '">boletín nº ' + esc(b.numero || "") + "</a> · " + esc(fechaLarga(b.fecha)) + "</p>";
}
function conPie(html, pie) { return pie ? html.replace(/<\/div><\/article>$/, pie + "</div></article>") : html; }

/* Elementos para las páginas de listado: biblioteca + noticias de los boletines */
function itemsListado(lista, cfg, bib, noticias) {
  const tipoN = n => (n.formato && n.formato !== "Noticia") ? n.formato : (idYoutube(urlSegura(n.url)) ? "Vídeo" : "Noticia");
  const items = [];
  bib.forEach(x => {
    const bRec = ordenar(lista).find(bb => (bb.recomendados || []).includes(x.id));
    items.push({ tema: (x.tema || "").trim() || "Otros temas", tipo: x.tipo || "", texto: [x.titulo, x.medio, x.descripcion, x.comentario, x.tema, (x.capitulos || []).map(c => c.titulo).join(" ")].join(" "),
                 html: conPie(tarjetaBib(x, cfg), bRec ? lineaPublicado(bRec, "Recomendado") : "") });
  });
  noticias.forEach(({ n, b }) => items.push({ tema: (n.tema || "").trim() || "Otros temas", tipo: tipoN(n), texto: [n.titular, n.medio, n.resumen, n.comentario, n.tema].join(" "), html: conPie(tarjetaNoticia(n, null, cfg, b, false), lineaPublicado(b)) }));
  return items;
}
function paginaListado(titulo, texto, items) {
  let h = '<div class="bol-pagina">' + cabPagina(titulo, texto, items.length);
  if (!items.length) return h + '<p class="bol-vacio">Todavía no hay contenidos en esta sección.</p></div>';
  const temas = [...new Set(items.map(i => i.tema))].sort((x, y) => (x === "Otros temas") - (y === "Otros temas") || x.localeCompare(y, "es"));
  const tipos = [...new Set(items.map(i => i.tipo).filter(Boolean))];
  h += '<div class="sec-filtros">';
  h += '<div class="bol-filtro">' + icono("buscar") + '<input type="search" id="filtroTexto" placeholder="Buscar en ' + esc(titulo.toLowerCase()) + '…" oninput="aplicarFiltros()" aria-label="Buscar en la sección"></div>';
  if (temas.length > 1) h += '<div class="fil-fila"><span>Temas</span><div class="bib-filtros" data-filtro="tema"><button class="activo" data-v="">Todos</button>' + temas.map(t => '<button data-v="' + esc(t) + '">' + esc(t) + "</button>").join("") + "</div></div>";
  if (tipos.length > 1) h += '<div class="fil-fila"><span>Tipo</span><div class="bib-filtros" data-filtro="tipo"><button class="activo" data-v="">Todo</button>' + tipos.map(t => '<button data-v="' + esc(t) + '">' + esc(t) + "</button>").join("") + "</div></div>";
  h += "</div>";
  h += '<div id="lista-noticias">';
  temas.forEach(t => {
    const grupo = items.filter(i => i.tema === t);
    h += '<section class="tema-grupo" data-tema="' + esc(t) + '">' + (temas.length > 1 ? '<h2 class="tema-tit">' + esc(t) + " <small>" + grupo.length + "</small></h2>" : "") +
         '<div class="bol-lista bib-lista">' + grupo.map(i => '<div class="bol-item" data-tema="' + esc(i.tema) + '" data-tipo="' + esc(i.tipo) + '" data-texto="' + esc(sinAcentos(i.texto)) + '">' + i.html + "</div>").join("") + "</div></section>";
  });
  return h + '</div><p class="bol-vacio" id="sin-resultados" hidden>No hay resultados. Prueba con otra palabra o quita algún filtro.</p></div>';
}
function paginaSeccion(lista, cfg, s) {
  // Las firmas invitadas que se han marcado para esta sección salen también aquí, las primeras
  const colabs = todasColaboraciones(lista).filter(({ c }) => claveColab(c) === s.clave).map(({ c, b }) => ({
    tema: (c.tema || "").trim() || "Otros temas", tipo: "Artículo", texto: [c.titulo, c.autor, c.entradilla, c.tema, textoPlano(c.texto)].join(" "),
    html: '<div class="bol-colab-sec">' + tarjetaColaboracion(c, b) + "</div>" }));
  return paginaListado(s.menu, s.texto, colabs.concat(itemsListado(lista, cfg, biblioteca(cfg, s.nombre).slice().reverse(), todasNoticias(lista, s.clave))));
}
/* Podcasts (y vídeos) y libros, de cualquier sección */
/* «Criterio»: Análisis, Podcasts y vídeos, Libros y Películas juntos, con pestañas */
const PESTANAS_CRITERIO = [["analisis", "Análisis"], ["podcasts", "Podcasts y vídeos"], ["libros", "Libros"], ["peliculas", "Películas"]];
function conPestanas(cual, html) {
  return '<nav class="crit-tabs" aria-label="Criterio">' + PESTANAS_CRITERIO.map(([k, t]) => '<a href="#/' + k + '"' + (k === cual ? ' class="activo"' : "") + ">" + t + "</a>").join("") + "</nav>" + html;
}
function paginaTipo(lista, cfg, cual) {
  if (cual === "peliculas") return paginaListado("Películas", "Películas que recomendamos, con su crítica.", itemsListado(lista, cfg, biblioteca(cfg).filter(x => ES_PELI(x.tipo)).reverse(), []));
  const es = cual === "libros" ? ES_LIBRO : (t => ES_PODCAST(t) && !ES_PELI(t));
  const bib = biblioteca(cfg).filter(x => es(x.tipo)).reverse();
  const ns = cual === "libros" ? [] : todasNoticias(lista).filter(({ n }) => ES_PODCAST(n.formato) || idYoutube(urlSegura(n.url)));
  return cual === "libros"
    ? paginaListado("Libros", "Libros que recomendamos para entender España y su historia.", itemsListado(lista, cfg, bib, ns))
    : paginaListado("Podcasts y vídeos", "Podcasts, vídeos y documentales recomendados por PATRIAM.", itemsListado(lista, cfg, bib, ns));
}
function aplicarFiltros() {
  const caja = document.getElementById("filtroTexto"), q = caja ? sinAcentos(caja.value.trim()) : "";
  const val = f => { const b = document.querySelector('.bib-filtros[data-filtro="' + f + '"] button.activo'); return b ? b.dataset.v : ""; };
  const tema = val("tema"), tipo = val("tipo");
  let total = 0;
  document.querySelectorAll("#lista-noticias .bol-item").forEach(el => {
    const si = (!q || el.dataset.texto.indexOf(q) >= 0) && (!tema || el.dataset.tema === tema) && (!tipo || el.dataset.tipo === tipo);
    el.hidden = !si; if (si) total++;
  });
  document.querySelectorAll("#lista-noticias .tema-grupo").forEach(g => g.hidden = !g.querySelector(".bol-item:not([hidden])"));
  const v = document.getElementById("sin-resultados"); if (v) v.hidden = total > 0;
}
function filtrarNoticias() { aplicarFiltros(); }

function paginaEditoriales(lista, cfg) {
  const eds = todasEditoriales(lista);
  return '<div class="bol-pagina">' + cabPagina("Editoriales", "Nuestra opinión, semana a semana.", eds.length) +
    (eds.length ? '<div class="bol-ed-rejilla">' + eds.map(({ ed, b }) => tarjetaEditorial(ed, b, cfg)).join("") + "</div>" : '<p class="bol-vacio">Todavía no hay editoriales.</p>') + "</div>";
}

function paginaEditorial(lista, cfg, id) {
  const eds = todasEditoriales(lista), i = eds.findIndex(x => x.b.id === id);
  if (i < 0) return '<div class="bol-pagina"><p class="bol-vacio">No se encuentra esta editorial. <a href="#/editoriales">Ver todas</a></p></div>';
  const { ed, b } = eds[i], editor = cfg.editor || "LODLC", img = urlSegura(ed.imagen);
  let h = '<div class="bol-pagina"><article class="bol-articulo">';
  h += '<a class="bol-volver" href="#/editoriales">← Todas las editoriales</a>';
  h += '<div class="bol-etiqueta"><span>Editorial · Boletín nº ' + esc(b.numero || "") + "</span><em>" + esc(fechaLarga(b.fecha)) + "</em></div>";
  h += "<h1>" + tituloDosTonos(ed.titulo || "Editorial") + "</h1>";
  h += '<div class="bol-firma"><span class="bol-avatar">' + esc((ed.firma || editor).charAt(0).toUpperCase()) + "</span>" + esc(ed.firma || editor) + "</div>";
  if (img) h += '<img class="bol-articulo-img" src="' + esc(img) + '" alt="">';
  h += '<div class="bol-articulo-texto">' + maquetar(ed.texto) + "</div>";
  h += barraLector("Compártela en tus redes", (ed.titulo || "Editorial") + " — Editorial de PATRIAM", enlaceParaCompartir(cfg, "#/editorial/" + encodeURIComponent(b.id)));
  h += '<div class="bol-articulo-pie"><a class="bol-btn claro" href="#/boletin/' + encodeURIComponent(b.id) + '">Ver el boletín de esa semana ' + icono("flecha") + "</a></div>";
  h += '<nav class="bol-anterior-siguiente">' +
       (eds[i + 1] ? '<a href="#/editorial/' + encodeURIComponent(eds[i + 1].b.id) + '"><small>← Anterior</small>' + esc(eds[i + 1].ed.titulo || "Editorial") + "</a>" : "<span></span>") +
       (eds[i - 1] ? '<a class="der" href="#/editorial/' + encodeURIComponent(eds[i - 1].b.id) + '"><small>Siguiente →</small>' + esc(eds[i - 1].ed.titulo || "Editorial") + "</a>" : "<span></span>") + "</nav>";
  return h + "</article></div>";
}

function paginaIniciativas(lista) {
  const { proximos, pasados } = todosEventos(lista);
  let h = '<div class="bol-pagina">' + cabPagina("Agenda e iniciativas", "Eventos, campañas y convocatorias de PATRIAM.", proximos.length + pasados.length);
  h += '<section class="bol-agenda"><div class="bol-sec-cab"><h2 class="bol-tit-sec">Próximos</h2></div>' +
       (proximos.length ? '<div class="bol-ag-lista">' + proximos.map(filaAgenda).join("") + "</div>" : '<p class="bol-vacio">Pronto anunciaremos nuevas convocatorias.</p>') + "</section>";
  if (pasados.length) h += '<section class="bol-agenda pasada"><div class="bol-sec-cab"><h2 class="bol-tit-sec">Ya celebrados</h2></div><div class="bol-ag-lista">' + pasados.map(filaAgenda).join("") + "</div></section>";
  return h + "</div>";
}

function paginaBoletines(lista) {
  const ls = ordenar(lista);
  return '<div class="bol-pagina">' + cabPagina("Boletines anteriores", "Cada semana, un boletín. Aquí están todos, completos: pulsa en uno para verlo o compartirlo.", ls.length) +
         '<div class="bol-archivo">' + ls.map((x, i) => tarjetaBoletin(x, i === 0)).join("") + "</div></div>";
}

function paginaBuscar(lista, cfg, q) {
  const s = sinAcentos(q);
  const ns = todasNoticias(lista).filter(({ n }) => sinAcentos([n.titular, n.medio, n.comentario, n.seccion].join(" ")).indexOf(s) >= 0);
  const eds = todasEditoriales(lista).filter(({ ed }) => sinAcentos([ed.titulo, textoPlano(ed.texto)].join(" ")).indexOf(s) >= 0);
  const evs = todosEventos(lista); const ev = evs.proximos.concat(evs.pasados).filter(e => sinAcentos([e.titulo, e.lugar, e.descripcion, e.tipo].join(" ")).indexOf(s) >= 0);
  const cs = todasColaboraciones(lista).filter(({ c }) => sinAcentos([c.titulo, c.autor, c.entradilla, c.texto].join(" ")).indexOf(s) >= 0);
  const bs = biblioteca(cfg).filter(x => sinAcentos([x.titulo, x.medio, x.descripcion, x.tipo, (x.capitulos || []).map(c => c.titulo).join(" ")].join(" ")).indexOf(s) >= 0);
  const total = ns.length + eds.length + ev.length + cs.length + bs.length;
  let h = '<div class="bol-pagina">' + cabPagina("Resultados: «" + q + "»", total ? "" : "No hay resultados. Prueba con otra palabra.", total);
  if (eds.length) h += '<h2 class="bol-grupo">Editoriales <small>' + eds.length + '</small></h2><div class="bol-ed-rejilla">' + eds.map(({ ed, b }) => tarjetaEditorial(ed, b, cfg)).join("") + "</div>";
  if (bs.length) h += '<h2 class="bol-grupo">Biblioteca <small>' + bs.length + '</small></h2><div class="bib-lista">' + bs.map(x => tarjetaBib(x, cfg)).join("") + "</div>";
  if (cs.length) h += '<h2 class="bol-grupo">Colaboraciones <small>' + cs.length + '</small></h2><div class="bol-colab-rejilla">' + cs.map(({ c, b }) => tarjetaColaboracion(c, b)).join("") + "</div>";
  if (ns.length) h += '<h2 class="bol-grupo">Noticias, historia y análisis <small>' + ns.length + '</small></h2><div class="bol-lista">' + ns.map(({ n, b }) => tarjetaNoticia(n, null, cfg, b, true)).join("") + "</div>";
  if (ev.length) h += '<h2 class="bol-grupo">Agenda <small>' + ev.length + '</small></h2><div class="bol-ag-lista">' + ev.map(filaAgenda).join("") + "</div>";
  return h + "</div>";
}

/* ---------- suscripción al boletín (Netlify Forms: solo lo ven los administradores) ---------- */
function formSuscripcion() {
  return '<form class="sus-form" name="suscripcion" method="POST" onsubmit="return enviarSuscripcion(this)">' +
    '<input type="hidden" name="form-name" value="suscripcion">' +
    '<p class="sus-trampa"><label>No rellenar <input name="bot-field" tabindex="-1" autocomplete="off"></label></p>' +
    '<label>Nombre<input name="nombre" required autocomplete="name"></label>' +
    '<label>Correo electrónico<input type="email" name="email" required autocomplete="email"></label>' +
    '<label><span>Móvil <small>(opcional, para recibirlo por WhatsApp)</small></span><input type="tel" name="movil" autocomplete="tel"></label>' +
    '<label class="sus-acepto"><input type="checkbox" name="privacidad" value="acepto" required><span>He leído y acepto la <a href="#/legal/privacidad">política de privacidad</a>.</span></label>' +
    '<button class="bol-btn" type="submit">Suscribirme ' + icono("flecha") + '</button>' +
    '<p class="sus-aviso" role="status"></p></form>';
}
function paginaSuscribirse(cfg) {
  return '<div class="bol-pagina sus-pagina">' + cabPagina("Suscríbete al boletín", "Gratis, cada semana.") +
    '<p class="sus-intro">' + esc(cfg.uneteTexto || "Recibe cada semana nuestro boletín y forma parte del cambio.") + '</p>' +
    formSuscripcion() +
    (urlSegura(cfg.suscripcion) ? '<p class="sus-intro" style="font-size:.92rem">Apuntarse al boletín es <b>gratis</b> y solo sirve para recibirlo. Para hacerte <b>socio o asociado de PATRIAM</b> (con su cuota) entra en <a href="' + esc(cfg.suscripcion) + '" target="_blank" rel="noopener">la web de PATRIAM</a>.</p>' : "") +
    '<p class="sus-letra">Responsable: ' + esc(cfg.asociacion === "PATRIAM" ? "Asociación PATRIAM" : (cfg.asociacion || "Asociación PATRIAM")) + '. Finalidad: enviarte el boletín. Tus datos solo los ven los administradores del boletín y puedes <a href="#/baja">darte de baja</a> cuando quieras. Más información en la <a href="#/legal/privacidad">política de privacidad</a>.</p></div>';
}
/* ---------- darse de baja del boletín ---------- */
function paginaBaja(email, t) {
  const auto = email && t;
  return '<div class="bol-pagina sus-pagina">' + cabPagina("Darse de baja del boletín", "Dejarás de recibirlo. Puedes volver a apuntarte cuando quieras.") +
    (auto ? '<p class="sus-intro">Confirma con el botón y te damos de baja al momento.</p>' : "") + '<form class="sus-form" onsubmit="return enviarBaja(this)">' +
    '<input type="hidden" name="t" value="' + esc(t || "") + '">' +
    '<label>Correo electrónico<input type="email" name="email" required autocomplete="email" value="' + esc(email || "") + '"></label>' +
    '<button class="bol-btn" type="submit">Darme de baja ' + icono("flecha") + '</button><p class="sus-aviso" role="status"></p></form></div>';
}
function enviarBaja(f) {
  const aviso = f.querySelector(".sus-aviso"), boton = f.querySelector("button");
  boton.disabled = true; aviso.textContent = "Enviando…";
  fetch("/api/baja", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: f.email.value, t: f.t.value }) })
    .then(r => { if (!r.ok) throw 0; f.innerHTML = '<p class="sus-ok"><b>Hecho.</b> Te hemos dado de baja y ya no recibirás el boletín. Si fue un error, puedes <a href="#/suscribirse">volver a apuntarte</a>.</p>'; })
    .catch(() => { boton.disabled = false; aviso.textContent = "No se ha podido enviar. Inténtalo de nuevo en un momento."; });
  return false;
}
function enviarSuscripcion(f) {
  const aviso = f.querySelector(".sus-aviso"), boton = f.querySelector("button");
  if (location.protocol === "file:") { aviso.textContent = "El formulario funciona cuando el boletín está publicado en Netlify."; return false; }
  boton.disabled = true; aviso.textContent = "Enviando…";
  fetch("/api/suscribir", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(new FormData(f)).toString() })
    .then(r => { if (!r.ok) throw 0; f.innerHTML = '<p class="sus-ok"><b>¡Gracias!</b> Ya estás apuntado. Recibirás el boletín cada semana.</p>'; })
    .catch(() => { boton.disabled = false; aviso.textContent = "No se ha podido enviar. Inténtalo de nuevo en un momento."; });
  return false;
}

/* ---------- «Al momento»: envíos sueltos para WhatsApp (una noticia, un post de Instagram o X…) ---------- */
function alMomento(cfg) { return ((cfg && cfg.alMomento) || []).filter(x => x.estado === "aprobado").sort((a, b) => String(b.fecha || "").localeCompare(String(a.fecha || ""))); }
function idInstagram(u) { const m = String(u || "").match(/instagram\.com\/(?:[\w.]+\/)?(p|reel|tv)\/([\w-]+)/i); return m ? m[1] + "/" + m[2] : ""; }
function idTuit(u) { const m = String(u || "").match(/(?:twitter|x)\.com\/[\w]+\/status(?:es)?\/(\d+)/i); return m ? m[1] : ""; }
function redDe(u) { return idInstagram(u) ? "Instagram" : idTuit(u) ? "X" : idYoutube(u) ? "YouTube" : ""; }
function incrustado(x) {
  const url = urlSegura(x.url), yt = idYoutube(url), ig = idInstagram(url), tw = idTuit(url);
  if (yt) return reproductorYoutube(yt, x.titulo, url);
  if (ig) return '<div class="am-red am-ig"><iframe src="https://www.instagram.com/' + ig + '/embed/captioned/" title="Publicación de Instagram" loading="lazy" allowtransparency="true"></iframe></div>';
  if (tw) return '<div class="am-red am-x"><iframe src="https://platform.twitter.com/embed/Tweet.html?id=' + tw + '&lang=es" title="Publicación de X" loading="lazy"></iframe></div>';
  return "";
}
function paginaAlMomento(cfg, id) {
  const x = ((cfg && cfg.alMomento) || []).find(y => y.id === id || y.slug === id);
  if (!x || x.estado !== "aprobado") return '<div class="bol-pagina">' + cabPagina("Al momento") + '<p class="bol-vacio">Este contenido ya no está disponible.</p></div>';
  const url = urlSegura(x.url), emb = incrustado(x), red = redDe(url), img = urlSegura(x.imagen);
  const medio = x.medio || red || (url ? url.replace(/^https?:\/\/(www\.)?/, "").split("/")[0] : "");
  let h = '<article class="bol-pagina am-pieza"><p class="am-ante">Al momento · ' + esc(fechaLarga(x.fecha)) + (medio ? " · " + esc(medio) : "") + "</p>";
  h += '<h1 class="am-titulo">' + esc(x.titulo || "") + "</h1>";
  if (!emb && img) h += '<img class="am-img" src="' + esc(img) + '" alt="">';
  if (x.resumen) h += '<div class="am-resumen">' + parrafosRicos(x.resumen) + "</div>";
  h += emb;
  if (url && !emb) h += '<p><a class="bol-btn" href="' + esc(url) + '" target="_blank" rel="noopener">Leer en ' + esc(medio || "la fuente") + " " + icono("flecha") + "</a></p>";
  else if (url) h += '<p class="am-fuente"><a href="' + esc(url) + '" target="_blank" rel="noopener">Ver en ' + esc(medio) + " ↗</a></p>";
  h += bloqueComentario(x, cfg);
  h += '<div class="bol-unete am-unete"><div><b>Lo que hay que saber</b><p>Cada semana, el boletín de PATRIAM con criterio.</p></div><a class="bol-btn" href="#/">Ver el boletín ' + icono("flecha") + '</a><a class="bol-btn claro" href="#/suscribirse">Suscríbete</a></div>';
  return h + "</article>";
}
function paginaAlMomentoLista(cfg) {
  const xs = alMomento(cfg);
  let h = '<div class="bol-pagina">' + cabPagina("Al momento", "Lo que compartimos entre boletín y boletín.", xs.length);
  if (!xs.length) return h + '<p class="bol-vacio">Todavía no hay nada.</p></div>';
  h += '<div class="am-lista">' + xs.map(x => {
    const yt = idYoutube(x.url), img = urlSegura(x.imagen) || (yt ? "https://i.ytimg.com/vi/" + yt + "/hqdefault.jpg" : "");
    return '<a class="am-fila" href="#/al/' + encodeURIComponent(x.id) + '">' + (img ? '<img src="' + esc(img) + '" alt="">' : '<span class="am-sin-img">' + icono("flecha") + "</span>") +
      "<div><small>" + esc(fechaLarga(x.fecha)) + (x.medio || redDe(x.url) ? " · " + esc(x.medio || redDe(x.url)) : "") + "</small><b>" + esc(x.titulo || "") + "</b>" + (x.resumen ? "<p>" + esc(recortar(textoPlano(x.resumen), 160)) + "</p>" : "") + "</div></a>";
  }).join("") + "</div>";
  return h + "</div>";
}

/* ---------- versión para correo electrónico (newsletter) ----------
   Los programas de correo (Gmail, Outlook…) no admiten la web tal cual: ni estilos externos, ni vídeos, ni columnas fijas.
   Esta es la misma información en formato de correo: tablas, estilos en línea e imágenes con dirección completa. */
function renderCorreo(b, cfg, opciones) {
  cfg = cfg || {}; opciones = opciones || {};
  const base = String(opciones.base || cfg.direccion || "").replace(/\/?$/, "/");
  const baja = opciones.baja || "mailto:movimientopatriam@gmail.com?subject=BAJA%20bolet%C3%ADn";
  const G = "#7b1c2c", O = "#a8873a", T = "#1d1719", F = "Georgia, 'Times New Roman', serif";
  const abs = u => { u = String(u || "").trim(); if (!u || /^data:/i.test(u)) return ""; if (/^https?:/i.test(u)) return u; return /^[\w\-./]+$/.test(u) ? base + u.replace(/^\.?\//, "") : ""; };
  const ir = r => base + r;
  const txt = t => esc(textoPlano(t || ""));
  const etiqueta = t => '<p style="margin:0 0 8px;font:600 11px/1.4 ' + F + ';letter-spacing:3px;text-transform:uppercase;color:' + G + '">' + t + "</p>";
  const boton = (href, t) => '<a href="' + esc(href) + '" style="display:inline-block;background:' + G + ';color:#fff;text-decoration:none;font:600 12px ' + F + ';letter-spacing:2px;text-transform:uppercase;padding:11px 22px;border-radius:999px">' + t + " &rarr;</a>";
  const bloque = (cont, fondo) => '<tr><td style="padding:26px 32px;background:' + (fondo || "#ffffff") + '">' + cont + "</td></tr>";
  const sep = '<tr><td style="padding:0 32px;background:#ffffff"><div style="border-top:1px solid #e4d9c7"></div></td></tr>';
  const titulo = (t, tam) => '<h2 style="margin:0 0 10px;font:700 ' + (tam || 22) + "px/1.25 " + F + ";color:" + T + '">' + esc(t) + "</h2>";
  const parr = t => '<p style="margin:0 0 12px;font:400 16px/1.6 ' + F + ";color:" + T + '">' + t + "</p>";
  const img = (src, alt) => src ? '<img src="' + esc(src) + '" alt="' + esc(alt || "") + '" width="536" style="display:block;width:100%;max-width:536px;height:auto;border:0;border-radius:4px;margin:0 0 16px">' : "";
  const num = dosCifras(b.numero), ed = b.editorial || {};
  let h = '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="x-apple-disable-message-reformatting">' +
    "<title>" + esc((cfg.cabecera || "Lo que hay que saber") + " · nº " + num) + "</title></head>" +
    '<body style="margin:0;padding:0;background:#f4ede2">' +
    '<div style="display:none;max-height:0;overflow:hidden">' + esc(ed.titulo || "") + " · " + esc(recortar(textoPlano(primerParrafo(ed.texto)), 120)) + "</div>" +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4ede2"><tr><td align="center" style="padding:20px 10px">' +
    '<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;border-top:5px solid ' + G + '">';
  // ver en el navegador
  h += '<tr><td style="padding:8px 32px;background:#f4ede2;text-align:right;font:400 12px ' + F + ';color:#6b5f58">¿No se ve bien? <a href="' + esc(base) + '" style="color:' + G + '">Ábrelo en la web</a></td></tr>';
  // cabecera
  h += '<tr><td style="padding:24px 32px 14px;text-align:center;background:#faf6ef"><a href="' + esc(base) + '"><img src="' + esc(abs(cfg.logo || "logo.png")) + '" alt="PATRIAM" width="170" style="display:inline-block;width:170px;height:auto;border:0"></a>' +
       '<p style="margin:8px 0 0;font:600 10px ' + F + ';letter-spacing:3px;color:' + T + '">' + esc(lemaDe(cfg)).toUpperCase() + "</p></td></tr>";
  h += '<tr><td style="padding:0"><a href="' + esc(base) + '"><img src="' + esc(abs(cfg.banner || "banner-portada.jpg")) + '" alt="" width="600" style="display:block;width:100%;height:auto;border:0"></a></td></tr>';
  h += '<tr><td style="padding:22px 32px 20px;text-align:center;background:' + G + '">' +
       '<p style="margin:0;font:600 11px ' + F + ';letter-spacing:4px;color:#d9bd7a">' + esc((cfg.subtitulo || "Boletín de noticias").toUpperCase()) + "</p>" +
       '<p style="margin:6px 0 0;font:700 30px/1.15 ' + F + ';letter-spacing:1px;color:#ffffff">' + esc((cfg.cabecera || "Lo que hay que saber").toUpperCase()) + "</p>" +
       '<p style="margin:4px 0 0;font:italic 400 20px ' + F + ';color:#d9bd7a">' + esc(cfg.claim || "con criterio") + "</p>" +
       '<p style="margin:12px 0 0;font:600 12px ' + F + ';letter-spacing:2px;color:#ffffff">Nº ' + num + " · " + esc(fechaLarga(b.fecha).toUpperCase()) + "</p></td></tr>";
  // «Este boletín»: sumario por secciones
  const nsC = (b.noticias || []).filter(n => n.titular || n.url), gruposC = gruposNoticias(nsC);
  const recsC = (b.recomendados || []).map(id => itemBib(cfg, id)).filter(Boolean);
  const filaSum = (nombre, ts) => '<p style="margin:0 0 4px;font:600 11px ' + F + ';letter-spacing:2px;text-transform:uppercase;color:' + O + '">' + esc(nombre) + "</p>" +
    '<ul style="margin:0 0 14px;padding:0 0 0 18px">' + ts.map(t => '<li style="margin:0 0 3px;font:400 15px/1.45 ' + F + ";color:" + T + '">' + esc(t) + "</li>").join("") + "</ul>";
  let sum = "";
  if (ed.titulo) sum += filaSum("Editorial", [ed.titulo]);
  const colsC = (b.colaboraciones || []).filter(c => c.titulo);
  if (colsC.length) sum += filaSum("Firma invitada", colsC.map(c => c.titulo));
  gruposC.forEach(g => sum += filaSum(g.sec.nombre, g.items.map(({ n }) => n.titular || n.url)));
  gruposRecomendados(recsC).forEach(g => sum += filaSum(g.t, g.xs.map(x => x.titulo)));
  if (sum) h += bloque(etiqueta("Este boletín") + sum + boton(base, "Entrar en el boletín"), "#faf6ef");
  // editorial
  if (ed.titulo) {
    const ps = String(ed.texto || "").split(/\n\s*\n/).map(x => x.trim()).filter(Boolean);
    h += bloque(etiqueta("Editorial") + titulo(ed.titulo, 26) + img(abs(ed.imagen), ed.titulo) + ps.slice(0, 2).map(x => parr(esc(textoPlano(x)))).join("") +
      (ed.firma ? '<p style="margin:0 0 16px;font:italic 400 15px ' + F + ";color:" + G + '">' + esc(ed.firma) + "</p>" : "") +
      boton(ir("#/editorial/" + encodeURIComponent(b.id)), "Leer la editorial"));
  }
  // firma invitada
  (b.colaboraciones || []).filter(c => c.titulo).forEach(c => {
    h += sep + bloque(etiqueta("Firma invitada") + titulo(c.titulo) + img(abs(c.imagen), c.titulo) +
      parr(esc(c.entradilla || recortar(textoPlano(primerParrafo(c.texto)), 200))) +
      '<p style="margin:0 0 14px;font:600 14px ' + F + ";color:" + T + '">' + esc(c.autor || "") + (c.cargo ? ' <span style="font-weight:400;color:#6b5f58">· ' + esc(c.cargo) + "</span>" : "") + "</p>" +
      boton(ir(enlaceColaboracion(c)), "Leer el texto"));
  });
  // noticias
  gruposC.forEach(g => {
    h += '<tr><td style="padding:26px 32px 0;background:#ffffff">' + etiqueta(esc(g.sec.nombre)) + "</td></tr>";
    g.items.forEach(({ n }, i) => {
      const yt = idYoutube(n.url), foto = abs(n.imagen) || (yt ? "https://i.ytimg.com/vi/" + yt + "/hqdefault.jpg" : "");
      const sec = seccionDe(n), k = (b.noticias || []).indexOf(n);
      h += bloque((i ? '<div style="border-top:1px solid #e4d9c7;margin:-26px 0 22px"></div>' : "") +
        img(foto, n.titular) +
        '<p style="margin:0 0 6px;font:600 11px ' + F + ';letter-spacing:2px;text-transform:uppercase;color:' + O + '">' + esc(sec ? sec.nombre : "Actualidad") + (n.formato && n.formato !== "Noticia" ? " · " + esc(n.formato) : "") + (n.medio ? ' <span style="color:#6b5f58">· ' + esc(n.medio) + "</span>" : "") + "</p>" +
        titulo(n.titular || n.url, 20) + (n.resumen ? parr(txt(n.resumen)) : "") +
        (n.comentario ? '<div style="margin:4px 0 16px;padding:12px 16px;background:#faf6ef;border-left:3px solid ' + G + '"><p style="margin:0 0 4px;font:600 11px ' + F + ';letter-spacing:2px;text-transform:uppercase;color:' + G + '">' + esc(autorComentario(n, cfg)) + " opina</p>" +
          '<p style="margin:0;font:italic 400 15px/1.55 ' + F + ";color:" + T + '">' + txt(n.comentario) + "</p></div>" : "") +
        boton(yt ? ir("#/leer/" + encodeURIComponent(b.id) + "/" + k) : (abs(n.url) || ir("#/")), yt ? "Ver el vídeo" : n.formato === "Podcast" ? "Escuchar" : "Leer la noticia"));
    });
  });
  // recomendados
  (b.recomendados || []).map(id => itemBib(cfg, id)).filter(Boolean).forEach(x => {
    const tipo = /podcast/i.test(x.tipo || "") ? "Podcast" : (x.tipo || "Recomendado"), yt = idYoutube(x.url) || idYoutube(((x.capitulos || [])[0] || {}).url);
    const foto = abs(x.imagen) || (yt ? "https://i.ytimg.com/vi/" + yt + "/hqdefault.jpg" : "");
    h += bloque(etiqueta(esc(tipo) + " recomendado esta semana") + img(foto, x.titulo) + titulo(x.titulo) +
      (x.medio ? '<p style="margin:0 0 8px;font:600 12px ' + F + ';letter-spacing:1px;color:#6b5f58">' + esc(x.medio) + "</p>" : "") +
      (x.descripcion ? parr(txt(x.descripcion)) : "") +
      (x.comentario ? '<p style="margin:0 0 14px;font:italic 400 15px ' + F + ";color:" + G + '">«' + txt(x.comentario) + "» — " + esc(autorComentario(x, cfg)) + "</p>" : "") +
      boton(ir("#/ver/" + encodeURIComponent(x.id)), (x.capitulos || []).length ? "Ver los capítulos" : "Ver"), "#fbf6ea");
  });
  // agenda
  const ev = todosEventos([b]).proximos;
  if (ev.length) h += bloque(etiqueta("Agenda e iniciativas") + ev.map(e => {
    const d = e.fecha ? new Date(e.fecha + "T12:00:00") : null;
    return '<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 14px"><tr>' +
      '<td width="62" valign="top" style="width:62px"><div style="background:' + G + ';color:#fff;text-align:center;border-radius:4px;padding:6px 0;font:700 20px/1 ' + F + '">' + (d ? d.getDate() : "★") +
      '<div style="font:600 10px ' + F + ';letter-spacing:1px;margin-top:3px">' + (d ? d.toLocaleDateString("es-ES", { month: "short" }).replace(".", "").toUpperCase() : esc(e.tipo || "")) + "</div></div></td>" +
      '<td valign="top" style="padding-left:14px"><p style="margin:0;font:700 16px ' + F + ";color:" + T + '">' + (urlSegura(e.url) ? '<a href="' + esc(e.url) + '" style="color:' + T + '">' + esc(e.titulo) + "</a>" : esc(e.titulo)) + "</p>" +
      '<p style="margin:2px 0 0;font:400 14px/1.5 ' + F + ';color:#5b4f49">' + [e.hora, e.lugar].filter(Boolean).map(esc).join(" · ") + (e.descripcion ? "<br>" + esc(e.descripcion) : "") + "</p></td></tr></table>";
  }).join(""), "#faf6ef");
  // llamada final
  h += bloque('<div style="text-align:center"><p style="margin:0 0 14px;font:italic 400 18px ' + F + ";color:" + G + '">Todo el boletín, con vídeos, podcasts y la biblioteca, en la web</p>' + boton(base, "Ver el boletín completo") + "</div>");
  // pie
  const redes = REDES.filter(r => urlSegura(cfg[r[0]])).map(([k, n]) => '<a href="' + esc(cfg[k]) + '" style="color:#d9bd7a;text-decoration:none;margin:0 8px">' + n + "</a>").join("");
  h += '<tr><td style="padding:26px 32px;background:' + T + ';text-align:center">' +
    '<img src="' + esc(abs(cfg.logoClaro || "logo-claro.png")) + '" alt="PATRIAM" width="130" style="display:inline-block;width:130px;height:auto;border:0">' +
    (redes ? '<p style="margin:14px 0 0;font:600 13px ' + F + '">' + redes + "</p>" : "") +
    '<p style="margin:16px 0 0;font:400 12px/1.6 ' + F + ';color:#bfb3aa">Recibes este correo porque te suscribiste al boletín de la Asociación PATRIAM.<br>' +
    '<a href="' + esc(baja) + '" style="color:#d9bd7a">Darme de baja</a> · <a href="' + esc(ir("#/legal/privacidad")) + '" style="color:#d9bd7a">Privacidad</a></p>' +
    '<p style="margin:10px 0 0;font:400 11px ' + F + ';color:#8a7f78">Asociación PATRIAM · C/ Tórtola, 21, 47012 Valladolid</p></td></tr>';
  return h + "</table></td></tr></table></body></html>";
}

/* ---------- la web completa (index.html) ---------- */
function renderApp(ruta, lista, cfg) {
  cfg = cfg || {};
  const ls = ordenar(lista), ultimo = ls[0];
  if (!ultimo) return renderBoletin(null, cfg);
  const p = ruta.replace(/^#\/?/, "").split("/").map(decodeURIComponent);
  const m = (activo, centro, b) => marco(cfg, b || ultimo, ls, activo, centro);
  const s = SECCIONES.find(x => x.ruta === p[0]);
  if (s) return s.clave === "analisis" ? m("criterio", conPestanas("analisis", paginaSeccion(ls, cfg, s))) : m(s.clave === "actualidad" ? "noticias" : s.clave, paginaSeccion(ls, cfg, s));
  switch (p[0]) {
    case "boletin": {
      const b = ls.find(x => x.id === p[1]) || ls.find(x => String(x.numero) === p[1]) || ultimo;
      const v = b === ultimo ? b : Object.assign({}, b, { _frasePropia: true });
      return m(b === ultimo ? "inicio" : "boletines", centroInicio(v, cfg, ls), v);
    }
    case "leer": return m("noticias", paginaLeer(ls, cfg, p[1], p[2]));
    case "ver": { const x = itemBib(cfg, p[1]) || {}; return m(ES_LIBRO(x.tipo) ? "libros" : ES_PODCAST(x.tipo) ? "podcasts" : (SECCIONES.find(z => z.nombre === x.seccion) || SECCIONES[1]).clave, paginaVer(cfg, p[1], p[2])); }
    case "criterio": return m("criterio", conPestanas("analisis", paginaSeccion(ls, cfg, SECCIONES.find(z => z.clave === "analisis"))));
    case "podcasts": return m("criterio", conPestanas("podcasts", paginaTipo(ls, cfg, "podcasts")));
    case "libros": return m("criterio", conPestanas("libros", paginaTipo(ls, cfg, "libros")));
    case "peliculas": return m("criterio", conPestanas("peliculas", paginaTipo(ls, cfg, "peliculas")));
    case "editoriales": return m("editorial", paginaEditoriales(ls, cfg));
    case "editorial": return m("editorial", paginaEditorial(ls, cfg, p[1]));
    case "colaboraciones": return m("colaboraciones", paginaColaboraciones(ls, cfg));
    case "colaboracion": { const x = todasColaboraciones(ls).find(y => y.c.id === p[1]); const k = x ? claveColab(x.c) : "colaboraciones";
      return m(k === "actualidad" ? "noticias" : k === "analisis" ? "criterio" : k, paginaColaboracion(ls, p[1], cfg)); }
    case "iniciativas": case "eventos": return m("iniciativas", paginaIniciativas(ls));
    case "boletines": return m("boletines", paginaBoletines(ls));
    case "al": return m("", p[1] ? paginaAlMomento(cfg, p[1]) : paginaAlMomentoLista(cfg));
    case "buscar": return m("", paginaBuscar(ls, cfg, p[1] || ""));
    case "legal": return m("", paginaLegal(p[1] || "aviso-legal", cfg));
    case "suscribirse": return m("", paginaSuscribirse(cfg));
    case "baja": return m("", paginaBaja(p[1] || "", p[2] || ""));
    default: return m("inicio", centroInicio(ultimo, cfg, ls));
  }
}

function pie(cfg) {
  cfg = cfg || {};
  const web = cfg.web || "", lema = lemaDe(cfg);
  let h = '<footer class="bol-pie"><div class="ancho bol-pie-in"><div>';
  h += '<img src="' + esc(cfg.logoClaro || "logo-claro.png") + '" alt="PATRIAM">';
  h += '<div class="bol-pie-lema">' + esc(lema) + "</div><p>Acción ciudadana, cultural y social.</p></div>";
  h += '<nav class="bol-pie-menu"><a href="#/">Este boletín</a><a href="#/editoriales">Editorial</a><a href="#/noticias">Actualidad</a><a href="#/historia">Historia</a>' +
       '<a href="#/sociedad">Sociedad</a><a href="#/criterio">Criterio</a><a href="#/colaboraciones">Colaboraciones y quién es quién</a><a href="#/iniciativas">Iniciativas</a><a href="#/boletines">Boletines anteriores</a><a href="#/al">Al momento</a><a href="' + esc((cfg && cfg.tienda) || "https://movimientopatriam.es/tienda") + '" target="_blank" rel="noopener">Tienda</a><a href="#/suscribirse">Suscríbete</a><a href="#/baja">Darse de baja</a></nav>';
  const rs = REDES.filter(r => urlSegura(perfil(cfg, r[0])));
  h += '<div class="bol-pie-der">';
  if (rs.length) h += '<div class="bol-pie-redes">' + rs.map(([k, n]) => '<a href="' + esc(perfil(cfg, k)) + '" target="_blank" rel="noopener" aria-label="' + n + '">' + icono(k) + "</a>").join("") + "</div>";
  if (web) h += '<a class="bol-btn claro-oscuro" href="' + esc(web) + '" target="_blank" rel="noopener">Ir a la web de PATRIAM ' + icono("flecha") + "</a>";
  h += "</div>";
  h += '</div><div class="ancho bol-pie-fin"><span>© ' + new Date().getFullYear() + " " + esc(cfg.asociacion || "PATRIAM") + '</span><nav class="bol-legales">' + LEGALES_ORDEN.map(([k, n]) => '<a href="#/legal/' + k + '">' + n + "</a>").join("") + '</nav><a href="editor.html" target="_blank" rel="noopener">Acceso editor</a>' +
       '<span class="bol-creado">Diseño y desarrollo web: <a href="https://www.odlc.es" target="_blank" rel="noopener">odlc.es</a></span>';
  return h + "</div></footer>";
}

/* ---------- compartir en redes: WhatsApp, X e Instagram, cada uno con su formato ---------- */
function cuentaRed(v) {
  // Acepta «@usuario», «usuario» o el enlace al perfil (https://x.com/usuario, https://instagram.com/usuario)
  v = String(v || "").trim(); if (!v) return "";
  const m = v.match(/^(?:https?:\/\/)?(?:www\.)?(?:x|twitter|instagram)\.com\/@?([\w.]+)/i);
  return (m ? m[1] : v.replace(/^@/, "")).replace(/[^\w.]/g, "");
}
function etiquetasRed(cfg) {
  return String(cfg.etiquetas || "").split(/[\s,]+/).map(t => t.replace(/^#?/, "#")).filter(t => t.length > 1);
}
function datosCompartir(b, cfg) {
  const ed = b.editorial || {};
  return { url: conCodigo(enlaceBoletin(b, cfg)), n: dosCifras(b.numero), fecha: fechaLarga(b.fecha), titulo: ed.titulo || "Lo que hay que saber",
    resumen: recortar(textoPlano(primerParrafo(ed.texto || "")), 220), firma: ed.firma || "" };
}
function textoX(b, cfg) {
  const d = datosCompartir(b, cfg), cuenta = cuentaRed(cfg.x), et = etiquetasRed(cfg).slice(0, 3).join(" ");
  // X cuenta cada enlace como 23 caracteres; el texto se recorta para no pasar de 280
  let t = "📰 Boletín Nº " + d.n + " · «" + d.titulo + "»\nLo que hay que saber, con criterio.";
  if (et) t += "\n" + et;
  const max = 280 - 24 - (cuenta ? cuenta.length + 6 : 0);
  if (t.length > max) t = t.slice(0, max - 1) + "…";
  return "https://x.com/intent/post?text=" + encodeURIComponent(t) + "&url=" + encodeURIComponent(d.url) + (cuenta ? "&via=" + encodeURIComponent(cuenta) : "");
}
function textoWhatsapp(b, cfg) {
  const d = datosCompartir(b, cfg);
  return "https://wa.me/?text=" + encodeURIComponent("*Boletín Nº " + d.n + " de PATRIAM*\n_" + d.titulo + "_\n\n" + d.resumen + "\n\n👉 " + d.url);
}
function textoInstagram(b, cfg) {
  const d = datosCompartir(b, cfg), cuenta = cuentaRed(cfg.instagram), et = etiquetasRed(cfg).join(" ");
  return "📰 Boletín Nº " + d.n + " · " + d.fecha + "\n«" + d.titulo + "»\n\n" + d.resumen + "\n\n" +
    "Lee el boletín completo en el enlace de la bio" + (cuenta ? " de @" + cuenta : "") + ":\n" + d.url + (et ? "\n\n" + et : "");
}
function barraCompartir(b, cfg) {
  const d = datosCompartir(b, cfg);
  window.__compartir = { b, cfg };
  return '<div class="bol-compartir"><span>Compartir el boletín Nº ' + esc(d.n) + "</span><div>" +
    '<a class="bol-comp wa" href="' + esc(textoWhatsapp(b, cfg)) + '" target="_blank" rel="noopener">' + icono("whatsapp") + "WhatsApp</a>" +
    '<a class="bol-comp xx" href="' + esc(textoX(b, cfg)) + '" target="_blank" rel="noopener">' + icono("x") + "X</a>" +
    '<button type="button" class="bol-comp en" onclick="copiarEnlace(this,\'' + esc(d.url) + '\')">' + icono("enlace") + "Copiar enlace</button></div></div>";
}

/* Instagram no deja publicar desde una web: se prepara la imagen (publicación 4:5 o historia 9:16) y el texto */
function cargarImg(src) { return new Promise(ok => { if (!src) return ok(null); const i = new Image(); i.onload = () => ok(i); i.onerror = () => ok(null); i.src = src; }); }
function lineas(ctx, texto, ancho) {
  const out = []; String(texto || "").split(/\n/).forEach(par => {
    let l = ""; par.split(/\s+/).forEach(p => { const t = l ? l + " " + p : p; if (ctx.measureText(t).width > ancho && l) { out.push(l); l = p; } else l = t; });
    out.push(l);
  }); return out;
}
function cubrir(ctx, img, x, y, w, h) {
  const r = Math.max(w / img.width, h / img.height), iw = img.width * r, ih = img.height * r;
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip(); ctx.drawImage(img, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih); ctx.restore();
}
function conFrase(b, cfg) { return b && b.fraseMes && b._frasePropia ? Object.assign({}, cfg, { fraseMes: b.fraseMes, fraseMesAutor: b.fraseMesAutor }) : cfg; }
async function imagenInstagram(b, cfg, formato) {
  cfg = conFrase(b, cfg);
  // Igual que la cabecera de la web: foto principal con «Lo que hay que saber», «con criterio» y la frase del mes
  const HIST = formato === "historia", W = 1080, H = HIST ? 1920 : 1350, d = datosCompartir(b, cfg);
  try { await Promise.all(["800 60px Spectral", "700 60px Spectral", "italic 400 40px Spectral", "italic 600 40px Spectral", "600 40px Spectral"].map(f => document.fonts.load(f))); } catch (e) {}
  const [logo, foto] = await Promise.all([cargarImg(cfg.logo || "logo.png"), cargarImg(urlSegura(b.portada) || b.portada || cfg.banner || "banner-portada.jpg")]);
  const c = document.createElement("canvas"); c.width = W; c.height = H; const x = c.getContext("2d");
  const ACENTO = "#7b1c2c", ORO = "#a8873a", CREMA = "#faf5ec", TINTA = "#3b3335";
  const esp = v => { if ("letterSpacing" in x) x.letterSpacing = v + "px"; };
  const centrado = (t, y) => { x.textAlign = "center"; x.fillText(t, W / 2, y); };
  const ajustar = (t, peso, max, ancho) => { let s = max; do { x.font = peso + " " + s + "px Spectral"; s -= 2; } while (x.measureText(t).width > ancho && s > 20); };
  x.fillStyle = CREMA; x.fillRect(0, 0, W, H);

  // Barra superior clara con el logo y el lema (como en la web)
  const barra = HIST ? 210 : 150;
  if (logo) { const h = HIST ? 92 : 78, w = logo.width * h / logo.height; x.drawImage(logo, W / 2 - w / 2, HIST ? 40 : 18, w, h); }
  x.fillStyle = TINTA; x.font = "600 " + (HIST ? 24 : 21) + "px Spectral"; esp(5);
  centrado(String(lemaDe(cfg)).toUpperCase(), barra - (HIST ? 38 : 26)); esp(0);
  x.fillStyle = ACENTO; x.fillRect(0, barra - 6, W, 6);

  // Foto principal con el velo claro arriba
  const fy = barra, fh = HIST ? 1330 : 1000;
  if (foto) cubrir(x, foto, 0, fy, W, fh); else { x.fillStyle = "#e9dcc8"; x.fillRect(0, fy, W, fh); }
  const velo = x.createLinearGradient(0, fy, 0, fy + fh);
  velo.addColorStop(0, "rgba(250,245,236,.93)"); velo.addColorStop(HIST ? .42 : .5, "rgba(250,245,236,.72)"); velo.addColorStop(HIST ? .62 : .72, "rgba(250,245,236,.12)"); velo.addColorStop(1, "rgba(250,245,236,0)");
  x.fillStyle = velo; x.fillRect(0, fy, W, fh);

  // Mancheta: BOLETÍN DE NOTICIAS · LO QUE HAY QUE SABER · con criterio
  let y = fy + (HIST ? 150 : 95);
  x.fillStyle = ACENTO; x.font = "700 " + (HIST ? 30 : 26) + "px Spectral"; esp(7);
  const sup = String(cfg.subtitulo || "Boletín de noticias").toUpperCase(); const ws = x.measureText(sup).width;
  centrado(sup, y); x.fillRect(W / 2 - ws / 2 - 90, y - 10, 60, 2.5); x.fillRect(W / 2 + ws / 2 + 30, y - 10, 60, 2.5); esp(0);
  const nombre = String(cfg.cabecera || "Lo que hay que saber").toUpperCase();
  ajustar(nombre, "800", HIST ? 104 : 96, W - 90); y += HIST ? 120 : 108;
  x.shadowColor = "rgba(250,245,236,1)"; x.shadowBlur = 18; centrado(nombre, y); x.shadowBlur = 0;
  if (cfg.claim) {
    y += HIST ? 92 : 80; x.font = "italic 600 " + (HIST ? 66 : 58) + "px Spectral";
    const wc = x.measureText(cfg.claim).width; centrado(cfg.claim, y);
    x.fillRect(W / 2 - wc / 2 - 100, y - 18, 70, 3); x.fillRect(W / 2 + wc / 2 + 30, y - 18, 70, 3);
  }

  // Frase del mes en su banda clara
  const frase = String(cfg.fraseMes || "").trim().replace(/^["«“]+|["»”]+$/g, "");
  if (frase) {
    x.font = "italic 600 " + (HIST ? 38 : 33) + "px Spectral";
    const ls = lineas(x, "«" + frase + "»", W - 220).slice(0, 4), lh = HIST ? 50 : 44;
    const alto = ls.length * lh + (cfg.fraseMesAutor ? 52 : 18) + 34, by = y + (HIST ? 60 : 46);
    x.fillStyle = "rgba(250,245,236,.88)"; x.fillRect(80, by, W - 160, alto);
    x.fillStyle = ACENTO; let ty = by + 34 + lh * .55; ls.forEach(l => { centrado(l, ty); ty += lh; });
    if (cfg.fraseMesAutor) { x.font = "800 " + (HIST ? 24 : 21) + "px Spectral"; esp(5); centrado(String(cfg.fraseMesAutor).toUpperCase(), ty + 10); esp(0); }
  }

  // Sello con el número y la fecha, abajo a la derecha de la foto
  const sx = W - 360, sy = fy + fh - 190;
  x.fillStyle = "rgba(250,245,236,.95)"; x.fillRect(sx, sy, 310, 150); x.strokeStyle = ACENTO; x.lineWidth = 2; x.strokeRect(sx + 8, sy + 8, 294, 134);
  x.fillStyle = ACENTO; x.textAlign = "center"; x.font = "800 72px Spectral"; x.fillText("Nº " + d.n, sx + 155, sy + 82);
  x.fillStyle = ORO; x.fillRect(sx + 75, sy + 98, 160, 2); x.fillStyle = TINTA; esp(1); ajustar(d.fecha.toUpperCase(), "700", 20, 270); x.fillText(d.fecha.toUpperCase(), sx + 155, sy + 126); esp(0);

  // Pie granate: título del boletín y dónde leerlo
  const py = fy + fh;
  x.fillStyle = ACENTO; x.fillRect(0, py, W, H - py);
  x.fillStyle = CREMA; x.font = "italic 600 " + (HIST ? 40 : 34) + "px Spectral";
  const tl = lineas(x, "«" + d.titulo + "»", W - 160).slice(0, 2); let ty2 = py + (HIST ? 120 : 82);
  tl.forEach(l => { centrado(l, ty2); ty2 += HIST ? 52 : 44; });
  x.fillStyle = "#d9bd7a"; x.font = "700 " + (HIST ? 28 : 24) + "px Spectral"; esp(3);
  const cuenta = cuentaRed(cfg.instagram);
  centrado(HIST ? d.url.replace(/^https?:\/\//, "") : "BOLETÍN COMPLETO: ENLACE EN LA BIO" + (cuenta ? " · @" + cuenta.toUpperCase() : ""), H - (HIST ? 90 : 34)); esp(0);
  return new Promise(ok => c.toBlob(ok, "image/jpeg", 0.92));
}
/* Ventana para compartir con imagen: Instagram (publicación 4:5 o historia 9:16) y X (16:9) */
let igBlob = null, igFormato = "publicacion", igRed = "instagram";
function textoXPlano(b, cfg) {
  const d = datosCompartir(b, cfg), cuenta = cuentaRed(cfg.x), et = etiquetasRed(cfg).slice(0, 3).join(" ");
  const pie = "\n\n👉 " + d.url + (cuenta ? "\nvía @" + cuenta : "") + (et ? "\n" + et : "");
  const largo = 280 - (pie.length - d.url.length + 23); // X cuenta cada enlace como 23 caracteres
  let t = "📰 Boletín Nº " + d.n + " · «" + d.titulo + "»\n\n" + d.resumen;
  if (t.length > largo) t = t.slice(0, largo - 1).replace(/\s+\S*$/, "") + "…";
  return t + pie;
}
async function pintarRed() {
  const { b, cfg } = window.__compartir; const m = document.getElementById("modalIg");
  m.querySelector(".ig-vista").innerHTML = '<p class="ig-cargando">Preparando la imagen…</p>';
  igBlob = igRed === "x" ? await imagenX(b, cfg, 675) : await imagenInstagram(b, cfg, igFormato);
  m.querySelector(".ig-vista").innerHTML = '<img alt="Imagen para compartir" src="' + URL.createObjectURL(igBlob) + '">';
  m.querySelectorAll("[data-fmt]").forEach(x => x.classList.toggle("activo", x.dataset.fmt === igFormato));
  m.querySelector(".ig-mover").hidden = !(navigator.canShare && navigator.canShare({ files: [new File([igBlob], "boletin.jpg", { type: "image/jpeg" })] }));
}
function abrirInstagram() { abrirRed("instagram"); }
function abrirRed(red) {
  const { b, cfg } = window.__compartir; igRed = red;
  document.getElementById("modalIg") && document.getElementById("modalIg").remove();
  const esX = red === "x", m = document.createElement("div"); m.id = "modalIg"; m.className = "ig-modal";
  m.innerHTML = '<div class="ig-caja"><button class="ig-cerrar" aria-label="Cerrar">×</button>' +
    "<h3>Compartir en " + (esX ? "X" : "Instagram") + '</h3><p class="ig-nota">' + (esX
      ? "Aquí tienes la imagen y el texto preparados para X. Pulsa «Publicar en X» (el texto se pone solo) y añade la imagen descargada; o, en el móvil, «Compartir» y elige X. Aunque no adjuntes la imagen, al pegar el enlace X ya muestra la tarjeta grande del boletín."
      : "Instagram no deja publicar directamente desde una web. Aquí tienes la imagen y el texto ya preparados: en el móvil, pulsa «Compartir» y elige Instagram; en el ordenador, descarga la imagen y copia el texto.") + "</p>" +
    (esX ? "" : '<div class="ig-fmt"><button type="button" data-fmt="publicacion">Publicación</button><button type="button" data-fmt="historia">Historia</button></div>') +
    '<div class="ig-vista"></div><label>Texto' + (esX ? " (máx. 280 caracteres)" : " para la publicación") + '</label><textarea class="ig-texto" rows="7"></textarea>' +
    '<div class="ig-botones">' + (esX ? '<button type="button" class="bol-btn ig-x">Publicar en X</button>' : "") +
    '<button type="button" class="bol-btn ig-mover">Compartir' + (esX ? "" : " (Instagram)") + '</button><button type="button" class="bol-btn claro ig-bajar">Descargar imagen</button>' +
    '<button type="button" class="bol-btn claro ig-copiar">Copiar texto</button></div></div>';
  document.body.appendChild(m);
  const cerrar = () => m.remove();
  m.querySelector(".ig-cerrar").onclick = cerrar;
  m.addEventListener("click", e => { if (e.target === m) cerrar(); });
  m.querySelectorAll("[data-fmt]").forEach(x => x.onclick = () => { igFormato = x.dataset.fmt; pintarRed(); });
  const nombre = () => "boletin-" + dosCifras(b.numero) + "-" + (esX ? "x" : igFormato) + ".jpg";
  m.querySelector(".ig-bajar").onclick = () => { const a = document.createElement("a"); a.href = URL.createObjectURL(igBlob); a.download = nombre(); a.click(); };
  m.querySelector(".ig-copiar").onclick = e => { const t = m.querySelector(".ig-texto").value; (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => { e.target.textContent = "¡Texto copiado!"; setTimeout(() => e.target.textContent = "Copiar texto", 1500); }).catch(() => m.querySelector(".ig-texto").select()); };
  m.querySelector(".ig-mover").onclick = async () => {
    const t = m.querySelector(".ig-texto").value;
    try { await navigator.clipboard.writeText(t); } catch (e) {}
    try { await navigator.share({ files: [new File([igBlob], nombre(), { type: "image/jpeg" })], text: t }); } catch (e) {}
  };
  if (esX) m.querySelector(".ig-x").onclick = () => window.open("https://x.com/intent/post?text=" + encodeURIComponent(m.querySelector(".ig-texto").value), "_blank", "noopener");
  m.querySelector(".ig-texto").value = esX ? textoXPlano(b, cfg) : textoInstagram(b, cfg);
  pintarRed();
}

/* Tarjeta para X (y vista previa de enlaces): 1200×630, como la cabecera de la web */
async function imagenX(b, cfg, alto) {
  cfg = conFrase(b, cfg);
  const W = 1200, H = alto || 630, d = datosCompartir(b, cfg);
  try { await Promise.all(["800 60px Spectral", "700 60px Spectral", "italic 600 40px Spectral", "600 40px Spectral"].map(f => document.fonts.load(f))); } catch (e) {}
  const [logo, foto] = await Promise.all([cargarImg(cfg.logo || "logo.png"), cargarImg(urlSegura(b.portada) || b.portada || cfg.banner || "banner-portada.jpg")]);
  const c = document.createElement("canvas"); c.width = W; c.height = H; const x = c.getContext("2d");
  const ACENTO = "#7b1c2c", ORO = "#a8873a", CREMA = "#faf5ec", TINTA = "#3b3335";
  const esp = v => { if ("letterSpacing" in x) x.letterSpacing = v + "px"; };
  const ajustar = (t, peso, max, ancho) => { let s = max; do { x.font = peso + " " + s + "px Spectral"; s -= 2; } while (x.measureText(t).width > ancho && s > 20); };
  if (foto) cubrir(x, foto, 0, 0, W, H); else { x.fillStyle = "#e9dcc8"; x.fillRect(0, 0, W, H); }
  const velo = x.createLinearGradient(0, 0, W, 0);
  velo.addColorStop(0, "rgba(250,245,236,.95)"); velo.addColorStop(.5, "rgba(250,245,236,.86)"); velo.addColorStop(.72, "rgba(250,245,236,.25)"); velo.addColorStop(1, "rgba(250,245,236,0)");
  x.fillStyle = velo; x.fillRect(0, 0, W, H);
  x.fillStyle = ACENTO; x.fillRect(0, 0, W, 10); x.fillRect(0, H - 10, W, 10);
  const cx = 360, ancho = 640; x.textAlign = "center";
  if (logo) { const h = 62, w = logo.width * h / logo.height; x.drawImage(logo, cx - w / 2, 36, w, h); }
  x.fillStyle = ACENTO; x.font = "700 20px Spectral"; esp(6); x.fillText(String(cfg.subtitulo || "Boletín de noticias").toUpperCase(), cx, 140); esp(0);
  ajustar(String(cfg.cabecera || "Lo que hay que saber").toUpperCase(), "800", 66, ancho); x.fillText(String(cfg.cabecera || "Lo que hay que saber").toUpperCase(), cx, 214);
  let y = 214;
  if (cfg.claim) { y += 62; x.font = "italic 600 44px Spectral"; const wc = x.measureText(cfg.claim).width; x.fillText(cfg.claim, cx, y); x.fillRect(cx - wc / 2 - 70, y - 14, 50, 2.5); x.fillRect(cx + wc / 2 + 20, y - 14, 50, 2.5); }
  const frase = String(cfg.fraseMes || "").trim().replace(/^["«“]+|["»”]+$/g, "");
  y += 30; x.fillStyle = ORO; x.fillRect(cx - 50, y, 100, 2);
  if (frase) {
    x.fillStyle = TINTA; x.font = "italic 600 27px Spectral"; y += 46;
    lineas(x, "«" + frase + "»", ancho - 40).slice(0, 3).forEach(l => { x.fillText(l, cx, y); y += 36; });
    if (cfg.fraseMesAutor) { x.fillStyle = ACENTO; x.font = "800 17px Spectral"; esp(4); x.fillText(String(cfg.fraseMesAutor).toUpperCase(), cx, y + 6); esp(0); y += 36; }
  }
  x.fillStyle = ACENTO; x.font = "italic 600 26px Spectral";
  const tl = lineas(x, "Nº " + d.n + " · «" + d.titulo + "»", ancho).slice(0, 2); let ty = Math.max(y + 34, H - 50 - tl.length * 32); tl.forEach(l => { x.fillText(l, cx, ty); ty += 32; });
  const sx = W - 300, sy = H - 190;
  x.fillStyle = "rgba(250,245,236,.95)"; x.fillRect(sx, sy, 250, 140); x.strokeStyle = ACENTO; x.lineWidth = 2; x.strokeRect(sx + 7, sy + 7, 236, 126);
  x.fillStyle = ACENTO; x.font = "800 64px Spectral"; x.fillText("Nº " + d.n, sx + 125, sy + 76);
  x.fillStyle = ORO; x.fillRect(sx + 55, sy + 92, 140, 2); x.fillStyle = TINTA; esp(1); ajustar(d.fecha.toUpperCase(), "700", 17, 215); x.fillText(d.fecha.toUpperCase(), sx + 125, sy + 118); esp(0);
  return new Promise(ok => c.toBlob(ok, "image/jpeg", 0.9));
}

/* ---------- Comunicación personalizada por correo («Buenos días, Nombre:» + texto + firma) ----------
   %%NOMBRE%% lo cambia el servidor por el nombre de cada persona; el bloque <!--BAJA-->…<!--/BAJA-->
   solo se deja a quien está apuntado al boletín, con su enlace de baja (%%BAJA%%). */
function saludoComunicacion(c, aj, nombre) {
  const s = String((c && c.saludo) || (aj && aj.saludo) || "Buenos días").trim();
  return nombre ? s + ", " + nombre + ":" : s + ":";
}
function renderComunicacion(c, aj, cfg, opciones) {
  c = c || {}; aj = aj || {}; cfg = cfg || {}; opciones = opciones || {};
  const base = String(opciones.base || "https://boletin.movimientopatriam.es/").replace(/\/?$/, "/");
  const G = "#7b1c2c", T = "#1d1719", F = "Georgia, 'Times New Roman', serif";
  const abs = u => { u = String(u || "").trim(); if (!u) return ""; if (/^(https?:|data:)/i.test(u)) return u; return /^[\w\-./]+$/.test(u) ? base + u.replace(/^\.?\//, "") : ""; };
  const nombre = opciones.nombre === undefined ? "%%NOMBRE%%" : esc(opciones.nombre);
  const estilo = h => h
    .replace(/<p>/g, '<p style="margin:0 0 14px;font:400 16px/1.6 ' + F + ";color:" + T + '">')
    .replace(/<h2>/g, '<h2 style="margin:18px 0 10px;font:700 19px/1.3 ' + F + ";color:" + G + '">')
    .replace(/<blockquote>/g, '<blockquote style="margin:0 0 14px;padding:10px 16px;border-left:3px solid ' + G + ";background:#faf6ef;font:italic 400 16px/1.55 " + F + ";color:" + T + '">')
    .replace(/<ul>/g, '<ul style="margin:0 0 14px;padding-left:22px;font:400 16px/1.6 ' + F + ";color:" + T + '">')
    .replace(/<a href=/g, '<a style="color:' + G + '" href=');
  const s = String((c.saludo || aj.saludo || "Buenos días")).trim();
  const saludo = '<p style="margin:0 0 16px;font:400 16px/1.6 ' + F + ";color:" + T + '">' + esc(s) + (opciones.nombre === "" ? ":" : ", " + nombre + ":") + "</p>";
  const firmaImg = abs(aj.firmaImagen);
  const firma = (aj.firmaTexto ? estilo(maquetar(aj.firmaTexto)) : "") +
    (firmaImg ? '<img src="' + esc(firmaImg) + '" alt="' + esc(aj.remitenteNombre || "PATRIAM") + '" style="display:block;max-width:100%;width:auto;height:auto;border:0;margin:6px 0 0">' : "");
  return '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="x-apple-disable-message-reformatting">' +
    "<title>" + esc(c.asunto || "PATRIAM") + "</title></head>" +
    '<body style="margin:0;padding:0;background:#f4ede2">' +
    '<div style="display:none;max-height:0;overflow:hidden">' + esc(recortar(textoPlano(primerParrafo(c.texto)), 110)) + "</div>" +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4ede2"><tr><td align="center" style="padding:20px 10px">' +
    '<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;border-top:5px solid ' + G + '">' +
    '<tr><td style="padding:22px 32px 6px"><img src="' + esc(abs(cfg.logo || "logo.png")) + '" alt="PATRIAM" width="120" style="display:block;width:120px;height:auto;border:0"></td></tr>' +
    '<tr><td style="padding:16px 32px 26px">' + saludo + estilo(maquetar(c.texto)) +
    (firma ? '<div style="margin-top:22px">' + firma + "</div>" : "") + "</td></tr>" +
    '<tr><td style="padding:14px 32px;background:#faf6ef;border-top:1px solid #e4d9c7;font:400 12px/1.5 ' + F + ';color:#6b5f58">' +
    esc(lemaDe(cfg)) + " · Asociación PATRIAM · " + '<a href="https://movimientopatriam.es" style="color:' + G + '">movimientopatriam.es</a>' +
    '<!--BAJA--><br>Recibes este correo porque estás apuntado al boletín de PATRIAM. <a href="%%BAJA%%" style="color:' + G + '">Darme de baja</a><!--/BAJA-->' +
    "</td></tr></table></td></tr></table></body></html>";
}
/* Texto sin formato (para la versión de texto del correo y para WhatsApp) */
function textoComunicacion(c, aj, nombre) {
  const plano = t => String(t || "").replace(/^##\s+|^>\s?|^-\s+/gm, "").replace(/\*\*|\*/g, "").replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)").trim();
  return [saludoComunicacion(c, aj, nombre), plano(c.texto), plano(aj.firmaTexto)].filter(Boolean).join("\n\n");
}
