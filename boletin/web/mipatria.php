<?php
/* «España al día» como página propia y newsletter diaria: boletin.movimientopatriam.es/mipatriaaldia
   - GET: la página (se genera en el servidor, con su tarjeta para WhatsApp y las noticias de hoy; la semana entera va en el boletín, «España semana a semana»).
   - POST ?accion=alta {email}: alta en la newsletter diaria (se confirma con un enlace que llega por correo).
   - ?accion=confirmar / ?accion=baja: con enlace firmado.
   - Envío diario: lo lanza el cron de Hostinger por consola («php mipatria.php enviar»), no se puede lanzar desde fuera.
   Los correos se mandan con Brevo (la misma clave y remitente que las comunicaciones del editor).
   La lista va en la carpeta privada del servidor: mipatria-suscriptores.json */
require __DIR__ . '/_privado.php';

const WEB_MP = 'https://boletin.movimientopatriam.es';
const URL_MP = WEB_MP . '/mipatriaaldia';
const URL_SEMANA = WEB_MP . '/#/espana-al-dia';   // la semana entera va en el boletín: «España semana a semana»
$CLI = PHP_SAPI === 'cli';
$acc = $CLI ? ($argv[1] ?? '') : ($_GET['accion'] ?? '');

function e($x) { return htmlspecialchars((string)$x, ENT_QUOTES, 'UTF-8'); }
function noticias() {
  $t = @file_get_contents(__DIR__ . '/espana-al-dia.js') ?: '';
  $d = preg_match('/=\s*(\{.*\})\s*;?\s*$/s', $t, $m) ? (json_decode($m[1], true) ?: []) : [];
  // Las que el equipo mete a mano desde Publicar («no puede faltar»): delante, siete días
  $ap = is_file(privado() . '/aportaciones.json') ? (json_decode(file_get_contents(privado() . '/aportaciones.json'), true) ?: []) : [];
  $fijas = [];
  foreach ($ap['items'] ?? [] as $x) {
    if (($x['tipo'] ?? '') !== 'espana' || ($x['estado'] ?? '') !== 'aprobado' || strtotime($x['creado'] ?? '') < time() - 7 * 86400) continue;
    $v = $x['datos'];
    $fijas[] = ['titulo' => $v['titulo'], 'resumen' => $v['resumen'] ?? '', 'imagen' => $v['imagen'] ?? '', 'fecha' => $x['creado'], 'tema' => $v['tema'] ?? 'Política', 'destacada' => true, 'medios' => [['medio' => $v['medio'] ?? 'Abrir', 'url' => $v['url']]]];
  }
  usort($fijas, fn($a, $b) => strcmp($b['fecha'], $a['fecha']));
  $urls = array_map(fn($f) => $f['medios'][0]['url'], $fijas);
  $auto = array_values(array_filter($d['grupos'] ?? [], fn($g) => !array_intersect(array_column($g['medios'] ?? [], 'url'), $urls)));
  // dentro de cada día, las destacadas primero
  $todo = array_merge($fijas, $auto);
  usort($todo, fn($a, $b) => strcmp(substr(dia2($b['fecha']), 0, 10), substr(dia2($a['fecha']), 0, 10)) ?: (!empty($b['destacada']) <=> !empty($a['destacada'])) ?: (count($b['medios']) <=> count($a['medios'])) ?: strcmp($b['fecha'], $a['fecha']));
  foreach ($todo as &$x) if (empty($x['asunto'])) $x['asunto'] = asuntoDe($x['titulo'] . ' ' . ($x['resumen'] ?? ''));
  unset($x);
  $d['grupos'] = $todo;
  return $d;
}
// Asuntos (huelga, elecciones…): los mismos patrones que usa el script de GitHub, en web/espana-asuntos.json
function sinTildes($t) { return strtr(mb_strtolower((string)$t, 'UTF-8'), ['á'=>'a','à'=>'a','ä'=>'a','â'=>'a','é'=>'e','è'=>'e','ë'=>'e','ê'=>'e','í'=>'i','ì'=>'i','ï'=>'i','î'=>'i','ó'=>'o','ò'=>'o','ö'=>'o','ô'=>'o','ú'=>'u','ù'=>'u','ü'=>'u','û'=>'u','ñ'=>'n','ç'=>'c']); }
function asuntos() { static $a = null; if ($a === null) $a = (json_decode(@file_get_contents(__DIR__ . '/espana-asuntos.json') ?: '', true) ?: [])['asuntos'] ?? []; return $a; }
function asuntoDe($texto) { $t = sinTildes($texto); foreach (asuntos() as $a) if (@preg_match('/' . str_replace('/', '\\/', $a['patron']) . '/i', $t)) return $a['nombre']; return 'Otros'; }
function slug($t) { return trim(preg_replace('/[^a-z0-9]+/', '-', sinTildes($t)), '-'); }
function dia2($iso) { return (new DateTime($iso))->setTimezone(new DateTimeZone('Europe/Madrid'))->format('Y-m-d'); }
function lista() { $f = privado() . '/mipatria-suscriptores.json'; return is_file($f) ? (json_decode(file_get_contents($f), true) ?: []) : []; }
function guardarLista($l) { $f = privado() . '/mipatria-suscriptores.json'; file_put_contents($f . '.tmp', json_encode($l, JSON_UNESCAPED_UNICODE), LOCK_EX); rename($f . '.tmp', $f); @chmod($f, 0600); }
function firma($email, $que) { return substr(hash_hmac('sha256', 'mp|' . $que . '|' . strtolower($email), secreto()), 0, 20); }
function enlace($email, $que) { return URL_MP . '?accion=' . $que . '&e=' . rawurlencode($email) . '&f=' . firma($email, $que); }
function brevo($para, $asunto, $html, $texto, $baja = '') {
  $k = is_file(privado() . '/claves.json') ? (json_decode(file_get_contents(privado() . '/claves.json'), true) ?: []) : [];
  $aj = (is_file(privado() . '/com.json') ? (json_decode(file_get_contents(privado() . '/com.json'), true) ?: []) : [])['ajustes'] ?? [];
  if (empty($k['brevo']) || empty($aj['remitente'])) return [false, 'Falta la clave de Brevo o el remitente (editor → Comunicaciones → Claves de envío / Firma y remitente).'];
  $msg = ['sender' => ['name' => 'PATRIAM · España al día', 'email' => $aj['remitente']], 'to' => [['email' => $para]], 'subject' => $asunto,
    'htmlContent' => $html, 'textContent' => $texto, 'tags' => ['espana-al-dia']];
  if (!empty($aj['responderA'])) $msg['replyTo'] = ['email' => $aj['responderA']];
  if ($baja) $msg['headers'] = ['List-Unsubscribe' => '<' . $baja . '>', 'List-Unsubscribe-Post' => 'List-Unsubscribe=One-Click'];
  [$c, $r, $err] = pedir('https://api.brevo.com/v3/smtp/email', ['api-key: ' . $k['brevo'], 'Content-Type: application/json', 'Accept: application/json'], json_encode($msg, JSON_UNESCAPED_UNICODE));
  return [$c >= 200 && $c < 300, $c >= 200 && $c < 300 ? '' : ((json_decode($r, true)['message'] ?? '') ?: ($err ?: 'Brevo ' . $c))];
}
function dia($iso) {
  $z = new DateTimeZone('Europe/Madrid');
  $d = (new DateTime($iso))->setTimezone($z); $hoy = new DateTime('now', $z);
  if ($d->format('Y-m-d') === $hoy->format('Y-m-d')) return 'Hoy';
  if ($d->format('Y-m-d') === (clone $hoy)->modify('-1 day')->format('Y-m-d')) return 'Ayer';
  $dias = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  $meses = ['', 'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  return ucfirst($dias[(int)$d->format('w')]) . ' ' . (int)$d->format('j') . ' de ' . $meses[(int)$d->format('n')];
}
function diaLargo() {
  $d = new DateTime('now', new DateTimeZone('Europe/Madrid'));
  $dias = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  $meses = ['', 'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  return $dias[(int)$d->format('w')] . ' ' . (int)$d->format('j') . ' de ' . $meses[(int)$d->format('n')];
}
function hora($iso) { return (new DateTime($iso))->setTimezone(new DateTimeZone('Europe/Madrid'))->format('H:i'); }
function pagina($titulo, $cuerpo) {
  echo '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' . e($titulo) . '</title><meta name="robots" content="noindex"><link rel="icon" href="/icono-192.png">'
    . '<style>body{margin:0;background:#faf5ec;font-family:Georgia,serif;color:#2a211d;display:grid;place-items:center;min-height:100vh;padding:20px;box-sizing:border-box}div{max-width:520px;text-align:center;background:#fff;border-top:5px solid #7b1c2c;padding:28px}a{color:#7b1c2c;font-weight:700}</style></head><body><div><img src="/logo.png" alt="PATRIAM" style="height:54px"><h1 style="color:#7b1c2c">' . e($titulo) . '</h1>' . $cuerpo . '</div></body></html>';
  exit;
}

/* ---------- alta, confirmación y baja ---------- */
if ($acc === 'alta') {
  header('Content-Type: application/json; charset=utf-8');
  $email = strtolower(trim((string)(json_decode(file_get_contents('php://input') ?: '{}', true)['email'] ?? ($_POST['email'] ?? ''))));
  if (!preg_match('/^[^@\s]+@[^@\s]+\.[^@\s]+$/', $email) || strlen($email) > 160) salir(['error' => 'Ese correo no parece válido.'], 400);
  $l = lista();
  if (($l[$email]['estado'] ?? '') === 'activo') salir(['ok' => true, 'ya' => true]);
  $l[$email] = ['estado' => 'pendiente', 'alta' => gmdate('c')] + ($l[$email] ?? []);
  guardarLista($l);
  $c = enlace($email, 'confirmar');
  $html = '<div style="font-family:Georgia,serif;max-width:520px;margin:auto;color:#2a211d"><img src="' . WEB_MP . '/logo.png" alt="PATRIAM" style="height:48px"><h2 style="color:#7b1c2c">Confirma tu suscripción a «España al día»</h2>'
    . '<p>Cada mañana te mandaremos el clipping de noticias políticas y económicas de España. Para empezar a recibirlo, pulsa aquí:</p>'
    . '<p><a href="' . e($c) . '" style="display:inline-block;background:#7b1c2c;color:#fff;padding:12px 22px;border-radius:999px;text-decoration:none;font-weight:700">Sí, quiero recibirlo</a></p>'
    . '<p style="color:#7a6d66;font-size:13px">Si no lo has pedido tú, no hagas nada y no recibirás ningún correo.</p></div>';
  [$ok, $motivo] = brevo($email, 'Confirma tu suscripción a «España al día»', $html, "Para recibir cada mañana «España al día», confirma aquí: $c");
  salir($ok ? ['ok' => true] : ['error' => 'No se ha podido enviar el correo de confirmación. ' . $motivo], $ok ? 200 : 502);
}
if ($acc === 'confirmar' || $acc === 'baja') {
  $email = strtolower(trim((string)($_GET['e'] ?? '')));
  if (!hash_equals(firma($email, $acc), (string)($_GET['f'] ?? ''))) pagina('Enlace no válido', '<p>Este enlace no es válido o está incompleto.</p><p><a href="' . URL_MP . '">Ir a España al día</a></p>');
  $l = lista();
  if ($acc === 'confirmar') { $l[$email] = ['estado' => 'activo', 'confirmado' => gmdate('c')] + ($l[$email] ?? []); $l[$email]['estado'] = 'activo'; }
  else { $l[$email] = ['estado' => 'baja', 'baja' => gmdate('c')] + ($l[$email] ?? []); $l[$email]['estado'] = 'baja'; }
  guardarLista($l);
  if ($acc === 'confirmar') pagina('¡Ya estás dentro!', '<p>Desde mañana recibirás cada día «España al día» en <b>' . e($email) . '</b>.</p><p><a href="' . URL_MP . '">Ver las noticias de hoy</a></p>');
  pagina('Te has dado de baja', '<p>Ya no recibirás «España al día» en <b>' . e($email) . '</b>.</p><p><a href="' . URL_MP . '">Ver las noticias de hoy</a></p>');
}

/* ---------- envío diario (solo por consola: cron de Hostinger) ---------- */
if ($acc === 'enviar') {
  if (!$CLI) { http_response_code(404); exit; }
  $hoy = (new DateTime('now', new DateTimeZone('Europe/Madrid')))->format('Y-m-d');
  $log = privado() . '/mipatria-envios.json';
  $hechos = is_file($log) ? (json_decode(file_get_contents($log), true) ?: []) : [];
  if (!empty($hechos[$hoy]) && !in_array('--otra-vez', $argv, true)) { echo "Ya se envió hoy\n"; exit; }
  $g = noticias()['grupos'] ?? [];
  $limite = time() - 30 * 3600;   // lo publicado desde ayer por la mañana
  $g = array_values(array_filter($g, fn($x) => strtotime($x['fecha'] ?? '') >= $limite));
  usort($g, fn($a, $b) => (!empty($b['destacada']) <=> !empty($a['destacada'])) ?: (count($b['medios']) <=> count($a['medios'])) ?: strcmp($b['fecha'], $a['fecha']));
  $g = array_slice($g, 0, 12);
  if (!$g) { echo "No hay noticias nuevas\n"; exit; }
  $F = 'Georgia,serif'; $G = '#7b1c2c';
  $filas = '';
  foreach ($g as $x) {
    if (!preg_match('#^https?://#', $x['imagen'] ?? '')) $x['imagen'] = WEB_MP . '/espana-al-dia-' . (($x['tema'] ?? '') === 'Economía' ? 'economia' : 'politica') . '.jpg';   // ninguna sin foto
    $img = preg_match('#^https?://#', $x['imagen'] ?? '') ? '<td width="110" valign="top" style="width:110px;padding:14px 14px 0 0"><img src="' . e($x['imagen']) . '" width="110" alt="" style="display:block;width:110px;height:auto;border-radius:3px"></td>' : '';
    $bot = implode('', array_map(fn($m) => '<a href="' . e($m['url']) . '" style="display:inline-block;margin:0 6px 6px 0;background:' . $G . ';color:#fff;text-decoration:none;font:600 12px ' . $F . ';padding:6px 12px;border-radius:999px">' . e($m['medio']) . ' →</a>', $x['medios']));
    $filas .= '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #eadfcd"><tr>' . $img . '<td valign="top" style="padding-top:14px">'
      . '<p style="margin:0 0 4px;font:600 10px ' . $F . ';letter-spacing:2px;text-transform:uppercase;color:' . $G . '">' . e($x['tema'] ?? 'Política') . '</p>'
      . '<p style="margin:0 0 6px;font:700 17px/1.3 ' . $F . ';color:#2a211d">' . e($x['titulo']) . '</p>'
      . (!empty($x['resumen']) ? '<p style="margin:0 0 8px;font:400 14px/1.5 ' . $F . ';color:#5b4f49">' . e($x['resumen']) . '</p>' : '')
      . '<p style="margin:0 0 12px">' . $bot . '</p></td></tr></table>';
  }
  $fecha = dia(date('c'));
  $env = 0; $mal = [];
  foreach (lista() as $email => $s) {
    if (($s['estado'] ?? '') !== 'activo') continue;
    $baja = enlace($email, 'baja');
    $html = '<div style="background:#faf5ec;padding:20px 10px"><div style="max-width:620px;margin:auto;background:#fff;border-top:6px solid ' . $G . ';padding:24px">'
      . '<div style="text-align:center"><img src="' . WEB_MP . '/logo.png" alt="PATRIAM" style="height:52px"><p style="margin:14px 0 0;font:600 12px ' . $F . ';letter-spacing:4px;color:' . $G . '">CLIPPING DIARIO</p>'
      . '<h1 style="margin:4px 0 0;font:800 34px ' . $F . ';color:' . $G . '">ESPAÑA AL DÍA</h1><p style="margin:6px 0 18px;font:italic 400 16px ' . $F . ';color:#5b4f49">Noticias políticas y económicas de España · ' . e(mb_strtolower($fecha) === 'hoy' ? 'hoy' : $fecha) . '</p></div>'
      . $filas
      . '<p style="text-align:center;margin:22px 0 8px"><a href="' . URL_MP . '" style="display:inline-block;background:' . $G . ';color:#fff;padding:12px 24px;border-radius:999px;text-decoration:none;font:700 14px ' . $F . '">Ver todas las de hoy en la web →</a></p>'
      . '<p style="text-align:center;font:400 12px ' . $F . ';color:#8a7d75;margin:18px 0 0">Recibes este correo porque te apuntaste a «España al día» de PATRIAM. <a href="' . e($baja) . '" style="color:#8a7d75">Darme de baja</a></p>'
      . '</div></div>';
    $texto = "ESPAÑA AL DÍA · $fecha\n\n" . implode("\n\n", array_map(fn($x) => $x['titulo'] . "\n" . implode(' · ', array_map(fn($m) => $m['medio'] . ': ' . $m['url'], $x['medios'])), $g)) . "\n\nTodas las de hoy: " . URL_MP . "\nToda la semana (España semana a semana): " . URL_SEMANA . "\nDarme de baja: $baja";
    [$ok, $motivo] = brevo($email, 'España al día · ' . $g[0]['titulo'], $html, $texto, $baja);
    if ($ok) $env++; else $mal[] = "$email: $motivo";
  }
  // Por WhatsApp: a quien lo tenga marcado (Publicar › Boletín › Teléfonos), solo con la API de WhatsApp Business.
  // Sin la API se manda a mano desde Publicar con «Mandar al siguiente» (España al día de hoy).
  $wa = 0;
  require_once __DIR__ . '/carlos.php';
  if ($k = cWhatsappApi()) {
    $tf = privado() . '/telefonos.json'; $tel = is_file($tf) ? (json_decode(file_get_contents($tf), true) ?: []) : [];
    $clave = 'd-' . $hoy; $fechaL = mb_strtolower($fecha) === 'hoy' ? diaLargo() : $fecha;
    foreach (comLeerTodo()['contactos'] ?? [] as $c) {
      $mv = cMovil($c['movil'] ?? ''); $id = $c['id'] ?? $mv;
      if (!$mv || empty($c['waDiaria']) || isset($tel['envios'][$clave][$id])) continue;
      [$ok, $m] = cWhatsapp($k, $mv, cNombre($c), "Aquí tienes «España al día» de hoy, $fechaL: " . $g[0]['titulo'] . ' y el resto de noticias políticas y económicas de España.' . "\n\n" . URL_MP);
      if ($ok) { $tel['envios'][$clave][$id] = gmdate('c'); $wa++; } else $mal[] = "+$mv: $m";
    }
    $tel += ['envios' => [], 'texto' => ''];
    file_put_contents($tf . '.tmp', json_encode($tel, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), LOCK_EX); rename($tf . '.tmp', $tf); @chmod($tf, 0600);
  }
  $hechos[$hoy] = ['enviados' => $env, 'whatsapp' => $wa, 'errores' => count($mal), 'hora' => gmdate('c')];
  file_put_contents($log, json_encode(array_slice($hechos, -60, null, true)), LOCK_EX);
  echo "Enviados: $env correos, $wa WhatsApp" . ($mal ? "\nErrores:\n" . implode("\n", $mal) : '') . "\n";
  exit;
}

/* ---------- la página ---------- */
$d = noticias(); $g = $d['grupos'] ?? [];
$filtro = $_GET['t'] ?? '';
if ($filtro === 'politica') $g = array_values(array_filter($g, fn($x) => ($x['tema'] ?? '') === 'Política'));
if ($filtro === 'economia') $g = array_values(array_filter($g, fn($x) => ($x['tema'] ?? '') === 'Economía'));
foreach ($g as &$x) $x['tema'] = ($x['tema'] ?? '') === 'Economía' ? 'Economía' : 'Política';
unset($x);
// España al día son las noticias DEL DÍA (la semana entera está en el boletín, «España semana a semana»).
// A primera hora, si aún no hay nada de hoy, lo último de las 24 horas anteriores.
$hoyMad = (new DateTime('now', new DateTimeZone('Europe/Madrid')))->format('Y-m-d');
$titHoy = 'Hoy';
$soloHoy = array_values(array_filter($g, fn($x) => dia2($x['fecha']) === $hoyMad));
if (!$soloHoy) { $soloHoy = array_values(array_filter($g, fn($x) => strtotime($x['fecha']) >= time() - 24 * 3600)); $titHoy = 'Lo último'; }
$g = $soloHoy;
// Mini panel: de qué se habla en las últimas 48 horas
$hace48 = time() - 48 * 3600; $panel = []; $n48 = 0; $medios48 = [];
foreach ($g as $x) {
  if (strtotime($x['fecha']) < $hace48) continue;
  $n48++; foreach ($x['medios'] ?? [] as $m) $medios48[$m['medio']] = 1;
  $k = $x['asunto']; $panel[$k] ??= ['Economía' => 0, 'Política' => 0, 'n' => 0];
  $panel[$k][$x['tema']]++; $panel[$k]['n']++;
}
uksort($panel, fn($a, $b) => ($a === 'Otros') <=> ($b === 'Otros') ?: $panel[$b]['n'] <=> $panel[$a]['n']);
$maxPanel = max(array_merge([1], array_map(fn($p) => $p['n'], array_filter($panel, fn($k) => $k !== 'Otros', ARRAY_FILTER_USE_KEY))));
$asunto = '';
foreach (array_unique(array_column($g, 'asunto')) as $a) if (slug($a) === ($_GET['a'] ?? '')) $asunto = $a;
$enlaceMP = fn($t, $a) => URL_MP . (($q = http_build_query(array_filter(['t' => $t, 'a' => $a]))) ? '?' . $q : '');
function tarjeta($x, &$primera) {
  $res = '/espana-al-dia-' . ($x['tema'] === 'Economía' ? 'economia' : 'politica') . '.jpg';
  $im = preg_match('#^https?://#', $x['imagen'] ?? '') ? $x['imagen'] : $res;
  // debajo va la imagen de PATRIAM de su sección: si la foto del medio no carga, se ve esa (ninguna sin foto)
  $h = '<article class="f' . ($primera ? ' top' : '') . '"><div class="im" style="background-image:url(\'' . e($im) . '\'),url(\'' . e($res) . '\')"></div><div class="tx"><span class="tm">' . e($x['tema']) . ' · ' . e(mb_strtolower(dia($x['fecha']))) . ' · ' . e(hora($x['fecha'])) . '</span><h3>' . e($x['titulo']) . '</h3>'
    . (!empty($x['resumen']) ? '<p>' . e($x['resumen']) . '</p>' : '')
    . '<div class="md">' . implode('', array_map(fn($m) => '<a href="' . e($m['url']) . '" target="_blank" rel="noopener">' . e($m['medio']) . ' →</a>', $x['medios'] ?? [])) . '</div></div></article>';
  $primera = false;
  return $h;
}
$titulo = 'España al día · Clipping de noticias políticas y económicas de España';
$desc = 'Clipping diario de noticias políticas y económicas de España, las de hoy. Se actualiza cada 3 horas. Por PATRIAM.';
$img = WEB_MP . '/espana-al-dia-og.jpg?v=2';
$wa = 'https://wa.me/?text=' . rawurlencode("*España al día* · Clipping diario de noticias políticas y económicas de España, las de hoy.\n👉 " . URL_MP);
header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-cache, must-revalidate');
?><!doctype html>
<html lang="es"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title><?= e($titulo) ?></title>
<meta name="description" content="<?= e($desc) ?>">
<link rel="canonical" href="<?= URL_MP ?>">
<meta property="og:type" content="website"><meta property="og:site_name" content="PATRIAM"><meta property="og:locale" content="es_ES">
<meta property="og:title" content="<?= e($titulo) ?>"><meta property="og:description" content="<?= e($desc) ?>">
<meta property="og:url" content="<?= URL_MP ?>"><meta property="og:image" content="<?= $img ?>">
<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="<?= e($titulo) ?>">
<meta name="twitter:description" content="<?= e($desc) ?>"><meta name="twitter:image" content="<?= $img ?>">
<link rel="icon" href="/icono-192.png"><link rel="apple-touch-icon" href="/icono-192.png">
<style>
@font-face{font-family:Spectral;font-weight:400;font-display:swap;src:url(/fuentes/spectral-latin-400-normal.woff2) format("woff2")}
@font-face{font-family:Spectral;font-weight:400;font-style:italic;font-display:swap;src:url(/fuentes/spectral-latin-400-italic.woff2) format("woff2")}
@font-face{font-family:Spectral;font-weight:600;font-display:swap;src:url(/fuentes/spectral-latin-600-normal.woff2) format("woff2")}
@font-face{font-family:Spectral;font-weight:800;font-display:swap;src:url(/fuentes/spectral-latin-800-normal.woff2) format("woff2")}
:root{--g:#7b1c2c;--t:#2a211d;--s:#6b5d55;--c:#faf5ec;--l:#e3d6c1}
*{box-sizing:border-box}body{margin:0;background:var(--c);color:var(--t);font-family:Spectral,Georgia,serif}
a{color:inherit}
.cab{background:var(--g);color:#fff;text-align:center;padding:22px 16px 26px;border-bottom:6px solid #c9a24a}
.cab img{height:58px;background:#faf5ec;padding:8px 14px;border-radius:4px}
.cab small{display:block;letter-spacing:.35em;font-weight:600;font-size:.78rem;margin-top:14px;opacity:.85}
.cab h1{margin:.2rem 0 0;font-weight:800;font-size:clamp(2.2rem,8vw,4rem);letter-spacing:.02em;line-height:1}
.cab p{margin:.5rem auto 0;font-style:italic;font-size:1.1rem;max-width:560px;opacity:.95}
.cab .act{font-style:normal;font-size:.85rem;opacity:.75;margin-top:.4rem}
main{max-width:1060px;margin:0 auto;padding:18px 16px 40px}
.acc{display:flex;flex-wrap:wrap;gap:.6rem;align-items:center;justify-content:space-between;margin:6px 0 18px}
.tabs{display:flex;gap:.4rem;flex-wrap:wrap}
.tabs a,.btn{display:inline-flex;align-items:center;gap:.35rem;text-decoration:none;border:2px solid var(--g);border-radius:999px;padding:.45rem 1rem;font:600 .9rem Spectral,Georgia,serif;color:var(--g);background:#fff;cursor:pointer}
.tabs a.on,.btn.on{background:var(--g);color:#fff}
.btn.wa{background:#1f8f4e;border-color:#1f8f4e;color:#fff}
.recibir{background:#fff;border:1px solid var(--l);border-top:4px solid var(--g);padding:16px 18px;margin:0 0 22px;display:flex;flex-wrap:wrap;gap:.8rem;align-items:center}
.recibir b{font-size:1.15rem;flex:1 1 260px}.recibir b small{display:block;font-weight:400;color:var(--s);font-size:.92rem}
.recibir form{display:flex;gap:.5rem;flex:1 1 320px}.recibir input{flex:1;min-width:0;padding:.6rem .8rem;border:1px solid #d8c9b2;font:1rem Spectral,Georgia,serif;border-radius:3px}
.recibir .msg{flex-basis:100%;margin:0;font-weight:600}
.panel{background:#fff;border:1px solid var(--l);border-top:4px solid #c9a24a;padding:16px 18px 12px;margin:0 0 8px}
.pcab{display:flex;justify-content:space-between;align-items:baseline;gap:8px;flex-wrap:wrap}.pcab b{font-size:1.2rem}.pcab span{color:var(--s);font-size:.85rem;letter-spacing:.12em;text-transform:uppercase}
.cifras{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:12px 0 14px}
.cifras div{border-left:3px solid var(--g);padding:2px 0 2px 10px;min-width:0}.cifras strong{display:block;font-size:1.6rem;line-height:1.1;font-variant-numeric:tabular-nums}.cifras span{color:var(--s);font-size:.85rem}
.cifras .lider strong{font-size:1.1rem;line-height:1.25;padding-top:.3rem}
.barras{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,420px),1fr));gap:2px 28px}
.barras a{display:grid;grid-template-columns:minmax(0,14rem) 1fr 2.2rem;align-items:center;gap:10px;padding:5px 4px;text-decoration:none;border-radius:3px}
.barras a:hover,.barras a.on{background:#f5ede0}
.barras .nm{font-weight:600;font-size:.95rem;line-height:1.2}
.barras .br{display:block;height:10px;background:var(--g);border-radius:2px;min-width:4px;overflow:hidden}.barras .br i{display:block;height:100%;background:#c9a24a}
.barras .nu{text-align:right;font-variant-numeric:tabular-nums;color:var(--s);font-weight:600}
.ley{margin:10px 0 0;font-size:.82rem;color:var(--s)}.ley i{display:inline-block;width:10px;height:10px;border-radius:2px;vertical-align:-1px;margin-left:6px}.ley .ec{background:#c9a24a}.ley .po{background:var(--g)}
h3.sec small,h2.asunto small{font-weight:400;color:var(--s);font-size:.85rem;font-style:normal}
h2.asunto{margin:10px 0 0;font-size:1.6rem}.volver{margin:14px 0 0}.volver a,.vermas a{color:var(--g);font-weight:600;text-decoration:none}.vermas{margin:10px 0 0;text-align:right}
@media (max-width:640px){.cifras{grid-template-columns:repeat(2,1fr)}.barras a{grid-template-columns:minmax(0,10rem) 1fr 2rem}}
h2.bloque{margin:34px 0 6px;font-size:1.9rem;font-weight:800;color:var(--g);border-bottom:4px double var(--g);padding-bottom:6px}h2.bloque small{font-size:.95rem;font-weight:400;font-style:italic;color:var(--s)}
h3.sec{margin:18px 0 10px;font-size:1.05rem;font-weight:600;font-style:italic;color:var(--t)}
h2.dia{margin:26px 0 4px;font-size:.95rem;letter-spacing:.3em;text-transform:uppercase;color:var(--g);border-bottom:2px solid var(--g);padding-bottom:6px}
.rej{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px}
.f{background:#fff;border:1px solid var(--l);display:flex;flex-direction:column}
.f .im{aspect-ratio:16/9;background:#efe6d6 center/cover no-repeat}
.f .tx{padding:12px 14px 14px;display:flex;flex-direction:column;gap:.35rem;flex:1}
.f .tm{font-size:.72rem;letter-spacing:.2em;text-transform:uppercase;color:var(--g);font-weight:600}
.f h3{margin:0;font-size:1.12rem;line-height:1.25}
.f p{margin:0;color:var(--s);font-size:.95rem;line-height:1.45}
.f .md{display:flex;flex-wrap:wrap;gap:.35rem;margin-top:auto;padding-top:.5rem}
.f .md a{background:var(--g);color:#fff;text-decoration:none;font-weight:600;font-size:.82rem;padding:.35rem .8rem;border-radius:999px}
.f.top{grid-column:1/-1;flex-direction:row}.f.top .im{flex:0 0 46%;aspect-ratio:auto;min-height:240px}.f.top h3{font-size:1.5rem}
footer{text-align:center;padding:26px 16px 40px;color:var(--s);font-size:.9rem;border-top:1px solid var(--l)}
footer a{color:var(--g);font-weight:600}
@media (max-width:640px){.f.top{flex-direction:column}.f.top .im{min-height:0;aspect-ratio:16/9}.f.top h3{font-size:1.25rem}.recibir form{flex-direction:column}}
</style>
</head><body>
<header class="cab">
  <a href="https://boletin.movimientopatriam.es/"><img src="/logo.png" alt="PATRIAM"></a>
  <small>CLIPPING DIARIO</small>
  <h1>ESPAÑA AL DÍA</h1>
  <p>Noticias políticas y económicas de España, las de hoy.</p>
  <?php if (!empty($d['actualizado'])): ?><p class="act">Actualizado: <?= e(mb_strtolower(dia($d['actualizado']))) ?> a las <?= e(hora($d['actualizado'])) ?></p><?php endif; ?>
</header>
<main>
  <div class="acc">
    <nav class="tabs">
      <a href="<?= URL_MP ?>" class="<?= $filtro === '' ? 'on' : '' ?>">Todo</a>
      <a href="<?= URL_MP ?>?t=politica" class="<?= $filtro === 'politica' ? 'on' : '' ?>">Política</a>
      <a href="<?= URL_MP ?>?t=economia" class="<?= $filtro === 'economia' ? 'on' : '' ?>">Economía</a>
    </nav>
    <span class="tabs"><a class="btn wa" href="<?= e($wa) ?>" target="_blank" rel="noopener">Compartir por WhatsApp</a><button class="btn" type="button" id="copiar">Copiar enlace</button></span>
  </div>
  <section class="recibir" id="recibir">
    <b>Recíbelo cada mañana en tu correo<small>Gratis. Un correo al día con lo más importante. Te das de baja cuando quieras.</small></b>
    <form id="alta"><input type="email" name="email" required placeholder="Tu correo electrónico" autocomplete="email"><button class="btn on">Quiero recibirlo</button></form>
    <p class="msg" id="msg" hidden></p>
  </section>
<?php if ($panel): ?>
  <section class="panel" aria-label="De qué se habla">
    <div class="pcab"><b>De qué se habla</b><span><?= $titHoy === 'Hoy' ? 'Hoy' : 'Últimas 24 horas' ?></span></div>
    <div class="cifras">
      <div><strong><?= $n48 ?></strong><span>noticias</span></div>
      <div><strong><?= count(array_filter(array_keys($panel), fn($k) => $k !== 'Otros')) ?></strong><span>asuntos</span></div>
      <div><strong><?= count($medios48) ?></strong><span>medios</span></div>
      <div class="lider"><strong><?= e(array_key_first($panel) === 'Otros' ? '—' : array_key_first($panel)) ?></strong><span>el más tratado</span></div>
    </div>
    <ul class="barras">
<?php foreach ($panel as $k => $p): if ($k === 'Otros') continue; $w = 100 * $p['n'] / $maxPanel; ?>
      <li><a href="<?= e($enlaceMP($filtro, slug($k))) ?>" class="<?= $asunto === $k ? 'on' : '' ?>"><span class="nm"><?= e($k) ?></span><span class="br" style="width:<?= round($w, 1) ?>%"><i class="ec" style="width:<?= round(100 * $p['Economía'] / $p['n'], 1) ?>%"></i></span><span class="nu"><?= $p['n'] ?></span></a></li>
<?php endforeach; ?>
    </ul>
    <p class="ley"><i class="ec"></i> Economía <i class="po"></i> Política · Pulsa un asunto para ver todas sus noticias</p>
  </section>
<?php endif; ?>
<?php
if (!$g) echo '<p>Todavía no hay noticias. Se cargan solas cada 3 horas.</p>';
$primera = true;
if ($asunto !== '') {
  // Un asunto: todas sus noticias, por días y, dentro de cada día, Economía y luego Política
  $g = array_values(array_filter($g, fn($x) => $x['asunto'] === $asunto));
  echo '<p class="volver"><a href="' . e($enlaceMP($filtro, '')) . '">← Todos los asuntos</a></p><h2 class="asunto">' . e($asunto) . ' <small>' . count($g) . ' noticias ' . ($titHoy === 'Hoy' ? 'hoy' : 'en las últimas 24 horas') . '</small></h2>';
  $porDia = [];
  foreach ($g as $x) $porDia[dia($x['fecha'])][$x['tema']][] = $x;
  foreach ($porDia as $dd => $temas) {
    echo '<h2 class="dia">' . e($dd) . '</h2>';
    foreach (['Economía', 'Política'] as $tm) {
      if (empty($temas[$tm])) continue;
      echo '<h3 class="sec">' . $tm . '</h3><div class="rej">';
      foreach ($temas[$tm] as $x) echo tarjeta($x, $primera);
      echo '</div>';
    }
  }
} else {
  // Portada en dos partes: primero las noticias de HOY; debajo, EL RESTO DE LA SEMANA
  $hoyMad = (new DateTime('now', new DateTimeZone('Europe/Madrid')))->format('Y-m-d');
  $deHoy = array_values(array_filter($g, fn($x) => dia2($x['fecha']) === $hoyMad));
  $titHoy = 'Hoy';
  if (!$deHoy) {   // a primera hora todavía no hay nada de hoy: lo último de las 24 horas anteriores
    $deHoy = array_values(array_filter($g, fn($x) => strtotime($x['fecha']) >= time() - 24 * 3600));
    $titHoy = 'Lo último';
  }
    // Cada parte: Economía y luego Política; dentro de cada una, los asuntos de los que más se habla
  $pintar = function ($lista, $pref, $maxA, $maxO) use (&$primera, $panel, $enlaceMP, $filtro) {
    foreach (['Economía', 'Política'] as $tm) {
      $del = array_values(array_filter($lista, fn($x) => $x['tema'] === $tm));
      if (!$del) continue;
      $grupos = [];
      foreach ($del as $x) $grupos[$x['asunto']][] = $x;
      uksort($grupos, fn($a, $b) => ($a === 'Otros') <=> ($b === 'Otros') ?: ($panel[$b][$tm] ?? 0) <=> ($panel[$a][$tm] ?? 0) ?: count($grupos[$b]) <=> count($grupos[$a]));
      echo '<h2 class="dia" id="' . $pref . slug($tm) . '">' . $tm . ' <small>' . count($del) . '</small></h2>';
      foreach ($grupos as $as => $xs) {
        usort($xs, fn($a, $b) => (!empty($b['destacada']) <=> !empty($a['destacada'])) ?: strcmp($b['fecha'], $a['fecha']));
        $max = $as === 'Otros' ? $maxO : $maxA;
        echo '<h3 class="sec" id="' . $pref . slug($tm . '-' . $as) . '">' . e($as === 'Otros' ? 'Otras noticias' : $as) . ' <small>' . count($xs) . '</small></h3><div class="rej">';
        foreach (array_slice($xs, 0, $max) as $x) echo tarjeta($x, $primera);
        echo '</div>';
        if (count($xs) > $max) echo '<p class="vermas"><a href="' . e($enlaceMP($filtro, slug($as))) . '">Ver todas las noticias de «' . e($as === 'Otros' ? 'Otras noticias' : $as) . '» →</a></p>';
      }
    }
  };
  if ($deHoy) {
    echo '<h2 class="bloque" id="hoy">' . $titHoy . ' <small>' . e($titHoy === 'Hoy' ? diaLargo() : 'últimas 24 horas') . ' · ' . count($deHoy) . ' noticias</small></h2>';
    $pintar($deHoy, 'hoy-', 4, 6);
  }
  echo '<p class="vermas semana"><a href="' . URL_SEMANA . '">Toda la semana, por asuntos: España semana a semana, en el boletín →</a></p>';
}
?>
</main>
<footer>Una iniciativa de <a href="https://movimientopatriam.es/">PATRIAM</a> · Dios · Patria · Justicia · <a href="https://boletin.movimientopatriam.es/">Lee también el boletín semanal</a></footer>
<script>
document.getElementById('copiar').onclick = function () { var b = this; (navigator.clipboard ? navigator.clipboard.writeText('<?= URL_MP ?>') : Promise.reject()).then(function () { b.textContent = '¡Copiado!'; }, function () { prompt('Copia el enlace:', '<?= URL_MP ?>'); }); };
document.getElementById('alta').onsubmit = async function (ev) {
  ev.preventDefault(); var m = document.getElementById('msg'), bt = this.querySelector('button'); bt.disabled = true; m.hidden = false; m.style.color = '#6b5d55'; m.textContent = 'Enviando…';
  try {
    var r = await fetch('<?= URL_MP ?>?accion=alta', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: this.email.value }) });
    var j = await r.json();
    if (!r.ok) throw new Error(j.error || 'Error');
    m.style.color = '#2f6b3a'; m.textContent = j.ya ? 'Ya estabas apuntado: lo recibes cada mañana.' : 'Te hemos mandado un correo: pulsa el botón que trae para confirmar y empezarás a recibirlo.';
  } catch (e) { m.style.color = '#b00020'; m.textContent = e.message; bt.disabled = false; }
};
</script>
</body></html>
