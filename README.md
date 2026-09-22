# TAKU D&D

**Tu compañero de aventura.** Creá, gestioná y jugá tus personajes de Dungeons & Dragons.
Reglas 2014 y 2024, subida de nivel, inventario, hechizos, dados, contenido propio y
campañas. Funciona sin conexión, y sin cuenta.

---

## Arrancar

```bash
npm install
npm run build:content   # genera los packs del SRD desde data/srd-raw/
npm run build:taku      # genera favicons e iconos desde el retrato de Taku
npm run dev
```

Abrí <http://localhost:3000>. La primera carga vuelca ~3.000 definiciones del SRD a
IndexedDB; a partir de ahí todo funciona sin conexión.

## Verificar

```bash
npm run verify          # typecheck + lint + 264 tests + 48 casos de base de datos
npx playwright test     # 112 tests E2E (móvil y escritorio)
npm run test:db         # Postgres en proceso; con DATABASE_URL, contra una instancia real
```

Los tests E2E corren contra el servidor de `npm run dev`. Para una tanda estable,
apuntalos al build de producción:

```bash
npm run build && npx next start -p 3100
PLAYWRIGHT_BASE_URL=http://localhost:3100 npx playwright test
```

---

## Cómo está organizado

```
UI  ──►  APPLICATION  ──►  DOMAIN  ◄──  INFRASTRUCTURE
```

Las dependencias apuntan **siempre hacia adentro**, y eso lo impone ESLint en CI, no la
disciplina: `src/domain/` no puede importar React, Next, Dexie ni Supabase.

| Carpeta | Qué vive ahí |
|---|---|
| `src/domain/` | Reglas de D&D. TypeScript puro, sin E/S. Es el corazón del producto |
| `src/application/` | Casos de uso: comandos, consultas, puertos, sincronización |
| `src/infrastructure/` | Dexie, Supabase, HTTP. Implementa los puertos |
| `src/ui/` | React. Consume casos de uso; nunca calcula una regla |
| `src/content/`, `public/content/` | Packs del SRD ya normalizados |
| `supabase/migrations/` | Esquema Postgres con RLS, versionado |
| `supabase/tests/` | Aislamiento entre inquilinos y contrato de sincronización, en SQL que se ejecuta |
| `supabase/fixtures/` | Lo que Supabase ya trae puesto, para poder correr los tests sin Supabase |
| `data/translations/` | Traducción del SRD al español, escrita a mano |
| `docs/` | Audit de arquitectura y plan de implementación |

### Las tres decisiones que sostienen todo lo demás

**1 · El estado es la fuente; la ficha es una proyección.**
Se guarda `CharacterState`; la `CharacterSheet` se recalcula siempre. Es imposible que un
derivado se desincronice porque no existe almacenado.

**2 · Todo valor derivado trae su procedencia.**
`Computed<T>` transporta sus `contributions`, así que la interfaz puede explicar cualquier
número sin implementar una sola regla:

> **CA 18** · Cota de malla 16 · Escudo +2

**3 · Las mutaciones de juego son deltas conmutativos.**
Guardar «HP = 23» genera conflictos entre dispositivos; guardar «HP −7» no. Sumado a la
idempotencia por `clientOpId`, eso hace viable el offline multi-dispositivo sin CRDTs.

Lo que hacen estas tres juntas se ve mejor en la **subida de nivel**: el módulo que la
implementa no calcula ni un solo valor derivado. Cambia `classes[i].level` y el motor
deduce puntos de golpe, competencia, espacios de conjuro, recursos y rasgos. Si el nivel
se guardara junto a sus derivados —como hace casi toda ficha digital— esa misma función
tendría que recalcular y reescribir doce campos, y cada regla nueva abriría una vía de
desincronía.

---

## Qué hace, concretamente

| | |
|---|---|
| **Crear y jugar** | Asistente paso a paso; Modo Juego (velocidad) y Modo Gestión (profundidad) |
| **Subir de nivel** | PG por promedio, tirada o manual · subclase · mejora de característica o dote · conjuros nuevos · multiclase con requisitos reales |
| **Biblioteca** | 3.039 definiciones del SRD 5.1 y 5.2, buscables sin conexión |
| **Contenido propio** | Editor sin escribir JSON: objetos, conjuros, dotes, trasfondos, especies con sus rasgos, y clases enteras con progresión 1–20, subclases y equipo inicial |
| **Campañas** | Mesas con sus personajes, edición fijada y registro de sesiones |
| **Cuenta** | Opcional. Sirve para una cosa: los mismos personajes en varios dispositivos |
| **Sincronización** | Automática, con resolución de conflictos que el usuario decide |
| **Idioma** | Interfaz en español y en inglés; el SRD entero traducido: 2.241 nombres y 2.127 textos, 261.455 palabras —prosa, bloques de estadísticas y materiales de conjuro—, con la cobertura a la vista |

