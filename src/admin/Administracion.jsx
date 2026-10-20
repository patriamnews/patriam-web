import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { euros, fecha } from '../lib/data'
import { confirmar } from '../lib/confirmar'
import { subirArchivo } from './subir'

// Gestión administrativa y contable (solo equipo). Base del futuro sistema de contabilidad completo.

const CATEGORIAS_GASTO = {
  actividades: 'Actividades y eventos',
  tienda: 'Compras para la tienda',
  imprenta: 'Imprenta y material',
  alquiler: 'Alquiler de locales',
  web: 'Web, software y comunicaciones',
  asesoria: 'Asesoría y gestoría',
  bancos: 'Comisiones bancarias',
  seguros: 'Seguros',
  otros: 'Otros gastos',
}
const CATEGORIAS_INGRESO = { cuotas: 'Cuotas de socios', ventas: 'Ventas de la tienda', donativos: 'Donativos', otros: 'Otros ingresos' }
const MODELOS = {
  '111': 'Modelo 111 · Retenciones IRPF (trimestral)',
  '115': 'Modelo 115 · Retenciones de alquileres (trimestral)',
  '303': 'Modelo 303 · IVA (trimestral, si aplica)',
  '390': 'Modelo 390 · Resumen anual de IVA (si aplica)',
  '190': 'Modelo 190 · Resumen anual de retenciones',
  '180': 'Modelo 180 · Resumen anual de alquileres',
  '347': 'Modelo 347 · Operaciones con terceros > 3.005,06 €',
  '182': 'Modelo 182 · Donativos (solo entidades de la Ley 49/2002)',
  '200': 'Modelo 200 · Impuesto sobre Sociedades',
  otro: 'Otro documento fiscal',
}
const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
const COBRADOS = ['pagado', 'enviado', 'entregado']

