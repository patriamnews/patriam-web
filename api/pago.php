<?php
/* Pago con tarjeta con Stripe Checkout (cuotas, donativos y pedidos de la tienda). Se usa solo si PayPal no está activado.
   La clave secreta de Stripe NO está en la web ni en GitHub: se guarda en Publicar › Claves y queda en la carpeta
   privada del servidor de Hostinger. Este archivo crea la sesión de pago y devuelve la dirección de la página segura de Stripe.
   Los importes se calculan en _cobro.php (común con PayPal). */

require_once __DIR__ . '/_cobro.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') exit;
if ($_SERVER['REQUEST_METHOD'] !== 'POST') salir(['error' => 'Método no permitido'], 405);

$CLAVE = claves()['stripe'] ?? '';
if (!$CLAVE) salir(['error' => 'El pago con tarjeta aún no está activado. Inténtelo más tarde o escríbanos.'], 503);

$p = json_decode(file_get_contents('php://input'), true) ?: [];
$co = prepararCobro($p);
$ref = $co['ref'];

$WEB = 'https://movimientopatriam.es';
$f = [
  'locale' => 'es',
  'client_reference_id' => $ref,
  'metadata[referencia]' => $ref,
  'metadata[tipo]' => $co['tipo'],
  'success_url' => $WEB . '/pago-correcto?ref=' . rawurlencode($ref),
  'cancel_url' => $WEB . '/pago-cancelado?ref=' . rawurlencode($ref),
];
if ($co['email']) $f['customer_email'] = $co['email'];
$lineas = $co['lineas'];
if ($co['envio'] > 0) $lineas[] = ['Gastos de envío', 1, $co['envio']];
foreach ($lineas as $i => [$nombre, $cant, $cent]) {
  $f["line_items[$i][quantity]"] = $cant;
  $f["line_items[$i][price_data][currency]"] = 'eur';
  $f["line_items[$i][price_data][unit_amount]"] = $cent;
  $f["line_items[$i][price_data][product_data][name]"] = $nombre;
}
if ($co['tipo'] === 'cuota') {
  $f['mode'] = 'subscription';
  $f['line_items[0][price_data][recurring][interval]'] = 'month';
  $f['subscription_data[metadata][referencia]'] = $ref;
} else {
  $f['mode'] = 'payment';
  $f['payment_intent_data[metadata][referencia]'] = $ref;
  if ($co['tipo'] === 'donativo') $f['submit_type'] = 'donate';
  if ($co['gelato']) {
    $f['metadata[gelato]'] = '1';
    $f['shipping_address_collection[allowed_countries][0]'] = 'ES';
    $f['phone_number_collection[enabled]'] = 'true';
    if (!leerPedido($ref)) guardarPedido($ref, ['referencia' => $ref, 'email' => $co['email'], 'gelato' => $co['gelato'], 'estado' => 'pendiente de pago', 'creado' => date('c')]);
  }
}

[$c, $d] = pedirHttp('https://api.stripe.com/v1/checkout/sessions', ['Stripe-Version: 2024-06-20'], http_build_query($f), $CLAVE . ':');
if ($c !== 200 || empty($d['url'])) salir(['error' => 'Stripe no ha podido preparar el pago: ' . ($d['error']['message'] ?? 'error ' . $c)], 502);
salir(['url' => $d['url']]);
