import svg from '../assets/ideario.svg?raw'

// Ilustración del ideario (SVG en línea para que use la tipografía de la web)
export default function Ideario({ className = '' }) {
  return (
    <figure className={`ideario-ilustracion ${className}`}>
      <div dangerouslySetInnerHTML={{ __html: svg }} />
      <figcaption>Ilustración creada con ayuda de inteligencia artificial a partir del ideario de PATRIAM.</figcaption>
    </figure>
  )
}
