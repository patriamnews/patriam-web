<?php
/* RRSS › publicar desde Publicar con las cuentas de cada uno (X, Facebook e Instagram) y seguir lo publicado.
   POST {token, accion, …}  (la sesión de Publicar)
     conexion          → qué redes tiene conectadas (nunca devuelve las claves)
     conectar          {x:{apiKey,apiSecret,token,tokenSecret}, meta:{pageId,pageToken,igId}}  (vacío = se deja; «-» = se borra)
     boletin           → las publicaciones preparadas del boletín (boletin.movimientopatriam.es/redes/)
     articulos         → artículos propios del boletín (editorial y firmas, no noticias) con su día: uno diario desde el sábado siguiente al envío
     publicar          {red: x|facebook|instagram, texto, imagen (data:image/… o https://…)}
     publicados        → lo publicado desde aquí (de todo el equipo)
     seguimiento       {id} → cifras y comentarios de una publicación
   GET ?img=<hash>.<ext>  → la imagen (pública: Instagram y Facebook la descargan de aquí)
   Las claves de cada uno van en la carpeta privada (rrss-claves.json, solo lectura del servidor). */
require_once __DIR__ . '/_comun.php';

const GRAPH = 'https://graph.facebook.com/v21.0';
const XAPI = 'https://api.x.com';
const BOLETIN_REDES = 'https://boletin.movimientopatriam.es/redes/';
const BOLETIN_WEB = 'https://boletin.movimientopatriam.es/';

$CLI = PHP_SAPI === 'cli';
/* ---------- imágenes públicas ---------- */
if (!$CLI && isset($_GET['img'])) {
  if (!preg_match('/^([0-9a-f]{32})\.(png|jpg)$/', (string)$_GET['img'], $m) || !is_file($f = privado() . '/rrss-img/' . $m[0])) { http_response_code(404); exit; }
  header('Content-Type: image/' . ($m[2] === 'jpg' ? 'jpeg' : 'png'));
  header('Cache-Control: public, max-age=31536000, immutable');
  readfile($f); exit;
}
function nombreDe($h) { $eq = json_decode((string)@file_get_contents(privado() . '/equipo.json'), true) ?: []; return $eq[$h]['nombre'] ?? ($eq[$h]['email'] ?? ''); }
if ($CLI) { $p = ['accion' => $argv[1] ?? '']; $h = ''; $quien = 'Automático'; }
else {
  if ($_SERVER['REQUEST_METHOD'] !== 'POST') salir(['error' => 'Método no permitido'], 405);
  $p = json_decode(file_get_contents('php://input'), true) ?: [];
  $h = exigirEquipo($p);
  $quien = nombreDe($h);
}

function leerJson($n) { $f = privado() . '/' . $n; return is_file($f) ? (json_decode(file_get_contents($f), true) ?: []) : []; }
function guardarJson($n, $d) { $f = privado() . '/' . $n; file_put_contents($f, json_encode($d, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), LOCK_EX); @chmod($f, 0600); }
function misClaves($h) { return leerJson('rrss-claves.json')[$h] ?? []; }
function conexion($k) {
  return ['x' => !empty($k['x']['apiKey']) && !empty($k['x']['token']), 'facebook' => !empty($k['meta']['pageId']) && !empty($k['meta']['pageToken']),
    'instagram' => !empty($k['meta']['igId']) && !empty($k['meta']['pageToken'])];
}
function http($metodo, $url, $cab = [], $cuerpo = null) {
  $ch = curl_init($url);
  curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 60, CURLOPT_HTTPHEADER => $cab, CURLOPT_CUSTOMREQUEST => $metodo]);
  if ($cuerpo !== null) curl_setopt($ch, CURLOPT_POSTFIELDS, $cuerpo);
  $r = curl_exec($ch); $c = curl_getinfo($ch, CURLINFO_RESPONSE_CODE); $e = curl_error($ch); curl_close($ch);
  return [$c, json_decode((string)$r, true) ?: [], $e];
}
function errorApi($j, $c, $e) {
  return $j['error']['message'] ?? ($j['detail'] ?? ($j['errors'][0]['message'] ?? ($j['title'] ?? ($e ?: 'respondió ' . $c))));
}

