-- ═══════════════════════════════════════════════════════════════════════════
-- EL CONTRATO DE SINCRONIZACIÓN, CONTRA POSTGRES DE VERDAD
--
-- `src/app/api/sync/push/route.ts` promete tres garantías, y dos de las tres
-- no las da el código: las da la BASE DE DATOS. Comprobarlas contra un
-- transporte falso solo demuestra que la imitación imita.
--
-- Aquí se ejercita el SQL exacto que emite el servidor:
--
--   1. IDEMPOTENCIA      insert into applied_operations → 23505 en el reintento
--   2. CONCURRENCIA      update ... where version < N   → 0 filas si alguien ganó
--   3. CURSOR            change_log.seq monótona, y tolerante a huecos
--
-- LO QUE **NO** SE PRUEBA AQUÍ: la carrera entre dos transacciones que
-- confirman fuera de orden. Postgres reserva el `seq` al insertar, no al
-- confirmar, así que un lector puede adelantar el cursor por encima de un
-- `seq` que todavía no confirmó y perdérselo para siempre. Hace falta
-- concurrencia real —dos conexiones— para provocarlo, y el Postgres en
-- proceso es de una sola conexión. Queda anotado como T13.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

set local client_min_messages to warning;

create temporary table results (
  id          serial primary key,
  ok          boolean not null,
  description text    not null
);

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

/** Devuelve el SQLSTATE con el que falló la sentencia, o NULL si pasó. */
create or replace function pg_temp.sqlstate_of(stmt text)
returns text language plpgsql as $fn$
begin
  execute stmt;
  return null;
exception
  when others then
    return sqlstate;
end;
$fn$;

-- ── Escenario ───────────────────────────────────────────────────────────────

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values ('00000000-0000-0000-0000-000000000000', '11111111-1111-4111-8111-111111111111',
        'authenticated', 'authenticated', 'ana@test.local', '', now(),
        '{"provider":"email"}'::jsonb, '{}'::jsonb, now(), now());

create temporary table ws as
select workspace_id as id from public.workspace_members
where user_id = '11111111-1111-4111-8111-111111111111' limit 1;

-- Arkan llega al servidor por primera vez, en versión 1.
insert into public.characters (id, workspace_id, name, ruleset, level, version, state)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', (select id from ws), 'Arkan', '2014', 3, 1,
        '{"name":"Arkan","hp":20}'::jsonb);

-- ── 1 · Idempotencia ────────────────────────────────────────────────────────
--
-- El móvil manda "quitá 7 de vida", se corta la red antes de ver la respuesta
-- y reintenta. El daño NO puede aplicarse dos veces.

insert into public.applied_operations (client_op_id, workspace_id, character_id, command_type)
values ('0b000000-0000-4000-8000-000000000001', (select id from ws),
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'ApplyDamage');

