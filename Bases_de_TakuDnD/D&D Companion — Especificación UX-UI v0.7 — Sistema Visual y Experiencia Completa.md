# D&D COMPANION
## Especificación UX/UI v0.7
### Sistema visual + experiencia completa + comportamiento de pantallas

---

# 1. OBJETIVO DE DISEÑO

D&D Companion debe resolver una contradicción:

> D&D es extremadamente complejo, pero la aplicación debe sentirse extremadamente simple.

El sistema puede contener cientos o miles de elementos:

- reglas;
- clases;
- especies;
- subclases;
- hechizos;
- objetos;
- armas;
- monstruos;
- condiciones;
- Homebrew;
- campañas;
- estadísticas.

Pero el usuario no debe enfrentarse a toda esa complejidad simultáneamente.

Principio:

> **Complejidad en el sistema. Simplicidad en la interfaz.**

---

# 2. IDENTIDAD DE PRODUCTO

La aplicación debe transmitir:

- aventura;
- fantasía;
- profundidad;
- personalidad;
- confianza;
- modernidad;
- claridad.

No debe parecer:

- una hoja de Excel;
- un ERP;
- una wiki;
- un formulario administrativo;
- una copia literal de un libro;
- una aplicación antigua de gestión.

Debe sentirse como:

> **Una herramienta moderna para jugar D&D.**

---

# 3. PRINCIPIO MOBILE FIRST

El teléfono es el dispositivo principal.

La interfaz debe diseñarse primero para:

> 360–430 px de ancho.

Después se adapta a:

- tablet;
- desktop.

Nunca diseñar primero desktop y simplemente "achicar".

---

# 4. PWA

La aplicación debe sentirse como una app instalada.

Debe soportar:

- pantalla completa;
- splash;
- icono;
- navegación táctil;
- offline;
- instalación;
- gestos cuando sean apropiados.

No debe parecer simplemente:

> "una página web abierta en Chrome".

---

# 5. ESTRUCTURA VISUAL

La interfaz tendrá tres niveles:

### Nivel 1 — Navegación global

- Inicio;
- Personajes;
- Biblioteca;
- Campañas;
- Perfil.

### Nivel 2 — Contexto

Personaje:

> Modo Juego / Modo Gestión.

Biblioteca:

> Categorías / búsqueda.

Campaña:

> Resumen / jugadores / sesiones / etc.

### Nivel 3 — Acción

Detalle:

> Editar / lanzar / usar / equipar / agregar / eliminar.

---

# 6. BARRA DE NAVEGACIÓN MOBILE

En la parte inferior:

```text
┌───────────────────────────────┐
│                               │
│         CONTENIDO             │
│                               │
├───────────────────────────────┤
│ Inicio │ Personajes │ Biblioteca │
│ Campañas │ Perfil               │
└───────────────────────────────┘
```

Debe:

- permanecer accesible;
- respetar safe areas;
- no tapar botones;
- utilizar iconos + texto;
- mantener el estado seleccionado.

---

# 7. NAVEGACIÓN DE PERSONAJE

Al entrar a un personaje:

```text
┌───────────────────────────────┐
│ ← Tharion                      │
├───────────────────────────────┤
│                               │
│     [ MODO JUEGO ]             │
│     [ MODO GESTIÓN ]           │
│                               │
└───────────────────────────────┘
```

Esta navegación sustituye temporalmente la navegación global.

El personaje se convierte en el contexto principal.

---

# 8. MODO JUEGO — PRINCIPIO VISUAL

Debe ser la pantalla más rápida de toda la aplicación.

La información más importante debe verse:

> sin hacer scroll.

Prioridad:

1. HP;
2. CA;
3. iniciativa;
4. ataques;
5. recursos;
6. hechizos;
7. dados;
8. inventario rápido;
9. condiciones.

---

# 9. MODO JUEGO — HEADER

Mostrar:

```text
THARION
Guerrero · Nivel 5
```

Puede incluir:

- avatar;
- campaña actual;
- indicador offline/sync.

Debe ser compacto.

---

# 10. MODO JUEGO — HP

El HP es el elemento visual más importante.

Ejemplo:

```text
HP

38 / 45

[ − DAÑO ]   [ + CURAR ]
```

El número debe ser grande.

Debe existir feedback visual al cambiar.

No utilizar animaciones excesivas.

---

# 11. HP — INTERACCIÓN

