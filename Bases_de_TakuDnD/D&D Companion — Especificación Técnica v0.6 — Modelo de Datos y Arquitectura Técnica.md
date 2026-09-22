# D&D COMPANION
## Especificación Técnica v0.6
### Modelo de Datos + Arquitectura Técnica

---

# 1. OBJETIVO

Construir una arquitectura capaz de soportar:

- D&D 2014;
- D&D 2024;
- SRD;
- contenido propio;
- Homebrew;
- contenido importado;
- personajes;
- campañas;
- inventario;
- hechizos;
- reglas;
- Modo Juego;
- Modo Gestión;
- funcionamiento offline;
- sincronización;
- múltiples dispositivos;
- futuras funcionalidades de DM.

La arquitectura debe evitar que las decisiones iniciales bloqueen la evolución futura.

---

# 2. ARQUITECTURA GENERAL

Modelo:

```text
┌─────────────────────────────┐
│        CLIENTE PWA          │
│ React / TypeScript          │
│ Mobile First                │
└──────────────┬──────────────┘
               │
        Application Layer
               │
┌──────────────▼──────────────┐
│       DOMAIN LAYER          │
│ Character Engine            │
│ Rules Engine                │
│ Inventory Engine            │
│ Spell Engine                │
│ Resource Engine             │
│ Campaign Engine             │
└──────────────┬──────────────┘
               │
┌──────────────▼──────────────┐
│       DATA / SYNC           │
│ Local DB                    │
│ Sync Engine                 │
│ Remote API                  │
└──────────────┬──────────────┘
               │
┌──────────────▼──────────────┐
│        BACKEND              │
│ Auth                        │
│ Database                    │
│ Storage                     │
│ Permissions                 │
└─────────────────────────────┘
```

---

# 3. FRONTEND

Arquitectura recomendada:

```text
TypeScript
React
PWA
```

El framework concreto puede ser evaluado antes de iniciar el desarrollo, pero debe soportar:

- SSR/SPA cuando corresponda;
- PWA;
- routing;
- offline;
- responsive;
- accesibilidad;
- code splitting;
- instalación en dispositivos móviles.

---

# 4. PRINCIPIO PWA

La aplicación será:

> Web + instalable.

No se desarrollará inicialmente como aplicación nativa separada para Android e iOS.

El usuario podrá:

```text
Abrir navegador
↓
Entrar a la aplicación
↓
Instalar en pantalla de inicio
↓
Utilizar como aplicación
```

---

# 5. CLIENTE LOCAL

La PWA debe disponer de almacenamiento local.

Responsabilidades:

- personajes;
- estado actual;
- inventario;
- recursos;
- contenido descargado;
- configuración;
- cola de sincronización;
- eventos pendientes.

---

# 6. BASE DE DATOS LOCAL

Recomendación:

> IndexedDB

con una capa de abstracción.

Una biblioteca como Dexie puede utilizarse si el análisis técnico previo confirma que es conveniente.

No acceder directamente a IndexedDB desde toda la aplicación.

Debe existir:

```text
LocalDataRepository
```

---

# 7. BACKEND

El backend debe proporcionar:

- autenticación;
- usuarios;
- personajes;
- campañas;
- contenido;
- sincronización;
- permisos;
- almacenamiento;
- importación/exportación.

La lógica crítica de reglas no debe depender exclusivamente del frontend.

---

# 8. BASE DE DATOS REMOTA

Recomendación:

> PostgreSQL

Motivos:

- relaciones complejas;
- integridad;
- consultas;
- versionado;
- escalabilidad;
- JSONB cuando sea necesario;
- soporte multi-tenant.

---

# 9. MULTI-TENANCY

Desde el comienzo, el modelo debe permitir múltiples usuarios.

Conceptualmente:

```text
User
 ↓
Workspace / Tenant
 ↓
Characters
Campaigns
Content
```

Aunque inicialmente el producto pueda parecer individual.

Esto evitará una migración estructural futura.

---

# 10. USUARIO

