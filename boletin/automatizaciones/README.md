# Automatizaciones de PATRIAM

Todo lo que funciona solo, en un sitio. Cada cosa dice qué hace, cuándo y dónde se cambia.

| Qué | Cuándo | Dónde vive | Qué toca |
|---|---|---|---|
| **España al día** (recoger noticias) | Cada 3 horas | GitHub Actions: `.github/workflows/espana-al-dia.yml` → `scripts/espana-al-dia.mjs` | `web/espana-al-dia.js` (web, boletín y correo diario) |
| **Miniaturas para la App** | Justo después de España al día | Mismo workflow → `scripts/espana-miniaturas.mjs` | Rama `app-miniaturas` (se rehace entera cada vez) |
| **Ilustraciones del boletín + App PATRIAM** | Cada día a las 07:59 (Madrid) | Tarea programada de Claude («Ilustraciones boletín PATRIAM»). Copia de sus instrucciones: [`tarea-ilustraciones.md`](tarea-ilustraciones.md) | `web/imagenes/auto/`, `web/imagenes-auto.js`, `web/importar.js` y los datos de la App |
| **Copia desde Netlify** | A mano | `.github/workflows/copia-netlify.yml` | `datos/boletines.js`, `web/img/` |
| **Correo diario de España al día** | Cron de Hostinger | `php mipatria.php enviar` | Suscriptores (en la carpeta privada del servidor) |
| **Comunicaciones de Carlos** (semanal y mensual) | Cron de Hostinger, cada hora | `php revisar.php` → `web/carlos.php` | Página propia de Carlos (`/carlos/<clave>`; el enlace lo da el editor › Comunicaciones), contactos en `com.json` |
| **Aviso a colaboradores** (una semana antes de cada boletín) | Cron de Hostinger, cada hora | `php revisar.php` → `web/calendario.php` | Calendario en Gestión y en Publicar; datos en `calendario.json` |

| **Artículo del día en redes** (X, Facebook, Instagram) | Cron de Hostinger, cada hora (a los :05); publica una vez al día a la hora elegida | `php public_html/api/rrss-publicar.php diario` (repo patriam-web) | Se activa y se elige en publicar.movimientopatriam.es › RRSS › Artículo del día, con las cuentas conectadas de quien la activa |

Hostinger publica solo cada `push` a `main`.

## España al día

- **Medios:** The Objective, El Debate, La Gaceta, El Español, ABC, El Mundo y Adelante España (lista `MEDIOS` en `scripts/espana-al-dia.mjs`). Si un feed falla, sale `✗` en el registro de GitHub y los demás siguen.
- **Qué entra:** solo política y economía de España. Se quitan solas las secciones de deportes, sucesos, cultura, religión, famosos, esquelas… (`NUNCA`), los titulares de espectáculo (`NO_TITULO`) y los sucesos que no tocan a la política (`SUCESO` / `POLITICO`).
- **Quitar una noticia a mano:** añade su dirección en `datos/espana-fuera.txt` (una por línea).
- **Asuntos** (Huelga general, Ley de nietos, Elecciones…): en `web/espana-asuntos.json`. Cada noticia va al primer asunto cuyo patrón encaje; si no, a «Otros». Para uno nuevo, copia una línea y cambia nombre y palabras.
- **Página:** `web/mipatria.php` (boletin.movimientopatriam.es/mipatriaaldia): panel «De qué se habla», luego Economía y Política por asuntos, con la foto original de cada medio (y una ilustración de PATRIAM si no la hay).

## App PATRIAM

Panel privado en claude.ai que reúne lo que hacen las automatizaciones: España al día (solo las de hoy, con panel de asuntos y fotos originales en pequeño), ilustraciones del boletín, estado de las tareas y accesos.
No puede leer de GitHub ni de la web por sí sola: la tarea diaria de Claude le pasa los datos con `node scripts/app-patriam-datos.mjs <miniaturas.json> <carpeta>`, que deja listos `espana.json` y los trozos de fotos `img-N.json`.

Datos de la App (colecciones):

- `espana/actual` → `{actualizado, total, grupos:[{t, r, f, tema, a, k, m:[{n, u}]}]}` (solo las de hoy)
- `espana-img/<n>` → `{fotos:{k: data URI}}`
- `ilustraciones/<id del artículo>` → `{titulo, autor, seccion, fecha, imagen, miniatura, escena}`
- `tareas/<id>` → `{orden, nombre, horario, ultima, estado: ok|aviso|error, resumen, que}`
