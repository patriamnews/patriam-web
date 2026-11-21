<?php
/* Enlace para compartir un artículo: boletin.movimientopatriam.es/articulo/<id>
   Sirve la tarjeta (título, entradilla e imagen del artículo) a WhatsApp, X, Facebook y LinkedIn,
   y a las personas las lleva al artículo dentro del boletín. Los textos salen de importar.js. */
const WEB = 'https://boletin.movimientopatriam.es';
function e($x) { return htmlspecialchars((string)$x, ENT_QUOTES, 'UTF-8'); }
function plano($t) {
  $t = preg_replace('/\[([^\]]*)\]\([^)]*\)/u', '$1', (string)$t);
  return trim(preg_replace('/\s+/u', ' ', str_replace(['**', '*', '## ', '> '], '', $t)));
}
$id = preg_replace('/[^A-Za-z0-9_-]/', '', $_GET['id'] ?? '');
$s = @file_get_contents(__DIR__ . '/importar.js') ?: '';
$art = null;
if ($id && preg_match('/window\.PATRIAM_IMPORTAR = (\[.*?\n\]);/s', $s, $m)) {
  foreach (json_decode($m[1], true) ?: [] as $x) if (($x['id'] ?? '') === $id) { $art = $x; break; }
}
$destino = WEB . '/' . ($id ? '#/colaboracion/' . rawurlencode($id) : '');   // también las firmas escritas en el editor
$titulo = $art ? $art['titulo'] : 'Lo que hay que saber: con criterio · PATRIAM';
$desc = $art ? plano($art['entradilla'] ?? '') : 'El boletín de PATRIAM.';
if ($art && !empty($art['autor'])) $desc = $art['autor'] . ' · ' . $desc;
$img = ($art && preg_match('#^https://#', $art['imagen'] ?? '')) ? $art['imagen'] : WEB . '/compartir.jpg?v=2';
$url = WEB . '/articulo/' . rawurlencode($id);
header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-cache, must-revalidate');
?><!doctype html>
<html lang="es"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title><?= e($titulo) ?> · PATRIAM</title>
<meta name="description" content="<?= e($desc) ?>">
<link rel="canonical" href="<?= e($url) ?>">
<meta property="og:type" content="article"><meta property="og:site_name" content="PATRIAM · Lo que hay que saber"><meta property="og:locale" content="es_ES">
<meta property="og:title" content="<?= e($titulo) ?>"><meta property="og:description" content="<?= e($desc) ?>">
<meta property="og:url" content="<?= e($url) ?>"><meta property="og:image" content="<?= e($img) ?>">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:site" content="@patriam_es">
<meta name="twitter:title" content="<?= e($titulo) ?>"><meta name="twitter:description" content="<?= e($desc) ?>"><meta name="twitter:image" content="<?= e($img) ?>">
<meta http-equiv="refresh" content="0;url=<?= e($destino) ?>">
<link rel="icon" href="/icono-192.png">
</head><body style="font-family:Georgia,serif;background:#faf5ec;color:#2a211d;text-align:center;padding:40px 16px">
<p><a href="<?= e($destino) ?>" style="color:#7b1c2c">Abrir «<?= e($titulo) ?>»</a></p>
<script>location.replace(<?= json_encode($destino) ?>);</script>
</body></html>
