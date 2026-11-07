<?php
/* Piezas comunes de los archivos PHP del boletín en Hostinger (com.php, est.php, ir.php).
   La carpeta privada está fuera de la web y de GitHub: ahí van comunicaciones, claves y estadísticas. */
if (basename($_SERVER['SCRIPT_FILENAME'] ?? '') === basename(__FILE__)) { http_response_code(404); exit; }

if (!function_exists('salir')) {
  function salir($datos, $codigo = 200) {
    http_response_code($codigo);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($datos, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
  }
}
if (!function_exists('privado')) {
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
}
if (!function_exists('pedir')) {
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
}
function origenBoletin() { return getenv('BOLETIN_ORIGEN') ?: 'https://boletinpatriam.netlify.app'; }
function webBoletin() { return 'https://boletin.movimientopatriam.es'; }

/* Clave propia del servidor para firmar los enlaces (se crea sola la primera vez) */
function secreto() {
  $f = privado() . '/secreto.txt';
  if (!is_file($f)) { file_put_contents($f, bin2hex(random_bytes(32)), LOCK_EX); @chmod($f, 0600); }
  return trim(file_get_contents($f));
}

/* Solo administradores del editor: se comprueba con el servidor del boletín (los únicos que ven los suscriptores) */
function comprobarAdmin() {
  $token = $_SERVER['HTTP_AUTHORIZATION'] ?? ($_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '');
  if (!$token) salir(['error' => 'sesion'], 401);
  [$c, $r] = pedir(origenBoletin() . '/api/suscriptores', ['Authorization: ' . $token, 'Accept: application/json']);
  if ($c === 401) salir(['error' => 'sesion'], 401);
  if ($c !== 200) salir(['error' => $c === 403 ? 'Solo para administradores.' : 'No se ha podido comprobar la sesión (' . $c . ').'], $c === 403 ? 403 : 502);
  return json_decode($r, true)['suscriptores'] ?? [];
}

/* Equipo de la web (publicar.movimientopatriam.es): sesión de Supabase de un miembro activo del equipo.
   La dirección y la clave anon de Supabase son públicas; lo que se comprueba es la sesión de la persona. */
const SUPABASE_URL = 'https://igrjdsfcecbwnawwgdop.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlncmpkc2ZjZWNid25hd3dnZG9wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI1MzAwMzcsImV4cCI6MjEwODEwNjAzN30.HCT6LM_Xly-s-Z2KLlBDgxVzDWAwKKkMXzSjFub5qBc';
function comprobarEquipoWeb() {
  $token = $_SERVER['HTTP_AUTHORIZATION'] ?? ($_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '');
  if (!$token) salir(['error' => 'sesion'], 401);
  $cab = ['Authorization: ' . $token, 'apikey: ' . SUPABASE_ANON, 'Accept: application/json'];
  [$c, $r] = pedir(SUPABASE_URL . '/auth/v1/user', $cab);
  $id = $c === 200 ? (json_decode($r, true)['id'] ?? '') : '';
  if (!preg_match('/^[0-9a-f-]{36}$/', $id)) salir(['error' => 'sesion'], 401);
  [$c, $r] = pedir(SUPABASE_URL . '/rest/v1/perfiles?select=activo,rol&id=eq.' . $id, $cab);
  $p = $c === 200 ? (json_decode($r, true)[0] ?? null) : null;
  if (!$p || empty($p['activo']) || in_array($p['rol'] ?? '', ['pendiente', 'cliente'], true)) salir(['error' => 'Solo para el equipo de PATRIAM.'], 403);
  return true;
}
/* Publicar está en otro subdominio: se le deja leer las estadísticas */
function permitirPublicar() {
  $o = $_SERVER['HTTP_ORIGIN'] ?? '';
  if (!preg_match('#^https://([a-z0-9-]+\.)?movimientopatriam\.(es|com|org|net)$#', $o)) return;
  header('Access-Control-Allow-Origin: ' . $o);
  header('Vary: Origin');
  header('Access-Control-Allow-Headers: Authorization, Content-Type');
  header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
  if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }
}

