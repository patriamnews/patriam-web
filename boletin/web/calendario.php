<?php
/* Calendario de boletines y aviso a los colaboradores.
   - El boletín sale cada dos viernes: nº 2 el 13 de noviembre de 2026 y, desde ahí, cada 14 días.
   - Una semana antes de cada boletín, a cada colaborador le llega un correo: «el boletín nº N sale el viernes X, manda tu artículo».
   - Se ve y se cambia desde la web (Gestión › Calendario de boletines y Publicar › Calendario), con el usuario del equipo:
       GET  ?accion=datos                 → calendario + colaboradores + avisos enviados
       POST ?accion=guardar {ajustes, colaboradores, cambios}
       POST ?accion=probar {email}        → manda el aviso de prueba
   - Los avisos los manda el cron de Hostinger cada hora («php revisar.php» → calendarioRevisar()).
   Todo se guarda en la carpeta privada del servidor: calendario.json */
require_once __DIR__ . '/_privado.php';

const CAL_INICIO_NUM = 2;
const CAL_INICIO_FECHA = '2026-11-13';
const CAL_ZONA = 'Europe/Madrid';

function calVacio() {
  return ['ajustes' => ['cadaDias' => 14, 'avisoDias' => 7, 'horaAviso' => 9, 'activo' => true,
      'asunto' => 'Boletín nº {numero}: tu artículo para el viernes {fecha}',
      'texto' => "Hola, {nombre}:\n\nEl boletín nº {numero} de «Lo que hay que saber: con criterio» sale el viernes {fecha}.\n\nManda tu artículo a hola@movimientopatriam.com con el asunto «ARTICULO {firma}» (si quieres indicar la sección, añádela detrás de un guion: «ARTICULO {firma} - Historia»). Puedes adjuntarlo en Word o PDF, con una foto si la tienes.\n\nCuanto antes llegue, mejor: así da tiempo a prepararlo y aprobarlo.\n\nMuchas gracias,\nPATRIAM"],
    'colaboradores' => [
      ['id' => 'c1', 'nombre' => 'Carlos Rubio', 'firma' => 'Carlos R.', 'email' => 'carlosrubioromo@yahoo.es', 'seccion' => '', 'activo' => true],
      ['id' => 'c2', 'nombre' => 'Álvaro Mencos', 'firma' => 'Álvaro Mencos', 'email' => 'movimientopatriam@gmail.com', 'seccion' => 'Editorial', 'activo' => true],
      ['id' => 'c3', 'nombre' => 'Laura', 'firma' => 'LOC', 'email' => 'lauraolivareses@yahoo.es', 'seccion' => 'Actualidad', 'activo' => true],
      ['id' => 'c4', 'nombre' => 'Isabel', 'firma' => 'Isabel O.C.', 'email' => 'patriam-merc@outlook.es', 'seccion' => '', 'activo' => true]],
    'cambios' => [],   // por número: {fecha: 'AAAA-MM-DD'} para moverlo, {saltar: true} para quitarlo, {nota: '…'}
    'avisos' => []];   // por número: {email: fecha}
}
function calLeer() {
  $f = privado() . '/calendario.json';
  $d = is_file($f) ? (json_decode(file_get_contents($f), true) ?: []) : [];
  $v = calVacio();
  $d = array_merge($v, $d);
  $d['ajustes'] = array_merge($v['ajustes'], $d['ajustes'] ?? []);
  return $d;
}
function calGuardar($d) {
  $f = privado() . '/calendario.json';
  file_put_contents($f . '.tmp', json_encode($d, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), LOCK_EX);
  rename($f . '.tmp', $f); @chmod($f, 0600);
}
/* Los boletines desde el nº 2 hasta dentro de ~un año (los quitados no cuentan número) */
function calBoletines($d, $cuantos = 27) {
  $z = new DateTimeZone(CAL_ZONA); $res = []; $num = CAL_INICIO_NUM; $i = 0;
  $base = new DateTime(CAL_INICIO_FECHA, $z);
  while (count($res) < $cuantos && $i < 200) {
    $f = (clone $base)->modify('+' . ($i * (int)$d['ajustes']['cadaDias']) . ' days'); $i++;
    $orig = $f->format('Y-m-d');
    $c = $d['cambios'][$orig] ?? [];
    if (!empty($c['saltar'])) { $res[] = ['numero' => null, 'fecha' => $orig, 'original' => $orig, 'saltado' => true, 'nota' => $c['nota'] ?? '']; continue; }
    $fecha = !empty($c['fecha']) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $c['fecha']) ? $c['fecha'] : $orig;
    $aviso = (new DateTime($fecha, $z))->modify('-' . (int)$d['ajustes']['avisoDias'] . ' days')->format('Y-m-d');
    $res[] = ['numero' => $num, 'fecha' => $fecha, 'original' => $orig, 'aviso' => $aviso, 'nota' => $c['nota'] ?? '', 'avisados' => $d['avisos'][(string)$num] ?? []];
    $num++;
  }
  return $res;
}
function calFechaLarga($ymd) {
  $m = ['', 'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  $d = new DateTime($ymd, new DateTimeZone(CAL_ZONA));
  return (int)$d->format('j') . ' de ' . $m[(int)$d->format('n')];
}
function calMensaje($d, $b, $c) {
  $r = ['{nombre}' => preg_split('/\s+/', trim($c['nombre']))[0] ?: $c['nombre'], '{numero}' => $b['numero'], '{fecha}' => calFechaLarga($b['fecha']),
    '{firma}' => trim($c['firma'] ?? '') ?: $c['nombre']];
  $asunto = strtr($d['ajustes']['asunto'], $r); $texto = strtr($d['ajustes']['texto'], $r);
  $e = fn($x) => htmlspecialchars((string)$x, ENT_QUOTES, 'UTF-8');
  $html = '<div style="background:#faf5ec;padding:24px 12px;font-family:Georgia,serif"><div style="max-width:600px;margin:0 auto;background:#fffdf9;border-top:6px solid #7b1c2c;padding:26px;color:#1d1719;font-size:17px;line-height:1.6">'
    . '<img src="https://boletin.movimientopatriam.es/logo.png" alt="PATRIAM" style="height:42px;margin-bottom:16px">';
  foreach (preg_split('/\n\s*\n/', str_replace("\r", '', trim($texto))) as $p) $html .= '<p style="margin:0 0 14px">' . nl2br($e($p)) . '</p>';
  $html .= '</div></div>';
  return [$asunto, $html, $texto];
}
function calEnviar($para, $nombre, $asunto, $html, $texto) {
  $k = is_file(privado() . '/claves.json') ? (json_decode(file_get_contents(privado() . '/claves.json'), true) ?: []) : [];
  $aj = (is_file(privado() . '/com.json') ? (json_decode(file_get_contents(privado() . '/com.json'), true) ?: []) : [])['ajustes'] ?? [];
  if (empty($k['brevo'])) return [false, 'Falta la clave de Brevo'];
  $msg = ['sender' => ['name' => 'Boletín PATRIAM', 'email' => $aj['remitente'] ?? 'comunicacion@movimientopatriam.es'], 'to' => [array_filter(['email' => $para, 'name' => $nombre])],
    'subject' => $asunto, 'htmlContent' => $html, 'textContent' => $texto, 'tags' => ['aviso-colaboradores'], 'replyTo' => ['email' => 'hola@movimientopatriam.com']];
  [$c, $r, $err] = pedir('https://api.brevo.com/v3/smtp/email', ['api-key: ' . $k['brevo'], 'Content-Type: application/json', 'Accept: application/json'], json_encode($msg, JSON_UNESCAPED_UNICODE));
  return [$c >= 200 && $c < 300, $c >= 200 && $c < 300 ? '' : ((json_decode($r, true)['message'] ?? '') ?: ($err ?: 'Brevo ' . $c))];
}
/* Lo llama el cron cada hora: el día del aviso, a partir de la hora fijada, a cada colaborador activo (una sola vez) */
function calendarioRevisar($salida = false) {
  $fp = fopen(privado() . '/calendario.lock', 'c'); flock($fp, LOCK_EX);
  $d = calLeer(); $n = 0;
  $ahora = new DateTime('now', new DateTimeZone(CAL_ZONA)); $hoy = $ahora->format('Y-m-d');
  if (!empty($d['ajustes']['activo']) && (int)$ahora->format('G') >= (int)$d['ajustes']['horaAviso']) {
    foreach (calBoletines($d, 30) as $b) {
      // el día del aviso (o, si el servidor no pudo, los dos días siguientes); nunca para boletines cuyo aviso ya pasó
      $hasta = (new DateTime($b['aviso'], new DateTimeZone(CAL_ZONA)))->modify('+2 days')->format('Y-m-d');
      if (empty($b['numero']) || $b['aviso'] > $hoy || $hoy > $hasta || $b['fecha'] < $hoy) continue;
      foreach ($d['colaboradores'] as $c) {
        $e = strtolower(trim((string)($c['email'] ?? '')));
        if (empty($c['activo']) || !preg_match('/^[^@\s]+@[^@\s]+\.[^@\s]+$/', $e) || isset($d['avisos'][(string)$b['numero']][$e])) continue;
        [$asunto, $html, $texto] = calMensaje($d, $b, $c);
        [$ok, $m] = calEnviar($e, $c['nombre'], $asunto, $html, $texto);
        $d['avisos'][(string)$b['numero']][$e] = $ok ? gmdate('c') : 'error: ' . mb_substr($m, 0, 120);
        if (!$ok) unset($d['avisos'][(string)$b['numero']][$e]);   // se reintenta en la siguiente vuelta
        if (!$ok) $d['errores'][] = ['fecha' => gmdate('c'), 'numero' => $b['numero'], 'email' => $e, 'motivo' => mb_substr($m, 0, 160)];
        $n += $ok ? 1 : 0;
      }
    }
  }
  $d['errores'] = array_slice($d['errores'] ?? [], -30);
  calGuardar($d);
  flock($fp, LOCK_UN); fclose($fp);
  if ($salida) echo "Calendario: $n avisos enviados\n";
}

if (basename($_SERVER['SCRIPT_FILENAME'] ?? '') !== basename(__FILE__) || PHP_SAPI === 'cli') return;   // incluido desde revisar.php

/* ---------- desde la web (Gestión y Publicar), con el usuario del equipo ---------- */
permitirPublicar();
$yo = comprobarEquipoWeb();
$acc = $_GET['accion'] ?? 'datos';
$in = json_decode(file_get_contents('php://input') ?: '{}', true) ?: [];
$publico = fn($d) => ['ajustes' => $d['ajustes'], 'colaboradores' => $d['colaboradores'], 'cambios' => (object)$d['cambios'], 'boletines' => calBoletines($d),
  'errores' => array_slice(array_reverse($d['errores'] ?? []), 0, 10), 'hoy' => (new DateTime('now', new DateTimeZone(CAL_ZONA)))->format('Y-m-d')];

if ($acc === 'datos') salir($publico(calLeer()));
if ($_SERVER['REQUEST_METHOD'] !== 'POST') salir(['error' => 'No válido'], 405);

if ($acc === 'guardar') {
  $fp = fopen(privado() . '/calendario.lock', 'c'); flock($fp, LOCK_EX);
  $d = calLeer();
  if (isset($in['ajustes'])) {
    $a = $in['ajustes'];
    $d['ajustes'] = ['cadaDias' => max(7, min(31, (int)($a['cadaDias'] ?? 14))), 'avisoDias' => max(1, min(21, (int)($a['avisoDias'] ?? 7))), 'horaAviso' => max(6, min(22, (int)($a['horaAviso'] ?? 9))),
      'activo' => !empty($a['activo']), 'asunto' => mb_substr(trim((string)($a['asunto'] ?? '')), 0, 200) ?: calVacio()['ajustes']['asunto'],
      'texto' => mb_substr((string)($a['texto'] ?? ''), 0, 4000) ?: calVacio()['ajustes']['texto']];
  }
  if (isset($in['colaboradores'])) {
    $d['colaboradores'] = [];
    foreach (array_slice((array)$in['colaboradores'], 0, 200) as $c) {
      $d['colaboradores'][] = ['id' => preg_replace('/[^a-z0-9]/i', '', (string)($c['id'] ?? '')) ?: 'c' . bin2hex(random_bytes(3)), 'nombre' => mb_substr(trim((string)($c['nombre'] ?? '')), 0, 120),
        'firma' => mb_substr(trim((string)($c['firma'] ?? '')), 0, 80), 'email' => strtolower(mb_substr(trim((string)($c['email'] ?? '')), 0, 160)),
        'seccion' => mb_substr(trim((string)($c['seccion'] ?? '')), 0, 60), 'activo' => !empty($c['activo'])];
    }
  }
  if (isset($in['cambios'])) {
    $d['cambios'] = [];
    foreach ((array)$in['cambios'] as $orig => $c) {
      if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', (string)$orig)) continue;
      $x = array_filter(['fecha' => preg_match('/^\d{4}-\d{2}-\d{2}$/', (string)($c['fecha'] ?? '')) && $c['fecha'] !== $orig ? $c['fecha'] : null,
        'saltar' => !empty($c['saltar']) ? true : null, 'nota' => mb_substr(trim((string)($c['nota'] ?? '')), 0, 200) ?: null]);
      if ($x) $d['cambios'][$orig] = $x;
    }
  }
  calGuardar($d);
  flock($fp, LOCK_UN); fclose($fp);
  salir(['ok' => true] + $publico($d));
}
if ($acc === 'probar') {
  $d = calLeer();
  $e = strtolower(trim((string)($in['email'] ?? ($yo['email'] ?? ''))));
  if (!preg_match('/^[^@\s]+@[^@\s]+\.[^@\s]+$/', $e)) salir(['error' => 'Correo no válido'], 400);
  $b = null; foreach (calBoletines($d) as $x) if (!empty($x['numero']) && $x['fecha'] >= $publico($d)['hoy']) { $b = $x; break; }
  $c = ['nombre' => $yo['nombre'] ?? 'colaborador', 'firma' => $yo['nombre'] ?? ''];
  foreach ($d['colaboradores'] as $x) if (strtolower($x['email']) === $e) $c = $x;
  [$asunto, $html, $texto] = calMensaje($d, $b, $c);
  [$ok, $m] = calEnviar($e, $c['nombre'], '[Prueba] ' . $asunto, $html, $texto);
  salir($ok ? ['ok' => true] : ['error' => $m], $ok ? 200 : 502);
}
salir(['error' => 'No existe'], 404);
