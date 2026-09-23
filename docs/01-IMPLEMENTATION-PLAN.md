# D&D COMPANION — PLAN DE IMPLEMENTACIÓN
**Estado por fase, criterios de aceptación y deuda técnica**

| | |
|---|---|
| Documento | `docs/01-IMPLEMENTATION-PLAN.md` |
| Precede | `docs/00-ARCHITECTURE-AUDIT.md` |
| Estado | Fases 1–15 implementadas · pendientes acotadas y listadas |
| Última actualización | 2026-09-21 |

---

## 0. Cómo leer este documento

Cada fase declara: **objetivo**, **archivos**, **cambios de base de datos**, **tests** y
**criterios de aceptación**. Las fases marcadas ✅ están implementadas y verificadas; las
marcadas ⬜ no se han empezado.

Una fase solo se marca ✅ cuando cumple la Definición de Done (MASTER SPEC §66): funciona,
persiste, respeta reglas, es responsive, maneja errores, tiene estados de carga/vacío/error,
tiene tests y no rompe lo anterior.

**Verificación actual del repositorio:**

```
npm run verify      → typecheck ✓ · lint ✓ (0 errores) · 307 tests ✓ · 48 casos de BD ✓
npm run build       → 27 rutas + middleware, compila ✓
npx playwright test → 138 tests E2E ✓ (69 móvil + 69 escritorio) — contra el BUILD, ver abajo
npm run test:db     → Postgres en proceso (rápido, sin red)
npm run test:db:remote → los mismos 48 casos contra la instancia real
npm run db:migrate  → aplica las migraciones que falten, con registro y checksum
```

Los E2E se corren contra el BUILD, no contra `next dev`. No es solo por los
tests de rendimiento —medir `next dev` no significa nada—: contra el servidor de
desarrollo la suite entera es inestable, porque cada primera visita a una ruta
dispara una compilación y 138 tests en dos proyectos compiten por un solo
servidor. Tres corridas dieron tres conjuntos de fallos distintos, todos
timeouts. Contra el build: 112 de 112 en 9,6 minutos (ver ADENDA VI · D-71).

```
npm run build && npx next start -p 3100
PLAYWRIGHT_BASE_URL=http://localhost:3100 npx playwright test
```

---

## HITO 1 — `Vertical Slice v0.1`

> Objetivo: **un jugador usa un personaje real en una partida real**, sin cuenta y sin nube.

### ✅ FASE 1 — Fundación

**Objetivo.** Proyecto que arranca, se instala como PWA y tiene las fronteras de capa
impuestas por herramienta.

**Archivos.** `package.json` · `tsconfig.json` · `eslint.config.mjs` · `next.config.ts` ·
`postcss.config.mjs` · `vitest.config.mts` · `playwright.config.ts` · `src/app/globals.css` ·
`src/app/layout.tsx` · `src/ui/design-system/*` · `public/manifest.webmanifest` ·
`src/app/sw.ts` · `scripts/build-taku-assets.mjs`

**Base de datos.** Ninguna.

**Tests.** Typecheck y lint en CI.

**Aceptación.**
- [x] `npm run verify` pasa en limpio
- [x] ESLint bloquea imports que crucen fronteras de capa
- [x] Manifest, service worker e iconos generados desde una sola fuente (`build-taku-assets.mjs`)
- [x] Design system con tokens semánticos, modo claro y oscuro, y foco visible

**Decisiones tomadas en esta fase.**
- TypeScript fijado en **6.0.3**, no 7.0.2: `typescript-eslint@8` declara `<6.1.0` (D-03)
- ESLint fijado en **9.39.5**, no 10: `eslint-plugin-react` usa APIs eliminadas en 10
- Build con **webpack**, no Turbopack: `@serwist/next@9` aún no lo soporta
- `.npmrc` con `script-shell=bash`: el `&` de la carpeta rompe `npm run` en cmd.exe

---

### ✅ FASE 2 — Sistema de contenido

**Objetivo.** SRD 5.1 y 5.2 completos, normalizados, servidos como datos y cacheados offline.

**Archivos.** `src/domain/content/schemas.ts` · `src/domain/content/index.ts` ·
`scripts/build-content.mjs` · `src/infrastructure/content/loader.ts` ·
`public/content/srd-2014/*` · `public/content/srd-2024/*`

