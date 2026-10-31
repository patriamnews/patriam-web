<?php
/* Estadísticas del boletín, en Hostinger.
   - POST (público): la página del boletín avisa de cada visita, de cada clic en un enlace y de cada vez que alguien lo comparte.
   - GET ?accion=resumen&dias=30 (todos los usuarios del editor): el resumen para el editor.
   Sin cookies y sin guardar la IP: cada lector es una huella anónima que cambia cada día.
   Los enlaces que comparte un lector llevan un código (c), y así se sabe cuánta gente entra por cada reenvío. */
require __DIR__ . '/_privado.php';
permitirPublicar();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
  header('Cache-Control: no-store');
  $t = file_get_contents('php://input', false, null, 0, 4000);
  $e = json_decode($t ?: '{}', true);
  if (!is_array($e) || esRobot() || !in_array($e['t'] ?? '', ['visita', 'clic', 'compartir'], true)) { http_response_code(204); exit; }
  $cod = fn($v) => preg_match('/^[a-z0-9]{6,12}$/', (string)$v) ? (string)$v : '';
  $ev = ['t' => $e['t'], 'v' => visitante(), 'r' => mb_substr((string)($e['r'] ?? ''), 0, 160)];
  if ($e['t'] === 'visita') {
    if (!empty($e['e'])) $ev['e'] = 1;                                   // primera página de la visita
    if ($c = $cod($e['c'] ?? '')) $ev['c'] = $c;                         // llegó por un enlace compartido por otro lector
    if (preg_match('/^[0-9a-f]{12}$/', (string)($e['p'] ?? ''))) $ev['p'] = $e['p'];
    $ref = parse_url((string)($e['ref'] ?? ''), PHP_URL_HOST);
    if ($ref && !preg_match('/movimientopatriam|boletinpatriam/', $ref)) $ev['ref'] = mb_substr($ref, 0, 80);
  }
  if ($e['t'] === 'clic') { $ev['d'] = mb_substr((string)($e['d'] ?? ''), 0, 500); $ev['l'] = mb_substr((string)($e['l'] ?? ''), 0, 120); }
  if ($e['t'] === 'compartir') $ev['red'] = in_array($e['red'] ?? '', ['whatsapp', 'x', 'facebook', 'instagram', 'enlace', 'otro'], true) ? $e['red'] : 'otro';
  if ($c = $cod($e['cod'] ?? '')) $ev['cod'] = $c;                       // código de este lector (va en lo que comparta)
  apuntar($ev);
  http_response_code(204); exit;
}

