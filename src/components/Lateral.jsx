import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getAjustes } from '../lib/data'
import { urlBoletin, cargarBoletin } from '../lib/boletin'
import Calendario, { claveDia, MESES } from './Calendario'

const RUTA_SECCION = { ciudadana: '/accion-ciudadana', cultural: '/accion-cultural', social: '/accion-social' }

// Columna izquierda de todas las páginas: agenda (calendario) y el boletín de la semana con su imagen
export default function Lateral({ conCalendario = true }) {
  const navegar = useNavigate()
  const hoy = new Date()
  const [mes, setMes] = useState([hoy.getFullYear(), hoy.getMonth()])
  const [dia, setDia] = useState(null)
  const [acciones, setAcciones] = useState([])
  const [bol, setBol] = useState(null)
  const [base, setBase] = useState(urlBoletin({}))

  useEffect(() => {
    supabase.from('acciones').select('id, slug, titulo, fecha_inicio, lugar, seccion').eq('publicada', true).eq('aprobada', true).order('fecha_inicio')
      .then(({ data }) => setAcciones(data || []))
    getAjustes().then((aj) => { const b = urlBoletin(aj); setBase(b); cargarBoletin(b).then(setBol) })
  }, [])

  const proximas = acciones.filter((a) => new Date(a.fecha_inicio) >= new Date(hoy.toDateString())).slice(0, 3)
  const delDia = dia ? acciones.filter((a) => claveDia(a.fecha_inicio) === dia) : null
  const lista = delDia || proximas
  const enlaceBol = bol ? `${base}boletin/${bol.numero}` : base

  return (
    <aside className="lateral" aria-label="Agenda y boletín">
      {conCalendario && (
        <section className="lat-bloque">
          <h2 className="lat-titulo">Agenda</h2>
          <Calendario mes={mes} setMes={setMes} acciones={acciones} dia={dia} setDia={setDia} />
          <ul className="lat-agenda">
            {lista.length ? lista.map((a) => {
              const f = new Date(a.fecha_inicio)
              return (
                <li key={a.id}>
                  <button onClick={() => navegar(a.slug ? `/accion/${a.slug}` : RUTA_SECCION[a.seccion] || '/accion-ciudadana')}>
                    <span className="lat-fecha"><b>{f.getDate()}</b>{MESES[f.getMonth()].slice(0, 3)}</span>
                    <span><b>{a.titulo}</b>{a.lugar && <small>{a.lugar}</small>}</span>
                  </button>
                </li>
              )
            }) : <li className="lat-vacio">{delDia ? 'Nada ese día.' : 'Pronto anunciaremos nuevas acciones.'}</li>}
          </ul>
          <Link className="lat-mas" to="/accion-ciudadana">Toda la agenda →</Link>
        </section>
      )}

      <section className="lat-bloque lat-boletin">
        <h2 className="lat-titulo">Boletín semanal</h2>
        <a href={enlaceBol} target="_blank" rel="noopener noreferrer" className="lat-tarjeta" aria-label="Leer el boletín de esta semana">
          {bol?.tarjeta ? (
            <img src={bol.tarjeta} alt={`Boletín Nº ${bol.numero}: ${bol.cabecera}, ${bol.claim}`} />
          ) : (
            <span className="lat-tarjeta-dib" style={bol?.banner ? { backgroundImage: `url(${bol.banner})` } : null}>
              <span className="lat-velo">
                <small>Boletín de noticias</small>
                <b>{bol?.cabecera || 'Lo que hay que saber'}</b>
                <i>— {bol?.claim || 'con criterio'} —</i>
                {bol?.frase && <q>{bol.frase}</q>}
                {bol?.fraseAutor && <em>{bol.fraseAutor}</em>}
              </span>
              {bol && <span className="lat-num">Nº {String(bol.numero).padStart(2, '0')}</span>}
            </span>
          )}
        </a>
        {bol?.editorial?.titulo && <p className="lat-edit">«{bol.editorial.titulo}»</p>}
        <div className="lat-botones">
          <a className="btn" href={enlaceBol} target="_blank" rel="noopener noreferrer">Leer ↗</a>
          <a className="btn btn-claro" href={`${base}#/suscribirse`} target="_blank" rel="noopener noreferrer">Suscríbete</a>
        </div>
      </section>

      <section className="lat-bloque lat-socio">
        <b>Únete a PATRIAM</b>
        <p>Hazte socio o colabora con un donativo.</p>
        <Link className="btn" to="/adhierete">Adhiérete</Link>
      </section>
    </aside>
  )
}