Al pulsar:

> − DAÑO

Abrir panel rápido:

```text
Daño recibido

[ 1 ] [ 2 ] [ 5 ]
[10 ] [15 ] [20 ]

Cantidad:
[     ]

[ CANCELAR ] [ APLICAR ]
```

Los valores rápidos son opcionales.

---

# 12. HP — CURACIÓN

Mismo sistema.

Además:

> HP temporal

Debe estar claramente separado.

---

# 13. CA / INICIATIVA / VELOCIDAD

Debajo de HP:

```text
CA
18

INI
+4

VEL
30 ft
```

Tres tarjetas pequeñas.

Al tocar:

> explicación del cálculo.

---

# 14. ATAQUES

Los ataques favoritos aparecen como tarjetas grandes.

Ejemplo:

```text
┌─────────────────────────┐
│ ESPADA LARGA             │
│ +7 al ataque             │
│ 1d8 + 4 daño             │
│                           │
│        [ ATACAR ]         │
└─────────────────────────┘
```

La acción principal debe ser obvia.

---

# 15. RESULTADO DE ATAQUE

Después de lanzar:

```text
┌─────────────────────────┐
│ ESPADA LARGA             │
│                          │
│          18              │
│       +7 ataque          │
│                          │
│       [ TIRAR DAÑO ]     │
└─────────────────────────┘
```

El resultado debe tener protagonismo visual.

---

# 16. DADOS

El lanzador debe poder abrirse desde cualquier pantalla.

Debe sentirse rápido.

Interfaz:

```text
d4 d6 d8 d10 d12 d20 d100

Cantidad
[ − ] 1 [ + ]

Modificador
[ − ] 0 [ + ]

[ TIRAR ]
```

Entrada avanzada:

> 8d6 + 4

---

# 17. ANIMACIONES DE DADOS

La animación debe ser:

- corta;
- opcional;
- agradable;
- no bloquear la interfaz.

Debe existir:

> Reducir movimiento.

Si está activado, las animaciones se simplifican.

---

# 18. RECURSOS

Tarjetas compactas:

```text
SEGUNDO ALIENTO
1 / 1

[ − ]     [ + ]
```

El usuario debe poder modificar sin entrar a Gestión.

---

# 19. CONDICIONES

Las condiciones activas deben aparecer como chips o tarjetas.

Ejemplo:

```text
ESTADOS

[ Envenenado ]
[ Invisible ]
```

Al tocar:

> explicación.

No mostrar enormes bloques de texto permanentemente.

---

# 20. INVENTARIO RÁPIDO

Mostrar solamente favoritos.

Ejemplo:

```text
OBJETOS RÁPIDOS

Poción ×2       [ USAR ]
Antorcha ×4     [ USAR ]
Cuerda ×1       [ VER ]
```

---

# 21. MODO GESTIÓN — PRINCIPIO

Modo Gestión puede contener mucha información.

Pero debe utilizar:

- tarjetas;
- acordeones;
- tabs;
- secciones;
- filtros;
- búsqueda;
- progressive disclosure.

Nunca una pantalla gigantesca con todo.

---

# 22. GESTIÓN — DASHBOARD

Primera pantalla:

```text
THARION
Guerrero 5

HP 38/45
CA 18
INI +4
VEL 30

Características
Inventario
Hechizos
Recursos
Condiciones
Historia
```

Debe funcionar como centro de control.

---

# 23. GESTIÓN — ESTADÍSTICAS

Cada característica debe tener una tarjeta.

```text
FUERZA
18
+4
```

Al tocar:

> detalles.

Las habilidades aparecen agrupadas debajo.

---

# 24. GESTIÓN — INVENTARIO

Debe tener:

### Buscador

> Buscar objeto...

### Filtros

- Todo;
- equipado;
- armas;
- armaduras;
- consumibles;
- munición;
- mágicos;
- herramientas;
- otros.

### Lista

```text
Espada larga
×1
8 lb

Flechas
×23

Poción de curación
×2
```

---

# 25. INVENTARIO — SWIPE ACTIONS

En móvil puede utilizarse swipe.

Ejemplo:

Deslizar objeto:

> Equipar

> Usar

> Eliminar

Pero las acciones destructivas deben requerir confirmación.

---

# 26. AGREGAR OBJETO

Botón flotante:

> +

Al pulsar:

```text
Agregar objeto

Buscar...
```

