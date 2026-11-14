<?php
/* «Publicar» (publicar.movimientopatriam.es) → boletín, paso a paso y sin el editor.
   El equipo entra con su usuario de la web. Lo que sube va al boletín abierto:
   noticias, artículos de firma, recomendaciones y la editorial.
   Lo de quien aprueba (Carlos, Isabel) sale directamente; lo de los demás espera su visto bueno.
   El boletín (index.html) y el editor lo leen de /aportaciones.js (este mismo archivo, accion=js).
   Datos en la carpeta privada del servidor: aportaciones.json */
require __DIR__ . '/_privado.php';
permitirPublicar();
$acc = $_GET['accion'] ?? '';
$FICHERO = privado() . '/aportaciones.json';
$zona = new DateTimeZone('Europe/Madrid');
$hoy = (new DateTime('now', $zona))->format('Y-m-d');

function leerAp($f) { $d = is_file($f) ? json_decode(file_get_contents($f), true) : null; return is_array($d) ? $d + ['boletines' => [], 'items' => []] : ['boletines' => [], 'items' => []]; }
function guardarAp($f, $d) { $t = $f . '.tmp'; file_put_contents($t, json_encode($d, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), LOCK_EX); rename($t, $f); }
function limpio($t, $n = 20000) { return mb_substr(trim(str_replace("\r", '', (string)$t)), 0, $n); }
function url_ok($u) { $u = trim((string)$u); return preg_match('#^https?://#i', $u) ? mb_substr($u, 0, 1000) : ''; }

