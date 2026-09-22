# D&D COMPANION
## MASTER SPECIFICATION v1.0
### Product + Functional + Technical + UX/UI + Architecture

**Estado:** CERRADA / APROBADA  
**Documento fuente único de verdad del proyecto**

---

# 0. ESTADO DEL DOCUMENTO

Esta especificación consolida las definiciones funcionales, técnicas, de producto, UX/UI y arquitectura establecidas durante Discovery.

A partir de esta versión:

- esta especificación es la fuente principal de verdad;
- Claude Code debe trabajar respetándola;
- no debe inventar funcionalidades;
- no debe cambiar arquitectura crítica sin justificarlo;
- no debe mezclar reglas 2014 y 2024;
- no debe implementar contenido comercial protegido sin autorización/licencia;
- no debe sacrificar precisión para acelerar desarrollo.

Las nuevas ideas posteriores se consideran **Change Requests** y no forman parte automáticamente del alcance.

---

# 1. VISIÓN

D&D Companion será una aplicación web Progressive Web App (PWA), Mobile First, diseñada para acompañar al jugador de Dungeons & Dragons antes, durante y después de una partida.

No será simplemente una hoja de personaje digital.

Será un:

> **Compañero digital de D&D.**

Debe permitir:

- crear personajes;
- administrar personajes;
- utilizar personajes durante partidas;
- gestionar inventario;
- gestionar equipamiento;
- administrar hechizos;
- controlar recursos;
- controlar condiciones;
- lanzar dados;
- administrar dinero;
- consultar reglas y contenido;
- utilizar Homebrew;
- importar/exportar contenido autorizado;
- participar en campañas;
- preparar herramientas para DM;
- funcionar offline;
- sincronizar posteriormente.

---

# 2. OBJETIVO PRINCIPAL

El usuario debe poder pasar de:

> "Quiero crear un personaje"

a:

> "Estoy jugando una campaña"

sin tener que abandonar la aplicación.

Flujo conceptual:

CREAR PERSONAJE
→ CONFIGURAR
→ EQUIPAR
→ PREPARAR HECHIZOS
→ ENTRAR EN CAMPAÑA
→ JUGAR
→ ATACAR
→ LANZAR HECHIZOS
→ RECIBIR DAÑO
→ GASTAR RECURSOS
→ CONSUMIR OBJETOS
→ ACTUALIZAR INVENTARIO
→ SUBIR DE NIVEL
→ ACTUALIZAR PERSONAJE

La aplicación debe automatizar las relaciones que puedan automatizarse.

---

# 3. PRINCIPIOS INNEGOCIABLES

## 3.1 Complejidad en el sistema, simplicidad en la interfaz

El sistema puede ser extremadamente completo.

La interfaz no debe parecer complicada.

## 3.2 Una acción importante = un toque

Durante una partida, acciones frecuentes deben ejecutarse con mínima fricción.

## 3.3 Fuente única de verdad

Los valores derivados no deben duplicarse innecesariamente.

## 3.4 Automatización

El usuario realiza una acción una vez.

El sistema actualiza todas las entidades relacionadas.

## 3.5 No perder contexto

El usuario debe saber siempre:

- dónde está;
- qué está modificando;
- qué personaje está activo;
- qué campaña está activa;
- qué reglas está utilizando.

## 3.6 Mobile First

El teléfono es el dispositivo principal durante una partida.

## 3.7 PWA

Debe poder instalarse desde el navegador y sentirse como una aplicación.

No se desarrollará inicialmente como aplicación nativa Android/iOS independiente.

## 3.8 Offline First

Las funcionalidades esenciales deben continuar funcionando sin conexión.

## 3.9 Exactitud antes que cantidad

Especialmente en:

- reglas;
- estadísticas;
- inventario;
- recursos;
- disponibilidad de acciones;
- efectos;
- cálculos.

---

# 4. REGLAS SOPORTADAS

Debe soportarse:

- D&D 5e 2014;
- D&D 2024.

Cada personaje tendrá un Ruleset explícito.

Cada campaña tendrá un Ruleset explícito.

Cada contenido tendrá compatibilidad declarada.

