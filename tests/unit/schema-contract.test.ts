import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * EL CÓDIGO Y EL ESQUEMA TIENEN QUE HABLAR DE LAS MISMAS COLUMNAS
 *
 * Esto existe por un fallo concreto: `workspaceFor` pedía
 * `order('joined_at')` y esa columna se llama `created_at`. PostgREST devolvía
 * «column "joined_at" does not exist», el código descartaba el error, y el
 * resultado en pantalla era que alguien con su cuenta perfectamente creada no
 * podía entrar.
 *
 * Por qué no lo vio nada de lo que había:
 *
 *   - Los 48 casos de base prueban las POLÍTICAS, en SQL. Nunca ejecutan el
 *     TypeScript que arma la consulta.
 *   - Los E2E no inician sesión: sin cuenta, ese camino no se recorre.
 *   - TypeScript no puede ayudar: `order('joined_at')` es una cadena.
 *
 * Así que la costura entre los dos quedaba sin cubrir por construcción, y la
 * única forma de cruzarla es leer los dos lados y compararlos. Sin base de
 * datos: son dos archivos de texto.
 */

const raiz = process.cwd();

// ── Lado del esquema ─────────────────────────────────────────────────────────

/**
 * Columnas de cada tabla, leídas de las migraciones.
 *
 * Se leen TODAS y en orden: una migración posterior puede añadir columnas, y
 * quedarse con la primera daría un esquema viejo.
 */
function columnasDelEsquema(): Map<string, Set<string>> {
  const dir = path.join(raiz, 'supabase', 'migrations');
  const tablas = new Map<string, Set<string>>();

  for (const archivo of fs.readdirSync(dir).sort()) {
    if (!archivo.endsWith('.sql')) continue;
    const sql = fs.readFileSync(path.join(dir, archivo), 'utf8');

    // create table public.x ( ... );
    for (const m of sql.matchAll(/create table (?:if not exists )?public\.(\w+)\s*\(([\s\S]*?)\n\);/g)) {
      const tabla = m[1]!;
      const cuerpo = m[2]!;
      const columnas = tablas.get(tabla) ?? new Set<string>();

      for (const linea of cuerpo.split('\n')) {
        const limpia = linea.trim();
        // Las restricciones no son columnas.
        if (/^(primary key|unique|check|constraint|foreign key)\b/i.test(limpia)) continue;
        const nombre = /^(\w+)\s+\w/.exec(limpia);
        if (nombre) columnas.add(nombre[1]!);
      }
      tablas.set(tabla, columnas);
    }

    // alter table public.x add column y ...
    for (const m of sql.matchAll(
      /alter table public\.(\w+)\s+add column (?:if not exists )?(\w+)/g,
    )) {
      const columnas = tablas.get(m[1]!) ?? new Set<string>();
      columnas.add(m[2]!);
      tablas.set(m[1]!, columnas);
    }
  }

  return tablas;
}

// ── Lado del código ──────────────────────────────────────────────────────────

type Referencia = { archivo: string; tabla: string; columna: string; metodo: string };

function archivosTypeScript(dir: string): string[] {
  const salida: string[] = [];
  for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entrada.name);
    if (entrada.isDirectory()) salida.push(...archivosTypeScript(p));
    else if (entrada.name.endsWith('.ts') || entrada.name.endsWith('.tsx')) salida.push(p);
  }
  return salida;
}

/**
 * Las columnas que el código nombra en cada consulta.
 *
 * El trozo que se mira va desde `.from('tabla')` hasta el punto y coma que
 * cierra la expresión: es donde viven `select`, `eq` y `order` de ESA consulta
 * y de ninguna otra.
 */
function referenciasDelCodigo(): Referencia[] {
  const salida: Referencia[] = [];

  for (const archivo of archivosTypeScript(path.join(raiz, 'src'))) {
    const texto = fs.readFileSync(archivo, 'utf8');

    for (const m of texto.matchAll(/\.from\('(\w+)'\)/g)) {
      const tabla = m[1]!;
      const desde = m.index + m[0].length;
      const fin = texto.indexOf(';', desde);
      const cadena = texto.slice(desde, fin === -1 ? texto.length : fin);

      for (const c of cadena.matchAll(/\.(select|eq|neq|gt|gte|lt|lte|order|in)\('([^']*)'/g)) {
        const metodo = c[1]!;
        for (const bruta of c[2]!.split(',')) {
          const columna = bruta.trim();
          // `*` no nombra nada, y `count` es una agregación de PostgREST.
          if (columna.length === 0 || columna === '*' || columna.startsWith('count')) continue;
          salida.push({ archivo: path.relative(raiz, archivo), tabla, columna, metodo });
        }
      }
    }
  }

  return salida;
}

// ── El contrato ──────────────────────────────────────────────────────────────

describe('El código no puede nombrar columnas que no existen', () => {
  const esquema = columnasDelEsquema();
  const referencias = referenciasDelCodigo();

  it('las migraciones se leen: hay tablas y tienen columnas', () => {
    /*
      Si el analizador dejara de encontrar nada, el test de abajo pasaría
      siempre y en silencio, que es peor que no tenerlo. Se comprueba el
      instrumento antes que la medida.
    */
    expect(esquema.size).toBeGreaterThan(5);
    expect(esquema.get('workspace_members')).toBeDefined();
    expect([...(esquema.get('workspace_members') ?? [])].sort()).toEqual([
      'created_at',
      'role',
      'user_id',
      'workspace_id',
    ]);
  });

  it('el código se lee: hay consultas que nombran columnas', () => {
    expect(referencias.length).toBeGreaterThan(10);
    // La consulta del fallo original, con la columna ya corregida.
    expect(
      referencias.some(
        (r) => r.tabla === 'workspace_members' && r.metodo === 'order' && r.columna === 'created_at',
      ),
    ).toBe(true);
  });

  it('cada columna que el código nombra existe en el esquema', () => {
    const rotas = referencias
      .filter((r) => {
        const columnas = esquema.get(r.tabla);
        // Una tabla que las migraciones no declaran es otro problema, y lo
        // señala el test siguiente. Aquí solo se miran las columnas.
        return columnas !== undefined && !columnas.has(r.columna);
      })
      .map((r) => `${r.archivo}: ${r.tabla}.${r.columna} (en .${r.metodo}())`);

    expect([...new Set(rotas)]).toEqual([]);
  });

  it('cada tabla que el código consulta existe en el esquema', () => {
    const rotas = referencias
      .filter((r) => !esquema.has(r.tabla))
      .map((r) => `${r.archivo}: tabla "${r.tabla}"`);

    expect([...new Set(rotas)]).toEqual([]);
  });
});
