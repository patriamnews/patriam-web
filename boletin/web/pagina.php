<?php
/* Cada dirección del boletín con su propia tarjeta para compartir, como un periódico digital.
   WhatsApp, X, Facebook o Telegram no ejecutan JavaScript: leen las etiquetas og: que manda el servidor.
   Aquí se sirve index.html con las etiquetas de la pieza que se comparte:
   - /boletin/N            → la tarjeta del boletín (compartir.jpg) con su número, fecha y editorial
   - /editorial/<boletín>  → la imagen, el título y el arranque de la editorial
   - /colaboracion/<id>    → la imagen, el título y la entradilla del artículo
   - /articulo/<id>        → lo mismo (dirección corta para redes)
   - /leer/<boletín>/<n>   → la noticia comentada, con su foto
   - /ver/<id>             → la recomendación (libro, película, podcast)
   El resto, la tarjeta general. Si algo falla, sale index.html tal cual. */
require_once __DIR__ . '/_privado.php';
require_once __DIR__ . '/og-img.php';   // og_firma()
const WEB_OG = 'https://boletin.movimientopatriam.es';

function og_e($x) { return htmlspecialchars((string)$x, ENT_QUOTES, 'UTF-8'); }
function og_plano($t) {
  $t = preg_replace('/\[([^\]]*)\]\([^)]*\)/u', '$1', (string)$t);
  return trim(preg_replace('/\s+/u', ' ', str_replace(['**', '*', '## ', '> ', '_'], '', $t)));
}
function og_corto($t, $n = 200) {
  $t = og_plano($t);
  if (mb_strlen($t) <= $n) return $t;
  return rtrim(preg_replace('/\s+\S*$/u', '', mb_substr($t, 0, $n - 1)), ' ,.;:') . '…';
}
function og_primer($t) { foreach (preg_split('/\n\s*\n/u', (string)$t) as $p) if (trim(og_plano($p)) !== '') return $p; return ''; }
function og_img($u) {
  $u = trim((string)$u);
  if ($u === '') return '';
  if (preg_match('#^https?://#i', $u)) return $u;
  return WEB_OG . '/' . ltrim($u, '/');
}
function og_js($fichero, $nombre) {
  $t = @file_get_contents($fichero) ?: '';
  if (!preg_match('/window\.' . $nombre . '\s*=\s*(\[.*?\]|\{.*?\});\s*(\n|$)/s', $t, $m)) return [];
  return json_decode($m[1], true) ?: [];
}
function og_fecha($f) {
  $m = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  $t = strtotime((string)$f); if (!$t) return '';
  return (int)date('j', $t) . ' de ' . $m[(int)date('n', $t) - 1] . ' de ' . date('Y', $t);
}

/* Todos los boletines con sus piezas: los del repositorio + lo aprobado en Publicar + lo preparado en importar.js */
function og_boletines() {
  static $L = null; if ($L !== null) return $L;
  $L = [];
  foreach (og_js(dirname(__DIR__) . '/datos/boletines.js', 'BOLETINES') as $b) {
    if (!empty($b['estado']) && $b['estado'] !== 'aprobado') continue;
    $L[(int)$b['numero']] = $b;
  }
  $ap = @json_decode(@file_get_contents(privado() . '/aportaciones.json'), true) ?: [];
  $hoy = (new DateTime('now', new DateTimeZone('Europe/Madrid')))->format('Y-m-d');
  foreach ($ap['boletines'] ?? [] as $nb) {
    $n = (int)$nb['numero'];
    if (!isset($L[$n])) $L[$n] = ['id' => 'boletin-' . $n, 'numero' => $n, 'fecha' => $nb['fecha'] ?? '', 'editorial' => [], 'noticias' => [], 'colaboraciones' => []];
  }
  $cambios = $ap['cambios'] ?? [];
  foreach (og_js(__DIR__ . '/importar.js', 'PATRIAM_IMPORTAR') as $x) {
    $c = $cambios['imp-' . ($x['id'] ?? '')] ?? [];
    if (!empty($c['quitado'])) continue;
    if (!empty($c['datos'])) $x = array_merge($x, $c['datos']);
    $n = (int)($x['numero'] ?? 0);
    if ($n && isset($L[$n])) $L[$n]['colaboraciones'][] = $x;
  }
  foreach ($ap['items'] ?? [] as $it) {
    if (($it['estado'] ?? '') !== 'aprobado') continue;
    $n = (int)($it['numero'] ?? 0); if (!isset($L[$n])) continue;
    $d = ($it['datos'] ?? []) + ['id' => $it['id']]; $d['id'] = $it['id'];
    if ($it['tipo'] === 'editorial') $L[$n]['editorial'] = $d;
    elseif ($it['tipo'] === 'firma') $L[$n]['colaboraciones'][] = $d;
    elseif ($it['tipo'] === 'noticia') $L[$n]['noticias'][] = $d;
  }
  // a los lectores no se les enseña un boletín que todavía no ha salido
  foreach ($L as $n => $b) if (!empty($b['fecha']) && substr($b['fecha'], 0, 10) > $hoy) unset($L[$n]);
  krsort($L);
  return $L;
}
function og_boletin($clave) {
  foreach (og_boletines() as $b) if ((string)$b['id'] === (string)$clave || (string)$b['numero'] === (string)$clave) return $b;
  return null;
}
function og_articulo($id) {
  $id = preg_replace('/^imp-/', '', (string)$id);
  foreach (og_boletines() as $b) foreach ($b['colaboraciones'] ?? [] as $c)
    if (($c['id'] ?? '') === $id || ($c['id'] ?? '') === 'imp-' . $id) return [$c, $b];
  foreach (og_boletines() as $b) if (($b['editorial']['id'] ?? '') === $id) return [['_editorial' => true] + $b['editorial'], $b];
  return [null, null];
}

