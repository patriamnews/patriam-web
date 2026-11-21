<?php
/* Envío automático del boletín quincenal (lo lanza revisar.php, el cron de Hostinger, cada hora).
   - El día que sale cada boletín (su fecha en Publicar), a partir de las 8:00, se manda una vez:
       · por correo (Brevo) a cada suscriptor activo del boletín (boletin-suscriptores.json);
       · por WhatsApp a cada teléfono de la lista, SOLO si está puesta la API de WhatsApp Business (claves de envío).
         Sin la API, se mandan a mano desde Publicar › Boletín › Teléfonos WhatsApp (un botón por persona).
   - Solo entra lo aprobado. Lo enviado queda apuntado en boletin-envios.json y no se repite. */
require_once __DIR__ . '/_privado.php';
require_once __DIR__ . '/carlos.php';   // comLeerTodo, cBrevo, cWhatsappApi, cWhatsapp, cMovil, cNombre

const BE_WEB = 'https://boletin.movimientopatriam.es';
const BE_HORA = 8;

function beLeer() { $f = privado() . '/boletin-envios.json'; return is_file($f) ? (json_decode(file_get_contents($f), true) ?: []) : []; }
function beGuardar($d) { $f = privado() . '/boletin-envios.json'; file_put_contents($f . '.tmp', json_encode($d, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), LOCK_EX); rename($f . '.tmp', $f); @chmod($f, 0600); }

/* Lo aprobado del nº N: lo subido desde Publicar y lo preparado (importar.js) que alguien ha aprobado */
function bePiezas($num) {
  $ap = is_file(privado() . '/aportaciones.json') ? (json_decode(file_get_contents(privado() . '/aportaciones.json'), true) ?: []) : [];
  $res = [];
  foreach ($ap['items'] ?? [] as $x) if (($x['estado'] ?? '') === 'aprobado' && (int)($x['numero'] ?? 0) === (int)$num && in_array($x['tipo'], ['firma', 'noticia', 'recomendacion', 'editorial'], true)) $res[] = [$x['tipo'], $x['datos'], $x['id']];
  $t = @file_get_contents(__DIR__ . '/importar.js') ?: '';
  foreach (['PATRIAM_IMPORTAR' => 'firma', 'PATRIAM_RECOMENDAR' => 'recomendacion'] as $n => $tipo) {
    if (!preg_match('/window\.' . $n . '\s*=\s*(\[.*?\n\]);/s', $t, $m)) continue;
    foreach (json_decode($m[1], true) ?: [] as $x) {
      $id = ($tipo === 'firma' ? 'imp-' : 'rec-') . ($x['id'] ?? ''); $c = $ap['cambios'][$id] ?? [];
      if ((int)($x['numero'] ?? 0) !== (int)$num || empty($c['aprobado']) || !empty($c['quitado'])) continue;
      $res[] = [$tipo, array_merge($x, $c['datos'] ?? []), $id];
    }
  }
  return $res;
}
/* «Lo que puede correr más»: puntuación sencilla para proponer la pieza principal (solo artículos de PATRIAM).
   Pesan la imagen, los nombres que todo el mundo conoce, las palabras que encienden, un titular corto y la sección. */