Nunca mezclar ediciones silenciosamente.

Si existe incompatibilidad:

1. explicar el problema;
2. mostrar alternativas;
3. permitir cancelar;
4. permitir utilizar el contenido sólo si el usuario lo fuerza explícitamente.

---

# 5. CONTENIDO

El sistema debe soportar cuatro grandes fuentes:

## SRD

Contenido permitido bajo las condiciones correspondientes.

## Propio

Contenido creado dentro del sistema por el usuario.

## Homebrew

Contenido personalizado.

## Importado

Contenido que el usuario posee o está autorizado a utilizar.

La aplicación debe almacenar metadata de procedencia.

Cada contenido debe poder indicar:

- fuente;
- autor;
- licencia;
- edición;
- versión;
- idioma;
- fecha;
- compatibilidad.

No asumir que todo contenido comercial de D&D puede copiarse o distribuirse.

---

# 6. CONTENT PACKS

Los contenidos deben poder agruparse en Content Packs.

Un pack puede contener:

- clases;
- subclases;
- especies;
- subespecies;
- trasfondos;
- dotes;
- hechizos;
- armas;
- armaduras;
- objetos;
- objetos mágicos;
- reglas;
- monstruos;
- contenido Homebrew.

Metadata:

- nombre;
- descripción;
- autor;
- versión;
- idioma;
- ruleset;
- fuente;
- licencia;
- visibilidad.

Versionar sin destruir versiones anteriores.

---

# 7. BIBLIOTECA

La Biblioteca será el centro de consulta.

Categorías principales:

- reglas;
- clases;
- subclases;
- especies;
- subespecies;
- trasfondos;
- dotes;
- habilidades;
- hechizos;
- armas;
- armaduras;
- equipamiento;
- objetos mágicos;
- condiciones;
- monstruos;
- Homebrew;
- contenido importado.

Debe existir:

- búsqueda global;
- filtros;
- favoritos;
- fuente;
- edición;
- compatibilidad;
- idioma.

Principio:

> Buscar antes que navegar.

---

# 8. CREACIÓN DE PERSONAJE

Wizard guiado.

Orden:

1. Ruleset
2. Concepto
3. Especie
4. Clase
5. Subclase
6. Trasfondo
7. Características
8. Competencias
9. Equipo
10. Hechizos
11. Personalidad
12. Apariencia
13. Historia
14. Revisión
15. Crear personaje

Debe existir:

- progreso;
- validación;
- explicación;
- comparación;
- recomendaciones;
- posibilidad de volver atrás.

La recomendación nunca debe convertirse en decisión automática irreversible.

---

# 9. MODOS DE EXPERIENCIA

El producto tendrá dos experiencias principales:

## MODO JUEGO

Para utilizar durante la partida.

## MODO GESTIÓN

Para administrar profundamente el personaje.

No son dos aplicaciones.

Son dos modos del mismo sistema.

---

# 10. MODO JUEGO

Debe priorizar:

1. HP
2. CA
3. iniciativa
4. velocidad
5. ataques
6. hechizos
7. recursos
8. condiciones
9. dados
10. inventario rápido
11. notas

Debe permitir:

- recibir daño;
- curarse;
- modificar HP temporal;
- atacar;
- lanzar hechizos;
- gastar recursos;
- aplicar/quitar condiciones;
- utilizar objetos;
- consumir munición;
- lanzar dados;
- consultar información.

---

# 11. HP

Datos:

- HP máximo;
- HP actual;
- HP temporal.

Acciones rápidas:

- daño;
- curación;
- HP temporal.

Los cambios deben reflejarse inmediatamente.

Debe existir Undo.

---

# 12. ATAQUES

Los ataques deben ser entidades inteligentes.

Un ataque puede derivar información desde:

- arma;
- característica;
- hechizo;
- competencia;
- modificadores;
- efectos activos.

Debe evitarse almacenar solamente el bonus final.

Acción:

> ATACAR

Puede producir:

1. tirada;
2. resultado;
3. daño;
4. consumo de recursos;
5. consumo de munición;
6. registro histórico.

Debe ser configurable.

---

