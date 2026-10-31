<?php
/* Comunicaciones personales del boletín («Buenos días, Nombre:» + texto + firma) por correo (Brevo) y WhatsApp (API de Meta).
   Funciona en Hostinger: no necesita desplegar Netlify.
   - Quién entra: se comprueba con la sesión del editor (solo administradores; los únicos que pueden ver los suscriptores).
   - Lo que se guarda (comunicaciones, otros destinatarios, firma y claves) va a una carpeta privada del servidor,
     fuera de la web y fuera de GitHub. Las claves nunca se devuelven al navegador. */

$NETLIFY = getenv('BOLETIN_ORIGEN') ?: 'https://boletinpatriam.netlify.app';   // servidor del boletín (sesiones y suscriptores)
$API_BREVO = getenv('COM_URL_BREVO') ?: 'https://api.brevo.com';
$API_META = getenv('COM_URL_META') ?: 'https://graph.facebook.com';
$WEB = 'https://boletin.movimientopatriam.es';
require_once __DIR__ . '/_privado.php';   // enlaces con seguimiento y estadísticas

function salir($datos, $codigo = 200) {
  http_response_code($codigo);
  header('Content-Type: application/json; charset=utf-8');
  header('Cache-Control: no-store');
  echo json_encode($datos, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
  exit;
}
function privado() {
  static $d = null;
  if ($d) return $d;
  foreach ([dirname(__DIR__, 3) . '/patriam-privado', dirname(__DIR__, 2) . '/patriam-privado', dirname(__DIR__) . '/privado'] as $c) {
    if ((is_dir($c) || @mkdir($c, 0750, true)) && is_writable($c)) {
      if (!file_exists("$c/.htaccess")) @file_put_contents("$c/.htaccess", "Require all denied\nDeny from all\n");
      @mkdir("$c/img", 0750, true);
      return $d = $c;
    }
  }
  salir(['error' => 'El servidor no deja guardar los datos.'], 500);
}

/* ---------- imágenes (la firma): públicas, para que se vean en el correo ---------- */
if (isset($_GET['img'])) {
  if (!preg_match('/^([0-9a-f]{32})\.(png|jpg|gif|webp)$/', $_GET['img'], $m)) { http_response_code(404); exit; }
  $f = privado() . '/img/' . $m[0];
  if (!is_file($f)) { http_response_code(404); exit; }
  header('Content-Type: image/' . ($m[2] === 'jpg' ? 'jpeg' : $m[2]));
  header('Cache-Control: public, max-age=31536000, immutable');
  readfile($f); exit;
}

/* ---------- solo administradores del editor ---------- */
$token = $_SERVER['HTTP_AUTHORIZATION'] ?? ($_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '');
if (!$token) salir(['error' => 'sesion'], 401);
function pedir($url, $cab = [], $cuerpo = null) {
  $ch = curl_init($url);
  curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 30, CURLOPT_HTTPHEADER => $cab]);
  if ($cuerpo !== null) { curl_setopt($ch, CURLOPT_POST, true); curl_setopt($ch, CURLOPT_POSTFIELDS, $cuerpo); }
  $r = curl_exec($ch);
  $c = curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
  $e = curl_error($ch);
  curl_close($ch);
  return [$c, $r === false ? '' : $r, $e];
}
[$c, $r] = pedir($NETLIFY . '/api/suscriptores', ['Authorization: ' . $token, 'Accept: application/json']);
if ($c === 401) salir(['error' => 'sesion'], 401);
if ($c !== 200) salir(['error' => $c === 403 ? 'Solo para administradores.' : 'No se ha podido comprobar la sesión (' . $c . ').'], $c === 403 ? 403 : 502);
$SUS = json_decode($r, true)['suscriptores'] ?? [];

