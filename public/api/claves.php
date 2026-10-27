<?php
/* Claves secretas de las aplicaciones (Stripe, Gelato, Awin, Brevo, WhatsApp), puestas desde «Publicar».
   Se guardan solo en la carpeta privada del servidor (fuera de la web y de GitHub) y nunca se devuelven enteras.
   Solo entra el equipo con su sesión de Publicar (comprobada por el servidor en equipo.php). */
require_once __DIR__ . '/_comun.php';
if ($_SERVER['REQUEST_METHOD'] !== 'POST') salir(['error' => 'Método no permitido'], 405);

$p = json_decode(file_get_contents('php://input'), true) ?: [];
// Solo el equipo, con su sesión de Publicar (la misma contraseña con la que entra)
$h = comprobarToken($p['token'] ?? '');
$eq = is_file(privado() . '/equipo.json') ? (json_decode(file_get_contents(privado() . '/equipo.json'), true) ?: []) : [];
if (!$h || empty($eq[$h])) salir(['error' => 'sesion'], 401);
if (!empty($eq[$h]['cambiar'])) salir(['error' => 'Antes tiene que cambiar su contraseña inicial.'], 403);

// Guardar claves (solo las que se escriben; «-» borra)
$fK = privado() . '/claves.json';
$k = is_file($fK) ? (json_decode(file_get_contents($fK), true) ?: []) : [];
$CAMPOS = ['stripe' => '/^(sk|rk)_(live|test)_[A-Za-z0-9]+$/', 'stripeWebhook' => '/^whsec_[A-Za-z0-9]+$/', 'gelato' => '/^[A-Za-z0-9\-_:.]{10,}$/', 'gelatoTienda' => '/^[A-Za-z0-9\-]{6,}$/',
  'brevo' => '/^xkeysib-[A-Za-z0-9\-]+$/', 'waToken' => '/^[A-Za-z0-9_\-]{20,}$/', 'waPhone' => '/^[0-9]{6,20}$/', 'waPlantilla' => '/^[a-z0-9_]{1,100}$/', 'awin' => '/^[0-9]{3,12}$/'];
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
  'brevo' => $fin($k['brevo'] ?? ''), 'waToken' => $fin($k['waToken'] ?? ''), 'waPhone' => $k['waPhone'] ?? '', 'waPlantilla' => $k['waPlantilla'] ?? '', 'awin' => $k['awin'] ?? '',
]]);
