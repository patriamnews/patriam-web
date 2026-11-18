<?php
/* Avisos de PayPal (webhook): https://movimientopatriam.es/api/paypal-webhook.php
   De momento solo confirma a PayPal que el aviso ha llegado.
   El registro de los pagos se añade al montar el cobro con PayPal. */
http_response_code(200);
header('Content-Type: text/plain; charset=utf-8');
echo 'OK';
