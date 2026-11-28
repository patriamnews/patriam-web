<?php
/* Liquidación del diseñador: lo que le corresponde de cada pedido pagado (su % del beneficio de sus prendas)
   y si ya se le ha transferido por Stripe. Solo para el equipo, con su sesión de Publicar. */
require_once __DIR__ . '/_comun.php';
if ($_SERVER['REQUEST_METHOD'] !== 'POST') salir(['error' => 'Método no permitido'], 405);
$p = json_decode(file_get_contents('php://input'), true) ?: [];
exigirEquipo($p);

$pedidos = [];
foreach (glob(privado() . '/pedidos/*.json') ?: [] as $f) {
  $d = json_decode(file_get_contents($f), true);
  if (!$d || empty($d['disenador'])) continue;
  $pedidos[] = [
    'referencia' => $d['referencia'] ?? basename($f, '.json'),
    'fecha' => $d['disenador']['fecha'] ?? ($d['creado'] ?? ''),
    'cobrado' => $d['pagado'] ?? null,
    'costeGelato' => $d['costeGelato'] ?? null,
    'estado' => $d['estado'] ?? '',
    'importe' => (float)$d['disenador']['importe'],
    'detalle' => $d['disenador']['detalle'] ?? [],
    'transferencia' => $d['disenador']['transferencia'] ?? null,
    'error' => !empty($d['disenador']['errorTransferencia']),
  ];
}
usort($pedidos, fn($a, $b) => strcmp($b['fecha'], $a['fecha']));
salir(['pedidos' => $pedidos, 'automatico' => (bool)preg_match('/^acct_/', (string)(claves()['stripeDisenador'] ?? ''))]);