/* La tarjeta que corresponde a una dirección */
function og_tarjeta($ruta) {
  $p = array_values(array_filter(explode('/', trim($ruta, '/')), 'strlen'));
  $p = array_map('rawurldecode', $p);
  $t = null;
  $tipo = $p[0] ?? '';
  if ($tipo === 'boletin' && isset($p[1]) && ($b = og_boletin($p[1]))) {
    $ed = $b['editorial'] ?? [];
    $t = ['titulo' => 'Boletín Nº ' . sprintf('%02d', $b['numero']) . ' · ' . og_fecha($b['fecha'] ?? '') . ' · Lo que hay que saber, con criterio',
      'desc' => !empty($ed['texto']) ? 'Editorial: ' . og_corto(($ed['titulo'] && $ed['titulo'] !== 'Editorial' ? $ed['titulo'] . '. ' : '') . og_primer($ed['texto']), 180) : 'El boletín de PATRIAM.',
      'img' => WEB_OG . '/compartir.jpg?v=2', 'ancho' => 800, 'alto' => 800, 'tipo' => 'website'];
  } elseif ($tipo === 'editorial' && isset($p[1]) && ($b = og_boletin($p[1])) && !empty($b['editorial']['texto'])) {
    $ed = $b['editorial'];
    $pars = array_values(array_filter(preg_split('/\n\s*\n/u', (string)$ed['texto']), fn($x) => og_plano($x) !== ''));
    $propio = ($ed['titulo'] ?? '') && $ed['titulo'] !== 'Editorial';
    $tit = $propio ? $ed['titulo'] : og_corto($pars[0] ?? '', 90);
    $desc = $propio ? ($pars[0] ?? '') : ($pars[1] ?? '');   // si el título es la primera frase, la descripción sigue con lo siguiente
    $t = ['titulo' => $tit . ' · Editorial de PATRIAM', 'desc' => og_corto($desc, 200) . (!empty($ed['firma']) ? ' — ' . $ed['firma'] : ''),
      'img' => og_img($ed['imagen'] ?? ''), 'tipo' => 'article'];
  } elseif (in_array($tipo, ['colaboracion', 'articulo'], true) && isset($p[1])) {
    [$c, $b] = og_articulo($p[1]);
    if ($c && !empty($c['_editorial'])) return og_tarjeta('/editorial/' . $b['id']);
    if ($c) $t = ['titulo' => $c['titulo'] ?? 'PATRIAM', 'desc' => og_corto(($c['entradilla'] ?? '') ?: og_primer($c['texto'] ?? ''), 200) . (!empty($c['autor']) ? ' — ' . $c['autor'] : ''),
      'img' => og_img($c['imagen'] ?? ''), 'tipo' => 'article'];
  } elseif ($tipo === 'leer' && isset($p[1], $p[2]) && ($b = og_boletin($p[1]))) {
    $n = null;
    foreach ($b['noticias'] ?? [] as $x) if (($x['id'] ?? '') !== '' && $x['id'] === $p[2]) $n = $x;
    if (!$n && ctype_digit($p[2])) $n = ($b['noticias'] ?? [])[(int)$p[2]] ?? null;
    if ($n) $t = ['titulo' => $n['titular'] ?? 'Noticia', 'desc' => og_corto(($n['resumen'] ?? '') ?: ($n['comentario'] ?? ''), 200) . (!empty($n['medio']) ? ' (' . $n['medio'] . ')' : ''),
      'img' => og_img($n['imagen'] ?? ''), 'tipo' => 'article'];
  } elseif ($tipo === 'ver' && isset($p[1])) {
    $cfg = og_js(dirname(__DIR__) . '/datos/boletines.js', 'PATRIAM_CONFIG');
    $bib = $cfg['biblioteca'] ?? [];
    $ap = @json_decode(@file_get_contents(privado() . '/aportaciones.json'), true) ?: [];
    foreach ($ap['items'] ?? [] as $it) if (($it['tipo'] ?? '') === 'recomendacion' && ($it['estado'] ?? '') === 'aprobado') $bib[] = ['id' => $it['id']] + ($it['datos'] ?? []);
    foreach (og_js(__DIR__ . '/importar.js', 'PATRIAM_RECOMENDAR') as $x) $bib[] = $x;
    foreach ($bib as $x) if (($x['id'] ?? '') === $p[1]) {
      $t = ['titulo' => ($x['titulo'] ?? '') . (!empty($x['tipo']) ? ' (' . mb_strtolower($x['tipo']) . ')' : '') . ' · Recomendación de PATRIAM',
        'desc' => og_corto(($x['comentario'] ?? '') ?: ($x['descripcion'] ?? ''), 200), 'img' => og_img($x['imagen'] ?? ''), 'tipo' => 'article'];
      break;
    }
  }
  if ($t && empty($t['img'])) { $t['img'] = WEB_OG . '/compartir.jpg?v=2'; $t['ancho'] = 800; $t['alto'] = 800; }
  // como un periódico: la foto de la pieza a 1200×630, con la banda de PATRIAM (og-img.php)
  elseif ($t && empty($t['ancho'])) { $t['img'] = WEB_OG . '/og-img.php?u=' . rawurlencode($t['img']) . '&f=' . og_firma($t['img']); $t['ancho'] = 1200; $t['alto'] = 630; }
  return $t;
}

