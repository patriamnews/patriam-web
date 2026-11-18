<?php
/* Cálculo de lo que hay que cobrar (cuotas, donativos y pedidos de la tienda), común a PayPal y a Stripe.
   Los importes se fijan SIEMPRE aquí, en el servidor, con los datos de la base de datos: nunca se fía de lo
   que manda el navegador, para que nadie pueda cambiar el precio ni mandar imprimir otra cosa a Gelato. */
if (basename($_SERVER['SCRIPT_FILENAME'] ?? '') === basename(__FILE__)) { http_response_code(404); exit; }
require_once __DIR__ . '/_comun.php';

function centimos($n) { return (int)round(((float)$n) * 100); }

/* Devuelve:
   tipo, ref, email, reducida (cuotas),
   lineas: [[nombre, cantidad, céntimos por unidad, categoría]] (sin el envío),
   envio (céntimos), total (céntimos), gelato (artículos para Gelato) */
function prepararCobro($p) {
  $tipo = $p['tipo'] ?? '';
  $ref = preg_replace('/[^A-Za-z0-9-]/', '', (string)($p['referencia'] ?? ''));
  $email = filter_var($p['email'] ?? '', FILTER_VALIDATE_EMAIL) ?: '';
  if (!$ref) salir(['error' => 'Falta la referencia.'], 400);
  $c = ['tipo' => $tipo, 'ref' => $ref, 'email' => $email, 'reducida' => false, 'lineas' => [], 'envio' => 0, 'gelato' => []];

  if ($tipo === 'cuota') {
    // 10 € al mes, 5 € la reducida (o lo que esté puesto en Ajustes)
    $aj = supabaseLeer('ajustes?select=cuota,cuota_reducida&id=eq.1')[0] ?? [];
    $normal = (float)($aj['cuota'] ?? 0) > 0 ? (float)$aj['cuota'] : 10;
    $red = (float)($aj['cuota_reducida'] ?? 0) > 0 ? (float)$aj['cuota_reducida'] : 5;
    $c['reducida'] = !empty($p['reducida']);
    $c['lineas'][] = [$c['reducida'] ? 'Cuota mensual reducida de asociado · PATRIAM' : 'Cuota mensual de asociado · PATRIAM', 1, centimos($c['reducida'] ? $red : $normal), 'DIGITAL_GOODS'];
  } elseif ($tipo === 'donativo') {
    $cent = centimos($p['importe'] ?? 0);
    if ($cent < 100 || $cent > 1000000) salir(['error' => 'Importe no válido.'], 400);
    $c['lineas'][] = ['Donativo a PATRIAM', 1, $cent, 'DONATION'];
  } elseif ($tipo === 'pedido') {
    $items = array_slice(is_array($p['items'] ?? null) ? $p['items'] : [], 0, 50);
    if (!$items) salir(['error' => 'El carrito está vacío.'], 400);
    $ids = array_values(array_unique(array_filter(array_map(fn($it) => (int)($it['id'] ?? 0), $items))));
    if (!$ids) salir(['error' => 'Vuelva a añadir los productos al carrito, por favor.'], 400);
    $filas = supabaseLeer('productos?select=id,nombre,precio,opciones,gelato_uids,gelato_archivo,suplementos,enlace_externo,envio_primera,envio_extra,reparto_disenador&activo=eq.true&id=in.(' . implode(',', $ids) . ')');
    if ($filas === null) salir(['error' => 'No se ha podido comprobar el pedido. Inténtelo de nuevo en un momento.'], 502);
    $prod = [];
    foreach ($filas as $r) $prod[(int)$r['id']] = $r;
    $subtotal = 0;
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
      $cent = centimos((float)$r['precio'] + $sup);
      $cant = max(1, min(50, (int)($it['cantidad'] ?? 1)));
      if ($cent <= 0) continue;
      $subtotal += $cent * $cant;
      $nombre = mb_substr($r['nombre'] . ($opcion !== '' ? ' (' . $opcion . ')' : ''), 0, 120);
      $c['lineas'][] = [$nombre, $cant, $cent, 'PHYSICAL_GOODS'];
      // Artículo de Gelato de esa talla/color: «Opción=código», «código@delante|detrás» o «código#variante»
      $lineas = array_values(array_filter(array_map('trim', explode("\n", (string)($r['gelato_uids'] ?? '')))));
      $uid = '';
      foreach ($lineas as $l) { $q = explode('=', $l, 2); if (count($q) === 2 && $opcion !== '' && mb_strtolower(trim($q[0])) === mb_strtolower($opcion)) { $uid = trim($q[1]); break; } }
      if (!$uid && count($lineas) === 1 && strpos($lineas[0], '=') === false) $uid = $lineas[0];
      if ($uid) {
        [$conVar, $archivo] = array_pad(explode('@', $uid, 2), 2, '');
        [$codigo, $variante] = array_pad(explode('#', $conVar, 2), 2, '');
        $archivo = trim($archivo) ?: (string)($r['gelato_archivo'] ?? '');
        $c['gelato'][] = ['ref' => $ref . '-' . ($n + 1), 'uid' => trim($codigo), 'archivo' => $archivo, 'variante' => trim($variante), 'cantidad' => $cant, 'e1' => $r['envio_primera'], 'e2' => $r['envio_extra'], 'id' => (int)$r['id'], 'precio' => $cent / 100, 'reparto' => (float)($r['reparto_disenador'] ?? 0), 'nombre' => $nombre];
      }
    }
    if (!$c['lineas']) salir(['error' => 'No hay nada que pagar.'], 400);
    // Envío de Gelato: la tarifa de primera prenda más alta del pedido + la de prenda adicional de cada una de las demás
    // (las de cada producto o, si no tiene, las de Ajustes); gratis a partir del importe puesto en Ajustes
    $aj = supabaseLeer('ajustes?select=envio_coste,envio_adicional,envio_gratis_desde&id=eq.1')[0] ?? [];
    $uds = [];
    foreach ($c['gelato'] as $g) for ($k = 0; $k < $g['cantidad']; $k++) $uds[] = [(float)($g['e1'] ?? $aj['envio_coste'] ?? 0), (float)($g['e2'] ?? $aj['envio_adicional'] ?? 0)];
    usort($uds, fn($a, $b) => $b[0] <=> $a[0]);
    $envio = $uds ? centimos($uds[0][0] + array_sum(array_map(fn($u) => $u[1], array_slice($uds, 1)))) : 0;
    $gratis = centimos($aj['envio_gratis_desde'] ?? 0);
    if ($gratis > 0 && $subtotal >= $gratis) $envio = 0;
    $c['envio'] = $envio;
  } else {
    salir(['error' => 'Tipo de pago no válido.'], 400);
  }
  $c['total'] = array_sum(array_map(fn($l) => $l[1] * $l[2], $c['lineas'])) + $c['envio'];
  return $c;
}