/* ---------- datos ---------- */
function vacio() {
  return ['ajustes' => ['remitenteNombre' => 'PATRIAM', 'remitente' => 'comunicacion@movimientopatriam.es', 'responderA' => 'hola@movimientopatriam.com',
    'saludo' => 'Buenos días', 'firmaImagen' => '', 'firmaTexto' => '', 'soloNombre' => true], 'contactos' => [], 'lista' => []];
}
function leer() {
  $f = privado() . '/com.json';
  $t = is_file($f) ? file_get_contents($f) : '';
  $d = $t ? json_decode($t, true) : null;
  if (!$d) return [vacio(), null];
  $v = vacio();
  $d['ajustes'] = array_merge($v['ajustes'], $d['ajustes'] ?? []);
  $d['contactos'] = $d['contactos'] ?? []; $d['lista'] = $d['lista'] ?? [];
  return [$d, md5($t)];
}
function escribir($d) {
  $t = json_encode($d, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
  file_put_contents(privado() . '/com.json', $t, LOCK_EX);
  return md5($t);
}
function claves() { $f = privado() . '/claves.json'; return is_file($f) ? (json_decode(file_get_contents($f), true) ?: []) : []; }
function servicios() {
  $k = claves();
  return ['correo' => !empty($k['brevo']), 'whatsapp' => !empty($k['waToken']) && !empty($k['waPhone']),
    'plantilla' => $k['waPlantilla'] ?? 'comunicacion_patriam', 'idioma' => $k['waIdioma'] ?? 'es',
    'brevo' => !empty($k['brevo']) ? '…' . substr($k['brevo'], -4) : '', 'waToken' => !empty($k['waToken']) ? '…' . substr($k['waToken'], -4) : '',
    'waPhone' => $k['waPhone'] ?? '', 'stripe' => !empty($k['stripe']) ? (strpos($k['stripe'], '_test_') !== false ? 'prueba ' : 'real ') . '…' . substr($k['stripe'], -4) : '',
    'stripeWebhook' => !empty($k['stripeWebhook']) ? '…' . substr($k['stripeWebhook'], -4) : '', 'gelato' => !empty($k['gelato']) ? '…' . substr($k['gelato'], -4) : ''];
}
/* La firma subida (data:image/…) se guarda como archivo y queda su dirección */
function sacarImagenes(&$v, &$mapa) {
  if (is_string($v) && strncmp($v, 'data:image/', 11) === 0) {
    if (!preg_match('#^data:image/(png|jpeg|jpg|gif|webp);base64,(.+)$#', $v, $m)) return;
    $ext = $m[1] === 'jpeg' ? 'jpg' : $m[1];
    $bin = base64_decode($m[2]);
    if ($bin === false || strlen($bin) > 3000000) return;
    $h = md5($bin) . '.' . $ext;
    file_put_contents(privado() . '/img/' . $h, $bin);
    $mapa[strlen($v) . ':' . substr($v, -64)] = 'img-com/' . $h;
    $v = 'img-com/' . $h;
  } elseif (is_array($v)) { foreach ($v as &$x) sacarImagenes($x, $mapa); }
}
function correoValido($c) { return (bool)preg_match('/^[^@\s]+@[^@\s]+\.[^@\s]+$/', trim((string)$c)); }
function movil($m) {
  $d = trim((string)$m); $mas = strncmp($d, '+', 1) === 0;
  $d = preg_replace('/\D/', '', $d);
  if (!$mas && strncmp($d, '00', 2) === 0) $d = substr($d, 2);
  if (!$mas && strlen($d) === 9 && preg_match('/^[67]/', $d)) $d = '34' . $d;
  return strlen($d) >= 10 && strlen($d) <= 15 ? $d : '';
}

$accion = $_GET['accion'] ?? '';
$cuerpo = json_decode(file_get_contents('php://input') ?: '{}', true) ?: [];

if ($accion === 'datos') {
  [$d, $etag] = leer();
  salir(['com' => $d, 'etag' => $etag, 'servicios' => servicios()]);
}

if ($accion === 'guardar') {
  [$ant, $etag] = leer();
  if ($etag && ($cuerpo['etag'] ?? null) !== $etag) salir(['error' => 'conflicto', 'que' => 'com'], 409);
  $n = $cuerpo['com'] ?? [];
  $d = vacio();
  $d['ajustes'] = array_merge($d['ajustes'], array_intersect_key($n['ajustes'] ?? [], $d['ajustes']));
  foreach (array_slice($n['contactos'] ?? [], 0, 5000) as $c) {
    $d['contactos'][] = ['id' => substr((string)($c['id'] ?? ''), 0, 40), 'nombre' => substr((string)($c['nombre'] ?? ''), 0, 120),
      'email' => strtolower(trim(substr((string)($c['email'] ?? ''), 0, 160))), 'movil' => substr((string)($c['movil'] ?? ''), 0, 40)];
  }
  // Lo ya enviado no se puede cambiar desde el editor: se conserva lo del servidor
  $antes = [];
  foreach ($ant['lista'] as $x) $antes[$x['id'] ?? ''] = $x;
  foreach (array_slice($n['lista'] ?? [], 0, 500) as $x) {
    $p = $antes[$x['id'] ?? ''] ?? [];
    $x['envios'] = $p['envios'] ?? [];
    $x['enviados'] = $p['enviados'] ?? ['correo' => [], 'whatsapp' => []];
    $x['estado'] = (($p['estado'] ?? '') === 'enviado') ? 'enviado' : ($x['estado'] ?? 'borrador');
    $d['lista'][] = $x;
  }
  $mapa = [];
  sacarImagenes($d, $mapa);
  salir(['etag' => escribir($d), 'mapa' => (object)$mapa]);
}

if ($accion === 'claves') {
  $k = claves();
  foreach (['brevo', 'waToken', 'waPhone', 'waPlantilla', 'waIdioma', 'stripe', 'stripeWebhook', 'gelato'] as $c) {
    if (!isset($cuerpo[$c])) continue;
    $v = trim((string)$cuerpo[$c]);
    if ($v === '-') unset($k[$c]); elseif ($v !== '') $k[$c] = $v;
  }
  file_put_contents(privado() . '/claves.json', json_encode($k), LOCK_EX);
  @chmod(privado() . '/claves.json', 0600);
  salir(['servicios' => servicios()]);
}

if ($accion === 'enviar') {
  $canal = $cuerpo['canal'] ?? '';
  if (!in_array($canal, ['correo', 'whatsapp'], true)) salir(['error' => 'Canal no válido'], 400);
  $k = claves(); $sv = servicios();
  if ($canal === 'correo' && !$sv['correo']) salir(['error' => 'Falta poner la clave de Brevo (en «Claves de envío»).'], 400);
  if ($canal === 'whatsapp' && !$sv['whatsapp']) salir(['error' => 'Falta poner el token y el identificador del número de WhatsApp (en «Claves de envío»).'], 400);
  [$d] = leer();
  $com = null;
  foreach ($d['lista'] as $x) if (($x['id'] ?? '') === ($cuerpo['id'] ?? '')) $com = $x;
  if (!$com) salir(['error' => 'No existe esa comunicación. Espera a que ponga «Guardado ✓» y vuelve a intentarlo.'], 404);
  $aj = $d['ajustes'];
  if ($canal === 'correo' && !correoValido($aj['remitente'])) salir(['error' => 'Falta el correo del remitente en «Firma y remitente».'], 400);
  $asunto = mb_substr((string)($com['asunto'] ?? ''), 0, 200);
  $html = (string)($cuerpo['html'] ?? ''); $texto = (string)($cuerpo['texto'] ?? '');
  if ($canal === 'correo' && ($asunto === '' || $html === '')) salir(['error' => 'Falta el asunto o el texto.'], 400);
  // Enlace de baja de cada suscriptor (lo firma el servidor del boletín)
  $bajas = [];
  foreach ($SUS as $s) if (!empty($s['email'])) $bajas[strtolower($s['email'])] = preg_replace('#^https?://[^/]+#', $GLOBALS['WEB'], (string)($s['enlaceBaja'] ?? ''));

  $res = []; $pers = [];
  foreach (array_slice($cuerpo['para'] ?? [], 0, 25) as $p) {
    $nombre = trim(mb_substr((string)($p['nombre'] ?? ''), 0, 80));
    $id = (string)($p['id'] ?? '');
    // Código de la persona: va en sus enlaces para saber qué abre (estadísticas del editor)
    $pc = codigoPersona($id);
    $pers[$pc] = ['nombre' => trim(mb_substr((string)($p['completo'] ?? $nombre), 0, 120)) ?: $nombre, 'tipo' => strncmp($id, 's:', 2) === 0 ? 'Suscriptor' : 'Otro destinatario'];
    if ($canal === 'correo') {
      $email = strtolower(trim((string)($p['email'] ?? '')));
      if (!correoValido($email)) { $res[] = ['id' => $id, 'ok' => false, 'motivo' => 'Correo no válido']; continue; }
      $baja = $bajas[$email] ?? '';
      $h = $baja ? $html : preg_replace('/<!--BAJA-->[\s\S]*?<!--\/BAJA-->/', '', $html);
      $t = $texto;
      $h = seguirEnlacesHtml($h, $pc, $com['id']); $t = seguirEnlacesTexto($t, $pc, $com['id']);
      if ($nombre === '') { $h = str_replace(', %%NOMBRE%%', '', $h); $t = str_replace(', %%NOMBRE%%', '', $t); }
      $h = str_replace(['%%NOMBRE%%', '%%BAJA%%'], [htmlspecialchars($nombre, ENT_QUOTES), htmlspecialchars($baja, ENT_QUOTES)], $h);
      $t = str_replace('%%NOMBRE%%', $nombre, $t) . ($baja ? "\n\nPara dejar de recibir correos: " . $baja : '');
      $msg = ['sender' => ['name' => $aj['remitenteNombre'] ?: 'PATRIAM', 'email' => $aj['remitente']],
        'to' => [array_filter(['email' => $email, 'name' => $nombre])], 'subject' => $asunto, 'htmlContent' => $h, 'textContent' => $t, 'tags' => ['comunicacion']];
      if (correoValido($aj['responderA'])) $msg['replyTo'] = ['email' => $aj['responderA']];
      if ($baja) $msg['headers'] = ['List-Unsubscribe' => '<' . $baja . '>'];
      [$c, $r, $e] = pedir($GLOBALS['API_BREVO'] . '/v3/smtp/email', ['api-key: ' . $k['brevo'], 'Content-Type: application/json', 'Accept: application/json'], json_encode($msg, JSON_UNESCAPED_UNICODE));
      $ok = $c >= 200 && $c < 300;
      $res[] = ['id' => $id, 'clave' => $email, 'ok' => $ok, 'motivo' => $ok ? '' : ((json_decode($r, true)['message'] ?? '') ?: ($e ?: 'Brevo respondió ' . $c))];
    } else {
      $m = movil($p['movil'] ?? '');
      if (!$m) { $res[] = ['id' => $id, 'ok' => false, 'motivo' => 'Móvil no válido']; continue; }
      // WhatsApp no deja saltos de línea dentro de un hueco de la plantilla: los párrafos se unen con «—»
      $parr = array_filter(array_map(fn($x) => trim(preg_replace('/\s*\n\s*/', ' ', $x)), preg_split('/\n\s*\n/', str_replace("\r", '', (string)($cuerpo['textoWa'] ?? '')))));
      $txt = mb_substr(seguirEnlacesTexto(preg_replace('/ {4,}/', '   ', str_replace("\t", ' ', implode(' — ', $parr))), $pc, $com['id']), 0, 1000) ?: '.';
      $msg = ['messaging_product' => 'whatsapp', 'to' => $m, 'type' => 'template', 'template' => [
        'name' => $sv['plantilla'], 'language' => ['code' => $sv['idioma']],
        'components' => [['type' => 'body', 'parameters' => [['type' => 'text', 'text' => $nombre ?: 'amigo'], ['type' => 'text', 'text' => $txt]]]]]];
      [$c, $r, $e] = pedir($GLOBALS['API_META'] . '/v21.0/' . rawurlencode($k['waPhone']) . '/messages',
        ['Authorization: Bearer ' . $k['waToken'], 'Content-Type: application/json'], json_encode($msg, JSON_UNESCAPED_UNICODE));
      $ok = $c >= 200 && $c < 300;
      $er = json_decode($r, true)['error'] ?? [];
      $res[] = ['id' => $id, 'clave' => $m, 'ok' => $ok, 'motivo' => $ok ? '' : (($er['error_data']['details'] ?? '') ?: ($er['message'] ?? '') ?: ($e ?: 'WhatsApp respondió ' . $c))];
    }
  }
  guardarPersonas($pers);
  // Se anota quién lo ha enviado, cuándo y a quién (para no repetir)
  $fp = fopen(privado() . '/com.lock', 'c'); flock($fp, LOCK_EX);
  [$d] = leer();
  foreach ($d['lista'] as &$x) {
    if (($x['id'] ?? '') !== $com['id']) continue;
    $x['enviados'] = $x['enviados'] ?? ['correo' => [], 'whatsapp' => []];
    $ya = $x['enviados'][$canal] ?? [];
    foreach ($res as $r) if ($r['ok']) $ya[] = $r['clave'];
    $x['enviados'][$canal] = array_values(array_unique($ya));
    $err = [];
    foreach ($res as $r) if (!$r['ok']) $err[] = ['id' => $r['id'], 'motivo' => mb_substr((string)$r['motivo'], 0, 200)];
    $x['envios'] = array_slice(array_merge($x['envios'] ?? [], [['fecha' => gmdate('c'), 'canal' => $canal, 'por' => mb_substr((string)($cuerpo['por'] ?? ''), 0, 80),
      'ok' => count(array_filter($res, fn($r) => $r['ok'])), 'errores' => $err]]), -200);
    $x['estado'] = 'enviado';
    $com = $x;
  }
  unset($x);
  $etag = escribir($d);
  flock($fp, LOCK_UN); fclose($fp);
  salir(['resultados' => $res, 'etag' => $etag, 'enviados' => $com['enviados'], 'envios' => $com['envios']]);
}

salir(['error' => 'No existe'], 404);
