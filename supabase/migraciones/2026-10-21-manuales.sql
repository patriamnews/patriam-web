-- ---------- Manuales de cumplimiento (internos: solo el equipo) ----------
create table if not exists manuales (
  id bigint generated always as identity primary key,
  titulo text not null,
  area text not null default 'proteccion-datos',
  version text not null default '1.0',
  fecha date not null default current_date,
  esquema text not null default '',
  contenido text not null default '',
  orden int not null default 0,
  creado_por uuid default auth.uid(),
  actualizado_at timestamptz not null default now()
);
alter table manuales enable row level security;
drop policy if exists "solo equipo" on manuales;
create policy "solo equipo" on manuales for all using (es_equipo()) with check (es_equipo());

insert into manuales (titulo, area, version, fecha, orden, esquema, contenido)
select 'Manual de protección de datos', 'proteccion-datos', '1.0', '2026-10-21', 1,
$manual$### 1. Qué datos tratamos
- Socios, donantes, voluntarios, suscriptores, asistentes, clientes de la tienda y contactos de la web.
- Cada colectivo con su finalidad y su base jurídica (art. 6 RGPD).
- Solo los datos mínimos necesarios.

### 2. Datos especialmente protegidos
- Ser de PATRIAM puede revelar convicciones: es categoría especial (art. 9 RGPD).
- Nunca se ceden listados fuera de la asociación sin consentimiento.
- Nunca se publican listados de socios, donantes o voluntarios.

### 3. Las listas de correo
- Una lista por colectivo: Socios, Donantes, Voluntarios, Boletín y Eventos.
- Alta voluntaria (opt-in) y baja en cada envío (opt-out).
- Solo el responsable y la encargada acceden al fichero de listas.
- Envíos siempre desde la plataforma, sin direcciones visibles. WhatsApp solo por canal o lista de difusión.

### 4. Papeles obligatorios
- Registro de actividades de tratamiento.
- Cláusula informativa en la web y en el pie del boletín.
- Contrato de encargo con la encargada del tratamiento.
- Compromiso de confidencialidad de la Junta y colaboradores.

### 5. Plazos clave
- Derechos de los interesados: responder en 1 mes.
- Brecha de seguridad: aviso a la AEPD en 72 horas si hay riesgo.
- Tras la baja: datos bloqueados 4 años (fiscal) y después suprimidos.

### 6. Lo que no es obligatorio
- DPD: no obligatorio. Persona de referencia: Álvaro Mencos.
- Evaluación de impacto: no, salvo tratamientos de alto riesgo.
- Canal de denuncias: solo a partir de 50 trabajadores.

### 7. La web
- Aviso legal, política de privacidad y de cookies.
- Casillas sin premarcar y casilla aparte para el boletín.
- Panel con usuarios nominativos y doble factor.

### 8. Errores que más se sancionan
- Correos con las direcciones visibles en "Para".
- Grupos de WhatsApp con los teléfonos a la vista.
- Fotos de menores sin autorización.
- No contestar a quien ejerce sus derechos.
$manual$,
$manual$## Introducción

La Asociación PATRIAM es responsable del tratamiento de los datos personales que maneja y debe cumplir el RGPD y la LOPDGDD sin ningún régimen aligerado por carecer de ánimo de lucro. Este manual recoge, en seis epígrafes, qué datos trata la asociación, con qué base jurídica y qué medidas debe tener implantadas y documentadas.

**Datos del responsable**

- Denominación: Asociación PATRIAM
- CIF: G93940476
- Domicilio social: C/ Tórtola, 21, Valladolid
- Registro de Asociaciones: nº 47/1/0006465
- Contacto para protección de datos: movimientopatriam@gmail.com
- Persona de referencia en protección de datos: Álvaro Mencos
- Encargada del tratamiento (web, tienda y boletín): Isabel Olivares de la Cerda

**Normativa aplicable**

- Reglamento (UE) 2016/679, General de Protección de Datos (RGPD).
- Ley Orgánica 3/2018, de Protección de Datos Personales y garantía de los derechos digitales (LOPDGDD).
- Ley Orgánica 1/2002, reguladora del Derecho de Asociación (libro registro de asociados y derechos de los socios).
- Ley 34/2002, de Servicios de la Sociedad de la Información (LSSI): web, cookies y comunicaciones comerciales.
- Normativa sectorial cuando proceda: Ley 49/2002 (mecenazgo), Ley 45/2015 (voluntariado), LO 1/1996 de protección jurídica del menor.