# 13. INVENTARIO

Categorías:

- equipado;
- mochila;
- armas;
- armaduras;
- consumibles;
- munición;
- objetos mágicos;
- herramientas;
- misceláneos.

Cada instancia debe permitir:

- cantidad;
- ubicación;
- equipado;
- favorito;
- nombre personalizado;
- notas;
- peso;
- valor;
- metadata.

---

# 14. DEFINICIÓN VS INSTANCIA

Separación obligatoria.

Ejemplo:

`Longsword`

es una definición.

`Espada de Tharion`

es una instancia del personaje.

Esto permite:

- nombre personalizado;
- mejoras;
- encantamientos;
- durabilidad;
- notas;
- propietario;
- cantidad.

No duplicar definiciones innecesariamente.

---

# 15. EQUIPAMIENTO

Debe soportar slots configurables.

Ejemplos:

- mano principal;
- mano secundaria;
- armadura;
- cabeza;
- capa;
- anillo;
- amuleto;
- otros.

Equipar un objeto puede modificar automáticamente estadísticas.

Los conflictos deben detectarse.

Nunca realizar cambios destructivos silenciosamente.

---

# 16. MUNICIÓN

Debe existir conexión:

Arma → tipo de munición.

Ejemplo:

Arco → Flechas.

Al realizar una acción:

20 → 19.

Debe poder desactivarse el consumo automático.

---

# 17. CONSUMIBLES

Los objetos consumibles deben tener acciones rápidas.

Ejemplo:

Poción ×3

`USAR`

→ ×2

Si el sistema conoce el efecto:

→ aplicar efecto.

---

# 18. OBJETOS MÁGICOS

Deben soportar:

- rareza;
- sintonización;
- cargas;
- requisitos;
- efectos;
- activación;
- duración;
- restricciones.

Las cargas deben funcionar como recursos.

---

# 19. PESO

Calcular:

- peso actual;
- capacidad;
- estado.

Estados:

- normal;
- cerca del límite;
- excedido.

La capacidad debe derivarse de las reglas y modificadores correspondientes.

---

# 20. DINERO

Cinco denominaciones internas:

- gp
- pp
- ep
- sp
- cp

Orden visual español:

**PO → PP → PE → PA → PC**

La localización puede cambiar etiquetas sin modificar IDs internos.

Debe soportar:

- agregar;
- quitar;
- historial;
- conversión;
- valor equivalente.

Las conversiones no deben destruir monedas automáticamente sin confirmación.

---

# 21. HECHIZOS

Separar:

`SpellDefinition`

de:

`CharacterSpell`

Debe soportar:

- conocidos;
- preparados;
- favoritos;
- nivel;
- escuela;
- tiempo;
- alcance;
- componentes;
- duración;
- concentración;
- ritual;
- descripción;
- daño;
- salvación;
- fuente.

Lanzar hechizo debe poder:

- verificar recurso;
- consumir espacio;
- registrar acción;
- mostrar resultado;
- permitir cancelar/modificar cuando corresponda.

---

# 22. RECURSOS

Sistema genérico:

`current / maximum`

Ejemplos:

- inspiración;
- cargas;
- habilidades;
- espacios;
- recursos de clase;
- recursos Homebrew.

Interfaz rápida:

`−`

`+`

Debe poder configurarse recuperación:

- descanso corto;
- descanso largo;
- manual;
- otros.

---

# 23. CONDICIONES

Separación:

`ConditionDefinition`

`CharacterCondition`

Debe permitir:

- condición;
- origen;
- duración;
- ronda;
- notas;
- inicio;
- finalización.

Las condiciones activas deben ser visibles durante Modo Juego.

---

# 24. DADOS

Dados:

- d4;
- d6;
- d8;
- d10;
- d10%;
- d12;
- d20.

Debe soportar:

- cantidades;
- modificadores;
- ventaja;
- desventaja;
- múltiples tiradas;
- repetir;
- historial.

Ejemplos:

`1d20`

`2d20`

`4d6`

`2d8+4`

---

# 25. HISTORIAL

Registrar:

- fecha;
- hora;
- fórmula;
- resultado;
- contexto.

