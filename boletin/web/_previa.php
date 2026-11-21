<?php
/* Vista previa del equipo: enlace temporal (/previa/<token>) que solo se abre con su clave.
   Lo crean desde Publicar › Boletín los miembros del equipo; caduca el día siguiente a la salida del número. */
if (basename($_SERVER['SCRIPT_FILENAME'] ?? '') === basename(__FILE__)) { http_response_code(404); exit; }

function origenPrevia() {
  $h = $_SERVER['HTTP_HOST'] ?? 'boletin.movimientopatriam.es';
  return 'https://' . (preg_match('/^[a-z0-9.-]+$/i', $h) ? $h : 'boletin.movimientopatriam.es');
}
function cookiePrevia($p) { return hash_hmac('sha256', $p['token'] . '|' . $p['clave'], $p['token'] . 'patriam-previa'); }
/* Devuelve la vista previa si el token existe y no ha caducado; con $conCookie, además exige que se haya entrado con la clave */
function previaValida($d, $token, $conCookie = false) {
  $token = (string)$token;
  if (!preg_match('/^[0-9a-f]{24}$/', $token)) return null;
  foreach ($d['previas'] ?? [] as $p) {
    if (!hash_equals($p['token'], $token)) continue;
    if (strtotime($p['expira'] ?? '1970-01-01') < time()) return null;
    if ($conCookie && !hash_equals(cookiePrevia($p), (string)($_COOKIE['pv_' . $token] ?? ''))) return null;
    return $p;
  }
  return null;
}