**Quién responde**

La responsable es la asociación como persona jurídica. La Junta Directiva impulsa y supervisa el cumplimiento, aprueba este manual y designa a una persona de referencia en protección de datos. Toda persona con acceso a datos (Junta, voluntarios, colaboradores) actúa bajo la autoridad de la asociación y queda sujeta a deber de confidencialidad.

## 1. Mapa de tratamientos y bases de legitimación

Cada tratamiento necesita una finalidad concreta y una base jurídica del art. 6 RGPD. La tabla resume los tratamientos de la asociación.

| Colectivo | Finalidad | Lista de correo | Base jurídica | Datos mínimos | Observaciones |
| --- | --- | --- | --- | --- | --- |
| Socios | Gestión de la relación asociativa, cuotas, convocatorias | Lista "Socios" | Art. 6.1.b RGPD (relación asociativa) y 6.1.c (libro registro de asociados, art. 14 LO 1/2002) | Nombre, DNI, contacto, fecha de alta/baja, datos bancarios si hay domiciliación | Las convocatorias de asamblea y avisos estatutarios se envían aunque el socio se dé de baja de la lista informativa. La pertenencia puede ser categoría especial (epígrafe 2) |
| Donantes | Gestión de donaciones, certificados fiscales e información sobre la asociación | Lista "Donantes" | Art. 6.1.c RGPD (Ley 49/2002, modelo 182); consentimiento (6.1.a) para la lista | Nombre, NIF, domicilio, importe, email | El certificado fiscal no depende de estar en la lista |
| Voluntarios | Gestión del voluntariado y coordinación de actividades | Lista "Voluntarios" | Art. 6.1.b y 6.1.c RGPD (Ley 45/2015) | Identificación, contacto, disponibilidad | Si tratan con menores: verificar certificado de delitos sexuales sin conservar copia más de lo necesario (art. 10 RGPD) |
| Suscriptores del boletín | Envío del boletín y novedades | Lista "Boletín" | Art. 6.1.a RGPD (consentimiento) y art. 21 LSSI | Email y, en su caso, nombre | Alta solo por opt-in acreditable |
| Asistentes a eventos | Inscripción, organización del evento y, si lo aceptan, avisos de próximos eventos | Lista "Eventos" | Art. 6.1.b RGPD para la inscripción; consentimiento (6.1.a) para la lista | Nombre y contacto | Sin consentimiento, los datos se suprimen tras el evento |
| Clientes de la tienda | Gestión de pedidos y envíos | No aplica, salvo opt-in a otra lista | Art. 6.1.b RGPD | Nombre, email, teléfono, dirección de envío | Los datos de pago los gestiona directamente la entidad de pago |
| Imágenes en actos | Difusión de la actividad | No aplica | Consentimiento (6.1.a) o interés legítimo ponderado (6.1.f) para planos generales | Imagen | Menores de 14 años: consentimiento de padres o tutores (art. 7 LOPDGDD) |
| Contactos de la web | Responder consultas | No aplica, salvo opt-in a otra lista | Art. 6.1.a o 6.1.f RGPD | Nombre, email, mensaje | Suprimir cuando se resuelva la consulta |

**Regla práctica:** no recoger ningún dato que no esté en la columna de datos mínimos sin justificar antes para qué se necesita (principio de minimización, art. 5.1.c RGPD).

**Listas de correo**

La asociación organiza sus comunicaciones en listas separadas por colectivo: Socios, Donantes, Voluntarios, Boletín y Eventos. Una persona puede estar en varias listas, y cada una se gestiona de forma independiente.

- **Opt-in:** la inclusión en cada lista es voluntaria y se recoge de forma expresa y acreditable (fecha, origen y texto aceptado), salvo las comunicaciones propias de la relación asociativa con los socios.
- **Opt-out:** cada envío incluye un enlace de baja sencillo y gratuito (art. 21 LSSI). La baja de una lista no afecta a las demás ni a las comunicaciones obligatorias.
- **Acceso restringido:** solo tienen los listados el responsable del tratamiento, a través de la persona autorizada por la Junta Directiva, y la encargada del tratamiento, Isabel Olivares de la Cerda, que desarrolla y mantiene la web, la tienda de merchandising y el boletín, con contrato del art. 28 RGPD. Nadie más conserva copias. Los listados se guardan en un fichero dentro del sistema del boletín, protegido con un nivel de acceso adicional que solo permite entrar al responsable y a la encargada.
- **Envíos:** siempre desde la plataforma o con destinatarios ocultos; nunca con las direcciones visibles.