const csv = (filas, cols, nombre) => {
  const t = [cols.map((c) => c[1]).join(';'), ...filas.map((r) => cols.map(([k]) => `"${String(r[k] ?? '').replace(/"/g, '""')}"`).join(';'))].join('\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob(['﻿' + t], { type: 'text/csv;charset=utf-8' }))
  a.download = nombre
  a.click()
}

export default function Administracion() {
  const [vista, setVista] = useState('resumen')
  const [anio, setAnio] = useState(new Date().getFullYear())
  const [d, setD] = useState(null)

  const cargar = async () => {
    const q = (t, o = 'creado_at') => supabase.from(t).select('*').order(o, { ascending: false }).then((r) => r.data || [])
    const [pagos, pedidos, donativos, facturas, extractos, impuestos, apuntes, web] = await Promise.all([
      q('pagos', 'fecha'), q('pedidos'), q('donativos'), q('facturas_recibidas', 'fecha'), q('extractos', 'periodo'), q('impuestos', 'periodo'), q('apuntes', 'fecha'), q('archivos_web', 'orden'),
    ])
    setD({ pagos, pedidos, donativos, facturas, extractos, impuestos, apuntes, web })
  }
  useEffect(() => {
    cargar()
  }, [])

  // Todos los movimientos del año en un único libro
  const libro = useMemo(() => {
    if (!d) return []
    const delAnio = (f) => f && new Date(f).getFullYear() === Number(anio)
    const m = [
      ...d.pagos.filter((p) => p.estado === 'cobrado' && delAnio(p.fecha)).map((p) => ({ fecha: p.fecha, tipo: 'ingreso', categoria: 'cuotas', concepto: p.concepto || 'Cuota de socio', importe: Number(p.importe), origen: 'Cuotas' })),
      ...d.pedidos.filter((p) => COBRADOS.includes(p.estado) && Number(p.total) > 0 && delAnio(p.creado_at)).map((p) => ({ fecha: p.creado_at, tipo: 'ingreso', categoria: 'ventas', concepto: `Pedido ${p.referencia}`, importe: Number(p.total), origen: 'Tienda' })),
      ...d.donativos.filter((x) => x.estado === 'confirmado' && delAnio(x.creado_at)).map((x) => ({ fecha: x.creado_at, tipo: 'ingreso', categoria: 'donativos', concepto: `Donativo ${x.referencia}`, importe: Number(x.importe), origen: 'Donativos' })),
      ...d.apuntes.filter((a) => delAnio(a.fecha)).map((a) => ({ fecha: a.fecha, tipo: a.tipo, categoria: a.categoria, concepto: a.concepto, importe: Number(a.importe), origen: 'Apunte manual' })),
      ...d.facturas.filter((f) => delAnio(f.fecha)).map((f) => ({ fecha: f.fecha, tipo: 'gasto', categoria: f.categoria, concepto: `${f.proveedor} · ${f.numero || ''} ${f.concepto || ''}`.trim(), importe: Number(f.total), origen: 'Factura recibida' })),
    ]
    return m.sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
  }, [d, anio])

  if (!d) return <p>Cargando…</p>

  const ingresos = libro.filter((m) => m.tipo === 'ingreso').reduce((t, m) => t + m.importe, 0)
  const gastos = libro.filter((m) => m.tipo === 'gasto').reduce((t, m) => t + m.importe, 0)
  const anios = [...new Set([new Date().getFullYear(), ...d.facturas.map((f) => new Date(f.fecha).getFullYear()), ...d.pagos.map((p) => new Date(p.fecha).getFullYear())])].sort((a, b) => b - a)

  const pestanas = { resumen: 'Resumen', ingresos: 'Ingresos', facturas: 'Facturas recibidas', extractos: 'Extractos bancarios', impuestos: 'Impuestos', donativos: 'Donativos', libro: 'Libro de movimientos', web: 'Carpeta Web' }

  return (
    <>
      <div className="titulo-bloque">
        <h1>Gestión administrativa</h1>
        <label className="filtros">
          Ejercicio{' '}
          <select value={anio} onChange={(e) => setAnio(Number(e.target.value))}>{anios.map((a) => <option key={a}>{a}</option>)}</select>
        </label>
      </div>
      <p className="letra-pequena">Área reservada al equipo de la asociación. Los importes de cuotas, ventas y donativos se recogen automáticamente; las facturas, extractos, impuestos y otros apuntes se añaden aquí.</p>

      <div className="cifras cifras-grandes">
        <div className="cifra"><span>Total ingresado</span><b className="positivo">{euros(ingresos.toFixed(2))}</b></div>
        <div className="cifra"><span>Total gastado</span><b className="negativo">{euros(gastos.toFixed(2))}</b></div>
        <div className="cifra"><span>Resultado {ingresos - gastos >= 0 ? '(beneficio)' : '(pérdida)'}</span><b className={ingresos - gastos >= 0 ? 'positivo' : 'negativo'}>{euros((ingresos - gastos).toFixed(2))}</b></div>
      </div>

      <div className="pestanas pestanas-admin">
        {Object.entries(pestanas).map(([k, v]) => <button key={k} className={vista === k ? 'activa' : ''} onClick={() => setVista(k)}>{v}</button>)}
      </div>

      {vista === 'resumen' && <Resumen libro={libro} />}
      {vista === 'ingresos' && <Ingresos libro={libro} apuntes={d.apuntes} recargar={cargar} />}
      {vista === 'facturas' && <Facturas facturas={d.facturas.filter((f) => new Date(f.fecha).getFullYear() === anio)} recargar={cargar} />}
      {vista === 'extractos' && <Archivo tabla="extractos" filas={d.extractos} recargar={cargar} />}
      {vista === 'impuestos' && <Archivo tabla="impuestos" filas={d.impuestos} recargar={cargar} />}
      {vista === 'donativos' && <Donativos donativos={d.donativos} anio={anio} />}
      {vista === 'libro' && <Libro libro={libro} anio={anio} />}
      {vista === 'web' && <CarpetaWeb filas={[...d.web].sort((a, b) => (a.orden || 99) - (b.orden || 99))} recargar={cargar} />}
    </>
  )
}

function Resumen({ libro }) {
  const porCat = (tipo, cats) =>
    Object.entries(cats).map(([k, v]) => [v, libro.filter((m) => m.tipo === tipo && m.categoria === k).reduce((t, m) => t + m.importe, 0)]).filter(([, n]) => n > 0)
  const meses = MESES.map((nombre, i) => {
    const delMes = libro.filter((m) => new Date(m.fecha).getMonth() === i)
    const ing = delMes.filter((m) => m.tipo === 'ingreso').reduce((t, m) => t + m.importe, 0)
    const gas = delMes.filter((m) => m.tipo === 'gasto').reduce((t, m) => t + m.importe, 0)
    return { nombre, ing, gas }
  })
  const max = Math.max(1, ...meses.map((m) => Math.max(m.ing, m.gas)))
  return (
    <>
      <div className="dos-col">
        <div className="caja-info">
          <h3>Ingresos por tipo</h3>
          <Desglose filas={porCat('ingreso', CATEGORIAS_INGRESO)} />
        </div>
        <div className="caja-info">
          <h3>Gastos por categoría</h3>
          <Desglose filas={porCat('gasto', CATEGORIAS_GASTO)} />
        </div>
      </div>
      <div className="caja-info">
        <h3>Evolución mensual</h3>
        <div className="grafico-meses" role="img" aria-label="Ingresos y gastos por mes">
          {meses.map((m) => (
            <div key={m.nombre} className="mes" title={`${m.nombre}: ingresos ${euros(m.ing.toFixed(2))}, gastos ${euros(m.gas.toFixed(2))}`}>
              <div className="barras">
                <span className="barra ing" style={{ height: `${(m.ing / max) * 100}%` }} />
                <span className="barra gas" style={{ height: `${(m.gas / max) * 100}%` }} />
              </div>
              <span className="mes-nombre">{m.nombre}</span>
            </div>
          ))}
        </div>
        <p className="leyenda"><span className="punto ing" /> Ingresos <span className="punto gas" /> Gastos</p>
      </div>
    </>
  )
}

function Desglose({ filas }) {
  if (!filas.length) return <p className="vacio">Sin movimientos.</p>
  const total = filas.reduce((t, [, n]) => t + n, 0)
  return (
    <table className="tabla desglose">
      <tbody>
        {filas.map(([k, n]) => <tr key={k}><td>{k}</td><td className="num">{euros(n.toFixed(2))}</td><td className="num mini">{Math.round((n / total) * 100)} %</td></tr>)}
        <tr className="total"><td>Total</td><td className="num">{euros(total.toFixed(2))}</td><td /></tr>
      </tbody>
    </table>
  )
}

function Ingresos({ libro, apuntes, recargar }) {
  const [f, setF] = useState(null)
  const ingresos = libro.filter((m) => m.tipo === 'ingreso')
  const guardar = async (e) => {
    e.preventDefault()
    await supabase.from('apuntes').insert({ ...f, importe: Number(f.importe) })
    setF(null)
    recargar()
  }
  const borrar = async (a) => {
    if (!confirmar('¿Eliminar este apunte?')) return
    await supabase.from('apuntes').delete().eq('id', a.id)
    recargar()
  }
  return (
    <>
      <div className="titulo-bloque">
        <p className="letra-pequena">Las cuotas cobradas, las ventas pagadas y los donativos confirmados aparecen solos. Añada aquí otros ingresos (subvenciones, entradas en mano…) o gastos sin factura.</p>
        <button className="btn" onClick={() => setF({ fecha: new Date().toISOString().slice(0, 10), tipo: 'ingreso', categoria: 'otros', concepto: '', importe: '' })}>+ Apunte manual</button>
      </div>
      {f && (
        <form className="formulario tarjeta-form" onSubmit={guardar}>
          <div className="cuatro-col">
            <label>Fecha<input type="date" required value={f.fecha} onChange={(e) => setF({ ...f, fecha: e.target.value })} /></label>
            <label>Tipo<select value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value, categoria: 'otros' })}><option value="ingreso">Ingreso</option><option value="gasto">Gasto sin factura</option></select></label>
            <label>Categoría<select value={f.categoria} onChange={(e) => setF({ ...f, categoria: e.target.value })}>{Object.entries(f.tipo === 'ingreso' ? CATEGORIAS_INGRESO : CATEGORIAS_GASTO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
            <label>Importe (€)<input type="number" step="0.01" min="0" required value={f.importe} onChange={(e) => setF({ ...f, importe: e.target.value })} /></label>
          </div>
          <label>Concepto<input required value={f.concepto} onChange={(e) => setF({ ...f, concepto: e.target.value })} /></label>
          <div className="acciones"><button className="btn">Guardar</button><button type="button" className="btn-texto" onClick={() => setF(null)}>Cancelar</button></div>
        </form>
      )}
      <div className="tabla-scroll">
        <table className="tabla">
          <thead><tr><th>Fecha</th><th>Tipo</th><th>Concepto</th><th>Origen</th><th className="num">Importe</th></tr></thead>
          <tbody>
            {ingresos.map((m, i) => <tr key={i}><td>{fecha(m.fecha)}</td><td>{CATEGORIAS_INGRESO[m.categoria] || m.categoria}</td><td>{m.concepto}</td><td>{m.origen}</td><td className="num">{euros(m.importe.toFixed(2))}</td></tr>)}
          </tbody>
        </table>
      </div>
      {apuntes.length > 0 && (
        <>
          <h3>Apuntes manuales</h3>
          <table className="tabla">
            <tbody>{apuntes.map((a) => <tr key={a.id}><td>{fecha(a.fecha)}</td><td>{a.tipo}</td><td>{a.concepto}</td><td className="num">{euros(Number(a.importe).toFixed(2))}</td><td><button className="btn-texto peligro" onClick={() => borrar(a)}>Eliminar</button></td></tr>)}</tbody>
          </table>
        </>
      )}
    </>
  )
}

