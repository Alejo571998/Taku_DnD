-- ═══════════════════════════════════════════════════════════════════════════
-- AISLAMIENTO ENTRE INQUILINOS (MASTER SPEC §41)
--
--   "Un usuario jamás puede acceder a datos de otro tenant."
--
-- Esa frase no se comprueba leyendo las políticas: se comprueba intentando
-- leer datos ajenos y viendo que no salen. Este archivo lo intenta de verdad.
--
-- La política `characters_select` tiene DOS EJES —workspace propio O campaña
-- compartida— y por eso es la superficie de fuga más probable del sistema.
-- Casi todos los casos de aquí atacan ese punto.
--
-- CÓMO EJECUTARLO
--
--   npm run test:db                    # Postgres en proceso, sin instalar nada
--   DATABASE_URL=... npm run test:db   # contra una instancia real
--
-- Sale con error en el primer fallo. Al final imprime el detalle de cada caso.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

set local client_min_messages to warning;

-- ── Utilidades ──────────────────────────────────────────────────────────────

create temporary table results (
  id          serial primary key,
  ok          boolean not null,
  description text    not null
);

/**
 * `security definer` para que la anotación funcione también mientras actuamos
 * como `authenticated`. La CONDICIÓN se evalúa en quien llama —o sea, bajo la
 * RLS del usuario suplantado—, que es justo lo que queremos medir; lo único
 * que corre elevado es apuntar el resultado.
 */
create or replace function pg_temp.expect(
  condition boolean,
  description text
) returns void language plpgsql security definer as $fn$
begin
  insert into pg_temp.results (ok, description) values (coalesce(condition, false), description);
  if not coalesce(condition, false) then
    raise exception 'FALLO: %', description;
  end if;
  raise notice 'ok  %', description;
end;
$fn$;

/**
 * Ejecuta una sentencia esperando que la RLS la RECHACE.
 *
 * Deliberadamente NO es `security definer`: la sentencia tiene que correr con
 * los privilegios del usuario suplantado. Y solo atrapa `insufficient_privilege`
 * —si fallara por una restricción, eso no es aislamiento y debe propagarse.
 */
create or replace function pg_temp.was_denied(stmt text)
returns boolean language plpgsql as $fn$
begin
  execute stmt;
  return false;
exception
  when insufficient_privilege then
    return true;
end;
$fn$;

/** Actúa como un usuario concreto, igual que hace PostgREST. */
create or replace function pg_temp.act_as(user_id uuid)
returns void language plpgsql as $fn$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', user_id, 'role', 'authenticated')::text, true);
end;
$fn$;

create or replace function pg_temp.act_as_service()
returns void language plpgsql as $fn$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end;
$fn$;

-- ── Escenario ───────────────────────────────────────────────────────────────
--
--   ANA    — jugadora. Tiene a "Arkan".
--   BRUNO  — otro jugador, sin relación con Ana. Tiene a "Vex".
--   CAMILA — DM de una campaña en la que Ana comparte a Arkan.
--
-- Lo que debe pasar:
--   Bruno  → no ve NADA de Ana.
--   Camila → ve a Arkan (está en su campaña) pero NO lo puede modificar.

select pg_temp.act_as_service();

-- Se rellenan las columnas que GoTrue marca NOT NULL sin valor por defecto.
-- Insertar solo id y correo funciona en algunas versiones y falla en otras, y
-- un test que falla por el fixture no prueba nada.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
)
values
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-4111-8111-111111111111',
   'authenticated', 'authenticated', 'ana@test.local', '', now(),
   '{"provider":"email"}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', '22222222-2222-4222-8222-222222222222',
   'authenticated', 'authenticated', 'bruno@test.local', '', now(),
   '{"provider":"email"}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', '33333333-3333-4333-8333-333333333333',
   'authenticated', 'authenticated', 'camila@test.local', '', now(),
   '{"provider":"email"}'::jsonb, '{}'::jsonb, now(), now());

-- El disparador `handle_new_user` ya creó un workspace para cada uno.
create temporary table ws as
select
  (select workspace_id from public.workspace_members where user_id = '11111111-1111-4111-8111-111111111111' limit 1) as ana,
  (select workspace_id from public.workspace_members where user_id = '22222222-2222-4222-8222-222222222222' limit 1) as bruno,
  (select workspace_id from public.workspace_members where user_id = '33333333-3333-4333-8333-333333333333' limit 1) as camila;

