# D&D COMPANION — ARCHITECTURE AUDIT
**Fase 0 · Documento de arquitectura inicial**

| | |
|---|---|
| Estado | Propuesto — requiere aprobación de la sección 19 |
| Fuente de verdad | `MASTER SPECIFICATION v1.0` + `MASTER PROMPT` |
| Fecha | 2026-09-15 |
| Documento | `docs/00-ARCHITECTURE-AUDIT.md` |

---

## 1. EXECUTIVE SUMMARY

### Estado actual

El proyecto es **greenfield absoluto**. No existe una sola línea de código.

| Elemento | Estado |
|---|---|
| Código fuente | No existe |
| `package.json` / dependencias | No existe |
| Repositorio git | No inicializado |
| Base de datos | No existe |
| Variables de entorno | No existen |
| Configuración (lint, tsconfig, CI) | No existe |
| Documentación | 6 documentos, 9.757 líneas |
| Material de referencia | `D&D.zip` — 10 capturas de otra aplicación |

Toolchain local verificado y apto: **Node 24.19.0**, **npm 11.17.0**, **git 2.53.0**.
Next.js 16 requiere `node >=20.9.0`. Sin bloqueos.

### Diagnóstico

**La especificación es inusualmente madura para un proyecto sin código.** Ya identifica
correctamente las tres decisiones que normalmente se descubren tarde y caras:

1. separación `Definición` vs `Instancia`;
2. el motor de reglas como componente de dominio, fuera de la UI;
3. offline-first con cola de sincronización, no como parche posterior.

Eso significa que **el riesgo principal de este proyecto no es arquitectónico. Es de alcance
y de contenido.**

### Los dos riesgos que deciden si este producto existe

**A · Alcance.** El MVP definido (Master Prompt §65) contiene 23 bloques funcionales, cada
uno con su propia profundidad de dominio. Estimado con honestidad, son muchos meses antes de
que un jugador real toque la aplicación. Un proyecto que tarda tanto en mostrar valor tiene
alta probabilidad de morir antes de llegar a la mesa de juego. **Recomendación: mantener el
MVP como destino, pero introducir un corte intermedio obligatorio —`Vertical Slice v0.1`—
que atraviese todas las capas y se pueda usar en una partida real.**

**B · Contenido y licencia.** Solo el SRD es redistribuible. El SRD 5.1 (reglas 2014) y el
SRD 5.2 (reglas 2024) están publicados bajo **Creative Commons Attribution 4.0**, lo que
permite copiar, modificar, traducir y distribuir **con atribución**. Todo lo demás —la
mayoría de subclases, buena parte de especies, conjuros y objetos del Player's Handbook—
**no puede incluirse**. El usuario abrirá la aplicación esperando su clase favorita y no la
encontrará. Esa brecha debe **diseñarse**, no descubrirse: Homebrew e importación no son
funcionalidades secundarias, son la respuesta estructural a una limitación legal.

### Recomendación

Aprobar el stack, el modelo de dominio y el plan de fases de este documento, y resolver las
cuatro decisiones de la sección 19. Con eso, la implementación puede comenzar sin más rondas
de especificación.

---

## 2. EXISTING PROJECT ANALYSIS

### Inventario

```
AppTaku-D&D/
├── Bases de TakuD&D/
│   ├── D&D Companion — Product Specification Base v0.2.md          1.632 líneas
│   ├── D&D Companion — Especificación Funcional v0.3 (Inventario)  1.226 líneas
│   ├── D&D Companion — Especificación Funcional v0.4 (Navegación)  1.909 líneas
│   ├── D&D Companion — Especificación Técnica v0.6 (Modelo/Arq.)   1.460 líneas
│   ├── D&D Companion — Especificación UX-UI v0.7 (Sistema visual)  1.757 líneas
│   └── D&D Companion — Master Specification v1.0.md                1.773 líneas
└── D&D.zip                                                         10 capturas
```

### Tratamiento de cada documento

**`Master Specification v1.0`** — fuente de verdad junto al Master Prompt. Cerrada y aprobada.

**`v0.2` a `v0.7`** — por indicación explícita del usuario, **no se toman como requisitos**.
Se leyeron únicamente para detectar contradicciones con la v1.0 (sección 4) y para verificar
que la consolidación no perdió decisiones importantes. Conclusión: la v1.0 es un
superconjunto coherente. Las bases quedan como contexto histórico.

Dos aportes de las bases que la v1.0 no contradice y que este audit adopta por ser decisiones
ya tomadas y correctas:

- el vocabulario cerrado de efectos (`MODIFY_STAT`, `ADD_PROFICIENCY`, `APPLY_CONDITION`, …)
  de la Especificación Técnica §36;
- la estructura de capas `domain / application / infrastructure` de la §55.

**`D&D.zip`** — 10 capturas de una aplicación competidora. Material de referencia competitiva.
**No se usará como fuente de requisitos ni como referencia visual a copiar**: el Master Prompt
§45 prohíbe explícitamente que el producto se sienta como un clon. Se conserva sin
descomprimir hasta que exista una fase de diseño visual que lo justifique.

### Conclusión

No hay deuda técnica, no hay código a migrar, no hay errores existentes que corregir. La
libertad de diseño es total y la responsabilidad de acertar a la primera, también.

---

## 3. RISKS

Ordenados por impacto sobre la viabilidad del producto.

### R1 · Alcance del MVP — CRÍTICO
El MVP definido es demasiado grande para producir valor temprano. Riesgo de agotamiento antes
del primer uso real.
**Mitigación:** corte `Vertical Slice v0.1` (sección 17). Cada fase debe dejar el sistema
utilizable, no solo compilando.

### R2 · Contenido y licencia — CRÍTICO
Solo SRD 5.1 y SRD 5.2 son redistribuibles (CC-BY-4.0, con atribución obligatoria). El
contenido comercial del PHB no puede incluirse. Expectativa del usuario ≠ contenido legal
disponible.
**Mitigación:** (a) atribución CC-BY visible desde el día uno; (b) Homebrew e importación como
funcionalidad de primera clase; (c) comunicación honesta en la UI sobre qué contenido hay y
por qué; (d) `ContentSource` modelado para admitir contenido licenciado en el futuro sin
rediseño.

### R3 · El problema de las mil excepciones de 5e — ALTO
5e no es un sistema regular. *Gran Maestro de Armas*, *Agarrar*, *Concentración*, *media
armadura con DES máxima +2*, *puntos de golpe temporales que no se acumulan*. Un motor
demasiado genérico no las cubre; uno demasiado específico degenera en
`if (class === "fighter")`, que el Master Prompt §76 prohíbe.
**Mitigación:** vocabulario **cerrado y tipado** de condiciones y efectos, ampliable por
adición de miembros y cubierto por tests dorados. Cuando una regla no entra en el vocabulario,
se amplía el vocabulario — nunca se escribe la excepción dentro de un componente.

### R4 · Desalojo de almacenamiento en iOS — ALTO
Safari borra el almacenamiento escribible por script tras ~7 días sin uso en sitios **no
instalados**. Una aplicación offline-first que pierde los personajes del usuario está rota.
**Mitigación:** solicitar `navigator.storage.persist()`; detectar iOS no instalado y empujar
activamente a "Añadir a pantalla de inicio"; sincronizar temprano y a menudo; nunca tratar
IndexedDB como almacenamiento duradero único.

### R5 · Complejidad de la sincronización — ALTO
La sincronización bidireccional con edición offline es donde mueren los proyectos.
**Mitigación:** un diseño que **evita** la mayoría de conflictos en vez de resolverlos: las
mutaciones de juego se modelan como *deltas conmutativos* más idempotencia por `clientOpId`
(sección 12).

### R6 · Sesión de autenticación offline — MEDIO
El token expira; sin red no se refresca. El usuario podría quedar fuera de su propio personaje
en mitad de una partida.
**Mitigación:** la lectura y escritura local **nunca** dependen del estado de sesión. La sesión
solo gobierna la sincronización. Un token caducado degrada a modo offline, no bloquea.

### R7 · Dependencia de Supabase — MEDIO
Auth, Postgres, RLS y Storage en un único proveedor. Coste y portabilidad.
**Mitigación:** Postgres estándar con migraciones SQL propias (sin características
propietarias); acceso a datos detrás de interfaces de repositorio; Auth aislado tras un
`AuthProvider` propio. Migrar sería costoso, pero no un rediseño.

### R8 · Traducción del contenido — MEDIO
El SRD está en inglés. El producto es español primero. Traducir cientos de conjuros y objetos
es trabajo real y continuo.
**Mitigación:** CC-BY-4.0 **permite** obras derivadas, incluidas traducciones, con atribución.
Modelo de traducción separado del contenido desde el inicio; la aplicación debe funcionar con
traducción parcial y degradar al inglés **por campo**, no por documento.

### R9 · Churn de herramientas — BAJO, pero ya activo
Verificado hoy contra el registro npm: `typescript@7.0.2` es `latest`, pero
`typescript-eslint@8.70.0` declara `typescript >=4.8.4 <6.1.0`. Adoptar TS 7 hoy **rompe el
linting con información de tipos**.
**Mitigación:** fijar TypeScript en **6.0.3** (dentro del rango soportado) y revisar en cada
fase. Ver decisión D-03.

### R10 · Factor bus — BAJO ahora, ALTO después
Proyecto de una persona con un dominio grande.
**Mitigación:** las decisiones viven en `docs/`, no en la cabeza de nadie. Este documento es el
primero de esa serie.

---

## 4. CONTRADICTIONS

Contradicciones y tensiones reales detectadas entre el Master Prompt y la Master Specification.
Cada una lleva la resolución propuesta.

### C1 · Campañas: en el roadmap, fuera del MVP
Master Prompt §65 y Master Spec §62 listan el MVP **sin campañas**. Pero Master Prompt §64
coloca `FASE 11 Campaigns` **antes** de `FASE 12 Offline + Sync`, y Master Spec §61 coloca
`FASE 9 Campaigns` antes de `FASE 10 Offline`. El roadmap construye algo que el MVP dice no
incluir.
**Resolución propuesta:** el **modelo de datos** de campañas entra en el MVP (tablas, RLS,
`campaign_characters`), porque añadir multi-tenencia compartida después es un rediseño. La
**interfaz** de campañas es post-MVP. Así el roadmap y el MVP dejan de contradecirse.

### C2 · Numeración de fases incompatible
Master Prompt define `FASE 0–14` (15 fases). Master Spec define `FASE 0–12` (13 fases). Los
contenidos son compatibles pero los números no coinciden; citar "Fase 7" sería ambiguo.
**Resolución propuesta:** una sola numeración unificada en la sección 17 de este documento,
que sustituye a ambas como referencia operativa.

### C3 · "No almacenar derivados" vs. HP máximo como campo
Master Prompt §57 prohíbe almacenar valores derivables. Master Prompt §15 lista `HP máxima`
como campo de la ficha. En 5e el HP máximo es *parcialmente* derivado (dado de golpe + CON por
nivel) y *parcialmente* fuente (el jugador tiró los dados y obtuvo esos números concretos).
**Resolución propuesta:** se almacenan como **fuente** `hitPointRolls[]` (o el modo elegido:
fijo/tirada) y un `hpMaxOverride` opcional para mesas con reglas caseras. El HP máximo se
**deriva** de esas fuentes. Nunca se guarda el total calculado.

### C4 · Orden y etiquetas de monedas
Master Prompt §28 y Master Spec §20 fijan el orden visual `PO → PP → PE → PA → PC` con IDs
internos `gp, pp, ep, sp, cp`. Eso implica PP = platino y PA = plata. Dos problemas reales:
1. **No es orden descendente por valor**: el platino (PP) vale 10 po, así que debería ir antes
   que el oro. El orden pedido es por familiaridad, no por valor.
2. **`PP` se lee como "plata"** para muchísimos jugadores hispanohablantes. `PA` para plata es
   una desambiguación válida pero no es la lectura por defecto.
**Resolución propuesta:** respetar el orden y las etiquetas tal como están especificados —es
una decisión de producto ya tomada— y **mitigar** mostrando el nombre completo ("Platino",
"Plata") en la etiqueta accesible y en el primer uso. No se cambia nada sin aprobación. Los
IDs internos `gp/pp/ep/sp/cp` quedan como identificadores estables y nunca se traducen.

### C5 · "PWA que se sienta como aplicación" vs. iOS real
Master Prompt §39 exige que no se llame PWA a una web responsive, y §3 pide que se sienta como
producto real. En iOS eso tiene techo: sin prompt de instalación, instalación manual mediante
Compartir → Añadir a pantalla de inicio, y las limitaciones de almacenamiento de R4.
**Resolución propuesta:** asumir el techo de forma explícita. Guía de instalación propia para
iOS dentro de la aplicación, almacenamiento persistente solicitado, y sincronización como red
de seguridad. Se documenta como limitación conocida, no como defecto.

### C6 · "Una acción = un toque" vs. "nunca decidir por el usuario"
Master Spec §3.2 pide que las acciones frecuentes cuesten un toque. Master Prompt §13 prohíbe
tomar decisiones importantes automáticamente sin revisión.
**Resolución propuesta:** no es contradicción si se separan los ejes. **Acciones reversibles
y registradas** (daño, curación, gastar recurso, consumir munición) → un toque, con `Deshacer`.
**Decisiones de construcción del personaje** (elegir subclase, aplicar una dote) → siempre
explícitas y revisables. La reversibilidad es el criterio, no la frecuencia.

### C7 · `d10%` como dado independiente
Master Prompt §29 y Master Spec §24 listan `d10%` junto a los demás dados. El percentil no es
un dado físico distinto: es `d100`, resuelto en la práctica como dado de decenas + d10.
**Resolución propuesta:** modelar `d100` como tipo de dado con presentación de percentil. Se
mantiene la etiqueta `d10%` en la interfaz porque es la que reconoce el jugador.

### C8 · Supabase sin decidir
Master Prompt §5 dice "Supabase cuando resulte conveniente". Master Spec §39 dice "Supabase
puede utilizarse". Ambos documentos evitan comprometerse, pero la elección determina
autenticación, RLS, migraciones y el modelo de seguridad completo. No es aplazable.
**Resolución propuesta:** decidir Supabase ahora (decisión D-05), con las mitigaciones de
portabilidad de R7. Requiere confirmación — sección 19.

---

## 5. GAPS

Información o decisiones que faltan para implementar sin inventar. Clasificadas según el
Master Prompt §69 y la Master Spec §65.

| # | Gap | Tipo | Impacto |
|---|---|---|---|
| G1 | Nivel inicial de creación: ¿siempre 1, o cualquier nivel? | Decisión | Creator, Character Engine |
| G2 | Flujo de subida de nivel: aparece en el flujo conceptual de la Master Spec §2 pero no tiene sección propia en ninguno de los dos documentos | Gap | Creator, Engine, MVP |
| G3 | Multiclase: la arquitectura debe permitirla, pero no se dice si se implementa en el MVP | Decisión | Engine, Creator |
| G4 | HP al subir de nivel: fijo, tirada, o elección del usuario | Gap | Engine |
| G5 | Reglas de carga: estándar (solo peso máximo) vs. variante de encumbrance (velocidad reducida) | Decisión | Inventory Engine |
| G6 | Descanso corto y largo: `recoveryType` depende de ellos, pero no hay sección que los defina | Gap | Resources, Modo Juego |
| G7 | Concentración: ¿la controla el sistema automáticamente al lanzar un segundo conjuro? | Gap | Spell System |
| G8 | Traducción del SRD: ¿la produce el proyecto? ¿parcial aceptable? | Decisión | i18n, contenido |
| G9 | Colaboración en tiempo real dentro de una campaña | Nueva funcionalidad | Post-MVP, no implementar |
| G10 | Borrado de cuenta y exportación de datos personales | Gap | Seguridad, legal |
| G11 | Escala esperada y presupuesto de infraestructura | Decisión | Coste, plan Supabase |
| G12 | Resolución de conflictos visible: ¿qué ve el usuario cuando dos dispositivos divergen? | Gap | Sync, UX |
| G13 | Inspiración (2014) vs. Inspiración Heroica (2024): reglas distintas por ruleset | Gap | Rules Engine |

Resolución propuesta: **G1, G3, G5, G8, G11 se elevan a la sección 19** por ser decisiones que
cambian producto o alcance. El resto se resuelve dentro de la implementación de su fase y se
documenta, conforme al Master Prompt §69.

---

## 6. ARCHITECTURE

### Regla de dependencia

```
        UI  ──────────────►  APPLICATION  ──────────►  DOMAIN
        │                         │                       ▲
        │                         ▼                       │
        └──────────────►      DATA / INFRA  ───────────────┘
                          (implementa puertos del dominio)
```

Las dependencias apuntan **siempre hacia adentro**. En concreto:

- `domain/` no importa nada de React, Next, Dexie, Supabase ni de `ui/`. Es TypeScript puro,
  determinista y testeable sin navegador.
- `application/` orquesta casos de uso (comandos y consultas) y depende de `domain/` y de
  **interfaces** (puertos) de persistencia, nunca de implementaciones.
- `infrastructure/` implementa esos puertos con Dexie, Supabase y `fetch`.
- `ui/` solo consume `application/`. Jamás calcula una regla de D&D.

**Esta regla se hace cumplir por herramienta, no por disciplina.** ESLint con
`import/no-restricted-paths` bloquea en CI cualquier import que cruce una frontera. Un
layering que solo existe en un documento se degrada en tres semanas.

### Topología de ejecución