function Facturas({ facturas, recargar }) {
  const NUEVA = { fecha: new Date().toISOString().slice(0, 10), proveedor: '', nif_proveedor: '', numero: '', concepto: '', categoria: 'actividades', base: '', iva: '21', pagada: false, archivo_url: '' }
  const [f, setF] = useState(null)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })
  const base = Number(f?.base) || 0
  const cuotaIva = Math.round(base * (Number(f?.iva) || 0)) / 100
  const guardar = async (e) => {
    e.preventDefault()
    const { id, creado_at, ...datos } = f
    datos.base = base
    datos.iva = Number(datos.iva) || 0
    datos.total = Math.round((base + cuotaIva) * 100) / 100
    if (id) await supabase.from('facturas_recibidas').update(datos).eq('id', id)
    else await supabase.from('facturas_recibidas').insert(datos)
    setF(null)
    recargar()
  }
  const archivo = async (e) => {
    const file = e.target.files[0]
    if (file) setF({ ...f, archivo_url: await subirArchivo('administracion', file) })
  }
  const borrar = async (x) => {
    if (!confirmar(`¿Eliminar la factura ${x.numero || ''} de ${x.proveedor}?`)) return
    await supabase.from('facturas_recibidas').delete().eq('id', x.id)
    recargar()
  }
  const pendiente = facturas.filter((x) => !x.pagada).reduce((t, x) => t + Number(x.total), 0)
  return (
    <>
      <div className="titulo-bloque">
        <p className="letra-pequena">Pendiente de pago: <b>{euros(pendiente.toFixed(2))}</b></p>
        <div className="acciones">
          <button className="btn btn-claro" onClick={() => csv(facturas, [['fecha', 'Fecha'], ['proveedor', 'Proveedor'], ['nif_proveedor', 'NIF'], ['numero', 'Nº factura'], ['concepto', 'Concepto'], ['categoria', 'Categoría'], ['base', 'Base'], ['iva', '% IVA'], ['total', 'Total'], ['pagada', 'Pagada']], 'facturas-recibidas.csv')}>Exportar (Excel)</button>
          <button className="btn" onClick={() => setF({ ...NUEVA })}>+ Factura recibida</button>
        </div>
      </div>
      {f && (
        <form className="formulario tarjeta-form" onSubmit={guardar}>
          <div className="tres-col">
            <label>Fecha<input type="date" required value={f.fecha} onChange={set('fecha')} /></label>
            <label>Proveedor<input required value={f.proveedor} onChange={set('proveedor')} /></label>
            <label>NIF del proveedor<input value={f.nif_proveedor || ''} onChange={set('nif_proveedor')} /></label>
          </div>
          <div className="tres-col">
            <label>Nº de factura<input value={f.numero || ''} onChange={set('numero')} /></label>
            <label>Concepto<input value={f.concepto || ''} onChange={set('concepto')} /></label>
            <label>Categoría<select value={f.categoria} onChange={set('categoria')}>{Object.entries(CATEGORIAS_GASTO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          </div>
          <div className="cuatro-col">
            <label>Base imponible (€)<input type="number" step="0.01" min="0" required value={f.base} onChange={set('base')} /></label>
            <label>% IVA<select value={f.iva} onChange={set('iva')}><option value="21">21 %</option><option value="10">10 %</option><option value="4">4 %</option><option value="0">Exenta / 0 %</option></select></label>
            <label>Total<input disabled value={euros((base + cuotaIva).toFixed(2))} /></label>
            <label>Factura (PDF o foto)<input type="file" accept="application/pdf,image/*" onChange={archivo} /></label>
          </div>
          <label className="check"><input type="checkbox" checked={f.pagada} onChange={set('pagada')} /><span>Pagada</span></label>
          <div className="acciones"><button className="btn">Guardar</button><button type="button" className="btn-texto" onClick={() => setF(null)}>Cancelar</button></div>
        </form>
      )}
      <div className="tabla-scroll">
        <table className="tabla">
          <thead><tr><th>Fecha</th><th>Proveedor</th><th>Nº</th><th>Concepto</th><th>Categoría</th><th className="num">Base</th><th className="num">Total</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            {facturas.map((x) => (
              <tr key={x.id}>
                <td>{fecha(x.fecha)}</td><td>{x.proveedor}</td><td>{x.numero}</td><td>{x.concepto}</td><td>{CATEGORIAS_GASTO[x.categoria]}</td>
                <td className="num">{euros(Number(x.base).toFixed(2))}</td><td className="num">{euros(Number(x.total).toFixed(2))}</td>
                <td><span className={`estado ${x.pagada ? 'estado-publicado' : 'estado-programado'}`}>{x.pagada ? 'Pagada' : 'Pendiente'}</span></td>
                <td className="acciones-fila">
                  {x.archivo_url && <a href={x.archivo_url} target="_blank" rel="noopener noreferrer">Ver</a>}
                  <button className="btn-texto" onClick={() => setF({ ...NUEVA, ...x, iva: String(x.iva) })}>Editar</button>
                  <button className="btn-texto peligro" onClick={() => borrar(x)}>Eliminar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!facturas.length && <p className="vacio">No hay facturas en este ejercicio.</p>}
    </>
  )
}

// Carpetas documentales: extractos bancarios e impuestos
function Archivo({ tabla, filas, recargar }) {
  const esImp = tabla === 'impuestos'
  const NUEVO = esImp
    ? { modelo: '111', periodo: '', fecha_presentacion: '', importe: '', estado: 'pendiente', nota: '', archivo_url: '' }
    : { banco: '', periodo: new Date().toISOString().slice(0, 7), nota: '', archivo_url: '' }
  const [f, setF] = useState(null)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const archivo = async (e) => {
    const file = e.target.files[0]
    if (file) setF({ ...f, archivo_url: await subirArchivo('administracion', file) })
  }
  const guardar = async (e) => {
    e.preventDefault()
    const { id, creado_at, ...datos } = f
    if (esImp) datos.importe = datos.importe === '' ? null : Number(datos.importe)
    if (id) await supabase.from(tabla).update(datos).eq('id', id)
    else await supabase.from(tabla).insert(datos)
    setF(null)
    recargar()
  }
  const borrar = async (x) => {
    if (!confirmar('¿Eliminar este documento?')) return
    await supabase.from(tabla).delete().eq('id', x.id)
    recargar()
  }
  return (
    <>
      <div className="titulo-bloque">
        <p className="letra-pequena">
          {esImp
            ? 'Carpeta de impuestos: guarde cada modelo presentado con su justificante. Confirme con la gestoría qué modelos le corresponden a la asociación.'
            : 'Carpeta de extractos bancarios: suba el extracto de cada mes (PDF o el fichero que descarga el banco).'}
        </p>
        <button className="btn" onClick={() => setF({ ...NUEVO })}>{esImp ? '+ Documento fiscal' : '+ Extracto'}</button>
      </div>
      {f && (
        <form className="formulario tarjeta-form" onSubmit={guardar}>
          {esImp ? (
            <>
              <div className="tres-col">
                <label>Modelo<select value={f.modelo} onChange={set('modelo')}>{Object.entries(MODELOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
                <label>Periodo<input required value={f.periodo} onChange={set('periodo')} placeholder="2026-3T, 2026…" /></label>
                <label>Fecha de presentación<input type="date" value={f.fecha_presentacion || ''} onChange={set('fecha_presentacion')} /></label>
              </div>
              <div className="tres-col">
                <label>Importe (€)<input type="number" step="0.01" value={f.importe ?? ''} onChange={set('importe')} /></label>
                <label>Estado<select value={f.estado} onChange={set('estado')}><option value="pendiente">Pendiente</option><option value="presentado">Presentado</option><option value="pagado">Presentado y pagado</option></select></label>
                <label>Justificante<input type="file" accept="application/pdf,image/*" onChange={archivo} /></label>
              </div>
            </>
          ) : (
            <div className="tres-col">
              <label>Banco<input required value={f.banco} onChange={set('banco')} /></label>
              <label>Mes<input type="month" required value={f.periodo} onChange={set('periodo')} /></label>
              <label>Archivo<input type="file" accept="application/pdf,.csv,.xls,.xlsx,.n43,.txt" onChange={archivo} /></label>
            </div>
          )}
          <label>Nota<input value={f.nota || ''} onChange={set('nota')} /></label>
          <div className="acciones"><button className="btn">Guardar</button><button type="button" className="btn-texto" onClick={() => setF(null)}>Cancelar</button></div>
        </form>
      )}
      <div className="tabla-scroll">
        <table className="tabla">
          <thead>
            {esImp ? <tr><th>Modelo</th><th>Periodo</th><th>Presentación</th><th className="num">Importe</th><th>Estado</th><th></th></tr> : <tr><th>Mes</th><th>Banco</th><th>Nota</th><th></th></tr>}
          </thead>
          <tbody>
            {filas.map((x) => (
              <tr key={x.id}>
                {esImp ? (
                  <>
                    <td>{MODELOS[x.modelo] || x.modelo}</td><td>{x.periodo}</td><td>{x.fecha_presentacion ? fecha(x.fecha_presentacion) : '—'}</td>
                    <td className="num">{x.importe != null ? euros(Number(x.importe).toFixed(2)) : '—'}</td>
                    <td><span className={`estado ${x.estado === 'pendiente' ? 'estado-programado' : 'estado-publicado'}`}>{{ pendiente: 'Pendiente', presentado: 'Presentado', pagado: 'Presentado y pagado' }[x.estado]}</span></td>
                  </>
                ) : (
                  <><td>{x.periodo}</td><td>{x.banco}</td><td>{x.nota}</td></>
                )}
                <td className="acciones-fila">
                  {x.archivo_url ? <a href={x.archivo_url} target="_blank" rel="noopener noreferrer">Abrir</a> : <span className="mini">Sin archivo</span>}
                  <button className="btn-texto" onClick={() => setF({ ...NUEVO, ...x })}>Editar</button>
                  <button className="btn-texto peligro" onClick={() => borrar(x)}>Eliminar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!filas.length && <p className="vacio">La carpeta está vacía.</p>}
    </>
  )
}

function Donativos({ donativos, anio }) {
  const delAnio = donativos.filter((x) => new Date(x.creado_at).getFullYear() === anio)
  const conf = delAnio.filter((x) => x.estado === 'confirmado')
  return (
    <>
      <div className="cifras">
        <div className="cifra"><b>{conf.length}</b>Donativos recibidos</div>
        <div className="cifra"><b>{euros(conf.reduce((t, x) => t + Number(x.importe), 0).toFixed(2))}</b>Importe recibido</div>
        <div className="cifra"><b>{delAnio.filter((x) => x.estado === 'pendiente').length}</b>Pendientes de confirmar</div>
        <div className="cifra"><b>{conf.filter((x) => !x.email).length}</b>Anónimos</div>
      </div>
      <p className="letra-pequena">Los donativos se confirman en Socios y donativos al comprobar el cobro. La deducción fiscal (modelo 182) solo procede si la asociación está acogida a la Ley 49/2002 (declarada de utilidad pública).</p>
      <div className="tabla-scroll">
        <table className="tabla">
          <thead><tr><th>Fecha</th><th>Referencia</th><th>Método</th><th>Donante</th><th className="num">Importe</th><th>Estado</th></tr></thead>
          <tbody>{delAnio.map((x) => <tr key={x.id}><td>{fecha(x.creado_at)}</td><td><code>{x.referencia}</code></td><td>{x.metodo}</td><td>{x.email || 'Anónimo'}</td><td className="num">{euros(Number(x.importe).toFixed(2))}</td><td>{x.estado}</td></tr>)}</tbody>
        </table>
      </div>
    </>
  )
}

function Libro({ libro, anio }) {
  let saldo = 0
  const filas = [...libro].reverse().map((m) => ({ ...m, saldo: (saldo += m.tipo === 'ingreso' ? m.importe : -m.importe) })).reverse()
  return (
    <>
      <div className="titulo-bloque">
        <p className="letra-pequena">Todos los movimientos del ejercicio en orden cronológico. Base para la contabilidad completa: se podrá ampliar con plan de cuentas, asientos y cuentas anuales.</p>
        <button className="btn btn-claro" onClick={() => csv(filas.map((m) => ({ ...m, fecha: String(m.fecha).slice(0, 10) })), [['fecha', 'Fecha'], ['tipo', 'Tipo'], ['categoria', 'Categoría'], ['concepto', 'Concepto'], ['origen', 'Origen'], ['importe', 'Importe'], ['saldo', 'Saldo']], `libro-movimientos-${anio}.csv`)}>Exportar (Excel)</button>
      </div>
      <div className="tabla-scroll">
        <table className="tabla">
          <thead><tr><th>Fecha</th><th>Concepto</th><th>Origen</th><th className="num">Ingreso</th><th className="num">Gasto</th><th className="num">Saldo</th></tr></thead>
          <tbody>
            {filas.map((m, i) => (
              <tr key={i}>
                <td>{fecha(m.fecha)}</td><td>{m.concepto}</td><td>{m.origen}</td>
                <td className="num positivo">{m.tipo === 'ingreso' ? euros(m.importe.toFixed(2)) : ''}</td>
                <td className="num negativo">{m.tipo === 'gasto' ? euros(m.importe.toFixed(2)) : ''}</td>
                <td className="num">{euros(m.saldo.toFixed(2))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

// Carpeta "Web": código fuente, versión publicada y documentación técnica de la web
const TIPOS_WEB = { codigo: 'Código fuente', despliegue: 'Versión para Netlify', documentacion: 'Documentación técnica', contrato: 'Contrato o factura', otro: 'Otro' }

function CarpetaWeb({ filas, recargar }) {
  const NUEVO = { titulo: '', tipo: 'documentacion', version: '', fecha: new Date().toISOString().slice(0, 10), nota: '', archivo_url: '', nombre_archivo: '' }
  const [f, setF] = useState(null)
  const [subiendo, setSubiendo] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const archivo = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setSubiendo(true)
    const url = await subirArchivo('administracion', file)
    setF((x) => ({ ...x, archivo_url: url, nombre_archivo: file.name, tamano: file.size }))
    setSubiendo(false)
  }
  const guardar = async (e) => {
    e.preventDefault()
    const { id, creado_at, ...datos } = f
    if (id) await supabase.from('archivos_web').update(datos).eq('id', id)
    else await supabase.from('archivos_web').insert(datos)
    setF(null)
    recargar()
  }
  const borrar = async (x) => {
    if (!confirmar('¿Eliminar este archivo de la carpeta Web?')) return
    await supabase.from('archivos_web').delete().eq('id', x.id)
    recargar()
  }
  const kb = (n) => (n ? (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`) : '')
  return (
    <>
      <div className="titulo-bloque">
        <p className="letra-pequena">Carpeta Web: aquí se guardan el código fuente de la web, la versión que se sube a Netlify y el documento de entrega técnica. Solo la ve el equipo y los archivos quedan en un almacenamiento privado.</p>
        <button className="btn" onClick={() => setF({ ...NUEVO })}>+ Subir archivo</button>
      </div>
      {f && (
        <form className="formulario tarjeta-form" onSubmit={guardar}>
          <div className="tres-col">
            <label>Título<input required value={f.titulo} onChange={set('titulo')} /></label>
            <label>Tipo<select value={f.tipo} onChange={set('tipo')}>{Object.entries(TIPOS_WEB).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
            <label>Versión<input value={f.version || ''} onChange={set('version')} placeholder="1.0, 2026-10-02…" /></label>
          </div>
          <div className="tres-col">
            <label>Fecha<input type="date" value={f.fecha || ''} onChange={set('fecha')} /></label>
            <label>Archivo<input type="file" onChange={archivo} /></label>
            <span className="letra-pequena">{subiendo ? 'Subiendo…' : f.nombre_archivo ? `Archivo: ${f.nombre_archivo}` : 'Sin archivo todavía'}</span>
          </div>
          <label>Nota<input value={f.nota || ''} onChange={set('nota')} /></label>
          <div className="acciones"><button className="btn" disabled={subiendo}>Guardar</button><button type="button" className="btn-texto" onClick={() => setF(null)}>Cancelar</button></div>
        </form>
      )}
      <div className="carpeta-web">
        {filas.map((x) => (
          <div key={x.id} className="archivo-web">
            <span className={`icono-archivo tipo-${x.tipo}`} aria-hidden>{{ codigo: '</>', despliegue: '▲', documentacion: '¶', contrato: '€', otro: '•' }[x.tipo] || '•'}</span>
            <div className="archivo-web-cuerpo">
              <span className="etiqueta">{TIPOS_WEB[x.tipo] || x.tipo}{x.version ? ` · v${x.version}` : ''}</span>
              <b>{x.titulo}</b>
              {x.nota && <span className="letra-pequena">{x.nota}</span>}
              <span className="letra-pequena">{x.fecha ? fecha(x.fecha) : ''}{x.nombre_archivo ? ` · ${x.nombre_archivo}` : ''}{x.tamano ? ` · ${kb(x.tamano)}` : ''}</span>
            </div>
            <div className="archivo-web-acciones">
              {x.archivo_url ? <a className="btn btn-claro" href={x.archivo_url} download={x.nombre_archivo || true} target="_blank" rel="noopener noreferrer">Descargar</a> : <span className="estado estado-programado">Pendiente de subir</span>}
              <button className="btn-texto" onClick={() => setF({ ...NUEVO, ...x })}>{x.archivo_url ? 'Editar' : 'Subir'}</button>
              <button className="btn-texto peligro" onClick={() => borrar(x)}>Eliminar</button>
            </div>
          </div>
        ))}
        {!filas.length && <p className="vacio">La carpeta está vacía.</p>}
      </div>
    </>
  )
}
