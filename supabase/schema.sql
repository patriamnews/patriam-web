-- =====================================================================
-- PATRIAM · Esquema de base de datos (Supabase / PostgreSQL)
-- Ejecutar completo en Supabase › SQL Editor › New query › Run
-- =====================================================================

-- ---------- Tipos ----------
-- 'cliente' = cuenta de cliente o asociado (área Mi cuenta, sin acceso al panel)
create type rol_usuario as enum ('pendiente', 'cliente', 'autor', 'editor', 'director', 'admin');
create type seccion_web as enum ('ciudadana', 'cultural', 'social', 'revista', 'recomendaciones', 'noticias', 'medios');
create type estado_articulo as enum ('borrador', 'revision', 'publicado', 'rechazado');
create type uso_ia as enum ('ninguno', 'asistido', 'generado');

-- ---------- Perfiles (uno por usuario de Supabase Auth) ----------
create table perfiles (
  id uuid primary key references auth.users on delete cascade,
  nombre text not null default '',
  email text,
  rol rol_usuario not null default 'pendiente',
  area seccion_web,                 -- solo para editores de área
  activo boolean not null default false,
  cambiar_clave boolean not null default false,   -- obliga a cambiar la contraseña inicial al entrar
  creado_at timestamptz not null default now()
);

-- Al registrarse un usuario se crea su perfil SIN permisos (pendiente de aprobación)
create function crear_perfil() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- Las cuentas creadas desde la web pública (Acceder › Crear cuenta) son de cliente/asociado y quedan activas.
  -- Las invitadas desde Supabase quedan pendientes hasta que el administrador les dé un rol de equipo.
  insert into perfiles (id, email, nombre, rol, activo)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'nombre', ''),
          case when new.raw_user_meta_data->>'tipo' = 'cliente' then 'cliente'::rol_usuario else 'pendiente'::rol_usuario end,
          coalesce(new.raw_user_meta_data->>'tipo' = 'cliente', false));
  return new;
end $$;

create trigger al_crear_usuario after insert on auth.users
  for each row execute function crear_perfil();

-- Mantener el email del perfil sincronizado si se cambia en Auth
create function sync_email() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update perfiles set email = new.email where id = new.id;
  return new;
end $$;

create trigger al_cambiar_email after update of email on auth.users
  for each row execute function sync_email();

-- Funciones auxiliares (security definer para evitar recursión en RLS)
create function mi_rol() returns rol_usuario
language sql stable security definer set search_path = public as $$
  select rol from perfiles where id = auth.uid() and activo
$$;

create function mi_area() returns seccion_web
language sql stable security definer set search_path = public as $$
  select area from perfiles where id = auth.uid() and activo
$$;

-- Equipo de gestión: todos tienen la misma gestión; solo el rol 'director' (Carlos) aprueba y publica
create function es_equipo() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(mi_rol() in ('autor', 'editor', 'director', 'admin'), false)
$$;

-- Solo el administrador puede cambiar roles, áreas o activar usuarios
create function proteger_rol() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- auth.uid() es nulo en el SQL Editor / clave de servicio: allí sí se permite
  if (new.rol is distinct from old.rol or new.area is distinct from old.area or new.activo is distinct from old.activo
      or to_jsonb(new)->'gestiona_redes' is distinct from to_jsonb(old)->'gestiona_redes'
      or to_jsonb(new)->'gestiona_tienda' is distinct from to_jsonb(old)->'gestiona_tienda')
     and auth.uid() is not null
     and not es_equipo() then
    raise exception 'Solo un administrador puede cambiar roles o permisos';
  end if;
  return new;
end $$;

create trigger proteger_rol before update on perfiles
  for each row execute function proteger_rol();

alter table perfiles enable row level security;
create policy "ver mi perfil o admin" on perfiles for select
  using (id = auth.uid() or es_equipo());
create policy "editar mi perfil o admin" on perfiles for update
  using (id = auth.uid() or es_equipo());

-- ---------- Artículos (secciones y revista) ----------
create table articulos (
  id bigint generated always as identity primary key,
  titulo text not null,
  slug text not null unique,
  resumen text,
  contenido text not null default '',
  seccion seccion_web not null,
  firma text,                                   -- nombre que aparece publicado
  autor_id uuid references perfiles(id) on delete set null default auth.uid(),
  estado estado_articulo not null default 'borrador',
  nota_revision text,                           -- comentarios del revisor al autor
  uso_ia uso_ia not null default 'ninguno',     -- transparencia art. 50 AI Act
  imagen_url text,
  imagen_ia boolean not null default false,     -- imagen generada/manipulada con IA
  medio text,                                   -- solo "Presencia en medios": nombre del medio
  enlace_externo text,                          -- "En los medios" y "Recomendaciones": URL del original
  tipo_recomendacion text,                      -- articulo, prensa, revista, libro, video
  revisado_por uuid references perfiles(id),
  publicado_at timestamptz,
  creado_at timestamptz not null default now(),
  actualizado_at timestamptz not null default now()
);

create index on articulos (estado, seccion, publicado_at desc);

-- ¿Puede el usuario actual publicar en esta sección?
-- Todo contenido lo aprueba y publica una sola persona: el rol 'director' (Carlos Rubio)
create function puede_publicar(s seccion_web) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(mi_rol() = 'director', false)
$$;

-- Quién puede proponer acciones de un área (se publican cuando las aprueba el director)
create function puede_area(s seccion_web) returns boolean
language sql stable security definer set search_path = public as $$
  select es_equipo()
$$;

-- Registro de revisión humana: quién y cuándo aprueba cada publicación
create function registrar_publicacion() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.actualizado_at := now();
  if new.estado = 'publicado' and (tg_op = 'INSERT' or old.estado is distinct from 'publicado') then
    if not puede_publicar(new.seccion) then
      raise exception 'No tiene permiso para publicar en esta sección';
    end if;
    new.revisado_por := auth.uid();
    new.publicado_at := coalesce(new.publicado_at, now());
  end if;
  return new;
end $$;

create trigger registrar_publicacion before insert or update on articulos
  for each row execute function registrar_publicacion();

