<?php
/* Productos de Gelato creados desde «Publicar»: se elige una plantilla de Gelato (camiseta, sudadera, taza…),
   se sube el diseño y Gelato crea el producto en la tienda de PATRIAM con sus fotos de muestra.
   Devuelve los códigos de cada talla para que el producto se venda en la web (cobro con Stripe). */
require_once __DIR__ . '/_comun.php';
if ($_SERVER['REQUEST_METHOD'] !== 'POST') salir(['error' => 'Método no permitido'], 405);
$p = json_decode(file_get_contents('php://input'), true) ?: [];
exigirEquipo($p);

$K = claves();
if (empty($K['gelato'])) salir(['error' => 'Falta la clave de la API de Gelato. Póngala en Publicar › Cuentas y claves › Gelato.'], 400);
$cab = ['X-API-KEY: ' . $K['gelato'], 'Content-Type: application/json', 'Accept: application/json'];
$API = 'https://ecommerce.gelatoapis.com/v1';
$fP = privado() . '/gelato-plantillas.json';
$plantillas = is_file($fP) ? (json_decode(file_get_contents($fP), true) ?: []) : [];
$id = fn($v) => preg_match('/^[A-Za-z0-9\-]{6,80}$/', (string)$v) ? (string)$v : salir(['error' => 'Identificador no válido.'], 400);
$fallo = function ($c, $raw) {
  $m = json_decode($raw, true)['message'] ?? mb_substr($raw, 0, 200);
  if ($c === 401 || $c === 403) $m = 'Gelato no acepta la clave de la API. Revísela en Cuentas y claves.';
  if ($c === 404) $m = 'Gelato no encuentra esa plantilla o esa tienda. Compruebe el identificador.';
  salir(['error' => "Gelato: $m"], 502);
};

switch ($p['accion'] ?? '') {
  case 'plantillas':
    salir(['plantillas' => $plantillas, 'tienda' => !empty($K['gelatoTienda'])]);

  case 'olvidarPlantilla':
    $plantillas = array_values(array_filter($plantillas, fn($x) => $x['id'] !== ($p['id'] ?? '')));
    file_put_contents($fP, json_encode($plantillas, JSON_UNESCAPED_UNICODE), LOCK_EX);
    salir(['plantillas' => $plantillas]);

  case 'plantilla': // lee la plantilla: tallas/colores, códigos y huecos para el diseño; la recuerda para la próxima vez
    $t = $id($p['id'] ?? '');
    [$c, $d, $raw] = pedirHttp("$API/templates/$t", $cab);
    if ($c !== 200) $fallo($c, $raw);
    $variantes = array_map(fn($v) => [
      'id' => $v['id'], 'titulo' => $v['title'] ?? '', 'uid' => $v['productUid'] ?? '',
      'opciones' => array_map(fn($o) => ['nombre' => $o['name'] ?? '', 'valor' => $o['value'] ?? ''], $v['variantOptions'] ?? []),
      'huecos' => array_map(fn($h) => $h['name'], $v['imagePlaceholders'] ?? []),
    ], $d['variants'] ?? []);
    $nombre = trim((string)($p['nombre'] ?? '')) ?: ($d['templateName'] ?? $d['title'] ?? 'Plantilla');
    $plantillas = array_values(array_filter($plantillas, fn($x) => $x['id'] !== $t));
    array_unshift($plantillas, ['id' => $t, 'nombre' => mb_substr($nombre, 0, 80)]);
    file_put_contents($fP, json_encode($plantillas, JSON_UNESCAPED_UNICODE), LOCK_EX);
    salir(['id' => $t, 'nombre' => $nombre, 'titulo' => $d['title'] ?? '', 'descripcion' => $d['description'] ?? '', 'preview' => $d['previewUrl'] ?? '', 'variantes' => $variantes, 'plantillas' => $plantillas]);

  case 'crear': // crea el producto en la tienda de Gelato con el diseño en todas las tallas/colores elegidos
    if (empty($K['gelatoTienda'])) salir(['error' => 'Falta el identificador de la tienda de Gelato (Store ID) en Cuentas y claves › Gelato.'], 400);
    $t = $id($p['plantilla'] ?? '');
    $archivo = (string)($p['archivo'] ?? '');
    if (!preg_match('#^https://#', $archivo)) salir(['error' => 'Falta el archivo del diseño.'], 400);
    $titulo = trim(mb_substr((string)($p['titulo'] ?? ''), 0, 150));
    if ($titulo === '') salir(['error' => 'Falta el nombre del producto.'], 400);
    $vars = [];
    foreach (($p['variantes'] ?? []) as $v) {
      if (!preg_match('/^[A-Za-z0-9\-]{6,80}$/', (string)($v['id'] ?? ''))) continue;
      $vars[] = ['templateVariantId' => $v['id'], 'imagePlaceholders' => array_map(fn($h) => ['name' => (string)$h, 'fileUrl' => $archivo], array_slice((array)($v['huecos'] ?? []), 0, 10))];
    }
    if (!$vars) salir(['error' => 'Elija al menos una talla o color.'], 400);
    [$c, $d, $raw] = pedirHttp("$API/stores/" . $id($K['gelatoTienda']) . '/products:create-from-template', $cab, json_encode([
      'templateId' => $t, 'title' => $titulo, 'description' => mb_substr((string)($p['descripcion'] ?? ''), 0, 5000),
      'isVisibleInTheOnlineStore' => false, 'salesChannels' => ['web'], 'variants' => $vars,
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
    if ($c < 200 || $c >= 300 || empty($d['id'])) $fallo($c, $raw);
    salir(['id' => $d['id'], 'estado' => $d['status'] ?? '', 'preview' => $d['previewUrl'] ?? '']);

  case 'producto': // estado del producto en Gelato y sus fotos de muestra (se generan en unos segundos)
    if (empty($K['gelatoTienda'])) salir(['error' => 'Falta el Store ID.'], 400);
    [$c, $d, $raw] = pedirHttp("$API/stores/" . $id($K['gelatoTienda']) . '/products/' . $id($p['id'] ?? ''), $cab);
    if ($c !== 200) $fallo($c, $raw);
    $fotos = array_values(array_filter(array_map(fn($i) => $i['fileUrl'] ?? '', $d['productImages'] ?? [])));
    salir(['estado' => $d['status'] ?? '', 'preview' => $d['previewUrl'] ?? ($fotos[0] ?? ''), 'fotos' => $fotos,
      'variantes' => array_map(fn($v) => ['titulo' => $v['title'] ?? '', 'uid' => $v['productUid'] ?? ''], $d['variants'] ?? [])]);
}
salir(['error' => 'Acción desconocida'], 400);