Debe existir historial de sesión y posibilidad de deshacer acciones reversibles.

---

# 26. MOTOR DE REGLAS

El motor de reglas es un componente central.

No colocar reglas críticas dentro de componentes UI.

Debe soportar conceptualmente:

- triggers;
- condiciones;
- requisitos;
- efectos;
- modificadores;
- prioridades;
- recursos;
- progresión;
- dependencias;
- restricciones.

Arquitectura:

`RULES → DOMAIN → APPLICATION → UI`

Nunca:

`UI → inventar regla`.

---

# 27. MOTOR DE PERSONAJE

Debe calcular dinámicamente:

- modificadores;
- competencia;
- salvaciones;
- habilidades;
- CA;
- iniciativa;
- velocidad;
- HP;
- ataques;
- spellcasting;
- recursos;
- efectos derivados;
- peso;
- otras estadísticas derivadas.

Los valores derivados deben tener fuente rastreable.

---

# 28. MULTICLASS

El modelo debe permitir múltiples clases.

No utilizar:

`character.class = fighter`

como única representación.

Utilizar una relación de clases.

Ejemplo:

Fighter 5  
Rogue 2

---

# 29. CAMPAÑAS

Entidad Campaign.

Debe soportar:

- propietario;
- DM;
- jugadores;
- personajes;
- ruleset;
- contenido habilitado;
- sesiones.

Roles iniciales:

- OWNER;
- DM;
- PLAYER;
- ADMIN.

---

# 30. DM

La arquitectura debe estar preparada para:

- encuentros;
- iniciativa;
- monstruos;
- NPC;
- mapas;
- notas;
- recompensas;
- loot;
- gestión de jugadores;
- condiciones.

Las herramientas avanzadas de DM pueden evolucionar posteriormente.

---

# 31. HOMEBREW

Editor visual sin programación.

Debe permitir crear:

- clases;
- subclases;
- especies;
- subespecies;
- trasfondos;
- dotes;
- hechizos;
- armas;
- armaduras;
- objetos;
- objetos mágicos;
- habilidades;
- reglas;
- monstruos.

Todo Homebrew debe conservar metadata.

---

# 32. IMPORTACIÓN

Flujo:

SELECCIONAR
→ ANALIZAR
→ PREVISUALIZAR
→ VALIDAR
→ DETECTAR CONFLICTOS
→ RESOLVER
→ IMPORTAR
→ RESULTADO

Nunca importar datos desconocidos directamente al sistema.

Validar:

- estructura;
- tipos;
- referencias;
- reglaset;
- compatibilidad;
- IDs;
- duplicados;
- contenido potencialmente peligroso.

---

# 33. EXPORTACIÓN

Debe permitir exportar:

- personajes;
- contenido propio;
- Homebrew;
- Content Packs.

Formatos estructurados.

El formato debe ser versionado.

---

# 34. INTERNACIONALIZACIÓN

Idioma inicial:

**Español latinoamericano**

Segundo:

**English**

Arquitectura preparada para:

- portugués;
- francés;
- italiano;
- alemán;
- otros.

UI strings nunca hardcodeados.

Contenido y traducciones deben ser entidades separables.

---

# 35. OFFLINE / PWA

Debe poder instalarse desde navegador.

El usuario debe poder:

- abrir personajes;
- consultar contenido cacheado;
- tirar dados;
- modificar HP;
- modificar recursos;
- modificar inventario;
- lanzar hechizos;
- modificar dinero.

Los cambios offline deben entrar en una cola de sincronización.

---

# 36. SINCRONIZACIÓN

Modelo:

LOCAL DATABASE
↓
OUTBOX
↓
SYNC ENGINE
↓
API
↓
REMOTE DATABASE

Debe existir:

- idempotencia;
- eventos;
- timestamps/versiones;
- detección de conflictos;
- resolución;
- reintentos.

Nunca duplicar operaciones por reintentos.

---

# 37. MODELO DE DATOS

Entidades principales:

### Usuario
User

### Campaña
Campaign  
CampaignMember  
CampaignCharacter

