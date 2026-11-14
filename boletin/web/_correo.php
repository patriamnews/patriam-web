<?php
/* Artículos que llegan por correo a hola@movimientopatriam.com → boletín abierto, pendientes de aprobación.
   Solo se cogen los correos cuyo asunto empieza por «ARTICULO» (o «ARTÍCULO») seguido del nombre de quien firma:
     ARTICULO Rubén Fernández Arteaga
     ARTICULO Julio García - Historia        (opcional: la sección detrás de un guion)
   El texto sale del Word (.docx) o PDF adjunto; si no hay adjunto, del cuerpo del correo. La primera foto adjunta es la imagen.
   No se toca nada del buzón: no se marca como leído, no se mueve, no se borra. Se apunta qué correos ya se han cogido.
   Usuario y contraseña del buzón: Publicar › Claves › «Hostinger · correo» (cuentas.json de la carpeta privada). */
if (basename($_SERVER['SCRIPT_FILENAME'] ?? '') === basename(__FILE__)) { http_response_code(404); exit; }

define('CORREO_SERVIDOR', getenv('PATRIAM_IMAP') ?: 'ssl://imap.hostinger.com:993');
const CORREO_USUARIO = 'hola@movimientopatriam.com';
const CORREO_CADA = 300;           // como mucho, una revisión cada 5 minutos
const SECCIONES_BOLETIN = ['Actualidad', 'Análisis', 'Historia', 'Sociedad'];

/* ---------- credenciales ---------- */
function correoCuenta() {
  // Las cuentas se guardan desde Publicar en la carpeta privada de la web; el boletín puede tener la suya al lado
  $sitios = array_merge([privado() . '/cuentas.json', dirname(__DIR__, 2) . '/patriam-privado/cuentas.json', dirname(__DIR__, 3) . '/patriam-privado/cuentas.json'],
    glob(dirname(__DIR__, 3) . '/*/patriam-privado/cuentas.json') ?: [], glob(dirname(__DIR__, 4) . '/*/patriam-privado/cuentas.json') ?: []);
  $c = [];
  foreach (array_unique($sitios) as $f) {
    $cu = @is_file($f) ? (json_decode((string)@file_get_contents($f), true) ?: []) : [];
    if (!empty($cu['hostinger-correo']['clave'])) { $c = $cu['hostinger-correo']; break; }
  }
  $u = trim((string)($c['usuario'] ?? '')) ?: CORREO_USUARIO;
  $k = (string)($c['clave'] ?? '');
  return $k !== '' ? [$u, $k] : null;
}

/* ---------- IMAP mínimo (sin la extensión imap de PHP, que ya no viene en PHP 8.4) ---------- */
class ImapSimple {
  private $s; private $n = 0;
  function __construct($servidor, $usuario, $clave) {
    $ctx = stream_context_create(['ssl' => ['verify_peer' => true, 'verify_peer_name' => true]]);
    $this->s = @stream_socket_client($servidor, $en, $es, 20, STREAM_CLIENT_CONNECT, $ctx);
    if (!$this->s) throw new Exception("No se puede conectar con el correo ($es)");
    stream_set_timeout($this->s, 30);
    fgets($this->s);
    [$ok] = $this->cmd('LOGIN ' . $this->q($usuario) . ' ' . $this->q($clave));
    if (!$ok) throw new Exception('El correo no acepta el usuario o la contraseña');
  }
  private function q($t) { return '"' . addcslashes($t, "\"\\") . '"'; }
  /* Devuelve [ok, texto con los literales ya dentro] */
  function cmd($c) {
    $tag = 'A' . (++$this->n);
    fwrite($this->s, "$tag $c\r\n");
    $out = '';
    while (($l = fgets($this->s)) !== false) {
      if (preg_match('/\{(\d+)\}\r\n$/', $l, $m)) {
        $out .= $l; $falta = (int)$m[1];
        while ($falta > 0 && !feof($this->s)) { $b = fread($this->s, min(65536, $falta)); if ($b === false || $b === '') break; $out .= $b; $falta -= strlen($b); }
        continue;
      }
      if (strpos($l, "$tag ") === 0) return [strpos($l, "$tag OK") === 0, $out, trim($l)];
      $out .= $l;
    }
    throw new Exception('Se ha cortado la conexión con el correo');
  }
  function salir() { try { $this->cmd('LOGOUT'); } catch (Exception $e) {} @fclose($this->s); }
}
/* Partes «{n}\r\n<n bytes>» de una respuesta FETCH, por UID */
function imapLiterales($r) {
  $res = []; $p = 0;
  while (preg_match('/\* \d+ FETCH \(.*?UID (\d+).*?\{(\d+)\}\r\n/s', $r, $m, PREG_OFFSET_CAPTURE, $p)) {
    $ini = $m[0][1] + strlen($m[0][0]); $n = (int)$m[2][0];
    $res[(int)$m[1][0]] = substr($r, $ini, $n); $p = $ini + $n;
  }
  return $res;
}

