<?php
/* Envío de un pedido ya cobrado a Gelato (lo usan el aviso de Stripe y el cobro con PayPal).
   Antes de pedir nada a Gelato se comprueba que lo cobrado cubre lo que cuesta fabricar y enviar el pedido.
   $ped: pedido guardado (con 'gelato' y 'pagado'); $destino: dirección en el formato de Gelato. */
if (basename($_SERVER['SCRIPT_FILENAME'] ?? '') === basename(__FILE__)) { http_response_code(404); exit; }
require_once __DIR__ . '/_comun.php';

// Archivos del diseño: «delante» o «delante|detrás» (camisetas con el logo delante y el dibujo en la espalda)
function archivosGelato($a) {
  if (!$a) return null;
  $p = explode('|', $a, 2);
  $f = [['type' => 'default', 'url' => $p[0]]];
  if (!empty($p[1])) $f[] = ['type' => 'back', 'url' => $p[1]];
  return $f;
}

function mandarAGelato($ref, &$ped, $destino) {
$K = claves();
$nombre = trim(($destino['firstName'] ?? '') . ' ' . ($destino['lastName'] ?? ''));
$ped['envio'] = $destino;
// Productos hechos en la tienda de Gelato: se piden por su variante (el diseño ya está en Gelato); los demás, con el archivo
$productos = array_map(fn($g) => array_filter(['itemReferenceId' => $g['ref'], 'productUid' => $g['uid'],
  'storeProductVariantId' => ($g['variante'] ?? '') ?: null,
  'files' => archivosGelato($g['archivo'] ?? ''), 'quantity' => $g['cantidad']]), $ped['gelato']);

if (empty($K['gelato'])) {
  $ped['estado'] = 'pagado: falta la clave de Gelato'; guardarPedido($ref, $ped);
  avisar("Pedido $ref pagado: mándelo a Gelato a mano", "Se ha cobrado el pedido $ref pero falta la clave de Gelato en el servidor. Envío a: $nombre, " . implode(', ', array_filter([$destino['addressLine1'], $destino['postCode'], $destino['city']])));
  return false;
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

// Parte del diseñador: de cada prenda con reparto, (precio cobrado − lo que cobra Gelato por fabricarla) × % del reparto.
// El envío no entra: lo que paga el cliente de envío es para Gelato, y si el envío es gratis lo asume PATRIAM.
if ($coste !== null) {
  $costeItem = [];
  foreach ($q['quotes'] as $qt) foreach ($qt['products'] ?? [] as $pr) $costeItem[$pr['itemReferenceId'] ?? ''] = (float)($pr['price'] ?? 0);
  $total = 0; $detalle = [];
  foreach ($ped['gelato'] as $g) {
    $rep = (float)($g['reparto'] ?? 0);
    if ($rep <= 0 || !isset($g['precio'])) continue;
    $venta = round((float)$g['precio'] * (int)$g['cantidad'], 2);
    $fab = round($costeItem[$g['ref']] ?? 0, 2);
    $parte = round(max(0, $venta - $fab) * $rep / 100, 2);
    $total += $parte;
    $detalle[] = ['nombre' => $g['nombre'] ?? '', 'cantidad' => (int)$g['cantidad'], 'venta' => $venta, 'costeGelato' => $fab, 'beneficio' => round($venta - $fab, 2), 'reparto' => $rep, 'disenador' => $parte];
  }
  if ($detalle) $ped['disenador'] = ['importe' => round($total, 2), 'detalle' => $detalle, 'fecha' => date('c')];
}
if ($coste === null || $ped['pagado'] + 0.01 < $coste) {
  $ped['estado'] = 'revisar: ' . ($coste === null ? 'Gelato no ha dado presupuesto' : 'lo cobrado no cubre el coste');
  guardarPedido($ref, $ped);
  avisar("Pedido $ref: revisar antes de mandarlo a Gelato", "Cobrado: {$ped['pagado']} €. Coste en Gelato: " . ($coste === null ? 'sin presupuesto (' . $cq . ')' : $coste . ' €') . ". No se ha enviado a Gelato. Revíselo en el panel de Gelato.");
  return false;
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
return !empty($ped['gelatoId']);
}
