<?php
/* Entrada del equipo (Isabel, Carlos, Álvaro y Laura) comprobada en el servidor.
   Es la misma contraseña con la que entran en Publicar y en la Gestión. Con ella se pueden ver y cambiar
   las claves secretas. Los emails solo están como huella (SHA-256), no en claro.
   La primera vez la contraseña es patriam12345 y obliga a cambiarla. Tras 5 fallos se bloquea 15 minutos. */
require_once __DIR__ . '/_comun.php';
if ($_SERVER['REQUEST_METHOD'] !== 'POST') salir(['error' => 'Método no permitido'], 405);

$EQUIPO = [
  'ca8ba4587a5cafab739d6e1fa306b3c1a93ffb0c44a0edf97da0eede6573cf2b',
  'd54107075e0767501597996cde12d533654a7db1d73af49bbae6c823ab549943',
  '49d20e0445b618d5987582aaa7afd95fdd73df7c879b8a8dee630b2c029988bf',
  '69fe153ddbb033c702aad048cd9433e0de4a793cd71d62ca7d512afbcec1d347',
];
$f = privado() . '/equipo.json';
$u = is_file($f) ? (json_decode(file_get_contents($f), true) ?: []) : [];
foreach ($EQUIPO as $h) if (empty($u[$h])) $u[$h] = ['hash' => password_hash('patriam12345', PASSWORD_DEFAULT), 'cambiar' => true, 'fallos' => 0, 'hasta' => 0];
$guardar = function () use (&$u, $f) { file_put_contents($f, json_encode($u), LOCK_EX); @chmod($f, 0600); };

$p = json_decode(file_get_contents('php://input'), true) ?: [];
$accion = $p['accion'] ?? '';

/* Entrada con Google o Microsoft (sesión de Supabase): si el correo es del equipo, o es «otro correo» de alguien del equipo
   (Usuarios y permisos › Entra también con), se da la misma ficha que con la contraseña. */
if ($accion === 'entrar-cuenta') {
  $tk = preg_replace('/[^A-Za-z0-9._-]/', '', (string)($p['acceso'] ?? ''));
  $sb = 'https://igrjdsfcecbwnawwgdop.supabase.co';
  $anon = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlncmpkc2ZjZWNid25hd3dnZG9wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI1MzAwMzcsImV4cCI6MjEwODEwNjAzN30.HCT6LM_Xly-s-Z2KLlBDgxVzDWAwKKkMXzSjFub5qBc';
  $cab = ['apikey: ' . $anon, 'Authorization: Bearer ' . $tk];
  [$c, $yo] = pedirHttp($sb . '/auth/v1/user', $cab);
  $email = strtolower(trim((string)($yo['email'] ?? '')));
  if ($c !== 200 || $email === '') salir(['error' => 'sesion'], 401);
  $correos = [$email];
  [$c, $d] = pedirHttp($sb . '/rest/v1/correos_entrada?select=perfiles(email)&email=eq.' . rawurlencode($email), $cab);
  if ($c === 200) foreach ((array)$d as $x) if (!empty($x['perfiles']['email'])) $correos[] = strtolower($x['perfiles']['email']);
  foreach ($correos as $e) { $h = hash('sha256', $e); if (!empty($u[$h])) salir(['equipo' => true, 'token' => crearToken($h), 'cambiar' => false]); }
  salir(['equipo' => false]);
}

if ($accion === 'entrar') {
  $h = hash('sha256', strtolower(trim((string)($p['email'] ?? ''))));
  if (empty($u[$h])) salir(['equipo' => false]);          // no es del equipo: asociado o cliente
  if (($u[$h]['hasta'] ?? 0) > time()) salir(['error' => 'Demasiados intentos. Espere unos minutos.'], 429);
  if (!password_verify((string)($p['clave'] ?? ''), $u[$h]['hash'])) {
    $u[$h]['fallos'] = ($u[$h]['fallos'] ?? 0) + 1;
    if ($u[$h]['fallos'] >= 5) { $u[$h]['hasta'] = time() + 900; $u[$h]['fallos'] = 0; }
    $guardar();
    salir(['error' => 'Email o contraseña incorrectos.'], 401);
  }
  $u[$h]['fallos'] = 0; $guardar();
  salir(['equipo' => true, 'token' => crearToken($h), 'cambiar' => !empty($u[$h]['cambiar'])]);
}

if ($accion === 'cambiar') {
  $h = comprobarToken($p['token'] ?? '');
  if (!$h || empty($u[$h])) salir(['error' => 'sesion'], 401);
  $nueva = (string)($p['nueva'] ?? '');
  if (mb_strlen($nueva) < 10) salir(['error' => 'La contraseña debe tener al menos 10 caracteres.'], 400);
  if ($nueva === 'patriam12345') salir(['error' => 'Elija una contraseña distinta de la inicial.'], 400);
  $u[$h]['hash'] = password_hash($nueva, PASSWORD_DEFAULT); $u[$h]['cambiar'] = false; $guardar();
  salir(['ok' => true]);
}
salir(['error' => 'Acción no válida'], 400);