/* ---------- X: firma OAuth 1.0a (las cuatro claves de la app de X del usuario) ---------- */
function xFirma($metodo, $url, $k, $params = []) {
  $o = ['oauth_consumer_key' => $k['apiKey'], 'oauth_nonce' => bin2hex(random_bytes(16)), 'oauth_signature_method' => 'HMAC-SHA1',
    'oauth_timestamp' => (string)time(), 'oauth_token' => $k['token'], 'oauth_version' => '1.0'];
  $todo = array_merge($params, $o);
  ksort($todo);
  $pares = []; foreach ($todo as $a => $b) $pares[] = rawurlencode($a) . '=' . rawurlencode($b);
  $base = strtoupper($metodo) . '&' . rawurlencode(strtok($url, '?')) . '&' . rawurlencode(implode('&', $pares));
  $o['oauth_signature'] = base64_encode(hash_hmac('sha1', $base, rawurlencode($k['apiSecret']) . '&' . rawurlencode($k['tokenSecret']), true));
  $c = []; foreach ($o as $a => $b) $c[] = rawurlencode($a) . '="' . rawurlencode($b) . '"';
  return 'Authorization: OAuth ' . implode(', ', $c);
}
function xGet($ruta, $q, $k) {
  $url = XAPI . $ruta;
  return http('GET', $url . '?' . http_build_query($q, '', '&', PHP_QUERY_RFC3986), [xFirma('GET', $url, $k, $q)]);
}

/* ---------- imagen: de data:… o de una dirección → archivo propio con dirección pública ---------- */
function guardarImagen($v) {
  if (preg_match('#^data:image/(png|jpe?g);base64,(.+)$#', (string)$v, $m)) $bin = base64_decode($m[2]);
  elseif (preg_match('#^https://#', (string)$v)) { $ch = curl_init($v); curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 30, CURLOPT_FOLLOWLOCATION => true]); $bin = curl_exec($ch); curl_close($ch); }
  else return null;
  if (!$bin || strlen($bin) > 8000000) return null;
  $tipo = @getimagesizefromstring($bin)['mime'] ?? '';
  if (!in_array($tipo, ['image/png', 'image/jpeg', 'image/gif'], true)) return null;
  // Instagram solo acepta JPEG: los PNG y los GIF (su primer fotograma) se convierten; las pequeñas se agrandan a 1080 px
  if (function_exists('imagecreatefromstring') && ($tipo !== 'image/jpeg' || (@getimagesizefromstring($bin)[0] ?? 1080) < 640) && ($im = @imagecreatefromstring($bin))) {
    $w = imagesx($im); $hh = imagesy($im); $f = $w < 640 ? 1080 / $w : 1; $W = (int)round($w * $f); $H = (int)round($hh * $f);
    $fondo = imagecreatetruecolor($W, $H);
    imagefill($fondo, 0, 0, imagecolorallocate($fondo, 255, 255, 255)); imagecopyresampled($fondo, $im, 0, 0, 0, 0, $W, $H, $w, $hh);
    ob_start(); imagejpeg($fondo, null, 92); $bin = ob_get_clean(); $tipo = 'image/jpeg';
  }
  if ($tipo === 'image/gif') return null;
  $ext = $tipo === 'image/jpeg' ? 'jpg' : 'png';
  @mkdir(privado() . '/rrss-img', 0750, true);
  $n = md5($bin) . '.' . $ext;
  file_put_contents(privado() . '/rrss-img/' . $n, $bin);
  $esquema = PHP_SAPI === 'cli' || (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https' ? 'https' : 'http';
  $host = preg_replace('/^publicar\./', '', $_SERVER['HTTP_HOST'] ?? 'movimientopatriam.es');
  return ['bin' => $bin, 'tipo' => $tipo, 'url' => $esquema . '://' . $host . '/api/rrss-publicar.php?img=' . $n];
}

$accion = $p['accion'] ?? '';

if ($accion === 'conexion') salir(['conexion' => conexion(misClaves($h))]);

