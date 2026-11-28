<?php
/* Avisos de PayPal (webhook): https://movimientopatriam.es/api/paypal-webhook.php
   Los cobros se registran al momento en paypal.php; aquí solo se atienden los avisos posteriores:
   devoluciones, cobros rechazados o revertidos, reclamaciones y tarjetas guardadas que se eliminan.
   Seguridad: si está puesto el Webhook ID (Publicar › Claves › PayPal), solo se aceptan avisos que PayPal confirma como suyos.
   Siempre se responde «OK» para que PayPal no repita el aviso. */
require_once __DIR__ . '/_paypal.php';

function responderOk() { http_response_code(200); header('Content-Type: text/plain; charset=utf-8'); echo 'OK'; exit; }

$cuerpo = file_get_contents('php://input');
$ev = json_decode($cuerpo, true);
if (!$ev || empty($ev['event_type']) || !ppActivo()) responderOk();

// Comprobar con PayPal que el aviso es auténtico
$conf = ppConf();
if ($conf['webhook'] === '') responderOk();
$h = fn($n) => $_SERVER['HTTP_' . strtoupper(str_replace('-', '_', $n))] ?? '';
[$c, $v] = pp('POST', '/v1/notifications/verify-webhook-signature', '{"auth_algo":' . json_encode($h('PAYPAL-AUTH-ALGO')) .
  ',"cert_url":' . json_encode($h('PAYPAL-CERT-URL')) . ',"transmission_id":' . json_encode($h('PAYPAL-TRANSMISSION-ID')) .
  ',"transmission_sig":' . json_encode($h('PAYPAL-TRANSMISSION-SIG')) . ',"transmission_time":' . json_encode($h('PAYPAL-TRANSMISSION-TIME')) .
  ',"webhook_id":' . json_encode($conf['webhook']) . ',"webhook_event":' . $cuerpo . '}');
if (($v['verification_status'] ?? '') !== 'SUCCESS') responderOk();

$tipo = $ev['event_type'];
$r = $ev['resource'] ?? [];
$ref = $r['custom_id'] ?? ($r['invoice_id'] ?? '');
$importe = isset($r['amount']['value']) ? number_format((float)$r['amount']['value'], 2, ',', '.') . ' €' : '';

switch ($tipo) {
  case 'PAYMENT.CAPTURE.REFUNDED':
    avisar("Devolución hecha en PayPal $ref", "Se ha devuelto $importe (pago $ref). Si era un pedido de la tienda, recuerde cancelarlo en Gelato si aún no se ha enviado; si era una cuota, anótelo en Publicar › Socios.");
    break;
  case 'PAYMENT.CAPTURE.REVERSED':
    avisar("Cobro revertido en PayPal $ref", "PayPal ha retirado $importe del pago $ref (normalmente porque el titular de la tarjeta lo ha reclamado a su banco). Revíselo en PayPal.");
    break;
  case 'PAYMENT.CAPTURE.DENIED':
    avisar("Cobro rechazado en PayPal $ref", "PayPal ha rechazado finalmente el cobro de $importe ($ref). Si era un pedido, no lo mande a Gelato; si ya se ha mandado, cancélelo allí.");
    break;
  case 'CUSTOMER.DISPUTE.CREATED':
    avisar('Reclamación abierta en PayPal', 'Un cliente ha abierto una reclamación' . ($importe ? " por $importe" : '') . '. Respóndala en PayPal › Centro de resoluciones en el plazo que indique PayPal.');
    break;
  case 'VAULT.PAYMENT-TOKEN.DELETED':
    // La tarjeta guardada de una cuota ya no existe: se da de baja la cuota para no intentar cobrarla
    $token = $r['id'] ?? '';
    if ($token) foreach (glob(ppDir('cuotas') . '/*.json') ?: [] as $f) {
      $q = json_decode(file_get_contents($f), true) ?: [];
      if (($q['vaultId'] ?? '') === $token && ($q['estado'] ?? '') === 'activa') {
        $q['estado'] = 'cancelada'; $q['baja'] = date('Y-m-d'); $q['motivo'] = 'tarjeta eliminada en PayPal';
        file_put_contents($f, json_encode($q, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT), LOCK_EX);
        avisar("Cuota sin tarjeta: {$q['ref']}", "Se ha eliminado en PayPal la tarjeta guardada de {$q['email']}, así que su cuota ya no se cobrará sola.");
      }
    }
    break;
}
responderOk();