**Base de datos.** Tablas Dexie `definitions` y `packs`.

**Tests.** `tests/unit/critical-cases.test.ts` (casos 13 y 14) contra el contenido real.

**Aceptación.**
- [x] **3.039 definiciones** cargadas (1.824 de 2014 + 1.215 de 2024)
- [x] Atribución CC-BY-4.0 visible en la aplicación, no solo en el repositorio
- [x] El contenido NO va en el bundle de JS: se sirve como datos y lo precachea el SW
- [x] Ninguna consulta mezcla ediciones

| Tipo | 2014 | 2024 |
|---|---|---|
| Conjuros | 319 | 339 |
| Objetos mágicos | 362 | 262 |
| Rasgos de clase | 407 | 232 |
| Monstruos | 334 | 3 |
| Equipo | 187 | 131 |
| Armas / Armaduras | 37 / 13 | 38 / 13 |
| Clases / Subclases | 12 / 12 | 12 / 12 |
| Especies / Linajes | 9 / 4 | 9 / 24 |

---

### ✅ FASE 3 — Dominio: reglas y personaje

**Objetivo.** Motor de reglas declarativo y motor de personaje puro, con trazabilidad.

**Archivos.** `src/domain/shared/*` · `src/domain/rules/*` · `src/domain/character/*` ·
`src/domain/dice/*` · `src/domain/currency/*` · `src/domain/inventory/*` ·
`src/domain/spells/*` · `src/domain/resources/*`

**Tests.** 53 tests unitarios cubriendo los 15 casos críticos del MASTER PROMPT §59.

**Aceptación.**
- [x] `domain/` no importa React, Next, Dexie ni Supabase (impuesto por lint)
- [x] Todo derivado devuelve `Computed<T>` con sus `contributions`
- [x] Ventaja/desventaja en canal aparte, no como número
- [x] Vocabulario cerrado de efectos: el Homebrew compone, no ejecuta

---

### ✅ FASE 4 — Persistencia local y comandos

**Objetivo.** Todo cambio es un comando con Deshacer, persistido en IndexedDB.

**Archivos.** `src/infrastructure/local/db.ts` · `src/infrastructure/local/repositories.ts` ·
`src/application/commands/*` · `src/application/ports/repositories.ts` ·
`src/application/services/character-service.ts`

**Base de datos.** Dexie v1: `characters`, `definitions`, `packs`, `outbox`, `history`,
`rolls`, `meta`, `homebrewRules`.

**Tests.** `tests/integration/sync.test.ts` — historial, Deshacer, persistencia, tombstones.

**Aceptación.**
- [x] 40 tipos de comando, clasificados por estrategia de conflicto
- [x] Deshacer ejecuta el comando INVERSO y se encola como cualquier otro
- [x] Borrado lógico (tombstone), nunca físico
- [x] `navigator.storage.persist()` solicitado al arrancar

---

### ✅ FASE 5 — Creador de personaje

**Objetivo.** Asistente guiado con validación en tiempo real y explicaciones.

**Archivos.** `src/app/(app)/characters/new/page.tsx` · `src/ui/features/creator/steps.tsx` ·
`src/application/services/character-factory.ts`

**Tests.** E2E `crear un guerrero enano paso a paso`.

**Aceptación.**
- [x] 14 pasos, con los no aplicables omitidos automáticamente
- [x] Validación por paso con explicación de qué falta
- [x] Standard Array, Point Buy, tirada 4d6kh3 y manual
- [x] Previsualización con el personaje REAL resuelto, no una estimación

---

### ✅ FASE 6 — Ficha inteligente

**Objetivo.** Modo Gestión con todas las estadísticas y su procedencia.

**Archivos.** `src/app/(app)/characters/[id]/manage/**`

**Aceptación.**
- [x] Características, salvaciones, 18 habilidades, percepción pasiva
- [x] Rasgos agrupados por origen (clase, subclase, especie, trasfondo, dote)
- [x] Panel de avisos: lo que 5e penaliza se advierte, no se bloquea

---

### ✅ FASE 7 — Inventario, equipo y dinero

**Archivos.** `manage/inventory` · `manage/equipment` · `manage/money`

**Aceptación.**
- [x] Peso en centésimas de libra (entero), capacidad derivada de FUE × 15
- [x] Conflictos de equipamiento detectados y explicados
- [x] Cinco denominaciones independientes; conversión explícita y confirmada
- [x] Munición vinculada arma → tipo, con consumo configurable