if ($accion === 'conectar') {
  $todo = leerJson('rrss-claves.json'); $k = $todo[$h] ?? [];
  foreach (['x' => ['apiKey', 'apiSecret', 'token', 'tokenSecret'], 'meta' => ['pageId', 'pageToken', 'igId']] as $grupo => $campos) {
    foreach ($campos as $c) {
      if (!isset($p[$grupo][$c])) continue;
      $v = trim((string)$p[$grupo][$c]);
      if ($v === '-') unset($k[$grupo][$c]); elseif ($v !== '') $k[$grupo][$c] = mb_substr($v, 0, 600);
    }
  }
  // Se comprueba al momento que las claves valen
  $prueba = [];
  if (conexion($k)['x']) { [$c, $j, $e] = xGet('/2/users/me', [], $k['x']); $prueba['x'] = $c === 200 ? '✔ @' . ($j['data']['username'] ?? '') : '✗ ' . errorApi($j, $c, $e); if ($c === 200) $k['x']['usuario'] = $j['data']['username'] ?? ''; }
  if (conexion($k)['facebook']) { [$c, $j, $e] = http('GET', GRAPH . '/' . rawurlencode($k['meta']['pageId']) . '?fields=name&access_token=' . rawurlencode($k['meta']['pageToken'])); $prueba['facebook'] = $c === 200 ? '✔ ' . ($j['name'] ?? '') : '✗ ' . errorApi($j, $c, $e); }
  if (conexion($k)['instagram']) { [$c, $j, $e] = http('GET', GRAPH . '/' . rawurlencode($k['meta']['igId']) . '?fields=username&access_token=' . rawurlencode($k['meta']['pageToken'])); $prueba['instagram'] = $c === 200 ? '✔ @' . ($j['username'] ?? '') : '✗ ' . errorApi($j, $c, $e); }
  $todo[$h] = $k; guardarJson('rrss-claves.json', $todo);
  salir(['conexion' => conexion($k), 'prueba' => $prueba]);
}

/* Las publicaciones preparadas en el boletín (la página «Textos para redes») */
if ($accion === 'boletin') {
  $ch = curl_init(BOLETIN_REDES . '?t=' . time()); curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 20]); $html = (string)curl_exec($ch); curl_close($ch);
  if ($html === '') salir(['error' => 'No se ha podido leer la página del boletín.'], 502);
  $posts = []; $grupo = ''; $enlace = '';
  // Se recorren en orden: títulos (h2), enlace del grupo y cada publicación
  preg_match_all('#<h2>(.*?)</h2>|<p class="enlace">.*?href="([^"]+)"|<div class="post">(.*?)</pre></div>#s', $html, $mm, PREG_SET_ORDER);
  foreach ($mm as $m) {
    if (!empty($m[1])) { $grupo = html_entity_decode(strip_tags($m[1]), ENT_QUOTES, 'UTF-8'); $enlace = ''; continue; }
    if (!empty($m[2])) { $enlace = html_entity_decode($m[2], ENT_QUOTES); continue; }
    $b = $m[3] ?? '';
    preg_match('#<div class="red">(.*?)(<small>(.*?)</small>)?</div>#s', $b, $r);
    preg_match('#<img src="([^"]+)"#', $b, $i);
    preg_match('#<pre id="([^"]+)">(.*)$#s', $b, $t);
    $red = trim(html_entity_decode(strip_tags($r[1] ?? ''), ENT_QUOTES, 'UTF-8'));
    $posts[] = ['id' => $t[1] ?? md5($b), 'grupo' => $grupo, 'enlace' => $enlace, 'red' => $red,
      'clave' => stripos($red, 'instagram') !== false ? 'instagram' : (stripos($red, 'facebook') !== false ? 'facebook' : (preg_match('/^x\b|twitter/i', $red) ? 'x' : 'otra')),
      'nota' => trim(html_entity_decode(strip_tags($r[3] ?? ''), ENT_QUOTES, 'UTF-8')), 'imagen' => html_entity_decode($i[1] ?? '', ENT_QUOTES),
      'texto' => html_entity_decode($t[2] ?? '', ENT_QUOTES, 'UTF-8')];
  }
  salir(['posts' => $posts]);
}

/* Artículo del día: los artículos PROPIOS de PATRIAM del boletín (editorial y firmas), nunca las noticias de otros medios.
   Desde el sábado siguiente al envío del boletín toca uno cada día, por orden: primero la editorial y luego las firmas. */