/* ---------- MIME ---------- */
function mimeCabeceras($t) {
  $t = preg_replace("/\r\n[ \t]+/", ' ', $t); $c = [];
  foreach (preg_split("/\r?\n/", $t) as $l) if (preg_match('/^([A-Za-z0-9-]+):\s*(.*)$/', $l, $m)) { $k = strtolower($m[1]); if (!isset($c[$k])) $c[$k] = $m[2]; }
  return $c;
}
function mimeDecodificaCab($v) {
  $r = @iconv_mime_decode($v, ICONV_MIME_DECODE_CONTINUE_ON_ERROR, 'UTF-8');
  return $r !== false ? $r : mb_decode_mimeheader($v);
}
function mimeParam($cab, $p) {
  if (preg_match('/' . $p . '\*=\s*"?([^\']*)\'[^\']*\'([^;"]+)/i', $cab, $m)) return mb_convert_encoding(rawurldecode(trim($m[2], '"')), 'UTF-8', $m[1] ?: 'UTF-8');
  if (preg_match('/' . $p . '\*0\*?=/i', $cab)) { preg_match_all('/' . $p . '\*\d+\*?=("?)([^";]*)\1/i', $cab, $mm); return rawurldecode(preg_replace("/^[^']*'[^']*'/", '', implode('', $mm[2]))); }
  return preg_match('/' . $p . '="?([^";]+)"?/i', $cab, $m) ? mimeDecodificaCab(trim($m[1])) : '';
}
/* Hojas del mensaje: [{tipo, nombre, datos}] */
function mimePartes($crudo) {
  $sep = preg_split("/\r?\n\r?\n/", $crudo, 2);
  $cab = mimeCabeceras($sep[0]); $cuerpo = $sep[1] ?? '';
  $ct = $cab['content-type'] ?? 'text/plain';
  $tipo = strtolower(trim(explode(';', $ct)[0]));
  if (strpos($tipo, 'multipart/') === 0 && ($b = mimeParam($ct, 'boundary'))) {
    $out = [];
    $trozos = preg_split('/\r?\n--' . preg_quote($b, '/') . '(?:--)?[ \t]*\r?\n?/', "\n" . $cuerpo);
    foreach (array_slice($trozos, 1) as $t) if (trim($t) !== '') $out = array_merge($out, mimePartes($t));
    return $out;
  }
  if ($tipo === 'message/rfc822') return mimePartes($cuerpo);
  $enc = strtolower(trim($cab['content-transfer-encoding'] ?? ''));
  if ($enc === 'base64') $cuerpo = base64_decode(preg_replace('/\s+/', '', $cuerpo));
  elseif ($enc === 'quoted-printable') $cuerpo = quoted_printable_decode($cuerpo);
  $nombre = mimeParam($cab['content-disposition'] ?? '', 'filename') ?: mimeParam($ct, 'name');
  if (strpos($tipo, 'text/') === 0 && !$nombre) {
    $cs = mimeParam($ct, 'charset') ?: 'UTF-8';
    if (strtoupper($cs) !== 'UTF-8') $cuerpo = @mb_convert_encoding($cuerpo, 'UTF-8', $cs) ?: $cuerpo;
  }
  return [['tipo' => $tipo, 'nombre' => $nombre, 'datos' => $cuerpo]];
}

