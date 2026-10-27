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
  // Pedido de la tienda. El precio, el artículo de Gelato y el archivo de impresión se sacan de la base de datos
  // (nunca de lo que manda el navegador), para que nadie pueda cambiar el importe ni mandar imprimir otra cosa.
  $items = array_slice(is_array($p['items'] ?? null) ? $p['items'] : [], 0, 50);
  if (!$items) salir(['error' => 'El carrito está vacío.'], 400);
  $ids = array_values(array_unique(array_filter(array_map(fn($it) => (int)($it['id'] ?? 0), $items))));
  if (!$ids) salir(['error' => 'Vuelva a añadir los productos al carrito, por favor.'], 400);
  $filas = supabaseLeer('productos?select=id,nombre,precio,opciones,gelato_uids,gelato_archivo,suplementos,enlace_externo&activo=eq.true&id=in.(' . implode(',', $ids) . ')');
  if ($filas === null) salir(['error' => 'No se ha podido comprobar el pedido. Inténtelo de nuevo en un momento.'], 502);
  $prod = [];
  foreach ($filas as $r) $prod[(int)$r['id']] = $r;
  $i = 0; $subtotal = 0; $gelato = [];
  foreach ($items as $n => $it) {
    $r = $prod[(int)($it['id'] ?? 0)] ?? null;
    if (!$r || !empty($r['enlace_externo'])) salir(['error' => 'Algún producto del carrito ya no está a la venta. Vacíe el carrito y vuelva a añadirlo.'], 400);
    $opcion = trim((string)($it['opcion'] ?? ''));
    $ops = array_values(array_filter(array_map('trim', explode(',', (string)($r['opciones'] ?? '')))));
    if ($ops && !in_array($opcion, $ops, true)) salir(['error' => 'La talla o el color de «' . $r['nombre'] . '» no es válido. Vuelva a añadirlo al carrito.'], 400);
    if (!$ops) $opcion = '';
    $partes = explode(' / ', $opcion);
    $talla = $opcion !== '' ? trim((string)end($partes)) : '';
    $corte = (count($partes) > 1 && strpos($partes[0], ' · ') !== false) ? trim(explode(' · ', $partes[0])[0]) : '';
    $sup = is_array($r['suplementos'] ?? null) ? (float)($r['suplementos'][$talla] ?? 0) + ($corte !== '' ? (float)($r['suplementos'][$corte] ?? 0) : 0) : 0;
    $c = $euros((float)$r['precio'] + $sup);
    $cant = max(1, min(50, (int)($it['cantidad'] ?? 1)));
    if ($c <= 0) continue;
    $subtotal += $c * $cant;
    $f["line_items[$i][quantity]"] = $cant;
    $f["line_items[$i][price_data][currency]"] = 'eur';
    $f["line_items[$i][price_data][unit_amount]"] = $c;
    $f["line_items[$i][price_data][product_data][name]"] = mb_substr($r['nombre'] . ($opcion !== '' ? ' (' . $opcion . ')' : ''), 0, 120);
    $i++;
    // Artículo de Gelato de esa talla/color: «Opción=código», «código@delante|detrás» o «código#variante»
    $lineas = array_values(array_filter(array_map('trim', explode("\n", (string)($r['gelato_uids'] ?? '')))));
    $uid = '';
    foreach ($lineas as $l) { $q = explode('=', $l, 2); if (count($q) === 2 && $opcion !== '' && mb_strtolower(trim($q[0])) === mb_strtolower($opcion)) { $uid = trim($q[1]); break; } }
    if (!$uid && count($lineas) === 1 && strpos($lineas[0], '=') === false) $uid = $lineas[0];
    if ($uid) {
      [$conVar, $archivo] = array_pad(explode('@', $uid, 2), 2, '');
      [$codigo, $variante] = array_pad(explode('#', $conVar, 2), 2, '');
      $archivo = trim($archivo) ?: (string)($r['gelato_archivo'] ?? '');
      $gelato[] = ['ref' => $ref . '-' . ($n + 1), 'uid' => trim($codigo), 'archivo' => $archivo, 'variante' => trim($variante), 'cantidad' => $cant, 'nombre' => $r['nombre'] . ($opcion !== '' ? ' (' . $opcion . ')' : '')];
    }
  }
  if (!$i) salir(['error' => 'No hay nada que pagar.'], 400);
  // Envío: lo que esté puesto en Ajustes (una vez por pedido; gratis a partir de cierto importe)
  $aj = supabaseLeer('ajustes?select=envio_coste,envio_adicional,envio_gratis_desde&id=eq.1')[0] ?? [];
  $prendas = array_sum(array_map(fn($g) => $g['cantidad'], $gelato));
  $envio = $gelato ? $euros((float)($aj['envio_coste'] ?? 0) + (float)($aj['envio_adicional'] ?? 0) * max(0, $prendas - 1)) : 0;
  $gratis = $euros($aj['envio_gratis_desde'] ?? 0);
  if ($gratis > 0 && $subtotal >= $gratis) $envio = 0;
  if ($envio > 0) {
    $f["line_items[$i][quantity]"] = 1;
    $f["line_items[$i][price_data][currency]"] = 'eur';
    $f["line_items[$i][price_data][unit_amount]"] = $envio;
    $f["line_items[$i][price_data][product_data][name]"] = 'Gastos de envío';
    $i++;
  }
  $f['mode'] = 'payment';
  $f['payment_intent_data[metadata][referencia]'] = $ref;
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
