<?php
/* Enlaces de las comunicaciones personales: apunta quién ha pinchado qué y lleva a la página.
   Solo funciona con enlaces firmados por el servidor (no sirve para redirigir a cualquier sitio). */
require __DIR__ . '/_privado.php';
$u = (string)($_GET['u'] ?? ''); $p = (string)($_GET['p'] ?? ''); $k = (string)($_GET['k'] ?? ''); $s = (string)($_GET['s'] ?? '');
if (!preg_match('#^https?://#i', $u) || !preg_match('/^[0-9a-f]{12}$/', $p) || !hash_equals(firmaEnlace($u, $p, $k), $s)) {
  header('Location: ' . webBoletin() . '/', true, 302); exit;
}
if (!esRobot()) apuntar(['t' => 'clic', 'd' => mb_substr($u, 0, 500), 'p' => $p, 'k' => mb_substr($k, 0, 60), 'o' => 'comunicacion', 'v' => visitante()]);
// Si lleva al boletín, la visita queda como «llegó por una comunicación personal»
if (preg_match('#^https?://(boletin\.movimientopatriam\.es|boletinpatriam\.netlify\.app)(/|$)#i', $u)) {
  $partes = explode('#', $u, 2);
  $u = $partes[0] . (strpos($partes[0], '?') === false ? '?' : '&') . 'p=' . $p . (isset($partes[1]) ? '#' . $partes[1] : '');
}
header('Cache-Control: no-store');
header('Location: ' . $u, true, 302);
