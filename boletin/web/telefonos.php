<?php
/* Teléfonos para mandar el boletín por WhatsApp (Publicar › Boletín › Teléfonos).
   - Es la misma lista de contactos que usan las comunicaciones de Carlos y «Otros destinatarios» del editor (com.json):
     lo que se mete aquí lo ven allí y al revés. No se duplica nada.
   - Solo la ven y la tocan quienes aprueban (Carlos e Isabel): son datos personales.
   - Sin WhatsApp Business: cada persona tiene su botón, que abre WhatsApp con el mensaje y el enlace ya escritos,
     y se apunta a quién se le ha mandado cada número del boletín (telefonos.json, en la carpeta privada). */
require_once __DIR__ . '/_privado.php';
require_once __DIR__ . '/carlos.php';   // comLeerTodo, comGuardarTodo, cMovil, cCorreo, cBloqueo…
permitirPublicar();
$yo = comprobarEquipoWeb();
if (empty($yo['puedeAprobar'])) salir(['error' => 'Los teléfonos solo los ven Carlos e Isabel.'], 403);

$acc = $_GET['accion'] ?? 'datos';
$in = json_decode(file_get_contents('php://input') ?: '{}', true) ?: [];
const TEL_NOTA = 'Boletín por WhatsApp';

function telLeer() { $f = privado() . '/telefonos.json'; $d = is_file($f) ? (json_decode(file_get_contents($f), true) ?: []) : []; return $d + ['envios' => [], 'texto' => ''] ; }
function telGuardar($d) {
  $lim = 'd-' . date('Y-m-d', time() - 30 * 86400);
  foreach (array_keys($d['envios'] ?? []) as $k) if (str_starts_with((string)$k, 'd-') && $k < $lim) unset($d['envios'][$k]); $f = privado() . '/telefonos.json'; file_put_contents($f . '.tmp', json_encode($d, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), LOCK_EX); rename($f . '.tmp', $f); @chmod($f, 0600); }
function telHoyDia() { return 'd-' . (new DateTime('now', new DateTimeZone('Europe/Madrid')))->format('Y-m-d'); }
function telTextoDiaBase() {
  return "Buenos días, {nombre}:\n\nAquí tienes «España al día» de hoy, {fecha}: las noticias políticas y económicas de España.\n\n{enlace}\n\nSi te sirve, reenvíalo.\n\nUn saludo,\nPATRIAM";
}
function telTextoBase() {
  return "Buenos días, {nombre}:\n\nYa tienes el boletín nº {numero} de PATRIAM, «Lo que hay que saber: con criterio».\n\n{enlace}\n\nSi te gusta, reenvíalo.\n\nUn saludo,\nPATRIAM";
}
function telPublico() {
  $t = telLeer(); $sus = susLeer();
  $f = privado() . '/mipatria-suscriptores.json'; $dia = is_file($f) ? (json_decode(file_get_contents($f), true) ?: []) : [];
  $cont = array_values(array_map(fn($c) => [
      'id' => $c['id'] ?? '', 'nombre' => $c['nombre'] ?? '', 'movil' => $c['movil'] ?? '', 'email' => $c['email'] ?? '',
      'nota' => $c['nota'] ?? '', 'origen' => $c['origen'] ?? '', 'alta' => $c['alta'] ?? '', 'wa' => empty($c['noWa']) && cMovil($c['movil'] ?? '') !== '',
      'abonado' => !empty($c['abonado']), 'quincenal' => ($sus[cCorreo($c['email'] ?? '')]['estado'] ?? '') === 'activo', 'diaria' => ($dia[cCorreo($c['email'] ?? '')]['estado'] ?? '') === 'activo',
      'waDiaria' => !empty($c['waDiaria']) && cMovil($c['movil'] ?? '') !== ''],
    comLeerTodo()['contactos'] ?? []));
  usort($cont, fn($a, $b) => strcasecmp($a['nombre'], $b['nombre']));
  $env = is_file(privado() . '/boletin-envios.json') ? (json_decode(file_get_contents(privado() . '/boletin-envios.json'), true) ?: []) : [];
  return ['whatsappApi' => (bool)cWhatsappApi(), 'brevo' => !empty(cClaves()['brevo']), 'enviosAuto' => (object)array_map(fn($r) => ['correo' => count($r['correo'] ?? []), 'whatsapp' => count($r['whatsapp'] ?? []), 'errores' => array_slice($r['errores'] ?? [], -5)], $env),
    'suscriptores' => count(array_filter($sus, fn($x) => ($x['estado'] ?? '') === 'activo')), 'diarios' => count(array_filter($dia, fn($x) => ($x['estado'] ?? '') === 'activo')),
    'contactos' => $cont, 'envios' => (object)$t['envios'], 'texto' => $t['texto'] ?: telTextoBase(), 'textoBase' => telTextoBase(),
    'hoyDia' => telHoyDia(), 'textoDia' => ($t['textoDia'] ?? '') ?: telTextoDiaBase(), 'textoDiaBase' => telTextoDiaBase()];
}