Entidad:

```text
User
```

Campos conceptuales:

```text
id
email
display_name
avatar
language
timezone
created_at
updated_at
```

No guardar información innecesaria.

---

# 11. PERSONAJE

Entidad principal:

```text
Character
```

Debe contener:

```text
id
owner_id
campaign_id
name
ruleset_id
level
experience
created_at
updated_at
```

No debe contener toda la ficha como un único JSON gigante.

---

# 12. CARACTERÍSTICAS DEL PERSONAJE

Entidad:

```text
CharacterAbility
```

Ejemplo:

```text
character_id
ability_id
base_score
```

Los modificadores deben calcularse.

---

# 13. CLASES

Entidades:

```text
ClassDefinition
SubclassDefinition
CharacterClass
```

Esto permite:

```text
Fighter
```

como definición.

Y:

```text
Tharion
→ Fighter
→ Level 5
```

como instancia.

---

# 14. MULTICLASS

No almacenar:

```text
character.class = fighter
```

como único valor.

Utilizar:

```text
CharacterClass
```

permitiendo múltiples registros.

Ejemplo:

```text
Character
├── Fighter 5
└── Rogue 2
```

---

# 15. ESPECIES

```text
SpeciesDefinition
SubspeciesDefinition
CharacterSpecies
```

Debe soportar diferentes estructuras entre 2014 y 2024.

---

# 16. TRASFONDOS

```text
BackgroundDefinition
CharacterBackground
```

Las proficiencias y efectos derivados deben provenir de las definiciones y reglas.

---

# 17. FEATS

```text
FeatDefinition
CharacterFeat
```

Un feat puede:

- modificar características;
- otorgar competencias;
- otorgar acciones;
- crear recursos;
- modificar reglas.

Por eso no debe ser simplemente texto.

---

# 18. HABILIDADES

```text
SkillDefinition
CharacterSkill
```

La habilidad debe relacionarse con su característica correspondiente.

---

# 19. PROFICIENCIES

Entidad conceptual:

```text
Proficiency
```

Tipos:

```text
skill
saving_throw
weapon
armor
tool
language
other
```

---

# 20. HECHIZOS

Separación:

```text
SpellDefinition
CharacterSpell
SpellSlotResource
```

La definición contiene la regla.

La relación con el personaje indica:

- conocido;
- preparado;
- favorito;
- fuente;
- notas.

---

# 21. EQUIPAMIENTO

Separar:

```text
ItemDefinition
CharacterInventoryItem
```

Ejemplo:

```text
ItemDefinition:
Longsword
```

y:

```text
CharacterInventoryItem:
Tharion's Longsword
quantity = 1
equipped = true
```

---

# 22. INVENTARIO

Entidad:

```text
CharacterInventoryItem
```

Campos conceptuales:

```text
id
character_id
item_definition_id
custom_name
quantity
weight_override
value_override
location
equipped
favorite
notes
metadata
```

---

# 23. OBJETOS MÁGICOS

Los objetos mágicos pueden utilizar:

```text
ItemDefinition
MagicItemData
```

con:

- rareza;
- sintonización;
- cargas;
- efectos;
- requisitos.

---

# 24. RECURSOS

Entidad:

```text
CharacterResource
```

Campos:

```text
id
character_id
name
current
maximum
recovery_type
recovery_rule
source
```

---

# 25. CONDICIONES

Separación:

```text
ConditionDefinition
CharacterCondition
```

La definición contiene la regla.

La instancia contiene:

```text
character_id
condition_id
source
duration
started_at
notes
```

---

# 26. ATAQUES

Separación:

```text
AttackDefinition
CharacterAttack
```

El ataque puede derivarse de un arma, hechizo o característica.

No almacenar únicamente el bonus final.

---

# 27. MONEDAS

Entidad:

```text
CharacterCurrency
```

Valores internos:

```text
gp
pp
ep
sp
cp
```

La interfaz se encarga de la localización.

---

# 28. NOTAS

```text
CharacterNote
```

