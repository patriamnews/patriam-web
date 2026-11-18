<?php
/* Cobro con PayPal: tarjeta (sin cuenta de PayPal), Google Pay y Apple Pay.
   - accion «config»: dice a la web si PayPal está activado y con qué Client ID (es público).
   - accion «crear»: prepara la orden en PayPal con el importe calculado en el servidor (_cobro.php).
   - accion «capturar»: cobra la orden ya confirmada por quien paga y hace lo que toque:
       cuota → guarda la tarjeta en PayPal (la web solo guarda su identificador) para cobrar cada mes (paypal-cuotas.php);
       pedido → lo manda a Gelato con la dirección de envío; donativo → aviso a la asociación.
   - acciones «cuotas» y «cancelar»: solo el equipo, desde Publicar › Claves › PayPal.
   La web nunca ve ni guarda los datos de la tarjeta: los escribe quien paga en campos de PayPal. */
require_once __DIR__ . '/_cobro.php';
require_once __DIR__ . '/_paypal.php';
require_once __DIR__ . '/_gelato.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') exit;
if ($_SERVER['REQUEST_METHOD'] !== 'POST') salir(['error' => 'Método no permitido'], 405);
$p = json_decode(file_get_contents('php://input'), true) ?: [];
$accion = $p['accion'] ?? '';

if ($accion === 'config') {
  $c = ppConf();
  salir(['activo' => ppActivo(), 'clientId' => ppActivo() ? $c['id'] : '', 'modo' => $c['modo']]);
}

if ($accion === 'cuotas' || $accion === 'cancelar') {
  exigirEquipo($p);
  if ($accion === 'cancelar') {
    $ref = preg_replace('/[^A-Za-z0-9-]/', '', (string)($p['ref'] ?? ''));
    $q = ppLeer('cuotas', $ref);
    if (!$q) salir(['error' => 'No se encuentra esa cuota.'], 404);
    if (($q['estado'] ?? '') !== 'cancelada') {
      if (!empty($q['vaultId'])) pp('DELETE', '/v3/vault/payment-tokens/' . rawurlencode($q['vaultId']));
      $q['estado'] = 'cancelada'; $q['baja'] = date('Y-m-d');
      ppGuardar('cuotas', $ref, $q);
      enviarCorreo($q['email'] ?? '', 'Baja de la cuota de PATRIAM', "Hemos dado de baja su cuota mensual (referencia $ref). No se le cobrará nada más.\n\nGracias por su apoyo.\nPATRIAM");
    }
  }
  $lista = [];
  foreach (glob(ppDir('cuotas') . '/*.json') ?: [] as $f) {
    $q = json_decode(file_get_contents($f), true) ?: [];
    $lista[] = array_intersect_key($q, array_flip(['ref', 'email', 'importe', 'tarjeta', 'alta', 'proximo', 'estado', 'fallos', 'baja', 'ultimo']));
  }
  usort($lista, fn($a, $b) => strcmp($b['alta'] ?? '', $a['alta'] ?? ''));
  salir(['cuotas' => $lista]);
}

if (!ppActivo()) salir(['error' => 'El pago con tarjeta aún no está activado. Inténtelo más tarde o escríbanos.'], 503);