```
┌─── Navegador / PWA ────────────────────────────────────────┐
│                                                            │
│  UI (React 19, Next 16 App Router)                         │
│        │ useLiveQuery                                      │
│        ▼                                                   │
│  IndexedDB (Dexie)  ◄──── fuente de lectura primaria       │
│        ▲         │                                         │
│        │         └──► OUTBOX (cola de comandos)            │
│        │                     │                             │
│  Service Worker (Serwist)    │                             │
│   · app shell                │                             │
│   · contenido SRD            │                             │
└──────────────────────────────┼─────────────────────────────┘
                               │  HTTPS, lotes, idempotente
                               ▼
              ┌── Next.js Route Handlers ──────────────┐
              │  /api/sync/push   · valida, deduplica  │
              │  /api/sync/pull   · cursor incremental │
              │  Zod en cada frontera                  │
              └────────────────┬───────────────────────┘
                               ▼
              ┌── Supabase ────────────────────────────┐
              │  Postgres + RLS  ·  Auth  ·  Storage   │
              └────────────────────────────────────────┘
```

### Decisión clave: un único camino de escritura

Todas las mutaciones de datos del usuario pasan por el **sync API**, nunca por el cliente
Supabase directamente. Razones:

1. **Idempotencia**: un único punto donde deduplicar por `clientOpId`.
2. **Validación server-side** (Master Prompt §79): las invariantes de dominio se comprueban en
   el servidor, no solo en el navegador.
3. **Detección de conflictos**: requiere comparar versiones en un solo lugar.

RLS queda como **defensa en profundidad**, no como única barrera. La clave de servicio nunca
sale del servidor.

Las **lecturas de contenido** (biblioteca SRD) sí pueden ir directas o precacheadas, porque son
públicas y de solo lectura.

---

## 7. DOMAIN MODEL

### Principio rector: estado vs. proyección

```
CharacterState  ──►  [ Character Engine ]  ──►  CharacterSheet
  (fuente,                 (puro)                 (derivado,
   persistido)                                    nunca persistido)
```

`CharacterState` es lo único que se guarda y sincroniza. `CharacterSheet` se recalcula. Esto
resuelve el Master Prompt §57 de forma estructural: es **imposible** que un derivado se
desincronice porque no existe almacenado.

Única excepción permitida: un `CharacterCardCache` por personaje (nombre, nivel, clase, HP
actual/máximo) para pintar la lista de personajes sin resolver el motor N veces. Marcado
explícitamente como caché y reconstruible.

### Definición vs. Instancia

```ts
// DEFINICIÓN — contenido, inmutable, compartido, versionado
type WeaponDefinition = {
  id: 'srd-2014:weapon:longsword';   // namespace:tipo:slug
  rulesets: Ruleset[];
  source: ContentSourceRef;
  name: LocalizedText;
  damage: DamageExpression;          // 1d8 slashing
  properties: WeaponProperty[];      // versatile(1d10), etc.
  weight: Weight;                    // entero, centésimas de libra
  cost: Money;
};

// INSTANCIA — del personaje, mutable, propia
type InventoryItem = {
  id: Uuid;                          // UUIDv7, generado offline
  characterId: Uuid;
  definitionId: DefinitionId;        // referencia, no copia
  quantity: number;
  customName?: string;               // "Espada de Arkan"
  equippedSlot?: EquipmentSlot;
  container?: Uuid;
  attunement?: AttunementState;
  charges?: ResourceState;
  notes?: string;
  favorite: boolean;
};
```

Aprender un conjuro **jamás** modifica su `SpellDefinition`. El personaje adquiere un
`CharacterSpell` que lo referencia (Master Prompt §77).

### Agregados principales

| Agregado | Raíz | Contiene |
|---|---|---|
| Personaje | `Character` | abilities, classes[], species, background, proficiencies, features, spells, resources, conditions, inventory, currency, notes |
| Contenido | `ContentPack` | items del pack, metadata, licencia, versión |
| Campaña | `Campaign` | members, characters vinculados, ruleset, packs habilitados |
| Sincronización | `SyncOutbox` | comandos pendientes |

`Character.classes` es una **colección**, nunca un campo único — es lo que hace posible el
multiclase sin rediseño (Master Spec §28).

### Trazabilidad de los valores derivados

Todo valor calculado devuelve su procedencia. Es requisito de la Master Spec §27 y, a la vez,
la función de producto que hace la aplicación explicable a un principiante:

```ts
type Computed<T> = {
  value: T;
  contributions: Contribution[];
};

type Contribution = {
  op: 'base' | 'add' | 'set' | 'max' | 'min' | 'multiply';
  amount: number;
  source: SourceRef;        // { kind: 'feat', id, name } etc.
  ruleId?: RuleId;
};
```

La UI puede entonces mostrar, sin lógica propia:

> **CA 17** · Cota de malla 16 · Escudo +2 · Anillo de protección +1 · Destreza +0 (armadura pesada)

---

## 8. RULES ENGINE

### Qué NO se va a construir

No se construirá un lenguaje de scripting ni un intérprete general. Razones:

1. **Seguridad**: el Homebrew y el contenido importado son datos de origen no confiable. Un
   intérprete ejecutable convierte la importación en ejecución remota de código.
2. **Sobreingeniería** (Master Prompt §70): el 95 % de las reglas de 5e son modificadores
   condicionales, no algoritmos.

### Qué SÍ se va a construir: vocabulario cerrado + pipeline de modificadores

Una `RuleDefinition` es **datos**, validados por Zod, componibles desde un vocabulario cerrado:

```ts
type RuleDefinition = {
  id: RuleId;
  rulesets: Ruleset[];              // ['2014'] | ['2024'] | ambos
  source: ContentSourceRef;
  when: Trigger;                    // unión discriminada cerrada
  if?: Condition[];                 // unión discriminada cerrada
  then: Effect[];                   // unión discriminada cerrada
  priority: number;
};

type Trigger =
  | { kind: 'always' }
  | { kind: 'computeStat'; stat: StatId }
  | { kind: 'attackRoll' }
  | { kind: 'damageRoll' }
  | { kind: 'savingThrow'; ability?: AbilityId }
  | { kind: 'abilityCheck'; skill?: SkillId }
  | { kind: 'shortRest' } | { kind: 'longRest' }
  | { kind: 'castSpell' } | { kind: 'equipItem' };

type Condition =
  | { kind: 'hasProficiency'; target: ProficiencyRef }
  | { kind: 'isWearing'; armorCategory: ArmorCategory }
  | { kind: 'wieldsWeaponWith'; property: WeaponProperty }
  | { kind: 'hasCondition'; condition: ConditionId }
  | { kind: 'classLevelAtLeast'; classId: DefinitionId; level: number }
  | { kind: 'abilityAtLeast'; ability: AbilityId; value: number }
  | { kind: 'resourceAvailable'; resource: ResourceId; amount: number }
  | { kind: 'not'; condition: Condition }
  | { kind: 'allOf'; conditions: Condition[] }
  | { kind: 'anyOf'; conditions: Condition[] };

type Effect =
  | { kind: 'modifyStat'; stat: StatId; op: ModifierOp; amount: ValueExpr }
  | { kind: 'addProficiency'; target: ProficiencyRef }
  | { kind: 'setProficiencyMultiplier'; target: ProficiencyRef; multiplier: 0.5|1|2 }
  | { kind: 'grantAdvantage'; on: RollTarget }
  | { kind: 'grantDisadvantage'; on: RollTarget }
  | { kind: 'addResource'; resource: ResourceTemplate }
  | { kind: 'spendResource'; resource: ResourceId; amount: number }
  | { kind: 'applyCondition'; condition: ConditionId; duration?: Duration }
  | { kind: 'removeCondition'; condition: ConditionId }
  | { kind: 'grantAction'; action: ActionTemplate }
  | { kind: 'modifyDamage'; op: ModifierOp; amount: ValueExpr; damageType?: DamageType }
  | { kind: 'setBaseAc'; formula: AcFormula }
  | { kind: 'modifySpeed'; op: ModifierOp; amount: ValueExpr };
```

**Cuando 5e presente una excepción que no encaje, se añade un miembro a la unión.** Nunca se
escribe la excepción dentro de un componente. TypeScript detecta exhaustivamente todos los
puntos que hay que actualizar; el compilador se convierte en la lista de tareas.

### Resolución de modificadores

Ventaja y desventaja **no son números**: son un canal aparte con la regla de 5e (se anulan
entre sí, no se acumulan). Modelarlas como `+5`/`-5` es un error clásico que este diseño evita.

```
recolectar contribuciones  →  agrupar por operación
  →  aplicar 'set' de mayor prioridad (si existe)
  →  sumar 'add'
  →  aplicar 'min' / 'max' (topes, p. ej. DES máx +2 en armadura media)
  →  resolver canal ventaja/desventaja por separado
  →  devolver Computed<T> con las contribuciones intactas
```

### Separación por ruleset

Cada regla declara sus `rulesets`. El motor se instancia **para un ruleset concreto** y jamás
ve reglas de la otra edición. No hay `if (ruleset === '2024')` esparcido por el dominio: hay
dos conjuntos de datos y un motor.

---

## 9. CHARACTER ENGINE

Función pura, sin E/S, memoizable, testeable sin navegador:

```ts
function resolveCharacter(
  state: CharacterState,
  content: ContentIndex,
  ruleset: Ruleset,
): CharacterSheet
```

### Etapas del pipeline

```
 1. Base          · puntuaciones de característica en bruto
 2. Progresión    · nivel total, bonificador de competencia, dados de golpe
 3. Origen        · rasgos de especie, trasfondo
 4. Clases        · rasgos por clase y subclase según nivel de cada clase
 5. Dotes         · feats y mejoras de puntuación
 6. Equipo        · efectos de objetos equipados y sintonizados
 7. Condiciones   · efectos de condiciones activas
 8. Derivados     · modificadores, salvaciones, habilidades, CA, iniciativa,
                    velocidad, HP máximo, CD de conjuros, ataques
 9. Recursos      · espacios de conjuro, recursos de clase, cargas
10. Capacidad     · peso transportado, capacidad, estado de carga
```

Cada etapa **solo añade contribuciones**; ninguna sobrescribe silenciosamente el trabajo de la
anterior. Al final, la resolución de modificadores (sección 8) decide.

### Por qué puro importa

- Los tests de reglas no necesitan base de datos ni React.
- El mismo motor corre en el cliente (offline) y en el servidor (validación) sin duplicar
  lógica — es lo que hace posible validar server-side sin un segundo motor que se desvíe.
- La memoización por hash del estado hace que la ficha se recalcule en microsegundos.

---

## 10. INVENTORY ENGINE

### Responsabilidades

| Área | Comportamiento |
|---|---|
| Instancias | Alta, baja, cantidad, nombre propio, notas, favorito |
| Contenedores | Ubicación jerárquica (mochila, saco sin fondo, montura) |
| Slots | Equipar/desequipar con detección de conflictos |
| Peso | Peso total, capacidad derivada, estado de carga |
| Munición | Vínculo arma → tipo de munición, consumo configurable |
| Consumibles | Uso con decremento y efecto opcional |
| Objetos mágicos | Rareza, sintonización (máx. 3), cargas como recurso |

### Peso y dinero: enteros, nunca coma flotante

El peso se almacena en **centésimas de libra** (entero) y el dinero como **conteo entero por
denominación**. Sumar 0.1 lb doscientas veces en coma flotante produce deriva visible; en una
aplicación cuyo valor es la exactitud (Master Spec §3.9), eso es inaceptable. El formateo a
`0,5 lb` ocurre solo en la capa de presentación.

El dinero **nunca** se guarda como un total único convertido. Cinco contadores independientes
(`gp, pp, ep, sp, cp`). La conversión es una operación explícita y confirmada que genera un
comando registrado, jamás un efecto secundario (Master Prompt §28).

### Equipar: detección de conflictos

Equipar es una operación transaccional que puede **fallar con explicación**, nunca romper el
estado en silencio:

```
equipar(item, slot)
  → ¿slot compatible con el tipo de objeto?
  → ¿slot ocupado? → proponer intercambio, no sobrescribir
  → ¿dos manos vs. mano secundaria ocupada? → conflicto explicado
  → ¿requiere competencia que el personaje no tiene? → advertir, permitir igualmente
  → ¿requiere sintonización y ya hay 3? → bloquear con explicación
  → ¿supera la capacidad de carga? → advertir, permitir
```

La distinción entre **bloquear** y **advertir** sigue las reglas: lo que 5e prohíbe, se
bloquea; lo que 5e penaliza, se advierte y se permite.

### Munición

`Arco largo → srd:ammo:arrow`. Al resolver un ataque con arma de munición, el comando
`ResolveAttack` emite `ConsumeAmmunition` si la configuración lo permite. Sin munición: las
tres salidas del Master Prompt §25 — cancelar, continuar sin descontar, o abrir el inventario.

---

## 11. CONTENT SYSTEM

### Identificadores

```
<fuente>:<tipo>:<slug>

srd-2014:spell:fireball
srd-2024:class:wizard
hb:<workspaceId>:weapon:espada-de-arkan
```

Estables, legibles, namespaced. Nunca se reutiliza un ID entre ediciones: `srd-2014:class:ranger`
y `srd-2024:class:ranger` son contenidos distintos, porque **lo son**.

### Metadata obligatoria

Cada definición transporta: `rulesets`, `source`, `author`, `license`, `version`, `language`,
`createdAt`, `updatedAt`. Sin excepciones — incluido el Homebrew.

### Licencias — el punto crítico

| Fuente | Licencia | Redistribuible |
|---|---|---|
| SRD 5.1 (reglas 2014) | CC-BY-4.0 | Sí, con atribución |
| SRD 5.2 (reglas 2024) | CC-BY-4.0 | Sí, con atribución |
| Player's Handbook y demás material comercial | Propietaria | **No** |
| Homebrew del usuario | Del autor | Según elija |
| Contenido importado | Del origen | Responsabilidad del usuario |

CC-BY-4.0 permite **obras derivadas**, lo que incluye **traducir el SRD al español** y
distribuir esa traducción, siempre con la atribución requerida. Es la base legal de la
estrategia de idioma.

La atribución debe aparecer en la aplicación (sección "Acerca de" y ficha de cada contenido
SRD), no solo en un archivo del repositorio.

### Traducciones separadas del contenido

```ts
type ContentTranslation = {
  definitionId: DefinitionId;
  locale: Locale;
  field: string;          // 'name' | 'description' | ...
  value: string;
  status: 'machine' | 'reviewed' | 'official';
};
```

Degradación **por campo**: si el nombre está traducido pero la descripción no, se muestra el
nombre en español y la descripción en inglés con un indicador. Nunca se bloquea el contenido
por falta de traducción.

### Content Packs

Unidad de activación, versionado, exportación y compartición. El SRD se distribuye como dos
packs incorporados (`srd-2014`, `srd-2024`) precacheados por el service worker para que la
biblioteca funcione offline desde la primera apertura.

---

## 12. OFFLINE / SYNC

### La idea central: evitar conflictos, no resolverlos

La mayoría de las mutaciones de una partida son **deltas conmutativos**. Si se modelan como
deltas y no como asignaciones absolutas, dos dispositivos convergen solos:

| Comando | Modelado | Conflicto |
|---|---|---|
| `DamageCharacter{-7}` | delta | Ninguno — se aplican ambos |
| `HealCharacter{+5}` | delta con tope en máximo | Ninguno |
| `ConsumeAmmunition{-1}` | delta con suelo en 0 | Ninguno |
| `SpendResource{-1}` | delta con suelo en 0 | Ninguno |
| `AddCurrency{+50 gp}` | delta | Ninguno |
| `EquipItem{slot}` | asignación | Último gana, se registra |
| `RenameCharacter` | asignación | Último gana, se registra |
| `DeleteInventoryItem` | tombstone | Borrado gana |

Guardar "HP = 23" genera conflicto. Guardar "HP −7" no. **Es la decisión que hace viable el
offline multi-dispositivo sin CRDTs.**

### Idempotencia

