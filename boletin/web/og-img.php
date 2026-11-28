<?php
/* La imagen de la tarjeta para compartir (WhatsApp, X, Facebook…), como la de un periódico digital:
   la foto de la pieza a 1200×630 con la banda de PATRIAM («Lo que hay que saber») abajo.
   /og-img.php?u=<foto>&f=<firma>: solo vale con la firma que pone pagina.php (no es un proxy abierto).
   Se guarda hecha en la carpeta privada (og/); si la foto no se puede bajar, sale la tarjeta del boletín. */
require_once __DIR__ . '/_privado.php';

function og_clave() {
  $f = privado() . '/og-clave.txt';
  if (!is_file($f)) @file_put_contents($f, bin2hex(random_bytes(24)), LOCK_EX);
  return trim((string)@file_get_contents($f));
}
function og_firma($u) { return substr(hash_hmac('sha256', (string)$u, og_clave()), 0, 20); }
if (basename($_SERVER['SCRIPT_FILENAME'] ?? '') !== basename(__FILE__)) return;   // incluido desde pagina.php: solo las funciones

function og_reserva() { header('Location: /compartir.jpg?v=2', true, 302); exit; }
$u = (string)($_GET['u'] ?? '');
if (!preg_match('#^https?://#i', $u) || !hash_equals(og_firma($u), (string)($_GET['f'] ?? ''))) og_reserva();

$dir = privado() . '/og'; @mkdir($dir, 0750, true);
$cache = $dir . '/' . sha1($u) . '.jpg';
if (!is_file($cache)) {
  // la foto: las nuestras se leen del disco; las de los medios se bajan
  $datos = '';
  if (preg_match('#^https://boletin\.movimientopatriam\.es/([A-Za-z0-9_./-]+\.(jpe?g|png|gif|webp))(\?.*)?$#i', $u, $m) && strpos($m[1], '..') === false && is_file(__DIR__ . '/' . $m[1]))
    $datos = file_get_contents(__DIR__ . '/' . $m[1]);
  else {
    $ch = curl_init($u);
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_FOLLOWLOCATION => true, CURLOPT_MAXREDIRS => 3, CURLOPT_TIMEOUT => 15,
      CURLOPT_USERAGENT => 'Mozilla/5.0 (compatible; PATRIAM-boletin)', CURLOPT_PROTOCOLS => CURLPROTO_HTTP | CURLPROTO_HTTPS]);
    $datos = (string)curl_exec($ch);
    $ok = curl_getinfo($ch, CURLINFO_RESPONSE_CODE) === 200 && strlen($datos) < 12e6;
    curl_close($ch);
    if (!$ok) $datos = '';
  }
  $foto = $datos !== '' ? @imagecreatefromstring($datos) : false;
  if (!$foto) og_reserva();
  // recorte a 1200×630 por el centro (un poco hacia arriba, donde suelen ir las caras)
  $W = 1200; $H = 630; $sw = imagesx($foto); $sh = imagesy($foto);
  $esc = max($W / $sw, $H / $sh); $cw = (int)round($W / $esc); $chh = (int)round($H / $esc);
  $sx = (int)(($sw - $cw) / 2); $sy = (int)max(0, ($sh - $chh) / 3);
  $lienzo = imagecreatetruecolor($W, $H);
  imagecopyresampled($lienzo, $foto, 0, 0, $sx, $sy, $W, $H, $cw, $chh);
  $banda = @imagecreatefrompng(__DIR__ . '/og-banda.png');
  if ($banda) { imagealphablending($lienzo, true); imagecopy($lienzo, $banda, 0, 0, 0, 0, $W, $H); }
  imagejpeg($lienzo, $cache . '.tmp', 84); @rename($cache . '.tmp', $cache);
}
header('Content-Type: image/jpeg');
header('Cache-Control: public, max-age=604800');
readfile($cache);
