<?php
/* sitemap.xml del boletín: portada, secciones, cada boletín, cada colaboración y cada recomendación.
   Se genera al pedirlo, con los boletines publicados (y los textos preparados en importar.js). */
require __DIR__ . '/_privado.php';
header('Content-Type: application/xml; charset=utf-8');
header('Cache-Control: public, max-age=3600');
$base = 'https://boletin.movimientopatriam.es';
$e = fn($t) => htmlspecialchars((string)$t, ENT_XML1 | ENT_QUOTES, 'UTF-8');
[$c, $js] = pedir(origenBoletin() . '/boletines.js', ['Accept: application/javascript']);
$cfg = []; $bols = [];
if ($c === 200) {
  if (preg_match('/window\.PATRIAM_CONFIG\s*=\s*(\{.*?\});\s*\n/s', $js, $m)) $cfg = json_decode($m[1], true) ?: [];
  if (preg_match('/window\.BOLETINES\s*=\s*(\[.*\]);?\s*$/s', $js, $m)) $bols = json_decode(rtrim($m[1], "; \n"), true) ?: [];
}
$imp = @file_get_contents(__DIR__ . '/importar.js') ?: '';
$importar = preg_match('/window\.PATRIAM_IMPORTAR\s*=\s*(\[.*?\]);/s', $imp, $m) ? (json_decode($m[1], true) ?: []) : [];
$recomendar = preg_match('/window\.PATRIAM_RECOMENDAR\s*=\s*(\[.*?\]);/s', $imp, $m) ? (json_decode($m[1], true) ?: []) : [];
$bols = array_values(array_filter($bols, fn($b) => empty($b['estado']) || $b['estado'] === 'aprobado'));
$hoy = gmdate('Y-m-d');
$numeros = array_map(fn($b) => (int)($b['numero'] ?? 0), $bols);
$urls = [['/', $hoy, 'weekly', '1.0', '']];
foreach (['noticias', 'historia', 'sociedad', 'criterio', 'podcasts', 'libros', 'peliculas', 'boletines', 'colaboraciones', 'iniciativas'] as $s) $urls[] = ['/' . $s, $hoy, 'weekly', '0.7', ''];
$vistos = [];
foreach ($bols as $b) {
  $f = substr($b['fecha'] ?? $hoy, 0, 10);
  $urls[] = ['/boletin/' . (int)$b['numero'], $f, 'monthly', '0.8', ''];
  foreach ($b['colaboraciones'] ?? [] as $col) if (!empty($col['id']) && !empty($col['titulo']) && empty($vistos[$col['id']])) { $vistos[$col['id']] = 1; $urls[] = ['/colaboracion/' . rawurlencode($col['id']), $f, 'monthly', '0.8', $col['imagen'] ?? '']; }
  foreach ($b['recomendados'] ?? [] as $id) if (empty($vistos['r' . $id])) { $vistos['r' . $id] = 1; $urls[] = ['/ver/' . rawurlencode($id), $f, 'monthly', '0.6', '']; }
}
foreach ($importar as $col) {
  if (empty($col['id']) || !empty($vistos[$col['id']])) continue;
  if (!empty($col['numero']) && !in_array((int)$col['numero'], $numeros, true)) continue;   // aún no ha salido su boletín
  $vistos[$col['id']] = 1; $urls[] = ['/colaboracion/' . rawurlencode($col['id']), $hoy, 'monthly', '0.8', $col['imagen'] ?? ''];
}
foreach ($recomendar as $x) {
  if (empty($x['id']) || !empty($vistos['r' . $x['id']])) continue;
  if (!empty($x['numero']) && !in_array((int)$x['numero'], $numeros, true)) continue;
  $vistos['r' . $x['id']] = 1; $urls[] = ['/ver/' . rawurlencode($x['id']), $hoy, 'monthly', '0.6', $x['imagen'] ?? ''];
}
echo '<?xml version="1.0" encoding="UTF-8"?>' . "\n" . '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">' . "\n";
foreach ($urls as [$u, $f, $cf, $pr, $img]) {
  echo '  <url><loc>' . $e($base . $u) . '</loc><lastmod>' . $e($f) . '</lastmod><changefreq>' . $cf . '</changefreq><priority>' . $pr . '</priority>';
  if ($img && preg_match('#^https?://#', $img)) echo '<image:image><image:loc>' . $e($img) . '</image:loc></image:image>';
  echo "</url>\n";
}
echo "</urlset>\n";