function beViralidad($d) {
  $t = mb_strtolower(($d['titulo'] ?? ($d['titular'] ?? '')) . ' ' . ($d['tema'] ?? ''));
  $tit = $d['titulo'] ?? ($d['titular'] ?? '');
  $p = !empty($d['imagen']) ? 3 : 0;
  $nombres = 0; foreach (['sánchez', 'aznar', 'feijóo', 'abascal', 'psoe', ' pp ', 'pp,', 'pp:', 'vox', 'eta', 'bildu', 'puigdemont', 'begoña', 'rey', 'papa', 'ayuso', 'illa', 'otegi', 'zapatero', 'podemos', 'sumar', 'yolanda'] as $n) if (str_contains(' ' . $t . ' ', $n)) $nombres += 3;
  $p += min(6, $nombres);
  $fuego = 0; foreach (['vergüenza', 'burka', 'feminis', 'diablo', 'mentira', 'corrup', 'okupa', 'inmigra', 'aborto', 'eutanasia', 'traición', 'confirma', 'por fin', 'nadie', 'escándalo', 'prohib', 'censura', 'persecu', 'iglesia', 'familia', 'impuesto', 'pagan'] as $w) if (str_contains($t, $w)) $fuego += 2;
  $p += min(4, $fuego);
  $len = mb_strlen($tit); $p += $len && $len <= 60 ? 2 : ($len <= 85 ? 1 : 0);
  if (str_contains($tit, ':') || str_contains($tit, '?')) $p += 1;
  $p += ['Actualidad' => 1, 'Sociedad' => 1, 'Análisis' => 0, 'Historia' => -1][$d['seccion'] ?? ''] ?? 0;
  return $p;
}
/* La pieza principal del nº N: la que se eligió en Publicar o, si no, el artículo con más tirón */
function bePrincipal($num, $piezas) {
  $ap = is_file(privado() . '/aportaciones.json') ? (json_decode(file_get_contents(privado() . '/aportaciones.json'), true) ?: []) : [];
  $elegida = $ap['principal'][(string)(int)$num] ?? '';
  foreach ($piezas as $k => $p) if ($elegida && ($p[2] ?? '') === $elegida) return $k;
  $mejor = null; $max = -99;
  foreach ($piezas as $k => [$tipo, $d]) if ($tipo === 'firma' && ($v = beViralidad($d)) > $max) { $max = $v; $mejor = $k; }
  return $mejor;
}
function beEnlacePieza($tipo, $d, $id, $url) {
  if ($tipo === 'firma') return BE_WEB . '/#/colaboracion/' . rawurlencode(preg_replace('/^imp-/', '', (string)$id));
  if ($tipo === 'noticia' && !empty($d['url'])) return $d['url'];
  return $url;
}
function beCorreo($num, $fecha, $piezas, $nombre, $kp = null) {
  $e = fn($x) => htmlspecialchars((string)$x, ENT_QUOTES, 'UTF-8');
  $url = BE_WEB . '/?n=' . $num;
  $btn = fn($u, $t) => '<p style="text-align:center;margin:18px 0 6px"><a href="' . $e($u) . '" style="background:#7b1c2c;color:#fff;padding:12px 26px;border-radius:24px;text-decoration:none;font-family:Arial,sans-serif">' . $e($t) . '</a></p>';
  $html = '<div style="background:#faf5ec;padding:24px 12px;font-family:Georgia,serif"><div style="max-width:620px;margin:0 auto;background:#fffdf9;border-top:6px solid #7b1c2c;padding:26px;color:#1d1719">'
    . '<img src="' . BE_WEB . '/logo.png" alt="PATRIAM" style="height:44px"><p style="font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#7b1c2c;margin:16px 0 4px">Boletín nº ' . $e($num) . ' · ' . $e($fecha) . '</p>'
    . '<h1 style="font-size:26px;margin:0 0 6px">Lo que hay que saber</h1><p style="margin:0 0 18px;color:#6b5d55;font-style:italic">con criterio</p>'
    . '<p style="font-size:17px">Buenos días' . ($nombre ? ', ' . $e($nombre) : '') . ':</p><p style="font-size:17px">Ya tienes el nuevo boletín de PATRIAM.</p>';
  $txt = "Buenos días" . ($nombre ? ", $nombre" : '') . ":\n\nYa tienes el boletín nº $num de PATRIAM, «Lo que hay que saber: con criterio».\n\n";
  if ($kp === null) $kp = bePrincipal($num, $piezas);
  // La principal, a lo grande
  if ($kp !== null && isset($piezas[$kp])) {
    [$tipo, $d, $id] = $piezas[$kp] + [2 => ''];
    $tit = $d['titulo'] ?? ($d['titular'] ?? ''); $quien = $d['autor'] ?? ($d['comenta'] ?? ($d['firma'] ?? ''));
    $txto = $d['entradilla'] ?? ($d['resumen'] ?? '');
    $html .= '<div style="border-top:3px solid #a8873a;padding:16px 0 6px"><p style="margin:0 0 8px;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#a8873a;font-family:Arial,sans-serif">Lo más destacado</p>'
      . (!empty($d['imagen']) ? '<img src="' . $e($d['imagen']) . '" alt="" style="width:100%;max-height:340px;object-fit:cover;margin-bottom:10px">' : '')
      . '<b style="font-size:24px;line-height:1.25">' . $e($tit) . '</b>' . ($quien ? '<br><span style="color:#7b1c2c;font-size:15px">' . $e($quien) . '</span>' : '')
      . ($txto ? '<p style="margin:8px 0 0;font-size:17px;line-height:1.5">' . $e(mb_substr($txto, 0, 400)) . '</p>' : '')
      . $btn(beEnlacePieza($tipo, $d, $id, $url), $tipo === 'firma' ? 'Leer el artículo' : 'Leer más') . '</div>';
    $txt .= "Lo más destacado: «" . $tit . "»" . ($quien ? " ($quien)" : '') . "\n" . beEnlacePieza($tipo, $d, $id, $url) . "\n\nAdemás, en este número:\n";
  } else $txt .= "En este número:\n";
  // El resto, en pequeño
  $resto = '';
  foreach ($piezas as $k => [$tipo, $d]) {
    if ($k === $kp) continue;
    $tit = $d['titulo'] ?? ($d['titular'] ?? ''); if ($tit === '') continue;
    $quien = $d['autor'] ?? ($d['comenta'] ?? ($d['firma'] ?? ''));
    $resto .= '<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-top:1px solid #eadfcb"><tr>'
      . (!empty($d['imagen']) ? '<td width="96" valign="top" style="width:96px;padding:12px 12px 12px 0"><img src="' . $e($d['imagen']) . '" alt="" width="96" style="display:block;width:96px;height:auto"></td>' : '')
      . '<td valign="top" style="padding:12px 0"><b style="font-size:17px">' . $e($tit) . '</b>' . ($quien ? '<br><span style="color:#7b1c2c;font-size:14px">' . $e($quien) . '</span>' : '') . '</td></tr></table>';
    $txt .= "· $tit" . ($quien ? " ($quien)" : '') . "\n";
  }
  if ($resto) $html .= '<p style="margin:22px 0 4px;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#7b1c2c;font-family:Arial,sans-serif">Además, en este número</p>' . $resto;
  // Al final, el boletín completo
  $html .= '<div style="border-top:1px solid #eadfcb;margin-top:8px;padding-top:6px">' . $btn($url, 'Leer el boletín completo') . '</div>'
    . '<p style="font-size:12px;color:#8a7a6e;text-align:center;margin-top:18px">Dios · Patria · Justicia<br>Si no quieres recibirlo más, <a href="' . BE_WEB . '/#/baja" style="color:#8a7a6e">date de baja aquí</a>.</p></div></div>';
  $txt .= "\nLee el boletín completo: $url\n\nDios · Patria · Justicia\nPara darte de baja: " . BE_WEB . "/#/baja";
  return [$html, $txt];
}
/* Texto de WhatsApp del boletín: la principal arriba y el enlace al boletín completo abajo */
function beTextoWhatsapp($num, $piezas, $kp = null) {
  if ($kp === null) $kp = bePrincipal($num, $piezas);
  $t = "Ya tienes el boletín nº $num de PATRIAM, «Lo que hay que saber: con criterio».";
  if ($kp !== null && isset($piezas[$kp])) { $d = $piezas[$kp][1]; $t .= "\n\nLo más destacado: *" . ($d['titulo'] ?? ($d['titular'] ?? '')) . "*\n" . beEnlacePieza($piezas[$kp][0], $d, $piezas[$kp][2] ?? '', BE_WEB . '/?n=' . $num); }
  return $t . "\n\nLee el boletín completo: " . BE_WEB . '/?n=' . $num;
}
/* Manda el nº N a todos (correo y, si hay API, WhatsApp). Sirve para el cron y para el botón «Enviar» de Publicar.
   Lo ya enviado no se repite. Devuelve [correos, whatsapps, errores nuevos]. */
