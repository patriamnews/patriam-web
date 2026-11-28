<?php
/* Piezas comunes de los PHP de la web (pago con Stripe y pedidos de Gelato).
   Las claves y los pedidos se guardan en una carpeta privada FUERA de public_html: no la ve nadie desde
   internet y no la borra ninguna publicación desde GitHub. Es la misma carpeta que usa el boletín. */
if (basename($_SERVER['SCRIPT_FILENAME'] ?? '') === basename(__FILE__)) { http_response_code(404); exit; }

function salir($d, $c = 200) {
  http_response_code($c);
  header('Content-Type: application/json; charset=utf-8');
  header('Cache-Control: no-store');
  echo json_encode($d, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
  exit;
}
function privado() {
  static $d = null;
  if ($d) return $d;
  foreach ([dirname(__DIR__, 2) . '/patriam-privado', dirname(__DIR__) . '/patriam-privado'] as $c) {
    if ((is_dir($c) || @mkdir($c, 0750, true)) && is_writable($c)) {
      if (!file_exists("$c/.htaccess")) @file_put_contents("$c/.htaccess", "Require all denied\nDeny from all\n");
      @mkdir("$c/pedidos", 0750, true);
      return $d = $c;
    }
  }
  salir(['error' => 'El servidor no deja guardar los datos.'], 500);
}
function claves() {
  foreach ([dirname(__DIR__, 2) . '/patriam-privado/claves.json', dirname(__DIR__) . '/patriam-privado/claves.json'] as $f)
    if (is_file($f)) return json_decode(file_get_contents($f), true) ?: [];
  return [];
}
function leerPedido($ref) { $f = privado() . '/pedidos/' . $ref . '.json'; return is_file($f) ? (json_decode(file_get_contents($f), true) ?: null) : null; }
function guardarPedido($ref, $p) { file_put_contents(privado() . '/pedidos/' . $ref . '.json', json_encode($p, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT), LOCK_EX); }

function pedirHttp($url, $cab = [], $cuerpo = null, $usuario = null) {
  $ch = curl_init($url);
  curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 40, CURLOPT_HTTPHEADER => $cab]);
  if ($usuario !== null) curl_setopt($ch, CURLOPT_USERPWD, $usuario);
  if ($cuerpo !== null) { curl_setopt($ch, CURLOPT_POST, true); curl_setopt($ch, CURLOPT_POSTFIELDS, $cuerpo); }
  $r = curl_exec($ch); $c = curl_getinfo($ch, CURLINFO_RESPONSE_CODE); curl_close($ch);
  return [$c, json_decode((string)$r, true) ?: [], (string)$r];
}

// Correo con Brevo (si su clave está puesta). avisar() escribe a la asociación.
function enviarCorreo($para, $asunto, $texto) {
  $k = claves();
  if (empty($k['brevo']) || !filter_var($para, FILTER_VALIDATE_EMAIL)) return;
  pedirHttp('https://api.brevo.com/v3/smtp/email', ['api-key: ' . $k['brevo'], 'Content-Type: application/json', 'Accept: application/json'], json_encode([
    'sender' => ['name' => 'Tienda PATRIAM', 'email' => 'tienda@movimientopatriam.es'],
    'replyTo' => ['email' => 'hola@movimientopatriam.com'],
    'to' => [['email' => $para]],
    'subject' => $asunto,
    'textContent' => $texto,
  ], JSON_UNESCAPED_UNICODE));
}
function avisar($asunto, $texto) { enviarCorreo('hola@movimientopatriam.com', $asunto, $texto); }

/* Sesión del equipo: ficha firmada por el servidor (12 horas) */
function secretoWeb() {
  $f = privado() . '/secreto-web.txt';
  if (!is_file($f)) { file_put_contents($f, bin2hex(random_bytes(32)), LOCK_EX); @chmod($f, 0600); }
  return trim(file_get_contents($f));
}
function crearToken($h) {
  $d = rtrim(strtr(base64_encode(json_encode(['h' => $h, 'x' => time() + 43200])), '+/', '-_'), '=');
  return $d . '.' . hash_hmac('sha256', $d, secretoWeb());
}
function comprobarToken($t) {
  $t = (string)$t; if (strpos($t, '.') === false) return null;
  [$d, $firma] = explode('.', $t, 2);
  if (!hash_equals(hash_hmac('sha256', $d, secretoWeb()), $firma)) return null;
  $j = json_decode(base64_decode(strtr($d, '-_', '+/')), true);
  return ($j && ($j['x'] ?? 0) > time()) ? ($j['h'] ?? null) : null;
}

// Solo el equipo, con su sesión de Publicar ya con la contraseña propia (no la inicial)
function exigirEquipo($p) {
  $h = comprobarToken($p['token'] ?? '');
  $eq = is_file(privado() . '/equipo.json') ? (json_decode(file_get_contents(privado() . '/equipo.json'), true) ?: []) : [];
  if (!$h || empty($eq[$h])) salir(['error' => 'sesion'], 401);
  if (!empty($eq[$h]['cambiar'])) salir(['error' => 'Antes tiene que cambiar su contraseña inicial.'], 403);
  return $h;
}
// Dirección secreta del aviso (webhook) de Gelato: se pega una vez en el panel de Gelato
function claveWebhookGelato() { return substr(hash_hmac('sha256', 'gelato-webhook', secretoWeb()), 0, 32); }
function urlWebhookGelato() { return 'https://movimientopatriam.es/api/gelato-webhook.php?k=' . claveWebhookGelato(); }

/* Lectura pública de Supabase (la misma clave anon que usa cualquier navegador; la seguridad está en RLS).
   Sirve para que el servidor compruebe precios y productos en vez de fiarse de lo que manda el navegador. */
function supabaseLeer($ruta) {
  $url = 'https://igrjdsfcecbwnawwgdop.supabase.co/rest/v1/' . $ruta;
  $anon = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlncmpkc2ZjZWNid25hd3dnZG9wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI1MzAwMzcsImV4cCI6MjEwODEwNjAzN30.HCT6LM_Xly-s-Z2KLlBDgxVzDWAwKKkMXzSjFub5qBc';
  [$c, $d] = pedirHttp($url, ['apikey: ' . $anon, 'Authorization: Bearer ' . $anon]);
  return $c === 200 && is_array($d) ? $d : null;
}