function articulosBoletin() {
  $ch = curl_init(BOLETIN_WEB . 'boletines.js?t=' . time()); curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 25, CURLOPT_FOLLOWLOCATION => true]); $js = (string)curl_exec($ch); curl_close($ch);
  if (!preg_match('/window\.BOLETINES\s*=\s*(\[.*\]);?\s*$/s', $js, $mm)) throw new Exception('No se han podido leer los boletines.');
  $bols = array_values(array_filter(json_decode(rtrim($mm[1], "; \n"), true) ?: [], fn($b) => ($b['estado'] ?? '') === 'aprobado' && !empty($b['fecha'])));
  usort($bols, fn($a, $b) => ($b['numero'] ?? 0) <=> ($a['numero'] ?? 0));
  $abs = fn($u) => !$u ? '' : (preg_match('#^https?://#', $u) ? $u : BOLETIN_WEB . ltrim($u, '/'));
  $resumen = function ($t) {   // las primeras frases del artículo, hasta unos 260 caracteres
    $t = trim(preg_replace('/\s+/u', ' ', strip_tags((string)$t)));
    if (mb_strlen($t) <= 260) return $t;
    $c = mb_substr($t, 0, 260); $p = mb_strrpos($c, '. ');
    return $p !== false && $p > 120 ? mb_substr($c, 0, $p + 1) : rtrim(mb_substr($c, 0, mb_strrpos($c, ' ') ?: 260), " ,.;:") . '…';
  };
  // Lo ya publicado de cada artículo (por quien sea del equipo)
  $hecho = [];
  foreach (leerJson('rrss-publicados.json') as $x) if (preg_match('/^artículo · (\S+)/u', $x['origen'] ?? '', $o)) $hecho[$o[1]][] = ['red' => $x['red'], 'fecha' => $x['fecha'], 'url' => $x['url']];
  $hoy = (new DateTime('now', new DateTimeZone('Europe/Madrid')))->format('Y-m-d');
  $salida = [];
  foreach ($bols as $b) {
    $arts = [];
    $ed = $b['editorial'] ?? [];
    if (trim($ed['texto'] ?? '') !== '') $arts[] = ['id' => 'ed-' . $b['id'], 'tipo' => 'Editorial', 'titulo' => $ed['titulo'] ?: 'Editorial', 'autor' => $ed['firma'] ?? '',
      'entradilla' => $resumen($ed['texto']), 'imagen' => $abs($ed['imagen'] ?? ''), 'enlace' => BOLETIN_WEB . '#/editorial/' . rawurlencode($b['id'])];
    $cols = $b['colaboraciones'] ?? [];
    usort($cols, fn($x, $y) => !empty($y['apertura']) <=> !empty($x['apertura']));   // la apertura del número, la primera
    foreach ($cols as $c) {
      if (trim($c['titulo'] ?? '') === '' || empty($c['id'])) continue;
      $arts[] = ['id' => 'col-' . $c['id'], 'tipo' => 'Firma', 'titulo' => $c['titulo'], 'autor' => $c['autor'] ?? '',
        'entradilla' => $resumen(($c['texto'] ?? '') ?: ($c['entradilla'] ?? '')), 'imagen' => $abs($c['imagen'] ?? ''), 'enlace' => BOLETIN_WEB . 'articulo/' . rawurlencode($c['id']), 'apertura' => !empty($c['apertura'])];
    }
    $ap = array_values(array_filter($arts, fn($x) => !empty($x['apertura'])));
    if ($ap) $arts = array_merge($ap, array_values(array_filter($arts, fn($x) => empty($x['apertura']))));
    // Calendario: del sábado siguiente al envío, un artículo por día
    $d = new DateTime($b['fecha'], new DateTimeZone('Europe/Madrid'));
    $d->modify('next saturday');
    foreach ($arts as $i => &$a) { $a['dia'] = (clone $d)->modify("+$i day")->format('Y-m-d'); $a['publicado'] = $hecho[$a['id']] ?? []; } unset($a);
    $salida[] = ['numero' => $b['numero'] ?? null, 'fecha' => $b['fecha'], 'articulos' => $arts];
  }
  return ['hoy' => $hoy, 'boletines' => $salida];
}
if ($accion === 'articulos') { try { salir(articulosBoletin()); } catch (Exception $e) { salir(['error' => $e->getMessage()], 502); } }

