<?php
/* Comunicaciones de Carlos: su página propia (boletin.movimientopatriam.es/carlos/<clave>), sin usuario ni contraseña.
   - Carlos va metiendo nombre y móvil (y correo si lo tiene) de cada persona: entran solas en las comunicaciones
     semanal y mensual, y también en «Otros destinatarios» del editor (nota «Contactos de Carlos»).
   - Semanal y mensual: «Buenos días, Nombre:» + texto + firma. Se mandan solas el día y la hora que él elige:
       · por correo (Brevo), a quien tenga correo;
       · por WhatsApp: con la API de WhatsApp, solas; sin ella, le llega un aviso y en su página tiene un botón por persona
         que abre WhatsApp con el mensaje ya escrito.
   - Las revisa el cron de Hostinger cada hora: «php revisar.php» (que llama a carlosRevisar()).
   - La clave del enlace sale de la clave secreta del servidor; un administrador la ve (y la puede cambiar) en el editor,
     pestaña Comunicaciones. Todo se guarda en la carpeta privada (carlos.json y com.json). */
require_once __DIR__ . '/_privado.php';

const CARLOS_WEB = 'https://boletin.movimientopatriam.es';
const CARLOS_DIAS = [1 => 'lunes', 2 => 'martes', 3 => 'miércoles', 4 => 'jueves', 5 => 'viernes', 6 => 'sábado', 7 => 'domingo'];
const CARLOS_NOTA = 'Contactos de Carlos';

/* ---------- datos ---------- */
function carlosVacio() {
  return ['version' => 1, 'avisoA' => 'carlosrubioromo@yahoo.es', 'firma' => "Un saludo,\nCarlos R.\nPATRIAM",
    'programas' => [
      'semanal' => ['activo' => true, 'dia' => 1, 'hora' => 9, 'asunto' => 'Comunicación semanal de PATRIAM', 'texto' => ''],
      'mensual' => ['activo' => true, 'dia' => 1, 'hora' => 9, 'asunto' => 'Comunicación mensual de PATRIAM', 'texto' => '']],
    'hechos' => ['semanal' => '', 'mensual' => ''], 'tandas' => []];
}
function carlosLeer() {
  $f = privado() . '/carlos.json';
  $d = is_file($f) ? (json_decode(file_get_contents($f), true) ?: []) : [];
  $v = carlosVacio();
  $d = array_merge($v, $d);
  foreach (['semanal', 'mensual'] as $p) $d['programas'][$p] = array_merge($v['programas'][$p], $d['programas'][$p] ?? []);
  $d['hechos'] = array_merge($v['hechos'], $d['hechos'] ?? []);
  return $d;
}
function carlosGuardar($d) {
  $f = privado() . '/carlos.json';
  file_put_contents($f . '.tmp', json_encode($d, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), LOCK_EX);
  rename($f . '.tmp', $f); @chmod($f, 0600);
}
function carlosClave($d = null) { $d = $d ?: carlosLeer(); return substr(hash_hmac('sha256', 'carlos|' . (int)$d['version'], secreto()), 0, 24); }
function carlosEnlace($d = null) { return CARLOS_WEB . '/carlos/' . carlosClave($d); }

/* Los contactos van en com.json (los mismos que «Otros destinatarios» del editor) */
function comLeerTodo() { $f = privado() . '/com.json'; return is_file($f) ? (json_decode(file_get_contents($f), true) ?: []) : []; }
function comGuardarTodo($c) { file_put_contents(privado() . '/com.json', json_encode($c, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), LOCK_EX); }
function carlosContactos() {
  return array_values(array_filter(comLeerTodo()['contactos'] ?? [], fn($c) => ($c['origen'] ?? '') === 'carlos'));
}
function cMovil($m) {
  $d = trim((string)$m); $mas = strncmp($d, '+', 1) === 0;
  $d = preg_replace('/\D/', '', $d);
  if (!$mas && strncmp($d, '00', 2) === 0) $d = substr($d, 2);
  if (!$mas && strlen($d) === 9 && preg_match('/^[6789]/', $d)) $d = '34' . $d;
  return strlen($d) >= 10 && strlen($d) <= 15 ? $d : '';
}
function cCorreo($c) { $c = strtolower(trim((string)$c)); return preg_match('/^[^@\s]+@[^@\s]+\.[^@\s]+$/', $c) ? $c : ''; }
function cBloqueo() { $fp = fopen(privado() . '/com.lock', 'c'); flock($fp, LOCK_EX); return $fp; }
function cSoltar($fp) { flock($fp, LOCK_UN); fclose($fp); }

