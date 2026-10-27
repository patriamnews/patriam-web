<?php
/* Pago con tarjeta con Stripe Checkout (cuotas, donativos y pedidos de la tienda).
   La clave secreta de Stripe NO está en la web ni en GitHub: se guarda una sola vez en el editor del boletín
   (Comunicaciones › Claves de envío › Stripe) y queda en la carpeta privada del servidor de Hostinger.
   Este archivo crea la sesión de pago y devuelve la dirección de la página segura de Stripe. */

require_once __DIR__ . '/_comun.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') exit;
if ($_SERVER['REQUEST_METHOD'] !== 'POST') salir(['error' => 'Método no permitido'], 405);

$CLAVE = claves()['stripe'] ?? '';
if (!$CLAVE) salir(['error' => 'El pago con tarjeta aún no está activado. Inténtelo más tarde o escríbanos.'], 503);

$p = json_decode(file_get_contents('php://input'), true) ?: [];
$tipo = $p['tipo'] ?? '';
$ref = preg_replace('/[^A-Za-z0-9-]/', '', (string)($p['referencia'] ?? ''));
$email = filter_var($p['email'] ?? '', FILTER_VALIDATE_EMAIL) ?: '';
if (!$ref) salir(['error' => 'Falta la referencia.'], 400);

$WEB = 'https://movimientopatriam.es';
$f = [
  'locale' => 'es',
  'client_reference_id' => $ref,
  'metadata[referencia]' => $ref,
  'metadata[tipo]' => $tipo,
  'success_url' => $WEB . '/#/pago-correcto?ref=' . rawurlencode($ref),
  'cancel_url' => $WEB . '/#/pago-cancelado?ref=' . rawurlencode($ref),
];
if ($email) $f['customer_email'] = $email;
$euros = fn($n) => (int)round(((float)$n) * 100);

if ($tipo === 'cuota') {
  // Importe fijado en el servidor: 10 € al mes, 5 € la reducida (no se fía del navegador)
  $reducida = !empty($p['reducida']);
  $f['mode'] = 'subscription';
  $f['line_items[0][quantity]'] = 1;
  $f['line_items[0][price_data][currency]'] = 'eur';
  $f['line_items[0][price_data][unit_amount]'] = $reducida ? 500 : 1000;
  $f['line_items[0][price_data][recurring][interval]'] = 'month';
  $f['line_items[0][price_data][product_data][name]'] = $reducida ? 'Cuota mensual reducida de asociado · PATRIAM' : 'Cuota mensual de asociado · PATRIAM';
  $f['subscription_data[metadata][referencia]'] = $ref;
} elseif ($tipo === 'donativo') {
  $c = $euros($p['importe'] ?? 0);
  if ($c < 100 || $c > 1000000) salir(['error' => 'Importe no válido.'], 400);
  $f['mode'] = 'payment';
  $f['submit_type'] = 'donate';
  $f['line_items[0][quantity]'] = 1;
  $f['line_items[0][price_data][currency]'] = 'eur';
  $f['line_items[0][price_data][unit_amount]'] = $c;
  $f['line_items[0][price_data][product_data][name]'] = 'Donativo a PATRIAM';
  $f['payment_intent_data[metadata][referencia]'] = $ref;
} elseif ($tipo === 'pedido') {
  // Pedido de la tienda: todos los artículos juntos en un solo pago (más los gastos de envío)
  $items = array_slice(is_array($p['items'] ?? null) ? $p['items'] : [], 0, 50);
  if (!$items) salir(['error' => 'El carrito está vacío.'], 400);
  $i = 0;
  foreach ($items as $it) {
    $c = $euros($it['precio'] ?? 0); $n = max(1, min(50, (int)($it['cantidad'] ?? 1)));
    if ($c <= 0) continue;
    $nombre = mb_substr(trim(($it['nombre'] ?? 'Artículo') . (!empty($it['opcion']) ? ' (talla ' . $it['opcion'] . ')' : '')), 0, 120);
    $f["line_items[$i][quantity]"] = $n;
    $f["line_items[$i][price_data][currency]"] = 'eur';
    $f["line_items[$i][price_data][unit_amount]"] = $c;
    $f["line_items[$i][price_data][product_data][name]"] = $nombre;
    $i++;
  }
  $envio = $euros($p['envio'] ?? 0);
  if ($envio > 0) {
    $f["line_items[$i][quantity]"] = 1;
    $f["line_items[$i][price_data][currency]"] = 'eur';
    $f["line_items[$i][price_data][unit_amount]"] = $envio;
    $f["line_items[$i][price_data][product_data][name]"] = 'Gastos de envío';
    $i++;
  }
  if (!$i) salir(['error' => 'No hay nada que pagar.'], 400);
  $f['mode'] = 'payment';
  $f['payment_intent_data[metadata][referencia]'] = $ref;
  // Artículos que fabrica y envía Gelato: Stripe pide la dirección de envío y el pedido se guarda para mandarlo a Gelato al cobrar
  $gelato = [];
  foreach ($items as $n => $it) {
    $g = $it['gelato'] ?? null;
    if (!$g || empty($g['uid']) || (empty($g['archivo']) && empty($g['variante']))) continue;
    if (!preg_match('/^[a-z0-9_\-.]+$/i', $g['uid']) || (!empty($g['archivo']) && !preg_match('#^https://[^|\s]+(\|https://[^|\s]+)?$#', $g['archivo']))
      || (!empty($g['variante']) && !preg_match('/^[A-Za-z0-9\-]{6,80}$/', $g['variante']))) salir(['error' => 'Producto de Gelato mal configurado.'], 400);
    $gelato[] = ['ref' => $ref . '-' . ($n + 1), 'uid' => $g['uid'], 'archivo' => $g['archivo'] ?? '', 'variante' => $g['variante'] ?? '', 'cantidad' => max(1, min(50, (int)($it['cantidad'] ?? 1))), 'nombre' => $it['nombre'] ?? ''];
  }
  if ($gelato) {
    $f['metadata[gelato]'] = '1';
    $f['shipping_address_collection[allowed_countries][0]'] = 'ES';
    $f['phone_number_collection[enabled]'] = 'true';
    if (!leerPedido($ref)) guardarPedido($ref, ['referencia' => $ref, 'email' => $email, 'gelato' => $gelato, 'estado' => 'pendiente de pago', 'creado' => date('c')]);
  }
} else {
  salir(['error' => 'Tipo de pago no válido.'], 400);
}

[$c, $d] = pedirHttp('https://api.stripe.com/v1/checkout/sessions', ['Stripe-Version: 2024-06-20'], http_build_query($f), $CLAVE . ':');
if ($c !== 200 || empty($d['url'])) salir(['error' => 'Stripe no ha podido preparar el pago: ' . ($d['error']['message'] ?? 'error ' . $c)], 502);
salir(['url' => $d['url']]);