function beEnviarNumero($num, &$env) {
  $num = (string)(int)$num; $piezas = bePiezas($num);
  if (!$piezas) return null;
  $z = new DateTimeZone('Europe/Madrid'); $ahora = new DateTime('now', $z);
  $r = &$env[$num]; $r = ($r ?? []) + ['correo' => [], 'whatsapp' => [], 'errores' => []];
  $fechaL = $ahora->format('j') . ' de ' . ['', 'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'][(int)$ahora->format('n')];
  $kp = bePrincipal($num, $piezas); $nc = 0; $nw = 0; $ne = count($r['errores']);
  foreach (susLeer() as $email => $s) {
    if (($s['estado'] ?? '') !== 'activo' || isset($r['correo'][$email])) continue;
    $nom = preg_split('/\s+/', trim((string)($s['nombre'] ?? '')))[0] ?? '';
    [$html, $txt] = beCorreo($num, $fechaL, $piezas, $nom, $kp);
    $tit = $kp !== null ? ($piezas[$kp][1]['titulo'] ?? ($piezas[$kp][1]['titular'] ?? '')) : '';
    [$ok, $m] = cBrevo($email, $s['nombre'] ?? '', 'Boletín nº ' . $num . ($tit ? ' · ' . $tit : ' · Lo que hay que saber'), $html, $txt, 'boletin-quincenal');
    if ($ok) { $r['correo'][$email] = gmdate('c'); $nc++; } else $r['errores'][] = ['fecha' => gmdate('c'), 'a' => $email, 'motivo' => mb_substr($m, 0, 160)];
  }
  if ($k = cWhatsappApi()) {
    $tel = is_file(privado() . '/telefonos.json') ? (json_decode(file_get_contents(privado() . '/telefonos.json'), true) ?: []) : [];
    $msj = beTextoWhatsapp($num, $piezas, $kp);
    foreach (comLeerTodo()['contactos'] ?? [] as $c) {
      $mv = cMovil($c['movil'] ?? ''); if (!$mv || !empty($c['noWa']) || isset($r['whatsapp'][$mv])) continue;
      [$ok, $m] = cWhatsapp($k, $mv, cNombre($c), $msj);
      if ($ok) { $r['whatsapp'][$mv] = gmdate('c'); $tel['envios'][$num][$c['id'] ?? $mv] = gmdate('c'); $nw++; }
      else $r['errores'][] = ['fecha' => gmdate('c'), 'a' => '+' . $mv, 'motivo' => mb_substr($m, 0, 160)];
    }
    file_put_contents(privado() . '/telefonos.json', json_encode($tel + ['envios' => [], 'texto' => ''], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), LOCK_EX);
  }
  $nuevos = count($r['errores']) - $ne;
  $r['errores'] = array_slice($r['errores'], -50);
  $r['enviado'] = gmdate('c');
  unset($r);
  return [$nc, $nw, $nuevos];
}