/* ---------- resumen para todos los usuarios del editor ---------- */
if (($_GET['de'] ?? '') === 'web') comprobarEquipoWeb(); else comprobarSesion();   // desde Publicar, con el usuario de la web
$dias = max(1, min(400, (int)($_GET['dias'] ?? 30)));
$zona = new DateTimeZone('Europe/Madrid');
/* Un día concreto (hora de España): ?dia=2026-10-30 */
$diaSolo = preg_match('/^\d{4}-\d{2}-\d{2}$/', (string)($_GET['dia'] ?? '')) ? $_GET['dia'] : '';
if ($diaSolo) {
  $ini = (new DateTime($diaSolo . ' 00:00:00', $zona))->getTimestamp();
  $fin = (new DateTime($diaSolo . ' 00:00:00', $zona))->modify('+1 day')->getTimestamp();
  $dias = 1;
} else { $fin = time() + 60; $ini = time() - $dias * 86400; }
$desde = gmdate('c', $ini); $hasta = gmdate('c', $fin);
$ev = [];
$meses = [];
for ($t = $ini; $t <= $fin + 86400; $t += 86400 * 20) $meses[gmdate('Y-m', $t)] = 1;
$meses[gmdate('Y-m', $fin)] = 1;
foreach (array_keys($meses) as $mes) {
  $f = privado() . '/est/' . $mes . '.jsonl';
  if (!is_file($f)) continue;
  foreach (file($f, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $l) { $x = json_decode($l, true); if ($x && ($x['f'] ?? '') >= $desde && ($x['f'] ?? '') < $hasta) $ev[] = $x; }
}
usort($ev, fn($a, $b) => strcmp($a['f'], $b['f']));

$personas = is_file(privado() . '/personas.json') ? (json_decode(file_get_contents(privado() . '/personas.json'), true) ?: []) : [];
$com = is_file(privado() . '/com.json') ? (json_decode(file_get_contents(privado() . '/com.json'), true) ?: []) : [];
$asuntos = [];
foreach ($com['lista'] ?? [] as $x) $asuntos[$x['id'] ?? ''] = $x['asunto'] ?? '';
$dia = fn($f) => (new DateTime($f))->setTimezone($zona)->format($diaSolo ? 'H' : 'Y-m-d');

$tot = ['visitas' => 0, 'lectores' => 0, 'clics' => 0, 'compartidos' => 0, 'porReenvio' => 0, 'deComunicaciones' => 0];
$lectores = []; $porDia = []; $clicsPag = []; $entradas = 0; $paginas = []; $clics = []; $redes = []; $origen = []; $compartidos = []; $llegadas = []; $quien = []; $huellasP = [];
foreach ($ev as $x) {
  $v = $x['v'] ?? ''; $d = $dia($x['f']);
  $porDia[$d] = $porDia[$d] ?? ['visitas' => 0, 'lectores' => []];
  if ($x['t'] === 'visita') {
    $tot['visitas']++; $lectores[$v] = 1; $porDia[$d]['visitas']++; $porDia[$d]['lectores'][$v] = 1;
    $paginas[$x['r']] = ($paginas[$x['r']] ?? 0) + 1;
    if (!empty($x['e'])) {
      $entradas++;
      $o = !empty($x['c']) ? 'Enlace reenviado por otro lector' : (!empty($x['p']) ? 'Comunicación personal' : (!empty($x['ref']) ? $x['ref'] : 'Directo, WhatsApp o correo'));
      $origen[$o] = ($origen[$o] ?? 0) + 1;
    }
    if (!empty($x['c'])) { $tot['porReenvio']++; $llegadas[$x['c']][] = $x; }
  } elseif ($x['t'] === 'clic') {
    $tot['clics']++;
    $pc = $x['r'] ?? ''; $clicsPag[$pc] = $clicsPag[$pc] ?? ['clics' => 0, 'lectores' => []]; $clicsPag[$pc]['clics']++; $clicsPag[$pc]['lectores'][$v] = 1;
    if (!empty($x['p'])) {
      $tot['deComunicaciones']++; $huellasP[$x['p']][$v] = 1;
      $quien[] = ['fecha' => $x['f'], 'nombre' => $personas[$x['p']]['nombre'] ?? '(persona sin nombre)', 'como' => $personas[$x['p']]['tipo'] ?? '',
        'comunicacion' => $asuntos[$x['k'] ?? ''] ?? '', 'enlace' => $x['d'] ?? ''];
    } else {
      $k = ($x['d'] ?? '') . '|' . ($x['l'] ?? '');
      $clics[$k] = $clics[$k] ?? ['enlace' => $x['d'] ?? '', 'texto' => $x['l'] ?? '', 'veces' => 0, 'lectores' => []];
      $clics[$k]['veces']++; $clics[$k]['lectores'][$v] = 1;
    }
  } elseif ($x['t'] === 'compartir') {
    $tot['compartidos']++; $redes[$x['red']] = ($redes[$x['red']] ?? 0) + 1;
    if (!empty($x['cod'])) $compartidos[$x['cod']][] = $x;
  }
}
$tot['lectores'] = count($lectores);

/* Cada reenvío: desde dónde se compartió, por qué red, y cuánta gente entró por él (y si esos lo volvieron a compartir) */
$reenvios = [];
foreach (array_unique(array_merge(array_keys($compartidos), array_keys($llegadas))) as $c) {
  $sh = $compartidos[$c] ?? []; $ll = $llegadas[$c] ?? [];
  $redesC = array_values(array_unique(array_map(fn($x) => $x['red'], $sh)));
  $siguientes = 0;
  foreach ($ll as $l) if (!empty($l['cod']) && !empty($compartidos[$l['cod']])) $siguientes++;
  $reenvios[] = ['fecha' => ($sh[0]['f'] ?? ($ll[0]['f'] ?? '')), 'pagina' => ($sh[0]['r'] ?? ($ll[0]['r'] ?? '')), 'redes' => $redesC,
    'visitas' => count($ll), 'lectores' => count(array_unique(array_map(fn($x) => $x['v'], $ll))), 'loVolvieronACompartir' => $siguientes];
}
usort($reenvios, fn($a, $b) => $b['visitas'] <=> $a['visitas'] ?: strcmp($b['fecha'], $a['fecha']));

/* Posible reenvío de una comunicación: el mismo enlace personal abierto desde varios teléfonos u ordenadores */
$reenviosCom = [];
foreach ($huellasP as $p => $vs) if (count($vs) > 1) $reenviosCom[] = ['nombre' => $personas[$p]['nombre'] ?? '', 'dispositivos' => count($vs)];

arsort($paginas); arsort($redes); arsort($origen);
$clics = array_values($clics);
foreach ($clics as &$c) $c['lectores'] = count($c['lectores']);
unset($c);
usort($clics, fn($a, $b) => $b['veces'] <=> $a['veces']);
ksort($porDia);
$serie = [];
if ($diaSolo) { for ($h = 0; $h < 24; $h++) { $k = sprintf('%02d', $h); $serie[] = ['dia' => $k . ':00', 'visitas' => $porDia[$k]['visitas'] ?? 0, 'lectores' => count($porDia[$k]['lectores'] ?? [])]; } }
else for ($i = $dias - 1; $i >= 0; $i--) { $d = (new DateTime('@' . (time() - $i * 86400)))->setTimezone($zona)->format('Y-m-d'); $serie[] = ['dia' => $d, 'visitas' => $porDia[$d]['visitas'] ?? 0, 'lectores' => count($porDia[$d]['lectores'] ?? [])]; }
$porPagina = [];
foreach ($paginas as $k => $n) $porPagina[$k] = ['pagina' => $k, 'visitas' => $n, 'clics' => 0, 'lectoresClic' => 0];
foreach ($clicsPag as $k => $c) { $porPagina[$k] = $porPagina[$k] ?? ['pagina' => $k, 'visitas' => 0, 'clics' => 0, 'lectoresClic' => 0]; $porPagina[$k]['clics'] = $c['clics']; $porPagina[$k]['lectoresClic'] = count($c['lectores']); }
usort($porPagina, fn($a, $b) => $b['visitas'] <=> $a['visitas'] ?: $b['clics'] <=> $a['clics']);
$tot['entradas'] = $entradas;
salir(['dias' => $dias, 'dia' => $diaSolo, 'porHoras' => (bool)$diaSolo, 'totales' => $tot, 'porDia' => $serie, 'porPagina' => array_slice($porPagina, 0, 40),
  'paginas' => array_slice(array_map(fn($k, $n) => ['pagina' => $k, 'visitas' => $n], array_keys($paginas), $paginas), 0, 25),
  'origen' => array_map(fn($k, $n) => ['origen' => $k, 'visitas' => $n], array_keys($origen), $origen),
  'redes' => array_map(fn($k, $n) => ['red' => $k, 'veces' => $n], array_keys($redes), $redes),
  'clics' => array_slice($clics, 0, 40), 'reenvios' => array_slice($reenvios, 0, 40),
  'quien' => array_slice(array_reverse($quien), 0, 300), 'reenviosComunicacion' => $reenviosCom]);
