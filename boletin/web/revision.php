<?php
/* Revisión del autor: boletin.movimientopatriam.es/revision/<token>
   Enseña SOLO su artículo, tal como saldrá, para que dé el visto bueno o pida cambios antes de publicarlo.
   Se entra con la clave que se le manda con el enlace. No lo indexa Google. */
require __DIR__ . '/_privado.php';
header('X-Robots-Tag: noindex, nofollow');
header('Cache-Control: no-store');
header('Referrer-Policy: same-origin');

$f = privado() . '/aportaciones.json';
$leer = fn() => is_file($f) ? (json_decode(file_get_contents($f), true) ?: []) : [];
$token = (string)($_GET['t'] ?? '');
$e = fn($t) => htmlspecialchars((string)$t, ENT_QUOTES, 'UTF-8');

function buscaRev($d, $token) {
  if (!preg_match('/^[0-9a-f]{24}$/', $token)) return [null, null];
  foreach ($d['revisiones'] ?? [] as $id => $r) if (hash_equals($r['token'] ?? '', $token)) return [$id, $r];
  return [null, null];
}
function galleta($r) { return hash_hmac('sha256', $r['token'] . '|' . $r['clave'], $r['token'] . 'patriam-revision'); }
function pagina($titulo, $cuerpo) {
  header('Content-Type: text/html; charset=utf-8');
  echo '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">'
     . '<meta name="robots" content="noindex,nofollow"><title>' . htmlspecialchars($titulo, ENT_QUOTES, 'UTF-8') . ' · PATRIAM</title><link rel="icon" href="/icono-192.png">'
     . '<style>body{margin:0;background:#f4efe6;font-family:Georgia,serif;color:#2b2420}'
     . '.aviso{position:sticky;top:0;background:#7b1c2c;color:#fff;font:600 13px/1.3 system-ui,sans-serif;text-align:center;padding:8px 12px;z-index:5}'
     . '.c{background:#fffdf8;border:1px solid #e2d8c8;border-top:5px solid #7b1c2c;border-radius:6px;padding:2rem 1.6rem;width:min(760px,calc(100vw - 32px));box-sizing:border-box;margin:24px auto}'
     . '.c.peq{width:min(380px,calc(100vw - 32px));text-align:center;margin-top:12vh}.logo{width:64px}'
     . 'h1{font-size:clamp(1.6rem,4vw,2.3rem);line-height:1.12;margin:.4rem 0 .6rem}.ent{font-style:italic;font-size:1.12rem;color:#4a3f3a}'
     . '.firma{font-weight:700;margin:.6rem 0 1rem}.firma small{display:block;font-weight:400;color:#7a6d66}'
     . 'img.art{display:block;width:100%;height:auto;object-fit:contain;background:#efe6d6;border-radius:4px;margin:1rem 0}'
     . '.txt p{font-size:1.06rem;line-height:1.7;margin:0 0 1rem}.txt h2{font-size:1.3rem;color:#7b1c2c;margin:1.6rem 0 .6rem}.txt blockquote{margin:1rem 0;padding:.4rem 1rem;border-left:3px solid #b8954b;font-style:italic}'
     . 'p.n{font-family:system-ui,sans-serif;font-size:.92rem;color:#5a4f46;line-height:1.45}'
     . 'input,textarea{width:100%;box-sizing:border-box;font-size:1rem;padding:.7rem;border:1px solid #cbbfae;border-radius:4px;margin:.5rem 0;font-family:system-ui,sans-serif}'
     . 'input[type=password]{text-align:center;letter-spacing:.12em;font-size:1.1rem}'
     . 'button{background:#7b1c2c;color:#fff;border:0;border-radius:4px;padding:.75rem 1.2rem;font-size:1rem;cursor:pointer;font-family:system-ui,sans-serif}'
     . 'button.sec{background:#fff;color:#7b1c2c;border:1px solid #7b1c2c}.botones{display:flex;flex-wrap:wrap;gap:.6rem}'
     . '.resp{margin-top:2rem;padding-top:1.4rem;border-top:2px solid #7b1c2c}.ok{color:#1f6b3a;font-weight:700}.err{color:#a3242f;font-weight:600}</style></head><body>'
     . $cuerpo . '</body></html>';
  exit;
}
function claveForm($titulo, $error = '') {
  pagina($titulo, '<div class="c peq"><img class="logo" src="/logo.png" alt="PATRIAM"><h1 style="font-size:1.35rem">Revisa tu artículo</h1>'
    . '<p class="n">Escribe la clave que te hemos mandado con el enlace.</p>' . ($error ? '<p class="err">' . htmlspecialchars($error, ENT_QUOTES, 'UTF-8') . '</p>' : '')
    . '<form method="post" autocomplete="off"><input name="clave" type="password" placeholder="Clave" autofocus required><button style="width:100%">Entrar</button></form></div>');
}
/* Texto del artículo: párrafos, ## subtítulos, > citas, **negrita**, *cursiva* y [enlaces](url) */
function maquetarRev($t) {
  $h = '';
  foreach (preg_split('/\n\s*\n/', str_replace("\r", '', (string)$t)) as $b) {
    $b = trim($b); if ($b === '') continue;
    $x = htmlspecialchars($b, ENT_QUOTES, 'UTF-8');
    $x = preg_replace('/\*\*(.+?)\*\*/s', '<b>$1</b>', $x);
    $x = preg_replace('/\*(.+?)\*/s', '<i>$1</i>', $x);
    $x = preg_replace('/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/', '<a href="$2" target="_blank" rel="noopener">$1</a>', $x);
    if (preg_match('/^##\s+/', $b)) $h .= '<h2>' . preg_replace('/^##\s+/', '', $x) . '</h2>';
    elseif (preg_match('/^&gt;\s?/', $x)) $h .= '<blockquote>' . nl2br(preg_replace('/^&gt;\s?/m', '', $x)) . '</blockquote>';
    else $h .= '<p>' . nl2br($x) . '</p>';
  }
  return $h;
}