select pg_temp.expect(
  pg_temp.sqlstate_of(format(
    $q$insert into public.applied_operations (client_op_id, workspace_id, character_id, command_type)
       values ('0b000000-0000-4000-8000-000000000001', %L,
               'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'ApplyDamage')$q$,
    (select id from ws))) = '23505',
  'El reintento de una operación ya aplicada choca con la clave primaria (23505)'
);

-- Ese 23505 es el que `route.ts` traduce a status "duplicate". Si Postgres
-- devolviera otro código, el servidor lo tomaría por un rechazo real.
select pg_temp.expect(
  (select count(*) = 1 from public.applied_operations
   where client_op_id = '0b000000-0000-4000-8000-000000000001'),
  'Tras el reintento sigue habiendo UNA sola operación aplicada'
);

-- Un id distinto para el mismo personaje sí entra: son dos acciones.
insert into public.applied_operations (client_op_id, workspace_id, character_id, command_type)
values ('0b000000-0000-4000-8000-000000000002', (select id from ws),
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'ApplyDamage');

select pg_temp.expect(
  (select count(*) = 2 from public.applied_operations
   where character_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  'Dos acciones distintas del mismo tipo NO se confunden entre sí'
);

-- ── 2 · Concurrencia optimista ──────────────────────────────────────────────
--
-- El servidor escribe con `.lt('version', snapshot.version)`. Si no toca
-- ninguna fila, alguien se adelantó y hay que registrar conflicto en vez de
-- pisar los datos (MASTER PROMPT §42).

create temporary table touched (n integer);

-- La tablet venía de la versión 1 y manda la 2: gana.
with upd as (
  update public.characters
  set version = 2, state = '{"name":"Arkan","hp":13}'::jsonb
  where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and version < 2
  returning 1
)
insert into touched select count(*) from upd;

select pg_temp.expect(
  (select n = 1 from touched),
  'Una instantánea más nueva que la del servidor se escribe'
);

delete from touched;

-- El móvil, que estaba desconectado, manda TAMBIÉN la versión 2. Llega tarde.
with upd as (
  update public.characters
  set version = 2, state = '{"name":"Arkan","hp":20}'::jsonb
  where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and version < 2
  returning 1
)
insert into touched select count(*) from upd;

select pg_temp.expect(
  (select n = 0 from touched),
  'Una instantánea de la MISMA versión no pisa: se rechaza y va a conflicto'
);

select pg_temp.expect(
  (select state->>'hp' = '13' from public.characters
   where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  'El estado que sobrevive es el del que llegó primero, no el del último'
);

delete from touched;

-- Y una francamente vieja tampoco.
with upd as (
  update public.characters
  set version = 1, state = '{"name":"Arkan","hp":20}'::jsonb
  where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and version < 1
  returning 1
)
insert into touched select count(*) from upd;

select pg_temp.expect(
  (select n = 0 from touched),
  'Una instantánea vieja tampoco revive un estado ya superado'
);

-- ── 3 · El cursor ───────────────────────────────────────────────────────────
--
-- El disparador `log_character_change` escribe una entrada por cada cambio.
-- El cliente pide `seq > cursor` en orden ascendente.

-- Dos escrituras entraron (el alta y la version 2) y dos se rechazaron. El
-- log tiene DOS entradas: un intento que no toco ninguna fila no dispara el
-- trigger, asi que el cursor no avanza por algo que no paso.
select pg_temp.expect(
  (select count(*) = 2 from public.change_log where workspace_id = (select id from ws)),
  'El change_log registra las escrituras que ocurrieron, y solo esas'
);

select pg_temp.expect(
  (select bool_and(seq > lag_seq)
   from (select seq, lag(seq) over (order by seq) as lag_seq
         from public.change_log where workspace_id = (select id from ws)) t
   where lag_seq is not null),
  'La secuencia es estrictamente creciente'
);

-- Un hueco en la secuencia NO rompe el pull: `seq > cursor` no supone que los
-- números sean contiguos. Se provoca uno consumiendo la secuencia y anulando
-- el insert, que es exactamente lo que deja atrás una transacción abortada.
create temporary table gap as select max(seq) as before from public.change_log;

savepoint antes_del_hueco;
insert into public.change_log (workspace_id, entity_type, entity_id, operation)
values ((select id from ws), 'character', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'upsert');
rollback to savepoint antes_del_hueco;

insert into public.change_log (workspace_id, entity_type, entity_id, operation)
values ((select id from ws), 'character', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'upsert');

select pg_temp.expect(
  (select max(seq) > (select before from gap) + 1 from public.change_log
   where workspace_id = (select id from ws)),
  'Una transacción abortada deja un hueco permanente en la secuencia'
);

select pg_temp.expect(
  (select count(*) = 1 from public.change_log
   where workspace_id = (select id from ws) and seq > (select before from gap)),
  'El pull salta el hueco sin perder ni inventar entradas'
);

-- Borrar un personaje se registra como borrado, no como ausencia: un cliente
-- sin conexión tiene que enterarse de lo que desapareció.
update public.characters set deleted_at = now()
where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

select pg_temp.expect(
  (select operation = 'delete' from public.change_log
   where workspace_id = (select id from ws) order by seq desc limit 1),
  'El borrado suave se propaga como operación "delete", no como silencio'
);

-- ── 4 · El reloj es del servidor ────────────────────────────────────────────
--
-- `touch_updated_at` lo pisa siempre. Un cliente con la hora mal no puede
-- colocarse en el futuro y ganar todas las comparaciones por tiempo.

update public.characters
set updated_at = '2999-01-01T00:00:00Z', version = 3
where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

select pg_temp.expect(
  (select updated_at < now() + interval '1 minute' from public.characters
   where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  'El servidor ignora el updated_at que mande el cliente'
);

-- ── Informe ─────────────────────────────────────────────────────────────────

select
  id,
  case when ok then 'ok' else 'FALLO' end as estado,
  description                             as resultado
from pg_temp.results
order by id;

rollback;