-- Las tablas temporales son del dueño de la sesión. Sin esto, leerlas mientras
-- actuamos como `authenticated` daría "permission denied" y un test de fuga
-- pasaría por el motivo equivocado.
grant select on ws      to public;
grant select on results to public;

select pg_temp.expect(
  (select ana is not null and bruno is not null and camila is not null from ws),
  'el alta crea un workspace personal por usuario'
);

select pg_temp.expect(
  (select ana <> bruno and bruno <> camila from ws),
  'cada usuario tiene su propio workspace'
);

insert into public.characters (id, workspace_id, name, ruleset, level, version, state)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', (select ana from ws),   'Arkan', '2014', 3, 1, '{"name":"Arkan"}'::jsonb),
  ('a2a2a2a2-a2a2-4a2a-8a2a-a2a2a2a2a2a2', (select ana from ws),   'Nima',  '2014', 1, 1, '{"name":"Nima"}'::jsonb),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', (select bruno from ws), 'Vex',   '2014', 2, 1, '{"name":"Vex"}'::jsonb);

insert into public.campaigns (id, workspace_id, name, ruleset, dm_user_id)
values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', (select camila from ws), 'La mesa de Camila', '2014',
        '33333333-3333-4333-8333-333333333333');

insert into public.campaign_members (campaign_id, user_id, role)
values
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', '33333333-3333-4333-8333-333333333333', 'DM'),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', '11111111-1111-4111-8111-111111111111', 'PLAYER');

insert into public.campaign_characters (campaign_id, character_id)
values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');

-- Contenido propio de Ana, y un pack suyo marcado público.
insert into public.content_packs (id, workspace_id, slug, name, ruleset, visibility, source)
values
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', (select ana from ws), 'privado-de-ana', 'Privado de Ana',
   '2014', 'private', '{}'::jsonb),
  ('ffffffff-ffff-4fff-8fff-ffffffffffff', (select ana from ws), 'publico-de-ana', 'Público de Ana',
   '2014', 'public', '{}'::jsonb);

insert into public.content_definitions (id, pack_id, workspace_id, type, name, rulesets, data)
values
  ('hb-ana:weapon:secreta', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', (select ana from ws),
   'weapon', 'Espada Secreta', array['2014'], '{}'::jsonb),
  ('hb-ana:weapon:compartida', 'ffffffff-ffff-4fff-8fff-ffffffffffff', (select ana from ws),
   'weapon', 'Espada Compartida', array['2014'], '{}'::jsonb);

-- ── 1 · Lo propio se ve ─────────────────────────────────────────────────────

select pg_temp.act_as('11111111-1111-4111-8111-111111111111');

select pg_temp.expect(
  (select count(*) = 1 from public.characters where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  'Ana ve su propio personaje'
);

-- El caso feliz, y hace falta comprobarlo aparte: el escenario de arriba
-- inserta como servicio, así que nunca toca la política de INSERT. Sin esto,
-- una recursión en esa política pasaría desapercibida por más casos de fuga
-- que hubiera.
insert into public.campaign_characters (campaign_id, character_id)
values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'a2a2a2a2-a2a2-4a2a-8a2a-a2a2a2a2a2a2');

select pg_temp.expect(
  (select count(*) = 1 from public.campaign_characters
   where character_id = 'a2a2a2a2-a2a2-4a2a-8a2a-a2a2a2a2a2a2'),
  'Ana SÍ puede compartir un personaje suyo en una campaña de la que es miembro'
);

-- Y lo puede retirar.
delete from public.campaign_characters
where character_id = 'a2a2a2a2-a2a2-4a2a-8a2a-a2a2a2a2a2a2';

select pg_temp.expect(
  (select count(*) = 0 from public.campaign_characters
   where character_id = 'a2a2a2a2-a2a2-4a2a-8a2a-a2a2a2a2a2a2'),
  'Ana puede retirar de la campaña un personaje suyo'
);

-- ── 2 · Lo ajeno NO se ve ───────────────────────────────────────────────────

select pg_temp.act_as('22222222-2222-4222-8222-222222222222');

