/**
 * ¿POR QUÉ UN USUARIO RECIÉN CREADO NO PUEDE ENTRAR?
 *
 * Iniciar sesión tiene dos pasos: Supabase valida la contraseña, y después la
 * aplicación busca el workspace personal del usuario. Si el segundo falla, la
 * sesión no se arma y la pantalla dice «algo falló». Esto mira cuál de los dos
 * está roto, sin tocar nada.
 *
 * SOLO LEE. No inserta, no borra, no arregla.
 *
 * La credencial nunca pasa por acá: `DATABASE_URL` se lee de `.env.local`, que
 * está en `.gitignore`, igual que en el resto de los scripts.
 */

import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const ENV_FILE = path.resolve(import.meta.dirname, '..', '.env.local');
if (existsSync(ENV_FILE) && process.env.TAKU_ENV_LOADED !== '1') {
  const r = spawnSync(
    process.execPath,
    [`--env-file=${ENV_FILE}`, import.meta.filename, ...process.argv.slice(2)],
    { stdio: 'inherit', env: { ...process.env, TAKU_ENV_LOADED: '1' } },
  );
  process.exit(r.status ?? 1);
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('Falta DATABASE_URL en .env.local');
  process.exit(1);
}

const { default: pg } = await import('pg');
const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await client.connect();

const uno = async (sql) => (await client.query(sql)).rows[0];

// 1 · ¿Existe el disparador que crea el workspace al darse de alta?
const disparador = await uno(`
  select count(*)::int as n
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
  where t.tgname = 'on_auth_user_created'
    and n.nspname = 'auth' and c.relname = 'users'
`);

// 2 · ¿Y la función que ejecuta?
const funcion = await uno(`
  select count(*)::int as n
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'handle_new_user'
`);

// 3 · Cuentas, workspaces y membresías. Sin correos ni nada personal.
const usuarios = await uno('select count(*)::int as n from auth.users');
const confirmados = await uno(
  'select count(*)::int as n from auth.users where email_confirmed_at is not null',
);
const workspaces = await uno('select count(*)::int as n from public.workspaces');
const miembros = await uno('select count(*)::int as n from public.workspace_members');

// 4 · Usuarios SIN workspace: el síntoma exacto de «sin workspace asignado».
const huerfanos = await uno(`
  select count(*)::int as n
  from auth.users u
  where not exists (
    select 1 from public.workspace_members m where m.user_id = u.id
  )
`);

// 5 · ¿Hace falta confirmar el correo para entrar?
let confirmacion = 'no se pudo leer';
try {
  const r = await uno(`select count(*)::int as n from auth.users where email_confirmed_at is null`);
  confirmacion = r.n === 0 ? 'todas las cuentas están confirmadas' : `${r.n} sin confirmar`;
} catch {
  /* la tabla puede no ser legible según el rol */
}

console.log('');
console.log('  disparador on_auth_user_created  ', disparador.n === 1 ? 'SÍ existe' : '❌ NO EXISTE');
console.log('  función handle_new_user          ', funcion.n === 1 ? 'SÍ existe' : '❌ NO EXISTE');
console.log('');
console.log('  usuarios en auth.users           ', usuarios.n);
console.log('  con el correo confirmado         ', confirmados.n, `(${confirmacion})`);
console.log('  workspaces                       ', workspaces.n);
console.log('  filas en workspace_members       ', miembros.n);
console.log('');
console.log(
  '  usuarios SIN workspace           ',
  huerfanos.n,
  huerfanos.n > 0 ? '← ESTE es el que no puede entrar' : '',
);
console.log('');


/*
  6 · La consulta EXACTA que hace el navegador, con RLS puesto como el usuario.

  Es la única forma de distinguir «la fila no está» de «la fila está y la
  política no deja verla». Con el rol de servicio todo se ve, y por eso los
  contadores de arriba salían bien.
*/
const {
  rows: [u],
} = await client.query('select id from auth.users order by created_at limit 1');

console.log('  -- la consulta del navegador, con RLS como ese usuario --');
try {
  await client.query('begin');
  await client.query('set local role authenticated');
  await client.query(
    "select set_config('request.jwt.claims', json_build_object('sub', $1::text, 'role', 'authenticated')::text, true)",
    [u.id],
  );
  const r = await client.query(
    'select workspace_id from public.workspace_members where user_id = auth.uid() order by created_at limit 1',
  );
  console.log(
    '  filas devueltas                  ',
    r.rowCount,
    r.rowCount > 0 ? 'OK' : '❌ VACÍO — éste es el fallo',
  );
  await client.query('rollback');
} catch (e) {
  await client.query('rollback').catch(() => {});
  console.log('  ❌ la consulta LANZA:', e.message);
}
console.log('');

await client.end();