### Lo que todavía NO hace

- Las **filas que el volcado del SRD 5.2 no trae siguen sin estar**. La Baraja
  misteriosa tiene 11 resultados de 22 y la Varita de las maravillas 9 de 20,
  porque el volcado de la API pública de 5e los perdió. Lo que sí estaba se
  rearmó; lo que no, se deja faltando a propósito: un hueco se ve y una fila
  inventada no.
- La **sincronización con dos dispositivos a la vez** no se ha ejercitado. Lo que sí
  corre contra una instancia real de Supabase son los 48 casos del contrato del
  servidor —aislamiento entre inquilinos, idempotencia, concurrencia optimista y
  cursor— con `npm run test:db:remote`.
- Nadie ha usado la aplicación con un **lector de pantalla** real. axe-core no
  encuentra ni una infracción de WCAG AA en las seis pantallas y en los dos temas,
  pero eso mide la estructura, no si se entiende escuchándola. Y hay algo
  concreto que ya se sabe: los títulos de los paneles del modo Juego son
  `span`, no encabezados, así que la pantalla no se puede recorrer saltando de
  título en título.
- La ficha sigue **la hoja oficial de 2024**, no la de 2014. El bloque de
  inspiración heroica solo se pinta con reglas de 2024, porque la inspiración
  de 2014 es otra regla; mezclarlas sería inventar una tercera.
- El **presupuesto de rendimiento** está medido con la CPU estrangulada a un cuarto,
  no en un teléfono físico.

---

## Contenido y licencias

Esta aplicación incluye material del **System Reference Document 5.1** y del **System
Reference Document 5.2** de Wizards of the Coast LLC, disponibles bajo la licencia
[Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/legalcode).

Los datos normalizados provienen del proyecto [5e-bits/5e-database](https://github.com/5e-bits/5e-database) (MIT).

**TAKU D&D no está afiliada ni respaldada por Wizards of the Coast.** El contenido comercial
de D&D que no forma parte del SRD **no se distribuye** con la aplicación. Podés crearlo como
Homebrew o importarlo si tenés derecho a usarlo.

---

## Stack

| | |
|---|---|
| Next.js 16.3.5 · React 19.3 | App Router, webpack |
| TypeScript 6.0.3 | Fijado: `typescript-eslint` aún no soporta TS 7 |
| Tailwind CSS 4.3 | Tokens semánticos en CSS, sin configuración JS |
| Dexie 4.4 | IndexedDB. **Es** la caché de lectura de la aplicación |
| Zod 4.6 | Validación en toda frontera de confianza |
| Serwist 9.5 | Service worker |
| Supabase | Postgres, Auth, RLS |
| Vitest 5 · Playwright 1.63 | Unitarios, integración y E2E |

---

## Seguridad y privacidad

- Cabeceras en `src/middleware.ts`: CSP, HSTS, `frame-ancestors none`, Permissions-Policy.
  El compromiso sobre `script-src` está explicado en el propio archivo, no escondido.
- **Sin telemetría.** Lo que falla se anota en el dispositivo; el informe lo exporta el
  usuario, y va saneado de correos, identificadores y tokens.
- La clave de servicio de Supabase **lanza** si se invoca en el navegador: un error
  ruidoso es mejor que una filtración silenciosa.
- El **aislamiento entre inquilinos se ejecuta**, no se argumenta: 35 casos de ataque
  contra PostgreSQL de verdad en cada `npm run verify`, sin instalar nada. La primera
  vez que se corrieron encontraron una recursión que rompía las campañas enteras.
- Un paquete importado es dato no confiable: atraviesa Zod entero y sus ids se reescriben
  al espacio del usuario, así que no puede suplantar al SRD.

---

## Documentación

- [`docs/00-ARCHITECTURE-AUDIT.md`](docs/00-ARCHITECTURE-AUDIT.md) — riesgos, contradicciones, decisiones, y cinco adendas con lo que se aprendió implementando
- [`docs/01-IMPLEMENTATION-PLAN.md`](docs/01-IMPLEMENTATION-PLAN.md) — estado fase por fase, deuda técnica numerada y métricas
- [`docs/captures/`](docs/captures/) — 48 capturas del producto, móvil y escritorio
