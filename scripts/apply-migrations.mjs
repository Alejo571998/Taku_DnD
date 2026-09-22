// ════════════════════════════════════════════════════════════════════════════
// APLICAR MIGRACIONES A UNA INSTANCIA REAL
//
// MASTER PROMPT §78: "Nunca modificar producción manualmente sin migración
// reproducible." Este script ES esa reproducibilidad.
//
// Lo que hace, y por qué cada parte:
//
//   · Lleva la cuenta en `public.schema_migrations`. Correrlo dos veces no
//     vuelve a aplicar nada: sin registro, la segunda vez explota a mitad y
//     deja la base en un estado que nadie sabe describir.
//
//   · Guarda un CHECKSUM de cada archivo aplicado. Si alguien edita una
//     migración que ya corrió, el script lo grita en vez de callarse. Ese es
//     el error que rompe entornos: el archivo dice una cosa y la base tiene
//     otra, y nadie se enteró.
//
//   · Cada migración va en su propia transacción. Si la 0003 falla, la 0001 y
//     la 0002 quedan aplicadas y registradas, y se puede arreglar la 0003 y
//     volver a correr.
//
// La credencial NUNCA pasa por acá: `DATABASE_URL` se lee de `.env.local`, que
// está en `.gitignore`. No se imprime, ni se pasa por argumento, ni queda en
// el historial del shell.
//
//   npm run db:migrate            # aplica lo que falte
//   npm run db:migrate -- --dry   # dice qué haría, sin tocar nada
// ════════════════════════════════════════════════════════════════════════════

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const ENV_FILE = path.resolve(import.meta.dirname, '..', '.env.local');
if (existsSync(ENV_FILE) && process.env.TAKU_ENV_LOADED !== '1') {
  const relaunch = spawnSync(
    process.execPath,
    [`--env-file=${ENV_FILE}`, import.meta.filename, ...process.argv.slice(2)],
    { stdio: 'inherit', env: { ...process.env, TAKU_ENV_LOADED: '1' } },
  );
  process.exit(relaunch.status ?? 1);
}

const MIGRATIONS = path.resolve(import.meta.dirname, '..', 'supabase/migrations');
const DRY = process.argv.includes('--dry');

const GREEN = '[32m';
const RED = '[31m';
const YELLOW = '[33m';
const BOLD = '[1m';
const DIM = '[2m';
const OFF = '[0m';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error(
    `${RED}Falta DATABASE_URL.${OFF}\n\n` +
      'Ponela en .env.local (ese archivo no se sube al repositorio):\n\n' +
      '  DATABASE_URL=postgresql://postgres:TU-PASSWORD@db.TU-REF.supabase.co:5432/postgres\n\n' +
      'En Supabase: Project Settings → Database → Connection string → URI.\n' +
      'Si la contraseña tiene caracteres raros, hay que escaparlos para URL.',
  );
  process.exit(1);
}

const { default: pg } = await import('pg');
const client = new pg.Client({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
});

try {
  await client.connect();
} catch (error) {
  // El mensaje crudo de `pg` no dice qué hacer. Estos tres son el 90% de los
  // fallos reales al conectar por primera vez.
  const hint = /password authentication/i.test(error.message)
    ? 'La contraseña no coincide. Se puede regenerar en Database → Reset database password.'
    : /getaddrinfo|ENOTFOUND/i.test(error.message)
      ? 'El host no existe. Revisá la referencia del proyecto en la cadena.'
      : /timeout|ETIMEDOUT/i.test(error.message)
        ? 'Sin respuesta. Si el proyecto está pausado, hay que reactivarlo desde el panel.'
        : '';
  console.error(`${RED}No se pudo conectar:${OFF} ${error.message}${hint ? `\n\n${hint}` : ''}`);
  process.exit(1);
}

const { rows: whoami } = await client.query(
  'select current_database() as db, version() as version',
);
console.log(
  `\n${DIM}${String(whoami[0].version).split(' on ')[0]} · base "${whoami[0].db}"${OFF}`,
);

await client.query(`
  create table if not exists public.schema_migrations (
    name       text primary key,
    checksum   text not null,
    applied_at timestamptz not null default now()
  )
`);

// La tabla vive en `public`, y en Supabase eso significa que PostgREST la
// publica y que los permisos por defecto la dejan abierta: al crearla, `anon`
// heredó SELECT, INSERT, UPDATE, DELETE y TRUNCATE. O sea que con la clave
// pública —que está en el navegador de cualquiera— se podía borrar el registro
// de migraciones.
//
// No filtra datos de usuario, pero deja el estado del esquema en manos ajenas y
// revela qué migraciones existen. Se cierra acá y no en una migración porque
// esta tabla es del ejecutor, no del esquema de la aplicación: así queda bien
// aunque alguien aplique las migraciones por otro camino.
//
// `postgres` tiene BYPASSRLS, por eso este mismo script sigue funcionando.
await client.query(`
  revoke all on public.schema_migrations from anon, authenticated;
  alter table public.schema_migrations enable row level security;
`);

const { rows: applied } = await client.query('select name, checksum from public.schema_migrations');
const appliedByName = new Map(applied.map((r) => [r.name, r.checksum]));

const files = readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort();
let ran = 0;
let drifted = 0;

console.log();
for (const name of files) {
  const sql = readFileSync(path.join(MIGRATIONS, name), 'utf8');
  const checksum = createHash('sha256').update(sql).digest('hex').slice(0, 16);
  const previous = appliedByName.get(name);

  if (previous === checksum) {
    console.log(`  ${DIM}ya estaba${OFF}  ${name}`);
    continue;
  }

  if (previous && previous !== checksum) {
    // NO se vuelve a aplicar: el archivo cambió después de correr, así que la
    // base no contiene lo que el archivo dice. Reaplicarlo a ciegas puede
    // romper más de lo que arregla. Hace falta una migración nueva.
    console.log(
      `  ${YELLOW}CAMBIÓ${OFF}     ${name}\n` +
        `             ${DIM}Se aplicó con otro contenido (${previous} → ${checksum}).${OFF}\n` +
        `             ${DIM}Lo correcto es una migración NUEVA, no editar esta.${OFF}`,
    );
    drifted++;
    continue;
  }

  if (DRY) {
    console.log(`  ${YELLOW}aplicaría${OFF}  ${name}`);
    ran++;
    continue;
  }

  try {
    await client.query('begin');
    await client.query(sql);
    await client.query(
      'insert into public.schema_migrations (name, checksum) values ($1, $2)',
      [name, checksum],
    );
    await client.query('commit');
    console.log(`  ${GREEN}aplicada${OFF}   ${name}`);
    ran++;
  } catch (error) {
    await client.query('rollback').catch(() => {});
    console.error(`  ${RED}FALLÓ${OFF}      ${name}\n             ${error.message}`);
    await client.end();
    process.exit(1);
  }
}

console.log();
if (drifted > 0) {
  console.log(
    `${YELLOW}${drifted} migración(es) cambiaron después de aplicarse. La base y el` +
      ` repositorio no dicen lo mismo.${OFF}`,
  );
}
console.log(
  ran === 0 && drifted === 0
    ? `${GREEN}${BOLD}Nada que aplicar: la base está al día.${OFF}`
    : `${GREEN}${BOLD}${ran} migración(es) ${DRY ? 'por aplicar' : 'aplicadas'}.${OFF}`,
);

await client.end();
process.exit(drifted > 0 ? 1 : 0);
