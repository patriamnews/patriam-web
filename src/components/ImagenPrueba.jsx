// Imagen de prueba: ocupa el lugar de la foto hasta que se suba una real desde el panel.
export default function ImagenPrueba({ texto = 'Imagen de prueba', className = '', ratio = '16 / 9' }) {
  return (
    <div className={`imagen-prueba ${className}`} style={{ aspectRatio: ratio }} role="img" aria-label={texto}>
      <svg viewBox="0 0 64 48" width="56" height="42" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" aria-hidden>
        <rect x="2" y="2" width="60" height="44" rx="3" />
        <circle cx="20" cy="16" r="5" />
        <path d="M2 38l16-14 12 10 10-8 22 16" />
      </svg>
      <span>{texto}</span>
    </div>
  )
}

// Muestra la imagen real si existe; si no, la de prueba
export function Foto({ src, alt = '', ratio = '16 / 9', className = '', texto }) {
  return src ? (
    <img src={src} alt={alt} className={`foto ${className}`} style={{ aspectRatio: ratio }} loading="lazy" />
  ) : (
    <ImagenPrueba ratio={ratio} className={className} texto={texto} />
  )
}
