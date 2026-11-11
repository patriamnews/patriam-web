import { useEffect, useMemo, useState } from 'react'
import { euros } from '../lib/data'
import { tokenEquipo } from '../lib/equipo'

// Lo que le toca al diseñador: de cada prenda suya, su % de (precio cobrado − lo que cobra Gelato por fabricarla).
// El envío no entra. Se agrupa por mes para que él haga una factura al mes con el total.
export default function Liquidacion() {
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState('')
  const [abierto, setAbierto] = useState(null)

  useEffect(() => {
    fetch('/api/liquidacion.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: tokenEquipo() }) })
      .then(async (r) => {
        const d = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(d.error === 'sesion' ? 'Por seguridad, vuelva a entrar en Publicar con su email y contraseña.' : d.error || 'No se ha podido conectar con el servidor.')
        setDatos(d)
      })
      .catch((e) => setError(e.message))
  }, [])

  const meses = useMemo(() => {
    const m = {}
    for (const p of datos?.pedidos || []) {
      const k = (p.fecha || '').slice(0, 7) || 'sin fecha'
      ;(m[k] ||= { pedidos: [], total: 0, pagado: 0 }).pedidos.push(p)
      m[k].total += p.importe
      if (p.transferencia) m[k].pagado += p.importe
    }
    return Object.entries(m)
  }, [datos])

  if (error) return <p className="error">{error}</p>
  if (!datos) return <p className="vacio">Cargando…</p>

  const nombreMes = (k) => (k.length === 7 ? new Date(k + '-01').toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }) : k)

  return (
    <div>
      <p className="caja-aviso">
        {datos.automatico
          ? 'Pago automático activado: su parte se le transfiere por Stripe en cada pedido. Él hace una factura al mes por el total.'
          : 'Pago automático sin activar: su parte queda apuntada aquí. Se le paga al mes por transferencia, contra su factura. Para pagarle solo, ponga su cuenta de Stripe («acct_…») en Cuentas y claves › Stripe.'}
      </p>
      {!meses.length && <p className="vacio">Todavía no hay ventas de sus diseños.</p>}
      {meses.map(([k, m]) => (
        <section key={k}>
          <h3>{nombreMes(k)} · {euros(m.total)}{datos.automatico && m.total - m.pagado > 0.009 ? ` (pendiente: ${euros(m.total - m.pagado)})` : ''}</h3>
          <div className="tabla-scroll">
            <table className="tabla">
              <thead><tr><th>Fecha</th><th>Pedido</th><th>Prendas suyas</th><th>Venta</th><th>Coste Gelato</th><th>Su parte</th><th>Pago</th></tr></thead>
              <tbody>
                {m.pedidos.map((p) => {
                  const venta = p.detalle.reduce((t, d) => t + d.venta, 0)
                  const coste = p.detalle.reduce((t, d) => t + d.costeGelato, 0)
                  return (
                    <tr key={p.referencia} onClick={() => setAbierto(abierto === p.referencia ? null : p.referencia)} style={{ cursor: 'pointer' }}>
                      <td>{p.fecha ? new Date(p.fecha).toLocaleDateString('es-ES') : ''}</td>
                      <td><code>{p.referencia}</code></td>
                      <td>
                        {abierto === p.referencia
                          ? p.detalle.map((d, i) => <div key={i}>{d.cantidad} × {d.nombre}: {euros(d.venta)} − {euros(d.costeGelato)} = {euros(d.beneficio)} × {d.reparto} %</div>)
                          : p.detalle.reduce((t, d) => t + d.cantidad, 0)}
                      </td>
                      <td>{euros(venta)}</td>
                      <td>{euros(coste)}</td>
                      <td><b>{euros(p.importe)}</b></td>
                      <td>{p.transferencia ? 'Transferido' : p.error ? 'Error: pagar a mano' : 'Pendiente'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  )
}
