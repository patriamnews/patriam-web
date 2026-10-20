import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, DEMO } from '../lib/supabase'

const fechaHora = (d) => new Date(d).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

// Registro de avisos por correo. En la demostración es una bandeja simulada: no se envía nada.
export default function Correos() {
  const [lista, setLista] = useState(null)
  useEffect(() => {
    supabase.from('correos').select('*').order('creado_at', { ascending: false }).then(({ data }) => setLista(data || []))
  }, [])
  return (
    <>
      <h1>Correos enviados</h1>
      {DEMO && <p className="caja-aviso">Simulación: estos correos no se envían de verdad. En la web real se mandarán automáticamente.</p>}
      {lista === null ? <p>Cargando…</p> : lista.length === 0 ? <p className="vacio">No hay correos.</p> : (
        <div className="lista-pedidos">
          {lista.map((c) => (
            <div key={c.id} className="pedido">
              <div className="pedido-detalle sin-borde">
                <div className="mensaje-cab"><b>Para:</b> {c.para}{c.de ? <> · <b>De:</b> {c.de}</> : ''} · {fechaHora(c.creado_at)}</div>
                <p><b>{c.asunto}</b></p>
                <p>{c.cuerpo}</p>
                {c.enlace && <Link to={c.enlace}>Abrir en el panel →</Link>}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