---

### ✅ FASE 8 — Conjuros, recursos y condiciones

**Archivos.** `manage/spells` · `manage/conditions` · paneles de Modo Juego

**Aceptación.**
- [x] Conocidos / preparados / favoritos, con límite por clase
- [x] Espacios de conjuro derivados de la progresión; tabla multiclase incluida
- [x] Recursos genéricos `current/maximum` con recuperación por descanso
- [x] Descanso corto y largo (resuelve el GAP G6 del audit)

---

### ✅ FASE 9 — Dados y Modo Juego

**Archivos.** `src/ui/features/dice/DiceRoller.tsx` · `characters/[id]/play` ·
`src/ui/features/play/HitPointsPanel.tsx`

**Aceptación.**
- [x] RNG criptográfico; parser propio con `kh`/`kl`, ventaja y desventaja
- [x] Daño crítico duplica DADOS, no el total
- [x] Daño y curación a un toque, con Deshacer
- [x] Historial de tiradas persistido

**🏁 Fin del Hito 1.** La aplicación se puede usar en una mesa.

---

## HITO 2 — MVP completo

### ✅ FASE 10 — Autenticación y base remota

**Objetivo.** Tener cuenta es OPCIONAL y sirve para una sola cosa: los mismos
personajes en varios dispositivos (MASTER SPEC §40).

**Archivos.** `src/application/auth/gateway.ts` · `src/application/auth/migration.ts` ·
`src/infrastructure/remote/auth.ts` · `src/infrastructure/composition.ts` ·
`src/ui/components/SessionProvider.tsx` · `src/app/(auth)/auth/*` ·
`src/ui/features/auth/*`

**Aceptación.**
- [x] Registro, inicio de sesión y recuperación, con validación antes de la red
- [x] Refresco de token: lo lleva el cliente del navegador (`autoRefreshToken`)
- [x] El trabajo local se ADOPTA al crear cuenta — cambiar un `workspaceId`, no migrar datos
- [x] La adopción se hace una vez por workspace y se recuerda: no duplica en cada arranque
- [x] Sin backend configurado, las pantallas lo dicen y la aplicación sigue entera
- [x] `ui/` no importa `@infrastructure/remote/*`: la raíz de composición entrega interfaces

**Sobre el middleware de sesión.** NO se implementó una redirección a iniciar sesión, y
es deliberado: TAKU funciona sin cuenta a propósito. Un middleware que mandara a la
pantalla de login contradiría el producto. Lo que sí hay en `src/middleware.ts` son
cabeceras de seguridad (FASE 15).

---

### ✅ FASE 11 — Sincronización

**Objetivo.** Que el ciclo corra solo y que un conflicto sea una DECISIÓN del usuario,
nunca una pérdida silenciosa.

**Archivos.** `src/application/sync/scheduler.ts` · `src/application/sync/conflicts.ts` ·
`src/ui/hooks/useSync.ts` · `src/ui/components/SyncCenter.tsx` ·
`src/app/api/sync/entity/route.ts`

**Base de datos.** Dexie v2: tabla `conflicts`.

**Tests.** `tests/unit/scheduler.test.ts` (11) · `tests/integration/sync.test.ts` (18).

**Aceptación.**
- [x] Disparadores: arranque, vuelta de red, vuelta de foco, periódico y tras mutación
- [x] Las ráfagas se agrupan: diez acciones seguidas son UN ciclo, no diez
- [x] Backoff exponencial con techo; un ciclo correcto lo reinicia
- [x] Interfaz de conflictos (GAP G12) con las dos opciones y la comparación real
- [x] La foto local se guarda ANTES de que la bajada la pise
- [x] "Usar la del servidor" trae la versión remota de verdad, no la adivina
- [ ] Prueba contra una instancia real de Supabase — el transporte falso replica la
      garantía de clave primaria, pero no sustituye al servidor

---

### ✅ FASE 12 — Contenido completo y compatibilidad

**Archivos.** `src/domain/rules/compatibility.ts` · `src/domain/content/translation.ts` ·
`data/translations/es-419.json` · `src/ui/features/library/AddToCharacter.tsx` ·
`src/ui/features/library/CompatibilityLog.tsx` · `src/ui/features/library/TranslationCoverageCard.tsx`