/* ---------- público: lo aprobado y los boletines abiertos, para el boletín ---------- */
require_once __DIR__ . '/_previa.php';
require_once __DIR__ . '/boletin-envio.php';   // beViralidad, bePrincipal, boletinEnviarYa, boletinEstadoEnvio
if ($acc === 'js') {
  header('Content-Type: application/javascript; charset=utf-8');
  header('Cache-Control: no-cache, max-age=0');
  $d = leerAp($FICHERO);
  // Vista previa del equipo (previa.php, con su clave): también lo pendiente de aprobar del número que se está viendo
  $pv = previaValida($d, $_GET['previa'] ?? '', true);
  $pvNum = $pv ? (int)$pv['numero'] : 0;
  $items = array_values(array_filter($d['items'], fn($x) => ($x['estado'] ?? '') === 'aprobado' || ($pvNum && ($x['estado'] ?? '') === 'pendiente' && (int)($x['numero'] ?? 0) === $pvNum)));
  $items = array_map(fn($x) => ['id' => $x['id'], 'tipo' => $x['tipo'], 'numero' => $x['numero'], 'datos' => array_diff_key($x['datos'], ['cv' => 1, 'imagenes' => 1]), 'creado' => $x['creado'] ?? ''], $items);
  // Cambios a lo preparado en importar.js: datos aprobados y piezas quitadas (lo pendiente no sale)
  $cambios = [];
  foreach ($d['cambios'] ?? [] as $id => $c) { $o = []; if (!empty($c['datos']) && !empty($c['aprobado'])) $o['datos'] = $c['datos']; if (!empty($c['quitado'])) $o['quitado'] = true;
    if ($pvNum && !empty($c['propuesta'])) $o['datos'] = $c['propuesta'];   // en la vista previa, el último cambio aunque esté pendiente
    if ($o) $cambios[$id] = $o; }
  // Lo preparado para un boletín que todavía no ha salido no se ve hasta que alguien lo aprueba
  foreach ($d['boletines'] as $b) if (($b['fecha'] ?? '') >= $hoy) foreach (piezasImportar() as $x)
    if ((int)($x['numero'] ?? 0) === (int)$b['numero'] && (int)$b['numero'] !== $pvNum && empty($d['cambios'][$x['id']]['aprobado'])) $cambios[$x['id']] = ['quitado' => true, 'sinAprobar' => true];
  // La pieza principal de cada número: la elegida en Publicar o la que propone el envío (el artículo con más tirón)
  $principal = $d['principal'] ?? [];
  foreach ($d['boletines'] as $b) { $n = (string)(int)$b['numero']; if (!empty($principal[$n])) continue;
    $pz = bePiezas($n); $k = $pz ? bePrincipal($n, $pz) : null; if ($k !== null) $principal[$n] = $pz[$k][2] ?? ''; }
  echo 'window.PATRIAM_APORTACIONES = ' . json_encode(['boletines' => $d['boletines'], 'items' => $items, 'cambios' => (object)$cambios, 'previa' => $pvNum ?: null, 'principal' => (object)array_filter($principal)], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . ";\n";
  exit;
}

/* ---------- artículos que llegan por correo (hola@movimientopatriam.com, asunto «ARTICULO Nombre») ---------- */
require __DIR__ . '/_correo.php';
function numeroDestino($d, $hoy) {
  $bs = boletinesTodos($d); $max = 0;
  foreach ($bs as $b) { if ($b['fecha'] >= $hoy) return (int)$b['numero']; $max = max($max, (int)$b['numero']); }
  return $max + 1;   // aún no está abierto: entra en el siguiente, y se ve en cuanto se abra
}
function revisarCorreo($FICHERO, $hoy, $forzar = false) {
  return revisarCorreoArticulos(function ($datos, $info) use ($FICHERO, $hoy) {
    $d = leerAp($FICHERO);
    $id = 'ap-' . bin2hex(random_bytes(5));
    $d['items'][] = ['id' => $id, 'tipo' => 'firma', 'numero' => numeroDestino($d, $hoy), 'datos' => $datos, 'estado' => 'pendiente',
      'autor' => 'Correo · ' . ($datos['autor'] ?? ''), 'autor_id' => 'correo', 'origen' => 'correo', 'remite' => $info['remite'], 'asunto' => $info['asunto'],
      'creado' => gmdate('c'), 'aprobado_por' => ''];
    guardarAp($FICHERO, $d);
    return $id;
  }, $forzar);
}
/* Artículos ya publicados (o aprobados) que todavía no tienen imagen: los lee cada mañana la tarea que crea las ilustraciones.
   Solo lo que ya es público (aprobado o del editor); lo pendiente no sale aquí. */
if ($acc === 'sin-imagen') {
  header('Access-Control-Allow-Origin: *');
  $auto = @file_get_contents(__DIR__ . '/imagenes-auto.js') ?: '';
  $hechas = preg_match('/=\s*(\{.*\})\s*;?\s*$/s', $auto, $m) ? (json_decode($m[1], true) ?: []) : [];
  $res = [];
  $corto = fn($t, $n) => mb_substr(trim(preg_replace('/\s+/u', ' ', str_replace(['**', '*', '## ', '> '], '', (string)$t))), 0, $n);
  $mete = function ($id, $c, $num) use (&$res, $hechas, $corto) {
    if (!$id || !empty($c['imagen']) || isset($hechas[$id]) || empty($c['titulo'])) return;
    $res[$id] = ['id' => $id, 'numero' => $num, 'titulo' => $c['titulo'], 'autor' => $c['autor'] ?? '', 'seccion' => $c['seccion'] ?? '',
      'entradilla' => $corto($c['entradilla'] ?? '', 400), 'texto' => $corto($c['texto'] ?? '', 1800)];
  };
  foreach (leerAp($FICHERO)['items'] as $x) if (($x['estado'] ?? '') === 'aprobado' && ($x['tipo'] ?? '') === 'firma') $mete($x['id'], $x['datos'], $x['numero']);
  [$c, $js] = pedir(origenBoletin() . '/boletines.js', ['Accept: application/javascript']);
  if ($c === 200 && preg_match('/window\.BOLETINES\s*=\s*(\[.*\]);?\s*$/s', $js, $m))
    foreach (json_decode(rtrim($m[1], "; \n"), true) ?: [] as $b) foreach ($b['colaboraciones'] ?? [] as $col) $mete($col['id'] ?? '', $col, $b['numero'] ?? null);
  salir(['articulos' => array_values($res)]);
}

// Lo llama el propio boletín al abrirse (y puede llamarlo una tarea programada de Hostinger): como mucho una vez cada 5 minutos
if ($acc === 'correo-auto') { $r = revisarCorreo($FICHERO, $hoy); salir(['ok' => $r['ok'], 'nuevos' => count($r['nuevos'] ?? [])]); }

$yo = comprobarEquipoWeb();
if ($acc === 'estado') revisarCorreo($FICHERO, $hoy);
if ($acc === 'correo') { if (!$yo['puedeAprobar']) salir(['error' => 'Solo pueden revisar el correo Carlos e Isabel.'], 403); salir(revisarCorreo($FICHERO, $hoy, true)); }
$d = leerAp($FICHERO);

/* boletines que ya existen en el boletín (Netlify) + los abiertos desde aquí */
function boletinesTodos($d) {
  $lista = [];
  [$c, $js] = pedir(origenBoletin() . '/boletines.js', ['Accept: application/javascript']);
  if ($c === 200 && preg_match('/window\.BOLETINES\s*=\s*(\[.*\]);?\s*$/s', $js, $m)) {
    foreach (json_decode(rtrim($m[1], "; \n"), true) ?: [] as $b) {
      $lista[(int)$b['numero']] = ['numero' => (int)$b['numero'], 'fecha' => substr($b['fecha'] ?? '', 0, 10), 'origen' => 'editor'];
      $GLOBALS['BOLETIN_EDITOR'][(int)$b['numero']] = $b;   // contenido completo (para «Lo que ya hay»)
    }
  }
  foreach ($d['boletines'] as $b) if (empty($lista[(int)$b['numero']])) $lista[(int)$b['numero']] = ['numero' => (int)$b['numero'], 'fecha' => $b['fecha'], 'origen' => 'publicar'];
  ksort($lista);
  return array_values($lista);
}
/* Lo que tiene el boletín nº N en el editor (lo aprobado): para enseñarlo junto a lo subido desde Publicar */
function contenidoEditor($num) {
  $b = $GLOBALS['BOLETIN_EDITOR'][$num] ?? null;
  if (!$b) return ['aprobado' => false, 'items' => []];
  $t = fn($x) => trim((string)$x);
  $res = [];
  if (is_array($b['editorial'] ?? null) && $t($b['editorial']['titulo'] ?? '')) $res[] = ['tipo' => 'Editorial', 'titulo' => $t($b['editorial']['titulo']), 'firma' => $t($b['editorial']['firma'] ?? ($b['editorial']['autor'] ?? ''))];
  foreach ((array)($b['noticias'] ?? []) as $x) if ($t($x['titular'] ?? '')) $res[] = ['tipo' => $t($x['seccion'] ?? '') ?: 'Noticia', 'titulo' => $t($x['titular']), 'firma' => $t($x['comenta'] ?? ''), 'medio' => $t($x['medio'] ?? '')];
  foreach ((array)($b['colaboraciones'] ?? []) as $x) if ($t($x['titulo'] ?? '')) $res[] = ['tipo' => 'Colaboración' . ($t($x['seccion'] ?? '') ? ' · ' . $t($x['seccion']) : ''), 'titulo' => $t($x['titulo']), 'firma' => $t($x['autor'] ?? '')];
  foreach ((array)($b['recomendados'] ?? []) as $x) if (is_array($x) && $t($x['titulo'] ?? '')) $res[] = ['tipo' => $t($x['tipo'] ?? '') ?: 'Recomendación', 'titulo' => $t($x['titulo']), 'firma' => $t($x['autor'] ?? '')];
  foreach ((array)($b['eventos'] ?? []) as $x) if ($t($x['titulo'] ?? '')) $res[] = ['tipo' => 'Agenda', 'titulo' => $t($x['titulo']), 'firma' => $t($x['fecha'] ?? '')];
  return ['aprobado' => true, 'items' => $res];
}
const MAX_ARTICULOS = 10;   // artículos de firma que pueden salir en cada número
function estado($d, $hoy, $yo) {
  $bs = boletinesTodos($d);
  $abierto = null; $ultimo = null;
  foreach ($bs as $b) { if ($b['fecha'] >= $hoy && !$abierto) $abierto = $b; if ($b['fecha'] < $hoy) $ultimo = $b; }
  $max = $bs ? end($bs) : ['numero' => 0, 'fecha' => $hoy];
  // el siguiente sale el viernes siguiente al último (o el próximo viernes si no hay ninguno)
  $base = new DateTime(max($max['fecha'] ?: $hoy, $hoy) . ' 12:00', new DateTimeZone('Europe/Madrid'));
  $sig = clone $base; $sig->modify(($max['fecha'] ?? '') >= $hoy ? '+7 days' : 'next friday');
  $siguiente = ['numero' => $max['numero'] + 1, 'fecha' => $sig->format('Y-m-d')];
  $num = $abierto ? $abierto['numero'] : null;
  $items = array_values(array_filter($d['items'], fn($x) => ($x['estado'] ?? '') !== 'borrado' && ($num === null || $x['numero'] === $num || ($x['estado'] ?? '') === 'pendiente')));
  $items = array_map(fn($x) => array_merge($x, ['datos' => array_diff_key($x['datos'] ?? [], ['cv' => 1]), 'tieneCv' => !empty($x['datos']['cv'])]) + ['mio' => ($x['autor_id'] ?? '') === $yo['id']], $items);
  if ($num) foreach (preparados($d, $num) as $x) $items[] = $x;
  // Imágenes: Isabel sube una o varias; elige quien subió el artículo (lo preparado y lo del correo, quien aprueba)
  foreach ($items as &$it) {
    $orig = esPreparado($it['id']) ? ((piezaPreparada($it['id']) ?? [])['datos']['imagen'] ?? '') : '';
    $ops = array_merge([$it['datos']['imagen'] ?? '', $orig], $it['datos']['imagenes'] ?? [], $d['cambios'][$it['id']]['imagenes'] ?? []);
    $it['imagenesOpciones'] = array_values(array_unique(array_filter($ops)));
    $sinDueno = ($it['origen'] ?? '') === 'preparado' || in_array($it['autor_id'] ?? '', ['', 'correo'], true);
    $it['puedoElegirImagen'] = $sinDueno ? (bool)$yo['puedeAprobar'] : (($it['autor_id'] ?? '') === $yo['id']);
  }
  unset($it);
  // Elegidos para aprobar al final (de todo lo pendiente) y tope de 10 artículos de firma por número
  $sel = $num ? array_values(array_filter($d['seleccion'][$num] ?? [], fn($id) => in_array($id, array_column($items, 'id'), true))) : [];
  $delEd = $num ? contenidoEditor($num) : null;
  $firmasAprob = count(array_filter($items, fn($x) => ($x['tipo'] ?? '') === 'firma' && ($x['estado'] ?? '') === 'aprobado' && (int)($x['numero'] ?? 0) === (int)$num))
    + count(array_filter($delEd['items'] ?? [], fn($x) => str_starts_with($x['tipo'] ?? '', 'Colaboración')));
  $firmasSel = count(array_filter($items, fn($x) => ($x['tipo'] ?? '') === 'firma' && ($x['estado'] ?? '') !== 'aprobado' && in_array($x['id'], $sel, true)));
  // La pieza principal (la que abre el boletín y el envío): la elegida o, si no, el artículo de PATRIAM con más tirón
  $princ = ''; $sug = ''; $max = -99;
  if ($num) {
    foreach ($items as $x) if (($x['tipo'] ?? '') === 'firma' && (int)($x['numero'] ?? 0) === (int)$num && ($v = beViralidad($x['datos'] ?? [])) > $max) { $max = $v; $sug = $x['id']; }
    $princ = $d['principal'][(string)$num] ?? '';
    if (!in_array($princ, array_column($items, 'id'), true)) $princ = '';
  }
  $activos = count(array_filter(susLeer(), fn($s) => ($s['estado'] ?? '') === 'activo'));
  return ['principal' => $princ ?: $sug, 'principalElegida' => (bool)$princ, 'principalSugerida' => $sug, 'envio' => $num ? boletinEstadoEnvio($num) : null, 'suscriptores' => $activos,
    'delEditor' => $delEd, 'seleccion' => $sel, 'maxArticulos' => MAX_ARTICULOS, 'articulosAprobados' => $firmasAprob, 'articulosElegidos' => $firmasSel, 'hoy' => $hoy, 'ultimo' => $ultimo, 'abierto' => $abierto, 'siguiente' => $siguiente, 'items' => $items, 'puedeAprobar' => $yo['puedeAprobar'], 'yo' => $yo['nombre'] ?? ''];
}

$cuerpo = json_decode(file_get_contents('php://input') ?: '{}', true) ?: [];

/* Lo preparado en importar.js para el nº N, con los cambios hechos desde Publicar, como un elemento más */
function preparados($d, $num) {
  $res = [];
  foreach (piezasImportar() as $x) {
    if ((int)($x['numero'] ?? 0) !== (int)$num) continue;
    $c = $d['cambios'][$x['id']] ?? [];
    if (!empty($c['quitado'])) continue;
    $datos = $c['datos'] ?? $x['datos'];
    $res[] = ['id' => $x['id'], 'tipo' => $x['tipo'], 'numero' => (int)$num, 'datos' => !empty($c['propuesta']) ? $c['propuesta'] : $datos,
      'estado' => (!empty($c['propuesta']) || empty($c['aprobado'])) ? 'pendiente' : 'aprobado', 'origen' => 'preparado', 'autor' => $datos['autor'] ?? ($datos['comenta'] ?? ''),
      'mio' => true, 'propuestaDe' => $c['propuestaDe'] ?? ''];
  }
  return $res;
}
/* Recámara preparada en _recamara.js (artículos, libros y películas que aún no van a ningún número).
   Se ve en la recámara con el mismo formato que lo guardado desde Publicar; al usarlo pasa al boletín abierto como pendiente. */
function piezasRecamara($d) {
  $t = @file_get_contents(__DIR__ . '/_recamara.js') ?: '';
  $L = preg_match('/window\.PATRIAM_RECAMARA\s*=\s*(\[.*\n\]);/s', $t, $m) ? (json_decode($m[1], true) ?: []) : [];
  $res = [];
  foreach ($L as $x) {
    $id = 'pre-' . ($x['id'] ?? ''); $c = $d['cambios'][$id] ?? [];
    if (!empty($c['quitado']) || !empty($c['usado'])) continue;
    $res[] = ['id' => $id, 'tipo' => $x['tipo'] ?? 'firma', 'numero' => null, 'datos' => $c['datos'] ?? ($x['datos'] ?? []), 'estado' => 'recamara',
      'origen' => 'preparado', 'autor' => $x['autor'] ?? '', 'autor_id' => '', 'creado' => $x['creado'] ?? '', 'aprobado_por' => ''];
  }
  return $res;
}
/* Aprueba una pieza (subida desde Publicar o preparada en importar.js) */
function aprobarPieza(&$d, $id, $yo) {
  if (preg_match('/^(imp|rec|fra)-/', (string)$id)) {
    $c = $d['cambios'][$id] ?? [];
    if (!empty($c['propuesta'])) $c['datos'] = $c['propuesta'];
    $c['aprobado'] = true; $c['aprobado_por'] = $yo['nombre'] ?? ''; unset($c['propuesta'], $c['propuestaDe']);
    $c['cambiado'] = gmdate('c'); $d['cambios'][$id] = $c; return;
  }
  foreach ($d['items'] as &$x) if ($x['id'] === $id && ($x['estado'] ?? '') === 'pendiente') { $x['estado'] = 'aprobado'; $x['aprobado_por'] = $yo['nombre'] ?? ''; $x['cambiado'] = gmdate('c'); }
  unset($x);
}
function esPreparado($id) { return (bool)preg_match('/^(imp|rec|fra)-/', (string)$id); }
function piezaPreparada($id) { foreach (piezasImportar() as $x) if ($x['id'] === $id) return $x; return null; }
/* Los datos de un formulario de Publicar, limpios según el tipo (igual que al subir) */
function datosLimpios($tipo, $x, $antes = []) {
  $t = fn($k, $n) => limpio($x[$k] ?? ($antes[$k] ?? ''), $n);
  $sec = in_array($x['seccion'] ?? ($antes['seccion'] ?? ''), ['Actualidad', 'Historia', 'Sociedad', 'Análisis'], true) ? ($x['seccion'] ?? $antes['seccion']) : ($antes['seccion'] ?? 'Actualidad');
  $u = fn($k) => url_ok($x[$k] ?? ($antes[$k] ?? ''));
  if ($tipo === 'noticia') return array_merge($antes, ['titular' => $t('titular', 300), 'url' => $u('url'), 'medio' => $t('medio', 80), 'imagen' => $u('imagen'), 'resumen' => $t('resumen', 2000), 'comentario' => $t('comentario', 2000), 'comenta' => limpio($x['firma'] ?? ($x['comenta'] ?? ($antes['comenta'] ?? '')), 80), 'seccion' => $sec]);
  if ($tipo === 'firma') return array_merge($antes, ['titulo' => $t('titulo', 300), 'entradilla' => $t('entradilla', 600), 'texto' => $t('texto', 60000), 'imagen' => $u('imagen'), 'autor' => limpio($x['firma'] ?? ($x['autor'] ?? ($antes['autor'] ?? '')), 80), 'cargo' => $t('cargo', 120), 'seccion' => $sec, 'tema' => $t('tema', 60)]);
  if ($tipo === 'recomendacion') return array_merge($antes, ['tipo' => $t('tipo', 40), 'titulo' => $t('titulo', 300), 'url' => $u('url'), 'imagen' => $u('imagen'), 'medio' => $t('medio', 160), 'descripcion' => $t('descripcion', 3000), 'comentario' => $t('comentario', 3000), 'critica' => $t('critica', 40000), 'comenta' => limpio($x['firma'] ?? ($x['comenta'] ?? ($antes['comenta'] ?? '')), 80)]);
  if ($tipo === 'editorial') return array_merge($antes, ['titulo' => $t('titulo', 300), 'texto' => $t('texto', 40000), 'firma' => $t('firma', 80), 'imagen' => $u('imagen')]);
  if ($tipo === 'frase') return array_merge($antes, ['frase' => trim($t('frase', 600), " \t\n\"«»“”"), 'autor' => limpio($x['autor'] ?? ($x['firma'] ?? ($antes['autor'] ?? '')), 120)]);
  if ($tipo === 'espana') return array_merge($antes, ['titulo' => limpio($x['titular'] ?? ($x['titulo'] ?? ($antes['titulo'] ?? '')), 300), 'url' => $u('url'), 'medio' => $t('medio', 80), 'imagen' => $u('imagen'), 'resumen' => $t('resumen', 1200)]);
  return $antes;
}

/* Lo preparado en importar.js (artículos y recomendaciones), en el mismo formato que lo subido desde Publicar */
function piezasImportar() {
  $t = @file_get_contents(__DIR__ . '/importar.js') ?: ''; $res = [];
  $lee = function ($nombre) use ($t) { return preg_match('/window\.' . $nombre . '\s*=\s*(\[.*?\n\]);/s', $t, $m) ? (json_decode($m[1], true) ?: []) : []; };
  foreach ($lee('PATRIAM_IMPORTAR') as $x) $res[] = ['id' => 'imp-' . ($x['id'] ?? ''), 'tipo' => 'firma', 'numero' => $x['numero'] ?? null,
    'datos' => ['titulo' => $x['titulo'] ?? '', 'entradilla' => $x['entradilla'] ?? '', 'texto' => $x['texto'] ?? '', 'imagen' => $x['imagen'] ?? '', 'autor' => $x['autor'] ?? '', 'cargo' => $x['cargo'] ?? '', 'seccion' => $x['seccion'] ?? '', 'tema' => $x['tema'] ?? '']];
  foreach ($lee('PATRIAM_RECOMENDAR') as $x) $res[] = ['id' => 'rec-' . ($x['id'] ?? ''), 'tipo' => 'recomendacion', 'numero' => $x['numero'] ?? 1,
    'datos' => ['tipo' => $x['tipo'] ?? '', 'titulo' => $x['titulo'] ?? '', 'url' => $x['url'] ?? '', 'imagen' => $x['imagen'] ?? '', 'medio' => $x['medio'] ?? '', 'descripcion' => $x['descripcion'] ?? '',
      'comentario' => $x['comentario'] ?? '', 'critica' => $x['critica'] ?? '', 'comenta' => $x['comenta'] ?? '', 'seccion' => $x['seccion'] ?? '', 'tema' => $x['tema'] ?? 'Cine']];
  foreach ($lee('PATRIAM_FRASES') as $x) $res[] = ['id' => 'fra-' . ($x['id'] ?? ''), 'tipo' => 'frase', 'numero' => $x['numero'] ?? null,
    'datos' => ['frase' => $x['frase'] ?? '', 'autor' => $x['autor'] ?? '']];
  return $res;
}

switch ($acc) {
  case 'estado':
    salir(estado($d, $hoy, $yo));

  case 'abrir': {
    $e = estado($d, $hoy, $yo);
    if ($e['abierto']) salir(['error' => 'Ya está abierto el boletín nº ' . $e['abierto']['numero'] . '. Se puede abrir el siguiente cuando salga.'], 409);
    $fecha = preg_match('/^\d{4}-\d{2}-\d{2}$/', $cuerpo['fecha'] ?? '') && $cuerpo['fecha'] >= $hoy ? $cuerpo['fecha'] : $e['siguiente']['fecha'];
    $d['boletines'][] = ['numero' => $e['siguiente']['numero'], 'fecha' => $fecha, 'abierto_por' => $yo['nombre'] ?? '', 'abierto_el' => gmdate('c')];
    guardarAp($FICHERO, $d);
    salir(estado($d, $hoy, $yo));
  }

  case 'subir': {
    $e = estado($d, $hoy, $yo);
    $aRecamara = ($cuerpo['destino'] ?? '') === 'recamara' && in_array($cuerpo['tipo'] ?? '', ['noticia', 'firma', 'recomendacion', 'editorial', 'frase'], true);
    if (!$e['abierto'] && !$aRecamara) salir(['error' => 'Primero hay que abrir el boletín de esta semana (o guárdalo en la recámara).'], 409);
    $tipo = $cuerpo['tipo'] ?? '';
    $x = $cuerpo['datos'] ?? [];
    $sec = in_array($x['seccion'] ?? '', ['Actualidad', 'Historia', 'Sociedad', 'Análisis'], true) ? $x['seccion'] : 'Actualidad';
    if ($tipo === 'noticia') {
      $datos = ['titular' => limpio($x['titular'] ?? '', 300), 'url' => url_ok($x['url'] ?? ''), 'medio' => limpio($x['medio'] ?? '', 80), 'imagen' => url_ok($x['imagen'] ?? ''),
        'resumen' => limpio($x['resumen'] ?? '', 2000), 'comentario' => limpio($x['comentario'] ?? '', 2000), 'comenta' => limpio($x['firma'] ?? '', 80), 'seccion' => $sec, 'formato' => 'Noticia'];
      $datos['enlaces'] = array_values(array_filter(array_map(fn($e) => ['medio' => limpio($e['medio'] ?? '', 80), 'url' => url_ok($e['url'] ?? '')], array_slice((array)($x['enlaces'] ?? []), 0, 8)), fn($e) => $e['url']));
      if (!$datos['enlaces']) unset($datos['enlaces']);
      if (!$datos['titular'] || !$datos['url']) salir(['error' => 'Faltan el titular o el enlace de la noticia.'], 400);
    } elseif ($tipo === 'espana') {
      // Una noticia que no puede faltar en «España al día» (también de Instagram, X, YouTube…): sale destacada siete días
      $datos = ['titulo' => limpio($x['titular'] ?? ($x['titulo'] ?? ''), 300), 'url' => url_ok($x['url'] ?? ''), 'medio' => limpio($x['medio'] ?? '', 80), 'imagen' => url_ok($x['imagen'] ?? ''),
        'resumen' => limpio($x['resumen'] ?? '', 1200), 'tema' => ($x['tema'] ?? '') === 'Economía' ? 'Economía' : 'Política'];
      if (!$datos['titulo'] || !$datos['url']) salir(['error' => 'Faltan el titular o el enlace.'], 400);
      if (!$datos['medio']) $datos['medio'] = preg_replace('/^www\./', '', parse_url($datos['url'], PHP_URL_HOST) ?: 'Abrir');
    } elseif ($tipo === 'firma') {
      $datos = ['titulo' => limpio($x['titulo'] ?? '', 300), 'entradilla' => limpio($x['entradilla'] ?? '', 600), 'texto' => limpio($x['texto'] ?? '', 60000), 'imagen' => url_ok($x['imagen'] ?? ''),
        'autor' => limpio($x['firma'] ?? '', 80), 'cargo' => limpio($x['cargo'] ?? '', 120), 'seccion' => $sec, 'tema' => limpio($x['tema'] ?? '', 60)];
      if (!$datos['titulo'] || !$datos['texto'] || !$datos['autor']) salir(['error' => 'Faltan el título, el texto o la firma.'], 400);
    } elseif ($tipo === 'recomendacion') {
      $t = in_array($x['tipo'] ?? '', ['Podcast', 'Serie de podcast', 'Vídeo', 'Documental', 'Libro', 'Película'], true) ? $x['tipo'] : 'Libro';
      $datos = ['tipo' => $t, 'titulo' => limpio($x['titulo'] ?? '', 300), 'url' => url_ok($x['url'] ?? ''), 'imagen' => url_ok($x['imagen'] ?? ''), 'medio' => limpio($x['medio'] ?? '', 160),
        'descripcion' => limpio($x['descripcion'] ?? '', 3000), 'comentario' => limpio($x['comentario'] ?? '', 3000), 'critica' => limpio($x['critica'] ?? '', 40000), 'comenta' => limpio($x['firma'] ?? '', 80), 'seccion' => $sec];
      if (!$datos['titulo'] || !$datos['comentario']) salir(['error' => 'Faltan el título o el comentario.'], 400);
    } elseif ($tipo === 'editorial') {
      $datos = ['titulo' => limpio($x['titulo'] ?? '', 300), 'texto' => limpio($x['texto'] ?? '', 40000), 'firma' => limpio($x['firma'] ?? '', 80), 'imagen' => url_ok($x['imagen'] ?? '')];
      if (!$datos['titulo'] || !$datos['texto']) salir(['error' => 'Faltan el título o el texto de la editorial.'], 400);
    } elseif ($tipo === 'frase') {   // la frase de cabecera del boletín (bajo «con criterio»): una por número
      $datos = ['frase' => trim(limpio($x['frase'] ?? '', 600), " \t\n\"«»“”"), 'autor' => limpio($x['autor'] ?? ($x['firma'] ?? ''), 120)];
      if (!$datos['frase']) salir(['error' => 'Falta la frase.'], 400);
    } else salir(['error' => 'Tipo desconocido.'], 400);
    $id = 'ap-' . bin2hex(random_bytes(5));
    if ($aRecamara) {   // a la recámara: no va a ningún número todavía; se aprueba al usarlo
      $d['items'][] = ['id' => $id, 'tipo' => $tipo, 'numero' => null, 'datos' => $datos, 'estado' => 'recamara', 'autor' => $yo['nombre'] ?? '', 'autor_id' => $yo['id'], 'creado' => gmdate('c'), 'aprobado_por' => ''];
      guardarAp($FICHERO, $d);
      salir(estado($d, $hoy, $yo) + ['nuevo' => $id, 'recamara' => true]);
    }
    if ($tipo === 'frase')   // solo una frase por número: la que hubiera pasa a la recámara
      foreach ($d['items'] as &$y) if (($y['tipo'] ?? '') === 'frase' && (int)($y['numero'] ?? 0) === (int)$e['abierto']['numero'] && in_array($y['estado'] ?? '', ['pendiente', 'aprobado'], true)) {
        $y['numero'] = null; $y['estado'] = 'recamara'; $y['cambiado'] = gmdate('c'); }
    unset($y);
    $d['items'][] = ['id' => $id, 'tipo' => $tipo, 'numero' => $e['abierto']['numero'], 'datos' => $datos, 'estado' => 'pendiente',
      'autor' => $yo['nombre'] ?? '', 'autor_id' => $yo['id'], 'creado' => gmdate('c'), 'aprobado_por' => ''];
    guardarAp($FICHERO, $d);
    salir(estado($d, $hoy, $yo) + ['nuevo' => $id]);
  }

  /* Presentación de cada colaborador para «Quién es quién» del boletín, con su CV (el CV no se publica: solo lo ven Carlos e Isabel) */
  case 'mi-ficha': {
    $mia = null;
    foreach ($d['items'] as $x) if (($x['tipo'] ?? '') === 'ficha' && ($x['autor_id'] ?? '') === $yo['id'] && !in_array($x['estado'] ?? '', ['borrado', 'rechazado'], true)) $mia = $x;
    salir(['ficha' => $mia ? ['estado' => $mia['estado'], 'datos' => array_diff_key($mia['datos'], ['cv' => 1]), 'cv' => !empty($mia['datos']['cv'])] : null]);
  }
  case 'ficha': {
    $x = $cuerpo['datos'] ?? [];
    $firma = limpio($x['firma'] ?? '', 80);
    if (!$firma) salir(['error' => 'Falta la firma.'], 400);
    $datos = ['firma' => $firma, 'titulo' => 'Presentación de ' . $firma, 'cargo' => limpio($x['cargo'] ?? '', 140), 'bio' => limpio($x['bio'] ?? '', 4000)];
    $cv = $cuerpo['cv'] ?? null;
    if (is_array($cv) && !empty($cv['datos'])) {
      $ext = strtolower(pathinfo((string)($cv['nombre'] ?? ''), PATHINFO_EXTENSION));
      if (!in_array($ext, ['pdf', 'doc', 'docx'], true)) salir(['error' => 'El CV tiene que ser PDF o Word.'], 400);
      $bin = base64_decode(preg_replace('/^data:[^,]*,/', '', $cv['datos']), true);
      if ($bin === false || strlen($bin) > 8000000) salir(['error' => 'El CV no se ha podido leer o pasa de 8 MB.'], 400);
      @mkdir(privado() . '/cv', 0750, true);
      $f = bin2hex(random_bytes(8)) . '.' . $ext;
      file_put_contents(privado() . '/cv/' . $f, $bin); @chmod(privado() . '/cv/' . $f, 0600);
      $datos['cv'] = ['archivo' => $f, 'nombre' => limpio($cv['nombre'] ?? 'cv.' . $ext, 120)];
    }
    if (!$datos['bio'] && empty($datos['cv'])) salir(['error' => 'Sube tu CV o escribe unas líneas sobre ti.'], 400);
    $e = estado($d, $hoy, $yo);
    // si ya había una suya, se sustituye (se conserva el CV si no se sube otro)
    foreach ($d['items'] as &$y) if (($y['tipo'] ?? '') === 'ficha' && ($y['autor_id'] ?? '') === $yo['id'] && ($y['estado'] ?? '') !== 'borrado') {
      if (empty($datos['cv']) && !empty($y['datos']['cv'])) $datos['cv'] = $y['datos']['cv'];
      $y['estado'] = 'borrado'; $y['cambiado'] = gmdate('c');
    }
    unset($y);
    $d['items'][] = ['id' => 'ap-' . bin2hex(random_bytes(5)), 'tipo' => 'ficha', 'numero' => $e['abierto']['numero'] ?? $e['siguiente']['numero'], 'datos' => $datos,
      'estado' => $yo['puedeAprobar'] && $datos['bio'] ? 'aprobado' : 'pendiente', 'autor' => $yo['nombre'] ?? '', 'autor_id' => $yo['id'], 'creado' => gmdate('c'), 'aprobado_por' => ''];
    guardarAp($FICHERO, $d);
    salir(['ok' => true]);
  }
  case 'cv': {
    if (!$yo['puedeAprobar']) salir(['error' => 'Solo pueden verlo Carlos e Isabel.'], 403);
    foreach ($d['items'] as $x) if ($x['id'] === ($cuerpo['id'] ?? '') && !empty($x['datos']['cv']['archivo'])) {
      $f = privado() . '/cv/' . basename($x['datos']['cv']['archivo']);
      if (!is_file($f)) break;
      salir(['nombre' => $x['datos']['cv']['nombre'], 'datos' => base64_encode(file_get_contents($f))]);
    }
    salir(['error' => 'No hay CV.'], 404);
  }
  case 'editar-ficha': {
    if (!$yo['puedeAprobar']) salir(['error' => 'Solo pueden cambiarlo Carlos e Isabel.'], 403);
    foreach ($d['items'] as &$x) if ($x['id'] === ($cuerpo['id'] ?? '') && ($x['tipo'] ?? '') === 'ficha') { $x['datos']['bio'] = limpio($cuerpo['bio'] ?? '', 4000); $x['datos']['cargo'] = limpio($cuerpo['cargo'] ?? $x['datos']['cargo'], 140); $x['cambiado'] = gmdate('c'); }
    unset($x);
    guardarAp($FICHERO, $d);
    salir(estado($d, $hoy, $yo));
  }

  case 'seccion': {
    if (!$yo['puedeAprobar']) salir(['error' => 'Solo pueden cambiarlo Carlos e Isabel.'], 403);
    $sec = in_array($cuerpo['seccion'] ?? '', ['Actualidad', 'Historia', 'Sociedad', 'Análisis'], true) ? $cuerpo['seccion'] : '';
    if (!$sec) salir(['error' => 'Sección no válida.'], 400);
    foreach ($d['items'] as &$x) if ($x['id'] === ($cuerpo['id'] ?? '')) { $x['datos']['seccion'] = $sec; $x['cambiado'] = gmdate('c'); }
    unset($x);
    guardarAp($FICHERO, $d);
    salir(estado($d, $hoy, $yo));
  }

  case 'editar': {   // cambiar algo ya subido (de Publicar o preparado): si no lo cambia quien aprueba, espera visto bueno
    $id = $cuerpo['id'] ?? ''; $x = $cuerpo['datos'] ?? [];
    if (str_starts_with((string)$id, 'pre-')) {   // recámara preparada: se guarda el cambio; se aprueba cuando pase al boletín
      $p = null; foreach (piezasRecamara($d) as $q) if ($q['id'] === $id) $p = $q;
      if (!$p) salir(['error' => 'No se encuentra.'], 404);
      $c = $d['cambios'][$id] ?? []; $c['datos'] = datosLimpios($p['tipo'], $x, $p['datos']); $c['cambiado'] = gmdate('c'); $d['cambios'][$id] = $c;
      guardarAp($FICHERO, $d); salir(estado($d, $hoy, $yo) + ['ok' => true]);
    }
    if (esPreparado($id)) {
      $p = piezaPreparada($id); if (!$p) salir(['error' => 'No se encuentra.'], 404);
      $c = $d['cambios'][$id] ?? [];
      $nuevo = datosLimpios($p['tipo'], $x, $c['datos'] ?? $p['datos']);
      $c['propuesta'] = $nuevo; $c['propuestaDe'] = $yo['nombre'] ?? '';   // nada sale hasta que alguien pulse «Aprobar»
      $c['cambiado'] = gmdate('c'); $d['cambios'][$id] = $c;
    } else {
      $ok = false;
      foreach ($d['items'] as &$it) if ($it['id'] === $id) {
        if (!$yo['puedeAprobar'] && ($it['autor_id'] ?? '') !== $yo['id']) salir(['error' => 'Solo puede cambiarlo quien lo subió o quien aprueba.'], 403);
        $it['datos'] = datosLimpios($it['tipo'], $x, $it['datos'] ?? []);
        $it['estado'] = 'pendiente'; $it['aprobado_por'] = '';   // nada sale hasta que alguien pulse «Aprobar»
        $it['cambiado'] = gmdate('c'); $ok = true;
      }
      unset($it);
      if (!$ok) salir(['error' => 'No se encuentra.'], 404);
    }
    guardarAp($FICHERO, $d);
    salir(estado($d, $hoy, $yo) + ['ok' => true]);
  }

  /* ---------- Imágenes de un artículo: se añaden opciones y elige quien lo subió ---------- */
  case 'imagen-anadir': case 'imagen-elegir': {
    $e = estado($d, $hoy, $yo); $id = (string)($cuerpo['id'] ?? ''); $url = url_ok($cuerpo['url'] ?? '');
    $p = null; foreach ($e['items'] as $x) if ($x['id'] === $id) $p = $x;
    if (!$p || !$url) salir(['error' => 'Falta la imagen o no se encuentra el artículo.'], 400);
    $prep = esPreparado($id);
    if ($acc === 'imagen-anadir') {
      $una = !$p['imagenesOpciones'];   // si no tenía ninguna, esa se queda
      if ($prep) { $c = $d['cambios'][$id] ?? []; $c['imagenes'] = array_values(array_unique(array_merge($c['imagenes'] ?? [], [$url]))); $d['cambios'][$id] = $c; }
      else foreach ($d['items'] as &$x) if ($x['id'] === $id) { $x['datos']['imagenes'] = array_values(array_unique(array_merge($x['datos']['imagenes'] ?? [], [$url]))); if ($una) $x['datos']['imagen'] = $url; }
      unset($x);
      if ($una && $prep) { $c = $d['cambios'][$id]; $c['propuesta'] = array_merge($c['propuesta'] ?? ($c['datos'] ?? $p['datos']), ['imagen' => $url]); $c['propuestaDe'] = $yo['nombre'] ?? ''; $d['cambios'][$id] = $c; }
      guardarAp($FICHERO, $d); salir(estado($d, $hoy, $yo));
    }
    if (!$p['puedoElegirImagen']) salir(['error' => 'La imagen la elige quien subió el artículo.'], 403);
    if (!in_array($url, $p['imagenesOpciones'], true)) salir(['error' => 'Esa imagen no está entre las opciones.'], 400);
    if ($prep) {   // cambio en lo preparado: espera su «Aprobar», como todo
      $c = $d['cambios'][$id] ?? []; $base = $c['propuesta'] ?? ($c['datos'] ?? (piezaPreparada($id)['datos'] ?? []));
      $c['propuesta'] = array_merge($base, ['imagen' => $url]); $c['propuestaDe'] = $yo['nombre'] ?? ''; $c['cambiado'] = gmdate('c'); $d['cambios'][$id] = $c;
    } else foreach ($d['items'] as &$x) if ($x['id'] === $id) {
      $x['datos']['imagen'] = $url; $x['cambiado'] = gmdate('c');
      if (($x['estado'] ?? '') === 'aprobado' && !$yo['puedeAprobar']) { $x['estado'] = 'pendiente'; $x['aprobado_por'] = ''; }
    }
    unset($x);
    // si lo cambia quien aprueba y la pieza ya estaba aprobada, sigue aprobada con la imagen nueva
    if ($prep && $yo['puedeAprobar'] && ($p['estado'] ?? '') === 'aprobado') aprobarPieza($d, $id, $yo);
    guardarAp($FICHERO, $d); salir(estado($d, $hoy, $yo));
  }
  /* ---------- Elegir lo que sale: se marca de uno en uno y se aprueba todo junto al final ---------- */
  case 'elegir': {
    if (!$yo['puedeAprobar']) salir(['error' => 'Solo pueden elegir Carlos e Isabel.'], 403);
    $e = estado($d, $hoy, $yo); $num = (int)($e['abierto']['numero'] ?? 0);
    if (!$num) salir(['error' => 'No hay ningún boletín abierto.'], 409);
    $id = (string)($cuerpo['id'] ?? ''); $pieza = null;
    foreach ($e['items'] as $x) if ($x['id'] === $id) $pieza = $x;
    if (!$pieza) salir(['error' => 'No se encuentra.'], 404);
    $sel = $e['seleccion'];
    if (!empty($cuerpo['si'])) {
      if (($pieza['tipo'] ?? '') === 'firma' && !in_array($id, $sel, true) && $e['articulosAprobados'] + $e['articulosElegidos'] >= MAX_ARTICULOS)
        salir(['error' => 'Ya hay ' . MAX_ARTICULOS . ' artículos. Quita uno de los elegidos (o pasa uno aprobado a la recámara) para elegir este.', 'lleno' => true] + $e, 409);
      if (!in_array($id, $sel, true)) $sel[] = $id;
    } else $sel = array_values(array_diff($sel, [$id]));
    $d['seleccion'][$num] = $sel; guardarAp($FICHERO, $d);
    salir(estado($d, $hoy, $yo));
  }
  case 'aprobar-eleccion': {
    if (!$yo['puedeAprobar']) salir(['error' => 'Solo pueden aprobar Carlos e Isabel.'], 403);
    $e = estado($d, $hoy, $yo); $num = (int)($e['abierto']['numero'] ?? 0);
    if (!$e['seleccion']) salir(['error' => 'No has elegido nada todavía.'], 400);
    if ($e['articulosAprobados'] + $e['articulosElegidos'] > MAX_ARTICULOS) salir(['error' => 'Hay más de ' . MAX_ARTICULOS . ' artículos: quita alguno.'], 409);
    foreach ($e['seleccion'] as $id) aprobarPieza($d, $id, $yo);
    $d['seleccion'][$num] = []; guardarAp($FICHERO, $d);
    salir(estado($d, $hoy, $yo) + ['aprobados' => count($e['seleccion'])]);
  }
  /* ---------- Pieza principal: la que abre el boletín, el correo y el WhatsApp ---------- */
  case 'principal': {
    if (!$yo['puedeAprobar']) salir(['error' => 'Solo pueden elegirla Carlos e Isabel.'], 403);
    $e = estado($d, $hoy, $yo); $num = (int)($e['abierto']['numero'] ?? 0);
    if (!$num) salir(['error' => 'No hay ningún boletín abierto.'], 409);
    $id = (string)($cuerpo['id'] ?? '');
    if ($id && !in_array($id, array_column($e['items'], 'id'), true)) salir(['error' => 'No se encuentra.'], 404);
    $d['principal'] = $d['principal'] ?? [];
    if ($id) $d['principal'][(string)$num] = $id; else unset($d['principal'][(string)$num]);
    guardarAp($FICHERO, $d); salir(estado($d, $hoy, $yo));
  }
  /* ---------- Enviar ya el boletín abierto: sale hoy en la web y se manda por correo (y WhatsApp si hay API) ---------- */
  case 'enviar': {
    if (!$yo['puedeAprobar']) salir(['error' => 'Solo pueden enviarlo Carlos e Isabel.'], 403);
    $e = estado($d, $hoy, $yo); $num = (int)($e['abierto']['numero'] ?? 0);
    if (!$num) salir(['error' => 'No hay ningún boletín abierto.'], 409);
    if (!bePiezas($num)) salir(['error' => 'No hay nada aprobado en el nº ' . $num . '. Aprueba primero lo que tiene que salir.'], 409);
    // sale hoy: así el enlace del correo ya lleva al boletín publicado
    foreach ($d['boletines'] as &$b) if ((int)$b['numero'] === $num && $b['fecha'] > $hoy) $b['fecha'] = $hoy;
    unset($b);
    guardarAp($FICHERO, $d);
    $r = boletinEnviarYa($num) ?: [0, 0, 0];
    salir(estado($d, $hoy, $yo) + ['enviados' => ['correos' => $r[0], 'whatsapp' => $r[1], 'errores' => $r[2]]]);
  }
  case 'aprobar': case 'rechazar': case 'borrar': {
    $id = $cuerpo['id'] ?? '';
    if ($acc === 'aprobar') {   // aprobar suelto: también respeta el tope de artículos
      $e = estado($d, $hoy, $yo); $p = null; foreach ($e['items'] as $x) if ($x['id'] === $id) $p = $x;
      if ($p && ($p['tipo'] ?? '') === 'firma' && ($p['estado'] ?? '') !== 'aprobado' && $e['articulosAprobados'] >= MAX_ARTICULOS)
        salir(['error' => 'Ya hay ' . MAX_ARTICULOS . ' artículos aprobados. Pasa uno a la recámara para aprobar este.'], 409);
    }
    if (esPreparado($id)) {   // lo preparado: aprobar el cambio propuesto, rechazarlo, o quitar la pieza del boletín
      if (!$yo['puedeAprobar']) salir(['error' => 'Solo pueden hacerlo Carlos e Isabel.'], 403);
      $c = $d['cambios'][$id] ?? [];
      if ($acc === 'aprobar') { if (!empty($c['propuesta'])) $c['datos'] = $c['propuesta']; $c['aprobado'] = true; $c['aprobado_por'] = $yo['nombre'] ?? ''; }
      if ($acc === 'rechazar' && empty($c['propuesta']) && empty($c['aprobado'])) $c['quitado'] = true;   // «No publicar» algo que nunca se aprobó
      if ($acc !== 'borrar') unset($c['propuesta'], $c['propuestaDe']); else $c['quitado'] = true;
      $c['cambiado'] = gmdate('c'); $d['cambios'][$id] = $c;
      guardarAp($FICHERO, $d);
      salir(estado($d, $hoy, $yo));
    }
    if ($acc !== 'borrar' && !$yo['puedeAprobar']) salir(['error' => 'Solo pueden aprobar Carlos e Isabel.'], 403);
    foreach ($d['items'] as &$x) {
      if ($x['id'] !== $id) continue;
      if ($acc === 'borrar') { if (!$yo['puedeAprobar'] && ($x['autor_id'] ?? '') !== $yo['id']) salir(['error' => 'Solo puede quitarlo quien lo subió o quien aprueba.'], 403); $x['estado'] = 'borrado'; }
      else { if (!$yo['puedeAprobar']) salir(['error' => 'Solo pueden aprobar Carlos e Isabel.'], 403); $x['estado'] = $acc === 'aprobar' ? 'aprobado' : 'rechazado'; $x['aprobado_por'] = $yo['nombre'] ?? ''; }
      $x['cambiado'] = gmdate('c');
    }
    unset($x);
    guardarAp($FICHERO, $d);
    salir(estado($d, $hoy, $yo));
  }

  /* ---------- Recámara: lo preparado que todavía no va a ningún número ---------- */
  /* ---------- Revisión del autor: un enlace y una clave SOLO de su artículo, para que dé el visto bueno antes de publicarlo.
     Solo para los colaboradores de fuera (no para Laura/LOC, Consuelo Arnau, Isabel ni Carlos). ---------- */
  case 'revisiones': {
    $e = estado($d, $hoy, $yo);
    $casa = fn($a) => (bool)preg_match('/\b(loc|laura|consuelo|arnau|isabel|carlos)\b/u', mb_strtolower(strtr((string)$a, ['á'=>'a','é'=>'e','í'=>'i','ó'=>'o','ú'=>'u','Á'=>'a','É'=>'e','Í'=>'i','Ó'=>'o','Ú'=>'u'])));
    $d['revisiones'] = $d['revisiones'] ?? []; $res = []; $cambio = false;
    foreach ($e['items'] as $x) {
      if (($x['tipo'] ?? '') !== 'firma') continue;
      $dt = $x['datos'] ?? []; $autor = $dt['autor'] ?? ($dt['firma'] ?? '');
      if (!trim($autor) || $casa($autor)) continue;
      $id = $x['id']; $r = $d['revisiones'][$id] ?? null;
      if (!$r) {
        $alf = 'abcdefghjkmnpqrstuvwxyz23456789'; $clave = '';
        for ($i = 0; $i < 8; $i++) $clave .= $alf[random_int(0, strlen($alf) - 1)];
        $r = ['token' => bin2hex(random_bytes(12)), 'clave' => $clave, 'creada' => gmdate('c'), 'creada_por' => $yo['nombre'] ?? ''];
      }
      $snap = ['titulo' => $dt['titulo'] ?? '', 'entradilla' => $dt['entradilla'] ?? '', 'texto' => $dt['texto'] ?? '', 'imagen' => $dt['imagen'] ?? '', 'autor' => $autor, 'cargo' => $dt['cargo'] ?? ''];
      if (($r['datos'] ?? null) !== $snap) { $r['datos'] = $snap; $cambio = true; }
      if (empty($d['revisiones'][$id])) $cambio = true;
      $d['revisiones'][$id] = $r;
      $res[$id] = ['url' => origenPrevia() . '/revision/' . $r['token'], 'clave' => $r['clave'], 'respuesta' => $r['respuesta'] ?? '', 'comentario' => $r['comentario'] ?? '', 'respondido' => $r['respondido'] ?? ''];
    }
    if ($cambio) guardarAp($FICHERO, $d);
    salir(['revisiones' => (object)$res]);
  }
  /* ---------- Vista previa del equipo: enlace temporal con clave (vale hasta el día siguiente a la salida) ---------- */
  case 'previa': {
    $e = estado($d, $hoy, $yo);
    if (!$e['abierto']) salir(['error' => 'Primero hay que abrir el boletín.'], 409);
    $num = (int)$e['abierto']['numero'];
    $p = $d['previas'][$num] ?? null;
    if (!$p || !empty($cuerpo['nueva']) || strtotime($p['expira'] ?? '1970-01-01') < time()) {
      $alf = 'abcdefghjkmnpqrstuvwxyz23456789'; $clave = '';
      for ($i = 0; $i < 8; $i++) $clave .= $alf[random_int(0, strlen($alf) - 1)];
      $fin = (new DateTime($e['abierto']['fecha'] . ' 23:59:59', $zona))->modify('+1 day');
      $p = ['token' => bin2hex(random_bytes(12)), 'clave' => $clave, 'numero' => $num, 'expira' => $fin->format('c'), 'creada_por' => $yo['nombre'] ?? '', 'creada' => gmdate('c')];
      $d['previas'][$num] = $p; guardarAp($FICHERO, $d);
    }
    salir(['url' => origenPrevia() . '/previa/' . $p['token'], 'clave' => $p['clave'], 'expira' => $p['expira'], 'numero' => $num]);
  }
  case 'recamara': {
    $r = array_values(array_filter($d['items'], fn($x) => ($x['estado'] ?? '') === 'recamara'));
    $r = array_merge($r, piezasRecamara($d));
    $r = array_map(fn($x) => array_merge($x, ['datos' => array_diff_key($x['datos'] ?? [], ['cv' => 1])]), $r);
    usort($r, fn($a, $b) => strcmp($b['creado'] ?? '', $a['creado'] ?? ''));
    // y lo que ya está preparado para un número que todavía no ha salido (importar.js)
    $ab = estado($d, $hoy, $yo)['abierto']; $prog = [];
    foreach (piezasImportar() as $x) if (($x['numero'] ?? 0) && (int)$x['numero'] > (int)($ab['numero'] ?? 0)) $prog[] = $x;
    salir(['items' => $r, 'programado' => $prog, 'abierto' => $ab]);
  }
  case 'usar': {   // de la recámara al boletín abierto
    $e = estado($d, $hoy, $yo);
    if (!$e['abierto']) salir(['error' => 'Primero hay que abrir el boletín de esta semana.'], 409);
    $ok = false;
    foreach (piezasRecamara($d) as $p) if ($p['id'] === ($cuerpo['id'] ?? '')) {   // preparada en _recamara.js: entra como pendiente
      $d['items'][] = ['id' => 'ap-' . bin2hex(random_bytes(5)), 'tipo' => $p['tipo'], 'numero' => $e['abierto']['numero'], 'datos' => $p['datos'], 'estado' => 'pendiente',
        'autor' => $p['autor'], 'autor_id' => $yo['id'], 'creado' => gmdate('c'), 'aprobado_por' => '', 'de_recamara' => $p['id']];
      $c = $d['cambios'][$p['id']] ?? []; $c['usado'] = true; $c['cambiado'] = gmdate('c'); $d['cambios'][$p['id']] = $c; $ok = true;
    }
    $usada = null; foreach ($d['items'] as $x) if ($x['id'] === ($cuerpo['id'] ?? '')) $usada = $x;
    if (($usada['tipo'] ?? '') === 'frase')   // una frase por número: la que hubiera vuelve a la recámara
      foreach ($d['items'] as &$y) if (($y['tipo'] ?? '') === 'frase' && $y['id'] !== $usada['id'] && (int)($y['numero'] ?? 0) === (int)$e['abierto']['numero'] && in_array($y['estado'] ?? '', ['pendiente', 'aprobado'], true)) {
        $y['numero'] = null; $y['estado'] = 'recamara'; $y['cambiado'] = gmdate('c'); }
    unset($y);
    foreach ($d['items'] as &$x) if ($x['id'] === ($cuerpo['id'] ?? '') && ($x['estado'] ?? '') === 'recamara') {
      $x['numero'] = $e['abierto']['numero']; $x['estado'] = 'pendiente';
      $x['aprobado_por'] = ''; $x['cambiado'] = gmdate('c'); $ok = true;
    }
    unset($x);
    if (!$ok) salir(['error' => 'No está en la recámara.'], 404);
    guardarAp($FICHERO, $d);
    salir(estado($d, $hoy, $yo) + ['ok' => true]);
  }
  case 'a-recamara': {   // devolver a la recámara algo del boletín abierto (si no ha salido) o recuperar algo antiguo (copia)
    $id = $cuerpo['id'] ?? ''; $hecho = false;
    $abierto = estado($d, $hoy, $yo)['abierto']['numero'] ?? null;
    foreach ($d['items'] as &$x) if ($x['id'] === $id) {
      if ($x['numero'] !== null && (int)$x['numero'] === (int)$abierto && ($x['estado'] ?? '') !== 'borrado') {
        $x['numero'] = null; $x['estado'] = 'recamara'; $x['cambiado'] = gmdate('c'); $hecho = true;
      }
    }
    unset($x);
    if (!$hecho && esPreparado($id) && ($pp = piezaPreparada($id)) && (int)($pp['numero'] ?? 0) === (int)$abierto) {
      $c = $d['cambios'][$id] ?? []; $c['quitado'] = true; $c['cambiado'] = gmdate('c'); $d['cambios'][$id] = $c;
      $d['items'][] = ['id' => 'ap-' . bin2hex(random_bytes(5)), 'tipo' => $pp['tipo'], 'numero' => null, 'datos' => $c['datos'] ?? $pp['datos'], 'estado' => 'recamara',
        'autor' => $yo['nombre'] ?? '', 'autor_id' => $yo['id'], 'creado' => gmdate('c'), 'aprobado_por' => ''];
      $hecho = true;
    }
    if (!$hecho) {   // algo ya publicado: se copia a la recámara, marcado con el número en que salió
      $p = $cuerpo['pieza'] ?? null;
      if (!$p) foreach ($d['items'] as $x) if ($x['id'] === $id) $p = ['tipo' => $x['tipo'], 'datos' => $x['datos'], 'numero' => $x['numero']];
      if (!$p || !in_array($p['tipo'] ?? '', ['noticia', 'firma', 'recomendacion', 'editorial', 'frase'], true)) salir(['error' => 'No se encuentra.'], 404);
      $datos = array_map(fn($v) => is_string($v) ? limpio($v, 60000) : $v, (array)($p['datos'] ?? []));
      $d['items'][] = ['id' => 'ap-' . bin2hex(random_bytes(5)), 'tipo' => $p['tipo'], 'numero' => null, 'datos' => $datos, 'estado' => 'recamara',
        'ya_en' => (int)($p['numero'] ?? 0) ?: null, 'autor' => $yo['nombre'] ?? '', 'autor_id' => $yo['id'], 'creado' => gmdate('c'), 'aprobado_por' => ''];
    }
    guardarAp($FICHERO, $d);
    salir(['ok' => true]);
  }
  case 'quitar-recamara': {
    if (str_starts_with((string)($cuerpo['id'] ?? ''), 'pre-')) {
      if (!$yo['puedeAprobar']) salir(['error' => 'Solo pueden quitarlo Carlos e Isabel.'], 403);
      $c = $d['cambios'][$cuerpo['id']] ?? []; $c['quitado'] = true; $c['cambiado'] = gmdate('c'); $d['cambios'][$cuerpo['id']] = $c;
      guardarAp($FICHERO, $d); salir(['ok' => true]);
    }
    foreach ($d['items'] as &$x) if ($x['id'] === ($cuerpo['id'] ?? '') && ($x['estado'] ?? '') === 'recamara') {
      if (!$yo['puedeAprobar'] && ($x['autor_id'] ?? '') !== $yo['id']) salir(['error' => 'Solo puede quitarlo quien lo subió o quien aprueba.'], 403);
      $x['estado'] = 'borrado'; $x['cambiado'] = gmdate('c');
    }
    unset($x);
    guardarAp($FICHERO, $d);
    salir(['ok' => true]);
  }
  /* ---------- Archivo: todo lo ya publicado, para buscar por sección o tema y recuperarlo ---------- */
  case 'archivo': {
    $e = estado($d, $hoy, $yo); $abierto = (int)($e['abierto']['numero'] ?? 0);
    $res = []; $vistos = [];
    $mete = function ($tipo, $numero, $datos, $id, $origen) use (&$res, &$vistos) {
      $t = trim((string)($datos['titulo'] ?? ($datos['titular'] ?? '')));
      if ($t === '' || isset($vistos[mb_strtolower($t)])) return; $vistos[mb_strtolower($t)] = 1;
      $res[] = ['id' => $id, 'origen' => $origen, 'tipo' => $tipo, 'numero' => $numero, 'titulo' => $t,
        'firma' => $datos['autor'] ?? ($datos['comenta'] ?? ($datos['firma'] ?? '')), 'seccion' => $datos['seccion'] ?? '', 'tema' => $datos['tema'] ?? ($datos['tipo'] ?? ''),
        'imagen' => $datos['imagen'] ?? '', 'pieza' => ['tipo' => $tipo, 'numero' => $numero, 'datos' => $datos]];
    };
    foreach ($d['items'] as $x) if (($x['estado'] ?? '') === 'aprobado' && $x['numero'] !== null && in_array($x['tipo'], ['noticia', 'firma', 'recomendacion', 'editorial'], true))
      $mete($x['tipo'], (int)$x['numero'], array_diff_key($x['datos'], ['cv' => 1]), $x['id'], 'publicar');
    foreach (piezasImportar() as $x) if (($x['numero'] ?? 0) && (int)$x['numero'] <= max($abierto, 1)) $mete($x['tipo'], (int)$x['numero'], $x['datos'], $x['id'], 'preparado');
    boletinesTodos($d);
    foreach ($GLOBALS['BOLETIN_EDITOR'] ?? [] as $num => $b) {
      foreach ((array)($b['noticias'] ?? []) as $k => $n) if (!preg_match('/ejemplo\.com/i', (string)($n['url'] ?? '')))
        $mete('noticia', $num, ['titular' => $n['titular'] ?? '', 'url' => $n['url'] ?? '', 'medio' => $n['medio'] ?? '', 'imagen' => $n['imagen'] ?? '', 'resumen' => $n['resumen'] ?? '', 'comentario' => $n['comentario'] ?? '', 'firma' => $n['comenta'] ?? '', 'seccion' => $n['seccion'] ?? 'Actualidad', 'tema' => $n['tema'] ?? ''], "ed-$num-n$k", 'editor');
      foreach ((array)($b['colaboraciones'] ?? []) as $k => $c)
        $mete('firma', $num, ['titulo' => $c['titulo'] ?? '', 'entradilla' => $c['entradilla'] ?? '', 'texto' => $c['texto'] ?? '', 'imagen' => $c['imagen'] ?? '', 'autor' => $c['autor'] ?? '', 'cargo' => $c['cargo'] ?? '', 'seccion' => $c['seccion'] ?? '', 'tema' => $c['tema'] ?? ''], "ed-$num-c$k", 'editor');
      if (is_array($b['editorial'] ?? null) && trim($b['editorial']['titulo'] ?? '') !== '')
        $mete('editorial', $num, ['titulo' => $b['editorial']['titulo'], 'texto' => $b['editorial']['texto'] ?? '', 'firma' => $b['editorial']['firma'] ?? '', 'imagen' => $b['editorial']['imagen'] ?? '', 'seccion' => 'Editorial'], "ed-$num-e", 'editor');
    }
    usort($res, fn($a, $b) => ($b['numero'] <=> $a['numero']) ?: strcmp($a['titulo'], $b['titulo']));
    salir(['items' => $res]);
  }

  case 'sugerencias': {
    // Las noticias de la semana de «España al día» (las recoge solo scripts/espana-al-dia.mjs) para meterlas con un clic
    $t = @file_get_contents(__DIR__ . '/espana-al-dia.js') ?: '';
    $j = preg_match('/=\s*(\{.*\})\s*;?\s*$/s', $t, $m) ? json_decode($m[1], true) : null;
    $g = array_slice($j['grupos'] ?? [], 0, 150);
    usort($g, fn($a, $b) => (count($b['medios'] ?? []) <=> count($a['medios'] ?? [])) ?: strcmp($b['fecha'] ?? '', $a['fecha'] ?? ''));
    salir(['actualizado' => $j['actualizado'] ?? '', 'grupos' => array_values($g)]);
  }

  case 'enlace': {
    // Rellena solo: titular, resumen, imagen y medio a partir del enlace de la noticia
    $u = url_ok($cuerpo['url'] ?? '');
    if (!$u) salir(['error' => 'Enlace no válido.'], 400);
    $ch = curl_init($u);
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_FOLLOWLOCATION => true, CURLOPT_MAXREDIRS => 4, CURLOPT_TIMEOUT => 12, CURLOPT_USERAGENT => 'Mozilla/5.0 (compatible; PatriamBoletin/1.0)', CURLOPT_ENCODING => '']);
    $h = (string)curl_exec($ch); curl_close($ch);
    $meta = function ($p) use ($h) {
      if (preg_match('#<meta[^>]+(?:property|name)=["\']' . preg_quote($p, '#') . '["\'][^>]*content=["\']([^"\']*)#i', $h, $m) || preg_match('#<meta[^>]+content=["\']([^"\']*)["\'][^>]*(?:property|name)=["\']' . preg_quote($p, '#') . '["\']#i', $h, $m)) return html_entity_decode($m[1], ENT_QUOTES | ENT_HTML5, 'UTF-8');
      return '';
    };
    $titulo = $meta('og:title') ?: (preg_match('#<title[^>]*>(.*?)</title>#is', $h, $m) ? html_entity_decode(trim($m[1]), ENT_QUOTES | ENT_HTML5, 'UTF-8') : '');
    $host = preg_replace('/^www\./', '', parse_url($u, PHP_URL_HOST) ?: '');
    salir(['titular' => trim($titulo), 'resumen' => trim($meta('og:description') ?: $meta('description')), 'imagen' => url_ok($meta('og:image') ?: $meta('twitter:image')), 'medio' => trim($meta('og:site_name')) ?: $host]);
  }
}
salir(['error' => 'Acción desconocida.'], 400);
