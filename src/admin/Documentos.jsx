import { confirmar } from '../lib/confirmar'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { CATEGORIAS_DOC } from '../lib/config'
import { fecha } from '../lib/data'
import { subirArchivo } from './subir'

const SUGERIDOS = [
  'Estatutos',
  'Acta fundacional',
  'Resolución de inscripción en el Registro de Asociaciones',
  'Tarjeta de identificación fiscal (NIF)',
  'Composición de la Junta Directiva',
  'Cuentas anuales',
  'Presupuesto anual',
  'Memoria de actividades',
  'Subvenciones y ayudas públicas recibidas',
  'Contratos y convenios con administraciones públicas',
]

export default function Documentos() {
  const [lista, setLista] = useState([])
  const [f, setF] = useState({ titulo: '', categoria: 'constitucion', fecha: '', publico: true })
  const [archivo, setArchivo] = useState(null)
  const [error, setError] = useState('')
  const [subiendo, setSubiendo] = useState(false)

  const cargar = () =>
    supabase.from('documentos').select('*').order('fecha', { ascending: false }).then(({ data }) => setLista(data || []))
  useEffect(() => {
    cargar()
  }, [])

  const guardar = async (e) => {
    e.preventDefault()
    setError('')
    if (!archivo) return setError('Seleccione el archivo (PDF).')
    try {
      setSubiendo(true)
      const url = await subirArchivo('documentos', archivo)
      const { error } = await supabase.from('documentos').insert({ ...f, fecha: f.fecha || null, archivo_url: url })
      if (error) throw error
      setF({ titulo: '', categoria: 'constitucion', fecha: '', publico: true })
      setArchivo(null)
      e.target.reset()
      cargar()
    } catch (err) {
      setError('No se pudo subir: ' + err.message)
    } finally {
      setSubiendo(false)
    }
  }

  const alternar = async (d) => {
    await supabase.from('documentos').update({ publico: !d.publico }).eq('id', d.id)
    cargar()
  }

  const borrar = async (id) => {
    if (!confirmar('¿Eliminar este documento de la web?')) return
    await supabase.from('documentos').delete().eq('id', id)
    cargar()
  }

  return (
    <>
      <h1>Documentos de transparencia</h1>
      <div className="caja-aviso">
        Se publican en <b>Nosotros › Transparencia</b>. Revise que los documentos no contengan datos personales innecesarios (DNI, domicilios, firmas) antes de subirlos.
      </div>
      <form className="formulario tarjeta-form" onSubmit={guardar}>
        <label>
          Título
          <input required list="sugeridos" value={f.titulo} onChange={(e) => setF({ ...f, titulo: e.target.value })} />
          <datalist id="sugeridos">{SUGERIDOS.map((s) => <option key={s} value={s} />)}</datalist>
        </label>
        <div className="dos-col">
          <label>
            Categoría
            <select value={f.categoria} onChange={(e) => setF({ ...f, categoria: e.target.value })}>
              {Object.entries(CATEGORIAS_DOC).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label>Fecha<input type="date" value={f.fecha} onChange={(e) => setF({ ...f, fecha: e.target.value })} /></label>
        </div>
        <label>Archivo<input type="file" accept="application/pdf" onChange={(e) => setArchivo(e.target.files[0])} /></label>
        {error && <p className="error">{error}</p>}
        <div className="acciones"><button className="btn" disabled={subiendo}>{subiendo ? 'Subiendo…' : 'Subir documento'}</button></div>
      </form>
      <table className="tabla">
        <thead><tr><th>Documento</th><th>Categoría</th><th>Fecha</th><th>Público</th><th></th></tr></thead>
        <tbody>
          {lista.map((d) => (
            <tr key={d.id}>
              <td>{d.archivo_url && d.archivo_url !== '#' ? <a href={d.archivo_url} target="_blank" rel="noopener noreferrer">{d.titulo}</a> : <>{d.titulo} <em className="letra-pequena">(sin archivo: súbalo)</em></>}</td>
              <td>{CATEGORIAS_DOC[d.categoria]}</td>
              <td>{fecha(d.fecha)}</td>
              <td><button className="btn-texto" onClick={() => alternar(d)}>{d.publico ? 'Sí' : 'No'}</button></td>
              <td><button className="btn-texto peligro" onClick={() => borrar(d.id)}>Eliminar</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}