alter table articulos enable row level security;

create policy "lectura" on articulos for select using (
  estado = 'publicado'
  or autor_id = auth.uid()
  or es_equipo()
);

create policy "crear" on articulos for insert with check (
  mi_rol() in ('autor', 'editor', 'director', 'admin')
  and autor_id = auth.uid()
  and (estado in ('borrador', 'revision') or puede_publicar(seccion))
);

create policy "editar" on articulos for update
  using (
    puede_publicar(seccion)
    or (autor_id = auth.uid() and estado in ('borrador', 'revision', 'rechazado'))
  )
  with check (
    puede_publicar(seccion)
    or (autor_id = auth.uid() and estado in ('borrador', 'revision'))
  );

create policy "borrar" on articulos for delete using (
  es_equipo()
  or (autor_id = auth.uid() and estado = 'borrador')
);

-- ---------- Páginas editables (inicio, sobre-patriam, nosotros, legales…) ----------
create table paginas (
  clave text primary key,
  titulo text not null,
  contenido text not null default '',
  actualizado_por uuid references perfiles(id) default auth.uid(),
  actualizado_at timestamptz not null default now()
);

alter table paginas enable row level security;
create policy "lectura pública" on paginas for select using (true);
-- Los textos de las páginas son publicaciones: solo los cambia la dirección (Carlos)
create policy "gestión" on paginas for all
  using (coalesce(mi_rol() = 'director', false))
  with check (coalesce(mi_rol() = 'director', false));

-- ---------- Junta directiva / cargos ----------
create table cargos (
  id bigint generated always as identity primary key,
  nombre text not null,
  cargo text not null,
  foto_url text,
  orden int not null default 0,
  visible boolean not null default true,
  consentimiento_publicacion boolean not null default false,  -- RGPD: consentimiento del miembro
  desde date,
  aprobada boolean not null default false,     -- solo el director (Carlos) la aprueba
  creado_por uuid default auth.uid()
);

alter table cargos enable row level security;
create policy "lectura pública" on cargos for select
  using ((visible and consentimiento_publicacion and aprobada) or es_equipo());
create policy "gestión" on cargos for all
  using (es_equipo()) with check (es_equipo());

-- ---------- Sedes (mapa de la página de Contacto) ----------
create table sedes (
  id bigint generated always as identity primary key,
  ciudad text not null,
  email text not null,
  direccion text,
  telefono text,
  lat double precision not null,
  lon double precision not null,
  orden int not null default 0,
  activa boolean not null default true,
  aprobada boolean not null default false,
  creado_por uuid default auth.uid(),
  creado_at timestamptz not null default now()
);
alter table sedes enable row level security;
-- Solo lo que guarda Carlos (director) queda publicado; lo de los demás espera su aprobación
create function aprobar_si_director() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.aprobada := coalesce(mi_rol()::text, '') = 'director';
  return new;
end $$;
create trigger aprobar_si_director before insert or update on sedes for each row execute function aprobar_si_director();
-- Junta directiva y documentos de transparencia: también los aprueba Carlos
create trigger aprobar_si_director before insert or update on cargos for each row execute function aprobar_si_director();
create policy "lectura pública" on sedes for select using ((activa and aprobada) or es_equipo());
create policy "gestión" on sedes for all using (es_equipo()) with check (es_equipo());
insert into sedes (ciudad, email, lat, lon, orden, aprobada) values
  ('Madrid', 'madrid@patriam.es', 40.42, -3.70, 1, true),
  ('Gerona', 'gerona@patriam.es', 41.98, 2.82, 2, true),
  ('Valencia', 'valencia@patriam.es', 39.47, -0.38, 3, true),
  ('Valladolid', 'valladolid@patriam.es', 41.65, -4.72, 4, true);

-- ---------- Documentos de transparencia ----------
create table documentos (
  id bigint generated always as identity primary key,
  titulo text not null,
  categoria text not null default 'otros',
  archivo_url text not null,
  fecha date,
  publico boolean not null default true,
  aprobada boolean not null default false,     -- solo el director (Carlos) lo aprueba
  subido_por uuid references perfiles(id) default auth.uid(),
  creado_por uuid default auth.uid(),
  creado_at timestamptz not null default now()
);

alter table documentos enable row level security;
create policy "lectura pública" on documentos for select
  using ((publico and aprobada) or es_equipo());
create policy "gestión" on documentos for all
  using (es_equipo()) with check (es_equipo());
create trigger aprobar_si_director before insert or update on documentos for each row execute function aprobar_si_director();

-- ---------- Mensajes del formulario "Colabora" ----------
create table contactos (
  id bigint generated always as identity primary key,
  nombre text not null check (length(nombre) <= 120),
  email text not null check (length(email) <= 200),
  interes text,
  mensaje text check (length(mensaje) <= 3000),
  consentimiento boolean not null check (consentimiento),   -- sin consentimiento no se guarda
  atendido boolean not null default false,
  creado_at timestamptz not null default now()
);

alter table contactos enable row level security;
create policy "enviar (público)" on contactos for insert with check (consentimiento);
create policy "solo admin lee" on contactos for select using (es_equipo());
create policy "solo admin gestiona" on contactos for update using (es_equipo());
create policy "solo admin borra" on contactos for delete using (es_equipo());

-- ---------- Gestor de redes sociales (uso interno) ----------
alter table perfiles add column gestiona_redes boolean not null default false;

create function puede_redes() returns boolean
language sql stable security definer set search_path = public as $$
  select es_equipo()
$$;

create table redes_posts (
  id bigint generated always as identity primary key,
  red text not null,                         -- x, instagram, facebook, tiktok, youtube, telegram, whatsapp, linkedin
  estado text not null default 'idea' check (estado in ('idea', 'programado', 'publicado')),
  fecha date not null default current_date,
  texto text,
  enlace text,                               -- URL del post publicado
  articulo_id bigint references articulos(id) on delete set null,
  responsable_id uuid references perfiles(id) on delete set null default auth.uid(),
  uso_ia uso_ia not null default 'ninguno',
  imagen_ia boolean not null default false,
  me_gusta int not null default 0,
  comentarios int not null default 0,
  compartidos int not null default 0,
  visualizaciones int not null default 0,
  notas text,
  creado_at timestamptz not null default now(),
  actualizado_at timestamptz not null default now()
);