**Tests.** `tests/unit/compatibility.test.ts` (9) · `tests/unit/translation.test.ts` (10).

**Aceptación.**
- [x] Las tres opciones (`findAlternative` / `useAnyway` / `cancel`) en la interfaz
- [x] "Buscar alternativa" no se ofrece si no existe: sería una promesa vacía
- [x] Lo forzado queda registrado con fecha y edición, y se ve en Ajustes
- [x] Traducción de contenido con degradación POR CAMPO y estado visible
- [x] Las ediciones no se cruzan: las claves comunes solo pueden traducir nombres
- [x] La búsqueda encuentra por el nombre traducido Y por el original
- [x] La cobertura real se muestra en Perfil, sin maquillarla
- [x] **2.241 nombres traducidos**: las 3.039 definiciones de las dos ediciones,
      muchas compartidas entre ellas
- [x] **1.601 textos traducidos**: toda la prosa que trae el SRD —conjuros, objetos
      mágicos, rasgos de clase, equipo, reglas—, 198.201 palabras. Las otras 1.438
      definiciones no tienen texto que traducir

---

### ✅ FASE 13 — Homebrew e importación/exportación

**Archivos.** `src/domain/content/homebrew.ts` · `src/application/homebrew/service.ts` ·
`src/ui/features/homebrew/HomebrewEditor.tsx` · `src/ui/hooks/useHomebrew.ts` ·
`src/app/(app)/homebrew/page.tsx` · `src/domain/rules/standardProgression.ts`

**Tests.** `tests/unit/homebrew.test.ts` (15) · `tests/unit/homebrew-big-types.test.ts` (19) ·
E2E en `content-and-campaigns.spec.ts` (11).

**Aceptación.**
- [x] Editor visual para armas, armaduras, objetos, objetos mágicos y conjuros
- [x] **Y para las piezas grandes**: dotes, trasfondos, especies con sus rasgos y
      clases con progresión 1–20, subclase, lanzamiento y mejoras de característica
- [x] Lo creado pasa por el MISMO esquema Zod que valida el SRD
- [x] Aparece solo en la biblioteca y en el buscador: vive en la misma tabla
- [x] Pipeline completo: elegir → analizar → previsualizar → conflictos → importar → resultado
- [x] Los ids se reescriben SIEMPRE al espacio del workspace (anti-suplantación del SRD)
- [x] Exportación versionada con `formatVersion`, y el viaje de ida y vuelta no pierde nada
- [x] Una especie o una clase generan VARIAS definiciones: el editor crea sus rasgos
      y los enlaza, y borrar el padre se los lleva
- [x] Lo que el SRD ya decidió no se pregunta: el bonificador de competencia y la tabla
      de espacios se rellenan solos desde `standardProgression`
- [ ] Subclases caseras y equipo inicial por clase: siguen sin editor

---

### ✅ FASE 14 — Campañas e i18n

**Archivos.** `src/domain/campaign/campaign.ts` · `src/ui/hooks/useCampaigns.ts` ·
`src/app/(app)/campaigns/*` · `src/i18n/runtime.ts` ·
`src/ui/components/LocaleProvider.tsx`

**Base de datos.** Dexie v3: tabla `campaigns`.

**Tests.** `tests/unit/i18n.test.ts` (11) · E2E de campañas.

**Aceptación.**
- [x] Crear campaña, asignar personajes, registro de sesiones numerado solo
- [x] La campaña FIJA la edición y avisa —sin bloquear— si alguien juega con otra
- [x] Funciona sin cuenta: compartirla después es enlazar identidades
- [x] Runtime de i18n con interpolación y respaldo; catálogos en paridad (141 claves)
- [x] Todo lo que el DOMINIO emite como clave pasa por el catálogo
- [x] Selector de idioma real en Perfil, con el alcance dicho sin adornos
- [ ] El copy de cada pantalla sigue en el JSX — frontera deliberada, ver D-37

---

### ✅ FASE 15 — Seguridad, accesibilidad y release

**Archivos.** `src/middleware.ts` · `src/application/observability/diagnostics.ts` ·
`src/ui/components/ErrorBoundary.tsx` · `src/ui/features/diagnostics/DiagnosticsSection.tsx` ·
`supabase/tests/rls-tenant-isolation.sql` · `supabase/tests/sync-contract.sql` ·
`supabase/fixtures/00-supabase-platform.sql` · `scripts/run-db-tests.mjs`