/* ---------- texto de Word (.docx), con negritas, cursivas, listas y subtítulos ---------- */
function textoDocx($bin) {
  $tmp = tempnam(sys_get_temp_dir(), 'dx'); file_put_contents($tmp, $bin);
  $z = new ZipArchive(); if ($z->open($tmp) !== true) { @unlink($tmp); return null; }
  $xml = $z->getFromName('word/document.xml'); $z->close(); @unlink($tmp);
  if (!$xml) return null;
  $d = new DOMDocument(); @$d->loadXML($xml, LIBXML_NONET);
  $x = new DOMXPath($d); $x->registerNamespace('w', 'http://schemas.openxmlformats.org/wordprocessingml/2006/main');
  $pars = [];
  foreach ($x->query('//w:body//w:p') as $p) {
    $txt = ''; $todoNegrita = true; $hay = false;
    foreach ($x->query('.//w:r', $p) as $r) {
      $t = '';
      foreach ($r->childNodes as $h) { if ($h->localName === 't') $t .= $h->textContent; elseif ($h->localName === 'tab') $t .= ' '; elseif ($h->localName === 'br') $t .= "\n"; }
      if ($t === '') continue;
      $v = function ($n) use ($x, $r) { $e = $x->query("w:rPr/w:$n", $r)->item(0); if (!$e) return false; $a = $e->getAttribute('w:val'); return !in_array($a, ['0', 'false', 'none'], true); };
      $b = $v('b'); $i = $v('i');
      if (trim($t) !== '') { $hay = true; if (!$b) $todoNegrita = false; }
      $txt .= ($b && trim($t) !== '') ? '**' . $t . '**' : (($i && trim($t) !== '') ? '*' . $t . '*' : $t);
    }
    $txt = preg_replace('/\*\*\*\*/', '', $txt);
    $txt = preg_replace('/\*\*(\s+)\*\*/', '$1', $txt);
    $txt = trim(preg_replace('/[ \t]+/', ' ', $txt));
    if (!$hay) continue;
    $lista = $x->query('w:pPr/w:numPr', $p)->length > 0;
    $estilo = ($e = $x->query('w:pPr/w:pStyle', $p)->item(0)) ? $e->getAttribute('w:val') : '';
    $plano = trim(str_replace('*', '', $txt));
    if (preg_match('/^(Heading|Ttulo|Titulo|T.tulo)/i', $estilo) || ($todoNegrita && mb_strlen($plano) < 90 && !preg_match('/^[-•]/u', $plano))) $pars[] = ['h', $plano];
    elseif ($lista || preg_match('/^[-•–]\s/u', $plano)) $pars[] = ['l', preg_replace('/^(\**)\s*[-•–]\s*/u', '$1', $txt)];
    else $pars[] = ['p', $txt];
  }
  return $pars;
}