Cada comando lleva un `clientOpId` (UUIDv7) generado offline. El servidor guarda
`applied_operations(client_op_id PRIMARY KEY)`. Un reintento inserta y choca con la clave
primaria → se descarta sin reaplicar. Esto cumple el Master Prompt §41 ("nunca duplicar
acciones por un retry") con una garantía de base de datos, no con una comprobación esperanzada.

### Flujo

```
Acción del usuario
  → command handler (application)
  → aplicar a Dexie de inmediato        ← la UI responde ya
  → encolar en outbox
  → sync engine (cuando hay red)
      → POST /api/sync/push  { ops: [...] }   lotes, orden garantizado
      → servidor: dedup por clientOpId, valida, aplica, asigna seq
      → GET /api/sync/pull?cursor=<seq>       cambios de otros dispositivos
  → aplicar remoto a Dexie
```

### Cursor por secuencia, no por reloj

El cursor de `pull` es un `bigserial` de una tabla `change_log`, **no un timestamp**. Los
relojes de los clientes están sesgados y una sincronización basada en tiempo pierde registros
silenciosamente. Con una secuencia monótona del servidor, `seq > cursor` es exacto.

### Alcance offline

Funciona sin red: personajes, ficha completa, dados, HP, recursos, condiciones, inventario,
dinero, conjuros, y la biblioteca del contenido cacheado.
Requiere red: iniciar sesión por primera vez, sincronizar, importar desde la nube, campañas.

La interfaz declara el estado sin ambigüedad — `Sin conexión · Cambios guardados en este
dispositivo` → `Sincronizado` (Master Prompt §51).

---

## 13. SECURITY

### Modelo

| Capa | Responsabilidad |
|---|---|
| Supabase Auth | Identidad, sesión, recuperación de cuenta |
| Route Handlers | **Autorización y validación de dominio** — barrera principal |
| Postgres RLS | Aislamiento de tenant — defensa en profundidad |
| Zod | Validación de esquema en toda frontera de confianza |

### Multi-tenencia

Cada fila de datos de usuario lleva `workspace_id`. Política RLS base:

```sql
create policy workspace_isolation on characters
  for all
  using (workspace_id in (
    select workspace_id from workspace_members where user_id = auth.uid()
  ));
```

Las campañas son un **segundo eje de compartición**: un personaje de un workspace puede ser
visible para los miembros de una campaña a través de `campaign_characters`, sin cambiar de
propietario. Esa política se escribe y se prueba explícitamente — es la superficie de fuga más
probable del sistema.

### Importación segura

El contenido importado es **dato no confiable**. El pipeline del Master Prompt §35 se
implementa con:

1. límite de tamaño y de profundidad de anidamiento antes de parsear;
2. validación estructural con Zod contra el esquema de pack;
3. verificación de que cada `Effect`/`Condition` pertenece al vocabulario cerrado — sin
   ejecución, sin `eval`, sin funciones;
4. reescritura de IDs a namespace del workspace para impedir suplantación de contenido SRD;
5. saneamiento de todo texto renderizado (sin HTML crudo);
6. previsualización y confirmación explícita antes de escribir.

### Secretos

`SUPABASE_SERVICE_ROLE_KEY` solo en el servidor, nunca en código de cliente ni en variables
`NEXT_PUBLIC_*`. Regla de lint que prohíbe importar módulos de servidor desde componentes de
cliente.

---

## 14. NAVIGATION

### Navegación global (móvil, barra inferior)

```
Inicio   ·   Personajes   ·   Biblioteca   ·   Campañas   ·   Perfil
```

### Contexto de personaje

```
┌──────────────────────────────────────────┐
│  ← Arkan · Nivel 5 · Guerrero    [2014]  │   ← contexto siempre visible
├──────────────────────────────────────────┤
│      MODO JUEGO    │    MODO GESTIÓN     │
└──────────────────────────────────────────┘
```

El encabezado responde permanentemente a las cuatro preguntas del Master Spec §56: qué
personaje, qué campaña, qué ruleset, y si hay conexión.

### Mapa de rutas

```
/                                  Inicio
/characters                        Lista
/characters/new/[step]             Creador (15 pasos, progreso persistido)
/characters/[id]/play              MODO JUEGO
/characters/[id]/manage            MODO GESTIÓN — resumen
/characters/[id]/manage/inventory
/characters/[id]/manage/equipment
/characters/[id]/manage/spells
/characters/[id]/manage/resources
/characters/[id]/manage/features
/characters/[id]/manage/money
/characters/[id]/manage/notes
/library                           Biblioteca — búsqueda primero
/library/[type]/[definitionId]     Detalle de contenido
/homebrew                          Editor de contenido propio
/campaigns                         (modelo en MVP, interfaz post-MVP)
/profile
```

Los segmentos de ruta se mantienen en inglés y neutros; las etiquetas visibles se traducen. Esto
evita reescribir URLs por idioma y mantiene los enlaces compartidos estables entre locales.

### Acciones frecuentes

Nunca detrás de más de un toque desde Modo Juego: daño, curación, tirar dados, gastar recurso,
atacar, lanzar conjuro, alternar condición. Todas reversibles con `Deshacer`.

---

## 15. PROJECT STRUCTURE

```
dnd-companion/
├── src/
│   ├── app/                        Next.js App Router — solo rutas y layouts
│   │   ├── (app)/
│   │   └── api/sync/
│   │
│   ├── domain/                     TypeScript puro · sin React · sin E/S
│   │   ├── shared/                 Computed, Modifier, ids, Result
│   │   ├── rules/                  motor, vocabulario, resolución
│   │   ├── character/              estado, motor, progresión, multiclase
│   │   ├── inventory/              instancias, slots, peso, munición
│   │   ├── spells/                 espacios, preparación, lanzamiento
│   │   ├── resources/              recursos genéricos, descansos
│   │   ├── conditions/
│   │   ├── combat/                 ataques, daño, tiradas
│   │   ├── currency/
│   │   ├── dice/                   parser de expresiones, RNG
│   │   ├── content/                definiciones, packs, compatibilidad
│   │   └── campaign/
│   │
│   ├── application/                casos de uso
│   │   ├── commands/               DamageCharacter, CastSpell, EquipItem…
│   │   ├── queries/
│   │   ├── ports/                  interfaces de repositorio
│   │   └── sync/                   outbox, motor de sincronización
│   │
│   ├── infrastructure/
│   │   ├── local/                  Dexie: esquema, repos, migraciones
│   │   ├── remote/                 Supabase: cliente, auth, repos
│   │   ├── api/                    controladores de route handlers
│   │   └── content/                carga y caché de packs
│   │
│   ├── ui/
│   │   ├── design-system/          tokens, primitivos, Button, Sheet…
│   │   ├── components/             compartidos entre features
│   │   └── features/
│   │       ├── character-creator/
│   │       ├── play-mode/
│   │       ├── manage-mode/
│   │       ├── library/
│   │       ├── homebrew/
│   │       └── campaigns/
│   │
│   ├── i18n/
│   │   ├── messages/               textos de interfaz (es-419, en)
│   │   └── content/                traducciones de contenido
│   │
│   └── content/                    packs SRD incorporados (JSON validado)
│
├── supabase/migrations/            SQL versionado
├── tests/
│   ├── unit/  integration/  e2e/  fixtures/golden/
├── docs/
│   ├── 00-ARCHITECTURE-AUDIT.md
│   ├── 01-IMPLEMENTATION-PLAN.md
│   └── adr/
└── public/                         manifest, iconos
```

`src/components/` plano no existe: el Master Prompt §62 lo prohíbe explícitamente y con razón.

---

## 16. TESTING STRATEGY

### Pirámide

| Nivel | Herramienta | Cubre |
|---|---|---|
| Unitario | Vitest | Dominio puro: reglas, modificadores, peso, dinero, dados, munición, recursos |
| Golden | Vitest + fixtures | Personajes completos → ficha derivada esperada |
| Integración | Vitest | Dexie, outbox, sincronización, idempotencia, RLS |
| E2E | Playwright | Crear personaje, jugar sesión, offline→online |

### Tests dorados: la red de seguridad del dominio

Un fixture es un `CharacterState` completo más la `CharacterSheet` esperada. Cuando se toca el
motor de reglas, estos tests revelan **exactamente** qué personaje cambió y en qué estadística.
Es el único mecanismo práctico para refactorizar un motor de reglas de 5e sin miedo.

### Los 15 casos críticos del Master Prompt §59

| Caso | Nivel | Verifica |
|---|---|---|
| 1 · FUE 16 → +3 | Unit | Modificador |
| 2 · Ataque con competencia | Unit | Se suma el bonificador |
| 3 · Sin competencia | Unit | **No** se suma |
| 4 · Munición 23 → 22 | Unit | Decremento |
| 5 · Sin munición | Unit | Bloquea o advierte según configuración |
| 6 · Conjuro gasta espacio | Unit | Descuento correcto |
| 7 · Recurso 3/3 → 2/3 → 3/3 | Unit | Gasto y recuperación |
| 8 · Daño 30 → 23 | Unit | Delta |
| 9 · Curación 23 → 30 | Unit | Sin superar el máximo |
| 10 · HP temporal | Unit | No se acumula; se consume primero |
| 11 · Peso del inventario | Integration | Recalculado al cambiar |
| 12 · Cinco denominaciones | Unit | Enteros, sin pérdida |
| 13 · Ruleset 2014 rechaza contenido 2024 | Unit | Compatibilidad |
| 14 · Ruleset 2024 aplica sus reglas | Unit | Partición del motor |
| 15 · Offline → outbox → sync sin duplicar | Integration | Idempotencia |

Los casos 1–14 se escriben **antes** que su implementación. El 15 exige un servidor de prueba y
llega con la fase de sincronización.

### Cobertura

Objetivo duro en `src/domain/`: **>90 %**. En UI no se fija número — se fijan los flujos E2E que
deben pasar. Cobertura alta en componentes es un indicador vacío.

---

## 17. IMPLEMENTATION PHASES

Numeración unificada que sustituye a las dos anteriores (resuelve C2).

### Hito 1 — `Vertical Slice v0.1` · el corte que reduce R1

Objetivo: **un jugador usa un personaje real en una partida real.** Atraviesa todas las capas
y valida la arquitectura completa antes de invertir en amplitud.

| Fase | Contenido | Entregable |
|---|---|---|
| **F0** | Audit y decisiones | Este documento aprobado |
| **F1** | Fundación: proyecto, capas, lint de fronteras, design tokens, PWA instalable, CI | La aplicación se instala y arranca |
| **F2** | Contenido: esquemas Zod, pack SRD 2014 reducido (1 clase, 1 especie, 1 trasfondo, armas y armaduras básicas, 20 conjuros) | Biblioteca navegable offline |
| **F3** | Dominio: motor de reglas + motor de personaje + tests dorados | Casos críticos 1–3, 13–14 en verde |
| **F4** | Persistencia local: Dexie, repositorios, comandos, `Deshacer` | Los datos sobreviven al cierre |
| **F5** | Creador de personaje reducido (nivel 1, sin multiclase) | Se crea un personaje válido |
| **F6** | Ficha inteligente con trazabilidad de derivados | Se entiende el personaje |
| **F7** | Inventario, equipo, dinero, peso, munición | Casos 4, 5, 11, 12 |
| **F8** | Conjuros, recursos, condiciones, descansos | Casos 6, 7, 10 |
| **F9** | Dados y **Modo Juego** | Casos 8, 9 — **jugable** |

**Fin del Hito 1: la aplicación se usa en una mesa.** Sin cuenta, sin nube, sin sincronización:
todo local. Es deliberado — es lo que permite obtener retroalimentación real en meses, no en un
año.

### Hito 2 — MVP completo

| Fase | Contenido |
|---|---|
| **F10** | Autenticación, Postgres, RLS, multi-tenencia, migraciones |
| **F11** | Sincronización: outbox, push/pull, idempotencia, conflictos |
| **F12** | Contenido completo: SRD 2014 y 2024 completos, compatibilidad entre rulesets |
| **F13** | Homebrew e importación/exportación |
| **F14** | Modelo de campañas (sin interfaz) + i18n completo |
| **F15** | Seguridad, accesibilidad WCAG AA, rendimiento, pulido, release |

### Hito 3 — Post-MVP

Interfaz de campañas, herramientas de DM, encuentros, monstruos, mapas, colaboración.
**No se implementa nada de esto ahora** (Master Prompt §66).

### Regla por fase

Cada fase termina con: implementado · probado · revisado · corregido · documentado · sistema
funcional (Master Prompt §74). No se avanza sobre errores conocidos importantes.

---

## 18. DECISIONS

Decisiones técnicas tomadas bajo la autoridad del Master Prompt §85 ("si una decisión menor
puede resolverse técnicamente sin cambiar el producto, resuélvela"). Todas verificadas hoy
contra el registro npm.

| # | Decisión | Justificación |
|---|---|---|
| **D-01** | **Next.js 16.3.5**, App Router, React 19.3.0 | Versiones estables actuales. Requiere Node ≥20.9; disponible 24.19 |
| **D-02** | Aplicación única, sin monorepo | El Master Prompt §5 prohíbe complejidad innecesaria. Las fronteras se imponen con lint, no con paquetes |
| **D-03** | **TypeScript 6.0.3**, no 7.0.2 | `typescript-eslint@8.70.0` declara `typescript >=4.8.4 <6.1.0`. TS 7 (compilador nativo) rompería el linting con tipos. Se revisa cada fase |
| **D-04** | Fronteras de capa impuestas por `eslint-plugin-import` (`no-restricted-paths`) | Un layering solo documentado se degrada. Falla en CI |
| **D-05** | **Supabase** para Postgres, Auth, RLS y Storage | Recomendado por ambas especificaciones. Mitigación de bloqueo en R7. **Requiere confirmación — §19** |
| **D-06** | Migraciones SQL versionadas en `supabase/migrations/` | Master Prompt §78. Nunca cambios manuales en producción |
| **D-07** | Toda mutación de usuario pasa por `/api/sync/*`; RLS como defensa en profundidad | Idempotencia y validación server-side en un único punto (Master Prompt §79) |
| **D-08** | **Dexie 4.4.6** + `dexie-react-hooks` (`useLiveQuery`) como camino de lectura | La base local **es** la caché. Añadir TanStack Query duplicaría cachés y fuentes de verdad |
| **D-09** | **Zustand 5.0.15** solo para estado efímero de interfaz | Nada de dominio en el estado de UI |
| **D-10** | **Zod 4.6.5** en toda frontera de confianza | Importación, API, carga de contenido |
| **D-11** | **Tailwind 4.3.3** + design tokens en variables CSS + componentes propios sobre primitivos **Radix** | Accesibilidad resuelta sin adoptar el aspecto genérico que el Master Prompt §45 prohíbe |
| **D-12** | **Serwist 9.5.12** para el service worker | Mantenido, integrado con Next. `next-pwa` está estancado |
| **D-13** | **UUIDv7** generado en cliente (`uuid@14`) | Ordenable por tiempo, indexable, generable offline |
| **D-14** | Peso en centésimas de libra (entero); dinero en contadores enteros por denominación | La coma flotante deriva; la exactitud es el valor del producto |
| **D-15** | Parser de expresiones de dados **propio** | La gramática es mínima (`NdX`, modificadores, ventaja). Una dependencia no se justifica (Master Prompt §5) |
| **D-16** | RNG con `crypto.getRandomValues`, semilla inyectable en tests | `Math.random()` no es aceptable en una aplicación cuyo producto son las tiradas |
| **D-17** | Ventaja y desventaja como canal aparte, no como número | Regla de 5e: se anulan entre sí, no se acumulan |
| **D-18** | Cursor de sincronización por `bigserial` en `change_log`, no por timestamp | El sesgo de reloj de los clientes hace perder registros |
| **D-19** | Vocabulario cerrado de efectos y condiciones; sin intérprete | El contenido importado no es confiable. Evita ejecución remota de código |
| **D-20** | **Vitest 5.0.1** + **Playwright 1.63.0** | Estándar actual; Next 16 ya declara Playwright como peer |
| **D-21** | **next-intl 4.14.5**; rutas en inglés, etiquetas traducidas | URLs estables entre idiomas |
| **D-22** | `Ruleset` como unión `'2014' \| '2024'`, motor instanciado por ruleset | Ningún condicional de edición esparcido por el dominio |
| **D-23** | Derivados nunca persistidos; única excepción `CharacterCardCache` marcada como caché | Master Prompt §57 resuelto estructuralmente |

---

## 19. REQUIRED APPROVALS

Solo se consulta lo que puede cambiar producto, arquitectura fundamental, seguridad, modelo de
datos o reglas (Master Prompt §72.19). Todo lo demás está resuelto en la sección 18.

### A1 · Corte `Vertical Slice v0.1` — *el más importante*

El MVP definido es grande. Propuesta: insertar el Hito 1 (F0–F9, **todo local, sin cuenta ni
nube**) como primer entregable usable en una partida real, y mover autenticación y
sincronización al Hito 2.

Cambia **cuándo** se usa el producto, no **qué** contiene el producto final.

- **Opción A (recomendada):** aprobar el corte.
- **Opción B:** mantener el orden original, con autenticación y nube antes de que exista una
  ficha jugable.

### A2 · Alcance de contenido y expectativa del usuario

Solo el SRD 5.1 y 5.2 son redistribuibles (CC-BY-4.0). No habrá la mayoría de subclases del
PHB. Confirmar:

1. ¿Se acepta lanzar con contenido SRD únicamente, comunicándolo con honestidad en la interfaz?
2. ¿El proyecto produce su propia **traducción al español del SRD** (permitida por CC-BY con
   atribución), asumiendo que al principio será parcial y con degradación por campo al inglés?

Esto define la percepción del producto en el primer minuto de uso. *(Resuelve G8, R2.)*

### A3 · Alcance de personaje en el MVP

Tres decisiones acopladas que determinan el creador y el motor:

1. **Nivel inicial:** ¿solo nivel 1, o crear directamente a cualquier nivel? *(G1)*
2. **Subida de nivel:** ¿flujo de subida de nivel dentro del MVP? Aparece en el flujo conceptual
   de la Master Spec §2 pero no tiene especificación propia. *(G2)*
3. **Multiclase:** el Master Prompt §33 solo exige que la **arquitectura** lo permita.
   ¿Se implementa en el MVP o queda para después? *(G3)*

- **Recomendación:** nivel 1 al crear + flujo de subida de nivel en el MVP (sin él, un personaje
  muere en la sesión 2) + multiclase soportada en el modelo pero **no** en la interfaz del MVP.

### A4 · Supabase como plataforma

Ambas especificaciones lo sugieren sin comprometerse (C8). Determina autenticación, RLS,
migraciones y el modelo de seguridad completo; cambiarlo después es caro.

- **Recomendación:** adoptar Supabase con las mitigaciones de portabilidad de R7 (Postgres
  estándar, sin características propietarias, repositorios tras interfaces).
- Necesito además una indicación aproximada de **escala esperada y presupuesto** para elegir
  plan y estrategia de caché. *(G11)*

---

## SIGUIENTE PASO

Con A1–A4 resueltas, el siguiente entregable es `docs/01-IMPLEMENTATION-PLAN.md`: fase por fase
con objetivo, archivos, módulos, dependencias, cambios de base de datos, tests y criterios de
aceptación. Después comienza la implementación por la Fase 1.

**No se escribirá interfaz antes de que el dominio y sus tests existan.**

---

# ADENDA — QUÉ CAMBIÓ AL IMPLEMENTAR

*Añadida el 2026-09-16, tras las fases 1–9.*

Este audit se escribió antes de existir una línea de código. Lo que sigue es lo que la
implementación confirmó, corrigió o descubrió. Se añade en vez de reescribir el documento:
un audit que se edita para parecer que siempre tuvo razón no sirve para nada.

## Aprobaciones A1–A4: resueltas por defecto

Se pidió continuar sin esperar respuesta, así que se tomaron las recomendaciones del propio
audit. Siguen siendo reversibles y siguen necesitando confirmación.

| | Decisión aplicada |
|---|---|
| **A1** | Corte `Vertical Slice v0.1` aceptado: fases 1–9 sin cuenta ni nube |
| **A2** | Solo SRD, con atribución CC-BY visible en la aplicación. Traducción al español pendiente; los conjuntos cerrados (daño, escuelas, rarezas) ya están traducidos |
| **A3** | Nivel 1–5 al crear · multiclase en el modelo, no en la interfaz · **subida de nivel NO implementada** (sigue siendo el hueco más grande) |
| **A4** | Supabase adoptado: esquema, RLS y API escritos; falta la interfaz de sesión |

## Marca

El producto se llama **TAKU D&D**, no «D&D Companion». Las referencias visuales fijaron
además la paleta: **carmesí sobre obsidiana**, no oro. El audit original proponía oro como
acento; se corrigió. El oro quedó reservado para lo legendario.

## Riesgos: qué pasó realmente

| # | Predicción | Resultado |
|---|---|---|
| R2 | Contenido legal insuficiente | **Confirmado y mejor de lo previsto**: 3.039 definiciones utilizables |
| R3 | Las mil excepciones de 5e | **Confirmado**: el vocabulario cerrado aguantó Defensa sin armadura, estilos de combate y rasgos de especie sin un solo `if` de clase |
| R9 | Churn de herramientas | **Confirmado dos veces**: TS 7 y ESLint 10 hubo que bajarlos. Se sumó un tercero: Serwist aún no soporta Turbopack |

## Decisiones nuevas, no previstas en el audit

| # | Decisión | Por qué |
|---|---|---|
| **D-24** | ESLint fijado en **9.39.5** | `eslint-plugin-react` llama a APIs eliminadas en ESLint 10 |
| **D-25** | Build con **webpack** | `@serwist/next@9` no soporta Turbopack, que es el predeterminado de Next 16 |
| **D-26** | `.npmrc` con `script-shell=bash` | El `&` de la carpeta rompe `npm run` en cmd.exe |
| **D-27** | **Tema oscuro por defecto**, no «sistema» | La identidad es la obsidiana con carmesí. El claro es una elección explícita |
| **D-28** | Conjuntos cerrados del SRD traducidos aparte de la prosa | Tipos de daño y escuelas son enumeraciones; la prosa es obra derivada bajo CC-BY |
| **D-29** | Capturas y E2E contra el **build de producción** | En desarrollo Next compila rutas bajo demanda y los tiempos se vuelven inestables |

## Tres defectos encontrados por probar de verdad

Ninguno de los tres aparece en un typecheck ni en un test unitario. Salieron al ejecutar la
aplicación.

**1 · El índice de contenido se cacheaba vacío.**
Si una pantalla pedía el índice mientras el volcado inicial seguía en curso, recibía un
índice sin nada — y se cacheaba. El creador mostraba cero especies con 3.039 definiciones en
la base. *Corregido: nunca se cachea un índice vacío, y el fin del volcado emite una señal.*

**2 · El reset global de `button` anulaba Tailwind en toda la aplicación.**
`button { padding: 0; background: none }` escrito FUERA de `@layer base`. En CSS lo no-capado
gana a lo capado, así que anulaba `px-4` y `bg-*` en cada botón. El síntoma no era un error:
era una maquetación descolocada sin causa aparente. *Corregido: todo el reset dentro de
`@layer base`.*

**3 · Dos elementos de navegación activos a la vez.**
`/library?type=rule` y `/library?type=spell` se marcaban ambos activos al estar en
`/library`. *Corregido: los atajos con consulta exigen coincidencia exacta.*

## Lo que este audit no anticipó

- **La gravedad de T4** (el `&` en el nombre de la carpeta). Se trató como una molestia; es
  la primera cosa que rompe el proyecto en una máquina nueva.
- **Que el tema claro necesitaría diseño propio.** Se asumió que salía «gratis» invirtiendo
  tokens. No: la primera versión parecía una aplicación genérica. Sigue siendo el tema más
  débil de los dos.
- **Que probar en un navegador real encontraría más bugs que cualquier test.** Los 65 tests
  unitarios pasaban con los tres defectos de arriba dentro.

---

# ADENDA II — LO QUE APRENDIMOS CERRANDO LAS FASES 10–15

*Escrita el 2026-09-16, después de completar subida de nivel, cuentas,
sincronización, compatibilidad, Homebrew, campañas, i18n y seguridad.*

## Lo que la arquitectura devolvió con intereses

La **subida de nivel** —el hueco que este audit marcó como GAP G2 y el plan como el
más grave— resultó ser el trabajo más pequeño de los seis. No porque fuera fácil,
sino porque el estado ya estaba separado de la proyección (§7): subir de nivel es
cambiar `classes[i].level` y dejar que el motor derive PG, competencia, espacios,
recursos y rasgos. `progression.ts` no calcula **ni un solo valor derivado**.

Si el nivel se hubiera guardado con su CA, sus PG máximos y sus espacios al lado
—como hace casi toda ficha digital— esa misma función habría tenido que recalcular
y reescribir doce campos, y cada regla nueva habría abierto una vía de desincronía.
La decisión D-01 se pagó sola aquí.

Lo mismo con **Homebrew**: guardar el contenido propio en la MISMA tabla que el SRD,
con otro `packId`, hizo que apareciera en la biblioteca, en el buscador y en el motor
sin una línea de código dedicada. El test E2E que lo comprueba —crear un arma y
buscarla en la biblioteca— pasó a la primera.

Y con las **campañas**: el modelo multi-tenant desde el día uno (§13, C1) convirtió
"adoptar el trabajo local al crear una cuenta" en cambiar un `workspaceId`.

## Decisiones nuevas

| # | Decisión | Por qué |
|---|---|---|
| D-30 | La subida de nivel valida el tope de 20 contra las características **efectivas** de la ficha, no contra las puntuaciones base | Comprobarlo sobre la base deja pasar mejoras que rompen el tope real cuando la especie ya suma |
| D-31 | `LevelUpRevert` guarda la **longitud** del array de tiradas, no "quitar la última" | Pasar de promedio a tirada rellena los niveles anteriores; quitar solo una dejaba datos huérfanos |
| D-32 | Los conflictos de sincronización guardan una **foto del estado local** antes de que la bajada lo pise | Sin ella, el ciclo siguiente trae la versión del servidor y el trabajo del usuario desaparece sin rastro |
| D-33 | `GET /api/sync/entity` para resolver un conflicto eligiendo "la del servidor" | Con versiones empatadas el `change_log` no vuelve a entregar la entidad: había que pedirla |
| D-34 | Los ids importados se reescriben **siempre** al espacio del workspace | Un pack podía redefinir `srd-2014:spell:fireball` y cambiar las reglas por debajo |
| D-35 | La traducción de contenido es una **superposición** aplicada al construir el índice, no una reescritura de IndexedDB | Conserva el original, permite cobertura parcial honesta y hace posible cambiar de idioma sin re-volcar 3.039 definiciones |
| D-36 | Las claves comunes a las dos ediciones solo pueden traducir **nombres**, y el tipo lo impone | "Blinded" es "Cegado" en las dos, pero el TEXTO cambia: una clave compartida con descripción metía prosa de 2014 en un personaje de 2024 |
| D-37 | La frontera de i18n es **el dominio**: lo que sale como clave está en el catálogo; el copy de pantalla, en la pantalla | Es una línea explicable y comprobable, no un "a medias". El segundo idioma funciona entero del lado del dominio |
| D-38 | CSP sin nonce, con `script-src 'unsafe-inline'` | Un nonce obliga a leer cabeceras en el layout → todas las páginas dinámicas → se rompe el precacheado del service worker. Entre una política que finge ser estricta y una aplicación offline real, elegimos la aplicación y lo escribimos |
| D-39 | Sin telemetría remota: el diagnóstico se guarda en el dispositivo y lo exporta el usuario | Una aplicación que guarda notas privadas de partida no debería obligar a confiar en un tercero para poder arreglar un bug |

## Cuatro defectos que solo aparecieron ejecutando

Ninguno lo habría encontrado un typecheck. Los 203 tests unitarios pasaban con los
cuatro dentro, porque tres de ellos viven exactamente donde los tests no miran: en la
frontera entre dos sistemas que cada uno probaba por separado.

**1 · La traducción se veía en la ficha pero no se podía buscar.**
La superposición se aplica al construir el `ContentIndex`, pero la búsqueda de la
biblioteca consulta **IndexedDB directamente**, donde los nombres siguen en inglés.
Buscar "Cegado" no encontraba nada aunque la pantalla dijera "Cegado".
*Corregido: la búsqueda traduce antes de filtrar y ordenar, y acepta los dos nombres.*

**2 · Contraste por debajo de AA en el tema claro.**
Verde de éxito a 3.89:1 sobre el fondo — el mínimo es 4.5. Medido en el navegador
convirtiendo los tokens oklch a sRGB. *Corregido, y ahora hay un test que lo calcula
sin navegador: 32 comprobaciones sobre los dos temas.*

**3 · "Sincronizando 1…" sin nube configurada.**
El indicador mostraba actividad de sincronización cuando no había cuenta ni servidor.
Es exactamente el tipo de mentira que §75 prohíbe. *Corregido: sin cuenta dice
"Guardado en este dispositivo", que es la verdad.*

**4 · Una franja negra bajo la barra de confirmación en escritorio.**
Cada elemento fijo reservaba el alto de la barra inferior, que en escritorio no
existe. *Corregido con un token `--nav-offset` que vale 0 a partir de `lg`: los cuatro
elementos afectados se arreglaron a la vez.*

## Un defecto de los tests, no del producto

`waitForContent()` esperaba a que el indicador de volcado estuviera **oculto**. En
Playwright, `toBeHidden()` es cierto también cuando el elemento **todavía no existe**,
y el volcado arranca un instante después del primer pintado. La función volvía
enseguida y el test buscaba en una biblioteca vacía.

Pasó durante semanas porque en aislamiento el contenido ya estaba volcado. Solo falló
con la suite entera corriendo, donde cada contexto nuevo vuelve a volcar. *Corregido:
primero se le da al indicador la oportunidad de aparecer.*

Vale la pena anotarlo: un test que pasa por la razón equivocada es peor que uno que
falla, porque nadie lo mira.

## Lo que sigue sin estar hecho, y por qué

- **Traducción de la prosa del SRD.** Están las condiciones, las reglas más
  consultadas, las habilidades y los idiomas: 91 nombres y 23 textos completos. Los
  conjuros y las criaturas son cientos de miles de palabras. El mecanismo está y la
  cobertura se ve en Perfil; el resto es trabajo de traducción, no de ingeniería.
- **Los tests de RLS no se han ejecutado.** `supabase/tests/rls-tenant-isolation.sql`
  existe, cubre los siete ataques que importan y corre con `npm run test:rls` — pero
  necesita una instancia de Supabase y en este entorno no hay ninguna.
- **Clases y especies completas en Homebrew.** El editor cubre armas, armaduras,
  objetos, objetos mágicos y conjuros. Una clase entera —con progresión por nivel,
  subclases y recursos— es otra pantalla y otro problema.
- **Auditoría con lector de pantalla real.** Lo medible está medido: contraste,
  nombres accesibles, jerarquía de encabezados, landmarks, `lang`. Lo que no se puede
  automatizar —si el orden de lectura tiene sentido— sigue pendiente.

---

# ADENDA III — LO QUE APARECIÓ AL EJECUTAR LO QUE ESTABA ESCRITO

La adenda anterior se cerraba con cuatro pendientes y una excusa compartida: *"hace
falta una instancia de Supabase"*. Esta adenda existe porque esa excusa era falsa, y
lo que había detrás no era una tarea de infraestructura sino un bug en producción
esperando a la primera persona que abriera una campaña.

## D-40 · Postgres en proceso, no Postgres prometido

`supabase/tests/rls-tenant-isolation.sql` llevaba escrito desde la FASE 15. Cubría
siete ataques, estaba comentado con cuidado y **nunca se había ejecutado**. Eso no es
un test: es documentación con sintaxis SQL. Un test que nunca corrió no prueba nada,
y encima da la sensación contraria, que es peor.

No había Docker, ni `psql`, ni CLI de Supabase en la máquina. Lo que sí había es
**PGlite**: PostgreSQL 18 compilado a WebAssembly, corriendo dentro de Node. No es un
simulador ni una imitación —es el motor de verdad, con el mismo planificador y la
misma implementación de RLS—, así que las políticas se aplican de verdad.

Lo que falta emular lo pone `supabase/fixtures/00-supabase-platform.sql`: los tres
roles de PostgREST, el esquema `auth` de GoTrue y `auth.uid()`. Un detalle de ese
archivo importa más de lo que parece: **los GRANT**. Sin ellos, cada consulta falla
con *permission denied* y un test de fuga de datos **pasa por el motivo equivocado**.
La trampa es silenciosa: el test se pone verde y no prueba nada.

Resultado: `npm run test:db` corre en 3 segundos, sin instalar nada, y está dentro de
`npm run verify`. El aislamiento entre inquilinos pasó de "argumentado" a
"comprobado en cada cambio".

## D-41 · La recursión que rompía las campañas enteras

En la **primera ejecución**, antes de llegar a ningún ataque:

```
ERROR: infinite recursion detected in policy for relation "campaign_characters"
```

Compartir un personaje en una campaña —la razón de existir de las campañas— fallaba
**siempre**. No para un intruso: para el dueño del personaje, en su propia mesa.

La causa es una propiedad de Postgres que no se deduce leyendo las políticas de a
una. `campaign_characters_insert` comprueba contra `characters`, y
`characters_select` comprueba contra `campaign_characters`:

```
campaign_characters (INSERT) → characters (SELECT) → campaign_characters
```

Postgres lleva la cuenta de **relaciones** en la pila de expansión de políticas, no
de políticas concretas. Que las dos implicadas sean de comandos distintos no lo
salva. La migración `0002` rompe el ciclo con funciones `security definer`, la misma
técnica que `0001` ya usaba para `workspace_members` — el patrón estaba, pero se
aplicó solo donde la recursión era evidente a simple vista.

**La lección no es sobre RLS.** Es que el código estaba razonado, revisado y
comentado, y la revisión no encontró esto porque exige simular el motor. Ejecutarlo
tardó tres segundos.

## D-42 · Probar el contrato del servidor sin el servidor

`sync-contract.sql` ejercita contra Postgres real las tres garantías que el código de
`push/route.ts` promete pero **no implementa** —las implementa la base de datos—:
que un reintento choque con la clave primaria y devuelva `23505`, que un
`update ... where version < N` no toque nada cuando otro se adelantó, y que el cursor
tolere los huecos que deja una transacción abortada.

Antes esto estaba probado contra un transporte falso que replicaba esas garantías: el
test comprobaba que la imitación imitaba.

Sigue faltando la instancia desplegada (T8) y la carrera entre transacciones que
confirman fuera de orden (T13), que necesita dos conexiones a la vez y el Postgres en
proceso tiene una.

## D-43 · Medir mal es peor que no medir

El presupuesto de rendimiento costó **tres mediciones equivocadas** antes de dar un
número en el que se pueda confiar. Vale la pena dejar las tres anotadas, porque cada
una es un error distinto y los tres son fáciles de repetir:

1. **Medí el arranque creyendo que medía la búsqueda.** El test cronometraba desde
   que se escribía hasta que aparecía un recuento, sin esperar antes a que la lista
   existiera. Daba 3 segundos, que era el primer pintado tras volcar 3.039
   definiciones.
2. **Esperé a un elemento que ya estaba en pantalla.** El recuento de la consulta
   anterior cumplía la condición al instante. La corrección: esperar a un resultado
   que no puede estar antes de buscarlo.
3. **Le cobré a la aplicación el coste del arnés.** `fill()` de Playwright tarda
   **2,8 s** en sus comprobaciones con la CPU a un cuarto. Era el 75% de lo medido.

Y una cuarta, del mismo tipo: el peso del JavaScript se sumaba de la cabecera
`content-length`, que Next no manda. Daba **1 KB** — un presupuesto que se cumple
siempre porque no mide nada. Con `encodedBodySize` del Resource Timing: **324 KB**.

Números reales, build de producción, CPU a un cuarto y 4G flojo: **LCP 908 ms ·
CLS 0,000 · JS 324 KB · búsqueda 951 ms**. Las tareas largas quedan en 495 ms de un
presupuesto de 600: dentro, pero sin margen (T15).

## D-44 · Una hipótesis plausible y falsa

Al ver que la búsqueda recorría las 3.039 definiciones sin índice, la conclusión
parecía obvia: falta un *debounce*, se están haciendo cuatro recorridos para escribir
"fire". Lo añadí y el tiempo bajó un 10%.

El debounce estaba bien, pero la explicación no: `fill()` escribe de una vez, así que
**nunca hubo cuatro consultas**. Instrumentando el código, un recorrido cuesta 246 ms
con la CPU a un cuarto, y el resto del tiempo estaba en otro lado (ver D-43).

El cambio se quedó porque una persona sí escribe letra por letra, y ahí sí son cuatro
recorridos encadenados. Pero el comentario que lo justificaba decía un número falso, y
se corrigió. **Un comentario que explica mal por qué existe un cambio es deuda**: el
próximo que lo lea lo va a creer.

## D-45 · axe no reemplaza a una persona, pero encuentra lo que una persona no mira

`tests/e2e/accessibility.spec.ts` corre axe-core sobre la página ya pintada: seis
pantallas, el asistente de creación, un diálogo abierto y el tema claro por separado.
**Cero infracciones de WCAG 2.1 A/AA**, en móvil y escritorio.

Se le añadió una comprobación que axe **no** hace: que las filas que se añaden solas
—los rasgos de una especie, los de una clase— tengan nombres accesibles **distintos**.
Tres botones llamados "Quitar" pasan todas las reglas de axe (cada uno tiene nombre) y
son indistinguibles leídos en voz alta.

Esto cierra T12 sin opinar: el tema claro era "el hermano flojo" por costumbre, no por
un defecto medible. Ahora tiene su propia auditoría y pasa.

## D-46 · Dos listas que decían cosas distintas

`test-results/` estaba en `.gitignore` pero no en `eslint.config.mjs`. Correr los E2E
y después `npm run lint` devolvía ~6.700 errores sobre bundles minificados de la
propia aplicación. Nadie lo había visto porque nadie había corrido las dos cosas
seguidas en el mismo árbol.

Con la carpeta ya renombrada, `.npmrc` también desapareció: forzaba `bash` con una
ruta absoluta que solo existe en una máquina concreta.

## D-47 · El test que envejeció

Al traducir los conjuros se cayeron dos tests. No estaban mal escritos: afirmaban
*"los conjuros todavía no están traducidos"* y *"Bola de fuego se llama Fireball"*.
Eran verdad cuando se escribieron, y codificaban el **estado del diccionario** como si
fuera una regla del sistema.

Reescritos para afirmar el mecanismo: uno busca, sea cual sea, una definición que el
diccionario no cubra —y si algún día no queda ninguna, lo dice—, y el otro comprueba
que la cobertura distingue "nombre traducido" de "texto traducido" en vez de dar un
porcentaje único que no significaría nada.

*Epílogo:* ese día llegó. Al cerrar el diccionario por nombres no quedó ninguna
definición sin cubrir y el test avisó con esas palabras (D-57). El camino que probaba
—qué pasa con lo que el diccionario no conoce— sigue importando para el contenido
propio, así que ahora se fabrica el caso en vez de esperar a encontrarlo.

## D-48 · Una especie no es una definición, son varias

Añadir especies y clases al editor de contenido propio rompía una simetría que hasta
ahora se sostenía sola: un formulario, una definición. Una especie **son sus rasgos**;
una clase son sus rasgos por nivel.

La salida fue que `buildDefinition` devuelva la definición principal **más sus
acompañantes**, y que el id del acompañante cuelgue del padre:

```
hb-a1b2c3d4:species:elfo-nocturno
hb-a1b2c3d4:species:elfo-nocturno:trait:vision-nocturna
```

De ahí salen tres cosas gratis: un rasgo siempre sabe de quién es sin tabla de
relaciones, la lista de contenido propio puede esconder los acompañantes contando los
dos puntos, y borrar el padre se lleva a los hijos.

Lo que el editor **no** pregunta es lo que el SRD ya decidió: el bonificador de
competencia por nivel y la forma de la tabla de espacios salen de
`standardProgression`. Pedirlos sería pedirle al usuario que copie una tabla que no
puede cambiar. Una clase casera se crea eligiendo dado de golpe, dos salvaciones, tipo
de lanzador y los rasgos; los veinte niveles se rellenan solos.

Y un detalle de interfaz que solo se ve usándolo: al pasar de cinco tipos a nueve, la
fila de selección seguía desplazándose en horizontal y **Especie y Clase quedaban
fuera de la vista**. Las dos funciones nuevas más grandes, invisibles. Una función que
no se ve no existe.

## Y una cosa que NO se arregló

En una captura del tema claro aparecía "**uardado** en este dispositivo": un círculo
tapaba la primera letra. Antes de tocar nada, midiendo el DOM: la fila tiene dos
hijos, no se solapan, y sobran 25 px. El círculo era el indicador de Next en modo
desarrollo, que no existe en producción.

Se anota porque el impulso de arreglar lo que se ve en una captura es fuerte, y el
arreglo habría sido un cambio real sobre un problema inexistente.

## El estado, sin adornos

| | Antes de esta tanda | Ahora |
|---|---|---|
| Tests unitarios | 203 | **264** |
| Tests E2E | 38 | **112** |
| Casos contra Postgres | 0 ejecutados | **48 ejecutados** |
| Infracciones WCAG (axe) | sin medir | **0**, 6 pantallas × 2 temas |
| Presupuesto de rendimiento | sin definir | definido y **medido** |
| Nombres del SRD en español | 91 | **2.241** (el 100%) |
| Homebrew | objetos y conjuros | **+ dotes, trasfondos, especies y clases** |

Lo que sigue sin estar hecho está en la tabla de deuda del plan, numerado, con el
motivo. Los dos que importan: nadie ha usado esto con un lector de pantalla (T14),
y la traducción cubre los nombres pero no la prosa (T10).

---

# ADENDA IV — TAKU, DE MASCOTA A PARTE DEL PRODUCTO

Integrar un personaje es fácil de hacer mal: se pega la imagen en una esquina,
se le añade un globo de diálogo y en una semana el usuario ha aprendido a no
mirar esa zona de la pantalla. Lo que sigue son las decisiones que se tomaron
para que eso no pasara, y los tres errores que hubo que corregir por el camino.

## D-51 · Las reglas de silencio son la funcionalidad

El módulo que decide si Taku habla se llama `cues.ts`, y de sus doscientas
líneas la mayoría son motivos para callarse:

| Regla | Por qué |
|---|---|
| Tiempo de gracia de 12 s | En una partida pasan cosas todo el tiempo. Sin esto, Taku hablaría encima de sí mismo. |
| Un consejo, una vez por sesión | Un consejo repetido deja de ser un consejo. |
| Prioridades | Un 20 natural interrumpe un consejo; un consejo no interrumpe nada. |
| Cerrar cuenta como hablar | Quien cierra una burbuja no quiere ver otra un segundo después. |
| Silenciable a la vista, en Perfil | Un acompañante del que no se puede escapar no es compañía. |

Son funciones puras, sin React, y de ahí que `tests/unit/taku.test.ts` pueda
provocar cada situación y comprobar que **no pasa nada**. Son 14 casos y la
mayoría afirman un silencio.

La misma regla se aplicó al redactar: cada frase tiene que decir algo que no
esté ya escrito en la pantalla. Eso descartó dos frases ya escritas —la de la
subclase y la del conflicto de sincronización— porque sus pantallas lo explican
mejor y con más sitio. También descartó el saludo del inicio, que duplicaba al
Taku grande del estado vacío.

## D-52 · La personalidad sale del movimiento, no de redibujar

El retrato es uno y no se toca. Los cinco ánimos —reposo, saludo, festejo,
preocupación, pensar— son transformaciones del sprite entero en CSS, con
`transform-origin` al 92% de la altura: un personaje con botas pivota desde el
suelo, y rotar desde el centro lo hace flotar.

La restricción resultó una ventaja: un solo archivo que se cachea una vez, en
lugar de un pliego de sprites por estado. Y con `prefers-reduced-motion` todo
se apaga por la regla global que ya existía, sin perder información: lo que
Taku comunica está en el texto de la burbuja, no en el salto.

## D-53 · Tres errores de integración

**La burbuja robaba toques.** El primer diseño ponía todo el globo en
`pointer-events: auto`. Sobre un botón, el toque moría ahí. Es la diferencia
entre "a veces me tapa un texto seis segundos" —se aguanta— y "me robó el
botón" —es un fallo—. Ahora el cuerpo es transparente al puntero y solo la cruz
de cerrar es pulsable. Tiene test propio: se le pregunta al navegador qué hay
en el centro de la burbuja, y la respuesta tiene que ser lo de abajo.

**Tapaba el subtítulo en las pantallas de cuenta.** Asomarse por detrás de la
tarjeta funcionaba, pero el trozo que sobresalía se montaba sobre el texto. Se
resolvió reservándole sitio arriba en vez de moverlo: el contenido gana
siempre.

**Dos Takus a la vez.** En el inicio vacío coincidían el del estado vacío y el
de la esquina con su burbuja, que además tapaba la descripción. El dato útil
—que todo se guarda sin cuenta y sin conexión— se movió al texto del estado
vacío, donde la persona ya está mirando.

Y un cuarto, de arquitectura: toda pantalla que ofrece una frase pasa a ser
consumidora del contexto, así que cada burbuja re-renderizaba la biblioteca con
sus sesenta resultados. El contexto está partido en dos: las acciones —que no
cambian nunca— y la presencia, que solo lee quien dibuja a Taku.

## D-54 · El hueco del chatbot, sin fingir que ya está

`assistant.ts` define la interfaz, el registro y el contexto que se le pasaría.
Lo que el panel **no** hace es mostrar un campo de texto: preguntar y quedarse
esperando es exactamente la clase de mentira que MASTER PROMPT §75 prohíbe.
Mientras `isAvailable()` devuelva false, el panel dice "todavía no sé conversar"
con esas palabras y ofrece lo que sí resuelve la pregunta: atajos a la regla o
al conjuro que se está buscando. El día que se registre un asistente, la
interfaz cambia sola.

El contexto que se armaría lleva la ruta y la actividad, y **nunca datos del
personaje**. Por dónde viaja la ficha de alguien es una decisión de privacidad,
no un detalle de implementación, y se toma cuando toque y a la vista.

## D-55 · Un favicon que no era un favicon

El archivo entregado como `favicon.ico` era un PNG renombrado: primero de 500×500
y 328 KB, después de 20×20 y 1,5 KB. Los navegadores actuales lo aceptan por
olfateo de contenido, pero no es el formato, y 20 píxeles se ven borrosos en
cualquier pantalla retina.

Como el proyecto no tiene librerías de imagen a propósito —los iconos se
generaban por código—, hubo que escribir el decodificador que faltaba:
`scripts/lib/png.mjs` hace decodificación, escalado e ICO real con solo `zlib`.
Dos detalles que se ven si se hacen mal:

- **Premultiplicar el alfa al reducir.** Sin eso, los píxeles transparentes
  —negros con alfa 0— arrastran su color al promedio y aparece un halo oscuro
  alrededor del contorno. En un personaje con brillo verde se nota enseguida.
- **Los enmascarables van al 64%.** El sistema los recorta con la forma que
  quiera; a tamaño completo, Taku pierde las botas y la cabeza.

De un retrato salen ahora once archivos, y el generador del d20 que producía
esos mismos nombres se retiró: dos scripts peleando por un archivo es una
reversión silenciosa esperando a ocurrir. La marca del dragón sigue viva en
`Logo.tsx`, que es SVG propio.

## D-56 · El banco de rendimiento no sirve de semáforo

Buscando el coste de Taku apareció algo peor: la misma medición, sin cambiar
una línea de código, dio **1.241 · 2.181 · 3.394 · 4.315 · 5.138 ms**.

Se persiguieron cuatro hipótesis falsas antes de mirar el dato: el reparto del
contexto, `will-change`, `backdrop-blur` y la sombra. Dos de esas cuatro
correcciones se quedaron porque son correctas por sí mismas —`will-change` en
algo que anima sin parar es el mal uso que advierte la especificación, y un
`backdrop-filter` permanente se recalcula bajo cada fotograma del sprite—, pero
la mejora que parecían dar estaba dentro del ruido.

Una varianza de 3-4x no puede detectar una regresión del 20%. El test dejó de
cronometrar el reloj de pared y pasó a medir el trabajo del hilo principal, que
es atribuible y además es lo que el usuario siente. Los topes quedaron donde
atrapan una catástrofe, y el comentario lo dice con esas palabras para que
nadie le crea una precisión que no tiene.

Coste real de Taku, de mediciones aisladas con la máquina en reposo: **unos
300 ms** sobre los ~950 ms de filtrar la biblioteca con la CPU a un cuarto.

## Dónde está Taku, y dónde NO

| Sitio | Qué hace |
|---|---|
| Esquina inferior izquierda | Presencia permanente y puerta del asistente. Se aparta cuando aparece el aviso de sin conexión. |
| Pantallas de cuenta | Asomándose por detrás de la tarjeta. El único sitio donde aparece por calidez y no para informar. |
| Estados vacíos de primera vez | Inicio, personajes, campañas, contenido propio. |
| 20 y 1 natural | Festejo y consuelo. |
| Caer a 0 y levantarse | Avisa de la salvación contra muerte, que es la regla que más se olvida. |
| Subir de nivel | Festejo en la pantalla a la que lleva. |
| Sin conexión | El aviso dice qué pasó; Taku dice que no pasa nada. |

Y donde **no** entra, por decisión:

- **El asistente de creación.** Doce pasos con la decisión siempre abajo: una
  burbuja ahí compite de frente con "Siguiente".
- **Los estados vacíos que no son la primera vez.** "Nada en esta categoría" no
  necesita un personaje; ponerlo ahí lo convierte en papel pintado.
- **Delante de un diálogo.** Vive en z-30, debajo de la barra lateral y de los
  diálogos.

---

# ADENDA V — CERRAR LA DEUDA, Y LO QUE APARECIÓ AL CERRARLA

Cinco de los seis asuntos de esta tanda no eran el trabajo que se había
apuntado: eran lo que el trabajo destapó al hacerlo. Traducir los nombres
dejó la barra de cobertura mintiendo. Añadir el editor de subclases reveló que
sin él una clase propia no se podía terminar. Y probar dos dispositivos exigió
antes arreglar el servidor de mentira con el que se probaban.

## D-57 · El diccionario cerró por nombres, y eso rompió la barra

Las 3.039 definiciones de las dos ediciones tienen nombre en español: 2.241
claves, porque muchas se comparten entre ediciones. Se puede buscar «Bola de
fuego», «Dragón rojo adulto» o «Herramientas de ladrón» y encontrarlos.

El problema llegó con la tarjeta de cobertura, que contaba `completo + parcial`
sobre el total. Con los nombres al 100%, esa cuenta daba **100% del contenido
está en español** con 1.547 entradas cuyo texto sigue en inglés. La propia
tarjeta existía para no contar esa mentira.

Así que `measureCoverage` pasó a distinguir dos cosas por tipo: `translated`
—tiene algo en español— y `full` —no deja nada en inglés—. La barra mide la
segunda, y la primera se dice aparte con sus palabras: «todos los nombres están
traducidos, así que podés buscar en español; en N entradas el texto sigue en
inglés». Los objetos mágicos son el caso que lo obligó: 624 con nombre, cero
con texto.

## D-58 · Una subclase que no existe no es un formulario que falta

El editor cubría clases enteras con su progresión 1–20, pero no subclases. Eso
parecía una casilla pendiente y era un callejón sin salida: `planLevelUp` solo
ofrece elegir subclase si hay alguna con el `classId` de la clase, y
`resolveCharacter` avisa de «subclase pendiente» al llegar al nivel que la
clase declara. Una clase casera arrastraba ese aviso para siempre, sin ninguna
forma de resolverlo desde la aplicación.

Por eso lo que prueba `tests/unit/homebrew-big-types.test.ts` no es que el
formulario guarde los campos, sino que el MOTOR resuelva: se construye la
clase, se mete en un índice de contenido junto al SRD y se le pide una subida
de nivel. Un test que solo mirara el JSON habría pasado igual el día que el
motor dejara de encontrarlas.

Cada subclase es una definición aparte con sus propios rasgos colgando de ella
—`…:class:vigia:subclase:senda-del-ojo:feature:ojo-abierto`— y no de la clase.
Si colgaran de la clase, al reeditar se recogerían como rasgos de clase y al
guardar se escribirían dos veces: todo personaje de la clase recibiría rasgos
de una subclase que no eligió.

## D-59 · El orden lo ponía IndexedDB

Al reeditar, «Senda del Ojo» y «Senda del Muro» volvían al revés. El borrador
se reconstruía filtrando la biblioteca por prefijo de id, y la biblioteca sale
de Dexie ordenada por clave: «del Muro» antes que «del Ojo».

La definición ya sabe su orden —`subclasses` es una lista, y `progression` va
por nivel—, así que ahora se lee de ahí. El test unitario no lo había visto
porque comparaba las dos listas ordenadas: escribí `.sort()` a los dos lados
para no tener que pensar en el orden, y con eso dejé de comprobarlo. Lo
encontró el test de navegador, que escribe en la segunda subclase y después
mira la primera.

## D-60 · El doble era más blando que el original

Para probar dos dispositivos a la vez hizo falta antes mirar el `FakeServer`.
El servidor real hace `.lt('version', snapshot.version)` y, si no actualiza
ninguna fila, devuelve `conflict`. El doble se limitaba a no escribir y
respondía `applied`.

Con eso, el escenario que se quería probar —los dos editan sin conexión, los
dos suben— terminaba con el segundo dispositivo diciendo «listo» y su cambio
tirado a la basura, sin conflicto y sin rastro. Un doble más permisivo que el
original no prueba el original: prueba un sistema que no existe.

Arreglado el doble, los cuatro casos nuevos son dos pilas completas —dos bases
IndexedDB, dos colas, dos cursores, dos servicios— que solo comparten el
servidor. Ningún objeto cruza de una a otra: si algo llega, llegó
sincronizando. Sigue sin ser un teléfono contra una computadora, y la tabla de
deuda lo dice con esas palabras.

## D-61 · Ocho reglas traducidas eran ocho resúmenes

«Daño y curación» pasaba de 1.846 palabras en inglés a 109 en español: el 6%.
«Pruebas de característica», el 5%. El texto traducido se muestra EN LUGAR del
original y la ficha lo declaraba traducido sin más matices. Quien jugaba en
español leía media regla creyendo haberla leído entera; quien jugaba en inglés
jugaba con otras reglas.

Las condiciones, en cambio, estaban al 110% —lo que se espera al traducir al
español—. La diferencia no se veía porque nadie la medía.

Las ocho se rehicieron enteras, y ahora hay un test que recorre todas las
traducciones y falla si alguna baja del 60% de las palabras del original. El
umbral es flojo a propósito: con el 60% no se atrapa una frase apretada, se
atrapa un resumen.

## D-62 · El tope de la tarea más larga estaba dentro del ruido

El presupuesto decía 400 ms y la tanda completa midió 479. Repetida cuatro
veces sin tocar una línea de código, la misma búsqueda dio **120 · 267 · 352 ·
479 ms**. El umbral caía dentro del rango medido: no era un umbral, era una
moneda al aire, y el mismo error que ya se había corregido en el reloj de pared
(D-56) seguía vivo dos líneas más abajo.

Subirlo a 900 no tapa una regresión —no hubo cambio de código entre el 120 y el
479—: deja de afirmar una precisión que esta máquina no da.

## D-63 · El SRD traía Markdown y la ficha lo enseñaba

Se descubrió comprobando cómo se veían las reglas recién traducidas. Los packs
traen Markdown dentro de cada párrafo —696 filas de tabla, 254 encabezados, 243
viñetas— y la ficha los volcaba en un `<p>` tal cual. La regla de Trampas
empezaba literalmente por `## Traps` y su tabla de CD se leía como una fila de
barras verticales.

Llevaba así desde que existe la biblioteca, en inglés, sin que nadie lo
apuntara: es el tipo de cosa que se ve solo cuando alguien abre esa pantalla a
leer en vez de a comprobar que carga.

`SrdText.tsx` es un intérprete deliberadamente pequeño —encabezados, listas,
tablas, negritas y nada más— sin librería nueva y sin `dangerouslySetInnerHTML`.
Eso último importa: el contenido propio y los paquetes importados pasan por el
mismo camino, y ninguno debería poder inyectar HTML por venir en una
descripción (MASTER PROMPT §77). Al construir nodos de React, un asterisco mal
puesto produce como mucho un texto raro.

El test que lo acompaña no prueba el componente: comprueba que el CONTENIDO
siga teniendo la forma que el intérprete sabe leer, incluida una regla que
habría pasado desapercibida —una fila de tabla sin su fila de guiones se
pintaría como párrafo, con las barras a la vista—.

La lista de la biblioteca tenía el mismo problema en pequeño: anunciaba la
regla como «## Traps Traps can be found…». Ahí no hace falta interpretar nada,
solo quitar las marcas.

## Lo que queda, con su número

| | |
|---|---|
| Prosa del SRD sin traducir | 1.546 entradas. Conjuros, objetos mágicos y rasgos de clase enteros; de las reglas quedan 17 con 20.388 palabras |
| Lector de pantalla | 20 minutos de una persona, con el guion de `docs/02-AUDITORIA-LECTOR-DE-PANTALLA.md` |
| Dos aparatos físicos | El ciclo está ejercitado en código; falta el cable |

---

# ADENDA VI · LA TRADUCCIÓN CERRÓ, Y LO QUE APARECIÓ AL CERRARLA

Esta tanda tenía un solo objetivo declarado: terminar la prosa del SRD. Se
terminó. Lo demás son tres cosas que solo se ven desde el final.

| | Antes de esta tanda | Ahora |
|---|---|---|
| Definiciones con nombre en español | 3.039 (el 100%) | 3.039 (el 100%) |
| Definiciones con TEXTO en español | 55 | **1.601** (todas las que tienen texto) |
| Palabras traducidas | ~9.000 | **198.201** |
| Entradas con prosa en inglés | 1.546 | **0** |
| Tamaño del diccionario | 0,2 MB | **1,4 MB** |

## D-64 · Lo que faltaba eran 198.201 palabras, no una tarea

De las 3.039 definiciones del SRD en sus dos ediciones, 1.438 no traen texto
—son entradas que solo aportan nombre y datos— y 1.601 sí. Esas 1.601 están
traducidas: los 319 conjuros de 5.1, los 339 de 5.2, los 624 objetos mágicos,
los 407 rasgos de clase, el equipo, las reglas, los rasgos de especie.

La cuenta que importa no es cuántas entradas, sino cuántas palabras: 198.201.
Por eso se hizo por tandas, con las herramientas del scratchpad —volcar rangos
enteros, traducir, expandir a claves, fusionar— y no de una sentada.

## D-65 · El inglés del SRD 5.2 está roto, y traducirlo fue lo que lo destapó

`data/srd-raw/2024/Magic-Items.json` viene de la API pública de 5e, y su campo
`desc` está mal armado en una parte de los objetos mágicos. No es una sospecha:

- **Cada objeto es UN solo párrafo** con saltos de línea embebidos, mientras
  que los de 5.1 vienen bien separados.
- **Las tablas vienen aplastadas sin separadores**, a veces con filas fuera de
  orden y a veces con filas que directamente no están —la Baraja misteriosa
  trae 11 de 22; el Anillo de resistencia anuncia una tabla que no existe—.
- **Hay párrafos asignados al objeto equivocado.** El caso más claro:
  `potion-of-gaseous-form` tiene como descripción entera la cadena
  `"Potion  \n Potion of Healing    (supreme)"`. El texto de cinco pociones
  —Volar, Curación, Forma gaseosa, Heroísmo y Fuerza de gigante— está mezclado
  entre ellas, y lo mismo pasa entre la Esfera de aniquilación y cuatro
  bastones.

En `es-419.json` cada fragmento se devolvió a su objeto, porque las dos mitades
existen en el original y juntarlas no es inventar nada. Lo que NO se hizo fue
rellenar las filas ausentes.

Consecuencia incómoda y honesta: **en esos objetos el español es hoy más
correcto que el inglés**, y quien lea la app en inglés sigue viendo la cadena
rota. Arreglar el origen es trabajo aparte y está en la tabla de deuda.

## D-66 · Tres tests se cayeron al terminar, y los tres decían lo mismo

Al llegar la cobertura al 100%, tres tests de `translation.test.ts` fallaron:

- `expect(items.full).toBe(0)` —los objetos mágicos ya tienen texto—
- `expect(coverage.partial).toBeGreaterThan(0)` —ya no falta nada—
- el que buscaba «una entrada cualquiera en estado parcial» —ya no hay ninguna—

Es la tercera vez en este proyecto que un test guarda un ESTADO pasajero como
si fuera una regla. Las anteriores fueron `coverage.none > 0` y
`partial > full`. El patrón es siempre el mismo: la afirmación pasa hoy, y se
cae el día que el trabajo avanza, sin que nada esté mal.

Los tres se reescribieron para **fabricar** el caso —una superposición con solo
el nombre— en vez de buscarlo en el diccionario. Y el que contaba lo que falta
pasó a comprobar la invariante de verdad: `partial` tiene que valer
exactamente la cantidad de definiciones a las que les queda prosa en inglés. Si
entra contenido sin traducir y la barra sigue en 100%, ahora se cae.

## D-67 · Una barra al 100% no puede seguir diciendo «faltan N»

`TranslationCoverageCard` decía «en N entradas el texto sigue en inglés». Con
N = 0 la frase es falsa. Pero cambiarla por «está todo» la volvería falsa en
sentido contrario en cuanto el SRD sume una definición.

El texto se bifurca: con `pending === 0` dice que no queda nada en inglés; con
`pending > 0` vuelve solo a decir cuántas faltan. La tarjeta sigue existiendo
para no cantar victoria antes de tiempo (MASTER PROMPT §75), y ahora tampoco la
canta después.

## Lo que queda, con su número

| | |
|---|---|
| Inglés roto en los objetos mágicos de 5.2 | Origen en `data/srd-raw/2024/Magic-Items.json`. Afecta a ~15 entradas |
| Lector de pantalla | 20 minutos de una persona, con el guion de `docs/02-AUDITORIA-LECTOR-DE-PANTALLA.md` |
| Dos aparatos físicos | El ciclo está ejercitado en código; falta el cable |
| Rotar las credenciales de Supabase | Aparecieron en una transcripción; hay que cambiarlas desde el panel |

---

# ADENDA VII · EL REPASO DE LA TRADUCCIÓN, Y LO QUE ENCONTRÓ

Leer 1.601 textos a ojo no es una revisión: es una ilusión de revisión. Lo que
sí se puede comprobar entero y sin criterio son los **números**, porque son lo
único que no puede cambiar al traducir. Un conjuro que en inglés inflige 4d6 y
en español 4d8 está mal, por bien que suene la frase.

El repaso comparó, texto contra texto, cuatro cosas: expresiones de dados
(`4d6`), distancias y pesos, CD y porcentajes, y monedas.

## D-68 · Falsos positivos que enseñan cómo escribe el español

De 122 diferencias, **ninguna era un error de traducción**. Vale la pena por
qué, porque explica el idioma:

- **El español elide la unidad repetida.** «a straight wall up to 100 feet
  long, 20 feet high, and 5 feet thick» → «un muro recto de hasta 100 pies de
  largo, 20 de alto y 5 de grosor». Los tres números están; dos veces «pies»
  no. Un comparador ingenuo ve que faltan dos magnitudes.
- **La CD no va pegada al número.** El inglés escribe `DC 15`; el español,
  «CD de salvación 15» o «La CD para ver la placa de presión … es 15». Buscar
  `CD\s*\d+` no encuentra ninguna de las dos.
- **El separador de miles es un espacio.** «65 000 po» es la forma correcta en
  español, y parte el número en dos para cualquier expresión regular.
- **El inglés roto pega las tablas.** `Healing2d4` y `1d10Damage Type` no
  tienen frontera de palabra, así que el original parece tener menos dados que
  la traducción. Es el defecto de D-65 visto desde otro ángulo.

## D-69 · Un error real, y el guardián que no lo atrapó

**Archidruida** perdía su última oración: «You gain this benefit in both your
normal shape and your beast shape from Wild Shape». Es una regla, no un adorno.

No lo encontró la comparación de números —no tiene ninguno— sino la de LARGO,
al 69,5% del original. El test que ya existía usaba un umbral del 60%, puesto
para atrapar resúmenes del 6%, y esa oración pasaba por debajo del radar.

El umbral subió al 70%. El texto más corto del diccionario está en 70,19%, así
que queda margen para el español apretado —«Un carcaj guarda hasta 20 flechas»
es un 75% y está completo— y no queda para una oración perdida. Y el recuento
ahora ignora los textos de menos de quince palabras, donde la proporción no
significa nada: «# Combat» son dos palabras y «# Combate» una.

## D-70 · «NaN PO», encontrado de rebote

Dos tests E2E se cayeron al traducir la prosa, por la misma razón tonta:
`getByText('Tiradas de salvación')` encontraba dos elementos, porque la frase
ahora aparece también dentro de la descripción traducida de un rasgo. El test
no comprobaba el encabezado; comprobaba que esas palabras existieran.

Al mirar la captura del fallo apareció otra cosa, que no tenía nada que ver con
la traducción y llevaba ahí desde siempre: **la ficha decía «Dinero: NaN PO»**.

El SRD da el oro inicial del trasfondo como `{quantity: 15, unit: "gp"}`. El
volcado lo copiaba tal cual en un campo que el esquema declara entero, y
`formatCurrency` se lo pasaba a `Intl.NumberFormat`. Cualquier personaje con
trasfondo Acólito —el único que trae el SRD 5.1— mostraba `NaN`.

El filtro que omite las denominaciones en cero no lo atrapaba porque `NaN !== 0`
es cierto. Ahora se arregla en los dos sitios: el volcado convierte a número, y
el formateador descarta lo que no sea finito. Mostrar una cifra falsa es peor
que no mostrar la denominación.

| | |
|---|---|
| Textos repasados | 1.601 |
| Diferencias numéricas señaladas | 122 |
| Errores reales de traducción | **1** (Archidruida) |
| Defectos de la app encontrados de paso | **1** («NaN PO») |
| Tests nuevos | 2 · umbral de resumen subido del 60% al 70% |

## D-71 · La suite E2E no es inestable: el servidor de desarrollo lo es

Tres corridas de `npm run e2e` dieron **tres conjuntos de fallos distintos**:
primero «valores derivados» y las capturas; después «subir de nivel» en móvil y
«mejora de característica» en escritorio; después Taku, campañas y las capturas.
De 112 tests pasaban entre 92 y 102, nunca los mismos.

Dos de esos fallos eran reales —localizadores de texto suelto que la traducción
volvió ambiguos, D-70— y se arreglaron. El resto eran **timeouts**: «no se
encontró el botón» tras 90, 150 o 240 segundos. Ninguno era una violación de
modo estricto, que es la firma de un defecto de verdad.

`npm run e2e` arranca `next dev`. Cada primera visita a una ruta dispara una
compilación de webpack, y 112 tests en dos proyectos contra un solo servidor de
desarrollo son muchas compilaciones compitiendo. Con el mismo código, contra el
build de producción:

```
npm run build && npx next start -p 3100
PLAYWRIGHT_BASE_URL=http://localhost:3100 npx playwright test
```

**112 de 112, en 9,6 minutos** —frente a 21 minutos y cuatro fallos contra
`next dev`—. Y los presupuestos de rendimiento, medidos con la CPU estrangulada:

| | Medido | Presupuesto |
|---|---|---|
| LCP | 896 ms | 2.500 |
| CLS | 0,000 | 0,1 |
| Tareas largas al arrancar | 570 ms | 3.500 |
| JavaScript | 334 KB | 400 |
| Búsqueda sobre 3.039 definiciones · tarea más larga | 79 ms | 900 |

Lo que esa tabla contesta, y era la pregunta incómoda de esta tanda: el
diccionario pasó de 0,2 MB a **1,4 MB** y no movió el presupuesto de JavaScript
ni un kilobyte. Porque la traducción se sirve como DATOS y la precachea el
service worker, no viaja en el bundle. La decisión de la FASE 2 —«el contenido
NO va en el bundle»— es lo que permite que el diccionario crezca siete veces sin
que nadie lo note al abrir la aplicación.

# ADENDA VIII · ARREGLAR EL VOLCADO ROTO Y PASAR LOS CAMPOS

Dos deudas que quedaban de la tanda anterior, T17 y T18, y que se hicieron en
ese orden a propósito: mientras el volcado estuviera roto, `range` tenía
valores como `"120 feet Component: V, S"` y el diccionario de T18 habría
acabado guardando la basura. Arreglado el volcado, los alcances distintos
bajaron de 23 a 18 y el diccionario quedó limpio.

## D-72 · El volcado de 5.2 pierde cosas de tres maneras distintas

La API pública de 5e entrega cada objeto mágico de 5.2 como **una sola cadena**,
y por el camino pierde tres cosas que no se parecen entre sí:

1. **Párrafos que van a parar a otro objeto.** `potion-of-gaseous-form` tenía
   como descripción entera `"Potion of Healing (supreme)"`, y el texto de cinco
   pociones estaba rotado entre ellas. Lo mismo entre la esfera de aniquilación
   y cuatro bastones.
2. **Tablas aplastadas.** Las filas venían sin separador, pegadas en un
   renglón: `1d100  Outer Plane  1d100  Outer Plane 01-05 Abyss    55-59
   Gehenna`. En otras —la bolsa de trucos— cada celda venía como su propio
   párrafo, y la ficha pintaba sesenta y ocho renglones de una palabra.
3. **Espacios sueltos.** `expendthe`, `savingthrow`, `1d10plus`, `40foot`,
   `DC13`, `duergar.Toughness`.

Los tres pedían respuestas distintas, y esa es la parte que vale la pena
recordar.

**Lo que se puede arreglar con una regla, se arregla con una regla.** El corte
de párrafo perdido —un punto o dos puntos pegados a una mayúscula— aparece
**87 veces en 5.2 y ni una sola vez en las 3.813 cadenas de 5.1**. Ese contraste
es lo que lo convierte en regla y no en adivinanza: si el patrón fuera prosa
normal, 5.1 lo tendría también. Vive en `descOf` y se aplica solo a las cadenas
que 5.2 marca como suyas.

**Lo que NO se puede, se escribe a mano y se guarda como datos.** Los espacios
perdidos parecen un caso de regla y no lo son. Una regla que parta una palabra
larga en dos trozos reconocibles rompería `horseshoe`, `mayonnaise` y `pigment`,
que también son palabras que 5.1 no usa. Así que son **62 pares literales** en
`data/srd-raw/2024/pegados.fix.json`, uno por uno, salidos de un censo. La única
regla es la de `40foot` y `1d10plus`: un dígito pegado a una unidad no es
ambiguo en inglés.

**Las 49 entradas rearmadas no inventan nada.** Cada párrafo de
`magic-items.fix.json` existe palabra por palabra en el volcado original; lo
único que se agrega es el formato de tabla en Markdown. Y —esto es lo
importante— **las filas que el volcado no trae siguen sin estar**: la Baraja
misteriosa tiene 11 de 22, la Varita de las maravillas 9 de 20, el Anillo de
resistencia anuncia una tabla que no existe. Inventarlas sería peor que el bug,
porque un hueco se ve y una fila inventada no.

Después de esto, las 262 descripciones de 5.2 y sus traducciones tienen
**exactamente las mismas tablas** —antes había once objetos donde el español
tenía una tabla y el inglés un renglón aplastado—. Los párrafos siguen sin
cuadrar en quince, y ahí está bien: el traductor junta o parte un párrafo
cuando el castellano lo pide. Que no se haya perdido nada en esos quince lo
dice el guardián de longitud: los quince están entre el **105% y el 118%** de
las palabras del original, que es lo que hace el español al traducir del
inglés. Si alguno hubiera perdido una frase estaría por debajo del 70% y el
test fallaría. El repaso numérico pasó de
122 diferencias a 57 —43 de distancias, 6 de CD, 8 de monedas—, todas ellas
falsos positivos ya explicados en D-68. Las de dados, las únicas que podían
ser un error real, quedaron en **cero**.

Hay dos tests que vigilan esto, y no comprueban que hoy esté bien sino que el
arreglo siga aplicándose: uno falla si vuelve a aparecer un párrafo pegado en
el contenido servido, y otro falla el día que un parche deje de hacer falta o
apunte a un objeto que ya no existe. Un parche que envejece en silencio es peor
que no tenerlo.

### Lo que este trabajo destapó y no arregló

El volcado de 5.2 **no trae el campo `dc` en ningún conjuro**: los 339 tienen
`save` vacío, mientras que en 5.1 lo traen 92. La información está en la prosa,
así que no se pierde nada visible, pero cualquier cosa que quiera leer la
salvación de un conjuro de 5.2 va a encontrar el hueco.

Y una discrepancia de una fila, en 5.1: la varita de las maravillas tiene en
español el resultado `16-20` («Lanzás ráfaga de viento») que el volcado **no
trae**. Es el texto correcto del SRD, pero no podemos atestiguarlo desde
nuestra fuente. Queda anotado aquí en vez de borrado o escondido: es la única
línea de la aplicación que no se puede rastrear hasta el volcado.

## D-73 · Los campos no son prosa, y traducirlos por valor entero era la trampa

La ficha de Bola de fuego decía «1 action», «150 feet», «Instantaneous» y «DEX»
debajo del nombre y del texto, los dos en español. Era lo más visible que
quedaba sin pasar, y la tentación era obvia: un diccionario de las 60 cadenas
distintas y listo.

Sería la respuesta equivocada. Esas 60 cadenas están hechas de **doce piezas**:
un número y una unidad. Un diccionario por valor entero habría que tocarlo la
primera vez que el SRD escriba «45 feet», y hasta entonces la ficha diría
«45 feet» en medio del castellano — un hueco que nadie ve hasta que un usuario
lo encuentra.

`src/domain/content/fields.ts` las arma por piezas: respeta el número, busca la
unidad, concuerda el singular con el plural («1 pie» / «5 pies») y compone los
prefijos («up to 1 minute» → «Hasta 1 minuto»). Hay un test que le pide tres
valores que **no existen en el contenido** —«45 feet», «up to 3 minutes», «17
rounds»— precisamente para que no se pueda pasar con una lista.

Las ocho condiciones largas sí son prosa —«Reaction, which you take when you
see a creature within 60 feet of yourself casting a spell with Verbal, Somatic,
or Material components»— y van enteras, traducidas a mano.

Lo que no encaja en ninguna de las dos formas **se devuelve en inglés**. Es la
misma decisión de la tarjeta de cobertura: preferimos que el hueco se vea a
inventar algo que nadie revisó. Y tiene un efecto secundario útil: el conjuro
propio de un usuario, que el editor guarda ya en español, pasa sin que nadie lo
toque.

Buscando el primero aparecieron los demás, todos del mismo tipo: el tipo de
criatura («Mediano humanoid»), el precio en `gp`, la recarga `dawn`, las siglas
del bloque de estadísticas —STR, DEX, CON— y el campo de idiomas del monstruo,
que el SRD mete en una sola cadena mezclando nombres propios («Common,
Draconic»), alcances («telepathy 120 ft.») y frases sueltas («understands the
languages of its creator but can't speak»). Son 67 trozos, no 81 valores.

Ese último dio dos lecciones más. La primera: partir por comas a ciegas rompe
las cláusulas que llevan comas dentro, y «understands Common, Elvish, and
Sylvan but can't speak» salía como «entiende el común, Élfico, y silvano». Se
prueba primero el trozo **más largo** que el diccionario conozca, y solo si
ninguno encaja se corta por una coma.

La segunda es un riesgo que antes no existía: los nombres de idioma están ahora
**dos veces**, en `es-419.json` y en el código, porque el bloque de
estadísticas no pasa por la traducción por id. Si alguien retoca uno y no el
otro, el buscador deja de encontrar por un nombre lo que muestra con el otro.
Hay un test que compara las dos listas.

### El test que casi se escribe mal, por cuarta vez

La primera versión del test de cobertura decía «ningún tipo de criatura queda
en inglés» y lo comprobaba viendo si la traducción era distinta del original.
Falló con `elemental` y `celestial` — que se escriben **igual en los dos
idiomas**. Falló bien: si hubiera pasado, habría dado por traducidas palabras
que nadie miró.

Es la cuarta vez en este proyecto que un test codifica un ESTADO en lugar del
MECANISMO, y la respuesta vuelve a ser la misma: comprobar la pertenencia al
diccionario, no la forma de la salida.

### Lo que queda, con números

Dos campos de prosa que la superposición no toca, porque solo traduce `name` y
`description`: el **material del conjuro** (355 cadenas, 3.019 palabras) y las
**acciones del monstruo** (853 entradas en 333 criaturas, 30.568 palabras). No
es un diccionario, es traducción; queda abierto como T19.

# ADENDA IX · EL BLOQUE DE ESTADÍSTICAS, Y LO QUE ESCONDÍA

T19 estaba anotado como «dos campos de prosa que la superposición no toca».
Eran cinco, y uno de ellos no se veía porque **la ficha no lo pintaba**.

## D-74 · Traducir un bloque de estadísticas no es traducir prosa

El inventario decía: el material del conjuro (355 cadenas) y las acciones del
monstruo (853). Al ir a buscarlas aparecieron dos arrays más con la misma
forma —`specialAbilities` (559) y `legendaryActions` (107)—, y de esos dos el
primero contenía la **Resistencia legendaria** del dragón, su **Anfibio**, su
**Presencia aterradora**. Estaban en el contenido desde el primer volcado. La
ficha mostraba `actions` y nada más.

Eso es peor que una traducción pendiente: es una regla que existe, que el
motor tiene cargada, y que quien juega no ve. Ahora se pintan los tres.

### Por qué los bloques no van en `fields`

`TranslationEntry` ya traía un `fields?: Record<string, string>` sin usar, y la
tentación era meterlo todo ahí. No sirve: un apartado es un PAR con título
—«Ataque múltiple» + el texto—, y la ficha lo pinta por posición. Metido como
cadena suelta se pierde el título, y con él la forma que hace legible un
bloque de estadísticas.

Así que `fields` se quedó para el material del conjuro, que sí es una cadena
suelta, y los bloques tienen su propio tipo.

### La regla que evita que desaparezca una acción

Un texto sin traducir se ve: queda en inglés. Un bloque con un apartado de
menos **no se ve**: el dragón simplemente tiene dos acciones en vez de tres, y
nadie sospecha nada hasta que alguien busca el Ataque de ala y no está.

Por eso un bloque se aplica **entero o nada**:

```ts
if (traducidos !== undefined && traducidos.length === originales.length) {
  bloques[field] = traducidos.map((b) => ({ ...b }));
} else {
  bloquesPendientes = true;      // se queda el original y el estado es `partial`
}
```

El día que el SRD le agregue una acción a un monstruo, la superposición vieja
deja de aplicarse a ese bloque y la tarjeta de cobertura lo cuenta como
pendiente. Es exactamente lo contrario de fallar en silencio.

## D-75 · Lo que se traduce a mano y lo que se genera

Son 1.125 textos distintos y 39.809 palabras. Escribirlos todos a mano no es
más fiel: **400 de ellos son la misma frase con otros números**.

```
Melee Weapon Attack: +7 to hit, reach 5 ft., one target. Hit: 13 (2d8 + 4) piercing damage.
```

Escrita cuarenta veces a mano, esa frase sale de cuarenta maneras ligeramente
distintas. Generada, sale siempre igual. Así que la línea de ataque se compone
—tipo, bonificador, alcance, objetivo, daño— y **lo que no encaja EXACTO en la
plantilla no se toca**: queda para traducir a mano. De 1.125 textos, la
plantilla cubrió 275 y el resto se escribió uno por uno.

La forma en español no se inventó para la ocasión: es la que ya usaba el
diccionario en `apparatus-of-the-crab`, «Ataque con arma cuerpo a cuerpo: +8 al
impacto, alcance 5 pies, un objetivo. Impacto: 7 (2d6) de daño contundente».

### El error que el índice numérico garantizaba

La primera tanda —343 nombres de apartado— se tradujo con el número de fila
como clave. Me salté dos entradas en la mitad y **todo lo de abajo quedó
corrido**: «Gibbering» pasó a ser «Parloteo» dos filas más arriba de donde
correspondía, y de ahí hasta el final.

No lo encontró una revisión: lo encontró que al final sobraban dos claves. Con
el texto inglés como clave eso es imposible por construcción: si falta una,
falta esa y nada más. Todas las tandas siguientes se hicieron así.

### El guardián numérico, y el falso positivo que hay que desactivar

Cada tanda pasa por un comparador que extrae los números de las dos versiones
y exige que coincidan. Atrapó dos cosas reales —«roll a d6» traducido como
«tirá 1d6», que cambia la notación— y un montón de ruido:

- **El inglés separa los miles con coma y el español no.** «1,000 gp» da los
  números `1` y `000`; «1000 po» da `1000`. Hay que juntar los miles antes de
  comparar, y además cuidar que `1,000gp` (sin espacio, como lo escribe 5.1) no
  se escape por el borde de la expresión regular.
- **La RAE no separa hasta cinco cifras**, así que «1000 po» y «25 000 po» son
  las dos formas correctas y las dos tienen que pasar.

## Lo que quedó comprobado

- **1.125 / 1.125** textos de bloque, **355 / 355** materiales, **343 / 343**
  nombres. Cero problemas de número, de vacío o de sin-traducir.
- La cobertura honesta —la que exige que no quede NADA en inglés, ahora también
  en los bloques y en el material— pasó de **2.329/3.039 a 3.039/3.039**.
- El diccionario pasó de 1,4 MB a **1,88 MB** y de 198.201 a **261.455**
  palabras.

### Lo que este trabajo destapó y no arregló

La medusa, el basilisco y el gorgón comparten la estructura de «mirada
petrificante» pero el SRD la escribe distinta en cada uno, y así quedó: se
tradujo lo que dice cada bloque, no lo que debería decir. Y los tres monstruos
de 5.2 usan la sintaxis nueva («Tirada de salvación de Destreza: CD 17…»)
mientras los 334 de 5.1 usan la vieja: son dos ediciones, y mezclarlas sería
justo lo que el producto promete no hacer.

---

# ADENDA X · LA FUSIÓN CON LA HOJA OFICIAL DE 2024

Se comparó la ficha de la aplicación con la hoja de personaje oficial de D&D
2024 en castellano, página por página. La hoja tenía diez cosas que la ficha no
mostraba. **Nueve de las diez ya estaban calculadas en `CharacterSheet`**: no
faltaba motor, faltaba pintarlas.

## D-76 · Un dato calculado que ninguna pantalla pinta no existe

Éste es el hallazgo, y se repitió tres veces en la misma revisión:

| Lo que faltaba          | Dónde estaba ya                          |
| ----------------------- | ---------------------------------------- |
| Dados de golpe          | `sheet.hitDice`, y el descanso corto los gastaba |
| Salvaciones contra muerte | `hitpoints.ts`, con el 20 natural y el 1 doble |
| Competencias con equipo | `sheet.proficiencies`, solo en el creador |

El caso de las salvaciones contra muerte es el que más incomoda: el dominio
lleva la regla completa desde el primer día —acumula, topa en tres, un 1
natural cuenta doble, un 20 natural levanta con 1 PG— y **un personaje a 0 PG
las tenía contándose sin que quien juega pudiera verlas**. La regla que más se
olvida en la mesa era precisamente la que la aplicación se guardaba.

Por eso los tests de esta adenda (`tests/unit/official-sheet.test.ts`) no
comprueban que el dato exista. Comprueban que la ficha **no pueda volver a
perderlo** sin que algo falle. Y los de `tests/e2e/official-sheet.spec.ts`
cubren los dos paneles que el recorrido de capturas no alcanza, porque dependen
de un estado concreto: 0 PG y reglas de 2024.

## D-77 · Tres diccionarios a medias, y ninguno avisaba

Al pintar los bloques nuevos salieron a la luz tres listas incompletas. Las
tres fallaban igual: **el respaldo devuelve algo que parece correcto**, así que
nadie las miró.

1. **Competencias con equipo** — la ficha mostraba `all-armor`,
   `simple-weapons`, `shields`. No había diccionario.
2. **Recursos de clase** — `RESOURCE_LABELS` cubría 19 de las 39 claves de los
   dos volcados. El panel de RECURSOS decía «Second wind uses» y «Weapon
   mastery» porque el respaldo se limita a quitarle los guiones bajos a la
   clave: sale una frase en inglés bien formada, que es lo peor que puede
   pasarle a un valor sin traducir.
3. **Las dos escrituras del mismo objeto** — el volcado trae `thieves-tools` y
   `tool-thieves-tools`. Traducidas, el pícaro mostraba dos veces
   «Herramientas de ladrón». Se unen DESPUÉS de traducir, que es donde se ve
   que chocan.

### El vocabulario no se eligió en el código

Los nombres de los recursos son **los que ya usa el overlay de traducción**
para ese mismo rasgo. Si no coincidieran, el mismo rasgo se llamaría de dos
maneras en la misma pantalla —el panel de recursos arriba, la lista de
aptitudes abajo—, que es exactamente lo que pasaba con «Invocaciones» frente a
«Invocaciones sobrenaturales». Se alinearon las tres que ya estaban y
discrepaban (`invocations_known`, `mystic_arcanum_level_6`).

### Una lista cerrada y otra abierta

`PROFICIENCY_ES` se resuelve con `lookup`, que **deja pasar lo que no conoce**,
porque el editor de Homebrew guarda estas competencias como texto libre
(`z.array(z.string())` en `schemas.ts`). Una clase propia puede traer cualquier
palabra y tiene que salir tal como la escribió su autor. Los nueve nombres del
diccionario son todos los que aparecen en los dos volcados del SRD; el décimo,
`heavy-armor`, no sale en ninguno —el guerrero recibe `all-armor`— pero es el
hermano que falta de una enumeración que la propia aplicación acepta.

## D-78 · Las siglas de moneda: la hoja gana a la especificación

La especificación fijaba `PP` para el **platino** y `PA` para la plata, y
avisaba del riesgo en su propio comentario: «`PP` se lee como plata para muchos
jugadores». La hoja oficial lo resuelve al contrario: `PP` es **plata** y `PPT`
platino.

Con las dos delante, la misma sigla significaba dos monedas distintas según si
mirabas la aplicación o el papel. Manda la hoja, porque es la que el jugador
tiene en la mesa. **Se cambió también el orden** —ahora ascendente por valor,
`PC · PP · PE · PO · PPT`, como en el papel— y eso sí revierte una decisión
deliberada de la especificación, que encabezaba con el oro.

## Lo que la fusión NO trajo

- **Los títulos de los paneles del modo Juego siguen siendo `span`, no
  encabezados.** Un lector de pantalla no puede recorrer la pantalla por
  encabezados. Es así en toda la pantalla desde antes, no algo que trajera la
  fusión, y se arregla entero en T14.
- **La sintonización** se pinta con sus tres ranuras siempre visibles, incluso
  vacías, como en el papel. El aviso por pasarse de tres ya lo daba el motor
  (`attunement.overLimit`).
- **La inspiración heroica es solo de 2024.** En 2014 el panel no se pinta:
  la inspiración de 2014 es otra regla y mezclarlas sería inventar.

---

# ADENDA XI · LA AUDITORÍA CON LECTOR DE PANTALLA, Y LO QUE ENCONTRÓ (T14)

`docs/02-AUDITORIA-LECTOR-DE-PANTALLA.md` decía, con razón, que una máquina no
puede juzgar si lo que se ESCUCHA tiene sentido. De ahí se había sacado una
conclusión más ancha de la cuenta: que la auditoría entera había que esperarla.

Buena parte de sus seis pruebas no es cuestión de criterio. Es si la
información llega al **árbol de accesibilidad**, que es literalmente lo que un
lector de pantalla consume. Eso se recorrió, y salieron **seis fallos**.

## D-79 · axe-core comprueba que haya nombre, no que el nombre sirva

Cero infracciones de WCAG AA en seis pantallas y dos temas, y aun así:

| Dónde | Qué pasaba | Por qué axe no lo ve |
| --- | --- | --- |
| Creador, cada paso | El paso cambiaba en silencio | Los párrafos existen y tienen texto |
| Creador, «Siguiente» bloqueado | `disabled` nativo lo saca del recorrido por tabulador | Un botón deshabilitado es válido |
| Biblioteca | El contador de resultados cambiaba sin anunciarse | Es un párrafo correcto |
| Avisos | Dos «Deshacer» apilados, con el mismo nombre | Los dos TIENEN nombre |
| Ficha, al abrirla | Cantaba los PG sin que nadie lo pidiera | La región viva está bien formada |
| Ficha, cerrar un diálogo | El foco acababa en `<body>` | No es un problema de marcado |

Los cuatro primeros son información que existe en pantalla y **no llega**. Los
dos últimos son peores, y de eso va el resto de la adenda.

## D-80 · Dos arreglos que estaban escritos y no funcionaban

Es el hallazgo que justifica haber medido en vez de leer.

**El anuncio de los puntos de golpe.** El comentario del panel decía que la
región viva «empieza vacía a propósito», y explicaba por qué: cantarlos al
abrir la ficha sería hablar sin que nadie pregunte. La intención era correcta.
El código no la cumplía: vigilaba el valor MOSTRADO, que sale de
`Math.min(guardado, máximo)`, y el máximo se mueve solo mientras la ficha se
hidrata. Entrar a cualquier personaje disparaba el anuncio. Y la región es
`assertive`, así que ni esperaba turno: **cortaba lo que el lector estuviera
diciendo**.

Ahora se vigila `sheet.state.hitPoints.current`, el valor guardado, que no se
mueve solo: solo cambia cuando un comando lo cambia, que es exactamente cuando
hay algo que anunciar.

**La devolución del foco.** `Sheet` tiene treinta líneas de comentario
explicando que Radix no puede devolver el foco sin un `Dialog.Trigger`, que sin
eso termina en `<body>`, y que por eso se recuerda a mano quién lo tenía. El
diagnóstico es exacto. La implementación guardaba `document.activeElement`
dentro de `onOpenAutoFocus`.

Y aquí está lo interesante: **funcionaba en Homebrew y no en la ficha**. Hay un
test en `keyboard.spec.ts` que comprueba la devolución del foco, pasa, y cubre
el diálogo de Homebrew. El de puntos de golpe, con el mismo componente, dejaba
el foco en el cuerpo del documento.

No se persiguió por qué una pantalla sí y la otra no. Depender de cuándo llega
un evento y de qué tiene el foco en ese instante es frágil por construcción, y
el problema no lo necesita: ahora un registro de módulo anota el último
elemento enfocado **fuera** de cualquier diálogo, y al cerrar se lo devuelve en
el cuadro siguiente. No depende del evento de apertura, y sirve también para
las hojas que se montan a la vez que se abren.

### La lección, que es sobre documentación

La tabla de «lo que ya está comprobado por máquina» tenía una fila que decía
«foco devuelto al cerrar». Era verdad **a medias**: el test existía y pasaba,
sobre una pantalla. Una fila que dice «comprobado» significa que hay un test,
no que cubra todo. La tabla ahora dice qué cubre cada uno.

## D-81 · Un botón bloqueado tiene que poder decir por qué

`disabled` nativo saca el botón del recorrido por tabulador. Quien no ve la
pantalla llega al final del paso, **no encuentra «Siguiente» por ningún lado** y
no tiene manera de saber que existe ni por qué no avanza. El motivo estaba
escrito —«Elegí una especie»— en un párrafo que nadie le llevaba.

Ahora es `aria-disabled` con `aria-describedby` al motivo, el motivo es una
región viva, y el clic se corta en el manejador: `aria-disabled` es una promesa
al lector de pantalla, no un candado del navegador.

## Lo que sigue sin hacerse

Lo que no se automatiza: **si se entiende**. Si las frases se escuchan bien, si
el ritmo de las interrupciones molesta, si el recorrido resulta cómodo. Eso
está en `docs/02-AUDITORIA-LECTOR-DE-PANTALLA.md`, son veinte minutos, y hay que
hacerlo con la pantalla apagada.

Lo mecánico ya no se repite a mano: `tests/e2e/lector-de-pantalla.spec.ts`, 18
casos sobre las seis pruebas, en móvil y escritorio.

---

# ADENDA XII · TAKU RECUERDA LO QUE YA EXPLICÓ

`cues.ts` prometía, en su propio comentario, que un consejo se muestra «una
sola vez por sesión, o deja de ser ayuda y es insistencia». La regla era buena
y estaba implementada. El problema era **por sesión**.

## D-82 · Una promesa que duraba lo que la pestaña

`spent` vivía en el estado de React y nada más. Cerrabas la aplicación y al día
siguiente Taku volvía a explicar que se puede buscar en inglés. Explicar lo
mismo dos veces es exactamente lo que convierte a un acompañante en un cartel
que se aprende a ignorar, que es de lo que todo este módulo intenta escapar.

Ahora la lista de ids vistos se guarda en el navegador. Se guardan **ids, no
frases**: si mañana se reescribe un consejo sigue contando como visto, que es
lo que se quiere. Para que vuelva a mostrarse hay que cambiarle el id, y eso
es una decisión deliberada de alguien.

### Se lee en la inicialización, no en un efecto

Un efecto llegaría tarde, y de una forma que no se ve mirando el código: React
corre los efectos de los HIJOS antes que los del padre. La pantalla ya habría
ofrecido su consejo —y Taku lo habría repetido una vez más— antes de que el
proveedor supiera que estaba visto.

Leer `localStorage` durante el render no rompe la hidratación porque `spent` no
se dibuja: en el servidor sale vacío, en el cliente sale lleno, y el HTML es
idéntico. Lo único que cambia es si un consejo FUTURO se acepta.

### Y hace falta una salida

Como ya no se repiten NUNCA, un consejo que apareció mientras mirabas para otro
lado se perdería para siempre. Por eso hay «Volver a ver los consejos» en el
perfil, al lado del interruptor de silencio.

Olvidar lo visto **no toca `lastAt`**: pulsar ese botón no es una excusa para
hablar encima de lo que Taku acaba de decir.

## D-83 · El tercer test de la sesión que pasaba sin mirar

`taku.spec.ts` tenía un test llamado «el mismo consejo no se repite al volver a
la pantalla». Pasaba. La persistencia no existía.

Se midió: la burbuja aparece a los **70 ms** de cargar el contenido y dura
**7 segundos**. El test esperaba 1,5 s después de `waitForContent` y comprobaba
UNA vez. Para cuando comprobaba, la burbuja había venido y se había ido.

Pasaba porque llegaba tarde, no porque la burbuja no viniera.

Ahora vigila durante ocho segundos seguidos —más que los siete que dura— y
además comprueba que el id quedó guardado en el navegador. Es el tercer caso de
esta tanda: el `/0 resultados/` que casaba con «60 resultados», el borrado en
cascada que se comprobaba sin esperarlo, y éste.

## Los consejos nuevos, y los que se descartaron

La regla de redacción ya estaba escrita: *«todos tienen que pasar la prueba de
¿esto está escrito en la pantalla? Si la respuesta es sí, no va»*. Se escribió
cada consejo después de comprobar **en el código** que la regla que cuenta
existe en esta aplicación:

| Consejo | Dónde salta | Comprobado en |
| --- | --- | --- |
| El descanso largo devuelve solo la mitad de los dados de golpe | Al gastar el primero | `engine.ts`: `max(1, floor(nivel / 2))` |
| La inspiración heroica no se acumula | Al ganarla, en 2024 | `execute.ts`: volver a ganarla no cambia el estado |
| Importar enseña qué entra antes de escribir | Al abrir el diálogo de importar | `service.ts`: `preview()` y `commit()` son dos pasos |
| Cada arma de 2024 trae su maestría | Equipamiento, en 2024 | `schemas.ts`: el arma tiene `mastery` |
| Ventaja y desventaja se anulan | Gestión, si el personaje tiene alguna | `computed.ts`: `resolveRollMode` |

Se descartaron dos que sonaban bien:

- **La sintonización topa en tres.** El aviso de la ficha ya dice «el máximo es
  3», y las ranuras se pintan tres.
- **La experiencia no bloquea.** La pantalla de subir de nivel ya dice «podés
  subir igual si tu mesa juega por hitos».

Ninguno salta al entrar a una pantalla «por si acaso»: todos esperan al momento
en que la regla empieza a importarle a quien juega. El de los dados de golpe no
dice nada hasta que gastás el primero; el de ventaja no aparece si tu personaje
no tiene ninguna fuente de ventaja ni de desventaja.

---

# ADENDA XIII · EL PRIMER USUARIO REAL NO PODÍA ENTRAR

Se desplegó, alguien creó una cuenta, y no pudo iniciar sesión. La pantalla
decía **«Algo falló y no sabemos qué»**. Lo sabíamos.

## D-84 · Un error descartado se disfraza de estado normal

Iniciar sesión son dos pasos: Supabase valida la contraseña, y después la
aplicación busca el espacio personal del usuario. El segundo pedía los datos
ordenados por `joined_at`, y esa columna **no existe**: se llama `created_at`
(migración 0001).

PostgREST devolvía `column "joined_at" does not exist`. Y entonces:

```ts
const { data } = await client.from('workspace_members')...
```

**El error se descartaba.** `data` quedaba en `null`, y `null` significa otra
cosa perfectamente legítima: «este usuario todavía no tiene espacio», que es un
estado esperado justo después del alta. Un error de escritura se disfrazaba de
estado normal, y por eso el diagnóstico que llegaba a la pantalla era ninguno.

Se midió contra la base real con `scripts/diagnose-auth.mjs`: el disparador
existía, el espacio existía, la membresía existía, cero usuarios huérfanos — y
la consulta del navegador, ejecutada con RLS como ese usuario, lanzaba. Eso
separó de un golpe «la fila no está» de «la fila está y no se puede leer», que
desde fuera se ven idénticas.

Ahora el error no se traga. Devolver `null` a secas convierte cualquier fallo
futuro —una política nueva que cierre de más, otra columna mal escrita— en el
mismo silencio.

## D-85 · La costura que ninguna de las dos suites cubría

Nada de lo que había podía encontrarlo, y no por descuido:

| Lo que existía | Por qué no lo veía |
| --- | --- |
| 48 casos de base | Prueban las POLÍTICAS, en SQL. No ejecutan el TypeScript que arma la consulta |
| 140 E2E | Nunca inician sesión: sin cuenta, ese camino no se recorre |
| TypeScript | `order('joined_at')` es una cadena |

Dos suites sanas, y entre ellas una costura por la que se cuela justo esto.

`tests/unit/schema-contract.test.ts` la cose: lee las columnas de las
migraciones, lee las que el código nombra en `select`, `eq` y `order`, y
compara. Sin base de datos —son dos archivos de texto— y en 376 ms.

Se comprobó que **falla** reintroduciendo el fallo original:

```
src/infrastructure/remote/auth.ts: workspace_members.joined_at (en .order())
```

Un test que solo se ha visto pasar no prueba nada. Éste lleva además dos casos
que vigilan al propio analizador: si dejara de encontrar tablas o consultas,
pasaría siempre y en silencio, que es peor que no tenerlo.

## D-86 · «Algo falló y no sabemos qué» era mentira

El mensaje genérico tapaba los dos pasos a la vez. Quien lo leía no podía
saber si había escrito mal la contraseña, si le faltaba confirmar el correo o
si el problema era nuestro — y lo único que podía hacer era repetir lo mismo.

Ahora `auth.workspaceMissing` tiene código propio y dice lo que pasó: *«Tu
contraseña es correcta, pero no pudimos abrir tu espacio. Es un problema
nuestro, no tuyo»*. **De quién es el fallo es la información más útil del
mensaje**: si es del usuario puede arreglarlo, si es nuestro repetir no sirve
de nada.

Se repasaron todos con la misma regla —qué pasó y qué hacer—, y el detalle
técnico ahora **se ve** debajo del mensaje en lugar de quedarse en la consola.
Nadie abre las herramientas de desarrollo para reportar un fallo.

## D-87 · El logotipo medía cero de ancho

Síntoma: del dragón solo se veían los ojos. Medido en producción: `width: 0px`
computado en los tres logotipos de la pantalla de perfil.

La marca va dentro de un `flex` junto a la palabra «TAKU D&D». Un SVG es un
hijo flexible con `min-width: auto` resuelto a 0, así que cuando el sitio
aprieta **se encoge hasta medir cero**: la altura queda correcta y el dragón
sigue dibujado a 38px dentro de un lienzo de 0 de ancho, de modo que lo único
que asoma es el detalle más brillante. Los ojos.

Lo revelador es que el propio componente ya tenía un `silhouette` cuyo
comentario describía este mismo síntoma —«solo se distinguían los ojos
dorados… parecían dos puntos flotando»— y lo había resuelto con una silueta
plana. Se trató el síntoma en un sitio sin encontrar la causa, que estaba en
todos.

`shrink-0` va en `DragonMark`, no en quien lo usa: un logotipo no se encoge
nunca. Si no entra, lo que hay que arreglar es el sitio.

---

# ADENDA XIV · EL LOGOTIPO Y EL REPASO DE RESPONSIVE

## D-88 · El mismo `id` tres veces, y el dragón desaparecía solo en el teléfono

Seguía viéndose roto en móvil después de arreglar `shrink-0`. El tamaño ya era
correcto —28×28 y 36×36, medidos— y aun así solo asomaban los ojos.

La causa estaba en una pista que se había anotado y dejado pasar: **tres
elementos con `id="taku-scale"`**. `url(#taku-scale)` resuelve siempre al
PRIMERO del documento, y el primero vive en la barra lateral de escritorio,
que en móvil está con `display:none`. **Un degradado definido en un subárbol
oculto no pinta.** El cuerpo del dragón salía vacío; los ojos se veían porque
no usan el degradado.

En escritorio funcionaba de casualidad: ahí el primero sí se dibuja. Por eso el
síntoma era exclusivo del teléfono, que es la peor forma de tener un fallo.

Ahora cada instancia genera su id con `useId`. El componente pasa a ser de
cliente, que es el precio de la corrección y es barato.

Lo que más enseña de este caso: el propio componente ya tenía un `silhouette`
cuyo comentario describía este mismo síntoma —«solo se distinguían los ojos
dorados… parecían dos puntos flotando»— y lo había resuelto tapándolo con una
silueta plana. **Se trató el síntoma en un sitio sin buscar la causa, que
estaba en todos.**

## D-89 · Medir el área que responde al dedo, no la caja del elemento

Se escribió una auditoría que recorre 10 pantallas × 5 anchos (320, 375, 414,
768, 1280) buscando scroll horizontal, desbordes, áreas de toque pequeñas y
texto cortado. Está en `scripts/audit-responsive.mjs` y se corre con
`npm run audit:responsive`.

La primera versión medía `getBoundingClientRect()` y **daba falsos positivos
que parecían hallazgos**: marcaba como fallo una barra de 6px que acepta el
toque en 26 gracias a un pseudoelemento estirado, que es justo la técnica para
no deformar el diseño.

Ahora sondea hacia fuera desde el centro con `elementFromPoint`, que es lo que
hace el navegador cuando alguien toca. Y descarta lo que se recorta a
propósito: `text-overflow: ellipsis` y `sr-only`. De los 43 avisos de «texto
cortado» de la primera pasada, los 43 eran falsos.

Un informe con ruido es peor que no tenerlo: entrena a ignorarlo.

## D-90 · Lo que encontró, y lo que se decidió NO tocar

| | Antes | Ahora |
| --- | --- | --- |
| Incumplimientos de WCAG 2.5.8 (< 24px) | 22 | **6**, todos exentos |
| Scroll horizontal | 0 | 0 |

Arreglado:

- **Chips de filtro de la biblioteca**: 31px → 44. Es la fila que más se toca.
- **Selector de edición 2014/2024**: 30px → 44, en biblioteca y en Homebrew.
- **Limpiar la búsqueda**: 28 → 44, creciendo solo el área, no el icono.
- **Cabecera del creador**: 36 → 44.
- **Puntos de paso del creador**: 20×6 dibujados, **25×26 sensibles** con un
  pseudoelemento. El dibujo no cambia y el resto de la pantalla no se mueve un
  pixel.
- **Botón `sm` del sistema de diseño**: 44px en el teléfono, 36 a partir de
  tablet. No es un tamaño para cosas menores: lo llevan «Crear cuenta»,
  «Nueva campaña», «Importar».
- **Cerrar la burbuja de Taku**: 22 → 38. No llega a 44 porque la burbuja es
  estrecha y no hay sitio; 38 está cómodamente sobre el mínimo AA.
- **Casilla de Taku y enlaces del logotipo**: a 24 y 44.

**No se tocó**, con motivo:

- **Los seis enlaces que quedan por debajo de 24px** están DENTRO de una frase
  —«¿Todavía no tenés cuenta? *Crear una*»—, y WCAG 2.5.8 exime justo ese caso:
  agrandarlos rompería el renglón del párrafo. El que sí iba suelto y centrado,
  «Olvidé mi contraseña», se agrandó.
- **Los nueve «elementos que se salen»** son dos cosas legítimas: la fila de
  chips es un carrusel horizontal a propósito (`overflow-x-auto` con
  `-mx-4 px-4`, el patrón estándar en móvil), y el dragón decorativo de la
  portada sangra por el borde a propósito. Ninguno provoca scroll de la página:
  **cero casos de scroll horizontal en las 50 combinaciones**.

---

# ADENDA XV · LA TARJETA QUE SE VE AL COMPARTIR EL ENLACE

Sin etiquetas Open Graph, LinkedIn muestra el enlace pelado: el dominio y poco
más. Ahora muestra la imagen grande, el título y la bajada.

## D-91 · Tres cosas que no son opcionales, aunque lo parezcan

**La URL tiene que ser absoluta.** LinkedIn, WhatsApp y Slack descargan la
imagen desde sus propios servidores; una ruta relativa no les dice nada. Next
la construye a partir de `metadataBase`, y sin `metadataBase` emite rutas
relativas y la tarjeta sale sin imagen.

De dónde sale el dominio importa: de las variables que **Vercel pone sola**
—`VERCEL_PROJECT_PRODUCTION_URL` primero, `VERCEL_URL` después—, no de una que
haya que acordarse de configurar. Se quitó `NEXT_PUBLIC_APP_URL` en su momento
justo por eso (ADENDA XIII) y habría sido incoherente traerla de vuelta. Se
prefiere el dominio de producción sobre el del despliegue para que una vista
previa compartida por error no reparta enlaces a una rama que mañana no existe.

**`width` y `height` deciden el tamaño de la tarjeta.** LinkedIn elige entre la
tarjeta grande y una miniatura al lado del texto, y lo decide ANTES de
descargar la imagen. Si no sabe la proporción, tira por la miniatura.
Declararlas es lo que dispara la tarjeta grande.

**La imagen tiene que ser un archivo servido.** Un rastreador de enlaces no
ejecuta JavaScript ni espera a que algo se construya. Por eso se genera una vez
con `npm run build:og` y vive en el repositorio, en lugar de usar
`opengraph-image.tsx` con `ImageResponse`: Satori no entiende todo el CSS y
obliga a descargar la fuente en el build, más piezas para la misma imagen.

## D-92 · Estaba en `public/`, y eso costaba medio mega a cada usuario

La imagen entró primero en `public/og.png`, que es donde uno la pone sin
pensar. El service worker precarga todo lo de `public/`, así que **cada persona
que instalaba la aplicación se bajaba 505 KB, para siempre, de una imagen que
solo mira el servidor de LinkedIn**.

Se intentó excluirla por configuración, dos veces:

| Intento | Resultado |
| --- | --- |
| `exclude: [/^og\.png$/]` | Sigue en el manifiesto. `exclude` filtra los recursos de webpack; lo de `public/` entra por otra puerta |
| `globPublicPatterns: ['**/*', '!og.png']` | Sigue en el manifiesto |

La solución no era una opción más: era **sacar el archivo de la carpeta**.
Vive en `src/app/opengraph-image.png`, la convención de ficheros de Next, que
además le lee las dimensiones al propio archivo y le cuelga un hash para que
las redes no sirvan una versión vieja al cambiarla. Comprobado: **0
ocurrencias** en `sw.js`, y los iconos siguen precargados.

De paso desapareció la duplicación: Next genera también las etiquetas
`twitter:image` desde ese mismo archivo, así que no hay que repetir medio mega
en el repositorio para decir lo mismo.

## Cómo comprobarlo cuando se despliegue

LinkedIn **cachea la vista previa con agresividad**. Si se comparte el enlace
antes de que las etiquetas existan, se queda con esa versión vacía durante
días. Para forzarlo:

> Post Inspector de LinkedIn — `linkedin.com/post-inspector`

Se pega la URL y se pulsa «Inspect»: vuelve a leer las etiquetas y actualiza su
copia. Conviene hacerlo la primera vez, y cada vez que cambie la imagen.