select pg_temp.expect(
  (select count(*) = 0 from public.characters where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  'Bruno NO ve el personaje de Ana'
);

select pg_temp.expect(
  (select count(*) = 1 from public.characters),
  'Bruno solo ve el suyo: un select sin filtro no filtra datos ajenos'
);

select pg_temp.expect(
  (select count(*) = 0 from public.workspaces where id = (select ana from ws)),
  'Bruno NO ve el workspace de Ana'
);

select pg_temp.expect(
  (select count(*) = 0 from public.campaigns where id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'),
  'Bruno NO ve una campaña de la que no es miembro'
);

select pg_temp.expect(
  (select count(*) = 0 from public.workspace_members where workspace_id = (select ana from ws)),
  'Bruno NO puede enumerar los miembros del workspace de Ana'
);

-- ── 3 · El segundo eje: campaña compartida ──────────────────────────────────

select pg_temp.act_as('33333333-3333-4333-8333-333333333333');

select pg_temp.expect(
  (select count(*) = 1 from public.characters where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  'Camila (DM) SÍ ve el personaje compartido en su campaña'
);

select pg_temp.expect(
  (select count(*) = 0 from public.characters where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
  'Camila NO ve un personaje que no está en su campaña'
);

-- El caso fino: Nima también es de Ana, y Ana está en la mesa de Camila. Pero
-- Nima no está COMPARTIDA. Compartir mesa no comparte la ficha entera.
select pg_temp.expect(
  (select count(*) = 0 from public.characters where id = 'a2a2a2a2-a2a2-4a2a-8a2a-a2a2a2a2a2a2'),
  'Compartir mesa NO expone los demás personajes del jugador'
);

-- Ver no es poder tocar. Es la distinción que hace utilizable el rol de DM.
update public.characters set name = 'Arkan el Hackeado'
where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

select pg_temp.expect(
  (select name = 'Arkan' from public.characters where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  'Camila puede VER el personaje pero NO modificarlo'
);

delete from public.characters where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

select pg_temp.expect(
  (select count(*) = 1 from public.characters where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  'Camila tampoco lo puede borrar'
);

-- Ver el personaje de Ana no le abre el historial del workspace de Ana.
select pg_temp.expect(
  (select count(*) = 0 from public.change_log where workspace_id = (select ana from ws)),
  'Ver un personaje por campaña NO da acceso al change_log de su workspace'
);

-- ── 4 · Escribir en un workspace ajeno ──────────────────────────────────────

select pg_temp.act_as('22222222-2222-4222-8222-222222222222');

select pg_temp.expect(
  pg_temp.was_denied(format(
    $q$insert into public.characters (id, workspace_id, name, ruleset, level, version, state)
       values ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', %L, 'Intruso', '2014', 1, 1, '{}'::jsonb)$q$,
    (select ana from ws))),
  'Bruno NO puede crear personajes en el workspace de Ana'
);

-- Una actualización a ciegas: no da error, pero tampoco toca nada.
update public.characters set name = 'Robado' where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

select pg_temp.act_as_service();

select pg_temp.expect(
  (select name = 'Arkan' from public.characters where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  'Un update a ciegas de Bruno sobre el personaje de Ana no cambia nada'
);

select pg_temp.act_as('22222222-2222-4222-8222-222222222222');

-- ── 5 · Sincronización: cursor y operaciones ────────────────────────────────

select pg_temp.expect(
  (select count(*) = 0 from public.change_log where workspace_id = (select ana from ws)),
  'Bruno NO ve el change_log de Ana: el cursor no filtra datos ajenos'
);

select pg_temp.expect(
  (select count(*) = 0 from public.applied_operations where workspace_id = (select ana from ws)),
  'Bruno NO ve las operaciones aplicadas de Ana'
);

select pg_temp.expect(
  (select count(*) = 0 from public.sync_conflicts where workspace_id = (select ana from ws)),
  'Bruno NO ve los conflictos de Ana'
);

-- ── 6 · Unirse a una campaña por la fuerza ──────────────────────────────────

select pg_temp.expect(
  pg_temp.was_denied(
    $q$insert into public.campaign_members (campaign_id, user_id, role)
       values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', '22222222-2222-4222-8222-222222222222', 'PLAYER')$q$),
  'Bruno NO se puede añadir solo a una campaña ajena'
);

-- La otra mitad de la escalada: crear su propia campaña dentro del workspace
-- de Ana le daría el segundo eje gratis.
select pg_temp.expect(
  pg_temp.was_denied(format(
    $q$insert into public.campaigns (workspace_id, name, ruleset, dm_user_id)
       values (%L, 'Campaña pirata', '2014', '22222222-2222-4222-8222-222222222222')$q$,
    (select ana from ws))),
  'Bruno NO puede crear una campaña dentro del workspace de Ana'
);

-- ── 7 · Meter un personaje ajeno en la propia campaña ───────────────────────

select pg_temp.act_as('33333333-3333-4333-8333-333333333333');

select pg_temp.expect(
  pg_temp.was_denied(
    -- Si esto pasara, cualquier DM podría leer cualquier personaje del sistema
    -- con solo añadirlo a una campaña suya.
    $q$insert into public.campaign_characters (campaign_id, character_id)
       values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')$q$),
  'Un DM NO puede sumar a su campaña un personaje que no es suyo'
);

-- Pero sí puede SACAR a alguien de su propia mesa: es su mesa.
delete from public.campaign_characters
where campaign_id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
  and character_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

select pg_temp.expect(
  (select count(*) = 0 from public.campaign_characters
   where character_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  'El DM SÍ puede retirar un personaje de su propia campaña'
);

select pg_temp.expect(
  (select count(*) = 0 from public.characters where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  'Al retirarlo, el DM deja de verlo: el acceso se revoca de verdad'
);

-- ── 8 · Contenido propio ────────────────────────────────────────────────────
--
-- `content_packs_select` tiene una válvula de escape: `visibility = 'public'`.
-- Una válvula así solo es segura si deja pasar EXACTAMENTE lo marcado.

select pg_temp.act_as('22222222-2222-4222-8222-222222222222');

select pg_temp.expect(
  (select count(*) = 0 from public.content_packs where slug = 'privado-de-ana'),
  'Bruno NO ve el pack privado de Ana'
);

select pg_temp.expect(
  (select count(*) = 1 from public.content_packs where slug = 'publico-de-ana'),
  'Bruno SÍ ve el pack que Ana marcó público'
);

select pg_temp.expect(
  (select count(*) = 0 from public.content_definitions where id = 'hb-ana:weapon:secreta'),
  'Lo público de Ana NO arrastra sus definiciones privadas'
);

select pg_temp.expect(
  (select count(*) = 1 from public.content_definitions where id = 'hb-ana:weapon:compartida'),
  'Las definiciones del pack público sí se ven'
);

-- Ver no es poder tocar, también para el contenido.
update public.content_definitions set name = 'Secuestrada'
where id = 'hb-ana:weapon:compartida';

select pg_temp.act_as_service();

select pg_temp.expect(
  (select name = 'Espada Compartida' from public.content_definitions
   where id = 'hb-ana:weapon:compartida'),
  'Ver un pack público NO permite modificar sus definiciones'
);

-- ── 9 · Sin sesión ──────────────────────────────────────────────────────────
--
-- `auth.uid()` devuelve NULL cuando no hay token. Toda política tiene que
-- fallar CERRADA, no abierta.

do $blk$
begin
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', '', true);
end;
$blk$;

select pg_temp.expect(
  (select count(*) = 0 from public.characters),
  'Sin sesión no se ve ningún personaje: las políticas fallan cerradas'
);

select pg_temp.expect(
  (select count(*) = 0 from public.workspaces),
  'Sin sesión no se ve ningún workspace'
);

select pg_temp.expect(
  (select count(*) = 0 from public.content_definitions where id = 'hb-ana:weapon:secreta'),
  'Sin sesión no se ve contenido privado'
);

-- Esto NO es una fuga: es la definición de "público", y queda escrito aquí
-- para que se decida a propósito y no por descuido. Con la clave anónima,
-- cualquiera lee un pack marcado `public`. Hoy la app no ofrece ninguna forma
-- de marcarlo —todo el Homebrew nace privado—, así que la puerta existe pero
-- no hay pomo. El día que se añada compartir, esto es lo que significará.
select pg_temp.expect(
  (select count(*) = 1 from public.content_definitions where id = 'hb-ana:weapon:compartida'),
  'Sin sesión SÍ se ve lo marcado público: es lo que "público" quiere decir'
);

-- ── Informe ─────────────────────────────────────────────────────────────────

select pg_temp.act_as_service();

select
  id,
  case when ok then 'ok' else 'FALLO' end as estado,
  description                             as resultado
from pg_temp.results
order by id;

-- Nada se persiste: esto es una prueba, no una migración.
rollback;