/* Cualquier usuario del editor con la sesión abierta (no hace falta ser administrador) */
function comprobarSesion() {
  $token = $_SERVER['HTTP_AUTHORIZATION'] ?? ($_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '');
  if (!$token) salir(['error' => 'sesion'], 401);
  [$c, $r] = pedir(origenBoletin() . '/api/datos', ['Authorization: ' . $token, 'Accept: application/json']);
  if ($c === 401) salir(['error' => 'sesion'], 401);
  if ($c !== 200) salir(['error' => 'No se ha podido comprobar la sesión (' . $c . ').'], 502);
  return true;
}

/* ---------- estadísticas ---------- */
/* Visitante anónimo: una huella que cambia cada día. No se guarda la IP ni se usan cookies. */
function visitante() {
  $ip = $_SERVER['HTTP_X_FORWARDED_FOR'] ?? ($_SERVER['REMOTE_ADDR'] ?? '');
  $ip = trim(explode(',', $ip)[0]);
  return substr(hash('sha256', secreto() . '|' . gmdate('Y-m-d') . '|' . $ip . '|' . ($_SERVER['HTTP_USER_AGENT'] ?? '')), 0, 12);
}
function esRobot() {
  return (bool)preg_match('/bot|crawl|spider|slurp|facebookexternalhit|whatsapp|telegram|preview|headless|lighthouse|curl|wget|python/i', $_SERVER['HTTP_USER_AGENT'] ?? '');
}
function apuntar($ev) {
  $dir = privado() . '/est';
  if (!is_dir($dir)) @mkdir($dir, 0750, true);
  $ev['f'] = gmdate('c');
  file_put_contents("$dir/" . gmdate('Y-m') . '.jsonl', json_encode($ev, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . "\n", FILE_APPEND | LOCK_EX);
  // Se guardan 13 meses; lo anterior se borra solo
  $limite = gmdate('Y-m', strtotime('-13 months'));
  foreach (glob("$dir/*.jsonl") ?: [] as $f) if (basename($f, '.jsonl') < $limite) @unlink($f);
}

/* ---------- enlaces con seguimiento en las comunicaciones personales ---------- */
/* Cada persona tiene un código (el mismo en todas las comunicaciones); la lista de códigos solo la ve el servidor */
function codigoPersona($id) { return substr(hash_hmac('sha256', 'p|' . $id, secreto()), 0, 12); }
function firmaEnlace($u, $p, $k) { return substr(hash_hmac('sha256', $u . '|' . $p . '|' . $k, secreto()), 0, 16); }
function enlaceSeguido($u, $p, $k) {
  return webBoletin() . '/ir.php?u=' . rawurlencode($u) . '&p=' . $p . '&k=' . rawurlencode($k) . '&s=' . firmaEnlace($u, $p, $k);
}
function guardarPersonas($nuevas) {
  if (!$nuevas) return;
  $f = privado() . '/personas.json';
  $fp = fopen($f, 'c+'); flock($fp, LOCK_EX);
  $t = stream_get_contents($fp);
  $d = $t ? (json_decode($t, true) ?: []) : [];
  foreach ($nuevas as $p => $x) $d[$p] = $x;
  ftruncate($fp, 0); rewind($fp); fwrite($fp, json_encode($d, JSON_UNESCAPED_UNICODE));
  flock($fp, LOCK_UN); fclose($fp);
}
/* Cambia los enlaces de un correo (HTML) o de un texto por enlaces con seguimiento */
function seguirEnlacesHtml($html, $p, $k) {
  return preg_replace_callback('/href="(https?:\/\/[^"]+)"/i', function ($m) use ($p, $k) {
    return 'href="' . htmlspecialchars(enlaceSeguido(html_entity_decode($m[1], ENT_QUOTES), $p, $k), ENT_QUOTES) . '"';
  }, $html);
}
function seguirEnlacesTexto($t, $p, $k) {
  return preg_replace_callback('/https?:\/\/[^\s)<>"]+/i', fn($m) => enlaceSeguido($m[0], $p, $k), $t);
}