### Personaje
Character  
CharacterAbility  
CharacterClass  
CharacterSpecies  
CharacterBackground  
CharacterFeat  
CharacterSkill  
CharacterProficiency  
CharacterSpell  
CharacterAttack  
CharacterResource  
CharacterCondition  
CharacterInventoryItem  
CharacterCurrency  
CharacterNote

### Contenido
Ruleset  
ContentSource  
ContentPack  
ContentPackItem  
ClassDefinition  
SubclassDefinition  
SpeciesDefinition  
SubspeciesDefinition  
BackgroundDefinition  
FeatDefinition  
AbilityDefinition  
SkillDefinition  
SpellDefinition  
ItemDefinition  
WeaponDefinition  
ArmorDefinition  
MagicItemDefinition  
ConditionDefinition  
RuleDefinition

### Sistema
Translation  
DiceRoll  
Event  
EventLog  
ImportPackage

---

# 38. REGLA DEL MODELO DE DATOS

No convertir Character en un JSON gigante.

No duplicar definiciones de contenido.

Separar:

`CONTENT DEFINITION`

de:

`USER/CHARACTER INSTANCE`

---

# 39. ARQUITECTURA TÉCNICA

Stack base aprobado:

### Frontend

- TypeScript
- React
- Next.js
- PWA
- responsive UI

### UI

- sistema de diseño propio;
- Tailwind CSS;
- componentes reutilizables;
- accesibilidad;
- design tokens.

### Backend

Arquitectura integrada con Next.js cuando sea apropiado.

### Database

PostgreSQL.

### Backend platform recomendada

Supabase puede utilizarse para:

- PostgreSQL;
- autenticación;
- storage;
- APIs;
- Row Level Security.

La decisión final debe priorizar simplicidad, seguridad y mantenibilidad.

### Local database

IndexedDB mediante una capa de abstracción.

Dexie puede utilizarse como implementación.

### Deployment

Plataforma compatible con Next.js y PWA.

No introducir microservicios durante MVP.

---

# 40. ARQUITECTURA DE CAPAS

Debe existir separación:

```text
UI
↓
APPLICATION
↓
DOMAIN
↓
DATA
```

El Domain Layer no debe depender de componentes visuales.

La UI no debe implementar reglas D&D.

---

# 41. SEGURIDAD

Obligatorio:

- autenticación;
- autorización;
- roles;
- aislamiento de datos;
- validación backend;
- protección de endpoints;
- sesiones seguras;
- recuperación de cuenta;
- auditoría.

Nunca confiar únicamente en frontend.

Un usuario jamás puede acceder a datos de otro tenant.

---

# 42. MULTI-TENANCY

La arquitectura debe soportar:

User
↓
Tenant / Workspace
↓
Characters
Campaigns
Content

Los límites de seguridad deben existir en backend/database.

---

# 43. NAVEGACIÓN GLOBAL

Mobile:

- Inicio;
- Personajes;
- Biblioteca;
- Campañas;
- Perfil.

El contexto de personaje agrega:

- Modo Juego;
- Modo Gestión.

No saturar la navegación inferior.

Las acciones de alta frecuencia deben estar contextualizadas.

---

# 44. DASHBOARD

Debe mostrar:

- continuar personaje;
- personajes recientes;
- campañas;
- acciones rápidas;
- actividad relevante.

Ejemplo:

ARAGORN  
Nivel 5  
Guerrero

HP 34/42

`CONTINUAR`

---

# 45. UX/UI

Identidad:

- fantasía;
- aventura;
- profundidad;
- personalidad;
- moderna;
- profesional;
- clara.

No debe parecer:

- PDF;
- wiki antigua;
- base de datos;
- aplicación administrativa;
- interfaz generada genéricamente por IA.

Debe sentirse como un producto digital premium.

---

# 46. RESPONSIVE

Mobile prioritario:

360–430 px.

Tablet:

experiencia adaptada.

Desktop:

- sidebar;
- mayor densidad;
- tablas cuando aporten valor;
- paneles;
- multi-columna.

No crear aplicaciones distintas.

---

# 47. DISEÑO VISUAL

Debe existir:

- sistema tipográfico;
- escala;
- spacing;
- design tokens;
- colores semánticos;
- componentes;
- estados;
- dark mode;
- accesibilidad.

Los colores deben comunicar estados:

- éxito;
- advertencia;
- error;
- información;
- neutral.

No depender únicamente del color.

---

# 48. COMPONENTES

Componentes reutilizables:

- Button;
- IconButton;
- Card;
- StatCard;
- ResourceCounter;
- HPControl;
- AttackCard;
- SpellCard;
- InventoryItem;
- ConditionChip;
- DiceRoller;
- BottomSheet;
- Modal;
- Toast;
- Search;
- Filter;
- Tabs;
- Progress;
- EmptyState;
- LoadingState;
- OfflineIndicator.

---

# 49. ACCESIBILIDAD

Objetivo:

WCAG AA.

Contemplar:

- contraste;
- foco;
- teclado;
- screen reader;
- touch targets;
- tamaño de texto;
- reduced motion;
- feedback visual.

---

# 50. BEGINNER / ADVANCED

## Beginner

Mostrar:

- explicaciones;
- contexto;
- recomendaciones;
- lenguaje sencillo.

## Advanced

Mostrar:

- información compacta;
- menos explicaciones;
- acciones rápidas.

El sistema puede permitir cambiar de experiencia.

---

# 51. ERROR UX

Nunca mostrar:

`Error: invalid_character_state_932`

Preferir:

> No pudimos completar esta acción.

Y explicar:

- qué ocurrió;
- por qué;
- qué puede hacer el usuario.

---

# 52. EMPTY STATES

Los estados vacíos deben explicar:

1. qué falta;
2. por qué;
3. qué hacer.

Ejemplo:

> Todavía no tenés personajes.

`CREAR PERSONAJE`

---

# 53. FEEDBACK

Acciones importantes deben tener feedback inmediato:

- toast;
- animación;
- actualización visual;
- sonido opcional;
- vibración opcional.

No abusar de animaciones.

---

# 54. UNDO

Siempre que una acción pueda revertirse de forma segura:

> Deshacer

Ejemplos:

- daño;
- curación;
- recurso;
- inventario;
- dinero;
- munición.

---

# 55. FAVORITOS

Permitir favoritos para:

- ataques;
- hechizos;
- objetos;
- habilidades;
- reglas;
- contenido.

Los favoritos deben tener prioridad durante Modo Juego.

---

# 56. PRINCIPIO "NO PERDER CONTEXTO"

Siempre debe quedar claro:

- personaje activo;
- campaña activa;
- ruleset;
- estado offline/online.

Cambiar contexto debe requerir una acción explícita.

---

# 57. PRINCIPIO "NO MEZCLAR REGLAS"

Nunca asumir que una regla 2014 equivale a 2024.

El motor debe conocer el Ruleset.

Contenido incompatible:

→ advertencia.

---

# 58. TESTING

Debe existir:

### Unit tests

Para:

- cálculos;
- reglas;
- modificadores;
- recursos;
- inventario;
- monedas;
- dados.

### Integration tests

Para:

- persistencia;
- sincronización;
- autenticación;
- permisos.

### E2E

Para:

- creación;
- juego;
- inventario;
- hechizos;
- campañas;
- importación.

---

# 59. CASOS CRÍTICOS

Probar como mínimo:

- creación válida;
- creación incompleta;
- subida de nivel;
- multiclass;
- equipamiento;
- conflicto de equipamiento;
- consumo;
- munición;
- recurso 0;
- HP 0;
- HP temporal;
- condición;
- hechizo;
- dados;
- offline;
- reconexión;
- conflicto de sincronización;
- importación;
- exportación;
- contenido incompatible;
- acceso no autorizado.

---

# 60. OBSERVABILIDAD

Registrar errores técnicos importantes.

No registrar innecesariamente información sensible.

Debe ser posible detectar:

- errores;
- fallos de sincronización;
- operaciones fallidas;
- problemas de rendimiento.

---

# 61. ROADMAP

## FASE 0
Architecture / Discovery final.

## FASE 1
Foundation:

