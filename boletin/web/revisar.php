<?php
/* Lo lanza el cron de Hostinger cada hora («php revisar.php»): no se puede abrir desde fuera.
   - Comunicaciones de Carlos (semanal y mensual)  → carlos.php
   - Aviso a los colaboradores una semana antes de cada boletín → calendario.php
   - El boletín quincenal por correo (y por WhatsApp con la API), el día que sale → boletin-envio.php */
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require __DIR__ . '/carlos.php';
require __DIR__ . '/calendario.php';
require __DIR__ . '/boletin-envio.php';
try { carlosRevisar(true); } catch (Throwable $e) { echo 'Carlos: ' . $e->getMessage() . "\n"; }
try { boletinRevisar(true); } catch (Throwable $e) { echo 'Boletín: ' . $e->getMessage() . "\n"; }
try { calendarioRevisar(true); } catch (Throwable $e) { echo 'Calendario: ' . $e->getMessage() . "\n"; }