$d = $leer();
[$id, $r] = buscaRev($d, $token);
if (!$r) { http_response_code(404); pagina('Enlace no válido', '<div class="c peq"><img class="logo" src="/logo.png" alt="PATRIAM"><h1 style="font-size:1.35rem">Enlace no válido</h1><p class="n">Este enlace ya no está disponible. Pide uno nuevo a PATRIAM.</p></div>'); }

$ck = 'rv_' . $r['token'];
$dentro = hash_equals(galleta($r), (string)($_COOKIE[$ck] ?? ''));
if (!$dentro && $_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['clave'])) {
  if (hash_equals(strtolower($r['clave']), strtolower(trim((string)$_POST['clave'])))) {
    setcookie($ck, galleta($r), ['expires' => time() + 60 * 86400, 'path' => '/', 'secure' => true, 'httponly' => true, 'samesite' => 'Lax']);
    header('Location: /revision/' . $r['token'], true, 303); exit;
  }
  usleep(900000); claveForm('Revisa tu artículo', 'La clave no es correcta.');
}
if (!$dentro) claveForm('Revisa tu artículo');

/* Respuesta del autor: visto bueno o cambios */
$gracias = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['respuesta'])) {
  $resp = $_POST['respuesta'] === 'ok' ? 'ok' : 'cambios';
  $com = mb_substr(trim(str_replace("\r", '', (string)($_POST['comentario'] ?? ''))), 0, 5000);
  $fp = fopen($f, 'c+'); flock($fp, LOCK_EX);
  $d2 = json_decode(stream_get_contents($fp), true) ?: [];
  if (isset($d2['revisiones'][$id])) {
    $d2['revisiones'][$id]['respuesta'] = $resp; $d2['revisiones'][$id]['comentario'] = $com; $d2['revisiones'][$id]['respondido'] = gmdate('c');
    ftruncate($fp, 0); rewind($fp); fwrite($fp, json_encode($d2, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)); fflush($fp);
    $r = $d2['revisiones'][$id];
  }
  flock($fp, LOCK_UN); fclose($fp);
  $gracias = $resp === 'ok' ? '<p class="ok">¡Gracias! Hemos recibido tu visto bueno.</p>' : '<p class="ok">Gracias. Hemos recibido tus cambios y los revisaremos.</p>';
}

$a = $r['datos'] ?? [];
$h = '<div class="aviso">Borrador de tu artículo para el boletín de PATRIAM · Solo para ti · No lo compartas todavía</div><div class="c">';
$h .= '<img class="logo" src="/logo.png" alt="PATRIAM">';
$h .= '<h1>' . $e($a['titulo'] ?? '') . '</h1>';
if (!empty($a['entradilla'])) $h .= '<p class="ent">' . $e($a['entradilla']) . '</p>';
$h .= '<p class="firma">' . $e($a['autor'] ?? '') . (!empty($a['cargo']) ? '<small>' . $e($a['cargo']) . '</small>' : '') . '</p>';
if (!empty($a['imagen']) && preg_match('#^https?://#i', $a['imagen'])) $h .= '<img class="art" src="' . $e($a['imagen']) . '" alt="">';
$h .= '<div class="txt">' . maquetarRev($a['texto'] ?? '') . '</div>';
$h .= '<div class="resp" id="respuesta">' . $gracias;
if (($r['respuesta'] ?? '') === 'ok' && !$gracias) $h .= '<p class="ok">Ya nos diste tu visto bueno. Si quieres cambiar algo, escríbelo aquí.</p>';
$h .= '<p class="n">¿Está bien así? Si quieres cambiar algo, escríbelo aquí abajo (qué párrafo y cómo debe quedar).</p>'
    . '<form method="post" action="#respuesta"><textarea name="comentario" rows="5" placeholder="Cambios que quieres hacer (si no hay ninguno, déjalo en blanco)">' . $e($r['comentario'] ?? '') . '</textarea>'
    . '<div class="botones"><button name="respuesta" value="ok">✓ Doy mi visto bueno</button><button class="sec" name="respuesta" value="cambios">Enviar mis cambios</button></div></form>';
$h .= '</div></div>';
pagina($a['titulo'] ?? 'Tu artículo', $h);
