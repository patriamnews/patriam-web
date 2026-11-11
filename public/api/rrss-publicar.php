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

/* ---------- imágenes públicas ---------- */
if (isset($_GET['img'])) {
  if (!preg_match('/^([0-9a-f]{32})\.(png|jpg)$/', (string)$_GET['img'], $m) || !is_file($f = privado() . '/rrss-img/' . $m[0])) { http_response_code(404); exit; }
  header('Content-Type: image/' . ($m[2] === 'jpg' ? 'jpeg' : 'png'));
  header('Cache-Control: public, max-age=31536000, immutable');
  readfile($f); exit;
}
if ($_SERVER['REQUEST_METHOD'] !== 'POST') salir(['error' => 'Método no permitido'], 405);
$p = json_decode(file_get_contents('php://input'), true) ?: [];
$h = exigirEquipo($p);
$quien = (function ($h) { $eq = json_decode((string)@file_get_contents(privado() . '/equipo.json'), true) ?: []; return $eq[$h]['nombre'] ?? ($eq[$h]['email'] ?? ''); })($h);

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
  if (!in_array($tipo, ['image/png', 'image/jpeg'], true)) return null;
  // Instagram solo acepta JPEG: los PNG se convierten si se puede
  if ($tipo === 'image/png' && function_exists('imagecreatefromstring') && ($im = @imagecreatefromstring($bin))) {
    $w = imagesx($im); $hh = imagesy($im); $fondo = imagecreatetruecolor($w, $hh);
    imagefill($fondo, 0, 0, imagecolorallocate($fondo, 255, 255, 255)); imagecopy($fondo, $im, 0, 0, 0, 0, $w, $hh);
    ob_start(); imagejpeg($fondo, null, 92); $bin = ob_get_clean(); $tipo = 'image/jpeg';
  }
  $ext = $tipo === 'image/jpeg' ? 'jpg' : 'png';
  @mkdir(privado() . '/rrss-img', 0750, true);
  $n = md5($bin) . '.' . $ext;
  file_put_contents(privado() . '/rrss-img/' . $n, $bin);
  $esquema = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https' ? 'https' : 'http';
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
if ($accion === 'articulos') {
  $ch = curl_init(BOLETIN_WEB . 'boletines.js?t=' . time()); curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 25, CURLOPT_FOLLOWLOCATION => true]); $js = (string)curl_exec($ch); curl_close($ch);
  if (!preg_match('/window\.BOLETINES\s*=\s*(\[.*\]);?\s*$/s', $js, $mm)) salir(['error' => 'No se han podido leer los boletines.'], 502);
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
    foreach ($b['colaboraciones'] ?? [] as $c) {
      if (trim($c['titulo'] ?? '') === '' || empty($c['id'])) continue;
      $arts[] = ['id' => 'col-' . $c['id'], 'tipo' => 'Firma', 'titulo' => $c['titulo'], 'autor' => $c['autor'] ?? '',
        'entradilla' => $resumen(($c['texto'] ?? '') ?: ($c['entradilla'] ?? '')), 'imagen' => $abs($c['imagen'] ?? ''), 'enlace' => BOLETIN_WEB . '#/colaboracion/' . rawurlencode($c['id'])];
    }
    // Calendario: del sábado siguiente al envío, un artículo por día
    $d = new DateTime($b['fecha'], new DateTimeZone('Europe/Madrid'));
    $d->modify('next saturday');
    foreach ($arts as $i => &$a) { $a['dia'] = (clone $d)->modify("+$i day")->format('Y-m-d'); $a['publicado'] = $hecho[$a['id']] ?? []; } unset($a);
    $salida[] = ['numero' => $b['numero'] ?? null, 'fecha' => $b['fecha'], 'articulos' => $arts];
  }
  salir(['hoy' => $hoy, 'boletines' => $salida]);
}

