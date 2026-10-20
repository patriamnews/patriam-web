import { supabase, DEMO } from './supabase'
import { APROBADOR } from './config'

// Avisos por correo. En la DEMOSTRACIÓN no se envía nada: el correo se guarda en la bandeja simulada
// (Panel › Correos enviados). En producción, una función de Supabase lee la tabla "correos" y los envía
// con un servicio de email (p. ej. Resend).
export async function enviarCorreo({ para, de, asunto, cuerpo, enlace }) {
  await supabase.from('correos').insert({ para, de, asunto, cuerpo, enlace })
  return DEMO ? `Enviado por correo (simulado) a ${para}.` : `Aviso enviado a ${para}.`
}

export const pedirAprobacion = ({ tipo, titulo, de, enlace }) =>
  enviarCorreo({
    para: APROBADOR.email,
    de,
    asunto: `Pendiente de aprobación: ${tipo} «${titulo}»`,
    cuerpo: `${de} ha enviado ${tipo === 'acción' || tipo === 'campaña' ? 'una' : 'un'} ${tipo} que necesita su aprobación antes de publicarse.`,
    enlace,
  })

export const avisarAutor = ({ para, titulo, aprobado, nota }) =>
  enviarCorreo({
    para,
    de: APROBADOR.email,
    asunto: aprobado ? `Aprobado y publicado: «${titulo}»` : `Devuelto con comentarios: «${titulo}»`,
    cuerpo: aprobado ? 'Su contenido ha sido aprobado y ya está publicado en la web.' : `Comentarios del revisor: ${nota || '(sin comentarios)'}`,
    enlace: '/gestion/articulos',
  })