**Tests.** `tests/unit/contrast.test.ts` (32) · `tests/unit/diagnostics.test.ts` (9) ·
`tests/e2e/accessibility.spec.ts` (10) · `tests/e2e/performance.spec.ts` (2) ·
48 casos en SQL contra Postgres.

**Aceptación.**
- [x] Cabeceras de seguridad: CSP, HSTS, `frame-ancestors none`, Permissions-Policy
- [x] Contraste WCAG AA comprobado por test en los DOS temas (se encontró y corrigió un fallo)
- [x] Nombres accesibles, jerarquía de encabezados, landmarks y `lang` verificados en 8 pantallas
- [x] **axe-core sobre la página ya pintada**: 0 infracciones WCAG 2.1 A/AA en 6 pantallas,
      el asistente, un diálogo abierto y el tema claro por separado
- [x] Las filas que se añaden solas llevan nombre distinto: "Quitar rasgo 1", no "Quitar"
- [x] Límite de error: una pantalla rota no deja la aplicación en blanco
- [x] Diagnóstico local exportable, saneado de correos, ids y tokens
- [x] Subida de nivel (GAP G2) — ver FASE 16
- [x] **Tests de aislamiento entre inquilinos EJECUTADOS**: 35 casos contra PostgreSQL 18
      en proceso, en cada `npm run verify`. Encontraron una recursión infinita que rompía
      compartir personajes en campañas (migración 0002)
- [x] **El contrato del servidor de sincronización, contra Postgres real**: 13 casos sobre
      idempotencia, concurrencia optimista y el cursor
- [x] **Presupuesto de rendimiento definido y medido** contra el build de producción, con
      CPU a un cuarto y 4G flojo: LCP 908 ms, CLS 0,000, JS 324 KB, búsqueda 951 ms
- [ ] Contra una instancia de Supabase **desplegada**: falta la capa PostgREST/GoTrue (T8)
- [x] Auditoría con lector de pantalla: la parte mecánica, con 6 fallos arreglados (T14). Falta escucharla
- [ ] Medición en un teléfono físico: lo de arriba es una simulación reproducible, no un aparato

---

### ✅ FASE 16 — Subida de nivel *(era GAP G2)*

**Objetivo.** Que un personaje no se estanque en la segunda sesión.

**Archivos.** `src/domain/character/progression.ts` ·
`src/ui/features/levelup/LevelUpFlow.tsx` ·
`src/app/(app)/characters/[id]/manage/level-up/page.tsx`

**Tests.** `tests/unit/progression.test.ts` (35) · 6 E2E.

**Aceptación.**
- [x] El módulo NO calcula un solo valor derivado: cambia el estado y el motor deriva
- [x] PG por promedio, por tirada o manual; cambiar de modo no altera los niveles previos
- [x] Subclase obligatoria en el nivel que la clase marca, y solo entonces
- [x] Mejora de característica con tope 20 sobre las puntuaciones EFECTIVAS
- [x] Multiclase con requisitos reales (cierra también T6)
- [x] Experiencia que INFORMA y nunca bloquea: muchas mesas suben por hitos
- [x] Deshacer devuelve el personaje exactamente a como estaba
- [x] La validación vive en el ejecutor: el mismo código correrá en el servidor

---

### ✅ FASE 17 — La fusión con la hoja oficial de 2024

**Objetivo.** Que quien llega con la hoja de papel en la mano reconozca la
ficha de la aplicación. Se comparó pantalla contra hoja oficial en castellano,
las dos caras, y se aplicó lo que faltaba.

**Archivos.** `src/ui/features/play/DeathSavesPanel.tsx` ·
`HitDicePanel.tsx` · `HeroicInspiration.tsx` ·
`src/ui/features/character/SheetBoxes.tsx` · `IdentityBlock.tsx` ·
`AttunementSlots.tsx` · `src/ui/hooks/useAppData.ts` (`useDefinitionName`) ·
`src/domain/character/state.ts` · `src/application/commands/execute.ts` ·
`src/domain/content/labels.ts` · `src/domain/character/engine.ts` ·
`src/domain/currency/currency.ts`