/* ---------- texto de PDF (los de Word: fuentes con ToUnicode) ---------- */
function pdfFlujos($bin) {
  $obj = [];
  if (preg_match_all('/(\d+)\s+0\s+obj(.*?)endobj/s', $bin, $mm, PREG_SET_ORDER)) {
    foreach ($mm as $m) {
      $o = ['dic' => $m[2], 'flujo' => null];
      if (preg_match('/^(.*?)stream\r?\n(.*?)\r?\nendstream/s', $m[2], $s)) {
        $o['dic'] = $s[1]; $o['flujo'] = $s[2];
        if (strpos($s[1], '/FlateDecode') !== false) { $z = @gzuncompress($s[2]); if ($z === false) $z = @gzinflate(substr($s[2], 2)); $o['flujo'] = $z === false ? null : $z; }
      }
      $obj[(int)$m[1]] = $o;
    }
  }
  // Objetos dentro de /ObjStm (PDF modernos)
  foreach ($obj as $o) {
    if ($o['flujo'] === null || strpos($o['dic'], '/ObjStm') === false) continue;
    $n = preg_match('/\/N\s+(\d+)/', $o['dic'], $a) ? (int)$a[1] : 0; $f = preg_match('/\/First\s+(\d+)/', $o['dic'], $a) ? (int)$a[1] : 0;
    $nums = preg_split('/\s+/', trim(substr($o['flujo'], 0, $f)));
    for ($i = 0; $i < $n; $i++) {
      $id = (int)$nums[2 * $i]; $ini = $f + (int)$nums[2 * $i + 1]; $fin = $i + 1 < $n ? $f + (int)$nums[2 * $i + 3] : strlen($o['flujo']);
      if (!isset($obj[$id])) $obj[$id] = ['dic' => substr($o['flujo'], $ini, $fin - $ini), 'flujo' => null];
    }
  }
  return $obj;
}
function pdfCmap($t) {
  $m = [];
  $hex = fn($h) => mb_convert_encoding(hex2bin(strlen($h) % 4 ? str_pad($h, (int)ceil(strlen($h) / 4) * 4, '0', STR_PAD_LEFT) : $h), 'UTF-8', 'UTF-16BE');
  if (preg_match_all('/beginbfchar(.*?)endbfchar/s', $t, $bb)) foreach ($bb[1] as $b) if (preg_match_all('/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/', $b, $pp, PREG_SET_ORDER)) foreach ($pp as $p) $m[hexdec($p[1])] = $hex($p[2]);
  if (preg_match_all('/beginbfrange(.*?)endbfrange/s', $t, $bb)) foreach ($bb[1] as $b) {
    if (preg_match_all('/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*(<[0-9A-Fa-f]+>|\[[^\]]*\])/', $b, $pp, PREG_SET_ORDER)) foreach ($pp as $p) {
      $a = hexdec($p[1]); $z = hexdec($p[2]);
      if ($p[3][0] === '[') { preg_match_all('/<([0-9A-Fa-f]+)>/', $p[3], $ll); foreach ($ll[1] as $k => $h) $m[$a + $k] = $hex($h); }
      else { $base = hexdec(trim($p[3], '<>')); for ($c = $a; $c <= $z && $c - $a < 5000; $c++) $m[$c] = mb_convert_encoding(pack('n', $base + $c - $a), 'UTF-8', 'UTF-16BE'); }
    }
  }
  return $m;
}
function textoPdf($bin) {
  $obj = pdfFlujos($bin);
  // fuentes: nombre de recurso → [mapa, bytes por código]
  $mapas = [];
  foreach ($obj as $id => $o) {
    if (!preg_match('/\/Type\s*\/Font/', $o['dic'])) continue;
    $map = [];
    if (preg_match('/\/ToUnicode\s+(\d+)\s+0\s+R/', $o['dic'], $a) && isset($obj[(int)$a[1]]['flujo'])) $map = pdfCmap($obj[(int)$a[1]]['flujo']);
    $mapas[$id] = [$map, strpos($o['dic'], '/Type0') !== false ? 2 : 1];
  }
  $recursos = [];
  foreach ($obj as $o) if (preg_match_all('/\/(F\d+|[A-Za-z][\w.+-]*)\s+(\d+)\s+0\s+R/', $o['dic'], $mm, PREG_SET_ORDER)) foreach ($mm as $m) if (isset($mapas[(int)$m[2]])) $recursos[$m[1]] = $mapas[(int)$m[2]];
  $lineas = [];
  // páginas en orden: /Contents de cada /Page
  $ids = [];
  foreach ($obj as $id => $o) if (preg_match('/\/Type\s*\/Page\b/', $o['dic']) && preg_match('/\/Contents\s*(\[[^\]]*\]|\d+\s+0\s+R)/', $o['dic'], $c)) { preg_match_all('/(\d+)\s+0\s+R/', $c[1], $cc); foreach ($cc[1] as $x) $ids[] = (int)$x; }
  foreach ($ids as $pag => $cid) {
    $f = $obj[$cid]['flujo'] ?? null; if ($f === null) continue;
    $fuente = [[], 1]; $y = 0; $x0 = 0; $linea = ''; $alto = 12; $yLinea = null;
    preg_match_all('/\/([^\s\/\[\]()<>]+)\s+([\d.]+)\s+Tf|\[((?:[^\]\\\\]|\\\\.)*)\]\s*TJ|(<[0-9A-Fa-f\s]*>|\((?:[^()\\\\]|\\\\.)*\))\s*(Tj|\'|")|([-\d.]+)\s+([-\d.]+)\s+(?:Td|TD)|[-\d.]+\s+[-\d.]+\s+[-\d.]+\s+[-\d.]+\s+([-\d.]+)\s+([-\d.]+)\s+Tm|\bT\*/s', $f, $ops, PREG_SET_ORDER);
    $cad = function ($s) use (&$fuente) {
      [$map, $by] = $fuente; $out = '';
      if ($s[0] === '<') { $h = preg_replace('/\s+/', '', trim($s, '<>')); $bytes = hex2bin(strlen($h) % 2 ? $h . '0' : $h); }
      else { $bytes = stripcslashes(substr($s, 1, -1)); }
      for ($i = 0; $i + $by <= strlen($bytes); $i += $by) { $c = $by === 2 ? unpack('n', substr($bytes, $i, 2))[1] : ord($bytes[$i]); $out .= $map[$c] ?? ($by === 1 ? mb_convert_encoding(chr($c), 'UTF-8', 'Windows-1252') : ''); }
      return $out;
    };
    // cada línea con su altura en la página: así se ve después el hueco entre líneas
    $mueve = function ($ny) use (&$y, &$linea, &$lineas, &$alto, &$yLinea, $pag) {
      if (abs($ny - $y) > 0.5 && $linea !== '') { if (trim($linea) !== '') $lineas[] = [trim($linea), $yLinea ?? $y, $alto, $pag]; $linea = ''; $yLinea = null; }
      $y = $ny;
    };
    $pon = function ($t) use (&$linea, &$yLinea, &$y) { if ($yLinea === null && trim($t) !== '') $yLinea = $y; $linea .= $t; };
    foreach ($ops as $o) {
      if (!empty($o[1])) { $fuente = $recursos[$o[1]] ?? [[], 1]; $alto = (float)$o[2] ?: $alto; }
      elseif (isset($o[3]) && $o[3] !== '' && strpos($o[0], 'TJ') !== false) {
        preg_match_all('/<[0-9A-Fa-f\s]*>|\((?:[^()\\\\]|\\\\.)*\)|(-?[\d.]+)/', $o[3], $pp, PREG_SET_ORDER);
        $t = ''; foreach ($pp as $p) { if (isset($p[1]) && $p[1] !== '') { if ((float)$p[1] < -200) $t .= ' '; } else $t .= $cad($p[0]); }
        $pon($t);
      }
      elseif (!empty($o[4])) { if ($o[5] !== 'Tj') $mueve($y - $alto * 1.2); $pon($cad($o[4])); }
      elseif (isset($o[7]) && $o[7] !== '') $mueve($y + (float)$o[7]);
      elseif (isset($o[9]) && $o[9] !== '') $mueve((float)$o[9]);
      elseif ($o[0] === 'T*') $mueve($y - $alto * 1.2);
    }
    $mueve(-99999);
  }
  // líneas → párrafos: un hueco mayor que el interlineado normal es párrafo nuevo
  $huecos = [];
  for ($i = 1; $i < count($lineas); $i++) if ($lineas[$i][3] === $lineas[$i - 1][3]) $huecos[] = round($lineas[$i - 1][1] - $lineas[$i][1], 1);
  $cuenta = array_count_values(array_map('strval', array_filter($huecos, fn($h) => $h > 0)));
  arsort($cuenta); $normal = $cuenta ? (float)array_key_first($cuenta) : 14;
  $pars = []; $act = '';
  foreach ($lineas as $i => [$t, $ly, $h, $pg]) {
    if ($i > 0 && $act !== '') {
      $prev = $lineas[$i - 1];
      $hueco = $prev[3] === $pg ? $prev[1] - $ly : $normal;   // al cambiar de página se sigue el párrafo
      if ($hueco > $normal * 1.3 || $hueco < -1) { $pars[] = $act; $act = ''; }
    }
    // «VII. Construir antes que lamentar.» en su propia línea es un subtítulo aunque no lleve hueco
    if (mb_strlen($t) < 90 && preg_match('/^(?:[IVXLC]+|\\d{1,2})\\.\\s+\\p{Lu}/u', $t)) { if ($act !== '') $pars[] = $act; $pars[] = $t; $act = ''; continue; }
    $act = $act === '' ? $t : (preg_match('/\S-$/u', $act) ? mb_substr($act, 0, -1) . $t : $act . ' ' . $t);
  }
  if ($act !== '') $pars[] = $act;
  $out = [];
  foreach ($pars as $p) {
    $p = trim(preg_replace('/\s+/u', ' ', $p));
    if ($p === '') continue;
    if (mb_strlen($p) < 90 && (preg_match('/^(?:[IVXLC]+|\d+)\.\s+\S/u', $p) || ($p === mb_strtoupper($p) && preg_match('/\p{L}/u', $p)))) $out[] = ['h', rtrim($p, '.')];
    else $out[] = ['p', $p];
  }
  return $out;
}