Opciones:

> Biblioteca

> Crear personalizado

> Homebrew

---

# 27. DETALLE DEL OBJETO

Mostrar:

```text
ESPADA LARGA

Daño
1d8

Propiedades
...

Peso
...

Valor
...

Fuente
...
```

Acciones:

> EQUIPAR

> FAVORITO

> EDITAR

---

# 28. EQUIPAMIENTO

Utilizar una representación visual clara.

Ejemplo:

```text
        [ CABEZA ]

[ MANO ] [ CUERPO ] [ MANO ]

       [ AMULETO ]

       [ ANILLOS ]
```

No depender exclusivamente de iconografía.

Cada espacio debe tener texto accesible.

---

# 29. HECHIZOS

Organización:

```text
CANTRIPS

Nivel 1
3/4

Nivel 2
2/3

Nivel 3
1/2
```

Cada nivel puede expandirse.

---

# 30. HECHIZO — TARJETA

```text
BOLA DE FUEGO
Nivel 3

Alcance
150 ft

Duración
Instantánea

Concentración
No

[ VER ] [ LANZAR ]
```

---

# 31. DETALLE DEL HECHIZO

Información completa mediante secciones:

- descripción;
- lanzamiento;
- alcance;
- componentes;
- duración;
- concentración;
- daño;
- salvación;
- escalado;
- fuente.

---

# 32. CARACTERÍSTICAS

Cada característica debe mostrarse como:

```text
SEGUNDO ALIENTO

Descripción corta...

[ VER DETALLES ]
```

Al abrir:

- descripción;
- requisitos;
- recursos;
- reglas;
- fuente.

---

# 33. DICCIONARIO DE REGLAS

Cuando el usuario vea una palabra compleja:

> Concentración

puede tocarla para abrir una explicación contextual.

Esto evita sacar al usuario de la pantalla actual.

---

# 34. TOOLTIP / CONTEXT HELP

En desktop:

> hover.

En móvil:

> tap.

Nunca depender exclusivamente de hover.

---

# 35. BIBLIOTECA — DISEÑO

La Biblioteca debe comenzar con:

```text
¿Qué estás buscando?

[ 🔍 Buscar reglas, hechizos, objetos... ]

Categorías
```

Después:

```text
Clases
Especies
Hechizos
Armas
...
```

---

# 36. TARJETAS DE CATEGORÍA

Cada categoría debe tener:

- icono;
- nombre;
- descripción corta;
- cantidad opcional.

Ejemplo:

> ⚔️ Armas  
> Consulta armas y propiedades.

---

# 37. BÚSQUEDA

La búsqueda debe:

- tolerar errores;
- reconocer variantes;
- soportar español;
- soportar inglés;
- filtrar por edición;
- filtrar por fuente.

Ejemplo:

> "espada larga"

puede encontrar:

> Longsword / Espada larga.

---

# 38. FILTROS

Los filtros deben mostrarse como chips:

```text
[ 2024 ]
[ 2014 ]
[ SRD ]
[ Homebrew ]
[ Oficial ]
```

No ocupar media pantalla.

---

# 39. CONTENIDO HOMEbrew

Diferenciar visualmente:

> Oficial/licenciado

> SRD

> Homebrew

> Propio

> Importado

El usuario siempre debe saber qué está utilizando.

---

# 40. CREACIÓN DE PERSONAJE — UX

El wizard debe tener:

### Barra de progreso

```text
1 2 3 4 5 6 7 ...
```

o progreso visual.

Debe poder volver atrás.

---

# 41. CREACIÓN — CARD DE ELECCIÓN

Cada opción debe contener:

```text
Humano

Descripción corta.

Características principales.

Compatible con:
2024

[ VER DETALLES ]

[ ELEGIR ]
```

---

# 42. COMPARACIÓN

Cuando existan opciones similares:

> Comparar

Mostrar:

| | Opción A | Opción B |
|---|---|---|
| Característica | ... | ... |
| Velocidad | ... | ... |
| Competencias | ... | ... |

Optimizado para móvil mediante comparación vertical si no entra una tabla.

---

# 43. RECOMENDACIONES

El sistema puede decir:

> "Según lo que describiste, estas opciones podrían encajar."

Pero nunca:

> seleccionar automáticamente.

Debe existir:

> ¿Por qué?

para explicar la recomendación.

---

