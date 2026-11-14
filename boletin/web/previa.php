<?php
/* Vista previa del equipo: boletin.movimientopatriam.es/previa/<token>
   Enlace temporal que se crea en Publicar › Boletín y solo se abre con su clave.
   Enseña el número abierto con TODO lo que lleva, también lo pendiente de aprobar.
   Caduca el día siguiente a la salida del número. No la indexa Google. */
require __DIR__ . '/_privado.php';
require __DIR__ . '/_previa.php';
header('X-Robots-Tag: noindex, nofollow');
header('Cache-Control: no-store');
header('Referrer-Policy: same-origin');

$token = (string)($_GET['t'] ?? '');
$f = privado() . '/aportaciones.json';
$d = is_file($f) ? (json_decode(file_get_contents($f), true) ?: []) : [];
$p = previaValida($d, $token);

function paginaClave($titulo, $texto, $form, $error = '') {
  header('Content-Type: text/html; charset=utf-8');
  $e = fn($t) => htmlspecialchars($t, ENT_QUOTES, 'UTF-8');
  echo '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">'
     . '<meta name="robots" content="noindex,nofollow"><title>' . $e($titulo) . ' · PATRIAM</title><link rel="icon" href="/icono-192.png">'
     . '<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f4efe6;font-family:Georgia,serif;color:#2b2420}'
     . '.c{background:#fffdf8;border:1px solid #e2d8c8;border-top:5px solid #7b1c2c;border-radius:6px;padding:2rem 1.6rem;width:min(380px,calc(100vw - 32px));box-sizing:border-box;text-align:center}'
     . 'img{width:64px}h1{font-size:1.35rem;margin:.6rem 0 .4rem}p{font-family:system-ui,sans-serif;font-size:.92rem;color:#5a4f46;line-height:1.45}'
     . 'input{width:100%;box-sizing:border-box;font-size:1.1rem;padding:.7rem;border:1px solid #cbbfae;border-radius:4px;text-align:center;letter-spacing:.12em;margin:.6rem 0}'
     . 'button{width:100%;background:#7b1c2c;color:#fff;border:0;border-radius:4px;padding:.75rem;font-size:1rem;cursor:pointer}.err{color:#a3242f;font-weight:600}</style></head><body><div class="c">'
     . '<img src="/logo.png" alt="PATRIAM"><h1>' . $e($titulo) . '</h1><p>' . $texto . '</p>'
     . ($error ? '<p class="err">' . $e($error) . '</p>' : '')
     . ($form ? '<form method="post" autocomplete="off"><input name="clave" type="password" placeholder="Clave" autofocus required><button>Entrar</button></form>' : '')
     . '</div></body></html>';
  exit;
}

if (!$p) { http_response_code(404); paginaClave('Enlace caducado', 'Esta vista previa ya no está disponible. Pide un enlace nuevo en Publicar › Boletín.', false); }

$num = (int)$p['numero'];
$cookie = 'pv_' . $p['token'];
$dentro = hash_equals(cookiePrevia($p), (string)($_COOKIE[$cookie] ?? ''));

if (!$dentro && $_SERVER['REQUEST_METHOD'] === 'POST') {
  if (hash_equals(strtolower($p['clave']), strtolower(trim((string)($_POST['clave'] ?? ''))))) {
    setcookie($cookie, cookiePrevia($p), ['expires' => strtotime($p['expira']), 'path' => '/', 'secure' => true, 'httponly' => true, 'samesite' => 'Lax']);
    header('Location: /previa/' . $p['token'], true, 303);
    exit;
  }
  usleep(900000);
  paginaClave('Vista previa del boletín nº ' . $num, 'Solo para el equipo de PATRIAM.', true, 'La clave no es correcta.');
}
if (!$dentro) paginaClave('Vista previa del boletín nº ' . $num, 'Solo para el equipo de PATRIAM. Escribe la clave que te han pasado con el enlace.', true);

/* Dentro: el boletín de siempre, con el número abierto y todo lo que lleva (también lo pendiente) */
$h = @file_get_contents(__DIR__ . '/index.html');
if (!$h) { http_response_code(500); exit('No se encuentra el boletín.'); }
$base = '/previa/' . $p['token'];
$cfg = json_encode(['numero' => $num, 'token' => $p['token'], 'base' => $base, 'expira' => $p['expira']], JSON_UNESCAPED_SLASHES);
$h = str_replace('<head>', '<head><meta name="robots" content="noindex,nofollow">', $h);
$h = str_replace('<script src="boletines.js">', '<script>window.PATRIAM_PREVIA = ' . $cfg . ';</script><script src="boletines.js">', $h);
// Lo aprobado y lo pendiente del nº que se está viendo (aportar.php comprueba la clave con la cookie)
$h = str_replace("aportaciones.js?m=' + ", "aportar.php?accion=js&previa=" . $p['token'] . "&m=' + ", $h);
// Las direcciones se quedan dentro de la vista previa
$h = str_replace('function direccionDe(r) {', 'function direccionDe(r) { if (window.PATRIAM_PREVIA) return window.PATRIAM_PREVIA.base + (r && r !== "#/" ? r : "");', $h);
$h = str_replace(': "/" + destino);', ': direccionDe(destino));', $h);
// Sin estadísticas: las visitas del equipo no cuentan
$h = str_replace('function medir(ev) {', 'function medir(ev) { if (window.PATRIAM_PREVIA) return;', $h);
// Aviso arriba
$aviso = '<div style="position:sticky;top:0;z-index:9999;background:#7b1c2c;color:#fff;font:600 13px/1.3 system-ui,sans-serif;text-align:center;padding:7px 12px">'
       . 'Vista previa del equipo · Boletín nº ' . $num . ' · Incluye lo pendiente de aprobar · No la compartas fuera de PATRIAM</div>';
$h = preg_replace('/<body>/', '<body>' . $aviso, $h, 1);
header('Content-Type: text/html; charset=utf-8');
echo $h;
