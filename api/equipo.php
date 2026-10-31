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