create index on redes_posts (fecha desc);

create policy "equipo de redes ve nombres" on perfiles for select using (puede_redes());

alter table redes_posts enable row level security;
create policy "equipo de redes" on redes_posts for all
  using (puede_redes()) with check (puede_redes());

-- ---------- Ajustes generales (datos de pago y redes; públicos) ----------
create table ajustes (
  id int primary key default 1 check (id = 1),
  titular_cuenta text, iban text, bizum text,
  cuotas text default '5,10,20', donativos text default '10,25,50,100',
  email_contacto text, x text, instagram text, facebook text, youtube text, telegram text, tiktok text,
  boletin_url text default 'https://boletinpatriam.netlify.app/'
);
insert into ajustes (id) values (1);
alter table ajustes enable row level security;
create policy "lectura pública" on ajustes for select using (true);
create policy "gestión" on ajustes for update using (es_equipo()) with check (es_equipo());

-- ---------- Campañas de firmas ----------
create table campanas (
  id bigint generated always as identity primary key,
  titulo text not null,
  slug text not null unique,
  resumen text,
  texto text,
  destinatario text,
  objetivo int,
  activa boolean not null default true,
  modo text not null default 'externo' check (modo in ('externo', 'propio')),  -- externo = CitizenGO u otra
  enlace_externo text,
  firmas_externas int not null default 0,
  fecha_fin date,
  aprobada boolean not null default false,
  creado_at timestamptz not null default now()
);
alter table campanas enable row level security;
-- Si no lo guarda el director, el contenido (acción o campaña) queda pendiente de aprobación
create function exigir_aprobacion() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(mi_rol()::text, '') <> 'director' then new.aprobada := false; end if;
  return new;
end $$;
create trigger exigir_aprobacion before insert or update on campanas for each row execute function exigir_aprobacion();
create policy "lectura pública" on campanas for select using ((activa and aprobada) or es_equipo());
create policy "gestión" on campanas for all using (es_equipo()) with check (es_equipo());

-- Firmas (solo campañas con formulario propio). Datos mínimos: nombre, email, municipio opcional.
create table firmas (
  id bigint generated always as identity primary key,
  campana_id bigint not null references campanas(id) on delete cascade,
  nombre text not null check (length(nombre) <= 120),
  email text not null check (length(email) <= 200),
  municipio text check (length(municipio) <= 100),
  quiere_info boolean not null default false,
  consentimiento boolean not null check (consentimiento),
  confirmada boolean not null default false,       -- doble confirmación por email
  creado_at timestamptz not null default now(),
  unique (campana_id, email)
);
alter table firmas enable row level security;
create policy "firmar (público)" on firmas for insert with check (
  consentimiento and exists (select 1 from campanas c where c.id = campana_id and c.activa and c.modo = 'propio')
);
create policy "solo admin" on firmas for select using (es_equipo());
create policy "solo admin borra" on firmas for delete using (es_equipo());
create policy "solo admin modifica" on firmas for update using (es_equipo());

-- Contador público sin exponer datos personales
create function contar_firmas(campana bigint) returns bigint
language sql stable security definer set search_path = public as $$
  select count(*) from firmas where campana_id = campana and confirmada
$$;
grant execute on function contar_firmas(bigint) to anon, authenticated;

-- ---------- Socios (datos mínimos) ----------
create table socios (
  id bigint generated always as identity primary key,
  nombre text not null check (length(nombre) <= 150),        -- nombre y apellidos completos
  nombre_pila text, apellido1 text, apellido2 text,
  dni text,                                                    -- DNI/NIE: necesario para el recibo de la cuota
  fecha_nacimiento date,
  sexo text check (sexo in ('mujer', 'hombre')),               -- hay acciones solo para mujeres o solo para hombres
  email text not null check (length(email) <= 200),
  telefono text,
  direccion text, codigo_postal text, provincia text,
  municipio text not null,
  descuento text check (descuento in ('familia_numerosa', 'estudiante', 'jubilado', 'desempleado', 'familiar')),
  familiar_afiliado text,
  descuento_justificado boolean,                               -- se marca al recibir la documentación
  cuota numeric(8,2) not null check (cuota > 0),
  periodicidad text not null check (periodicidad in ('mensual', 'trimestral', 'anual')),
  metodo text not null check (metodo in ('tarjeta', 'bizum', 'transferencia')),
  referencia text not null,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'alta', 'baja')),
  consentimiento boolean not null check (consentimiento),
  usuario_id uuid references auth.users on delete set null default auth.uid(),  -- cuenta del asociado (si la tiene)
  numero_socio text unique,
  alta_at timestamptz,
  baja_solicitada boolean not null default false,
  creado_at timestamptz not null default now()
);
alter table socios enable row level security;
create policy "solicitar (público)" on socios for insert with check (
  consentimiento and estado = 'pendiente'
);
create policy "admin o el propio socio" on socios for select
  using (es_equipo() or usuario_id = auth.uid() or lower(email) = lower(auth.jwt()->>'email'));
create policy "admin o el propio socio modifica" on socios for update
  using (es_equipo() or usuario_id = auth.uid() or lower(email) = lower(auth.jwt()->>'email'));

-- El propio socio solo puede cambiar su municipio o pedir la baja
create function proteger_socio() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not es_equipo()
     and (to_jsonb(new) - 'municipio' - 'baja_solicitada') is distinct from (to_jsonb(old) - 'municipio' - 'baja_solicitada') then
    raise exception 'Solo puede cambiar su municipio o solicitar la baja';
  end if;
  return new;
end $$;
create trigger proteger_socio before update on socios for each row execute function proteger_socio();

