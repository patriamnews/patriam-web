import { confirmar } from '../lib/confirmar'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fecha } from '../lib/data'

export default function Mensajes() {
  const [lista, setLista] = useState([])
  const cargar = () =>
    supabase.from('contactos').select('*').order('creado_at', { ascending: false }).then(({ data }) => setLista(data || []))
  useEffect(() => {
    cargar()
  }, [])

  const atendido = async (m) => {
    await supabase.from('contactos').update({ atendido: !m.atendido }).eq('id', m.id)
    cargar()
  }
  const borrar = async (id) => {
    if (!confirmar('¿Eliminar este mensaje y sus datos personales? (derecho de supresión)')) return
    await supabase.from('contactos').delete().eq('id', id)
    cargar()
  }

  return (
    <>
      <h1>Mensajes recibidos</h1>
      <p className="letra-pequena">Datos de categoría especial (pueden revelar opiniones). Acceso restringido al administrador. No los exporte ni los comparta fuera de la asociación.</p>
      {lista.length === 0 && <p className="vacio">No hay mensajes.</p>}
      {lista.map((m) => (
        <div key={m.id} className={`mensaje ${m.atendido ? 'atendido' : ''}`}>
          <div className="mensaje-cab">
            <b>{m.nombre}</b> · <a href={`mailto:${m.email}`}>{m.email}</a> · {m.interes} · {fecha(m.creado_at)}
          </div>
          {m.mensaje && <p>{m.mensaje}</p>}
          <div className="acciones-fila">
            <button className="btn-texto" onClick={() => atendido(m)}>{m.atendido ? 'Marcar pendiente' : 'Marcar atendido'}</button>
            <button className="btn-texto peligro" onClick={() => borrar(m.id)}>Eliminar</button>
          </div>
        </div>
      ))}
    </>
  )
}
