<?php
/* Aviso de Stripe cuando se ha cobrado un pago (webhook «checkout.session.completed»).
   Si el pedido lleva artículos de Gelato, se manda el pedido a Gelato para que lo fabrique y lo envíe
   con la etiqueta y el embalaje de PATRIAM (se configura en el panel de Gelato).
   Seguridad: solo se acepta el aviso si viene firmado por Stripe (clave «whsec_…» del webhook), y antes de
   pedir nada a Gelato se comprueba que lo cobrado cubre lo que cuesta fabricar y enviar el pedido. */
require_once __DIR__ . '/_comun.php';

$K = claves();
$cuerpo = file_get_contents('php://input');
$firma = $_SERVER['HTTP_STRIPE_SIGNATURE'] ?? '';

// 1. Comprobar la firma de Stripe
if (empty($K['stripeWebhook'])) salir(['error' => 'Falta la clave del webhook'], 503);
$t = null; $v1 = [];
foreach (explode(',', $firma) as $parte) {
  [$a, $b] = array_pad(explode('=', trim($parte), 2), 2, '');
  if ($a === 't') $t = $b; elseif ($a === 'v1') $v1[] = $b;
}
$esperada = hash_hmac('sha256', $t . '.' . $cuerpo, $K['stripeWebhook']);
$valida = false;
foreach ($v1 as $x) if (hash_equals($esperada, $x)) $valida = true;
if (!$t || !$valida || abs(time() - (int)$t) > 600) salir(['error' => 'Firma no válida'], 400);

$ev = json_decode($cuerpo, true) ?: [];
if (($ev['type'] ?? '') !== 'checkout.session.completed') salir(['ok' => true, 'ignorado' => $ev['type'] ?? '']);
$s = $ev['data']['object'] ?? [];
if (($s['payment_status'] ?? '') !== 'paid' || ($s['metadata']['gelato'] ?? '') !== '1') salir(['ok' => true]);

$ref = preg_replace('/[^A-Za-z0-9-]/', '', (string)($s['metadata']['referencia'] ?? $s['client_reference_id'] ?? ''));
$ped = $ref ? leerPedido($ref) : null;
if (!$ped) { avisar("Pedido $ref: pagado pero sin datos de Gelato", "Stripe ha cobrado el pedido $ref, pero no se encuentran sus artículos de Gelato. Revíselo a mano."); salir(['ok' => true]); }
if (!empty($ped['gelatoId'])) salir(['ok' => true, 'ya' => $ped['gelatoId']]);   // Stripe puede repetir el aviso

// 2. Dirección de envío que el cliente ha puesto en Stripe
$env = $s['shipping_details'] ?? ($s['collected_information']['shipping_details'] ?? null);
$cli = $s['customer_details'] ?? [];
$dir = $env['address'] ?? ($cli['address'] ?? []);
$nombre = trim($env['name'] ?? ($cli['name'] ?? ''));
$partes = preg_split('/\s+/', $nombre, 2);
$destino = [
  'firstName' => $partes[0] ?? '', 'lastName' => $partes[1] ?? ($partes[0] ?? ''),
  'addressLine1' => $dir['line1'] ?? '', 'addressLine2' => $dir['line2'] ?? '',
  'city' => $dir['city'] ?? '', 'postCode' => $dir['postal_code'] ?? '', 'state' => $dir['state'] ?? '',
  'country' => $dir['country'] ?? 'ES', 'email' => $cli['email'] ?? ($ped['email'] ?? ''), 'phone' => $cli['phone'] ?? '',
];
// Productos hechos en la tienda de Gelato: se piden por su variante (el diseño ya está en Gelato); los demás, con el archivo
$productos = array_map(fn($g) => array_filter(['itemReferenceId' => $g['ref'], 'productUid' => $g['uid'],
  'storeProductVariantId' => ($g['variante'] ?? '') ?: null,
  'files' => !empty($g['archivo']) ? [['type' => 'default', 'url' => $g['archivo']]] : null, 'quantity' => $g['cantidad']]), $ped['gelato']);
$ped['pagado'] = ($s['amount_total'] ?? 0) / 100;
$ped['envio'] = $destino;

if (empty($K['gelato'])) {
  $ped['estado'] = 'pagado: falta la clave de Gelato'; guardarPedido($ref, $ped);
  avisar("Pedido $ref pagado: mándelo a Gelato a mano", "Se ha cobrado el pedido $ref pero falta la clave de Gelato en el servidor. Envío a: $nombre, " . implode(', ', array_filter([$destino['addressLine1'], $destino['postCode'], $destino['city']])));
  salir(['ok' => true]);
}
$cab = ['X-API-KEY: ' . $K['gelato'], 'Content-Type: application/json'];

// 3. Presupuesto de Gelato: lo cobrado debe cubrir fabricación + envío (evita pedidos con precios manipulados)
[$cq, $q] = pedirHttp('https://order.gelatoapis.com/v4/orders:quote', $cab, json_encode([
  'orderReferenceId' => $ref, 'customerReferenceId' => $destino['email'], 'currency' => 'EUR', 'allowMultipleQuotes' => false,
  'recipient' => $destino, 'products' => $productos,
], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
$coste = null;
if ($cq === 200 && !empty($q['quotes'])) {
  $coste = 0;
  foreach ($q['quotes'] as $qt) {
    foreach ($qt['products'] ?? [] as $pr) $coste += (float)($pr['price'] ?? 0);
    $metodos = $qt['shipmentMethods'] ?? [];
    if ($metodos) $coste += min(array_map(fn($m) => (float)($m['price'] ?? 0), $metodos));
  }
}
$ped['costeGelato'] = $coste;
if ($coste === null || $ped['pagado'] + 0.01 < $coste) {
  $ped['estado'] = 'revisar: ' . ($coste === null ? 'Gelato no ha dado presupuesto' : 'lo cobrado no cubre el coste');
  guardarPedido($ref, $ped);
  avisar("Pedido $ref: revisar antes de mandarlo a Gelato", "Cobrado: {$ped['pagado']} €. Coste en Gelato: " . ($coste === null ? 'sin presupuesto (' . $cq . ')' : $coste . ' €') . ". No se ha enviado a Gelato. Revíselo en el panel de Gelato o de Stripe.");
  salir(['ok' => true]);
}

// 4. Pedido a Gelato
[$co, $o, $raw] = pedirHttp('https://order.gelatoapis.com/v4/orders', $cab, json_encode([
  'orderType' => 'order', 'orderReferenceId' => $ref, 'customerReferenceId' => $destino['email'], 'currency' => 'EUR',
  'items' => $productos, 'shippingAddress' => $destino,
], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
if ($co >= 200 && $co < 300 && !empty($o['id'])) {
  $ped['gelatoId'] = $o['id']; $ped['estado'] = 'enviado a Gelato'; guardarPedido($ref, $ped);
  avisar("Pedido $ref enviado a Gelato", "Cobrado: {$ped['pagado']} €. Coste en Gelato: $coste €. Gelato lo fabrica y lo envía a $nombre ({$destino['city']}). Nº de pedido en Gelato: {$o['id']}.");
} else {
  $ped['estado'] = 'error al mandarlo a Gelato'; $ped['errorGelato'] = mb_substr($raw, 0, 500); guardarPedido($ref, $ped);
  avisar("Pedido $ref: error al mandarlo a Gelato", "Cobrado: {$ped['pagado']} €. Gelato respondió $co: " . mb_substr($raw, 0, 300));
}
salir(['ok' => true]);
