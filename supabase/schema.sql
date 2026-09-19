-- ============================================================================
-- Portería — Condominio Villa Tepual
-- Esquema base. Adaptado del módulo de portería de Tresol ERP al dominio
-- residencial: el "personal interno" pasa a ser residentes (con su unidad),
-- los "externos frecuentes" pasan a ser visitas frecuentes autorizadas
-- (personal de servicio recurrente), y la visita única mantiene el mismo
-- formulario manual pero apuntando a la unidad que la recibe.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ── Usuarios del sistema (conserjes + administración) ───────────────────────
create table if not exists usuarios (
  id                uuid primary key default gen_random_uuid(),
  nombre            text not null,
  rut               text not null unique,
  password_hash     text not null,
  rol               text not null default 'conserje' check (rol in ('conserje', 'admin')),
  activo            boolean not null default true,
  intentos_fallidos integer not null default 0,
  bloqueado_hasta   timestamptz,
  ultimo_acceso     timestamptz,
  created_at        timestamptz not null default now()
);

-- ── Residentes ──────────────────────────────────────────────────────────────
create table if not exists residentes (
  id               uuid primary key default gen_random_uuid(),
  nombre           text not null,
  apellido         text not null,
  rut              text unique,
  unidad           text not null,
  tipo             text not null default 'propietario' check (tipo in ('propietario', 'arrendatario')),
  telefono         text,
  email            text,
  patente_default  text,
  activo           boolean not null default true,
  created_at       timestamptz not null default now()
);

create index if not exists idx_residentes_activo on residentes (activo) where activo;
create index if not exists idx_residentes_unidad on residentes (unidad);

-- ── Visitas frecuentes (personal de servicio autorizado) ────────────────────
-- Tabla separada de residentes por la misma razón que en Tresol `porteria_externos`
-- vive aparte de `maestro_personas`: son personas externas al condominio y no
-- deben mezclarse con el padrón de residentes (cobros, asambleas, notificaciones).
create table if not exists visitas_frecuentes (
  id               uuid primary key default gen_random_uuid(),
  nombre           text not null,
  apellido         text not null,
  rut              text unique,
  tipo_servicio    text,
  unidad_destino   text,
  autorizado_por   uuid references residentes(id) on delete set null,
  patente_default  text,
  activo           boolean not null default true,
  created_at       timestamptz not null default now()
);

create index if not exists idx_visitas_frecuentes_activo on visitas_frecuentes (activo) where activo;

-- ── Registro de ingresos y salidas ──────────────────────────────────────────
create table if not exists logs_porteria (
  id                   uuid primary key default gen_random_uuid(),
  residente_id         uuid references residentes(id) on delete set null,
  visita_frecuente_id  uuid references visitas_frecuentes(id) on delete set null,
  nombre_manual        text,
  rut_manual           text,
  unidad_destino       text,
  motivo               text,
  patente              text,
  acceso               text not null default 'principal',
  fecha                date not null default (now() at time zone 'America/Santiago')::date,
  hora_ingreso         timestamptz not null default now(),
  hora_salida          timestamptz,
  observacion          text,
  registrado_por_id    uuid references usuarios(id) on delete set null,
  salida_por_id        uuid references usuarios(id) on delete set null,
  created_at           timestamptz not null default now(),
  -- Un registro es de un residente, de una visita frecuente, o manual: nunca de dos a la vez.
  constraint logs_porteria_una_identidad check (
    (residente_id is not null)::int + (visita_frecuente_id is not null)::int <= 1
  )
);

create index if not exists idx_logs_porteria_fecha on logs_porteria (fecha desc);
create index if not exists idx_logs_porteria_hora_ingreso on logs_porteria (hora_ingreso desc);
create index if not exists idx_logs_porteria_adentro on logs_porteria (hora_salida) where hora_salida is null;
create index if not exists idx_logs_porteria_rut_manual on logs_porteria (rut_manual) where rut_manual is not null;
create index if not exists idx_logs_porteria_nombre_manual on logs_porteria (nombre_manual) where nombre_manual is not null;