/* ---------- de las piezas al artículo ---------- */
function frase($t) { // «ANTE EL REACCIONISMO» → «Ante el reaccionismo»
  $t = trim(str_replace('*', '', $t));
  if ($t !== mb_strtoupper($t)) return rtrim($t, '.');
  $t = mb_strtolower($t);
  $t = preg_replace_callback('/(^|[.:¿¡]\s*|\(\w+\)\s*)(\p{Ll})/u', fn($m) => $m[1] . mb_strtoupper($m[2]), $t);
  $t = preg_replace_callback('/\(([ivxlc]+)\)/u', fn($m) => '(' . mb_strtoupper($m[1]) . ')', $t);
  return rtrim($t, '.');
}
function articuloDePiezas($pars, $asuntoNombre) {
  $titulo = ''; $entr = ''; $cuerpo = []; $firmaFinal = '';
  // el título es el primer párrafo si es corto
  if ($pars && mb_strlen(str_replace('*', '', $pars[0][1])) < 160) { $titulo = frase(array_shift($pars)[1]); }
  // la firma al final («R. Fernández Arteaga.»)
  if ($pars && mb_strlen($pars[count($pars) - 1][1]) < 60 && $pars[count($pars) - 1][0] === 'p') $firmaFinal = rtrim(str_replace('*', '', array_pop($pars)[1]), '. ');
  // entradilla: el primer párrafo si es corto (un subtítulo); si no, se saca del principio del texto
  if ($pars && $pars[0][0] === 'p' && mb_strlen($pars[0][1]) < 420) $entr = trim(str_replace('*', '', array_shift($pars)[1]));
  $lista = [];
  $cierra = function () use (&$lista, &$cuerpo) { if ($lista) { $cuerpo[] = implode("\n", $lista); $lista = []; } };
  foreach ($pars as [$k, $t]) {
    if ($k === 'l') { $lista[] = '- ' . $t; continue; }
    $cierra();
    if ($k === 'h') $cuerpo[] = '## ' . frase($t);
    elseif (preg_match("/^['\"«“](.{20,400})['\"»”]\.?$/u", $t, $m)) $cuerpo[] = '> «' . $m[1] . '».';
    else $cuerpo[] = $t;
  }
  $cierra();
  $texto = implode("\n\n", $cuerpo);
  if (!$entr) { $pl = ''; foreach ($cuerpo as $b) if ($b[0] !== '#' && $b[0] !== '>' && $b[0] !== '-') { $pl = trim(preg_replace('/\s+/', ' ', str_replace(['**', '*'], '', $b))); break; } $entr = mb_substr($pl, 0, 260); if (mb_strlen($pl) > 260) $entr = preg_replace('/\s+\S*$/u', '', $entr) . '…'; }
  return ['titulo' => $titulo, 'entradilla' => $entr, 'texto' => $texto, 'firmaFinal' => $firmaFinal];
}