if ($accion === 'crear') {
  $co = prepararCobro($p);
  $metodo = in_array($p['metodo'] ?? '', ['tarjeta', 'googlepay', 'applepay'], true) ? $p['metodo'] : 'tarjeta';
  if ($co['tipo'] === 'cuota' && $metodo !== 'tarjeta') salir(['error' => 'La cuota mensual se paga con tarjeta.'], 400);

  // Dirección de envío (pedidos de Gelato): solo España, como antes
  $destino = null;
  if ($co['gelato']) {
    $d = is_array($p['destino'] ?? null) ? $p['destino'] : [];
    $t = fn($k, $max) => mb_substr(trim((string)($d[$k] ?? '')), 0, $max);
    $destino = ['nombre' => $t('nombre', 150), 'calle' => $t('calle', 200), 'cp' => $t('cp', 10), 'localidad' => $t('localidad', 100), 'provincia' => $t('provincia', 100), 'telefono' => $t('telefono', 30)];
    if (!$destino['nombre'] || !$destino['calle'] || !preg_match('/^[0-9]{5}$/', $destino['cp']) || !$destino['localidad'] || !$destino['provincia'])
      salir(['error' => 'Revise la dirección de envío: nombre, calle y número, código postal (5 cifras), localidad y provincia.'], 400);
  }

  $items = array_map(fn($l) => ['name' => mb_substr($l[0], 0, 127), 'quantity' => (string)$l[1], 'unit_amount' => ['currency_code' => 'EUR', 'value' => ppEuros($l[2])], 'category' => $l[3]], $co['lineas']);
  $sumaItems = array_sum(array_map(fn($l) => $l[1] * $l[2], $co['lineas']));
  $desglose = ['item_total' => ['currency_code' => 'EUR', 'value' => ppEuros($sumaItems)]];
  if ($co['envio'] > 0) $desglose['shipping'] = ['currency_code' => 'EUR', 'value' => ppEuros($co['envio'])];
  $unidad = [
    'reference_id' => $co['ref'], 'custom_id' => $co['ref'],
    'description' => ['cuota' => 'Cuota de asociado · PATRIAM', 'donativo' => 'Donativo a PATRIAM', 'pedido' => 'Pedido de la tienda PATRIAM'][$co['tipo']],
    'soft_descriptor' => 'PATRIAM',
    'amount' => ['currency_code' => 'EUR', 'value' => ppEuros($co['total']), 'breakdown' => $desglose],
    'items' => $items,
  ];
  if ($destino) $unidad['shipping'] = ['type' => 'SHIPPING', 'name' => ['full_name' => $destino['nombre']], 'address' => [
    'address_line_1' => $destino['calle'], 'admin_area_2' => $destino['localidad'], 'admin_area_1' => $destino['provincia'],
    'postal_code' => $destino['cp'], 'country_code' => 'ES']];
  $orden = ['intent' => 'CAPTURE', 'purchase_units' => [$unidad]];
  if ($metodo === 'tarjeta') {
    $attr = ['verification' => ['method' => 'SCA_WHEN_REQUIRED']];   // 3D Secure cuando lo pida el banco (PSD2)
    if ($co['tipo'] === 'cuota') $attr['vault'] = ['store_in_vault' => 'ON_SUCCESS'];   // guardar la tarjeta para las cuotas
    $orden['payment_source'] = ['card' => ['attributes' => $attr]];
  }
  [$c, $d] = pp('POST', '/v2/checkout/orders', $orden);
  if ($c < 200 || $c >= 300 || empty($d['id'])) salir(['error' => 'PayPal no ha podido preparar el pago. ' . ($d['details'][0]['description'] ?? $d['message'] ?? '')], 502);
  ppGuardar('paypal', $d['id'], ['estado' => 'creado', 'metodo' => $metodo, 'cobro' => $co, 'destino' => $destino, 'creado' => date('c')]);
  if ($co['gelato'] && !leerPedido($co['ref']))
    guardarPedido($co['ref'], ['referencia' => $co['ref'], 'email' => $co['email'], 'gelato' => $co['gelato'], 'estado' => 'pendiente de pago', 'creado' => date('c')]);
  salir(['id' => $d['id']]);
}