if ($accion === 'publicar') {
  $k = misClaves($h); $cx = conexion($k);
  $red = $p['red'] ?? ''; $texto = trim((string)($p['texto'] ?? ''));
  if (!in_array($red, ['x', 'facebook', 'instagram'], true)) salir(['error' => 'Red no válida'], 400);
  if (empty($cx[$red])) salir(['error' => 'Primero conecta tu cuenta de ' . ['x' => 'X', 'facebook' => 'Facebook', 'instagram' => 'Instagram'][$red] . ' en «Conectar mis cuentas».'], 400);
  $img = !empty($p['imagen']) ? guardarImagen($p['imagen']) : null;
  if (!empty($p['imagen']) && !$img) salir(['error' => 'La imagen tiene que ser PNG o JPG y de menos de 8 MB.'], 400);
  if ($red === 'instagram' && !$img) salir(['error' => 'Instagram necesita una imagen.'], 400);
  $id = ''; $url = '';
  if ($red === 'x') {
    $largoX = mb_strlen(preg_replace('#https?://\S+#u', str_repeat('x', 23), $texto));   // X cuenta cada enlace como 23
    if ($largoX > 280) salir(['error' => 'En X caben 280 caracteres (hay ' . $largoX . ').'], 400);
    $cuerpo = ['text' => $texto];
    if ($img) {
      $u = XAPI . '/2/media/upload';
      [$c, $j, $e] = http('POST', $u, [xFirma('POST', $u, $k['x'])], ['media' => new CURLStringFile($img['bin'], 'imagen.' . ($img['tipo'] === 'image/png' ? 'png' : 'jpg'), $img['tipo']), 'media_category' => 'tweet_image']);
      $mid = $j['data']['id'] ?? ($j['media_id_string'] ?? '');
      if (!$mid) salir(['error' => 'X no ha aceptado la imagen: ' . errorApi($j, $c, $e)], 502);
      $cuerpo['media'] = ['media_ids' => [$mid]];
    }
    $u = XAPI . '/2/tweets';
    [$c, $j, $e] = http('POST', $u, [xFirma('POST', $u, $k['x']), 'Content-Type: application/json'], json_encode($cuerpo, JSON_UNESCAPED_UNICODE));
    $id = $j['data']['id'] ?? '';
    if (!$id) salir(['error' => 'X no lo ha publicado: ' . errorApi($j, $c, $e) . ($c === 402 || $c === 403 ? ' (la cuenta de desarrollador de X tiene que tener saldo: se paga por publicación)' : '')], 502);
    $url = 'https://x.com/' . ($k['x']['usuario'] ?? 'i') . '/status/' . $id;
  } elseif ($red === 'facebook') {
    $m = $k['meta'];
    $q = $img ? ['url' => $img['url'], 'caption' => $texto] : ['message' => $texto];
    [$c, $j, $e] = http('POST', GRAPH . '/' . rawurlencode($m['pageId']) . ($img ? '/photos' : '/feed'), [], http_build_query($q + ['access_token' => $m['pageToken']]));
    $id = $j['post_id'] ?? ($j['id'] ?? '');
    if (!$id) salir(['error' => 'Facebook no lo ha publicado: ' . errorApi($j, $c, $e)], 502);
    $url = 'https://www.facebook.com/' . $id;
  } else {
    $m = $k['meta'];
    [$c, $j, $e] = http('POST', GRAPH . '/' . rawurlencode($m['igId']) . '/media', [], http_build_query(['image_url' => $img['url'], 'caption' => $texto, 'access_token' => $m['pageToken']]));
    $cont = $j['id'] ?? '';
    if (!$cont) salir(['error' => 'Instagram no ha aceptado la imagen: ' . errorApi($j, $c, $e)], 502);
    for ($n = 0; $n < 8; $n++) {   // Instagram prepara la imagen antes de publicarla
      [$c, $j] = http('GET', GRAPH . '/' . $cont . '?fields=status_code&access_token=' . rawurlencode($m['pageToken']));
      if (($j['status_code'] ?? '') === 'FINISHED') break;
      if (($j['status_code'] ?? '') === 'ERROR') salir(['error' => 'Instagram no ha podido preparar la imagen.'], 502);
      sleep(2);
    }
    [$c, $j, $e] = http('POST', GRAPH . '/' . rawurlencode($m['igId']) . '/media_publish', [], http_build_query(['creation_id' => $cont, 'access_token' => $m['pageToken']]));
    $id = $j['id'] ?? '';
    if (!$id) salir(['error' => 'Instagram no lo ha publicado: ' . errorApi($j, $c, $e)], 502);
    [, $j] = http('GET', GRAPH . '/' . $id . '?fields=permalink&access_token=' . rawurlencode($m['pageToken']));
    $url = $j['permalink'] ?? 'https://www.instagram.com/';
  }
  $lista = leerJson('rrss-publicados.json');
  array_unshift($lista, ['id' => bin2hex(random_bytes(6)), 'red' => $red, 'postId' => $id, 'url' => $url, 'texto' => mb_substr($texto, 0, 2200),
    'imagen' => $img['url'] ?? '', 'fecha' => gmdate('c'), 'quien' => $quien, 'h' => $h, 'origen' => mb_substr((string)($p['origen'] ?? ''), 0, 80)]);
  guardarJson('rrss-publicados.json', array_slice($lista, 0, 1000));
  salir(['ok' => true, 'url' => $url]);
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