if ($acc === 'datos') salir(telPublico());
if ($_SERVER['REQUEST_METHOD'] !== 'POST') salir(['error' => 'No válido'], 405);

$fp = cBloqueo();
if ($acc === 'anadir') {
  // Cada persona: nombre, apellidos, correo, móvil, si es abonado y a qué recibe.
  //  · correo + «boletín quincenal» → lista de suscriptores del boletín (se le manda solo el día que sale)
  //  · correo + «España al día» → newsletter diaria (mipatria-suscriptores.json)
  //  · móvil + «WhatsApp» → lista de teléfonos (com.json, la misma de las comunicaciones de Carlos)
  $com = comLeerTodo(); $com['contactos'] = $com['contactos'] ?? [];
  $n = 0; $act = 0; $malos = [];
  foreach (array_slice((array)($in['personas'] ?? []), 0, 3000) as $p) {
    $nombre = trim(mb_substr((string)($p['nombre'] ?? ''), 0, 80)); $apell = trim(mb_substr((string)($p['apellidos'] ?? ''), 0, 120));
    $completo = trim($nombre . ' ' . $apell);
    $mv = cMovil($p['movil'] ?? ''); $e = cCorreo($p['email'] ?? '');
    $quiere = ['quincenal' => !isset($p['quincenal']) || !empty($p['quincenal']), 'diaria' => !empty($p['diaria']), 'whatsapp' => !isset($p['whatsapp']) || !empty($p['whatsapp']), 'waDiaria' => !empty($p['waDiaria'])];
    if (!$mv && !$e) { if ($completo !== '' || trim((string)($p['movil'] ?? '')) !== '') $malos[] = $completo ?: (string)$p['movil']; continue; }
    // ¿ya está? se completa en lugar de repetirlo
    $k = null;
    foreach ($com['contactos'] as $i => $c) if (($mv && cMovil($c['movil'] ?? '') === $mv) || ($e && cCorreo($c['email'] ?? '') === $e)) { $k = $i; break; }
    $datos = array_filter(['nombre' => $completo, 'saludoNombre' => $nombre, 'apellidos' => $apell, 'email' => $e, 'movil' => $mv ? '+' . $mv : ''], fn($v) => $v !== '');
    $datos['abonado'] = !empty($p['abonado']);
    if ($k === null) {
      $com['contactos'][] = ['id' => 'k' . base_convert((string)(int)(microtime(true) * 1000), 10, 36) . bin2hex(random_bytes(2)), 'nota' => TEL_NOTA, 'alta' => gmdate('c'), 'altaPor' => $yo['nombre'] ?? '']
        + $datos + ($quiere['whatsapp'] ? [] : ['noWa' => true]) + ($quiere['waDiaria'] && $mv ? ['waDiaria' => true] : []);
      $n++;
    } else {
      $com['contactos'][$k] = array_merge($com['contactos'][$k], $datos);
      if ($quiere['whatsapp']) unset($com['contactos'][$k]['noWa']); else $com['contactos'][$k]['noWa'] = true;
      if ($quiere['waDiaria'] && $mv) $com['contactos'][$k]['waDiaria'] = true;
      $act++;
    }
    if ($e && $quiere['quincenal']) { susAlta($e, $completo); $l = susLeer(); $l[$e]['origen'] = 'publicar'; $l[$e]['abonado'] = !empty($p['abonado']); susGuardar($l); }
    if ($e && $quiere['diaria']) {
      $f = privado() . '/mipatria-suscriptores.json'; $l = is_file($f) ? (json_decode(file_get_contents($f), true) ?: []) : [];
      $l[$e] = array_merge($l[$e] ?? [], ['estado' => 'activo', 'alta' => $l[$e]['alta'] ?? gmdate('c'), 'confirmado' => gmdate('c'), 'origen' => 'publicar · ' . ($yo['nombre'] ?? ''), 'nombre' => $completo]);
      file_put_contents($f . '.tmp', json_encode($l, JSON_UNESCAPED_UNICODE), LOCK_EX); rename($f . '.tmp', $f); @chmod($f, 0600);
    }
  }
  comGuardarTodo($com); cSoltar($fp);
  salir(['anadidos' => $n, 'repetidos' => $act, 'malos' => $malos] + telPublico());
}
if ($acc === 'editar') {
  $com = comLeerTodo();
  foreach ($com['contactos'] as &$c) if (($c['id'] ?? '') === ($in['id'] ?? '')) {
    if (isset($in['nombre'])) $c['nombre'] = trim(mb_substr((string)$in['nombre'], 0, 120));
    if (isset($in['movil'])) { $mv = cMovil($in['movil']); if (!$mv) { cSoltar($fp); salir(['error' => 'El móvil no es válido.'], 400); } $c['movil'] = '+' . $mv; }
    if (isset($in['email'])) $c['email'] = cCorreo($in['email']);
    if (isset($in['wa'])) { if ($in['wa']) unset($c['noWa']); else $c['noWa'] = true; }
    if (isset($in['waDiaria'])) { if ($in['waDiaria']) $c['waDiaria'] = true; else unset($c['waDiaria']); }
  }
  unset($c);
  comGuardarTodo($com); cSoltar($fp); salir(telPublico());
}
if ($acc === 'quitar') {
  $com = comLeerTodo();
  $com['contactos'] = array_values(array_filter($com['contactos'] ?? [], fn($c) => ($c['id'] ?? '') !== ($in['id'] ?? '')));
  comGuardarTodo($com); cSoltar($fp); salir(telPublico());
}
if ($acc === 'enviado') {   // apunta que a esta persona ya se le ha mandado el boletín nº N (o «España al día» de hoy: d-AAAA-MM-DD)
  $t = telLeer(); $id = (string)($in['id'] ?? '');
  $num = preg_match('/^d-\d{4}-\d{2}-\d{2}$/', (string)($in['numero'] ?? '')) ? (string)$in['numero'] : (string)(int)($in['numero'] ?? 0);
  if ($num === '0' || $id === '') { cSoltar($fp); salir(['error' => 'Faltan datos.'], 400); }
  if (!empty($in['quitar'])) unset($t['envios'][$num][$id]); else $t['envios'][$num][$id] = gmdate('c');
  telGuardar($t); cSoltar($fp); salir(telPublico());
}
if ($acc === 'texto') {
  $t = telLeer(); $t[($in['cual'] ?? '') === 'dia' ? 'textoDia' : 'texto'] = mb_substr((string)($in['texto'] ?? ''), 0, 3000);
  telGuardar($t); cSoltar($fp); salir(telPublico());
}
cSoltar($fp);
salir(['error' => 'Acción desconocida.'], 400);