/* Publica en una red con las claves de la persona $h. Devuelve el enlace de lo publicado o lanza el error. */
function publicarEn($h, $quien, $red, $texto, $imagen = '', $origen = '') {
  $k = misClaves($h); $cx = conexion($k); $texto = trim((string)$texto);
  if (!in_array($red, ['x', 'facebook', 'instagram'], true)) throw new Exception('Red no válida');
  if (empty($cx[$red])) throw new Exception('Primero conecta tu cuenta de ' . ['x' => 'X', 'facebook' => 'Facebook', 'instagram' => 'Instagram'][$red] . ' en «Conectar mis cuentas».');
  $img = $imagen ? guardarImagen($imagen) : null;
  if ($imagen && !$img) throw new Exception('La imagen tiene que ser PNG o JPG y de menos de 8 MB.');
  if ($red === 'instagram' && !$img) throw new Exception('Instagram necesita una imagen.');
  $id = ''; $url = '';
  if ($red === 'x') {
    $largoX = mb_strlen(preg_replace('#https?://\S+#u', str_repeat('x', 23), $texto));   // X cuenta cada enlace como 23
    if ($largoX > 280) throw new Exception('En X caben 280 caracteres (hay ' . $largoX . ').');
    $cuerpo = ['text' => $texto];
    if ($img) {
      $u = XAPI . '/2/media/upload';
      [$c, $j, $e] = http('POST', $u, [xFirma('POST', $u, $k['x'])], ['media' => new CURLStringFile($img['bin'], 'imagen.' . ($img['tipo'] === 'image/png' ? 'png' : 'jpg'), $img['tipo']), 'media_category' => 'tweet_image']);
      $mid = $j['data']['id'] ?? ($j['media_id_string'] ?? '');
      if (!$mid) throw new Exception('X no ha aceptado la imagen: ' . errorApi($j, $c, $e));
      $cuerpo['media'] = ['media_ids' => [$mid]];
    }
    $u = XAPI . '/2/tweets';
    [$c, $j, $e] = http('POST', $u, [xFirma('POST', $u, $k['x']), 'Content-Type: application/json'], json_encode($cuerpo, JSON_UNESCAPED_UNICODE));
    $id = $j['data']['id'] ?? '';
    if (!$id) throw new Exception('X no lo ha publicado: ' . errorApi($j, $c, $e) . ($c === 402 || $c === 403 ? ' (la cuenta de desarrollador de X tiene que tener saldo: se paga por publicación)' : ''));
    $url = 'https://x.com/' . ($k['x']['usuario'] ?? 'i') . '/status/' . $id;
  } elseif ($red === 'facebook') {
    $m = $k['meta'];
    $q = $img ? ['url' => $img['url'], 'caption' => $texto] : ['message' => $texto];
    [$c, $j, $e] = http('POST', GRAPH . '/' . rawurlencode($m['pageId']) . ($img ? '/photos' : '/feed'), [], http_build_query($q + ['access_token' => $m['pageToken']]));
    $id = $j['post_id'] ?? ($j['id'] ?? '');
    if (!$id) throw new Exception('Facebook no lo ha publicado: ' . errorApi($j, $c, $e));
    $url = 'https://www.facebook.com/' . $id;
  } else {
    $m = $k['meta'];
    [$c, $j, $e] = http('POST', GRAPH . '/' . rawurlencode($m['igId']) . '/media', [], http_build_query(['image_url' => $img['url'], 'caption' => $texto, 'access_token' => $m['pageToken']]));
    $cont = $j['id'] ?? '';
    if (!$cont) throw new Exception('Instagram no ha aceptado la imagen: ' . errorApi($j, $c, $e));
    for ($n = 0; $n < 8; $n++) {   // Instagram prepara la imagen antes de publicarla
      [$c, $j] = http('GET', GRAPH . '/' . $cont . '?fields=status_code&access_token=' . rawurlencode($m['pageToken']));
      if (($j['status_code'] ?? '') === 'FINISHED') break;
      if (($j['status_code'] ?? '') === 'ERROR') throw new Exception('Instagram no ha podido preparar la imagen.');
      sleep(2);
    }
    [$c, $j, $e] = http('POST', GRAPH . '/' . rawurlencode($m['igId']) . '/media_publish', [], http_build_query(['creation_id' => $cont, 'access_token' => $m['pageToken']]));
    $id = $j['id'] ?? '';
    if (!$id) throw new Exception('Instagram no lo ha publicado: ' . errorApi($j, $c, $e));
    [, $j] = http('GET', GRAPH . '/' . $id . '?fields=permalink&access_token=' . rawurlencode($m['pageToken']));
    $url = $j['permalink'] ?? 'https://www.instagram.com/';
  }
  $lista = leerJson('rrss-publicados.json');
  array_unshift($lista, ['id' => bin2hex(random_bytes(6)), 'red' => $red, 'postId' => $id, 'url' => $url, 'texto' => mb_substr($texto, 0, 2200),
    'imagen' => $img['url'] ?? '', 'fecha' => gmdate('c'), 'quien' => $quien, 'h' => $h, 'origen' => mb_substr((string)$origen, 0, 80)]);
  guardarJson('rrss-publicados.json', array_slice($lista, 0, 1000));
  return $url;
}
if ($accion === 'publicar') {
  try { salir(['ok' => true, 'url' => publicarEn($h, $quien, $p['red'] ?? '', $p['texto'] ?? '', $p['imagen'] ?? '', $p['origen'] ?? '')]); }
  catch (Exception $e) { salir(['error' => $e->getMessage()], 400); }
}