function boletinRevisar($salida = false) {
  $z = new DateTimeZone('Europe/Madrid'); $ahora = new DateTime('now', $z); $hoy = $ahora->format('Y-m-d');
  if ((int)$ahora->format('G') < BE_HORA) return;
  $ap = is_file(privado() . '/aportaciones.json') ? (json_decode(file_get_contents(privado() . '/aportaciones.json'), true) ?: []) : [];
  $fp = fopen(privado() . '/boletin-envios.lock', 'c'); flock($fp, LOCK_EX);
  $env = beLeer(); $nc = 0; $nw = 0;
  foreach ($ap['boletines'] ?? [] as $b) {
    if (($b['fecha'] ?? '') !== $hoy) continue;
    $res = beEnviarNumero($b['numero'], $env);
    if (!$res) { if ($salida) echo "Boletín nº {$b['numero']}: no hay nada aprobado, no se manda\n"; continue; }
    $nc += $res[0]; $nw += $res[1];
  }
  beGuardar($env);
  flock($fp, LOCK_UN); fclose($fp);
  if ($salida) echo "Boletín: $nc correos y $nw WhatsApp enviados\n";
}
/* Botón «Enviar» de Publicar: manda ya el nº N (lo que no se haya mandado todavía) */
function boletinEnviarYa($num) {
  $fp = fopen(privado() . '/boletin-envios.lock', 'c'); flock($fp, LOCK_EX);
  $env = beLeer(); $res = beEnviarNumero($num, $env); beGuardar($env);
  flock($fp, LOCK_UN); fclose($fp);
  return $res;
}
function boletinEstadoEnvio($num) { $r = beLeer()[(string)(int)$num] ?? []; return ['correos' => count($r['correo'] ?? []), 'whatsapp' => count($r['whatsapp'] ?? []), 'enviado' => $r['enviado'] ?? '', 'errores' => array_slice($r['errores'] ?? [], -3)]; }
