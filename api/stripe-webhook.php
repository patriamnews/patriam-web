<?php
/* Aviso de Stripe cuando se ha cobrado un pago (webhook «checkout.session.completed»).
   Si el pedido lleva artículos de Gelato, se manda el pedido a Gelato para que lo fabrique y lo envíe
   con la etiqueta y el embalaje de PATRIAM (se configura en el panel de Gelato).
   Seguridad: solo se acepta el aviso si viene firmado por Stripe (clave «whsec_…» del webhook), y antes de
   pedir nada a Gelato se comprueba que lo cobrado cubre lo que cuesta fabricar y enviar el pedido. */
require_once __DIR__ . '/_gelato.php';

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
$ped['pagado'] = ($s['amount_total'] ?? 0) / 100;
if (mandarAGelato($ref, $ped, $destino)) pagarDisenador($ref, $ped, $s, $K);
salir(['ok' => true]);

/* Pago automático al diseñador con Stripe Connect (solo si en Cuentas y claves › Stripe está puesta su cuenta «acct_…»).
   Se transfiere su parte desde el propio cobro (source_transaction), así el dinero sale cuando Stripe lo libera.
   Si no hay cuenta puesta, su parte queda apuntada en el pedido y sale en la liquidación mensual de Publicar. */
function pagarDisenador($ref, &$ped, $s, $K) {
  $imp = (float)($ped['disenador']['importe'] ?? 0);
  $cuenta = trim((string)($K['stripeDisenador'] ?? ''));
  if ($imp < 0.01 || !preg_match('/^acct_[A-Za-z0-9]+$/', $cuenta) || !empty($ped['disenador']['transferencia']) || empty($K['stripe'])) return;
  $cab = ['Stripe-Version: 2024-06-20'];
  [$c, $pi] = pedirHttp('https://api.stripe.com/v1/payment_intents/' . rawurlencode((string)($s['payment_intent'] ?? '')), $cab, null, $K['stripe'] . ':');
  $cargo = $pi['latest_charge'] ?? '';
  if ($c !== 200 || !$cargo) { avisar("Pedido $ref: pagar al diseñador a mano", "No se ha podido leer el cobro en Stripe. Su parte es de $imp €."); return; }
  [$c, $t, $raw] = pedirHttp('https://api.stripe.com/v1/transfers', array_merge($cab, ['Idempotency-Key: disenador-' . $ref]), http_build_query([
    'amount' => (int)round($imp * 100), 'currency' => 'eur', 'destination' => $cuenta, 'source_transaction' => $cargo,
    'transfer_group' => $ref, 'description' => "Parte del diseñador · pedido $ref", 'metadata[referencia]' => $ref,
  ]), $K['stripe'] . ':');
  if ($c === 200 && !empty($t['id'])) $ped['disenador']['transferencia'] = $t['id'];
  else { $ped['disenador']['errorTransferencia'] = mb_substr($raw, 0, 300); avisar("Pedido $ref: no se ha pagado al diseñador", "Stripe respondió $c al transferir $imp €. Páguele a mano o revise Stripe Connect."); }
  guardarPedido($ref, $ped);
}
