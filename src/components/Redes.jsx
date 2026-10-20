// Enlaces a redes sociales (se configuran en Panel › Ajustes). Iconos SVG propios, sin servicios externos ni cookies.
const ICONOS = {
  x: ['X', 'M4 4l16 16M20 4L4 20'],
  instagram: ['Instagram', 'M7 3h10a4 4 0 014 4v10a4 4 0 01-4 4H7a4 4 0 01-4-4V7a4 4 0 014-4zm5 5a4 4 0 100 8 4 4 0 000-8zm5.5-1.5h.01'],
  facebook: ['Facebook', 'M15 3h-2.5A3.5 3.5 0 009 6.5V9H7v3h2v9h3v-9h2.5l.5-3h-3V7a1 1 0 011-1h2z'],
  youtube: ['YouTube', 'M3 7.5A2.5 2.5 0 015.5 5h13A2.5 2.5 0 0121 7.5v9a2.5 2.5 0 01-2.5 2.5h-13A2.5 2.5 0 013 16.5zM10 9v6l5-3z'],
  telegram: ['Telegram', 'M21 4L3 11l6 2 2 6 3-4 5 4z'],
  tiktok: ['TikTok', 'M14 3v11a3 3 0 11-3-3m3-8c0 3 2 5 5 5'],
}

export default function Redes({ aj, clase = 'redes' }) {
  const activas = Object.keys(ICONOS).filter((k) => aj?.[k])
  if (!activas.length) return null
  return (
    <div className={clase}>
      {activas.map((k) => (
        <a key={k} href={aj[k]} target="_blank" rel="noopener noreferrer" aria-label={ICONOS[k][0]} title={ICONOS[k][0]}>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d={ICONOS[k][1]} />
          </svg>
        </a>
      ))}
    </div>
  )
}