Tipos:

```text
general
story
relationship
goal
secret
session
custom
```

---

# 29. CAMPAÑAS

```text
Campaign
CampaignMember
CampaignCharacter
```

Permite:

- DM;
- jugadores;
- personajes;
- permisos.

---

# 30. ROLES

Inicialmente:

```text
OWNER
DM
PLAYER
ADMIN
```

Posteriormente:

```text
VIEWER
EDITOR
MODERATOR
```

---

# 31. CONTENT SOURCE

Cada elemento de contenido debe saber de dónde proviene.

Entidad:

```text
ContentSource
```

Tipos:

```text
SRD
OFFICIAL_LICENSED
OWN
HOMEBREW
IMPORTED
```

---

# 32. CONTENT PACK

Entidad:

```text
ContentPack
```

Campos:

```text
id
name
description
author
version
ruleset
language
source
license
visibility
created_at
updated_at
```

---

# 33. CONTENT PACK ITEMS

Relación:

```text
ContentPackItem
```

Permite que un pack contenga:

- clases;
- especies;
- hechizos;
- armas;
- objetos;
- monstruos;
- reglas.

---

# 34. VERSIONADO DE CONTENIDO

No sobrescribir una versión anterior.

Ejemplo:

```text
Pack 1.0
Pack 1.1
Pack 1.2
```

Los personajes existentes deben poder seguir vinculados a la versión con la que fueron creados.

---

# 35. REGLAS

Entidad:

```text
RuleDefinition
```

Estructura conceptual:

```text
id
ruleset
trigger
conditions
requirements
effects
priority
source
version
```

---

# 36. EFECTOS

Entidad conceptual:

```text
Effect
```

Tipos:

```text
MODIFY_STAT
ADD_PROFICIENCY
REMOVE_PROFICIENCY
ADD_RESOURCE
SPEND_RESOURCE
APPLY_CONDITION
REMOVE_CONDITION
GRANT_ACTION
MODIFY_DAMAGE
MODIFY_AC
MODIFY_SPEED
MODIFY_HP
OTHER
```

---

# 37. EVENTOS

Entidad:

```text
GameEvent
```

Ejemplos:

```text
ATTACK_ROLLED
DAMAGE_TAKEN
HEAL_RECEIVED
SPELL_CAST
ITEM_CONSUMED
ITEM_EQUIPPED
RESOURCE_SPENT
RESOURCE_RESTORED
CONDITION_APPLIED
CONDITION_REMOVED
LEVEL_UP
REST_STARTED
REST_COMPLETED
```

---

# 38. EVENT LOG

Los eventos pueden conservarse para:

- historial;
- auditoría;
- deshacer;
- sincronización;
- estadísticas;
- recuperación.

Ejemplo:

```text
event_id
character_id
user_id
type
payload
timestamp
device_id
version
```

---

# 39. COMMANDS

La aplicación no debería modificar directamente la base de datos desde cualquier componente.

Utilizar comandos conceptuales:

```text
CreateCharacter
EquipItem
UnequipItem
TakeDamage
HealCharacter
CastSpell
ConsumeItem
SpendResource
RestoreResource
ApplyCondition
RemoveCondition
LevelUp
TakeShortRest
TakeLongRest
```

---

# 40. QUERY

Para consultar información:

```text
GetCharacter
GetCharacterStats
GetInventory
GetActiveConditions
GetAvailableSpells
GetResources
GetCharacterAttacks
```

Esto separa:

> modificar

de:

> consultar.

---

# 41. REPOSITORIES

La lógica de dominio no debe conocer directamente:

- PostgreSQL;
- IndexedDB;
- Supabase;
- API HTTP.

Debe utilizar interfaces:

```text
CharacterRepository
InventoryRepository
ContentRepository
CampaignRepository
EventRepository
```

Esto permite cambiar infraestructura sin reescribir el dominio.

---

# 42. DOMAIN LAYER

La capa de dominio debe contener:

```text
Character Engine
Rules Engine
Inventory Engine
Spell Engine
Resource Engine
Combat Engine
Progression Engine
Validation Engine
```

No debe depender de React.

---

# 43. APPLICATION LAYER

Responsable de coordinar:

```text
commands
queries
transactions
permissions
events
sync
```

---

# 44. UI LAYER

Responsable de:

- mostrar;
- capturar interacción;
- navegación;
- accesibilidad;
- animaciones;
- feedback.

No debe contener reglas de D&D.

---

# 45. SINCRONIZACIÓN

Modelo:

```text
LOCAL FIRST
    ↓
Queue
    ↓
Sync
    ↓
Server
```

El usuario puede realizar acciones sin conexión.

---

# 46. OUTBOX

Las acciones offline se guardan en una cola:

```text
SyncQueue
```

Ejemplo:

```text
1. ITEM_CONSUMED
2. DAMAGE_TAKEN
3. RESOURCE_SPENT
```

Cuando vuelve internet:

```text
SyncQueue
↓
Server
↓
Confirm
↓
Remove from queue
```

---

# 47. CONFLICTOS DE SINCRONIZACIÓN

Los conflictos deben resolverse mediante eventos y versiones.

No utilizar simplemente:

> "último guardado gana"

para todas las entidades.

Por ejemplo:

```text
HP
```

puede representarse mejor como eventos:

```text
-5 damage
+8 heal
```

en lugar de:

```text
HP = 32
```

Esto reduce conflictos.

---

# 48. IDEMPOTENCIA

Cada comando sincronizable debe tener:

```text
command_id
device_id
timestamp
```

El servidor debe detectar comandos repetidos.

Esto evita:

> consumir dos pociones

cuando en realidad el comando llegó dos veces.

---

# 49. OFFLINE

Debe poder utilizarse offline:

- personaje;
- ficha;
- inventario;
- dados;
- recursos;
- condiciones;
- hechizos;
- dinero;
- historial.

Las funciones que requieren servidor deben indicarlo.

---

# 50. CACHE DE CONTENIDO

El usuario debe poder almacenar localmente contenido necesario.

Por ejemplo:

> Personaje + reglas + contenido utilizado.

No es necesario descargar toda la biblioteca mundial.

---

# 51. SEGURIDAD

Debe existir:

- autenticación;
- autorización;
- validación server-side;
- aislamiento de usuarios;
- permisos por campaña;
- control de acceso a contenido;
- sanitización de importaciones.

Nunca confiar únicamente en validaciones del frontend.

---

# 52. IMPORTACIÓN SEGURA

Los archivos importados deben:

1. validarse;
2. analizarse;
3. verificar formato;
4. comprobar referencias;
5. comprobar compatibilidad;
6. comprobar límites;
7. mostrar preview;
8. solicitar confirmación;
9. insertar mediante transacción.

Nunca ejecutar código proveniente de un paquete importado.

---

# 53. EXPORTACIÓN

Debe existir exportación:

```text
Character JSON
Content Pack
Campaign Data
```

El formato debe ser versionado.

Ejemplo:

```text
schema_version: 1
```

---

# 54. API

La API debe separar:

```text
Auth
Characters
Campaigns
Content
Rules
Sync
Import
Export
```

No crear una API gigante con endpoints ambiguos.

---

# 55. ESTRUCTURA DE PROYECTO RECOMENDADA

Conceptualmente:

```text
src/
│
├── app/
│   ├── routes/
│   └── layouts/
│
├── components/
│
├── features/
│   ├── characters/
│   ├── gameplay/
│   ├── inventory/
│   ├── spells/
│   ├── campaigns/
│   ├── content/
│   └── settings/
│
├── domain/
│   ├── character/
│   ├── rules/
│   ├── inventory/
│   ├── combat/
│   ├── spells/
│   ├── resources/
│   └── campaigns/
│
├── application/
│   ├── commands/
│   ├── queries/
│   └── services/
│
├── infrastructure/
│   ├── database/
│   ├── local/
│   ├── api/
│   └── sync/
│
├── i18n/
│
└── tests/
```