-- Pagos de cuotas (los registra la administración; el asociado los ve en su área)
create table pagos (
  id bigint generated always as identity primary key,
  socio_id bigint not null references socios(id) on delete cascade,
  fecha date not null default current_date,
  importe numeric(8,2) not null check (importe >= 0),
  concepto text,
  metodo text,
  estado text not null default 'cobrado' check (estado in ('cobrado', 'pendiente', 'devuelto')),
  creado_at timestamptz not null default now()
);
alter table pagos enable row level security;
create policy "admin gestiona" on pagos for all using (es_equipo()) with check (es_equipo());
create policy "el socio ve los suyos" on pagos for select
  using (exists (select 1 from socios s where s.id = socio_id and (s.usuario_id = auth.uid() or lower(s.email) = lower(auth.jwt()->>'email'))));
create policy "solo admin borra" on socios for delete using (es_equipo());

-- ---------- Donativos (sin datos personales obligatorios) ----------
create table donativos (
  id bigint generated always as identity primary key,
  importe numeric(10,2) not null check (importe > 0),
  metodo text not null,
  referencia text not null,
  email text,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'confirmado', 'no_recibido')),
  usuario_id uuid references auth.users on delete set null default auth.uid(),
  creado_at timestamptz not null default now()
);
alter table donativos enable row level security;
create policy "registrar (público)" on donativos for insert with check (estado = 'pendiente');
create policy "admin o el propio donante" on donativos for select
  using (es_equipo() or usuario_id = auth.uid());
create policy "solo admin modifica" on donativos for update using (es_equipo());

-- ---------- Tienda ----------
alter table perfiles add column gestiona_tienda boolean not null default false;
alter table ajustes add column envio_coste text default '4.95', add column envio_gratis_desde text, add column recogida text;

create function puede_tienda() returns boolean
language sql stable security definer set search_path = public as $$
  select es_equipo()
$$;

create table productos (
  id bigint generated always as identity primary key,
  nombre text not null,
  slug text not null unique,
  categoria text not null check (categoria in ('libros', 'ropa', 'regalos', 'actividades')),
  enlace_externo text,                       -- página del producto en La Tostadora (cobra, fabrica y envía ella)
  descripcion text,
  precio numeric(8,2) not null default 0 check (precio >= 0),
  opciones text,              -- tallas separadas por comas
  stock int,
  fecha date,                 -- actividades
  lugar text,
  plazas int,
  imagen_url text,
  activo boolean not null default true,
  orden int not null default 0,
  aprobada boolean not null default false,     -- solo el director (Carlos) lo aprueba
  creado_por uuid default auth.uid(),
  creado_at timestamptz not null default now()
);
alter table productos enable row level security;
create policy "lectura pública" on productos for select using ((activo and aprobada) or puede_tienda() or es_equipo());
create trigger aprobar_si_director before insert or update on productos for each row execute function aprobar_si_director();
create policy "gestión" on productos for all using (puede_tienda()) with check (puede_tienda());

create table pedidos (
  id bigint generated always as identity primary key,
  referencia text not null unique,
  items jsonb not null,       -- [{id, nombre, opcion, cantidad, precio}]
  subtotal numeric(10,2) not null default 0,
  envio numeric(8,2) not null default 0,
  total numeric(10,2) not null default 0,
  nombre text not null check (length(nombre) <= 150),
  email text not null check (length(email) <= 200),
  entrega text not null check (entrega in ('envio', 'recogida', 'no_aplica')),
  direccion text check (length(direccion) <= 300),
  metodo text not null check (metodo in ('tarjeta', 'bizum', 'transferencia', 'gratuito')),
  estado text not null default 'pendiente' check (estado in ('pendiente', 'pagado', 'enviado', 'entregado', 'cancelado')),
  consentimiento boolean not null check (consentimiento),
  usuario_id uuid references auth.users on delete set null default auth.uid(),  -- cliente con cuenta
  creado_at timestamptz not null default now(),
  check ((entrega = 'envio') = (direccion is not null))
);

-- Los precios y totales se recalculan en el servidor a partir del catálogo
create function calcular_pedido() returns trigger
language plpgsql security definer set search_path = public as $$
declare it jsonb; p productos; sub numeric := 0; nuevos jsonb := '[]'; aj ajustes;
begin
  if tg_op = 'UPDATE' then return new; end if;
  for it in select * from jsonb_array_elements(new.items) loop
    select * into p from productos where id = (it->>'id')::bigint and activo;
    if not found then raise exception 'Un producto ya no está disponible'; end if;
    if (it->>'cantidad')::int < 1 or (it->>'cantidad')::int > 20 then raise exception 'Cantidad no válida'; end if;
    sub := sub + p.precio * (it->>'cantidad')::int;
    nuevos := nuevos || jsonb_build_object('id', p.id, 'nombre', p.nombre, 'opcion', it->>'opcion',
                                          'cantidad', (it->>'cantidad')::int, 'precio', p.precio, 'categoria', p.categoria);
  end loop;
  select * into aj from ajustes where id = 1;
  new.items := nuevos;
  new.subtotal := sub;
  new.envio := case when new.entrega = 'envio'
                    and (aj.envio_gratis_desde is null or aj.envio_gratis_desde = '' or sub < aj.envio_gratis_desde::numeric)
               then coalesce(nullif(aj.envio_coste, '')::numeric, 0) else 0 end;
  new.total := new.subtotal + new.envio;
  new.estado := case when new.total = 0 then 'pagado' else 'pendiente' end;
  return new;
end $$;

create trigger calcular_pedido before insert on pedidos for each row execute function calcular_pedido();

alter table pedidos enable row level security;
create policy "pedir (público)" on pedidos for insert with check (consentimiento);
create policy "gestión o el propio cliente lee" on pedidos for select
  using (puede_tienda() or usuario_id = auth.uid() or lower(email) = lower(auth.jwt()->>'email'));
create policy "gestión modifica" on pedidos for update using (puede_tienda());

