<?php
/* Avisos de Gelato (webhook): se configura una vez en el panel de Gelato › Developer › Webhooks con la dirección
   que aparece en Publicar › Cuentas y claves › Gelato. Guarda el estado del pedido y, cuando sale el envío,
   manda al comprador el número de seguimiento. */
require_once __DIR__ . '/_comun.php';
if (!hash_equals(claveWebhookGelato(), (string)($_GET['k'] ?? ''))) salir(['error' => 'no'], 403);
$e = json_decode(file_get_contents('php://input'), true) ?: [];
if (($e['event'] ?? '') === 'store_product_created') {
  avisar('Nuevo producto en Gelato: póngale precio', 'Se ha creado «' . mb_substr((string)($e['title'] ?? 'un producto'), 0, 150) . "» en la tienda de Gelato.\nPara venderlo en la web: publicar.movimientopatriam.es › Mis productos de Gelato › ponga el precio › Poner a la venta.");
  salir(['ok' => true]);
}
$ref = (string)($e['orderReferenceId'] ?? '');
if (!preg_match('/^[A-Za-z0-9\-_]{4,60}$/', $ref)) salir(['ok' => true]);
$ped = leerPedido($ref);
if (!$ped) salir(['ok' => true]);
$ped['avisosGelato'][] = ['evento' => $e['event'] ?? '', 'estado' => $e['fulfillmentStatus'] ?? null, 'fecha' => date('c')];
$ped['avisosGelato'] = array_slice($ped['avisosGelato'], -30);

$ESTADOS = ['created' => 'recibido en Gelato', 'passed' => 'aceptado', 'in_production' => 'en fabricación', 'printed' => 'fabricado',
  'shipped' => 'enviado', 'in_transit' => 'en camino', 'delivered' => 'entregado', 'canceled' => 'cancelado', 'failed' => 'con un problema', 'on_hold' => 'en espera'];
$evento = $e['event'] ?? '';
if ($evento === 'order_status_updated' && !empty($e['fulfillmentStatus'])) {
  $ped['estadoGelato'] = $e['fulfillmentStatus'];
  if (in_array($e['fulfillmentStatus'], ['canceled', 'failed', 'on_hold'], true))
    avisar("Pedido $ref " . $ESTADOS[$e['fulfillmentStatus']], "Gelato dice que el pedido $ref está " . $ESTADOS[$e['fulfillmentStatus']] . '. Revíselo en el panel de Gelato.');
  foreach (($e['items'] ?? []) as $it) foreach (($it['fulfillments'] ?? []) as $f)
    if (!empty($f['trackingUrl'])) $nuevo[$f['trackingUrl']] = $f['trackingCode'] ?? '';
}
if ($evento === 'order_item_tracking_code_updated' && !empty($e['trackingUrl'])) $nuevo[$e['trackingUrl']] = $e['trackingCode'] ?? '';
foreach (($nuevo ?? []) as $url => $codigo) {
  if (isset($ped['seguimiento'][$url])) continue;
  $ped['seguimiento'][$url] = $codigo;
  $para = ($ped['email'] ?? '') ?: ($ped['envio']['email'] ?? '');
  enviarCorreo($para, 'Su pedido de la tienda PATRIAM ya está en camino',
    "Hola:\n\nSu pedido $ref ya ha salido. Puede seguir el envío aquí:\n$url" . ($codigo ? "\n(número de seguimiento: $codigo)" : '') .
    "\n\nGracias por apoyar a PATRIAM.\nSi tiene cualquier duda, responda a este correo.");
}
guardarPedido($ref, $ped);
salir(['ok' => true]);