## 2. Categorías especiales de datos

Si de la mera pertenencia a la asociación puede inferirse la ideología, la religión o las convicciones del socio, el dato de afiliación es una categoría especial del art. 9 RGPD y exige un nivel de protección reforzado. Es habitual en asociaciones culturales, cívicas o con un ideario definido.

**Habilitación aplicable**

- El art. 9.2.d RGPD permite a fundaciones, asociaciones y otros organismos sin ánimo de lucro con finalidad política, filosófica, religiosa o sindical tratar los datos de sus miembros y de quienes mantengan contactos regulares con ellos, en el marco de sus actividades legítimas.
- Condición esencial: los datos **no se comunican fuera de la asociación sin el consentimiento** de los interesados.
- El art. 9.1 LOPDGDD añade que el consentimiento por sí solo no basta para tratar datos cuya finalidad principal sea identificar ideología, afiliación sindical, religión, orientación sexual, creencias u origen racial o étnico.

**Medidas reforzadas**

- **Listas de correo separadas por colectivo** (Socios, Donantes, Voluntarios, Boletín y Eventos), como se describe en el epígrafe 1. Estar en una lista no implica estar en otra.
- **Custodia de los listados:** solo los tienen el responsable del tratamiento, a través de la persona autorizada por la Junta Directiva, y la encargada del tratamiento, Isabel Olivares de la Cerda (web, tienda y boletín), con contrato del art. 28 RGPD. Ningún otro miembro de la Junta, voluntario o colaborador recibe ni conserva copias, ni en Excel ni en el correo. Los listados se almacenan en un único fichero del sistema del boletín, protegido con un nivel de acceso adicional restringido al responsable y a la encargada.
- **Opt-in y opt-out en cada envío:** la inclusión en cada lista es voluntaria y acreditable, y cada envío permite darse de baja. Así, quien no quiera que su vínculo con la asociación conste en una lista puede salir de ella en cualquier momento.
- **Envíos solo desde la plataforma:** ningún destinatario ve a los demás, por lo que no se revela la pertenencia de nadie a la asociación.
- **Difusión por WhatsApp:** solo mediante canal de WhatsApp o lista de difusión, nunca en grupos, porque en un grupo todos ven los teléfonos de los demás.
- **Ninguna cesión** de los listados a terceros, aunque sean entidades afines, sin consentimiento expreso de cada persona. Es la condición del art. 9.2.d RGPD.
- **No publicar** listados de socios, donantes o voluntarios en la web, redes ni actas de difusión pública.
- Valorar en el análisis de riesgos si el volumen o la sensibilidad aconsejan cifrado o una evaluación de impacto (epígrafe 4).

**Acceso de los socios a los libros:** el art. 21 LO 1/2002 reconoce a los socios el derecho a consultar los libros de la asociación. Ese acceso debe hacerse de forma controlada (consulta en sede o a petición motivada), sin entregar copias del listado ni autorizar su difusión.

## 3. Obligaciones formales

La asociación debe poder demostrar su cumplimiento (responsabilidad proactiva, art. 5.2 RGPD). Estas son las obligaciones que deben estar implantadas y documentadas.

