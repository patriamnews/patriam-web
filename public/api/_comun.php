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

// Aviso por correo a la asociación (con Brevo, si su clave está puesta)
function avisar($asunto, $texto) {
  $k = claves();
  if (empty($k['brevo'])) return;
  pedirHttp('https://api.brevo.com/v3/smtp/email', ['api-key: ' . $k['brevo'], 'Content-Type: application/json', 'Accept: application/json'], json_encode([
    'sender' => ['name' => 'Tienda PATRIAM', 'email' => 'tienda@movimientopatriam.es'],
    'to' => [['email' => 'hola@movimientopatriam.com']],
    'subject' => $asunto,
    'textContent' => $texto,
  ], JSON_UNESCAPED_UNICODE));
}