**Cambios de base de datos.** Ninguna migración. `heroicInspiration` es un
booleano **opcional** en el estado: nadie migra la base por un campo que se lee
como «no la tiene» cuando falta.

**Tests.** `tests/unit/official-sheet.test.ts` (13) ·
`tests/e2e/official-sheet.spec.ts` (3 × 2 proyectos).

**Aceptación.**
- [x] Dados de golpe, salvaciones contra muerte y competencias con equipo se
      VEN: los tres estaban calculados y ninguna pantalla los pintaba
- [x] Las salvaciones contra muerte aparecen solas a 0 PG y marcar un rombo
      manda `RecordDeathSave` con la tirada que produce ese resultado, en vez
      de una vía paralela que el motor no conoce
- [x] Deshacer la inspiración heroica devuelve el valor ANTERIOR, no el
      opuesto: con dos dispositivos, invertir se la regala otra vez al jugador
- [x] La inspiración heroica no se pinta en 2014, que tiene otra regla
- [x] Ningún identificador en pantalla: competencias con equipo y las 39 claves
      de recursos de clase, con el vocabulario del overlay para que el mismo
      rasgo no se llame de dos maneras en la misma pantalla
- [x] Las siglas de moneda son las del papel (`PP` plata, `PPT` platino), y
      **eso revierte una decisión de la especificación**: ver ADENDA X · D-78

---

### ✅ FASE 18 — Taku recuerda lo que ya explicó

**Objetivo.** Que un consejo se muestre una sola vez **de verdad**, y que los
que hay digan algo que la pantalla no dice.

**Archivos.** `src/ui/features/taku/TakuProvider.tsx` · `cues.ts` ·
`lines.ts` · `src/app/(app)/profile/page.tsx` ·
`src/ui/features/play/HitDicePanel.tsx` · `HeroicInspiration.tsx` ·
`src/app/(app)/homebrew/page.tsx` ·
`src/app/(app)/characters/[id]/manage/page.tsx` · `manage/equipment/page.tsx`

**Cambios de base de datos.** Ninguno. Los ids vistos van a `localStorage`:
son una preferencia del aparato, no del personaje, y no tienen por qué viajar.

**Tests.** `tests/unit/taku.test.ts` (+2) · `tests/e2e/taku.spec.ts` (+1, y
uno reescrito).

**Aceptación.**
- [x] Un consejo visto no vuelve **ni recargando la aplicación**
- [x] Lo visto se lee en la inicialización, no en un efecto: los efectos de los
      hijos corren ANTES que los del padre, así que un efecto llegaría cuando
      la pantalla ya ofreció su consejo
- [x] «Volver a ver los consejos» los devuelve, y **no** permite hablar antes
      de que pase el tiempo de gracia
- [x] Los cinco consejos nuevos saltan cuando la regla empieza a importar, no
      al entrar a la pantalla
- [x] Cada consejo cuenta una regla comprobada en el código; se descartaron dos
      que ya estaban escritas en pantalla. Detalle en ADENDA XII

---

## Deuda técnica conocida