/* Asunto «ARTICULO Nombre Apellido[ - Sección]» → [nombre, sección] o null si no es un artículo */
function asuntoArticulo($asunto) {
  $a = trim(preg_replace('/^\s*((re|rv|fw|fwd|reenviar|enc)\s*:\s*)+/iu', '', $asunto));
  $n = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $a);
  if (!preg_match('/^\W*ARTICULO\b[\s:.\-–—]*/i', $n, $m)) return null;
  $resto = trim(preg_replace('/^\W*art[ií]culo\b[\s:.\-–—]*/iu', '', $a));
  $sec = '';
  if (preg_match('/^(.*?)\s*[-–—|\/]\s*(\p{L}+)\s*$/u', $resto, $mm)) {
    foreach (SECCIONES_BOLETIN as $s) if (iconv('UTF-8', 'ASCII//TRANSLIT', mb_strtolower($s)) === iconv('UTF-8', 'ASCII//TRANSLIT', mb_strtolower($mm[2]))) { $sec = $s; $resto = $mm[1]; }
  }
  return [trim($resto, " \t-–—:"), $sec];
}

function guardarImagenCorreo($bin, $tipo) {
  $ext = ['image/jpeg' => 'jpg', 'image/jpg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp', 'image/gif' => 'gif'][$tipo] ?? '';
  if (!$ext || strlen($bin) < 2000 || strlen($bin) > 15000000) return '';
  $h = md5($bin);
  @file_put_contents(privado() . "/img/$h.$ext", $bin);
  return webBoletin() . "/img-com/$h.$ext";
}

