import { useMemo } from 'react'

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
const DIAS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
export const claveDia = (d) => {
  const f = new Date(d)
  return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`
}

// Calendario mensual: marca los días con acciones. Al pulsar un día se selecciona.
export default function Calendario({ mes, setMes, acciones, dia, setDia }) {
  const [y, m] = mes
  const conAccion = useMemo(() => {
    const s = {}
    acciones.forEach((a) => (s[claveDia(a.fecha_inicio)] = (s[claveDia(a.fecha_inicio)] || 0) + 1))
    return s
  }, [acciones])

  const primero = new Date(y, m, 1)
  const hueco = (primero.getDay() + 6) % 7 // lunes = 0
  const total = new Date(y, m + 1, 0).getDate()
  const hoy = claveDia(new Date())
  const celdas = [...Array(hueco).fill(null), ...Array.from({ length: total }, (_, i) => i + 1)]

  const mover = (n) => {
    const d = new Date(y, m + n, 1)
    setMes([d.getFullYear(), d.getMonth()])
    setDia(null)
  }

  return (
    <div className="calendario">
      <div className="cal-cab">
        <button onClick={() => mover(-1)} aria-label="Mes anterior">‹</button>
        <b>{MESES[m]} {y}</b>
        <button onClick={() => mover(1)} aria-label="Mes siguiente">›</button>
      </div>
      <div className="cal-rejilla">
        {DIAS.map((d) => <span key={d} className="cal-dia-nombre">{d}</span>)}
        {celdas.map((n, i) => {
          if (!n) return <span key={`v${i}`} />
          const k = `${y}-${String(m + 1).padStart(2, '0')}-${String(n).padStart(2, '0')}`
          const tiene = conAccion[k]
          return (
            <button
              key={k}
              className={`cal-dia ${tiene ? 'con' : ''} ${k === hoy ? 'hoy' : ''} ${k === dia ? 'sel' : ''}`}
              disabled={!tiene}
              onClick={() => setDia(k === dia ? null : k)}
              aria-label={`${n} de ${MESES[m]}${tiene ? `, ${tiene} acción${tiene > 1 ? 'es' : ''}` : ''}`}
            >
              {n}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export { MESES }