# 44. VALIDACIÓN EN TIEMPO REAL

Mientras crea el personaje:

```text
✓ Correcto
⚠️ Requiere elección
❌ Incompatible
```

No esperar hasta el último paso para informar errores.

---

# 45. REVIEW

La revisión debe ser visual.

Secciones:

```text
Identidad
Características
Clase
Especie
Trasfondo
Competencias
Equipo
Hechizos
```

Cada sección:

> Editar

---

# 46. CREACIÓN COMPLETADA

Después:

```text
¡Personaje creado!

THARION
Guerrero 5

[ IR A MODO JUEGO ]

[ VER FICHA ]
```

La acción principal debe ser:

> IR A MODO JUEGO.

---

# 47. CAMPAÑAS — UX

La campaña debe sentirse colaborativa.

Pantalla:

```text
LOS HIJOS DEL DRAGÓN

DM
Alejo

Jugadores
4

[ CONTINUAR ]
```

---

# 48. CAMPAÑA — JUGADORES

Mostrar:

- avatar;
- nombre;
- personaje;
- nivel;
- estado.

El DM tendrá información adicional según permisos.

---

# 49. CAMPAÑA — SESIONES

Lista:

```text
Sesión 12
12/09/2026

Sesión 11
05/09/2026
```

Cada sesión puede tener:

- notas;
- eventos;
- duración;
- participantes.

---

# 50. HOMEbrew — UX

Crear contenido debe sentirse como crear un personaje.

Wizard:

```text
Tipo
 ↓
Información
 ↓
Reglas
 ↓
Efectos
 ↓
Balance
 ↓
Vista previa
 ↓
Publicar/Guardar
```

---

# 51. EDITOR DE REGLAS

No obligar al usuario a escribir código.

Interfaz:

```text
CUANDO
[ ocurra una acción ]

SI
[ se cumple una condición ]

ENTONCES
[ aplicar efecto ]
```

Esto permite construir reglas visualmente.

---

# 52. IMPORTACIÓN

Flujo:

```text
Seleccionar archivo
↓
Analizar
↓
Preview
↓
Validar
↓
Resolver conflictos
↓
Importar
↓
Resultado
```

---

# 53. ERRORES

Los errores deben explicar:

### Qué pasó

### Por qué

### Qué puede hacer el usuario

Ejemplo:

> No se pudo importar el personaje porque falta la clase.

> [ Ver problema ]

> [ Cancelar ]

---

# 54. EMPTY STATES

Cada pantalla vacía debe tener:

- explicación;
- ilustración/icono opcional;
- acción principal.

Ejemplo:

> Todavía no tienes personajes.

> Crea tu primer personaje para comenzar.

[ CREAR PERSONAJE ]

---

# 55. LOADING STATES

Utilizar skeletons cuando sea apropiado.

No bloquear toda la aplicación si solamente una sección está cargando.

---

# 56. OFFLINE UI

Debe existir un indicador discreto:

> ● Sin conexión

o:

> ✓ Guardado localmente

Durante sincronización:

> ↻ Sincronizando...

Cuando termina:

> ✓ Sincronizado

No utilizar mensajes intrusivos.

---

# 57. FEEDBACK

Después de una acción:

> ✓ Espada equipada.

> ✓ Poción utilizada.

> ✓ 5 HP recuperados.

Debe existir una notificación breve.

---

# 58. DESHACER

Para acciones reversibles:

> ✓ Poción utilizada.  
> [ DESHACER ]

La opción debe desaparecer después de un tiempo.

---

# 59. CONFIRMACIONES

No preguntar:

> "¿Estás seguro?"

para acciones triviales.

Sí preguntar para:

- eliminar;
- reemplazar;
- sobrescribir;
- abandonar campaña;
- eliminar personaje.

---

# 60. MODALES

Los modales deben utilizarse para:

- acciones rápidas;
- confirmaciones;
- detalles pequeños;
- selección contextual.

No utilizar modales para páginas completas.

---

# 61. BOTTOM SHEETS

En móvil, utilizar bottom sheets para:

- lanzar dados;
- modificar HP;
- usar objeto;
- seleccionar recurso;
- mostrar detalles rápidos.

Esto mantiene el contexto.

---

# 62. DESKTOP

En desktop:

- sidebar;
- paneles;
- dos columnas;
- mayor densidad informativa.

Pero la jerarquía debe mantenerse.

---