/* Convierte un correo en los datos de un «artículo de firma». null si no es un artículo. */
function correoAArticulo($crudo) {
  $cab = mimeCabeceras(preg_split("/\r?\n\r?\n/", $crudo, 2)[0]);
  $asunto = mimeDecodificaCab($cab['subject'] ?? '');
  $as = asuntoArticulo($asunto);
  if (!$as) return null;
  [$nombre, $seccion] = $as;
  $de = mimeDecodificaCab($cab['from'] ?? '');
  $remite = preg_match('/<([^>]+)>/', $de, $m) ? strtolower($m[1]) : strtolower(trim($de));
  $partes = mimePartes($crudo);
  $pars = null; $imagen = ''; $cuerpoTxt = ''; $cuerpoHtml = ''; $adjuntos = [];
  foreach ($partes as $p) {
    $nom = strtolower($p['nombre']);
    if (!$pars && (preg_match('/\.docx$/', $nom) || $p['tipo'] === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')) { $pars = textoDocx($p['datos']); $adjuntos[] = $p['nombre']; }
    elseif (!$pars && (preg_match('/\.pdf$/', $nom) || $p['tipo'] === 'application/pdf')) { $pars = textoPdf($p['datos']); $adjuntos[] = $p['nombre']; }
    elseif (!$imagen && strpos($p['tipo'], 'image/') === 0 && $p['nombre']) $imagen = guardarImagenCorreo($p['datos'], $p['tipo']);
    elseif ($p['tipo'] === 'text/plain' && !$p['nombre'] && !$cuerpoTxt) $cuerpoTxt = $p['datos'];
    elseif ($p['tipo'] === 'text/html' && !$p['nombre'] && !$cuerpoHtml) $cuerpoHtml = $p['datos'];
  }
  if (!$pars) {
    $t = $cuerpoTxt ?: html_entity_decode(strip_tags(preg_replace('#<(br|/p|/div)[^>]*>#i', "\n", $cuerpoHtml)), ENT_QUOTES | ENT_HTML5, 'UTF-8');
    $t = preg_split('/\r?\n-- ?\r?\n|\r?\nEl .{5,80} escribi[óo]:|\r?\nOn .{5,80} wrote:/u', $t)[0];
    $pars = [];
    foreach (preg_split('/\r?\n\s*\r?\n/', $t) as $b) { $b = trim(preg_replace('/\s+/u', ' ', $b)); if ($b !== '') $pars[] = ['p', $b]; }
  }
  if (!$pars) return null;
  $a = articuloDePiezas($pars, $nombre);
  $autor = $nombre ?: ($a['firmaFinal'] ?: trim(preg_replace('/<[^>]*>/', '', $de), " \"'"));
  return ['titulo' => mb_substr($a['titulo'] ?: 'Artículo de ' . $autor, 0, 300), 'entradilla' => mb_substr($a['entradilla'], 0, 600), 'texto' => mb_substr($a['texto'], 0, 60000),
    'imagen' => $imagen, 'autor' => mb_substr($autor, 0, 80), 'cargo' => '', 'seccion' => $seccion ?: 'Análisis', 'tema' => '',
    '_remite' => $remite, '_asunto' => $asunto, '_adjuntos' => $adjuntos, '_mid' => trim($cab['message-id'] ?? '')];
}

/* ---------- la revisión del buzón ---------- */
/* $meter($datos, $correo) mete el artículo en el boletín (lo hace aportar.php). Devuelve un resumen. */
function revisarCorreoArticulos($meter, $forzar = false) {
  $fE = privado() . '/correo-articulos.json';
  $lock = fopen(privado() . '/correo-articulos.lock', 'c');
  if (!$lock || !flock($lock, LOCK_EX | LOCK_NB)) return ['ok' => false, 'motivo' => 'Ya se está revisando'];
  $e = is_file($fE) ? (json_decode(file_get_contents($fE), true) ?: []) : [];
  $e += ['revisado' => 0, 'validez' => '', 'ultimo' => 0, 'vistos' => [], 'registro' => []];
  if (!$forzar && time() - (int)$e['revisado'] < CORREO_CADA) { flock($lock, LOCK_UN); return ['ok' => true, 'motivo' => 'Revisado hace poco', 'registro' => array_slice($e['registro'], -20)]; }
  $e['revisado'] = time();
  $res = ['ok' => true, 'nuevos' => []];
  $cuenta = correoCuenta();
  if (!$cuenta) { $e['error'] = 'Falta la contraseña del buzón en Publicar › Claves › Hostinger · correo'; $res = ['ok' => false, 'motivo' => $e['error']]; }
  else try {
    $im = new ImapSimple(CORREO_SERVIDOR, $cuenta[0], $cuenta[1]);
    [$ok, $r] = $im->cmd('EXAMINE INBOX');   // solo lectura: no cambia nada en el buzón
    $validez = preg_match('/UIDVALIDITY (\d+)/', $r, $m) ? $m[1] : '';
    if ($validez !== $e['validez']) { $e['validez'] = $validez; $e['ultimo'] = 0; }
    // La primera vez, los de los últimos 30 días; después, solo los nuevos
    $q = $e['ultimo'] ? 'UID SEARCH UID ' . ($e['ultimo'] + 1) . ':*' : 'UID SEARCH SINCE ' . date('j-M-Y', strtotime('-30 days'));
    [$ok, $r] = $im->cmd($q);
    $uids = preg_match('/\* SEARCH([\d ]*)/', $r, $m) ? array_values(array_filter(array_map('intval', preg_split('/\s+/', trim($m[1]))), fn($u) => $u > (int)$e['ultimo'])) : [];
    sort($uids);
    foreach (array_chunk($uids, 50) as $grupo) {
      [$ok, $r] = $im->cmd('UID FETCH ' . implode(',', $grupo) . ' (UID BODY.PEEK[HEADER.FIELDS (SUBJECT)])');
      foreach (imapLiterales($r) as $uid => $cabe) {
        $as = mimeDecodificaCab(mimeCabeceras($cabe)['subject'] ?? '');
        if (asuntoArticulo($as) && empty($e['vistos'][$uid])) {
          [$ok2, $r2] = $im->cmd("UID FETCH $uid (UID BODY.PEEK[])");
          $crudo = imapLiterales($r2)[$uid] ?? '';
          $art = $crudo ? correoAArticulo($crudo) : null;
          $mid = $art['_mid'] ?? '';
          $yaMid = $mid && in_array($mid, array_column($e['registro'], 'mid'), true);
          if ($art && !$yaMid) {
            $id = $meter(array_diff_key($art, array_flip(['_remite', '_asunto', '_adjuntos', '_mid'])), ['remite' => $art['_remite'], 'asunto' => $art['_asunto']]);
            $e['registro'][] = ['f' => gmdate('c'), 'uid' => $uid, 'mid' => $mid, 'asunto' => $art['_asunto'], 'remite' => $art['_remite'], 'titulo' => $art['titulo'], 'autor' => $art['autor'], 'id' => $id];
            $res['nuevos'][] = $art['titulo'];
          } elseif (!$art) $e['registro'][] = ['f' => gmdate('c'), 'uid' => $uid, 'asunto' => $as, 'error' => 'No se ha podido leer el texto'];
          $e['vistos'][$uid] = 1;
        }
      }
    }
    if ($uids) $e['ultimo'] = max((int)$e['ultimo'], max($uids));
    $im->salir();
    unset($e['error']);
  } catch (Throwable $x) { $e['error'] = $x->getMessage(); $res = ['ok' => false, 'motivo' => $x->getMessage()]; }
  $e['vistos'] = array_slice($e['vistos'], -2000, null, true);
  $e['registro'] = array_slice($e['registro'], -200);
  file_put_contents($fE, json_encode($e, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), LOCK_EX); @chmod($fE, 0600);
  flock($lock, LOCK_UN);
  return $res + ['registro' => array_slice($e['registro'], -20)];
}