-- ---------- Agenda de acciones (ciudadana, cultural, social) ----------
create table acciones (
  id bigint generated always as identity primary key,
  seccion seccion_web not null check (seccion in ('ciudadana', 'cultural', 'social')),
  titulo text not null,
  slug text not null unique,
  resumen text,
  descripcion text,
  lugar text,
  fecha_inicio timestamptz not null,
  fecha_fin timestamptz,
  porque_id bigint references articulos(id) on delete set null,   -- artículo "por qué lo hacemos"
  cronica_id bigint references articulos(id) on delete set null,  -- crónica o reportaje posterior
  campana_id bigint references campanas(id) on delete set null,
  estado text not null default 'programada' check (estado in ('programada', 'realizada', 'cancelada')),
  imagen_url text,
  imagen_ia boolean not null default false,  -- cartel o foto generada/manipulada con IA (art. 50 RIA)
  dirigida text not null default 'todos' check (dirigida in ('todos', 'mujeres', 'hombres')),  -- p. ej. talleres solo para mujeres
  video_url text,                            -- vídeo de la convocatoria (X, YouTube…)
  publicada boolean not null default true,
  aprobada boolean not null default false,   -- solo el director la aprueba
  creado_por uuid references perfiles(id) default auth.uid(),
  creado_at timestamptz not null default now()
);
create index on acciones (seccion, fecha_inicio);
alter table acciones enable row level security;
create policy "lectura pública" on acciones for select using ((publicada and aprobada) or puede_area(seccion));
create policy "gestión" on acciones for all using (puede_area(seccion)) with check (puede_area(seccion));

create trigger exigir_aprobacion before insert or update on acciones for each row execute function exigir_aprobacion();

-- ---------- Avisos por correo (bandeja de salida) ----------
-- La web inserta aquí los avisos (p. ej. "pendiente de aprobación" a Carlos Rubio).
-- Una función de Supabase (Edge Function) los envía con un servicio de email y marca enviado_at.
create table correos (
  id bigint generated always as identity primary key,
  para text not null,
  de text,
  asunto text not null,
  cuerpo text,
  enlace text,
  enviado_at timestamptz,
  creado_at timestamptz not null default now()
);
alter table correos enable row level security;
create policy "crear avisos" on correos for insert with check (true);
create policy "ver avisos" on correos for select using (es_equipo());

-- ---------- Registro de firmas de los documentos de adhesión (inalterable) ----------
create extension if not exists pgcrypto with schema extensions;

create table firmas_adhesion (
  id bigint generated always as identity primary key,
  referencia text not null,                -- referencia de la solicitud de socio
  usuario_id uuid default auth.uid(),
  nombre_firmante text not null,
  email text not null,
  documento text not null,                 -- clave del documento (doc-normas, doc-descargo…)
  titulo text not null,
  texto text not null,                     -- copia exacta del texto firmado
  hash_documento text not null,            -- SHA-256 del texto (calculado en el navegador y comprobado aquí)
  firma text not null,                     -- nombre tecleado como firma
  declaracion text,                        -- «He leído y acepto «Título del documento»»
  abierto_at timestamptz,                  -- registro de lectura: cuándo se abrió el documento,
  leido_al_final_at timestamptz,           -- cuándo se llegó al final del texto
  aceptado_at timestamptz,                 -- y cuándo se marcó «He leído»
  aceptado boolean not null check (aceptado),
  metodo text,
  navegador text,
  ip text,                                 -- la pone el servidor
  firmado_at timestamptz not null default now(),
  hash_cadena text                         -- SHA-256 encadenado con el registro anterior
);

create function sellar_firma() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare previo text;
begin
  -- La huella del documento debe corresponder al texto guardado
  if encode(digest(new.texto, 'sha256'), 'hex') <> new.hash_documento then
    raise exception 'La huella no corresponde al texto del documento';
  end if;
  new.firmado_at := now();
  new.usuario_id := auth.uid();
  new.ip := coalesce(current_setting('request.headers', true)::json->>'x-forwarded-for', 'desconocida');
  select hash_cadena into previo from firmas_adhesion order by id desc limit 1;
  new.hash_cadena := encode(digest(coalesce(previo, '') || new.referencia || new.documento || new.hash_documento
                                   || new.firma || new.firmado_at::text, 'sha256'), 'hex');
  return new;
end $$;
create trigger sellar_firma before insert on firmas_adhesion for each row execute function sellar_firma();

-- Nadie puede modificar ni borrar el registro (tampoco la administración)
create function registro_inalterable() returns trigger language plpgsql as $$
begin raise exception 'El registro de firmas no se puede modificar ni borrar'; end $$;
create trigger registro_inalterable before update or delete on firmas_adhesion for each row execute function registro_inalterable();

alter table firmas_adhesion enable row level security;
create policy "firmar (público)" on firmas_adhesion for insert with check (aceptado);
create policy "admin o el propio firmante" on firmas_adhesion for select
  using (es_equipo() or usuario_id = auth.uid() or lower(email) = lower(auth.jwt()->>'email'));

-- No se puede dar de alta a un socio sin los documentos obligatorios firmados
create function exigir_documentos() returns trigger
language plpgsql security definer set search_path = public as $$
declare faltan int;
begin
  if new.estado = 'alta' and old.estado is distinct from 'alta' then
    select count(*) into faltan from unnest(array['doc-normas','doc-descargo','ideario','doc-estatutos','doc-datos']) d(clave)
    where not exists (select 1 from firmas_adhesion f
                      where f.documento = d.clave and (f.referencia = new.referencia or lower(f.email) = lower(new.email)));
    if faltan > 0 then raise exception 'Faltan % documentos de adhesión por firmar', faltan; end if;
  end if;
  return new;
end $$;
create trigger exigir_documentos before update on socios for each row execute function exigir_documentos();

-- ---------- Almacenamiento de archivos ----------
insert into storage.buckets (id, name, public) values ('imagenes', 'imagenes', true), ('documentos', 'documentos', true);

create policy "subir imágenes" on storage.objects for insert to authenticated
  with check (bucket_id = 'imagenes' and (mi_rol() in ('autor', 'editor', 'director', 'admin') or puede_tienda()));
create policy "subir documentos" on storage.objects for insert to authenticated
  with check (bucket_id = 'documentos' and es_equipo());