-- La columna `fecha` es el día chileno del ingreso. Si se corrige `hora_ingreso`
-- desde la UI hay que recalcularla, o la vista histórica deja de encontrar el
-- registro (bug real corregido en Tresol el 22-07-2026).
create or replace function sincronizar_fecha_ingreso()
returns trigger language plpgsql as $$
begin
  new.fecha := (new.hora_ingreso at time zone 'America/Santiago')::date;
  return new;
end $$;

drop trigger if exists trg_logs_porteria_fecha on logs_porteria;
create trigger trg_logs_porteria_fecha
  before insert or update of hora_ingreso on logs_porteria
  for each row execute function sincronizar_fecha_ingreso();

-- ── Historial de patentes por persona ───────────────────────────────────────
-- Append-only: nunca se sobrescribe una patente conocida. Si la persona tiene
-- más de una, el conserje elige cuál corresponde ese día en vez de que el
-- sistema adivine (misma decisión que Tresol tras el caso de patentes
-- transpuestas que se pisaban entre sí).
create table if not exists porteria_patentes (
  id                   uuid primary key default gen_random_uuid(),
  residente_id         uuid references residentes(id) on delete cascade,
  visita_frecuente_id  uuid references visitas_frecuentes(id) on delete cascade,
  patente              text not null,
  activo               boolean not null default true,
  created_at           timestamptz not null default now(),
  constraint porteria_patentes_una_identidad check (
    (residente_id is not null)::int + (visita_frecuente_id is not null)::int = 1
  )
);

create unique index if not exists idx_porteria_patentes_residente
  on porteria_patentes (residente_id, patente) where residente_id is not null;
create unique index if not exists idx_porteria_patentes_visita
  on porteria_patentes (visita_frecuente_id, patente) where visita_frecuente_id is not null;

-- ── Auditoría ───────────────────────────────────────────────────────────────
create table if not exists audit_log (
  id          bigserial primary key,
  tabla       text not null,
  operacion   text not null,
  registro_id text,
  datos_antes jsonb,
  datos_despues jsonb,
  ocurrido_en timestamptz not null default now()
);

create index if not exists idx_audit_log_tabla_fecha on audit_log (tabla, ocurrido_en desc);

create or replace function registrar_auditoria()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into audit_log (tabla, operacion, registro_id, datos_antes, datos_despues)
  values (
    tg_table_name,
    tg_op,
    coalesce(new.id::text, old.id::text),
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end
  );
  return coalesce(new, old);
end $$;

create or replace function aplicar_auditoria(nombre_tabla text)
returns void language plpgsql as $$
begin
  execute format('drop trigger if exists trg_auditoria on %I', nombre_tabla);
  execute format(
    'create trigger trg_auditoria after insert or update or delete on %I
     for each row execute function registrar_auditoria()', nombre_tabla
  );
end $$;

select aplicar_auditoria('logs_porteria');
select aplicar_auditoria('residentes');
select aplicar_auditoria('visitas_frecuentes');
select aplicar_auditoria('porteria_patentes');

-- ── RLS ─────────────────────────────────────────────────────────────────────
-- Todo el acceso de la app pasa por /api/proxy con service_role (que salta RLS)
-- y valida sesión + rol. Dejar RLS activo sin políticas permisivas asegura que
-- las claves anon/authenticated no puedan leer ni escribir nada aunque se
-- filtren: la barrera no depende solo del código de la app.
alter table usuarios            enable row level security;
alter table residentes          enable row level security;
alter table visitas_frecuentes  enable row level security;
alter table logs_porteria       enable row level security;
alter table porteria_patentes   enable row level security;
alter table audit_log           enable row level security;

-- Sin estos GRANT, PostgREST responde 42501 (permission denied) para
-- service_role antes incluso de evaluar RLS. No se otorga nada a
-- anon/authenticated: quedan sin acceso por diseño (ver comentario arriba).
grant usage on schema public to service_role;
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