# 63. RESPONSIVE

Breakpoints no deben definirse únicamente por dispositivos concretos.

Deben adaptarse al espacio disponible.

Ejemplo conceptual:

```text
Mobile
1 columna

Tablet
2 columnas

Desktop
2–4 columnas según contexto
```

---

# 64. TIPOGRAFÍA

Debe priorizar:

- legibilidad;
- jerarquía;
- números grandes;
- textos cortos.

Especialmente:

- HP;
- CA;
- iniciativa;
- modificadores;
- resultados de dados.

---

# 65. COLOR

El sistema visual debe tener colores semánticos.

Por ejemplo:

- éxito;
- advertencia;
- error;
- información;
- recursos;
- estados.

Pero nunca utilizar únicamente color para comunicar información.

---

# 66. DARK MODE

Debe soportarse desde el inicio.

No implementar un "parche oscuro".

Todos los componentes deben tener tokens para:

- fondo;
- superficie;
- texto;
- borde;
- estado;
- interacción.

---

# 67. DISEÑO DE COMPONENTES

Crear un Design System.

Componentes:

```text
Button
Card
Badge
Chip
Modal
BottomSheet
Tabs
Accordion
Input
Select
Search
Toast
Tooltip
Progress
Counter
DiceButton
StatCard
InventoryItem
SpellCard
AttackCard
ResourceCounter
ConditionBadge
```

---

# 68. DESIGN TOKENS

Definir:

```text
colors
spacing
radius
typography
shadows
borders
motion
breakpoints
z-index
```

Nunca repetir valores arbitrariamente.

---

# 69. ICONOGRAFÍA

Los iconos deben:

- ser consistentes;
- tener significado;
- acompañarse de texto cuando sea necesario;
- ser accesibles.

Nunca utilizar un icono ambiguo para una acción crítica.

---

# 70. ACCESIBILIDAD

Objetivo:

> WCAG AA como mínimo.

Considerar:

- contraste;
- foco;
- navegación por teclado;
- lector de pantalla;
- tamaño táctil;
- texto escalable;
- reduced motion;
- labels;
- estados accesibles.

---

# 71. TOUCH TARGETS

Los botones principales deben ser cómodos para tocar.

Especialmente:

- `+`
- `−`
- atacar;
- lanzar;
- usar;
- equipar.

Evitar controles diminutos.

---

# 72. TECLADO

En desktop:

- Enter confirma;
- Escape cierra;
- shortcuts configurables para dados;
- navegación por teclado.

---

# 73. GESTOS

Opcionales:

- swipe;
- long press;
- pull to refresh.

Nunca depender únicamente de gestos.

---

# 74. ERROR PREVENTION

La interfaz debe prevenir errores antes de que ocurran.

Ejemplo:

Si no tiene suficientes flechas:

> Flechas ×0

El botón:

> ATACAR

puede mostrar advertencia o impedir el consumo automático según configuración.

---

# 75. INFORMACIÓN CONTEXTUAL

La misma información puede mostrarse con diferentes niveles de profundidad.

Ejemplo:

Modo Juego:

> CA 18

Tocar:

> 10 + 4 armadura + 2 escudo + 2 efectos.

Modo Gestión:

> fórmula completa + fuentes + modificadores.

---

# 76. PERSONALIZACIÓN

El usuario podrá configurar:

- favoritos;
- ataques rápidos;
- hechizos rápidos;
- objetos rápidos;
- recursos visibles;
- orden de secciones;
- tema;
- idioma;
- nivel de ayuda.

---

# 77. PERSONALIZACIÓN DEL MODO JUEGO

El usuario puede elegir qué mostrar.

Ejemplo:

```text
✓ HP
✓ CA
✓ Ataques
✓ Recursos
✓ Hechizos
✓ Inventario
☐ Historia
☐ Notas
```

Esto evita que el Modo Juego se vuelva demasiado grande.

---

# 78. PRINCIPIO "UNA ACCIÓN, UN TOQUE"

Siempre que sea seguro:

> una acción frecuente = un toque.

Ejemplos:

> Atacar → 1 toque

> Usar poción → 1 toque

> Gastar recurso → 1 toque

> Tirar d20 → 1 toque

Las acciones complejas requieren confirmación o configuración.

---

# 79. PRINCIPIO "NO PERDER CONTEXTO"

Cuando el usuario entra a un detalle y vuelve:

