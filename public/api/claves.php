<?php
/* Claves de los pagos y de la tienda (Stripe y Gelato), puestas desde «Publicar».
   Se guardan solo en la carpeta privada del servidor (fuera de la web y de GitHub) y nunca se devuelven enteras.
   Para poder verlas o cambiarlas hace falta la contraseña de claves. La primera vez es patriam12345 y obliga a cambiarla.
   Tras 5 intentos fallidos se bloquea 15 minutos. */
require_once __DIR__ . '/_comun.php';
if ($_SERVER['REQUEST_METHOD'] !== 'POST') salir(['error' => 'Método no permitido'], 405);

$fA = privado() . '/acceso-claves.json';
$acc = is_file($fA) ? (json_decode(file_get_contents($fA), true) ?: []) : [];
if (empty($acc['hash'])) $acc = ['hash' => password_hash('patriam12345', PASSWORD_DEFAULT), 'cambiar' => true, 'fallos' => 0, 'hasta' => 0];
$guardarAcc = function () use (&$acc, $fA) { file_put_contents($fA, json_encode($acc), LOCK_EX); @chmod($fA, 0600); };

$p = json_decode(file_get_contents('php://input'), true) ?: [];
if (($acc['hasta'] ?? 0) > time()) salir(['error' => 'Demasiados intentos. Espere unos minutos.'], 429);
if (!password_verify((string)($p['clave'] ?? ''), $acc['hash'])) {
  $acc['fallos'] = ($acc['fallos'] ?? 0) + 1;
  if ($acc['fallos'] >= 5) { $acc['hasta'] = time() + 900; $acc['fallos'] = 0; }
  $guardarAcc();
  salir(['error' => 'Contraseña incorrecta.'], 401);
}
$acc['fallos'] = 0; $acc['hasta'] = 0;

// Cambio de contraseña (obligatorio la primera vez)
$nueva = (string)($p['nueva'] ?? '');
if ($nueva !== '') {
  if (mb_strlen($nueva) < 10) salir(['error' => 'La nueva contraseña debe tener al menos 10 caracteres.'], 400);
  if ($nueva === 'patriam12345') salir(['error' => 'La nueva contraseña no puede ser la inicial.'], 400);
  $acc['hash'] = password_hash($nueva, PASSWORD_DEFAULT); $acc['cambiar'] = false;
}
$guardarAcc();
if (!empty($acc['cambiar'])) salir(['cambiar' => true]);

// Guardar claves (solo las que se escriben; «-» borra)
$fK = privado() . '/claves.json';
$k = is_file($fK) ? (json_decode(file_get_contents($fK), true) ?: []) : [];
$CAMPOS = ['stripe' => '/^(sk|rk)_(live|test)_[A-Za-z0-9]+$/', 'stripeWebhook' => '/^whsec_[A-Za-z0-9]+$/', 'gelato' => '/^[A-Za-z0-9\-_:.]{10,}$/', 'gelatoTienda' => '/^[A-Za-z0-9\-]{6,}$/'];
foreach ($CAMPOS as $c => $re) {
  if (!isset($p['valores'][$c])) continue;
  $v = trim((string)$p['valores'][$c]);
  if ($v === '') continue;
  if ($v === '-') { unset($k[$c]); continue; }
  if (!preg_match($re, $v)) salir(['error' => "El valor de «{$c}» no tiene el formato esperado."], 400);
  $k[$c] = $v;
}
file_put_contents($fK, json_encode($k), LOCK_EX); @chmod($fK, 0600);
$fin = fn($v) => $v ? '…' . substr($v, -4) : '';
salir(['ok' => true, 'estado' => [
  'stripe' => !empty($k['stripe']) ? (strpos($k['stripe'], '_test_') !== false ? 'de prueba ' : 'real ') . $fin($k['stripe']) : '',
  'stripeWebhook' => $fin($k['stripeWebhook'] ?? ''), 'gelato' => $fin($k['gelato'] ?? ''), 'gelatoTienda' => $k['gelatoTienda'] ?? '',
]]);