/* ---------- servir ---------- */
$ruta = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
// /articulo/<id> es la dirección corta de redes: lleva a la dirección de la pieza (que da la misma tarjeta)
if (preg_match('#^/articulo/([A-Za-z0-9_-]+)/?$#', $ruta, $m)) {
  try { [$c, $b] = og_articulo($m[1]); } catch (Throwable $e) { $c = null; }
  $dest = !$c ? '/' : (!empty($c['_editorial']) ? '/editorial/' . rawurlencode($b['id']) : '/colaboracion/' . rawurlencode($c['id']));
  $q = $_SERVER['QUERY_STRING'] ?? '';
  header('Location: ' . $dest . ($q ? '?' . $q : ''), true, 301); exit;
}
$html = @file_get_contents(__DIR__ . '/index.html');
header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-cache, must-revalidate');
try { $t = og_tarjeta($ruta); } catch (Throwable $e) { $t = null; }
if (!$t || !$html) { echo $html; exit; }

$url = WEB_OG . ($t['destino'] ?? $ruta);
$tit = $t['titulo']; $desc = $t['desc'];
$grande = empty($t['ancho']) || $t['ancho'] > $t['alto'];
$etiquetas = '<title>' . og_e($tit) . '</title>' . "\n" .
  '<meta name="description" content="' . og_e($desc) . '">' . "\n" .
  '<link rel="canonical" href="' . og_e($url) . '">' . "\n" .
  '<meta property="og:type" content="' . og_e($t['tipo']) . '">' . "\n" .
  '<meta property="og:site_name" content="PATRIAM · Lo que hay que saber">' . "\n" .
  '<meta property="og:locale" content="es_ES">' . "\n" .
  '<meta property="og:title" content="' . og_e($tit) . '">' . "\n" .
  '<meta property="og:description" content="' . og_e($desc) . '">' . "\n" .
  '<meta property="og:url" content="' . og_e($url) . '">' . "\n" .
  '<meta property="og:image" content="' . og_e($t['img']) . '">' . "\n" .
  (!empty($t['ancho']) ? '<meta property="og:image:width" content="' . (int)$t['ancho'] . '">' . "\n" . '<meta property="og:image:height" content="' . (int)$t['alto'] . '">' . "\n" : '') .
  '<meta name="twitter:card" content="' . ($grande ? 'summary_large_image' : 'summary') . '">' . "\n" .
  '<meta name="twitter:site" content="@patriam_es">' . "\n" .
  '<meta name="twitter:title" content="' . og_e($tit) . '">' . "\n" .
  '<meta name="twitter:description" content="' . og_e($desc) . '">' . "\n" .
  '<meta name="twitter:image" content="' . og_e($t['img']) . '">' . "\n";
// fuera las etiquetas generales de index.html y dentro las de esta pieza
$html = preg_replace('#<title>.*?</title>\s*#s', '', $html, 1);
$html = preg_replace('#<meta (name="description"|property="og:[^"]+"|name="twitter:[^"]+")[^>]*>\s*#', '', $html);
$html = preg_replace('#<link rel="canonical"[^>]*>\s*#', '', $html);
$html = preg_replace('#(<meta name="viewport"[^>]*>\s*)#', '$1' . $etiquetas, $html, 1);
echo $html;
