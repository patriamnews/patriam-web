<?php
/* RRSS (Publicar › RRSS): las cuentas de redes de cada persona del equipo y el seguimiento de seguidores.
   Cada uno ve y guarda solo lo suyo (va unido a su sesión de Publicar). Se guarda en la carpeta privada
   del servidor, fuera de la web y de GitHub. */
require_once __DIR__ . '/_comun.php';
if ($_SERVER['REQUEST_METHOD'] !== 'POST') salir(['error' => 'Método no permitido'], 405);
$p = json_decode(file_get_contents('php://input'), true) ?: [];
$h = exigirEquipo($p);

$f = privado() . '/rrss.json';
$todo = is_file($f) ? (json_decode(file_get_contents($f), true) ?: []) : [];
$mio = $todo[$h] ?? ['cuentas' => []];

$REDES = ['x', 'instagram', 'facebook', 'tiktok', 'youtube', 'telegram', 'whatsapp', 'linkedin'];
$texto = fn($v, $n) => mb_substr(trim((string)$v), 0, $n);

if (isset($p['cuentas']) && is_array($p['cuentas'])) {
  $cuentas = [];
  foreach (array_slice($p['cuentas'], 0, 40) as $c) {
    if (!is_array($c) || !in_array($c['red'] ?? '', $REDES, true)) continue;
    $enlace = $texto($c['enlace'] ?? '', 300);
    if ($enlace !== '' && !preg_match('#^https://#i', $enlace)) $enlace = '';
    $registro = [];
    foreach (array_slice((array)($c['registro'] ?? []), -200) as $r) {
      $fecha = (string)($r['fecha'] ?? '');
      if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $fecha)) continue;
      $registro[] = ['fecha' => $fecha, 'seguidores' => max(0, (int)($r['seguidores'] ?? 0))];
    }
    usort($registro, fn($a, $b) => strcmp($a['fecha'], $b['fecha']));
    $cuentas[] = [
      'id' => preg_match('/^[a-z0-9]{4,20}$/', (string)($c['id'] ?? '')) ? $c['id'] : bin2hex(random_bytes(5)),
      'red' => $c['red'], 'usuario' => $texto($c['usuario'] ?? '', 80), 'enlace' => $enlace, 'registro' => $registro,
    ];
  }
  $mio['cuentas'] = $cuentas;
  $todo[$h] = $mio;
  file_put_contents($f, json_encode($todo, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), LOCK_EX);
  @chmod($f, 0600);
}
salir(['cuentas' => $mio['cuentas'] ?? []]);