/* ---------- el mensaje ---------- */
function cNombre($c) { $n = trim((string)($c['saludoNombre'] ?? '')) ?: trim((string)($c['nombre'] ?? '')); return $c['saludoNombre'] ?? '' ? $n : (preg_split('/\s+/', $n)[0] ?? ''); }
function cSaludo($c) { $n = cNombre($c); return 'Buenos días' . ($n !== '' ? ', ' . $n : '') . ':'; }
function cTextoWa($t, $c, $firma) { return cSaludo($c) . "\n\n" . trim($t['texto']) . ($firma !== '' ? "\n\n" . trim($firma) : ''); }
function cHtml($t, $c, $firma) {
  $e = fn($x) => htmlspecialchars((string)$x, ENT_QUOTES, 'UTF-8');
  $enl = fn($x) => preg_replace('#(https?://[^\s<]+)#', '<a href="$1" style="color:#7b1c2c">$1</a>', $x);
  $parr = '';
  foreach (preg_split('/\n\s*\n/', str_replace("\r", '', trim($t['texto']))) as $p) $parr .= '<p style="margin:0 0 14px">' . $enl(nl2br($e($p))) . '</p>';
  $F = 'Georgia,serif';
  return '<div style="background:#faf5ec;padding:24px 12px;font-family:' . $F . '"><div style="max-width:600px;margin:0 auto;background:#fffdf9;border-top:6px solid #7b1c2c;padding:28px 26px;color:#1d1719;font-size:17px;line-height:1.6">'
    . '<img src="' . CARLOS_WEB . '/logo.png" alt="PATRIAM" style="height:44px;margin-bottom:18px">'
    . '<p style="margin:0 0 14px">' . $e(cSaludo($c)) . '</p>' . $parr
    . ($firma !== '' ? '<p style="margin:22px 0 0">' . nl2br($e(trim($firma))) . '</p>' : '')
    . '</div><p style="max-width:600px;margin:12px auto 0;font-size:12px;color:#6b6163;text-align:center">Dios, Patria, Justicia · Si no quieres recibir estos mensajes, responde a este correo y te damos de baja.</p></div>';
}
function cClaves() { $f = privado() . '/claves.json'; return is_file($f) ? (json_decode(file_get_contents($f), true) ?: []) : []; }
function cAjustesCom() { return (comLeerTodo()['ajustes'] ?? []) + ['remitenteNombre' => 'PATRIAM', 'remitente' => 'comunicacion@movimientopatriam.es', 'responderA' => 'hola@movimientopatriam.com']; }
function cBrevo($para, $nombre, $asunto, $html, $texto, $etiqueta = 'comunicacion-carlos') {
  $k = cClaves(); $aj = cAjustesCom();
  if (empty($k['brevo'])) return [false, 'Falta la clave de Brevo'];
  $msg = ['sender' => ['name' => $aj['remitenteNombre'] ?: 'PATRIAM', 'email' => $aj['remitente']], 'to' => [array_filter(['email' => $para, 'name' => $nombre])],
    'subject' => $asunto, 'htmlContent' => $html, 'textContent' => $texto, 'tags' => [$etiqueta]];
  if (!empty($aj['responderA'])) $msg['replyTo'] = ['email' => $aj['responderA']];
  [$c, $r, $err] = pedir('https://api.brevo.com/v3/smtp/email', ['api-key: ' . $k['brevo'], 'Content-Type: application/json', 'Accept: application/json'], json_encode($msg, JSON_UNESCAPED_UNICODE));
  return [$c >= 200 && $c < 300, $c >= 200 && $c < 300 ? '' : ((json_decode($r, true)['message'] ?? '') ?: ($err ?: 'Brevo ' . $c))];
}
function cWhatsappApi() { $k = cClaves(); return waHay($k) ? $k : null; }
function cWhatsapp($k, $movil, $nombre, $texto) {
  $parr = array_filter(array_map(fn($x) => trim(preg_replace('/\s*\n\s*/', ' ', $x)), preg_split('/\n\s*\n/', str_replace("\r", '', $texto))));
  return waPlantilla($k, $movil, [$nombre ?: 'amigo', mb_substr(implode(' — ', $parr), 0, 1000) ?: '.']);
}