| Obligación | Norma | Qué hay que tener | Responsable interno |
| --- | --- | --- | --- |
| Registro de actividades de tratamiento | Art. 30 RGPD; art. 31 LOPDGDD | Documento con cada tratamiento: finalidad, base jurídica, categorías de datos e interesados, destinatarios, transferencias, plazos y medidas de seguridad | Persona de referencia en protección de datos |
| Deber de informar | Arts. 13 y 14 RGPD; art. 11 LOPDGDD | Cláusula informativa por capas en la ficha de alta, formularios de la web, inscripciones, política de privacidad y pie de cada envío del boletín (modelos al final de este epígrafe) | Secretaría |
| Contratos de encargo | Art. 28 RGPD | Contrato firmado con Isabel Olivares de la Cerda como encargada de la web, la tienda y el boletín, que responde de sus subencargados (alojamiento, base de datos y envío de correos); y con cualquier otro proveedor que acceda a datos, como la gestoría | Junta Directiva |
| Confidencialidad | Art. 5 LOPDGDD | Compromiso firmado por miembros de la Junta, voluntarios y colaboradores con acceso a datos | Secretaría |
| Atención de derechos | Arts. 15 a 22 RGPD | Canal identificado (movimientopatriam@gmail.com) y procedimiento para responder en un mes | Persona de referencia |
| Conservación y bloqueo | Art. 5.1.e RGPD; art. 32 LOPDGDD | Plazos por tratamiento; tras la baja, bloqueo durante la prescripción (fiscal, 4 años) y supresión posterior | Tesorería y Secretaría |
| Seguridad | Art. 32 RGPD | Análisis de riesgos básico y medidas: usuarios nominativos, contraseñas robustas, copias de seguridad, control de accesos | Persona de referencia |
| Brechas de seguridad | Arts. 33 y 34 RGPD | Procedimiento: notificar a la AEPD en 72 horas si hay riesgo, comunicar a afectados si el riesgo es alto, registro interno de incidentes | Junta Directiva |

**Derechos de los interesados:** acceso, rectificación, supresión, oposición, limitación y portabilidad. La respuesta es gratuita y se da en un mes, prorrogable dos más si hay complejidad, informando de la prórroga dentro del primer mes.

**Modelos de cláusula informativa**

La misma información se ofrece en la web y en el boletín, para que la persona la tenga tanto al darse de alta como en cada comunicación que recibe.

*A. En la web, junto al formulario de alta en cualquier lista (primera capa)*

> **Responsable:** Asociación PATRIAM, CIF G93940476, C/ Tórtola, 21, Valladolid, movimientopatriam@gmail.com. **Finalidad:** enviarle las comunicaciones de la lista en la que se inscribe (Socios, Donantes, Voluntarios, Boletín o Eventos). **Legitimación:** su consentimiento, que puede retirar en cualquier momento. **Destinatarios:** no se ceden datos a terceros. Los listados solo son accesibles para la asociación y para su encargada del tratamiento, que gestiona la web, la tienda y el boletín. Los proveedores técnicos que esta utiliza (alojamiento, base de datos y envío de correos) actúan como subencargados. **Conservación:** hasta que se dé de baja de la lista. **Derechos:** acceso, rectificación, supresión, oposición, limitación y portabilidad escribiendo a movimientopatriam@gmail.com. Puede reclamar ante la Agencia Española de Protección de Datos (www.aepd.es). **Más información:** política de privacidad de la web.
>
> ☐ Acepto recibir las comunicaciones de esta lista. *(casilla sin premarcar)*

*B. En el pie de cada envío del boletín*

> Recibe este correo porque está inscrito en la lista [nombre de la lista] de la Asociación PATRIAM. Tratamos sus datos con su consentimiento para enviarle estas comunicaciones; no se ceden a terceros y solo acceden a ellos la asociación y su encargada del tratamiento, que gestiona el boletín. Puede ejercer sus derechos escribiendo a movimientopatriam@gmail.com y consultar la política de privacidad. **Si no desea recibir más comunicaciones de esta lista, darse de baja aquí.** La baja es inmediata y no afecta a otras listas en las que esté inscrito.

## 4. Obligaciones que normalmente no son exigibles

Una asociación de tamaño pequeño o mediano no suele estar obligada a las tres figuras siguientes. Conviene dejar constancia escrita de por qué no se aplican, porque esa reflexión forma parte de la responsabilidad proactiva.

| Figura | Cuándo sería obligatoria | Situación habitual | Recomendación |
| --- | --- | --- | --- |
| Delegado de Protección de Datos (DPD) | Art. 37 RGPD: tratamiento a gran escala de categorías especiales como actividad principal; art. 34 LOPDGDD: lista cerrada de sectores, en la que no figuran las asociaciones | No obligatorio | Persona de referencia interna: Álvaro Mencos |
| Evaluación de impacto (EIPD) | Art. 35 RGPD y listas de la AEPD: alto riesgo, como perfilado, videovigilancia sistemática o datos sensibles a gran escala | No obligatoria en la mayoría de casos | Documentar un análisis de riesgos básico y revisarlo si cambian los tratamientos |
| Sistema interno de información (canal de denuncias) | Ley 2/2023: entidades con 50 o más trabajadores | No obligatorio si la asociación no llega a 50 trabajadores | Ninguna, salvo que la plantilla crezca |