| # | Asunto | Impacto | Cuándo |
|---|---|---|---|
| T1 | ~~Textos de UI sin extraer~~ | Resuelto para todo lo que emite el dominio; el copy de pantalla queda por decisión (D-37) | — |
| T2 | Build con webpack en vez de Turbopack | Builds más lentos. **Comprobado el 21/09/2026, no es una suposición:** `next build --turbopack` termina sin error, pero Serwist **no genera `public/sw.js`** —se borró el archivo, se compiló con Turbopack y no volvió a aparecer—. Sin service worker la aplicación deja de funcionar sin conexión, que es la mitad del producto. Con webpack se regenera y precachea el contenido | Cuando `@serwist/next` (hoy 9.5.12) soporte Turbopack |
| T3 | TypeScript 6 en vez de 7 | Sin el compilador nativo. **Comprobado el 21/09/2026:** `typescript-eslint` 8.70.0 declara `"typescript": ">=4.8.4 <6.1.0"` en sus peer dependencies, así que subir a 7 deja el lint sin analizador de tipos. Se prefiere tener lint | Cuando typescript-eslint amplíe el rango |
| T4 | ~~Carpeta con `&` en el nombre~~ | Resuelto: la carpeta se renombró y `.npmrc` dejó de hacer falta | — |
| T5 | ~~Subida de nivel no implementada~~ | Resuelto en FASE 16 | — |
| T6 | ~~Multiclase solo en el modelo~~ | Resuelto: requisitos reales y entrada en la interfaz | — |
| T7 | ~~Sin pantallas de autenticación~~ | Resuelto en FASE 10 | — |
| T8 | ~~Sincronización sin probar contra Supabase desplegado~~ | Resuelto: migraciones aplicadas en una instancia real y los 48 casos corriendo contra ella (`npm run test:db:remote`). El ciclo con dos dispositivos se ejercita en `tests/integration/sync.test.ts`: dos pilas completas —dos bases, dos colas, dos cursores— contra un servidor con concurrencia optimista. Falta hacerlo con dos aparatos físicos, que es otra cosa | — |
| T9 | ~~Tests de RLS escritos pero no ejecutados~~ | Resuelto: 35 casos de aislamiento corren en cada `verify` contra Postgres en proceso, y contra la instancia real a pedido. Encontraron la recursión de la migración 0002 | — |
| T10 | ~~Prosa del SRD sin traducir~~ | Resuelto: las 3.039 definiciones de las dos ediciones tienen nombre en español (2.241 claves, muchas compartidas) y las 1.601 que traen texto lo tienen traducido —198.201 palabras—. Las otras 1.438 no tienen prosa que traducir. La tarjeta de cobertura mide lo COMPLETO, no lo empezado, y vuelve sola a contar lo que falta si entra contenido nuevo | — |
| T17 | ~~El inglés de los objetos mágicos de 5.2 venía roto de origen~~ | Resuelto. `Magic-Items.json` (API pública de 5e) traía tres defectos a la vez: párrafos asignados a otro objeto, tablas aplastadas en un renglón y espacios perdidos (`expendthe`, `savingthrow`, `1d10plus`). **49 entradas** se rearmaron a mano en `data/srd-raw/2024/magic-items.fix.json` —ni un párrafo inventado: cada uno existe palabra por palabra en el volcado, solo que en otra entrada— y **62 pares pegados** viven en `pegados.fix.json`, lista cerrada a propósito porque `horseshoe` y `mayonnaise` también son palabras que 5.1 no usa. El corte de párrafo perdido (87 casos) sí es una regla, y puede serlo porque el patrón no aparece **ni una vez** en las 3.813 cadenas de 5.1. Las filas que el volcado no trae siguen sin estar. Detalle en ADENDA VIII · D-72 | — |
| T18 | ~~Los campos estructurados del SRD seguían en inglés~~ | Resuelto. La ficha decía «1 action», «150 feet», «Instantaneous» y «DEX» al lado del texto en español. `src/domain/content/fields.ts` los arma **por piezas, no por valor entero**: el número se respeta y solo se busca la unidad, así que «45 feet» sale en español aunque el SRD nunca lo haya escrito. Las 8 condiciones largas —Contrahechizo, Escudo, Castigo divino— sí van enteras. De paso cayeron el tipo de criatura, el precio en `gp`, la recarga `dawn`, las siglas del bloque de estadísticas y los 67 trozos del campo de idiomas, que se resuelven probando primero el trozo más largo porque hay cláusulas con comas dentro. Lo que no sabe traducir lo devuelve en inglés. Detalle en ADENDA VIII · D-73 | — |
| T19 | ~~Los campos de prosa que no pasaban por la superposición~~ | Resuelto, y era más de lo que decía el inventario: además de `actions` estaban `specialAbilities` y `legendaryActions`, que **ni siquiera se pintaban** —la Resistencia legendaria del dragón estaba en el contenido y la ficha no la mostraba—. Son **1.519 apartados en 337 criaturas** (1.125 textos distintos) más **373 materiales de conjuro** (355 distintos): 63.254 palabras nuevas, de 198.201 a **261.455**. `TranslationEntry` ganó los tres bloques y usa `fields` para el material. Los bloques se aplican **solo si traen la misma cantidad de apartados que el original**: media traducción no deja texto en inglés, deja al dragón sin una acción. Detalle en ADENDA IX · D-74 | — |
| T11 | ~~Homebrew no cubre clases ni especies completas~~ | Resuelto del todo: dotes, trasfondos, especies con sus rasgos, clases con progresión 1–20, **subclases con sus rasgos por nivel** y **equipo inicial** —fijo y a elegir— en clase y trasfondo. Lo de las subclases no era un formulario que faltaba: sin ellas, una clase propia se quedaba con el aviso de «subclase pendiente» para siempre | — |
| T12 | ~~El tema claro es el más débil de los dos~~ | Sin defecto medible: pasa contraste AA y axe en las seis pantallas, auditado por separado | — |
| T13 | ~~Carrera del cursor entre transacciones concurrentes~~ | Resuelto por reconciliación: al arrancar y al sincronizar a mano se compara el inventario del servidor contra lo local y se cura lo que el cursor haya perdido. No evita la carrera; la hace inofensiva | — |
| T14 | Auditoría con lector de pantalla real | Las seis pruebas del guion se recorrieron por el **árbol de accesibilidad**, que es lo que un lector consume, y salieron **seis fallos**, todos arreglados: el paso del creador y el contador de la biblioteca cambiaban en silencio; «Siguiente» bloqueado salía del recorrido por tabulador con el motivo escrito y sin quien lo llevara; dos avisos apilados daban dos «Deshacer» idénticos; la ficha cantaba los PG al abrirse **cortando** al lector, porque la región es `assertive`; y cerrar un diálogo dejaba el foco en `<body>`. Los dos últimos tenían el arreglo escrito en el código y **no funcionaba** —el del foco incluso pasaba su test, sobre otra pantalla—. Fijado en `tests/e2e/lector-de-pantalla.spec.ts` (18 casos). Detalle en ADENDA XI · D-79 a D-81. Queda lo único que no se automatiza: si se ENTIENDE escuchándola | 20 min de alguien |
| T15 | ~~Tareas largas al arrancar sin comprobar~~ | Resuelto: el número se imprimía y no se afirmaba, así que el día que se duplicó nadie se enteró. Ahora falla | — |
| T20 | **Borrar contenido propio no es atómico** | Borrar una clase casera son varias escrituras seguidas —cada subclase, cada rasgo, y la clase al final— hechas uno a uno desde la interfaz. Navegar a otra pantalla en ese instante las abandona a mitad y deja subclases huérfanas en la biblioteca. Medido: sin esperar al aviso, la subclase seguía apareciendo **una de cada tres veces**. El orden ayuda —la clase se borra la ÚLTIMA, así que una interrupción deja el padre y se puede reintentar—, pero la ventana existe. El arreglo es una transacción: un `removeMany` en el repositorio y el servicio, con cuidado de que la sincronización siga emitiendo su lápida por cada id | Antes de que alguien pierda contenido |
| T16 | **El banco de rendimiento no sirve como semáforo en esta máquina** | La misma medición, sin cambiar código, dio 1.241 · 2.181 · 3.394 · 4.315 · 5.138 ms de reloj de pared, y 120 · 267 · 352 · 479 ms en la tarea más larga. Una varianza de 3-4x no detecta una regresión del 20%. El tope de la tarea más larga estaba en 400, DENTRO de ese rango, y falló una tanda entera por azar: subido a 900. Los topes quedaron donde atrapan una catástrofe y nada más; la señal real es el desglose que el test imprime, comparado contra una máquina en reposo | Medir en CI dedicado |

---

## Métricas del repositorio

| | |
|---|---|
| Archivos TypeScript | 129 |
| Líneas en `src/` | 27.225 |
| Archivos de test | 25 (16 unitarios + 9 E2E) |
| Tests unitarios + integración | **307** |
| Tests E2E | **138** (69 móvil + 69 escritorio) |
| Definiciones de contenido | 3.039 |
| Traducción de contenido | 2.241 nombres + **2.127 textos** — el 100% del SRD, prosa, bloques de estadísticas y materiales incluidos—, 261.455 palabras |
| Claves de interfaz | 141, en paridad es-419 / en |
| Páginas | 24 |
| Rutas de API | 3 |
| Tablas Postgres | 11, todas con RLS · 48 casos ejecutándose contra Postgres real |
| Tipos de comando | 47 |
| Capturas de pantalla | 51 (48 del recorrido + 3 de la ficha completa) |
| Errores de lint | 0 |
| Infracciones WCAG AA (axe) | 0, en 6 pantallas × 2 temas |
| LCP en móvil lento | 908 ms (presupuesto 2.500) |