/* ---------- tandas: cada envío (una semana, un mes, o «enviar ahora») ---------- */
function cPeriodo($prog, $t = null) {
  $d = new DateTime($t ? '@' . $t : 'now'); $d->setTimezone(new DateTimeZone('Europe/Madrid'));
  return $prog === 'semanal' ? $d->format('o-\SW') : $d->format('Y-m');
}
function cNuevaTanda(&$d, $prog) {
  $p = $d['programas'][$prog];
  $t = ['id' => $prog[0] . date('ymdHi') . substr(bin2hex(random_bytes(2)), 0, 3), 'programa' => $prog, 'fecha' => gmdate('c'), 'periodo' => cPeriodo($prog),
    'asunto' => trim($p['asunto']) ?: ('Comunicación ' . $prog . ' de PATRIAM'), 'texto' => $p['texto'], 'firma' => $d['firma'],
    'correo' => [], 'errores' => [], 'whatsapp' => [], 'avisado' => false];
  array_unshift($d['tandas'], $t);
  $d['tandas'] = array_slice($d['tandas'], 0, 60);
  $d['hechos'][$prog] = cPeriodo($prog);
  return $t['id'];
}
/* Manda lo que falte de las tandas recientes: así quien se añade después también lo recibe (hasta 3 días después) */
function cProcesar(&$d) {
  $contactos = carlosContactos(); $api = cWhatsappApi(); $hecho = 0; $pers = [];
  foreach ($d['tandas'] as &$t) {
    if (strtotime($t['fecha']) < time() - 3 * 86400 || trim($t['texto']) === '') continue;
    foreach ($contactos as $c) {
      if (strtotime($c['alta'] ?? $t['fecha']) > time()) continue;
      $pc = codigoPersona('o:' . $c['id']);
      $pers[$pc] = ['nombre' => $c['nombre'] ?: ($c['movil'] ?: $c['email']), 'tipo' => CARLOS_NOTA];
      $e = cCorreo($c['email'] ?? '');
      if ($e && !in_array($e, $t['correo'], true) && empty($t['errores'][$c['id']])) {
        $h = seguirEnlacesHtml(cHtml($t, $c, $t['firma']), $pc, $t['id']);
        $tx = seguirEnlacesTexto(cTextoWa($t, $c, $t['firma']), $pc, $t['id']);
        [$ok, $m] = cBrevo($e, $c['nombre'] ?? '', $t['asunto'], $h, $tx);
        if ($ok) $t['correo'][] = $e; else $t['errores'][$c['id']] = 'Correo: ' . mb_substr($m, 0, 150);
        $hecho++;
      }
      $mv = cMovil($c['movil'] ?? '');
      if ($api && $mv && !in_array($mv, $t['whatsapp'], true) && empty($t['erroresWa'][$c['id']])) {
        [$ok, $m] = cWhatsapp($api, $mv, cNombre($c), seguirEnlacesTexto($t['texto'] . "\n\n" . $t['firma'], $pc, $t['id']));
        if ($ok) $t['whatsapp'][] = $mv; else $t['erroresWa'][$c['id']] = 'WhatsApp: ' . mb_substr($m, 0, 150);
        $hecho++;
      }
    }
  }
  unset($t);
  guardarPersonas($pers);
  return $hecho;
}
function cPendientesWa($t, $contactos) {
  $res = [];
  foreach ($contactos as $c) { $mv = cMovil($c['movil'] ?? ''); if ($mv && !in_array($mv, $t['whatsapp'], true)) $res[] = $c; }
  return $res;
}
/* Aviso a Carlos: qué ha salido solo y cuántos WhatsApp le quedan por mandar */
function cAvisar(&$d, $t) {
  $para = cCorreo($d['avisoA'] ?? ''); if (!$para) return;
  $quedan = count(cPendientesWa($t, carlosContactos()));
  $vacio = trim($t['texto']) === '';
  $enl = carlosEnlace($d);
  $asunto = $vacio ? 'Hoy toca la comunicación ' . $t['programa'] . ' y falta el texto' : 'Comunicación ' . $t['programa'] . ': ' . ($quedan ? "quedan $quedan WhatsApp por mandar" : 'ya ha salido');
  $cuerpo = $vacio ? 'Hoy tocaba la comunicación ' . $t['programa'] . ', pero no tiene texto. Escríbelo en tu página y pulsa «Enviar ahora».'
    : 'La comunicación ' . $t['programa'] . ' «' . $t['asunto'] . '» ha salido por correo a ' . count($t['correo']) . ' personas.'
      . ($quedan ? " Quedan $quedan por WhatsApp: entra en tu página y pulsa el botón de cada uno (se abre WhatsApp con el mensaje ya escrito)." : '');
  $html = '<div style="font-family:Georgia,serif;font-size:17px;line-height:1.6;color:#1d1719;max-width:560px">'
    . '<p>' . htmlspecialchars($cuerpo) . '</p><p><a href="' . $enl . '" style="display:inline-block;background:#7b1c2c;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none">Abrir mis comunicaciones</a></p></div>';
  cBrevo($para, 'Carlos', $asunto, $html, $cuerpo . "\n\n" . $enl, 'aviso-carlos');
}
/* Lo llama el cron cada hora */
function carlosRevisar($salida = false) {
  $fp = cBloqueo();
  $d = carlosLeer();
  $ahora = new DateTime('now', new DateTimeZone('Europe/Madrid'));
  $nuevas = [];
  foreach (['semanal', 'mensual'] as $prog) {
    $p = $d['programas'][$prog];
    if (empty($p['activo']) || $d['hechos'][$prog] === cPeriodo($prog)) continue;
    $toca = $prog === 'semanal' ? (int)$ahora->format('N') === (int)$p['dia'] : (int)$ahora->format('j') === min((int)$p['dia'], (int)$ahora->format('t'));
    if ($toca && (int)$ahora->format('G') >= (int)$p['hora']) $nuevas[] = cNuevaTanda($d, $prog);
  }
  $n = cProcesar($d);
  foreach ($d['tandas'] as &$t) if (in_array($t['id'], $nuevas, true) && !$t['avisado']) { cAvisar($d, $t); $t['avisado'] = true; }
  unset($t);
  carlosGuardar($d);
  cSoltar($fp);
  if ($salida) echo 'Comunicaciones de Carlos: ' . count($nuevas) . " nuevas, $n envíos\n";
}