/* ---------- Publicación automática: un artículo del boletín al día ----------
   Lo activa una persona del equipo con SUS cuentas conectadas (normalmente Álvaro): se publica con sus claves.
   rrss-auto.json: {activo, h, quien, hora, redes[], elegidas{dia: id}, hechos{dia: {...}}}
   El cron de Hostinger lanza cada hora «php rrss-publicar.php diario»; a partir de la hora fijada publica el del día (una sola vez). */
function textosAuto($a) {
  $t = $a['titulo']; $r = trim($a['entradilla'] ?? ''); $en = $a['enlace']; $firma = $a['autor'] ? "\n\n✍️ " . $a['autor'] : '';
  $sobra = 280 - mb_strlen($t . $firma . "\n\n\n\n") - 23 - mb_strlen("\n\n#PATRIAM");
  $rx = mb_strlen($r) > $sobra ? ($sobra > 30 ? preg_replace('/\s+\S*$/u', '', mb_substr($r, 0, $sobra - 1)) . '…' : '') : $r;
  return [
    'x' => $t . ($rx ? "\n\n" . $rx : '') . $firma . "\n\n" . $en . "\n\n#PATRIAM",
    'facebook' => $t . "\n\n" . $r . $firma . "\n\nLéelo completo: " . $en,
    'instagram' => '📰 ' . $t . "\n\n" . $r . $firma . "\n\nLéelo entero en el boletín de PATRIAM (enlace en la bio).\n\nDios, Patria, Justicia 🇪🇸\n\n#PATRIAM #España #actualidad #ConCriterio",
  ];
}
function autoLeer() { return leerJson('rrss-auto.json') + ['activo' => false, 'h' => '', 'quien' => '', 'hora' => 10, 'redes' => ['x', 'facebook', 'instagram'], 'elegidas' => [], 'hechos' => []]; }
/* El artículo de un día: el elegido a mano; si no, el que toca por calendario; si no, el siguiente sin publicar del último boletín */
function articuloDelDia($dia, $auto, $datos) {
  $todos = []; foreach ($datos['boletines'] as $b) foreach ($b['articulos'] as $a) $todos[$a['id']] = $a;
  if (!empty($auto['elegidas'][$dia]) && isset($todos[$auto['elegidas'][$dia]])) return [$todos[$auto['elegidas'][$dia]], 'elegido'];
  foreach ($datos['boletines'][0]['articulos'] ?? [] as $a) if (($a['dia'] ?? '') === $dia) return [$a, 'calendario'];
  $usados = array_column(array_values($auto['hechos']), 'id');
  foreach ($datos['boletines'][0]['articulos'] ?? [] as $a) if (!$a['publicado'] && !in_array($a['id'], $usados, true)) return [$a, 'siguiente'];
  return [null, ''];
}
function autoPublicar($forzar = false) {
  $auto = autoLeer();
  $ahora = new DateTime('now', new DateTimeZone('Europe/Madrid')); $hoy = $ahora->format('Y-m-d');
  if (!$auto['activo'] || !$auto['h']) return 'Desactivada.';
  if (!$forzar && (int)$ahora->format('G') < (int)$auto['hora']) return 'Todavía no es la hora (' . $auto['hora'] . ':00).';
  if (!$forzar && !empty($auto['hechos'][$hoy])) return 'Hoy ya está publicado.';
  try { [$a, $por] = articuloDelDia($hoy, $auto, articulosBoletin()); } catch (Exception $e) { return $e->getMessage(); }
  if (!$a) return 'No hay artículo para hoy.';
  $tx = textosAuto($a); $res = [];
  foreach ($auto['redes'] as $red) {
    if ($red === 'instagram' && !$a['imagen']) { $res[$red] = '— sin imagen'; continue; }
    try { $res[$red] = '✔ ' . publicarEn($auto['h'], 'Automático', $red, $tx[$red], $a['imagen'], mb_substr('artículo · ' . $a['id'] . ' · ' . $a['titulo'], 0, 80)); }
    catch (Exception $e) { $res[$red] = '✗ ' . $e->getMessage(); }
  }
  $auto['hechos'][$hoy] = ['id' => $a['id'], 'titulo' => $a['titulo'], 'por' => $por, 'redes' => $res, 'fecha' => gmdate('c')];
  $auto['hechos'] = array_slice($auto['hechos'], -90, null, true);
  guardarJson('rrss-auto.json', $auto);
  $mal = array_filter($res, fn($v) => str_starts_with($v, '✗'));
  if ($mal) avisar('Redes: no se ha podido publicar «' . $a['titulo'] . '»', implode("\n", array_map(fn($r, $v) => "$r: $v", array_keys($res), $res)) . "\n\nRevisa las claves en publicar.movimientopatriam.es › RRSS › Conectar mis cuentas.");
  return '«' . $a['titulo'] . '» → ' . json_encode($res, JSON_UNESCAPED_UNICODE);
}
if ($CLI) {
  if ($accion === 'diario') { echo autoPublicar() . "\n"; exit; }
  echo "Uso: php rrss-publicar.php diario\n"; exit;
}
/* Ver y cambiar la publicación automática. Al activarla se usa la cuenta de quien la activa. */
if ($accion === 'auto') {
  $auto = autoLeer();
  if (isset($p['activo'])) {
    $auto['activo'] = (bool)$p['activo'];
    if ($auto['activo']) { if (!array_filter(conexion(misClaves($h)))) salir(['error' => 'Primero conecta tus cuentas en «Conectar mis cuentas».'], 400); $auto['h'] = $h; $auto['quien'] = $quien; }
  }
  if (isset($p['hora'])) $auto['hora'] = max(0, min(23, (int)$p['hora']));
  if (isset($p['redes']) && is_array($p['redes'])) $auto['redes'] = array_values(array_intersect(['x', 'facebook', 'instagram'], $p['redes']));
  if (isset($p['elegir']['dia']) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $p['elegir']['dia'])) {
    $id = preg_replace('/[^A-Za-z0-9_.-]/', '', (string)($p['elegir']['id'] ?? ''));
    if ($id) $auto['elegidas'][$p['elegir']['dia']] = $id; else unset($auto['elegidas'][$p['elegir']['dia']]);
    $auto['elegidas'] = array_filter($auto['elegidas'], fn($d) => $d >= gmdate('Y-m-d', time() - 86400), ARRAY_FILTER_USE_KEY);
  }
  if (count($p) > 2) guardarJson('rrss-auto.json', $auto);
  $hoy = (new DateTime('now', new DateTimeZone('Europe/Madrid')))->format('Y-m-d');
  $prox = null; try { [$a, $por] = articuloDelDia($hoy, $auto, articulosBoletin()); if ($a) $prox = ['id' => $a['id'], 'titulo' => $a['titulo'], 'por' => $por]; } catch (Exception $e) {}
  salir(['activo' => $auto['activo'], 'quien' => $auto['quien'], 'mia' => $auto['h'] === $h, 'hora' => $auto['hora'], 'redes' => $auto['redes'],
    'elegidas' => $auto['elegidas'], 'hoy' => $hoy, 'hecho' => $auto['hechos'][$hoy] ?? null, 'hoyToca' => $prox,
    'ultimos' => array_slice(array_reverse($auto['hechos'], true), 0, 10, true), 'conexion' => conexion(misClaves($h))]);
}