La estructura final podrá adaptarse al framework elegido.

---

# 56. TESTING

El motor de reglas debe tener tests independientes de la UI.

Debe existir:

### Unit tests

Para:

- cálculos;
- modificadores;
- reglas;
- inventario;
- recursos.

### Integration tests

Para:

- comandos;
- base de datos;
- sincronización.

### End-to-end

Para flujos completos:

> crear personaje → jugar → modificar inventario → sincronizar.

---

# 57. TESTS DE REGLAS

Cada ruleset debe tener casos de prueba propios.

Ejemplo:

```text
DND_2014
→ test case

DND_2024
→ test case
```

No asumir que un cálculo de 2014 es válido para 2024.

---

# 58. SNAPSHOTS

Un personaje puede tener:

```text
Character Snapshot
```

para recuperación.

Ejemplo:

> Antes de subir de nivel.

> Después de subir de nivel.

Esto ayuda a depurar errores.

---

# 59. OBSERVABILIDAD

En producción deben poder detectarse:

- errores;
- fallos de sincronización;
- comandos rechazados;
- conflictos;
- errores del motor.

Nunca registrar datos privados innecesarios.

---

# 60. ESCALABILIDAD

La arquitectura debe permitir posteriormente:

- DM;
- grupos grandes;
- campañas;
- marketplace de Homebrew;
- contenido oficial/licenciado;
- comunidad;
- estadísticas;
- herramientas avanzadas;
- integración externa.

Pero ninguna de estas funciones debe contaminar el núcleo inicial.

---

# 61. PRINCIPIO DE SEPARACIÓN

Debe mantenerse esta separación:

```text
CONTENT
    ↓
RULES
    ↓
DOMAIN
    ↓
APPLICATION
    ↓
UI
```

Nunca:

```text
UI
↓
SQL
↓
Regla D&D
```

---

# 62. MODELO COMPLETO

Conceptualmente:

```text
USER
 │
 ├── CHARACTERS
 │      │
 │      ├── CHARACTER STATE
 │      │      ├── Abilities
 │      │      ├── Classes
 │      │      ├── Species
 │      │      ├── Skills
 │      │      ├── Spells
 │      │      ├── Inventory
 │      │      ├── Equipment
 │      │      ├── Resources
 │      │      ├── Conditions
 │      │      └── Currency
 │      │
 │      └── EVENTS
 │
 ├── CAMPAIGNS
 │
 └── CONTENT
        │
        ├── RULESETS
        ├── CONTENT PACKS
        ├── HOMEBREW
        └── IMPORTS
```

---

# 63. REGLA ARQUITECTÓNICA PRINCIPAL

La aplicación debe poder cambiar:

> UI

sin cambiar:

> reglas.

Debe poder cambiar:

> base de datos

sin cambiar:

> dominio.

Debe poder agregar:

> D&D 2026 / nuevo ruleset

sin reconstruir:

> toda la aplicación.

Debe poder agregar:

> nueva plataforma

sin reconstruir:

> motor de reglas.

---

# 64. OBJETIVO FINAL

La arquitectura debe permitir que el producto evolucione desde:

> "companion para jugadores"

hacia:

> "plataforma completa para jugar y administrar D&D"

sin necesidad de reconstruir el núcleo.

---

# 65. REGLA PARA CLAUDE CODE

Cuando llegue el momento de entregar esta especificación a Claude Code:

**NO debe comenzar programando inmediatamente.**

Primero debe:

1. analizar la especificación;
2. detectar contradicciones;
3. detectar requisitos faltantes;
4. proponer stack;
5. proponer arquitectura;
6. proponer modelo de datos;
7. proponer estructura del repositorio;
8. proponer estrategia offline;
9. proponer estrategia de sincronización;
10. proponer implementación del Rules Engine;
11. proponer estrategia de testing;
12. identificar riesgos;
13. solicitar aprobación.

Solo después de la aprobación:

> comenzar implementación.