/* ---------- la página ---------- */
if (basename($_SERVER['SCRIPT_FILENAME'] ?? '') !== basename(__FILE__) || PHP_SAPI === 'cli') return;   // incluido desde revisar.php / com.php

$d = carlosLeer();
if (!hash_equals(carlosClave($d), (string)($_GET['k'] ?? ''))) { http_response_code(404); header('Content-Type: text/html; charset=utf-8'); echo '<!doctype html><meta charset="utf-8"><p style="font-family:Georgia,serif;padding:2em">Este enlace no existe o ya no vale. Pide el nuevo a Isabel.</p>'; exit; }

$acc = $_GET['accion'] ?? '';
if ($acc !== '') {
  $in = json_decode(file_get_contents('php://input') ?: '{}', true) ?: [];
  $publico = function ($d) {
    $cont = carlosContactos();
    $tandas = array_map(function ($t) use ($cont) {
      $pend = trim($t['texto']) === '' ? [] : cPendientesWa($t, $cont);
      return ['id' => $t['id'], 'programa' => $t['programa'], 'fecha' => $t['fecha'], 'asunto' => $t['asunto'], 'texto' => $t['texto'], 'firma' => $t['firma'],
        'correos' => count($t['correo']), 'whatsapps' => count($t['whatsapp']), 'errores' => array_values(array_merge($t['errores'] ?? [], $t['erroresWa'] ?? [])),
        'pendientes' => strtotime($t['fecha']) > time() - 10 * 86400 ? array_map(fn($c) => ['id' => $c['id'], 'nombre' => $c['nombre'], 'wa' => cMovil($c['movil']), 'texto' => cTextoWa($t, $c, $t['firma'])], $pend) : []];
    }, array_slice($d['tandas'], 0, 20));
    $k = cClaves();
    return ['programas' => $d['programas'], 'firma' => $d['firma'], 'avisoA' => $d['avisoA'], 'contactos' => $cont, 'tandas' => $tandas,
      'servicios' => ['correo' => !empty($k['brevo']), 'whatsapp' => (bool)cWhatsappApi()]];
  };
  if ($_SERVER['REQUEST_METHOD'] !== 'POST' && $acc !== 'datos') salir(['error' => 'No válido'], 405);
  if ($acc === 'datos') salir($publico($d));

  $fp = cBloqueo();
  $d = carlosLeer();
  if ($acc === 'anadir') {
    $com = comLeerTodo(); $com['contactos'] = $com['contactos'] ?? [];
    $ya = []; foreach ($com['contactos'] as $c) { if ($m = cMovil($c['movil'] ?? '')) $ya[$m] = 1; if ($e = cCorreo($c['email'] ?? '')) $ya[$e] = 1; }
    $n = 0; $repes = 0; $malos = [];
    foreach (array_slice((array)($in['personas'] ?? []), 0, 1000) as $p) {
      $nombre = trim(mb_substr((string)($p['nombre'] ?? ''), 0, 120));
      $mv = cMovil($p['movil'] ?? ''); $e = cCorreo($p['email'] ?? '');
      if (!$mv && !$e) { if ($nombre !== '' || trim((string)($p['movil'] ?? '')) !== '') $malos[] = $nombre ?: (string)$p['movil']; continue; }
      if (($mv && isset($ya[$mv])) || ($e && isset($ya[$e]))) { $repes++; continue; }
      $com['contactos'][] = ['id' => 'k' . base_convert((string)(int)(microtime(true) * 1000), 10, 36) . bin2hex(random_bytes(2)), 'nombre' => $nombre,
        'email' => $e, 'movil' => $mv ? '+' . $mv : '', 'nota' => CARLOS_NOTA, 'origen' => 'carlos', 'alta' => gmdate('c')];
      if ($mv) $ya[$mv] = 1; if ($e) $ya[$e] = 1; $n++;
    }
    comGuardarTodo($com);
    cSoltar($fp);
    salir(['anadidos' => $n, 'repetidos' => $repes, 'malos' => $malos] + $publico(carlosLeer()));
  }
  if ($acc === 'quitar') {
    $com = comLeerTodo();
    $com['contactos'] = array_values(array_filter($com['contactos'] ?? [], fn($c) => !(($c['origen'] ?? '') === 'carlos' && ($c['id'] ?? '') === ($in['id'] ?? ''))));
    comGuardarTodo($com); cSoltar($fp); salir($publico($d));
  }
  if ($acc === 'guardar') {
    foreach (['semanal', 'mensual'] as $prog) {
      $p = $in['programas'][$prog] ?? null; if (!$p) continue;
      $d['programas'][$prog] = ['activo' => !empty($p['activo']), 'dia' => max(1, min($prog === 'semanal' ? 7 : 31, (int)$p['dia'])), 'hora' => max(6, min(22, (int)$p['hora'])),
        'asunto' => mb_substr(trim((string)$p['asunto']), 0, 200), 'texto' => mb_substr((string)$p['texto'], 0, 8000)];
    }
    if (isset($in['firma'])) $d['firma'] = mb_substr((string)$in['firma'], 0, 500);
    if (isset($in['avisoA'])) $d['avisoA'] = cCorreo($in['avisoA']);
    carlosGuardar($d); cSoltar($fp); salir(['ok' => true] + $publico($d));
  }
  if ($acc === 'ahora') {
    $prog = ($in['programa'] ?? '') === 'mensual' ? 'mensual' : 'semanal';
    if (trim($d['programas'][$prog]['texto']) === '') { cSoltar($fp); salir(['error' => 'Escribe primero el texto.'], 400); }
    cNuevaTanda($d, $prog); cProcesar($d); $d['tandas'][0]['avisado'] = true;
    carlosGuardar($d); cSoltar($fp); salir(['ok' => true] + $publico($d));
  }
  if ($acc === 'wa-hecho') {
    foreach ($d['tandas'] as &$t) if ($t['id'] === ($in['tanda'] ?? '')) {
      foreach (carlosContactos() as $c) if ($c['id'] === ($in['id'] ?? '') && ($mv = cMovil($c['movil']))) $t['whatsapp'] = array_values(array_unique(array_merge($t['whatsapp'], [$mv])));
    }
    unset($t);
    carlosGuardar($d); cSoltar($fp); salir($publico($d));
  }
  cSoltar($fp); salir(['error' => 'No existe'], 404);
}

