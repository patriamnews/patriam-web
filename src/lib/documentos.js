// Documentos de adhesión que el socio firma electrónicamente antes de pertenecer a la asociación.
// Los textos son editables desde el panel (Páginas) por el responsable de aprobación. Cada firma guarda
// una copia exacta del texto firmado y su huella SHA-256, de modo que se puede demostrar qué se firmó.
// [CORCHETES] = datos pendientes de completar. Revisar por la Junta Directiva antes de usar.

export const DOCUMENTOS_ADHESION = [
  { clave: 'doc-normas', titulo: 'Normas de la asociación y código de conducta', obligatorio: true },
  { clave: 'doc-descargo', titulo: 'Declaración de responsabilidad y descargo', obligatorio: true },
  { clave: 'ideario', titulo: 'Ideario', obligatorio: true },
  { clave: 'doc-estatutos', titulo: 'Aceptación de los Estatutos', obligatorio: true },
  { clave: 'doc-datos', titulo: 'Consentimiento para el tratamiento de datos', obligatorio: true },
  { clave: 'doc-imagen', titulo: 'Autorización de uso de imagen (voluntaria)', obligatorio: false },
]

export const TEXTOS_ADHESION = {
  'doc-normas': {
    titulo: 'Normas de la asociación y código de conducta del asociado',
    contenido: `Versión [1.0] aprobada por la Junta Directiva el [FECHA]. Estas normas desarrollan los Estatutos de [DENOMINACIÓN DE LA ASOCIACIÓN] y obligan a todos sus asociados.

## 1. Principios de actuación

1. El asociado actuará siempre dentro de la ley y con respeto a los derechos de los demás.
2. La asociación rechaza la violencia en cualquiera de sus formas. Ningún asociado podrá emplearla, promoverla o justificarla en nombre de la asociación ni en sus actividades.
3. Queda prohibido, en las actividades y canales de la asociación, cualquier mensaje o conducta que incite al odio, a la hostilidad, a la discriminación o a la violencia contra personas o grupos, o que pueda ser constitutivo de delito.
4. El asociado tratará con respeto a los demás asociados, a los voluntarios, a los asistentes a las actividades y a los adversarios de opinión.

## 2. Participación en las acciones de la asociación

1. Solo son actividades de la asociación las convocadas oficialmente por ella a través de su web o de sus canales oficiales.
2. En cada acción, el asociado seguirá las indicaciones de los responsables designados por la asociación y las de las autoridades y fuerzas de seguridad.
3. El asociado no portará objetos peligrosos ni realizará actos que pongan en riesgo la seguridad de las personas o los bienes.
4. Si un asociado no está de acuerdo con el desarrollo de una acción, se retirará de ella y lo comunicará después a la Junta Directiva, sin alterar su normal desarrollo.

## 3. Representación e imagen de la asociación

1. Solo la Junta Directiva, o las personas que esta designe expresamente, pueden hablar en nombre de la asociación, emitir comunicados o firmar acuerdos.
2. El asociado no utilizará el nombre, el logotipo ni los símbolos de la asociación sin autorización, ni creará perfiles, grupos o webs que puedan confundirse con los oficiales.
3. En redes sociales y medios, el asociado expresa opiniones personales. No las presentará como posición oficial de la asociación.

## 4. Confidencialidad y datos

1. El asociado guardará reserva sobre los datos personales de otros asociados a los que tenga acceso y no los usará para fines ajenos a la asociación.
2. No difundirá información interna de la asociación sin autorización de la Junta Directiva.

## 5. Cuotas

El asociado abonará la cuota fijada por la Asamblea General en los plazos establecidos. El impago de [Nº] cuotas consecutivas podrá dar lugar a la baja, previo aviso.

## 6. Régimen disciplinario

1. El incumplimiento de estas normas o de los Estatutos podrá dar lugar a apercibimiento, suspensión temporal de derechos o expulsión, según su gravedad.
2. Ninguna sanción se impondrá sin comunicar al asociado los hechos y darle un plazo de [Nº] días para presentar alegaciones, conforme a los Estatutos.
3. La asociación podrá desvincularse públicamente de cualquier conducta de un asociado contraria a estas normas.

## 7. Aceptación

Al firmar, el asociado declara haber leído estas normas, entenderlas y comprometerse a cumplirlas.`,
  },

  'doc-descargo': {
    titulo: 'Declaración de responsabilidad y descargo',
    contenido: `Versión [1.0]. Declaración del asociado ante [DENOMINACIÓN DE LA ASOCIACIÓN], con NIF [NIF].

## El asociado declara y acepta:

1. **Actividades no organizadas por la asociación.** Que la asociación solo responde de las actividades que ella misma convoca y organiza oficialmente. Cualquier acto, concentración, publicación o iniciativa que el asociado realice o promueva por su cuenta, aunque sea afín a los fines de la asociación, es de su exclusiva responsabilidad personal.

2. **Actos contrarios a las normas o a las instrucciones.** Que, también dentro de una actividad organizada por la asociación, responderá personalmente de los actos que realice en contra de la ley, de los Estatutos, de las Normas de la asociación o de las instrucciones concretas dadas por los responsables de esa acción.

3. **Opiniones personales.** Que sus manifestaciones en redes sociales, medios de comunicación o en público son personales, salvo que haya sido autorizado expresamente por la Junta Directiva para hablar en nombre de la asociación.

4. **Ausencia de representación.** Que no está autorizado a contraer obligaciones, firmar documentos ni actuar en nombre de la asociación sin un mandato expreso de la Junta Directiva.

5. **Responsabilidad frente a terceros.** Que, en los supuestos anteriores, mantendrá indemne a la asociación frente a las reclamaciones de terceros derivadas de sus actos personales, en la medida permitida por la ley.

6. **Desvinculación.** Que la asociación podrá desvincularse públicamente de esos actos y aplicar el régimen disciplinario previsto en los Estatutos y en las Normas.

## Alcance

Esta declaración no limita la responsabilidad que corresponda a la asociación por sus propios actos, por su negligencia o por las actividades que organice, conforme a la ley. Tampoco afecta a los derechos del asociado como consumidor o usuario, que no pueden excluirse.

Al firmar, el asociado declara haber leído y comprendido esta declaración y aceptarla libremente.`,
  },

  ideario: {
    titulo: 'Ideario',
    contenido: `[PEGAR AQUÍ EL TEXTO DEL IDEARIO APROBADO POR LA JUNTA DIRECTIVA]

Al firmar, el asociado declara conocer el ideario de la asociación y compartir sus fines.`,
  },

  'doc-estatutos': {
    titulo: 'Aceptación de los Estatutos',
    contenido: `El asociado declara conocer y aceptar los Estatutos de [DENOMINACIÓN DE LA ASOCIACIÓN], inscrita en el Registro Nacional de Asociaciones con el número [Nº], que puede consultar en la sección Nosotros › Transparencia de esta web.

En particular, conoce sus derechos y deberes como asociado, el régimen de cuotas y el procedimiento disciplinario, y se compromete a cumplirlos.`,
  },

  'doc-datos': {
    titulo: 'Consentimiento para el tratamiento de datos',
    contenido: `Consiento expresamente que [DENOMINACIÓN DE LA ASOCIACIÓN] trate mis datos personales (nombre, email, municipio, cuota y forma de pago), que revelan mi pertenencia a la asociación y pueden revelar mis opiniones o convicciones, con la finalidad de gestionar mi condición de asociado, conforme a los artículos 6.1.a y 9.2.a del Reglamento General de Protección de Datos.

Mis datos no se cederán a terceros salvo obligación legal. Puedo ejercer en cualquier momento mis derechos de acceso, rectificación, supresión, oposición, limitación y portabilidad, y retirar este consentimiento, escribiendo a [EMAIL]. Más información en la Política de privacidad.`,
  },

  'doc-imagen': {
    titulo: 'Autorización de uso de imagen (voluntaria)',
    contenido: `Autorizo a [DENOMINACIÓN DE LA ASOCIACIÓN] a captar y publicar mi imagen en fotografías y vídeos de las actividades en las que participe, en su web, su revista y sus redes sociales, sin contraprestación económica.

Esta autorización es voluntaria: no aceptarla no impide ser asociado. Puedo revocarla en cualquier momento escribiendo a [EMAIL]. La revocación no afecta a lo ya publicado, aunque podré pedir su retirada.`,
  },
}

// Huella SHA-256 del texto (permite demostrar exactamente qué texto se firmó)
export async function huella(texto) {
  const datos = new TextEncoder().encode(texto)
  const h = await crypto.subtle.digest('SHA-256', datos)
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join('')
}