Si la asociación incorpora videovigilancia en su sede, debe colocar el cartel informativo y respetar el plazo máximo de conservación de un mes (art. 22 LOPDGDD).

## 5. La web de la asociación

La web es el punto donde más incumplimientos se detectan, porque es pública y cualquiera puede comprobarla. Antes de publicarla, debe cumplir esta lista.

- [ ] **Aviso legal** con denominación, CIF, domicilio, inscripción en el registro de asociaciones y contacto (art. 10 LSSI). Exigible si hay actividad económica (cuotas, donaciones o ventas online); recomendable siempre.
- [ ] **Política de privacidad** completa (arts. 13 y 14 RGPD), enlazada desde el pie y desde cada formulario.
- [ ] **Política de cookies** y banner conforme a la guía de la AEPD: botón "Rechazar" al mismo nivel que "Aceptar" y ninguna cookie analítica o publicitaria antes del consentimiento.
- [ ] **Formularios** con casilla de aceptación no premarcada, cláusula informativa junto al formulario (modelo A del epígrafe 3) y casilla separada para el boletín.
- [ ] **Boletín** con consentimiento acreditable (fecha y origen del alta), cláusula informativa en el pie y enlace de baja en cada envío (art. 21 LSSI). Modelos en el epígrafe 3.
- [ ] **Proveedores** con contrato de encargo: hosting, base de datos, plataforma de envío de correos y quien desarrolle o mantenga la web.
- [ ] **Transferencias internacionales**: si algún proveedor está en EE. UU., comprobar su adhesión al EU-US Data Privacy Framework o firmar cláusulas contractuales tipo, e indicarlo en la política de privacidad. Elegir región UE para la base de datos cuando sea posible.
- [ ] **Panel de gestión** con usuarios nominativos, sin cuentas compartidas, contraseñas robustas y doble factor si el proveedor lo permite.
- [ ] **Privilegio mínimo**: quien gestiona contenidos no necesita ver los datos de socios; los permisos se asignan por función.
- [ ] **Publicaciones**: revisar que noticias, actas o fotos no incluyan datos personales sin base jurídica.

## 6. Errores frecuentes y régimen sancionador

La AEPD sanciona también a asociaciones. Casi todas las reclamaciones nacen de errores cotidianos que se evitan con las medidas de este manual.

| Error | Por qué es infracción | Cómo evitarlo |
| --- | --- | --- |
| Correo masivo a socios con las direcciones visibles en "Para" | Revela datos a terceros; brecha de confidencialidad (art. 5.1.f RGPD) | Usar CCO o una plataforma de envío |
| Difundir el boletín en un grupo de WhatsApp | Todos ven los teléfonos de los demás y su vínculo con la asociación | Canal de WhatsApp o lista de difusión |
| Publicar listados de socios o actas con datos personales | Comunicación de datos sin base jurídica; agravada si hay categorías especiales | Revisar todo contenido antes de publicarlo |
| Ceder la base de socios a otra entidad | Vulnera la condición del art. 9.2.d RGPD | Solo con consentimiento expreso de cada socio |
| Fotos de menores sin autorización | Falta de base jurídica (art. 7 LOPDGDD) | Recabar autorización de padres o tutores antes del acto |
| Formularios sin información o con casillas premarcadas | Incumple el deber de informar y el consentimiento válido | Aplicar la lista del epígrafe 5 |
| Cuentas compartidas en el panel o en el correo | Impide trazar accesos; medida de seguridad insuficiente (art. 32 RGPD) | Usuarios nominativos |
| No contestar una solicitud de derechos | Infracción autónoma (arts. 12 y 15 a 22 RGPD) | Canal identificado y plazo de un mes |

**Régimen sancionador**

- Las infracciones se clasifican en muy graves, graves y leves (arts. 72 a 74 LOPDGDD), con plazos de prescripción de 3, 2 y 1 año.
- Las multas del art. 83 RGPD se gradúan atendiendo, entre otros factores, a la naturaleza de la entidad, su volumen de tratamiento, la intencionalidad y las medidas adoptadas.
- En infracciones menores sin reincidencia, la AEPD puede optar por un apercibimiento (art. 58.2.b RGPD) y ordenar la adopción de medidas.
- Tener este manual implantado y documentado es el principal elemento atenuante ante una reclamación.
$manual$
where not exists (select 1 from manuales where titulo = 'Manual de protección de datos');