if ($accion === 'capturar') {
  $id = preg_replace('/[^A-Za-z0-9-]/', '', (string)($p['id'] ?? ''));
  $o = ppLeer('paypal', $id);
  if (!$o) salir(['error' => 'No se encuentra el pago. Vuelva a intentarlo.'], 404);
  // Un solo proceso por orden (por si se pulsa dos veces)
  $bloqueo = fopen(ppDir('paypal') . "/$id.lock", 'c');
  flock($bloqueo, LOCK_EX);
  $o = ppLeer('paypal', $id);
  $co = $o['cobro'];
  if (($o['estado'] ?? '') === 'cobrado') salir(['ok' => true, 'ref' => $co['ref'], 'tipo' => $co['tipo']]);

  [$c, $d] = pp('POST', "/v2/checkout/orders/$id/capture", '{}', 'capturar-' . $id);
  if (($d['details'][0]['issue'] ?? '') === 'ORDER_ALREADY_CAPTURED') [$c, $d] = pp('GET', "/v2/checkout/orders/$id");
  $cap = $d['purchase_units'][0]['payments']['captures'][0] ?? [];
  if (($d['status'] ?? '') !== 'COMPLETED' || !in_array($cap['status'] ?? '', ['COMPLETED', 'PENDING'], true)) {
    $o['estado'] = 'rechazado'; $o['error'] = mb_substr(json_encode($d['details'] ?? $d['message'] ?? $c, JSON_UNESCAPED_UNICODE), 0, 500);
    ppGuardar('paypal', $id, $o);
    salir(['error' => ppError($d)], 402);
  }
  $pagado = (float)($cap['amount']['value'] ?? 0);
  $o['estado'] = 'cobrado'; $o['captura'] = $cap['id'] ?? ''; $o['pagado'] = $pagado; $o['cobradoEl'] = date('c');
  ppGuardar('paypal', $id, $o);
  $ref = $co['ref'];
  $importe = number_format($pagado, 2, ',', '.') . ' €';
  if (abs($pagado * 100 - $co['total']) > 1 || ($cap['amount']['currency_code'] ?? '') !== 'EUR') {
    avisar("Pago $ref: el importe no cuadra", "PayPal ha cobrado $importe y se esperaban " . ppEuros($co['total']) . " €. Revíselo en PayPal antes de hacer nada (orden $id).");
    salir(['ok' => true, 'ref' => $ref, 'tipo' => $co['tipo']]);
  }
  $pendiente = ($cap['status'] ?? '') === 'PENDING' ? "\n\nAtención: PayPal ha dejado el cobro pendiente de revisión. Compruébelo en PayPal." : '';

  if ($co['tipo'] === 'cuota') {
    $tarjeta = $d['payment_source']['card'] ?? [];
    $vault = $tarjeta['attributes']['vault'] ?? [];
    $hoy = date('Y-m-d'); $dia = (int)date('j');
    $q = ['ref' => $ref, 'email' => $co['email'], 'importe' => $pagado, 'reducida' => $co['reducida'],
      'vaultId' => $vault['id'] ?? '', 'clienteId' => $vault['customer']['id'] ?? '',
      'tarjeta' => trim(($tarjeta['brand'] ?? 'Tarjeta') . ' ···· ' . ($tarjeta['last_digits'] ?? '')),
      'red' => $cap['network_transaction_reference'] ?? null,
      'alta' => $hoy, 'dia' => $dia, 'ultimo' => $hoy, 'proximo' => masUnMes($hoy, $dia), 'estado' => 'activa', 'fallos' => 0,
      'cobros' => [['fecha' => $hoy, 'importe' => $pagado, 'captura' => $cap['id'] ?? '']]];
    ppGuardar('cuotas', $ref, $q);
    $guardada = $q['vaultId'] !== '';
    avisar("Nueva cuota con tarjeta: $ref", "Cobrada la primera cuota de $importe a {$co['email']} ({$q['tarjeta']}). " .
      ($guardada ? "Se cobrará sola cada mes, el día $dia. Puede verla o darla de baja en Publicar › Claves › PayPal." : "ATENCIÓN: PayPal no ha guardado la tarjeta, así que las próximas cuotas no se cobrarán solas.") .
      "\nRegistre el pago en Publicar › Socios.$pendiente");
    enviarCorreo($co['email'], 'Cuota de PATRIAM cobrada', "Gracias por unirse a PATRIAM.\n\nHemos cobrado su cuota mensual de $importe con su tarjeta ({$q['tarjeta']}). Referencia: $ref.\n" .
      ($guardada ? "Se le cobrará automáticamente cada mes, el día $dia. Puede pedir la baja cuando quiera desde su área de asociado en movimientopatriam.es o escribiéndonos.\n" : '') . "\nPATRIAM");
  } elseif ($co['tipo'] === 'pedido') {
    if ($co['gelato']) {
      $ped = leerPedido($ref) ?: ['referencia' => $ref, 'email' => $co['email'], 'gelato' => $co['gelato'], 'creado' => date('c')];
      $ped['pagado'] = $pagado; $ped['paypal'] = $id; $ped['estado'] = 'pagado';
      $de = $o['destino'] ?? [];
      $partes = preg_split('/\s+/', trim($de['nombre'] ?? ''), 2);
      $destino = ['firstName' => $partes[0] ?? '', 'lastName' => $partes[1] ?? ($partes[0] ?? ''),
        'addressLine1' => $de['calle'] ?? '', 'addressLine2' => '', 'city' => $de['localidad'] ?? '', 'postCode' => $de['cp'] ?? '',
        'state' => $de['provincia'] ?? '', 'country' => 'ES', 'email' => $co['email'], 'phone' => $de['telefono'] ?? ''];
      if (empty($ped['gelatoId'])) { if ($pendiente) { $ped['estado'] = 'revisar: cobro pendiente en PayPal'; $ped['envio'] = $destino; guardarPedido($ref, $ped); avisar("Pedido $ref: cobro pendiente en PayPal", "No se ha mandado a Gelato. Compruebe el cobro en PayPal y mándelo a mano.$pendiente"); } else mandarAGelato($ref, $ped, $destino); }
    } else {
      avisar("Pedido $ref pagado", "Cobrado con PayPal: $importe ({$co['email']}).$pendiente");
    }
    enviarCorreo($co['email'], "Pedido $ref pagado · PATRIAM", "Gracias por su compra.\n\nHemos recibido el pago de $importe del pedido $ref." .
      ($co['gelato'] ? "\nLo fabrica y lo envía Gelato, nuestro taller de impresión, a la dirección que nos ha indicado (3 a 5 días laborables)." : '') . "\n\nPATRIAM");
  } else {
    avisar("Donativo recibido: $importe", "Donativo $ref de " . ($co['email'] ?: 'persona sin email') . " cobrado con PayPal.$pendiente");
    enviarCorreo($co['email'], 'Gracias por su donativo a PATRIAM', "Hemos recibido su donativo de $importe (referencia $ref). Muchas gracias por su apoyo.\n\nPATRIAM");
  }
  salir(['ok' => true, 'ref' => $ref, 'tipo' => $co['tipo']]);
}

salir(['error' => 'Acción no válida.'], 400);
