# Web PATRIAM: instrucciones

La web está hecha en **React** (Vite). Usa **Supabase** como base de datos, para el inicio de sesión y para guardar archivos. Se puede alojar gratis en **Vercel** (o en Netlify).

## Estructura

| Parte pública | Panel de gestión (`/gestion`) |
|---|---|
| Inicio | Escritorio con avisos |
| Acción ciudadana / cultural / social: agenda con calendario | Agenda de acciones |
| Sobre PATRIAM | Artículos: escribir, enviar a revisión, publicar |
| Nosotros: junta directiva y transparencia | Pendientes de revisión |
| Acción ciudadana / cultural / social | Redes sociales: registro y métricas de posts |
| Revista · Noticias · En los medios | Páginas: textos editables |
| Colabora (formulario) | Junta directiva · Documentos |
| Aviso legal · Privacidad · Cookies · Transparencia IA | Usuarios y permisos · Mensajes · Mi cuenta |

## Roles

| Cuenta | Gestión | Publicación |
|---|---|---|
| isabel@patriam.es | Completa (todas las secciones del panel) | Envía a aprobación |
| alvaro@patriam.es | Completa (todas las secciones del panel) | Envía a aprobación |
| carlos@patriam.es | Completa (todas las secciones del panel) | **Único que aprueba y publica** (artículos, acciones, recomendaciones, campañas y textos de las páginas) |
| Asociados y clientes | Sin panel: solo Mi cuenta | — |

Los permisos se aplican **en la base de datos** (Row Level Security), no solo en la pantalla. Aunque alguien manipule el navegador, no puede publicar ni ver lo que no le corresponde.

## Puesta en marcha (unos 30 minutos)

1. **Supabase**: crear un proyecto en supabase.com (región **UE, Frankfurt o París**, por el RGPD).
2. Ir a **SQL Editor › New query**, pegar todo `supabase/schema.sql` y pulsar **Run**.
3. En **Authentication › Users › Add user**, crear el usuario administrador. Después, en el SQL Editor:
   ```sql
   update perfiles set rol = 'admin', activo = true, nombre = 'Administración'
   where email = 'SU_EMAIL';
   ```
4. En **Authentication › URL Configuration**, poner la dirección de la web (p. ej. `https://patriam.es`) en *Site URL* y en *Redirect URLs*.
5. **Netlify** (dos opciones):
   - **Rápida (prototipo)**: entrar en app.netlify.com con la cuenta de la asociación, ir a *Add new site › Deploy manually* y arrastrar la carpeta `dist` (o arrastrar `patriam-netlify.zip` en *Deploys*). La configuración de rutas ya va incluida (`_redirects`).
   - **Definitiva**: subir el código a GitHub y en Netlify elegir *Import from Git*. Netlify lee `netlify.toml` (compila con `npm run build` y publica `dist`). En *Site configuration › Environment variables* añadir `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` y volver a desplegar.
6. Conectar el dominio en Netlify › *Domain management*. El certificado SSL (HTTPS) es automático y gratuito.

Sin las claves de Supabase, la web arranca en **modo demostración**. Usa una base de datos simulada en el navegador (`src/lib/mock/`) que reproduce las mismas reglas de permisos. Para probar el panel hay cuentas de prueba de cada rol (contraseña `demo1234`), que aparecen en *Acceso miembros*. Al añadir las dos variables de Supabase, la web pasa a usar la base real sin cambiar nada más.

## Altas de usuarios

- **Opción A**: la persona entra en *Acceso miembros › Solicitar acceso*. Su cuenta queda "pendiente" hasta que el administrador la activa en *Usuarios y permisos*.
- **Opción B**: invitarla desde Supabase › Authentication › Users › *Invite user*.
- **Cambiar el email** de un usuario: Supabase › Authentication › Users. El cambio se refleja solo.
- **Baja**: desmarcar "Activo". Pierde el acceso al momento.

## Cumplimiento normativo incorporado