create policy "borrar archivos" on storage.objects for delete to authenticated
  using (bucket_id in ('imagenes', 'documentos') and es_equipo());

-- =====================================================================
-- GESTIÓN ADMINISTRATIVA Y CONTABLE (solo el equipo: autor, editor, director, admin)
-- Asociados, colaboradores y clientes no tienen acceso.
-- Cuotas (pagos), ventas (pedidos) y donativos se leen de sus tablas; aquí se
-- guardan facturas recibidas, extractos, impuestos y apuntes manuales.
-- =====================================================================

create table facturas_recibidas (
  id bigint generated always as identity primary key,
  fecha date not null,
  proveedor text not null,
  nif_proveedor text,
  numero text,
  concepto text,
  categoria text not null default 'otros',
  base numeric(12,2) not null default 0,
  iva numeric(5,2) not null default 21,
  total numeric(12,2) not null default 0,
  pagada boolean not null default false,
  archivo_url text,            -- ruta en el bucket privado "administracion"
  creado_por uuid references perfiles(id) default auth.uid(),
  creado_at timestamptz not null default now(),
  actualizado_at timestamptz
);

create table extractos (
  id bigint generated always as identity primary key,
  banco text not null,
  periodo text not null check (periodo ~ '^[0-9]{4}-[0-9]{2}$'),   -- AAAA-MM
  nota text,
  archivo_url text,
  creado_por uuid references perfiles(id) default auth.uid(),
  creado_at timestamptz not null default now(),
  actualizado_at timestamptz
);

create table impuestos (
  id bigint generated always as identity primary key,
  modelo text not null,        -- 111, 115, 303, 390, 190, 180, 347, 182, 200, otro
  periodo text not null,       -- 1T, 2T, 3T, 4T, Anual…
  fecha_presentacion date,
  importe numeric(12,2),
  estado text not null default 'pendiente' check (estado in ('pendiente', 'presentado', 'pagado')),
  nota text,
  archivo_url text,
  creado_por uuid references perfiles(id) default auth.uid(),
  creado_at timestamptz not null default now(),
  actualizado_at timestamptz
);

create table apuntes (
  id bigint generated always as identity primary key,
  fecha date not null,
  tipo text not null check (tipo in ('ingreso', 'gasto')),
  categoria text not null default 'otros',
  concepto text not null,
  importe numeric(12,2) not null check (importe >= 0),
  creado_por uuid references perfiles(id) default auth.uid(),
  creado_at timestamptz not null default now(),
  actualizado_at timestamptz
);

create table archivos_web (
  id bigint generated always as identity primary key,
  orden int,
  titulo text not null,
  tipo text not null default 'otro' check (tipo in ('codigo', 'despliegue', 'documentacion', 'contrato', 'otro')),
  version text,
  fecha date,
  nota text,
  archivo_url text,            -- ruta en el bucket privado "administracion"
  nombre_archivo text,
  tamano bigint,
  creado_por uuid references perfiles(id) default auth.uid(),
  creado_at timestamptz not null default now(),
  actualizado_at timestamptz
);

alter table archivos_web enable row level security;
create policy "solo equipo" on archivos_web for all using (es_equipo()) with check (es_equipo());

alter table facturas_recibidas enable row level security;
alter table extractos enable row level security;
alter table impuestos enable row level security;
alter table apuntes enable row level security;
create policy "solo equipo" on facturas_recibidas for all using (es_equipo()) with check (es_equipo());
create policy "solo equipo" on extractos for all using (es_equipo()) with check (es_equipo());
create policy "solo equipo" on impuestos for all using (es_equipo()) with check (es_equipo());
create policy "solo equipo" on apuntes for all using (es_equipo()) with check (es_equipo());

-- El equipo puede CONSULTAR cuotas, ventas y donativos para la contabilidad (no modificarlos)
create policy "equipo consulta (contabilidad)" on pagos for select using (es_equipo());
create policy "equipo consulta (contabilidad)" on donativos for select using (es_equipo());
create policy "equipo consulta (contabilidad)" on pedidos for select using (es_equipo());

-- Archivos contables (facturas, extractos, modelos): bucket PRIVADO
insert into storage.buckets (id, name, public) values ('administracion', 'administracion', false);
create policy "equipo lee administración" on storage.objects for select to authenticated
  using (bucket_id = 'administracion' and es_equipo());
create policy "equipo sube administración" on storage.objects for insert to authenticated
  with check (bucket_id = 'administracion' and es_equipo());
create policy "equipo borra administración" on storage.objects for delete to authenticated
  using (bucket_id = 'administracion' and es_equipo());

-- ---------- Drive del equipo: carpetas y archivos internos (bucket PRIVADO) ----------
create table drive_carpetas (
  id bigint generated always as identity primary key,
  nombre text not null check (length(nombre) between 1 and 120),
  padre_id bigint references drive_carpetas(id) on delete restrict,
  creado_por uuid default auth.uid(),
  creado_at timestamptz not null default now(),
  actualizado_at timestamptz
);
create table drive_archivos (
  id bigint generated always as identity primary key,
  carpeta_id bigint references drive_carpetas(id) on delete restrict,
  nombre text not null,
  ruta text not null unique,          -- ruta dentro del bucket «drive»
  tamano bigint,
  tipo text,
  subido_por uuid default auth.uid(),
  subido_por_nombre text,
  creado_at timestamptz not null default now(),
  actualizado_at timestamptz
);
create index on drive_archivos (carpeta_id);
create index on drive_carpetas (padre_id);
alter table drive_carpetas enable row level security;
alter table drive_archivos enable row level security;
create policy "solo equipo" on drive_carpetas for all using (es_equipo()) with check (es_equipo());
create policy "solo equipo" on drive_archivos for all using (es_equipo()) with check (es_equipo());

insert into storage.buckets (id, name, public, file_size_limit) values ('drive', 'drive', false, 52428800);
create policy "equipo lee drive" on storage.objects for select to authenticated
  using (bucket_id = 'drive' and es_equipo());
create policy "equipo sube drive" on storage.objects for insert to authenticated
  with check (bucket_id = 'drive' and es_equipo());
