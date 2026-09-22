// ════════════════════════════════════════════════════════════════════════════
// TESTS DE BASE DE DATOS
//
// Ejecuta los archivos de `supabase/tests/` por uno de dos caminos:
//
//   1. Si hay DATABASE_URL —en el entorno o en `.env.local`— corre contra esa
//      instancia con el cliente de Node. Es la de verdad.
//   2. Si no, levanta PostgreSQL EN PROCESO con PGlite —Postgres compilado a
//      WASM, no una imitación— y aplica el mismo esquema y los mismos tests.
//
// El camino 2 no necesita Docker ni instalar nada, y por eso está dentro de
// `npm run verify`: un test de aislamiento que solo corre "cuando alguien monte
// una base de datos" no protege nada.
//
// LO QUE EL CAMINO 2 **NO** PRUEBA: la plataforma de Supabase, ni nada que
// necesite dos conexiones a la vez. Ver el encabezado de
// `supabase/fixtures/00-supabase-platform.sql`.
// ════════════════════════════════════════════════════════════════════════════

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

/**
 * `DATABASE_URL` se lee de `.env.local` SIN pasar por nadie.
 *
 * La cadena de conexión de Postgres lleva la contraseña de la base. Pedirla por
 * pantalla, por chat o por un argumento de la línea de comandos la deja escrita
 * en algún historial para siempre. Acá se pone en `.env.local` —que está en
 * `.gitignore`— y este proceso la levanta solo.
 *
 * Node 20.6+ lo hace nativo con `--env-file`, pero eso obligaría a acordarse de
 * pasar la bandera. Se relanza el proceso con ella una sola vez, y así
 * `npm run test:db` funciona igual con base local o remota.
 */
const ENV_FILE = path.resolve(import.meta.dirname, '..', '.env.local');
if (existsSync(ENV_FILE) && process.env.TAKU_ENV_LOADED !== '1') {
  const relaunch = spawnSync(
    process.execPath,
    [`--env-file=${ENV_FILE}`, import.meta.filename, ...process.argv.slice(2)],
    { stdio: 'inherit', env: { ...process.env, TAKU_ENV_LOADED: '1' } },
  );
  process.exit(relaunch.status ?? 1);
}

const ROOT = path.resolve(import.meta.dirname, '..');
const TESTS = path.join(ROOT, 'supabase/tests');
const MIGRATIONS = path.join(ROOT, 'supabase/migrations');
const PLATFORM = path.join(ROOT, 'supabase/fixtures/00-supabase-platform.sql');

const GREEN = '[32m';
const RED = '[31m';
const BOLD = '[1m';
const DIM = '[2m';
const OFF = '[0m';

const testFiles = readdirSync(TESTS)
  .filter((f) => f.endsWith('.sql'))
  .sort()
  .map((f) => path.join(TESTS, f));

/**
 * Camino 1: una instancia real, con el cliente de Node.
 *
 * Usa `pg` y no `psql`: el cliente viaja en las dependencias de desarrollo,
 * así que funciona en cualquier máquina que pueda hacer `npm install` — el
 * único requisito que el proyecto ya tenía. Depender del binario de Postgres
 * obligaría a instalarlo solo para correr unos tests.
 *
 * NO aplica las migraciones: contra una instancia real, el esquema lo pone el
 * despliegue. Los tests comprueban lo que hay, y si falta algo lo dicen.
 */
