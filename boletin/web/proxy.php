<?php
// Puente provisional: la web del boletín se sirve desde Hostinger (GitHub)
// y las funciones (cuentas, boletines, imágenes, enlaces) siguen en Netlify
// hasta que pasen a Supabase. No guarda nada ni contiene claves.
$ORIGEN = 'https://boletinpatriam.netlify.app';
$ruta = isset($_GET['__r']) ? $_GET['__r'] : '';
if (!preg_match('#^(api/[A-Za-z0-9_-]+|img/[^/]+|a/[^/]+|boletin/[^/]+|boletines\.js)$#', $ruta)) {
  http_response_code(404); exit('No encontrado');
}
$q = $_GET; unset($q['__r']);
$url = $ORIGEN . '/' . $ruta . ($q ? '?' . http_build_query($q) : '');
$metodo = $_SERVER['REQUEST_METHOD'];
$cab = [];
foreach (['CONTENT_TYPE' => 'Content-Type', 'HTTP_AUTHORIZATION' => 'Authorization', 'HTTP_IF_MATCH' => 'If-Match',
          'HTTP_IF_NONE_MATCH' => 'If-None-Match', 'HTTP_USER_AGENT' => 'User-Agent', 'HTTP_ACCEPT' => 'Accept'] as $k => $n) {
  if (!empty($_SERVER[$k])) $cab[] = $n . ': ' . $_SERVER[$k];
}
if (empty($_SERVER['HTTP_AUTHORIZATION']) && !empty($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) $cab[] = 'Authorization: ' . $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
$host = isset($_SERVER['HTTP_HOST']) ? $_SERVER['HTTP_HOST'] : '';
$cab[] = 'X-Forwarded-Host: ' . $host;
if (!empty($_SERVER['REMOTE_ADDR'])) $cab[] = 'X-Forwarded-For: ' . $_SERVER['REMOTE_ADDR'];
$ch = curl_init($url);
curl_setopt_array($ch, [CURLOPT_CUSTOMREQUEST => $metodo, CURLOPT_HTTPHEADER => $cab, CURLOPT_RETURNTRANSFER => true,
  CURLOPT_HEADER => true, CURLOPT_FOLLOWLOCATION => false, CURLOPT_TIMEOUT => 60, CURLOPT_ENCODING => '']);
if (!in_array($metodo, ['GET', 'HEAD'])) curl_setopt($ch, CURLOPT_POSTFIELDS, file_get_contents('php://input'));
$res = curl_exec($ch);
if ($res === false) { http_response_code(502); header('Content-Type: application/json'); exit('{"error":"Servidor del boletín no disponible"}'); }
$tam = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
http_response_code(curl_getinfo($ch, CURLINFO_RESPONSE_CODE));
curl_close($ch);
$cuerpo = substr($res, $tam);
foreach (explode("\r\n", substr($res, 0, $tam)) as $l) {
  if (!preg_match('/^(Content-Type|Cache-Control|ETag|Location|Last-Modified|Set-Cookie):\s*(.*)$/i', $l, $m)) continue;
  $v = $m[2];
  if (strcasecmp($m[1], 'Location') === 0 && $host) $v = str_replace($ORIGEN, 'https://' . $host, $v);
  header($m[1] . ': ' . $v, strcasecmp($m[1], 'Set-Cookie') !== 0);
}
// La página de cada boletín (/boletin/N) es la web de aquí (la actual), con la vista previa para redes que prepara Netlify
if (strpos($ruta, 'boletin/') === 0 && is_file(__DIR__ . '/index.html') && stripos($cuerpo, '<html') !== false) {
  $local = file_get_contents(__DIR__ . '/index.html');
  if (preg_match('#<title>.*?</title>#s', $cuerpo, $t)) $local = preg_replace('#<title>.*?</title>#s', str_replace('$', '\\$', $t[0]), $local, 1);
  if (preg_match_all('#<meta (?:property|name)="(og:[a-z:_]+|twitter:[a-z:_]+|description)" content="[^"]*"\s*/?>#', $cuerpo, $ms, PREG_SET_ORDER)) {
    foreach ($ms as $m) {
      $patron = '#<meta (?:property|name)="' . preg_quote($m[1], '#') . '" content="[^"]*"\s*/?>#';
      $local = preg_match($patron, $local) ? preg_replace($patron, str_replace('$', '\\$', $m[0]), $local, 1) : $local;
    }
  }
  $cuerpo = $local;
}
echo $cuerpo;