create policy "equipo borra drive" on storage.objects for delete to authenticated
  using (bucket_id = 'drive' and es_equipo());

-- ---------- Contenido inicial de las páginas ----------
insert into paginas (clave, titulo, contenido) values
  ('inicio', 'PATRIAM', 'Asociación de acción ciudadana, cultural y social.'),
  ('sobre-patriam', 'Sobre PATRIAM', '> Dios, Patria, Justicia

## Quiénes somos

**PATRIAM** no es un partido político, porque **PATRIAM** es oposición frontal al corrupto Régimen del ''78 y a todo lo que es y representa, y los partidos, todos, incluidos los que van por ahí de alternativos, malotes y "antibipartidismo", no son otra cosa que marionetas de los que desde las sombras impusieron este Sistema corrupto del 78 y que llevan cincuenta años destrozando nuestra patria.

Odiamos los partidos políticos y todo lo que representan. Tarde o temprano todos acaban convirtiéndose en sectas cerradas, aislados del Pueblo, sirviendo a una casta intocable, rechazando cualquier crítica y condenando al disidente. Son organizaciones esclerotizadas, incapaces de ver y escuchar más allá de sus consignas monótonamente repetidas, asesinas de ilusiones, fábricas de mentiras, agencias de colocación de lacayos, recompensa para mediocres, trepas y aduladores y, tarde o temprano, focos de corrupción institucionalizada.

Los partidos son la herramienta del corrupto Régimen del ''78, el maldito Régimen que nos ha robado nuestra esencia, arruinado nuestra Economía, sustituido nuestra identidad, rota nuestra unidad y arrebatado nuestro futuro y nuestras ilusiones.

**PATRIAM** no quiere tener nada que ver con un partido: somos una humilde herramienta al servicio del Bien Común. Las puertas están abiertas a todo el que quiera colaborar y contribuir a nuestro combate por Dios y por España. Ni hay carnets de afiliados, ni cuotas a pagar ni fidelidad perruna exigida. Nos da igual que milites en partidos, sindicatos, asociaciones u otros movimientos.

**PATRIAM** ofrece humildemente su casa a todos los compatriotas a los que les duele España, a los que quieren un futuro mejor para ellos y para sus hijos, a los que están orgullosos de su Fe católica, de su identidad y del patrimonio moral y cultural recibido de sus mayores, a los que creen en los valores de la honradez, del esfuerzo y del mérito, a los que ven cómo sus barrios y pueblos se llenan de hordas invasoras, a los que quieren honrar a aquéllos que escribieron las páginas más grandes de la Historia de la Humanidad en Sagunto y en Numancia, en Covadonga, en Clavijo y en las Navas de Tolosa, en Empel y en Baler, a los que, en fin, conciben la Política como servicio y sacrificio por los españoles más débiles y vulnerables, como lucha por el Bien común.

En **PATRIAM** nos sentimos orgullosos herederos de un pasado que, lejos de ser perpetua añoranza proporcionando una excusa paralizante, es impulso para la acción a la que nuestros antepasados nos invitan. Hacemos totalmente nuestra la frase "*la Tradición no es la adoración de las cenizas, sino la transmisión del fuego*".

**PATRIAM** es un Movimiento y no únicamente un Movimiento, sino un Movimiento ofensivo. Nunca nos conformaremos simplemente con ser un Movimiento de defensa o un Movimiento de reacción. No hemos venido para defendernos, sino para atacar. Atacar a los enemigos de nuestra Fe católica, de nuestra Historia, de nuestra esencia, de la vida, de la familia, de nuestra cultura y nuestras raíces, de nuestro trabajo. Vamos a combatir con denuedo por nuestra patria, por las familias, por los trabajadores y, por supuesto, por los jóvenes, porque ellos deben ser la vanguardia de nuestro movimiento. No nos vamos a dejar arrebatar ninguna bandera por los rojos ni por los acomPPlejados ni menos aún por la disidencia controlada. Es más, vamos a arrebatarles las banderas que jamás debieron ser suyas.

**PATRIAM** va a hacerse presente en todos los barrios y todos los pueblos, en todas las facultades y todos los institutos, en todas las fábricas y centros de trabajo.

**PATRIAM** es un movimiento de reconquista nacional. No dejaremos que nos encasillen en las estrechas dimensiones de un partido, no permitiremos que nos reduzcan a las miserias de un chiringuito más, no consentiremos que lo limiten a ser una muleta del Sistema, no aceptaremos que nos alejen del servicio a los españoles más desfavorecidos y aburguesen este movimiento.

El combate de **PATRIAM** es, por encima de todo, espiritual. Si no se entiende que lo que debemos librar en España y Occidente es una guerra espiritual, cualquier combate está llamado al fracaso. Como derivaciones lógicas de esa guerra espiritual, nuestro combate será político, cultural y social. No vamos a dejar ni una bandera al enemigo.

**PATRIAM** es radical y vamos a demostrarlo de palabra y de obra. Radicalidad, sí, entendida ésta como la Política de Servicio a nuestros compatriotas y sobre todo a los más vulnerables. Radicalidad, sí, entendida como un servicio a la Verdad, una defensa de lo Bello y una práctica de lo Bueno. Radicalidad, sí, para desterrar cualquier complejo, enterrar cualquier tibieza y desenmascarar la disidencia controlada que tanto daño está haciendo al movimiento patriota.

Pero, atención: nuestra lucha no será fácil. Conoceremos enormes dificultades, traiciones, engaños y frustraciones. Y es precisamente por eso que os recordamos la siguiente frase: "*Vengan a nuestras filas los que tengan Fe sin límites y queden fuera los que tengan dudas*"

**PATRIAM** no viene a prometeros lo imposible. No somos vendedores de humo. Eso se lo dejamos a los partidos. Venimos a ofreceros soledad, sinsabores, falta de medios, burlas, desprecio y rabia. También exigencia, humildad y disciplina para el combate. Y a cambio de todo ello, coherencia, camaradería y el orgullo de que nunca vuestros hijos os puedan preguntar un día por qué no luchasteis por España.

Si queréis uniros a **PATRIAM** en el combate para lograr una España católica, unida, grande, libre, próspera, indomable e imperial os invitamos a que desde ya os movilicéis. Levantaos de vuestros asientos, salid con nosotros ahí fuera con la cabeza alta y el pecho henchido a decir a nuestros compatriotas que se unan a nuestro combate. Salid a explicarles nuestra alternativa, a ganaros al joven que busca un futuro y no lo encuentra, al estudiante, al autónomo que no le da la vida, al agricultor hundido por la estupidez legislativa de Bruselas y al obrero condenado a un sueldo indigno por culpa de este Sistema corrupto y ladrón.

Compatriotas, camaradas, amigos: no sabemos de qué estará hecho el futuro, pero sí sabemos que está por construir y que el futuro será de los que luchen por él.

Adelante, camaradas, por Dios y por España

**¡¡¡VIVA CRISTO REY!!!**

**¡¡¡VIVA SIEMPRE ESPAÑA!!!**

**¡¡¡ARRIBA ESPAÑA!!!**

## Ideario

PATRIAM aboga por la supresión de los partidos políticos y propone en su lugar la representación de los cuerpos y comunidades naturales: familias, municipios, trabajo…

- PATRIAM propugna una legislación basada en la Ley natural y en la moral objetiva
- PATRIAM defiende al Derecho Natural como fuente inspiradora de la legislación de nuestra patria
- PATRIAM aboga por la implantación del mandato imperativo para los representantes políticos
- PATRIAM defiende la recuperación de la figura del "juicio de residencia" para los representantes políticos
- PATRIAM es firme partidario de la utilización de referéndums como herramienta de participación directa del Pueblo en la toma de decisiones importantes

La Economía debe estar subordinada al Bien Común, poniendo a las personas en el centro de las decisiones y asentarse sobre los valores de esfuerzo, ahorro, iniciativa privada y honradez.'),
  ('nosotros', 'Nosotros', 'Órganos de gobierno de la asociación y documentación pública.'),
  ('ciudadana', 'Acción ciudadana', ''),
  ('cultural', 'Acción cultural', ''),
  ('social', 'Acción social', ''),
  ('revista', 'Revista', ''),
  ('noticias', 'Noticias', ''),
  ('medios', 'Presencia en medios', ''),
  ('recomendaciones', 'Recomendaciones', 'Lecturas que recomendamos de otras webs, periódicos, revistas y libros.'),
  ('colabora', 'Contacto', 'Escríbanos para cualquier consulta, propuesta o colaboración.'),
  ('adhesion', 'Adhiérete', 'Hazte socio o colabora con un donativo.'),
  ('campanas', 'Campañas', 'Apoya con tu firma las campañas que impulsa la asociación.'),
  ('tienda', 'Tienda', 'Libros, ropa y actividades de la asociación.');

-- =====================================================================
-- EQUIPO (misma gestión para todos; solo el rol 'director' aprueba y publica)
-- 1) En Authentication › Users › Add user, crear estos usuarios con la contraseña inicial
--    comunicada al equipo y marcando "Auto Confirm User":
--      patriam-merc@outlook.es · carlosrubioromo@yahoo.es · movimientopatriam@gmail.com · lauraolivareses@yahoo.es
-- 2) Ejecutar en el SQL Editor (allí no aplica la protección de roles):
--    update perfiles set activo = true, cambiar_clave = true, rol = 'admin', nombre = 'Isabel'        where email = 'patriam-merc@outlook.es';
--    update perfiles set activo = true, cambiar_clave = true, rol = 'director', nombre = 'Carlos Rubio' where email = 'carlosrubioromo@yahoo.es';
--    update perfiles set activo = true, cambiar_clave = true, rol = 'admin', nombre = 'Álvaro Mencos'  where email = 'movimientopatriam@gmail.com';
--    update perfiles set activo = true, cambiar_clave = true, rol = 'admin', nombre = 'Laura'          where email = 'lauraolivareses@yahoo.es';
--    La primera vez que entren, la web les obliga a poner una contraseña nueva.
-- =====================================================================
-- -- PRIMER ADMINISTRADOR
-- 1) Cree su usuario en Authentication › Users › Add user (o Invite user)
-- 2) Ejecute (cambiando el email):
--    update perfiles set rol = 'admin', activo = true, nombre = 'Administración'
--    where email = 'SU_EMAIL@ejemplo.com';
--    (Ejecútelo desde el SQL Editor: allí no aplica la protección de roles)
-- =====================================================================

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


