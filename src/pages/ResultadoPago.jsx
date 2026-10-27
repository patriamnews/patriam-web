import { Link, useSearchParams } from 'react-router-dom'

// Páginas a las que vuelve Stripe después del pago
export function PagoCorrecto() {
  const [q] = useSearchParams()
  return (
    <div className="contenedor estrecho bloque">
      <div className="aviso-ok grande">
        <h1>¡Pago realizado!</h1>
        <p>Gracias por su apoyo. Stripe le enviará el justificante por correo.{q.get('ref') && <> Referencia: <b>{q.get('ref')}</b>.</>}</p>
        <p><Link to="/" className="btn">Volver al inicio</Link></p>
      </div>
    </div>
  )
}

export function PagoCancelado() {
  const [q] = useSearchParams()
  return (
    <div className="contenedor estrecho bloque">
      <h1>El pago no se ha completado</h1>
      <p>No se ha cobrado nada.{q.get('ref') && <> Referencia: <b>{q.get('ref')}</b>.</>} Puede volver a intentarlo o escribirnos si ha tenido algún problema.</p>
      <p><Link to="/tienda" className="btn">Ir a la tienda</Link> <Link to="/contacto" className="btn btn-claro">Contacto</Link></p>
    </div>
  )
}