Debe regresar exactamente donde estaba.

Ejemplo:

```text
Inventario
 ↓
Espada larga
 ↓
Detalles
 ↓
Atrás
 ↓
Inventario
```

No volver al inicio.

---

# 80. BUSCAR ANTES QUE NAVEGAR

Siempre que una colección pueda crecer mucho:

> ofrecer búsqueda.

Esto aplica a:

- hechizos;
- objetos;
- Homebrew;
- monstruos;
- reglas;
- personajes;
- campañas.

---

# 81. FAVORITOS ANTES QUE MENÚS

Las acciones frecuentes deben poder convertirse en favoritos.

El sistema aprende del usuario mediante configuración explícita, no mediante comportamiento invasivo.

---

# 82. EXPERIENCIA DEL PRINCIPIANTE

El usuario nuevo debe poder:

1. abrir;
2. crear personaje;
3. entender cada elección;
4. terminar;
5. pulsar Modo Juego;
6. jugar.

No debería necesitar leer un manual para utilizar la aplicación.

---

# 83. EXPERIENCIA DEL JUGADOR AVANZADO

El usuario experimentado debe poder:

- saltar pasos;
- ocultar explicaciones;
- editar rápidamente;
- importar;
- utilizar Homebrew;
- acceder a reglas;
- configurar automatizaciones;
- personalizar Modo Juego.

---

# 84. EXPERIENCIA DEL DM

Aunque la primera experiencia esté enfocada al jugador, la arquitectura visual debe permitir posteriormente:

- pantalla de iniciativa;
- encuentros;
- monstruos;
- NPC;
- mapas;
- notas;
- loot;
- control de campaña.

No diseñar el producto de forma que esto sea imposible después.

---

# 85. EXPERIENCIA COMPLETA

La aplicación debe acompañar al jugador en cuatro momentos:

### Antes de jugar

Modo Gestión.

Preparación.

### Durante la partida

Modo Juego.

Acciones rápidas.

### Después de jugar

Modo Gestión.

Actualizar historia, inventario, XP y progreso.

### Entre campañas

Biblioteca + contenido + personajes + Homebrew.

---

# 86. PERSONALIDAD DE LA INTERFAZ

La aplicación puede tener pequeñas dosis de personalidad:

- mensajes de éxito;
- animaciones;
- ilustraciones;
- feedback de dados;
- estados especiales.

Pero nunca debe sacrificar:

> velocidad, claridad o accesibilidad.

---

# 87. REGLA VISUAL PRINCIPAL

Cada pantalla debe responder:

> ¿Cuál es la acción más importante que el usuario quiere realizar aquí?

Esa acción debe tener mayor jerarquía visual.

---

# 88. REGLA DE DENSIDAD

No eliminar información importante simplemente para que la pantalla se vea "bonita".

La aplicación debe encontrar el equilibrio:

> **alta densidad de información + excelente jerarquía visual.**

---

# 89. RESULTADO VISUAL DESEADO

El usuario debe sentir:

> "Esto es muchísimo más completo que una ficha."

pero simultáneamente:

> "Sé exactamente dónde tocar."

Ese equilibrio es uno de los objetivos centrales del diseño.

---

# 90. CRITERIO DE APROBACIÓN UX

Antes de implementar una pantalla, debe poder responderse:

- ¿Qué objetivo tiene?
- ¿Quién la utiliza?
- ¿Cuál es la acción principal?
- ¿Qué información necesita?
- ¿Qué información puede ocultarse?
- ¿Qué ocurre al pulsar cada acción?
- ¿Qué ocurre si falla?
- ¿Qué ocurre offline?
- ¿Cómo vuelve el usuario atrás?
- ¿Cómo funciona en móvil?
- ¿Cómo funciona en desktop?
- ¿Cómo funciona para un principiante?
- ¿Cómo funciona para un usuario avanzado?
- ¿Cómo se conecta con el Character State?

Si estas preguntas no tienen respuesta, la pantalla todavía no está definida.

---

# 91. REGLA FINAL

El sistema visual nunca debe dictar cómo funcionan las reglas.

La arquitectura debe ser:

```text
RULES
 ↓
DOMAIN
 ↓
APPLICATION
 ↓
UX
 ↓
UI
```

Nunca:

```text
UI
 ↓
decide
 ↓
regla de D&D
```

La interfaz representa el sistema.

No lo reemplaza.