-- ===== Cambios de octubre de 2026 (para una base ya creada) =====
alter table socios add column if not exists nombre_pila text, add column if not exists apellido1 text, add column if not exists apellido2 text,
  add column if not exists dni text, add column if not exists fecha_nacimiento date,
  add column if not exists sexo text check (sexo in ('mujer', 'hombre')), add column if not exists telefono text,
  add column if not exists direccion text, add column if not exists codigo_postal text, add column if not exists provincia text,
  add column if not exists descuento text check (descuento in ('familia_numerosa', 'estudiante', 'jubilado', 'desempleado', 'familiar')),
  add column if not exists familiar_afiliado text, add column if not exists descuento_justificado boolean;
alter table firmas_adhesion add column if not exists declaracion text, add column if not exists abierto_at timestamptz,
  add column if not exists leido_al_final_at timestamptz, add column if not exists aceptado_at timestamptz;
alter table acciones add column if not exists dirigida text not null default 'todos' check (dirigida in ('todos', 'mujeres', 'hombres'));

alter table productos add column if not exists enlace_externo text;
alter table productos drop constraint if exists productos_categoria_check;
alter table productos add constraint productos_categoria_check check (categoria in ('libros', 'ropa', 'regalos', 'actividades'));
alter table productos add column if not exists gelato_uids text, add column if not exists gelato_archivo text;  -- productos que fabrica y envía Gelato
alter table articulos add column if not exists fecha date;  -- fecha del comunicado o de la aparición en medios (ordena y separa nuevos y anteriores)