**Reglamento (UE) 2024/1689 de IA (AI Act)**
- Todo artículo y post de redes lleva un campo obligatorio sobre el uso de IA (ninguno / asistido con revisión humana / generado). Si se ha usado IA, se muestra la etiqueta en la web (art. 50).
- Las imágenes generadas o manipuladas con IA se marcan como tales.
- Hay revisión humana obligatoria: nada se publica sin que lo apruebe un responsable, y queda registrado quién y cuándo (`revisado_por`, `publicado_at`).
- La web no usa chatbots ni sistemas de IA de perfilado o segmentación de usuarios (art. 5 y Anexo III).
- Tiene una página pública de *Transparencia IA*.

**RGPD / LOPDGDD**
- El formulario pide consentimiento explícito, porque los datos pueden revelar opiniones (art. 9 RGPD). Sin consentimiento no se guarda nada.
- Los mensajes solo los ve el administrador. Se pueden borrar (derecho de supresión).
- Los miembros de la junta solo se publican si consta su consentimiento.
- La web no tiene cookies de seguimiento ni analítica.

**LSSI**: aviso legal y política de cookies (plantillas con datos entre [corchetes] que hay que completar).

**Ley 19/2013 de transparencia**: hay una sección de documentos. Solo es obligatoria si se superan los umbrales de ayudas públicas del art. 3.b.

## Seguridad

- HTTPS obligatorio (HSTS) y cabeceras de seguridad en `netlify.toml` (también en `vercel.json` por si se usa Vercel).
- El texto de los artículos se escapa, así que no se puede inyectar código.
- Las contraseñas tienen un mínimo de 10 caracteres. Se recomienda activar en Supabase la protección contra contraseñas filtradas y el CAPTCHA en el registro.
- Supabase hace copias de seguridad diarias en el plan de pago. En el plan gratuito conviene exportar periódicamente.

## Adhesión, donativos, tienda y firmas (minimización de datos)

- **Pagos (prototipo, sin conectar)**: tarjeta, Bizum y transferencia. En producción, la tarjeta irá por la pasarela del banco (Redsys) o por Stripe, y Bizum requiere dar de alta a la asociación a través del banco.
- **Socios**: nombre, email y municipio (opcional). Sin DNI ni IBAN.
- **Donativos**: pueden ser anónimos. Se guarda solo el importe, el método y una referencia para conciliar con el banco.
- **Tienda**: libros, ropa (con tallas) y cursos o actividades (con fecha, lugar y plazas, de pago o gratuitas). Hay carrito, envío o recogida y gastos de envío configurables. El servidor recalcula siempre los precios a partir del catálogo. Se gestiona en el panel (*Tienda y pedidos*) con el permiso "Tienda".
- **Firmas**: las campañas están dentro de *Acción*. Cada una puede firmarse en **CitizenGO** (recomendado: la asociación no guarda datos) o con el **formulario propio**. CitizenGO no tiene API pública. El panel prepara el texto ordenado según sus campos (*Preparar en CitizenGO*), se publica a mano y luego se pega el enlace en la campaña.
- **Textos legales**: aviso legal, privacidad, cookies, condiciones de venta y transparencia IA. Los datos pendientes van entre [CORCHETES] y se ven resaltados en la web hasta que se rellenan desde *Páginas*.
- **Pendiente para producción**: conectar los pagos y el envío de emails (confirmación de pedidos y firmas) con una función de Supabase y un servicio de email.
- **Logotipo**: está en `src/assets/` (versión normal y versión clara), en la cabecera y el pie.
- **Gestión administrativa** (solo equipo): ingresos, gastos, resultado, facturas, extractos, impuestos, donativos, libro de movimientos y Carpeta Web.

## Ampliaciones previstas

- Varios idiomas.
- SEO avanzado: prerenderizado, sitemap y datos estructurados.

## Vista previa en un único archivo

`VITE_HASH=1 npx vite build -c vite.preview.config.js` genera `dist-preview/index.html`, que se abre sin servidor.

## Desarrollo local

```
npm install
cp .env.example .env   # y rellenar
npm run dev
```

Documentación completa: `PATRIAM_entrega_tecnica_web.docx` (en Gestión administrativa › Carpeta Web).
