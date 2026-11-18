import { Link, useSearchParams } from 'react-router-dom'
import { useSeo } from '../lib/seo'

// Páginas a las que se llega después del pago (PayPal o Stripe)
export function PagoCorrecto() {
  useSeo({ titulo: 'Pago correcto', noindex: true })
  const [q] = useSearchParams()
  return (
    <div className="contenedor estrecho bloque">
      <div className="aviso-ok grande">
        <h1>¡Pago realizado!</h1>
        <p>
          Gracias por su apoyo. Le hemos enviado el justificante por correo.{q.get('ref') && <> Referencia: <b>{q.get('ref')}</b>.</>}
          {q.get('tipo') === 'cuota' && ' La cuota se cobrará automáticamente cada mes con la misma tarjeta.'}
          {q.get('tipo') === 'pedido' && ' Gelato, nuestro taller de impresión, fabricará y enviará su pedido en 3 a 5 días laborables.'}
        </p>
        <p><Link to="/" className="btn">Volver al inicio</Link></p>
      </div>
    </div>
  )
}

export function PagoCancelado() {
  useSeo({ titulo: 'Pago cancelado', noindex: true })
  const [q] = useSearchParams()
  return (
    <div className="contenedor estrecho bloque">
      <h1>El pago no se ha completado</h1>
      <p>No se ha cobrado nada.{q.get('ref') && <> Referencia: <b>{q.get('ref')}</b>.</>} Puede volver a intentarlo o escribirnos si ha tenido algún problema.</p>
      <p><Link to="/tienda" className="btn">Ir a la tienda</Link> <Link to="/contacto" className="btn btn-claro">Contacto</Link></p>
    </div>
  )
}