- proyecto;
- autenticación;
- database;
- diseño base;
- PWA.

## FASE 2
Content system:

- Ruleset;
- ContentSource;
- ContentPack;
- Library.

## FASE 3
Character Creator.

## FASE 4
Character Engine + Character Sheet.

## FASE 5
Inventory + Equipment + Currency.

## FASE 6
Spells + Resources + Conditions.

## FASE 7
Dice + Modo Juego.

## FASE 8
Homebrew + Import/Export.

## FASE 9
Campaigns + DM foundation.

## FASE 10
Offline + Sync.

## FASE 11
Testing + Security + Accessibility.

## FASE 12
Polish + Pilot + Release.

---

# 62. MVP

El MVP funcional debe priorizar:

- autenticación;
- personajes;
- rulesets;
- character creator;
- character sheet;
- reglas básicas;
- inventario;
- equipamiento;
- dinero;
- hechizos;
- recursos;
- condiciones;
- dados;
- Modo Juego;
- Modo Gestión;
- Biblioteca;
- Homebrew básico;
- PWA;
- offline esencial;
- sincronización;
- seguridad.

---

# 63. POST-MVP

Pueden evolucionar:

- herramientas avanzadas de DM;
- campañas avanzadas;
- mapas;
- encuentros;
- NPC;
- monstruos avanzados;
- marketplace de contenido;
- packs públicos;
- colaboración avanzada;
- estadísticas;
- analytics;
- recomendaciones;
- funciones sociales.

No implementar sólo porque estén previstas.

---

# 64. FUERA DEL ALCANCE INICIAL

No desarrollar inicialmente:

- aplicación nativa Android separada;
- aplicación nativa iOS separada;
- microservicios;
- infraestructura innecesariamente compleja;
- IA avanzada;
- marketplace completo;
- red social;
- sistemas de monetización complejos;
- contenido comercial protegido sin licencia.

---

# 65. PRINCIPIO DE CAMBIO

Una nueva idea NO modifica automáticamente esta especificación.

Debe clasificarse como:

### CORRECCIÓN

Necesaria para cumplir esta especificación.

→ Implementar.

### GAP

Algo necesario para que una funcionalidad definida funcione correctamente.

→ Documentar y resolver.

### DECISIÓN

Algo que esta especificación dejó explícitamente abierto.

→ Consultar.

### NUEVA FUNCIONALIDAD

No contemplada.

→ Change Request.

No incorporar silenciosamente.

---

# 66. DEFINITION OF DONE

Una funcionalidad sólo está terminada cuando:

- funciona;
- persiste correctamente;
- respeta reglas;
- funciona responsive;
- maneja errores;
- tiene estados loading/empty/error;
- respeta permisos;
- tiene tests adecuados;
- no rompe funcionalidades existentes;
- funciona offline cuando corresponde;
- sincroniza correctamente cuando corresponde;
- es accesible;
- tiene UX coherente.

---

# 67. REGLA ABSOLUTA DE PRODUCTO

La aplicación debe ser:

> **más completa que una ficha, pero más sencilla que un sistema complejo.**

El usuario no debe pensar:

> "¿Dónde tengo que tocar?"

Debe pensar:

> "Sé exactamente qué hacer."

---

# 68. CRITERIO FINAL DE APROBACIÓN

El producto se considera conceptualmente correcto cuando un usuario puede:

1. crear personaje;
2. entender sus estadísticas;
3. equiparse;
4. preparar hechizos;
5. entrar a una campaña;
6. jugar;
7. atacar;
8. tirar dados;
9. gastar recursos;
10. consumir objetos;
11. recibir daño;
12. curarse;
13. gestionar condiciones;
14. administrar dinero;
15. consultar reglas;
16. modificar personaje;

sin abandonar la aplicación y sin realizar manualmente cálculos que el sistema pueda determinar de forma confiable.

---

# 69. ESTADO FINAL

**MASTER SPECIFICATION v1.0 — CERRADA.**

Esta es la especificación que debe utilizarse para iniciar el desarrollo.

Las futuras modificaciones deberán realizarse mediante Change Request explícito.

FIN DE MASTER SPECIFICATION.