if ($accion === 'publicados') {
  salir(['publicados' => array_map(fn($x) => array_diff_key($x, ['h' => 1]) + ['mio' => $x['h'] === $h], array_slice(leerJson('rrss-publicados.json'), 0, 200)), 'conexion' => conexion(misClaves($h))]);
}

/* Cifras y comentarios de una publicación (con las claves de quien la publicó) */
if ($accion === 'seguimiento') {
  $x = null; foreach (leerJson('rrss-publicados.json') as $y) if ($y['id'] === ($p['id'] ?? '')) $x = $y;
  if (!$x) salir(['error' => 'No existe'], 404);
  $k = misClaves($x['h']) ?: misClaves($h);
  $cifras = []; $comentarios = []; $aviso = '';
  if ($x['red'] === 'x' && !empty($k['x'])) {
    [$c, $j, $e] = xGet('/2/tweets/' . $x['postId'], ['tweet.fields' => 'public_metrics'], $k['x']);
    $pm = $j['data']['public_metrics'] ?? [];
    $cifras = ['Me gusta' => $pm['like_count'] ?? null, 'Respuestas' => $pm['reply_count'] ?? null, 'Reposts' => $pm['retweet_count'] ?? null, 'Visualizaciones' => $pm['impression_count'] ?? null];
    [$c, $j, $e] = xGet('/2/tweets/search/recent', ['query' => 'conversation_id:' . $x['postId'], 'tweet.fields' => 'created_at,author_id', 'expansions' => 'author_id', 'user.fields' => 'username', 'max_results' => '50'], $k['x']);
    $us = []; foreach ($j['includes']['users'] ?? [] as $u) $us[$u['id']] = '@' . $u['username'];
    foreach ($j['data'] ?? [] as $r) $comentarios[] = ['autor' => $us[$r['author_id']] ?? '', 'texto' => $r['text'], 'fecha' => $r['created_at'] ?? ''];
    if ($c !== 200) $aviso = 'X: ' . errorApi($j, $c, $e) . ' (leer respuestas en X se paga por lectura).';
  } elseif (in_array($x['red'], ['facebook', 'instagram'], true) && !empty($k['meta']['pageToken'])) {
    $tk = rawurlencode($k['meta']['pageToken']);
    if ($x['red'] === 'facebook') {
      [$c, $j] = http('GET', GRAPH . '/' . $x['postId'] . '?fields=shares,reactions.summary(true).limit(0),comments.summary(true).limit(0)&access_token=' . $tk);
      $cifras = ['Reacciones' => $j['reactions']['summary']['total_count'] ?? null, 'Comentarios' => $j['comments']['summary']['total_count'] ?? null, 'Compartido' => $j['shares']['count'] ?? 0];
      [$c, $j, $e] = http('GET', GRAPH . '/' . $x['postId'] . '/comments?fields=from{name},message,created_time&order=reverse_chronological&limit=50&access_token=' . $tk);
      foreach ($j['data'] ?? [] as $r) $comentarios[] = ['autor' => $r['from']['name'] ?? '', 'texto' => $r['message'] ?? '', 'fecha' => $r['created_time'] ?? ''];
    } else {
      [$c, $j] = http('GET', GRAPH . '/' . $x['postId'] . '?fields=like_count,comments_count&access_token=' . $tk);
      $cifras = ['Me gusta' => $j['like_count'] ?? null, 'Comentarios' => $j['comments_count'] ?? null];
      [$c, $j, $e] = http('GET', GRAPH . '/' . $x['postId'] . '/comments?fields=username,text,timestamp&limit=50&access_token=' . $tk);
      foreach ($j['data'] ?? [] as $r) $comentarios[] = ['autor' => '@' . ($r['username'] ?? ''), 'texto' => $r['text'] ?? '', 'fecha' => $r['timestamp'] ?? ''];
    }
    if ($c !== 200) $aviso = errorApi($j, $c, $e ?? '');
  } else $aviso = 'Quien lo publicó ya no tiene la cuenta conectada.';
  salir(['cifras' => array_filter($cifras, fn($v) => $v !== null), 'comentarios' => $comentarios, 'aviso' => $aviso]);
}

salir(['error' => 'No existe'], 404);