header('Content-Type: text/html; charset=utf-8');
header('X-Robots-Tag: noindex, nofollow');
$base = htmlspecialchars('/carlos/' . carlosClave($d), ENT_QUOTES);
?><!doctype html>
<html lang="es"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow">
<title>Comunicaciones · PATRIAM</title>
<meta name="theme-color" content="#7b1c2c"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-title" content="Comunicaciones">
<link rel="icon" href="/icono-192.png"><link rel="apple-touch-icon" href="/icono-192.png">
<style>
@font-face{font-family:Spectral;src:url(/fuentes/spectral-latin-400-normal.woff2) format("woff2");font-weight:400}
@font-face{font-family:Spectral;src:url(/fuentes/spectral-latin-700-normal.woff2) format("woff2");font-weight:700}
:root{--crema:#faf5ec;--papel:#fffdf9;--tinta:#1d1719;--suave:#6b6163;--linea:#e4d9c7;--acento:#7b1c2c;--gualda:#a8873a;--verde:#1f6b3a}
*{box-sizing:border-box}body{margin:0;background:var(--crema);color:var(--tinta);font-family:Spectral,Georgia,serif;font-size:17px;line-height:1.5}
header{background:var(--acento);color:#fff;padding:14px 16px;display:flex;align-items:center;gap:12px}header img{height:34px}header h1{font-size:20px;margin:0}header small{display:block;opacity:.85;font-size:14px;font-weight:400}
main{max-width:720px;margin:0 auto;padding:12px 16px 60px}
section{background:var(--papel);border:1px solid var(--linea);border-radius:10px;padding:14px 16px;margin:14px 0}
h2{font-size:19px;margin:0 0 8px;color:var(--acento)}p.nota{color:var(--suave);font-size:15px;margin:4px 0 10px}
label{display:block;font-size:14px;color:var(--suave);margin:8px 0 2px}
input,select,textarea{width:100%;font:inherit;font-size:16px;padding:9px 10px;border:1px solid var(--linea);border-radius:6px;background:#fff}textarea{min-height:150px;resize:vertical}
.fila{display:flex;gap:8px;flex-wrap:wrap}.fila>*{flex:1 1 140px}
button{font:inherit;font-size:16px;border:0;border-radius:6px;padding:10px 14px;cursor:pointer;background:var(--acento);color:#fff}
button.claro{background:#f1e7d6;color:var(--tinta)}button.wa{background:#1f8f4e}button:disabled{opacity:.5}
.lista{list-style:none;padding:0;margin:8px 0 0}.lista li{display:flex;align-items:center;gap:8px;padding:8px 0;border-top:1px solid var(--linea)}
.lista li span{flex:1;min-width:0}.lista li small{display:block;color:var(--suave);font-size:14px}.lista li button{padding:6px 10px;font-size:15px}
.ok{color:var(--verde)}.err{color:#a0281e}.aviso{background:#fff4d6;border-color:#e8cf8a}
.chk{display:flex;gap:8px;align-items:center;color:var(--tinta);font-size:16px}.chk input{width:auto}
.prev{white-space:pre-wrap;background:#f7f1e6;border-radius:6px;padding:10px;font-size:15px;margin-top:8px}
.botones{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
#estado{position:fixed;bottom:12px;left:50%;transform:translateX(-50%);background:var(--tinta);color:#fff;padding:8px 14px;border-radius:20px;font-size:15px;display:none}
</style></head><body>
<header><img src="/logo-claro.png" alt="PATRIAM"><div><h1>Comunicaciones</h1><small>Carlos R. · semanal y mensual</small></div></header>
<main>
  <section id="pendientes" class="aviso" hidden></section>

  <section>
    <h2>Añadir personas</h2>
    <p class="nota">Nombre y móvil (y el correo, si lo tienes). Entran solas en la comunicación semanal y en la mensual.</p>
    <div class="fila"><div><label>Nombre</label><input id="nNombre" autocomplete="off" placeholder="Juan Pérez"></div>
      <div><label>Móvil</label><input id="nMovil" type="tel" inputmode="tel" placeholder="600 111 222"></div></div>
    <label>Correo <small>(opcional)</small></label><input id="nEmail" type="email" inputmode="email" placeholder="juan@correo.es">
    <div class="botones"><button id="btnAnadir">Añadir</button><button class="claro" id="btnPegarVer">Pegar una lista</button></div>
    <div id="pegar" hidden><p class="nota">Una persona por línea: <b>Nombre; móvil; correo</b> (se puede copiar de Excel).</p>
      <textarea id="pegarTxt" style="min-height:100px" placeholder="Juan Pérez; 600111222; juan@correo.es&#10;María López; 611222333"></textarea>
      <div class="botones"><button id="btnPegar">Añadir la lista</button></div></div>
  </section>

  <section>
    <h2>Mis contactos <small id="cuantos" style="color:var(--suave);font-weight:400"></small></h2>
    <input id="buscar" type="search" placeholder="Buscar…">
    <ul class="lista" id="contactos"></ul>
  </section>

  <section data-prog="semanal">
    <h2>Comunicación semanal</h2>
    <label class="chk"><input type="checkbox" data-k="activo"> Mandarla sola cada semana</label>
    <div class="fila"><div><label>Día</label><select data-k="dia"><?php foreach (CARLOS_DIAS as $n => $t) echo "<option value=\"$n\">$t</option>"; ?></select></div>
      <div><label>Hora</label><select data-k="hora"><?php for ($h = 6; $h <= 22; $h++) echo "<option value=\"$h\">$h:00</option>"; ?></select></div></div>
    <label>Asunto del correo</label><input data-k="asunto">
    <label>Texto <small>(el saludo «Buenos días, Nombre:» y la firma se ponen solos)</small></label><textarea data-k="texto"></textarea>
    <div class="prev" hidden></div>
    <div class="botones"><button data-guardar>Guardar</button><button class="claro" data-ver>Ver cómo queda</button><button class="claro" data-ahora>Enviar ahora</button></div>
  </section>

  <section data-prog="mensual">
    <h2>Comunicación mensual</h2>
    <label class="chk"><input type="checkbox" data-k="activo"> Mandarla sola cada mes</label>
    <div class="fila"><div><label>Día del mes</label><select data-k="dia"><?php for ($n = 1; $n <= 31; $n++) echo "<option value=\"$n\">$n" . ($n > 28 ? ' (o el último)' : '') . "</option>"; ?></select></div>
      <div><label>Hora</label><select data-k="hora"><?php for ($h = 6; $h <= 22; $h++) echo "<option value=\"$h\">$h:00</option>"; ?></select></div></div>
    <label>Asunto del correo</label><input data-k="asunto">
    <label>Texto <small>(el saludo «Buenos días, Nombre:» y la firma se ponen solos)</small></label><textarea data-k="texto"></textarea>
    <div class="prev" hidden></div>
    <div class="botones"><button data-guardar>Guardar</button><button class="claro" data-ver>Ver cómo queda</button><button class="claro" data-ahora>Enviar ahora</button></div>
  </section>

  <section>
    <h2>Firma y avisos</h2>
    <label>Firma <small>(va al final de cada mensaje)</small></label><textarea id="firma" style="min-height:80px"></textarea>
    <label>El día que toca, avisarme a este correo</label><input id="avisoA" type="email">
    <div class="botones"><button id="btnAjustes">Guardar</button></div>
    <p class="nota" id="servicios"></p>
  </section>

  <section><h2>Enviadas</h2><ul class="lista" id="historial"></ul></section>
  <p class="nota" style="text-align:center">Para tenerla como una app: en el móvil, menú del navegador › «Añadir a pantalla de inicio».</p>
</main>
<div id="estado"></div>
<script>
const BASE = <?= json_encode('/carlos/' . carlosClave($d)) ?>;
const DIAS = <?= json_encode(CARLOS_DIAS, JSON_UNESCAPED_UNICODE) ?>;
let D = null;
const $ = id => document.getElementById(id);
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
function aviso(t) { const e = $("estado"); e.textContent = t; e.style.display = "block"; clearTimeout(aviso.t); aviso.t = setTimeout(() => e.style.display = "none", 3000); }
async function api(accion, cuerpo) {
  const r = await fetch(BASE + "?accion=" + accion, cuerpo ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpo) } : {});
  const j = await r.json().catch(() => ({ error: "Respuesta no válida" }));
  if (!r.ok) throw new Error(j.error || "Error " + r.status);
  return j;
}
function fecha(iso) { return new Date(iso).toLocaleString("es-ES", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }); }
function nombrePila(c) { return (String(c.nombre || "").trim().split(/\s+/)[0]) || ""; }
function pintar() {
  // pendientes de WhatsApp
  const pend = D.tandas.filter(t => t.pendientes.length);
  const P = $("pendientes"); P.hidden = !pend.length;
  P.innerHTML = pend.map(t => '<h2>Por mandar por WhatsApp · ' + esc(t.programa) + '</h2><p class="nota">«' + esc(t.asunto) + '» · ' + fecha(t.fecha) + '. Pulsa cada nombre: se abre WhatsApp con el mensaje ya escrito; tú solo das a enviar.</p><ul class="lista">' +
    t.pendientes.map(p => '<li><span>' + esc(p.nombre || "+" + p.wa) + '<small>+' + esc(p.wa) + '</small></span><button class="wa" data-t="' + t.id + '" data-id="' + p.id + '">Enviar ▸</button></li>').join("") + "</ul>").join("");
  P.querySelectorAll("button.wa").forEach(b => b.onclick = async () => {
    const t = D.tandas.find(x => x.id === b.dataset.t), p = t.pendientes.find(x => x.id === b.dataset.id);
    window.open("https://wa.me/" + p.wa + "?text=" + encodeURIComponent(p.texto), "_blank");
    b.disabled = true;
    try { D = await api("wa-hecho", { tanda: t.id, id: p.id }); setTimeout(pintar, 800); } catch (e) { aviso(e.message); b.disabled = false; }
  });
  // contactos
  const q = $("buscar").value.trim().toLowerCase();
  $("cuantos").textContent = "· " + D.contactos.length;
  const lista = D.contactos.slice().reverse().filter(c => !q || (c.nombre + " " + c.movil + " " + c.email).toLowerCase().includes(q));
  $("contactos").innerHTML = lista.map(c => '<li><span>' + esc(c.nombre || "(sin nombre)") + '<small>' + esc([c.movil, c.email].filter(Boolean).join(" · ")) + '</small></span><button class="claro" data-q="' + esc(c.id) + '" title="Quitar">✕</button></li>').join("") ||
    '<li><span class="nota">Todavía no hay nadie.</span></li>';
  $("contactos").querySelectorAll("[data-q]").forEach(b => b.onclick = async () => {
    const c = D.contactos.find(x => x.id === b.dataset.q);
    if (!confirm("¿Quitar a " + (c.nombre || c.movil) + "?")) return;
    D = await api("quitar", { id: c.id }); pintar();
  });
  // programas
  document.querySelectorAll("[data-prog]").forEach(s => {
    const p = D.programas[s.dataset.prog];
    s.querySelectorAll("[data-k]").forEach(i => { if (document.activeElement === i) return; if (i.type === "checkbox") i.checked = !!p[i.dataset.k]; else i.value = p[i.dataset.k]; });
  });
  if (document.activeElement !== $("firma")) $("firma").value = D.firma;
  if (document.activeElement !== $("avisoA")) $("avisoA").value = D.avisoA;
  $("servicios").innerHTML = (D.servicios.correo ? '<span class="ok">✔ El correo sale solo.</span>' : '<span class="err">Falta conectar el correo (Brevo).</span>') + " " +
    (D.servicios.whatsapp ? '<span class="ok">✔ WhatsApp sale solo.</span>' : "WhatsApp: el día que toca te llega un aviso y aquí arriba tienes un botón por persona.");
  // historial
  $("historial").innerHTML = D.tandas.map(t => '<li><span>' + esc(t.asunto) + '<small>' + esc(t.programa) + " · " + fecha(t.fecha) + " · " + t.correos + " correos · " + t.whatsapps + " WhatsApp" +
    (t.pendientes.length ? " · faltan " + t.pendientes.length + " WhatsApp" : "") + (t.errores.length ? ' · <span class="err">' + t.errores.length + " con problemas</span>" : "") + "</small></span></li>").join("") || '<li><span class="nota">Todavía no se ha mandado ninguna.</span></li>';
}
function leerProgramas() {
  const r = {};
  document.querySelectorAll("[data-prog]").forEach(s => { const p = {}; s.querySelectorAll("[data-k]").forEach(i => p[i.dataset.k] = i.type === "checkbox" ? i.checked : i.value); r[s.dataset.prog] = p; });
  return r;
}
async function guardar(msg) { D = await api("guardar", { programas: leerProgramas(), firma: $("firma").value, avisoA: $("avisoA").value }); pintar(); aviso(msg || "Guardado ✓"); }
async function anadir(personas) {
  try {
    const r = await api("anadir", { personas }); D = r; pintar();
    aviso(r.anadidos + (r.anadidos === 1 ? " añadida" : " añadidas") + (r.repetidos ? " · " + r.repetidos + " ya estaban" : "") + (r.malos.length ? " · sin móvil ni correo válido: " + r.malos.join(", ") : ""));
    return r.anadidos > 0 || r.repetidos > 0;
  } catch (e) { aviso(e.message); return false; }
}
$("btnAnadir").onclick = async () => {
  const p = { nombre: $("nNombre").value, movil: $("nMovil").value, email: $("nEmail").value };
  if (!p.movil.trim() && !p.email.trim()) return aviso("Pon el móvil (o el correo).");
  if (await anadir([p])) { $("nNombre").value = $("nMovil").value = $("nEmail").value = ""; $("nNombre").focus(); }
};
$("btnPegarVer").onclick = () => $("pegar").hidden = !$("pegar").hidden;
$("btnPegar").onclick = async () => {
  const personas = $("pegarTxt").value.split(/\r?\n/).map(l => l.split(/[;\t]/).map(x => x.trim())).filter(p => p.join("")).map(([nombre, b, c]) => {
    let movil = b || "", email = c || ""; if (/@/.test(movil)) [movil, email] = [email, movil];
    return { nombre: nombre || "", movil, email };
  });
  if (await anadir(personas)) { $("pegarTxt").value = ""; $("pegar").hidden = true; }
};
$("buscar").oninput = pintar;
document.querySelectorAll("[data-prog]").forEach(s => {
  const prog = s.dataset.prog;
  s.querySelector("[data-guardar]").onclick = () => guardar().catch(e => aviso(e.message));
  s.querySelector("[data-ver]").onclick = () => {
    const pv = s.querySelector(".prev"), c = D.contactos[D.contactos.length - 1] || { nombre: "Juan" };
    const n = nombrePila(c);
    pv.hidden = false; pv.textContent = "Buenos días" + (n ? ", " + n : "") + ":\n\n" + s.querySelector('[data-k="texto"]').value.trim() + "\n\n" + $("firma").value.trim();
  };
  s.querySelector("[data-ahora]").onclick = async () => {
    if (!confirm("¿Mandar ya la comunicación " + prog + " a todos tus contactos? Cuenta como la de este " + (prog === "semanal" ? "semana" : "mes") + ".")) return;
    try { await guardar(); D = await api("ahora", { programa: prog }); pintar(); aviso("Enviada ✓"); window.scrollTo(0, 0); } catch (e) { aviso(e.message); }
  };
});
$("btnAjustes").onclick = () => guardar().catch(e => aviso(e.message));
api("datos").then(d => { D = d; pintar(); }).catch(e => aviso(e.message));
</script>
</body></html>
