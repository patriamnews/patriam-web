<?php
/* Cobro mensual de las cuotas con la tarjeta guardada en PayPal.
   Lo llama la publicación automática de GitHub varias veces al día (.github/workflows/hostinger.yml).
   Es seguro llamarlo cuantas veces se quiera: solo cobra las cuotas activas cuyo día de cobro ha llegado,
   y cada mes lleva un identificador propio, así que PayPal nunca cobra dos veces el mismo mes.
   Si la tarjeta falla, se reintenta al día siguiente; a los 3 fallos la cuota queda «impagada» y se avisa. */
require_once __DIR__ . '/_paypal.php';

header('Content-Type: application/json; charset=utf-8');
if (!ppActivo()) salir(['ok' => true, 'nada' => 'PayPal no está activado']);

$bloqueo = fopen(ppDir('cuotas') . '/.cobrando.lock', 'c');
if (!flock($bloqueo, LOCK_EX | LOCK_NB)) salir(['ok' => true, 'nada' => 'ya se está cobrando']);

$hoy = date('Y-m-d');
$hechas = [];
foreach (glob(ppDir('cuotas') . '/*.json') ?: [] as $f) {
  if (count($hechas) >= 40) break;   // como mucho 40 por vez; el resto, en la siguiente llamada
  $q = json_decode(file_get_contents($f), true) ?: [];
  if (($q['estado'] ?? '') !== 'activa' || empty($q['vaultId']) || ($q['proximo'] ?? '9999') > $hoy) continue;
  if (($q['intentado'] ?? '') === $hoy) continue;   // un intento al día
  $ref = $q['ref']; $mes = substr($q['proximo'], 0, 7);
  $cent = (int)round(((float)$q['importe']) * 100);
  $credencial = ['payment_initiator' => 'MERCHANT', 'payment_type' => 'RECURRING', 'usage' => 'SUBSEQUENT'];
  if (!empty($q['red']['id'])) $credencial['previous_network_transaction_reference'] = array_filter(['id' => $q['red']['id'], 'network' => $q['red']['network'] ?? null]);
  [$c, $d] = pp('POST', '/v2/checkout/orders', [
    'intent' => 'CAPTURE',
    'purchase_units' => [[
      'reference_id' => $ref, 'custom_id' => $ref . '-' . $mes, 'description' => 'Cuota de asociado · PATRIAM · ' . $mes, 'soft_descriptor' => 'PATRIAM',
      'amount' => ['currency_code' => 'EUR', 'value' => ppEuros($cent), 'breakdown' => ['item_total' => ['currency_code' => 'EUR', 'value' => ppEuros($cent)]]],
      'items' => [['name' => 'Cuota mensual de asociado · ' . $mes, 'quantity' => '1', 'unit_amount' => ['currency_code' => 'EUR', 'value' => ppEuros($cent)], 'category' => 'DIGITAL_GOODS']],
    ]],
    'payment_source' => ['card' => ['vault_id' => $q['vaultId'], 'stored_credential' => $credencial]],
  ], 'cuota-' . $ref . '-' . $mes . '-' . (int)($q['fallos'] ?? 0));
  // Con la tarjeta guardada PayPal suele cobrar al crear la orden; si no, se captura
  if (($d['status'] ?? '') === 'APPROVED' && !empty($d['id'])) [$c, $d] = pp('POST', '/v2/checkout/orders/' . $d['id'] . '/capture', '{}', 'cuota-cap-' . $d['id']);
  $cap = $d['purchase_units'][0]['payments']['captures'][0] ?? [];
  $q['intentado'] = $hoy;
  $importe = number_format($cent / 100, 2, ',', '.') . ' €';
  if (($d['status'] ?? '') === 'COMPLETED' && in_array($cap['status'] ?? '', ['COMPLETED', 'PENDING'], true)) {
    $q['cobros'][] = ['fecha' => $hoy, 'mes' => $mes, 'importe' => $cent / 100, 'captura' => $cap['id'] ?? ''];
    $q['cobros'] = array_slice($q['cobros'], -36);
    $q['ultimo'] = $hoy; $q['fallos'] = 0;
    $q['proximo'] = masUnMes($q['proximo'], (int)($q['dia'] ?? 1));
    $hechas[] = [$ref, 'cobrada'];
    avisar("Cuota cobrada: $ref ($mes)", "Cobrados $importe a {$q['email']} ({$q['tarjeta']}). Registre el pago en Publicar › Socios.");
    enviarCorreo($q['email'] ?? '', "Cuota de PATRIAM de $mes", "Hemos cobrado su cuota mensual de $importe con su tarjeta ({$q['tarjeta']}). Referencia: $ref.\n\nGracias por su apoyo. Puede pedir la baja cuando quiera desde su área de asociado en movimientopatriam.es.\n\nPATRIAM");
  } else {
    $q['fallos'] = (int)($q['fallos'] ?? 0) + 1;
    $q['ultimoError'] = mb_substr(json_encode($d['details'] ?? $d['message'] ?? $c, JSON_UNESCAPED_UNICODE), 0, 300);
    if ($q['fallos'] >= 3) {
      $q['estado'] = 'impagada';
      avisar("Cuota impagada: $ref", "No se ha podido cobrar la cuota de $mes a {$q['email']} tras 3 intentos (" . ppError($d, 'error de PayPal') . "). Ya no se intentará más: póngase en contacto con el socio.");
      enviarCorreo($q['email'] ?? '', 'No hemos podido cobrar su cuota de PATRIAM', "No hemos podido cobrar su cuota mensual de $importe con su tarjeta ({$q['tarjeta']}). Escríbanos a hola@movimientopatriam.com para actualizar su forma de pago.\n\nPATRIAM");
    } elseif ($q['fallos'] === 1) {
      avisar("Cuota no cobrada: $ref", "Ha fallado el cobro de $importe a {$q['email']} (" . ppError($d, 'error de PayPal') . "). Se reintentará mañana.");
    }
    $hechas[] = [$ref, 'fallo ' . $q['fallos']];
  }
  file_put_contents($f, json_encode($q, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT), LOCK_EX);
}
salir(['ok' => true, 'cuotas' => $hechas]);
