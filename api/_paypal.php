<?php
/* Piezas comunes del cobro con PayPal (tarjeta, Google Pay y Apple Pay; también cuotas mensuales con la tarjeta guardada).
   Las claves (Client ID, Secret, modo sandbox/live y Webhook ID) se ponen en Publicar › Claves › PayPal
   y se guardan solo en la carpeta privada del servidor. */
if (basename($_SERVER['SCRIPT_FILENAME'] ?? '') === basename(__FILE__)) { http_response_code(404); exit; }
require_once __DIR__ . '/_comun.php';

function ppConf() {
  $k = claves();
  $live = ($k['paypalModo'] ?? '') === 'live';
  return [
    'id' => $k['paypalClientId'] ?? '', 'secret' => $k['paypalSecret'] ?? '', 'webhook' => $k['paypalWebhookId'] ?? '',
    'modo' => $live ? 'live' : 'sandbox',
    'base' => $live ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com',
  ];
}
function ppActivo() { $c = ppConf(); return $c['id'] !== '' && $c['secret'] !== ''; }

// Carpetas privadas: órdenes en curso y cuotas mensuales con tarjeta guardada
function ppDir($sub) { $d = privado() . '/' . $sub; if (!is_dir($d)) @mkdir($d, 0750, true); return $d; }
function ppLeer($sub, $id) { $id = preg_replace('/[^A-Za-z0-9-]/', '', (string)$id); $f = ppDir($sub) . "/$id.json"; return ($id && is_file($f)) ? (json_decode(file_get_contents($f), true) ?: null) : null; }
function ppGuardar($sub, $id, $d) { $id = preg_replace('/[^A-Za-z0-9-]/', '', (string)$id); file_put_contents(ppDir($sub) . "/$id.json", json_encode($d, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT), LOCK_EX); }

// Ficha de acceso a la API de PayPal (dura unas horas; se guarda para no pedirla en cada pago)
function ppToken() {
  $c = ppConf();
  $f = privado() . '/paypal-token.json';
  $t = is_file($f) ? (json_decode(file_get_contents($f), true) ?: []) : [];
  if (($t['clave'] ?? '') === hash('sha256', $c['id'] . $c['modo']) && ($t['hasta'] ?? 0) > time() + 60) return $t['token'];
  $ch = curl_init($c['base'] . '/v1/oauth2/token');
  curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 30, CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => 'grant_type=client_credentials', CURLOPT_USERPWD => $c['id'] . ':' . $c['secret'],
    CURLOPT_HTTPHEADER => ['Accept: application/json', 'Content-Type: application/x-www-form-urlencoded']]);
  $r = json_decode((string)curl_exec($ch), true) ?: []; $code = curl_getinfo($ch, CURLINFO_RESPONSE_CODE); curl_close($ch);
  if ($code !== 200 || empty($r['access_token'])) return null;
  file_put_contents($f, json_encode(['clave' => hash('sha256', $c['id'] . $c['modo']), 'token' => $r['access_token'], 'hasta' => time() + (int)($r['expires_in'] ?? 3000)]), LOCK_EX);
  @chmod($f, 0600);
  return $r['access_token'];
}

// Llamada a la API de PayPal. $idem: identificador para que PayPal no repita una operación si se manda dos veces.
function pp($metodo, $ruta, $cuerpo = null, $idem = null) {
  $tok = ppToken();
  if (!$tok) return [401, ['message' => 'PayPal no acepta las claves. Revise el Client ID, el Secret y el modo en Publicar › Claves › PayPal.'], ''];
  $cab = ['Authorization: Bearer ' . $tok, 'Content-Type: application/json', 'Accept: application/json', 'Prefer: return=representation'];
  if ($idem) $cab[] = 'PayPal-Request-Id: ' . $idem;
  $ch = curl_init(ppConf()['base'] . $ruta);
  curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 45, CURLOPT_CUSTOMREQUEST => $metodo, CURLOPT_HTTPHEADER => $cab]);
  if ($cuerpo !== null) curl_setopt($ch, CURLOPT_POSTFIELDS, is_string($cuerpo) ? $cuerpo : json_encode($cuerpo, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
  $r = (string)curl_exec($ch); $code = curl_getinfo($ch, CURLINFO_RESPONSE_CODE); curl_close($ch);
  return [$code, json_decode($r, true) ?: [], $r];
}

function ppEuros($cent) { return number_format($cent / 100, 2, '.', ''); }

// Mensaje de error de PayPal comprensible para quien paga
function ppError($d, $porDefecto = 'No se ha podido completar el pago.') {
  $issue = $d['details'][0]['issue'] ?? ($d['name'] ?? '');
  $txt = [
    'INSTRUMENT_DECLINED' => 'El banco ha rechazado la tarjeta. Pruebe con otra tarjeta o consulte con su banco.',
    'CARD_EXPIRED' => 'La tarjeta está caducada.',
    'TRANSACTION_REFUSED' => 'El pago ha sido rechazado. Pruebe con otra tarjeta.',
    'PAYER_ACTION_REQUIRED' => 'Falta confirmar el pago con su banco. Vuelva a intentarlo.',
    'ORDER_NOT_APPROVED' => 'No se ha completado la confirmación del pago. Vuelva a intentarlo.',
    'DUPLICATE_INVOICE_ID' => 'Este pago ya se ha hecho antes.',
  ];
  return $txt[$issue] ?? $porDefecto;
}

// Suma un mes respetando fin de mes (31 ene → 28/29 feb)
function masUnMes($fecha, $dia) {
  $d = new DateTime($fecha);
  $d->modify('first day of next month');
  $ultimo = (int)$d->format('t');
  $d->setDate((int)$d->format('Y'), (int)$d->format('m'), min($dia, $ultimo));
  return $d->format('Y-m-d');
}