async function runAgainstRealDatabase(url) {
  const { default: pg } = await import('pg');

  const client = new pg.Client({
    connectionString: url,
    // Supabase termina TLS en el pooler con un certificado propio. Verificarlo
    // requeriría distribuir su CA; para correr tests contra tu propia base, la
    // conexión cifrada sin validar la cadena es el compromiso razonable.
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  const version = (await client.query('select version()')).rows[0].version;
  console.log(`\n${DIM}${String(version).split(' on ')[0]} — instancia remota${OFF}`);

  let total = 0;
  let failures = 0;

  for (const file of testFiles) {
    console.log(`\n${BOLD}${path.basename(file)}${OFF}`);
    let batches;
    try {
      batches = await client.query(readFileSync(file, 'utf8'));
    } catch (error) {
      console.error(`  ${RED}${error.message}${OFF}`);
      // Un `rollback` de rescate: el archivo abre transacción y si murió a
      // mitad la deja abierta, y el archivo siguiente fallaría por eso.
      await client.query('rollback').catch(() => {});
      failures += 1;
      continue;
    }

    const results = Array.isArray(batches) ? batches : [batches];
    const report = results.filter((r) => r.fields?.some((f) => f.name === 'resultado')).pop();
    if (!report) {
      console.error(`  ${RED}El archivo corrió pero no produjo informe.${OFF}`);
      failures += 1;
      continue;
    }

    for (const row of report.rows) {
      const mark = row.estado === 'ok' ? `${GREEN}ok${OFF}  ` : `${RED}FALLO${OFF}`;
      console.log(`  ${mark} ${row.resultado}`);
    }
    total += report.rows.length;
    failures += report.rows.filter((r) => r.estado !== 'ok').length;
  }

  await client.end();

  console.log();
  if (failures > 0) {
    console.log(`${RED}${failures} caso(s) fallaron de ${total}.${OFF}`);
    process.exit(1);
  }
  console.log(`${GREEN}Instancia remota: ${total} casos en ${testFiles.length} archivos, todos pasaron.${OFF}`);
  process.exit(0);
}

/** Una base limpia por archivo: un test no puede depender de lo que dejó otro. */
async function freshDatabase(PGlite, pgcrypto, { quiet }) {
  const db = await PGlite.create({ extensions: { pgcrypto } });
  await db.exec(readFileSync(PLATFORM, 'utf8'));
  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()) {
    await db.exec(readFileSync(path.join(MIGRATIONS, file), 'utf8'));
    if (!quiet) console.log(`${DIM}  aplicada ${file}${OFF}`);
  }
  return db;
}

/**
 * Camino 2: Postgres en proceso, UN ARCHIVO.
 *
 * Se ejecuta en su propio proceso a propósito. Crear y cerrar varias
 * instancias de PGlite en el mismo proceso hace saltar una aserción de libuv
 * en Windows al terminar, y da igual lo que hayan dicho los tests: el proceso
 * se cae con código 127 y la tanda parece rota cuando no lo está.
 */
async function runOneFile(file) {
  const { PGlite } = await import('@electric-sql/pglite');
  // La migración hace `create extension pgcrypto`. PGlite lo trae como contrib
  // pero hay que cargarlo explícitamente; sin esto la migración no corre.
  const { pgcrypto } = await import('@electric-sql/pglite/contrib/pgcrypto');

  const db = await freshDatabase(PGlite, pgcrypto, { quiet: process.env.TAKU_DB_QUIET === '1' });

  let batches;
  try {
    batches = await db.exec(readFileSync(file, 'utf8'));
  } catch (error) {
    // El propio SQL corta en el primer fallo con `raise exception`.
    console.error(`  ${RED}${error.message}${OFF}`);
    await db.close();
    process.exit(1);
  }

  const report = batches.filter((b) => b.fields?.some((f) => f.name === 'resultado')).pop();
  if (!report) {
    console.error(`  ${RED}El archivo corrió pero no produjo informe.${OFF}`);
    await db.close();
    process.exit(1);
  }

  for (const row of report.rows) {
    const mark = row.estado === 'ok' ? `${GREEN}ok${OFF}  ` : `${RED}FALLO${OFF}`;
    console.log(`  ${mark} ${row.resultado}`);
  }
  const failed = report.rows.filter((r) => r.estado !== 'ok').length;
  // La última línea la lee el proceso padre para sumar.
  console.log(`__TAKU__ ${report.rows.length} ${failed}`);
  await db.close();
  process.exit(failed > 0 ? 1 : 0);
}

/** Camino 2: Postgres en proceso, la tanda entera. */
function runInProcess() {
  let total = 0;
  let failures = 0;

  for (const [index, file] of testFiles.entries()) {
    console.log(`\n${BOLD}${path.basename(file)}${OFF}`);
    const r = spawnSync(process.execPath, [import.meta.filename, file], {
      encoding: 'utf8',
      env: { ...process.env, TAKU_DB_QUIET: index > 0 ? '1' : '0' },
    });

    const lines = (r.stdout ?? '').split('\n');
    const tally = lines.find((l) => l.startsWith('__TAKU__'));
    for (const line of lines) {
      if (line.startsWith('__TAKU__') || line.trim() === '') continue;
      console.log(line);
    }
    if (r.stderr) process.stderr.write(r.stderr);

    if (tally) {
      const [, count, failed] = tally.split(' ');
      total += Number(count);
      failures += Number(failed);
    } else {
      failures += 1;
    }
  }

  console.log();
  if (failures > 0) {
    console.log(`${RED}${failures} caso(s) fallaron de ${total}.${OFF}`);
    process.exit(1);
  }
  console.log(`${GREEN}Base de datos: ${total} casos en ${testFiles.length} archivos, todos pasaron.${OFF}`);
}

/**
 * La instancia remota SOLO con `--remote`, nunca por tener DATABASE_URL.
 *
 * `npm run verify` tiene que ser rápido, offline y determinista. Si bastara
 * con que la variable existiera, cualquiera con un `.env.local` pasaría a
 * depender de la red para verificar un cambio de tipos. Y los proyectos
 * gratuitos de Supabase se pausan solos tras unos días sin uso, así que la
 * verificación empezaría a fallar por algo que no tiene que ver con el código.
 */
const remote = process.argv.includes('--remote');
const url = remote ? process.env.DATABASE_URL : null;
const singleFile = process.argv.find((a) => a.endsWith('.sql'));

if (remote && !url) {
  console.error(
    'Pediste --remote pero no hay DATABASE_URL.\n' +
      'Ponela en .env.local (Supabase: Connect → Session pooler).',
  );
  process.exit(1);
}

if (singleFile) await runOneFile(singleFile);
else if (url) await runAgainstRealDatabase(url);
else runInProcess();
