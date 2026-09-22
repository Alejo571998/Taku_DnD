-- ═══════════════════════════════════════════════════════════════════════════
-- LO QUE SUPABASE YA TIENE PUESTO
--
-- `0001_initial_schema.sql` da por sentado un entorno Supabase: los roles de
-- PostgREST, el esquema `auth` de GoTrue y la función `auth.uid()`. En una
-- instancia de Supabase eso ya existe; en un Postgres vacío, no.
--
-- Este archivo lo crea para poder EJECUTAR los tests de aislamiento sin
-- depender de una instancia remota.
--
-- QUÉ EMULA CON FIDELIDAD
--   · Los tres roles de PostgREST y los permisos por defecto que Supabase
--     concede sobre `public`. Esto importa: sin los GRANT, cada consulta
--     fallaría con "permission denied" y un test de fuga de datos PASARÍA
--     por el motivo equivocado.
--   · `auth.uid()`, con la misma definición que usa Supabase (lee el GUC
--     `request.jwt.claims`, que es como PostgREST inyecta el token).
--   · Las columnas de `auth.users` que el esquema y los tests tocan.
--
-- QUÉ **NO** EMULA
--   · GoTrue: registro, contraseñas, confirmación por correo, refresco de
--     sesión. Aquí los usuarios se insertan a mano.
--   · PostgREST: la capa HTTP, el parseo real del JWT y su firma.
--   · El resto de `auth.users` (GoTrue tiene ~30 columnas más).
--
-- Dicho de otro modo: esto comprueba las POLÍTICAS, que es donde vive
-- MASTER SPEC §41. No comprueba la plataforma de Supabase.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Roles de PostgREST ──────────────────────────────────────────────────────

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    -- `bypassrls` es exactamente lo que hace que la clave de servicio sea
    -- peligrosa, y por lo que nunca puede salir del servidor (PROMPT §43).
    create role service_role nologin noinherit bypassrls;
  end if;
end;
$$;

-- ── Esquema de GoTrue ───────────────────────────────────────────────────────

create schema if not exists auth;

create table if not exists auth.users (
  instance_id        uuid,
  id                 uuid primary key,
  aud                varchar(255),
  role               varchar(255),
  email              varchar(255) unique,
  encrypted_password varchar(255),
  email_confirmed_at timestamptz,
  raw_app_meta_data  jsonb,
  raw_user_meta_data jsonb,
  created_at         timestamptz,
  updated_at         timestamptz
);

/**
 * Misma definición que la de Supabase.
 *
 * PostgREST valida el JWT y deja sus claims en este GUC; `auth.uid()` solo
 * lee lo que ya fue verificado. Si devolviera NULL, TODA política basada en
 * `= auth.uid()` se volvería falsa — falla cerrado, que es lo correcto.
 */
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;

create or replace function auth.role()
returns text
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  )::text
$$;

-- ── Permisos por defecto ────────────────────────────────────────────────────
--
-- Supabase los aplica al crear el proyecto. Se reproducen aquí para que la
-- única barrera que quede en pie sea la RLS: si un test ve datos ajenos, es
-- porque la política falló, no porque olvidamos un GRANT.

grant usage on schema public to anon, authenticated, service_role;
grant usage on schema auth   to anon, authenticated, service_role;

alter default privileges in schema public
  grant all on tables    to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on functions to anon, authenticated, service_role;

grant select on auth.users to authenticated, service_role;
