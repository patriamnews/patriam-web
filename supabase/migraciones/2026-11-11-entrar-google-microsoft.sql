-- Entrar con Google y con Microsoft (además de con correo y contraseña).
-- Cada persona del equipo puede tener otros correos (su Gmail, su Outlook…): al entrar con ellos por primera vez
-- se le crea una cuenta con los MISMOS permisos que su usuario de siempre.
-- Se pega entero en Supabase › SQL Editor › Run. Se puede ejecutar más de una vez.

create table if not exists correos_entrada (
  email text primary key check (email = lower(email)),
  perfil_id uuid not null references perfiles on delete cascade,
  creado_at timestamptz not null default now()
);
alter table correos_entrada enable row level security;
drop policy if exists "equipo ve correos de entrada" on correos_entrada;
create policy "equipo ve correos de entrada" on correos_entrada for select using (es_equipo());
drop policy if exists "director gestiona correos de entrada" on correos_entrada;
create policy "director gestiona correos de entrada" on correos_entrada for all
  using (mi_rol() in ('director', 'admin')) with check (mi_rol() in ('director', 'admin'));

-- Copia los permisos del perfil de siempre (rol, área, aprueba, redes, tienda…) en la cuenta nueva
create or replace function copiar_permisos(p_destino uuid, p_modelo uuid) returns void
language plpgsql security definer set search_path = public as $$
declare m jsonb; d jsonb; sql text;
begin
  select to_jsonb(p) into m from perfiles p where id = p_modelo;
  select to_jsonb(p) into d from perfiles p where id = p_destino;
  if m is null or d is null then return; end if;
  -- todas las columnas de permisos (rol, área, activo, aprueba, gestiona_redes, gestiona_tienda…), menos las propias de la cuenta
  select 'update perfiles set ' || string_agg(format('%I = r.%I', c.column_name, c.column_name), ', ') ||
         ' from jsonb_populate_record(null::perfiles, $1) r where perfiles.id = $2'
    into sql
    from information_schema.columns c
   where c.table_schema = 'public' and c.table_name = 'perfiles'
     and c.column_name not in ('id', 'email', 'nombre', 'creado_at', 'cambiar_clave');
  if sql is not null then execute sql using (d || (m - 'id' - 'email' - 'nombre' - 'creado_at' - 'cambiar_clave')), p_destino; end if;
end $$;

create or replace function crear_perfil() returns trigger
language plpgsql security definer set search_path = public as $$
declare modelo uuid;
begin
  -- Las cuentas creadas desde la web pública (Acceder › Crear cuenta) son de cliente/asociado y quedan activas.
  -- Las invitadas desde Supabase quedan pendientes hasta que el administrador les dé un rol de equipo.
  insert into perfiles (id, email, nombre, rol, activo)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'nombre', new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''),
          case when new.raw_user_meta_data->>'tipo' = 'cliente' then 'cliente'::rol_usuario else 'pendiente'::rol_usuario end,
          coalesce(new.raw_user_meta_data->>'tipo' = 'cliente', false));
  -- Si el correo es «otro correo» de alguien del equipo (Google, Microsoft…), entra con sus mismos permisos
  select perfil_id into modelo from correos_entrada where email = lower(new.email);
  if modelo is not null then perform copiar_permisos(new.id, modelo); end if;
  return new;
end $$;

-- Isabel: administradora máxima (aprueba y publica como Carlos) y entra también con su Gmail y su Outlook
do $$
declare isa uuid;
begin
  select id into isa from perfiles where lower(email) = 'patriam-merc@outlook.es';
  if isa is null then raise notice 'No está el perfil patriam-merc@outlook.es'; return; end if;
  update perfiles set rol = 'admin', activo = true where id = isa;   -- administradora (lo más alto) y, con «aprueba», publica como Carlos
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'perfiles' and column_name = 'aprueba') then
    execute 'update perfiles set aprueba = true where id = $1' using isa;
  end if;
  insert into correos_entrada (email, perfil_id) values
    ('isabel.olivaresdelacerda@gmail.com', isa), ('isabel.olivaresdelacerda@outlook.com', isa)
  on conflict (email) do update set perfil_id = excluded.perfil_id;
  -- si ya había entrado con alguno de ellos, se le ponen los permisos ahora
  perform copiar_permisos(p.id, isa) from perfiles p
    where lower(p.email) in ('isabel.olivaresdelacerda@gmail.com', 'isabel.olivaresdelacerda@outlook.com');
end $$;
