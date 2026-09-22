# D&D COMPANION
## Especificación Funcional v0.4
### Arquitectura completa de navegación, pantallas y flujos

---

# 1. PRINCIPIO DE NAVEGACIÓN

La aplicación debe tener una estructura suficientemente completa para soportar todo D&D, pero la interfaz no debe sentirse como una enciclopedia.

El usuario debe poder llegar rápidamente a las funciones más importantes.

La navegación se divide en:

1. Inicio
2. Personajes
3. Modo Juego
4. Modo Gestión
5. Biblioteca
6. Campañas
7. Contenido / Homebrew
8. Perfil y configuración

No todas estas opciones deben estar permanentemente visibles.

La navegación debe adaptarse al contexto.

---

# 2. ESTRUCTURA GENERAL

Arquitectura conceptual:

```text
APP
│
├── Inicio
│
├── Personajes
│   ├── Mis personajes
│   ├── Crear personaje
│   ├── Importar personaje
│   └── Personaje
│       ├── Modo Juego
│       └── Modo Gestión
│
├── Biblioteca
│   ├── Reglas
│   ├── Clases
│   ├── Especies
│   ├── Subespecies
│   ├── Trasfondos
│   ├── Dotes
│   ├── Habilidades
│   ├── Hechizos
│   ├── Equipamiento
│   ├── Armas
│   ├── Armaduras
│   ├── Objetos mágicos
│   ├── Condiciones
│   ├── Monstruos
│   └── Homebrew
│
├── Campañas
│   ├── Mis campañas
│   ├── Crear campaña
│   └── Campaña
│
├── Contenido
│   ├── Mis packs
│   ├── Crear Homebrew
│   ├── Importar
│   └── Packs disponibles
│
└── Perfil
    ├── Cuenta
    ├── Idioma
    ├── Apariencia
    ├── Accesibilidad
    ├── Datos
    ├── Sincronización
    └── Acerca de
```

---

# 3. PRIMERA APERTURA

La primera vez que el usuario abre la aplicación debe aparecer una experiencia de bienvenida.

## Pantalla 1 — Bienvenida

Elementos:

- Logo;
- nombre de la aplicación;
- breve explicación;
- botón "Comenzar";
- "Ya tengo una cuenta";
- selector de idioma.

Mensaje conceptual:

> Tu personaje. Tus reglas. Tu partida.

No debe saturar al usuario con información.

---

# 4. CONFIGURACIÓN INICIAL

Después de comenzar:

## Pantalla — Preferencias iniciales

Opciones:

### Idioma

Por defecto:

> Español latinoamericano

Opciones adicionales:

- English;
- Português;
- Français;
- Italiano;
- Deutsch.

### Experiencia

Opcional:

> Soy nuevo en D&D

o

> Ya conozco D&D

Esto puede modificar la cantidad de explicaciones mostradas.

No modifica las reglas.

---

# 5. AUTENTICACIÓN

La aplicación debe permitir:

- crear cuenta;
- iniciar sesión;
- continuar como invitado cuando sea posible;
- recuperar cuenta;
- cerrar sesión.

El modo invitado puede utilizar almacenamiento local.

Para sincronización entre dispositivos se requiere una cuenta.

---

# 6. INICIO

## Pantalla principal

Debe mostrar:

### Continuar jugando

El personaje utilizado recientemente.

Ejemplo:

> Tharion  
> Guerrero nivel 5

Botón:

> CONTINUAR

### Mis personajes

Vista resumida.

### Mis campañas

Campañas recientes.

### Acciones rápidas

- Crear personaje;
- Importar personaje;
- Tirar dados;
- Biblioteca.

### Actividad reciente

Ejemplo:

> Tharion subió a nivel 5.

> Se agregaron 20 flechas.

> Campaña "Los hijos del dragón" actualizada.

---

# 7. PERSONAJES

## Pantalla — Mis personajes

Lista de personajes.

Cada tarjeta muestra:

- nombre;
- nivel;
- clase;
- especie;
- imagen;
- campaña si pertenece a una;
- reglaset;
- última modificación.

Acciones:

> Abrir

> Modo Juego

> Editar

> Duplicar

> Exportar

> Compartir

> Eliminar

La eliminación requiere confirmación.

---

# 8. CREAR PERSONAJE

El creador debe funcionar como un **wizard guiado**.

Nunca debe presentar un formulario gigantesco.

Flujo:

```text
Reglas
 ↓
Concepto
 ↓
Especie
 ↓
Clase
 ↓
Subclase
 ↓
Trasfondo
 ↓
Características
 ↓
Proficiencias
 ↓
Equipo
 ↓
Hechizos
 ↓
Personalidad
 ↓
Apariencia
 ↓
Historia
 ↓
Revisión
 ↓
Crear
```

El sistema debe permitir retroceder sin perder información.

---

# 9. CREACIÓN — REGLAS

## Pantalla — Elegir sistema

Opciones:

### D&D 2014

### D&D 2024

Debe explicarse brevemente que algunas opciones cambian según la edición.

Una vez seleccionado:

> Reglaset: D&D 2024

queda asociado al personaje.

---

# 10. CREACIÓN — CONCEPTO

El usuario puede introducir:

- nombre;
- concepto;
- idea del personaje;
- estilo de juego.

Ejemplo:

> "Quiero un guerrero resistente que use espada y escudo."

La aplicación puede utilizar esa información para orientar las recomendaciones.

No debe elegir automáticamente sin autorización.

---

# 11. CREACIÓN — ESPECIE

## Pantalla — Seleccionar especie

Debe mostrar:

- buscador;
- filtros;
- categorías;
- favoritos;
- contenido disponible.

Cada opción debe tener:

- nombre;
- descripción;
- características;
- fuente;
- edición compatible.

Al seleccionar:

> VER DETALLES

> ELEGIR

---

# 12. CREACIÓN — CLASE

Mismo sistema.

Mostrar:

- nombre;
- descripción;
- rol;
- características;
- dificultad;
- estadísticas relevantes;
- fuente;
- compatibilidad.

Opcionalmente:

> "¿Qué clase me conviene?"

La aplicación puede explicar opciones sin decidir por el usuario.

---

# 13. CREACIÓN — SUBCLASE

Solo aparece cuando corresponda.

Debe adaptarse automáticamente a:

- edición;
- clase;
- nivel;
- contenido disponible.

---

# 14. CREACIÓN — TRASFONDO

Seleccionar:

- trasfondo;
- habilidades;
- herramientas;
- idiomas;
- características;
- opciones correspondientes a la edición.

Debe existir búsqueda.

---

# 15. CREACIÓN — CARACTERÍSTICAS

Opciones:

- estándar;
- point buy;
- dados;
- manual;
- personalizado.

El método seleccionado debe respetar el ruleset correspondiente.

---

# 16. CREACIÓN — PROGRESIÓN AUTOMÁTICA

Cuando el personaje suba de nivel, la aplicación debe detectar:

- nuevas características;
- mejoras;
- dotes;
- espacios de hechizo;
- competencias;
- recursos;
- opciones de clase.

No debe simplemente aumentar un número.

Debe ejecutar el proceso correspondiente.

---

# 17. CREACIÓN — EQUIPO

La aplicación muestra las opciones disponibles.

El usuario puede:

- seleccionar;
- agregar;
- eliminar;
- personalizar.

Al finalizar:

> Crear inventario inicial.

---

# 18. CREACIÓN — HECHIZOS

Si corresponde:

- elegir cantrips;
- elegir hechizos;
- preparar;
- revisar;
- marcar favoritos.

La aplicación debe validar requisitos.

---

# 19. CREACIÓN — PERSONALIDAD

Campos:

- rasgos;
- ideales;
- vínculos;
- defectos;
- personalidad;
- alineamiento cuando corresponda.

---

# 20. CREACIÓN — APARIENCIA

Campos:

- edad;
- altura;
- peso;
- ojos;
- cabello;
- piel;
- descripción;
- imagen/avatar.

---

# 21. CREACIÓN — HISTORIA

Editor libre.

Puede contener:

- historia;
- familia;
- relaciones;
- enemigos;
- aliados;
- objetivos;
- secretos;
- acontecimientos.

---

# 22. CREACIÓN — REVISIÓN

Antes de crear el personaje:

Mostrar resumen completo.

Ejemplo:

```text
THARION

Guerrero 5
Humano
Trasfondo: Soldado

FUE 18
DES 14
CON 16
INT 10
SAB 12
CAR 10

CA 18
HP 45
Velocidad 30 ft

Equipo:
Espada larga
Escudo
Armadura
...
```

El sistema debe señalar problemas.

Ejemplo:

> ⚠️ Falta seleccionar una competencia.

El personaje no debe crearse hasta resolver errores críticos.

---

# 23. PERSONAJE — PANTALLA CENTRAL

Una vez creado:

```text
PERSONAJE
│
├── MODO JUEGO
│
└── MODO GESTIÓN
```

Esta es una decisión estructural fundamental.

---

# 24. MODO JUEGO

Pantalla diseñada para sesión.

Elementos prioritarios:

```text
THARION
Guerrero 5

HP
38 / 45

CA 18
INI +4
VEL 30

[ ATAQUE 1 ]
[ ATAQUE 2 ]

[ HECHIZOS ]

[ RECURSOS ]

[ INVENTARIO RÁPIDO ]

🎲 DADOS
```

Las acciones principales deben estar disponibles sin navegar profundamente.

---

# 25. MODO JUEGO — BARRA DE ACCIONES

Debe existir una zona de acceso rápido para:

- dados;
- ataques;
- hechizos;
- inventario;
- condiciones;
- recursos.

El diseño exacto puede cambiar según dispositivo.

---

# 26. MODO JUEGO — ATAQUES

Seleccionar ataque.

Mostrar:

```text
ESPADA LARGA

Ataque
+7

[ ATACAR ]
```

Después:

```text
Resultado
18

[ TIRAR DAÑO ]
```

Después:

```text
Daño
9

[ GUARDAR ]
```

El sistema puede registrar automáticamente la acción.

---

# 27. MODO JUEGO — HECHIZOS

Pantalla rápida:

```text
FAVORITOS

Rayo de fuego
Bola de fuego
Curar heridas
Escudo
```

Cada hechizo puede mostrar:

- nivel;
- alcance;
- duración;
- concentración;
- componentes;
- tirada;
- efecto.

---

# 28. MODO JUEGO — RECURSOS

Mostrar solo los importantes.

Ejemplo:

```text
SEGUNDO ALIENTO
1 / 1

[ − ] [ + ]

ACCIÓN SURGENTE
1 / 1

[ − ] [ + ]
```

---

# 29. MODO JUEGO — CONDICIONES

Las condiciones activas aparecen permanentemente visibles.

Ejemplo:

```text
ESTADOS

🟠 Envenenado
🔵 Invisible
```

Al tocar:

> Ver efectos

> Duración

> Eliminar

---

# 30. MODO JUEGO — INVENTARIO RÁPIDO

Solo objetos seleccionados como favoritos.

Ejemplo:

```text
POCIÓN ×2
[ USAR ]

ANTORCHA ×4
[ USAR ]

FLECHAS ×23
[ − ] [ + ]
```

---

# 31. MODO JUEGO — DADOS

Panel flotante.

```text
d4
d6
d8
d10
d12
d20
d100
```

Cantidad:

> 1

Modificador:

> +0

Opciones:

- ventaja;
- desventaja;
- repetir;
- guardar.

Entrada avanzada:

> 8d6 + 4

---

# 32. MODO JUEGO — HISTORIAL

Registro de acciones de la sesión.

Debe poder mostrar:

- tiradas;
- ataques;
- daños;
- hechizos;
- recursos;
- inventario;
- condiciones.

---

# 33. MODO GESTIÓN

Es la ficha completa.

Debe organizarse por secciones.

```text
Resumen
Estadísticas
Características
Hechizos
Inventario
Equipamiento
Recursos
Condiciones
Historia
Dinero
Notas
Configuración
```

---

# 34. GESTIÓN — RESUMEN

Mostrar:

- identidad;
- nivel;
- clase;
- especie;
- trasfondo;
- XP;
- inspiración;
- HP;
- CA;
- iniciativa;
- velocidad.

---

# 35. GESTIÓN — ESTADÍSTICAS

Mostrar:

### Características

- Fuerza;
- Destreza;
- Constitución;
- Inteligencia;
- Sabiduría;
- Carisma.

Cada una:

- puntuación;
- modificador.

### Salvaciones

### Habilidades

### Percepción

### Competencia

---

# 36. GESTIÓN — CARACTERÍSTICAS

Organizar:

- clase;
- subclase;
- especie;
- trasfondo;
- dotes;
- características especiales.

Cada elemento debe poder abrirse para consultar detalles.

---

# 37. GESTIÓN — HECHIZOS

Organizar por:

- cantrips;
- nivel 1;
- nivel 2;
- nivel 3;
- etc.

Mostrar espacios:

```text
Nivel 1
3 / 4

Nivel 2
2 / 3
```

Acciones:

- preparar;
- quitar;
- favorito;
- lanzar;
- consultar.

---

# 38. GESTIÓN — INVENTARIO

Inventario completo.

Filtros:

- todo;
- equipado;
- armas;
- armaduras;
- consumibles;
- munición;
- objetos mágicos;
- herramientas;
- otros.

Ordenar por:

- nombre;
- cantidad;
- peso;
- valor;
- categoría.

---

# 39. GESTIÓN — EQUIPAMIENTO

Representación visual del personaje.

Espacios:

- cabeza;
- armadura;
- manos;
- arma;
- escudo;
- capa;
- anillos;
- amuleto;
- etc.

Los espacios deben poder adaptarse a Homebrew.

---

# 40. GESTIÓN — RECURSOS

Pantalla completa para administrar recursos.

Permite:

- crear;
- editar;
- eliminar;
- modificar;
- establecer máximo;
- establecer valor actual;
- definir icono;
- definir color;
- configurar recuperación.

Ejemplo:

> Ki / Puntos de enfoque / Cargas / Homebrew.

---

# 41. GESTIÓN — CONDICIONES

Mostrar todas las condiciones actuales.

También:

> Agregar condición

Buscador.

Al seleccionar:

- efectos;
- duración;
- fuente;
- notas.

---

# 42. GESTIÓN — DINERO

Pantalla:

```text
PO
150

PP
2

PE
0

PA
43

PC
18
```

Acciones:

- agregar;
- quitar;
- convertir;
- historial.

---

# 43. GESTIÓN — HISTORIA

Subsecciones:

- apariencia;
- personalidad;
- historia;
- relaciones;
- objetivos;
- secretos;
- notas.

---

# 44. GESTIÓN — CONFIGURACIÓN DEL PERSONAJE

Opciones:

- reglaset;
- contenido habilitado;
- reglas opcionales;
- automatizaciones;
- consumo automático;
- privacidad;
- compartir;
- exportar;
- eliminar.

Cambiar reglaset después de creado debe generar advertencias y validación.

---

# 45. BIBLIOTECA

La Biblioteca funciona como una especie de manual digital inteligente.

Categorías:

```text
Reglas
Especies
Clases
Subclases
Trasfondos
Dotes
Habilidades
Hechizos
Armas
Armaduras
Equipamiento
Objetos mágicos
Condiciones
Monstruos
Contenido Homebrew
```

---

# 46. BÚSQUEDA GLOBAL

Debe existir búsqueda desde cualquier parte.

Ejemplo:

> "espada larga"

Resultados:

- arma;
- reglas relacionadas;
- ataques;
- contenido Homebrew;
- resultados compatibles con el personaje.

El sistema debe priorizar resultados relevantes al contexto.

---

# 47. PANTALLA DE DETALLE DE CONTENIDO

Cada entidad tendrá una pantalla consistente.

Ejemplo:

```text
ESPADA LARGA

Tipo: Arma
Daño: ...
Propiedades: ...

Fuente
D&D 2024

Compatible:
✓ 2024
✓ ...
```

Acciones:

> Agregar al personaje

> Favorito

> Compartir

> Editar si es propio

---

# 48. CONTENIDO / CONTENT PACKS

Los contenidos deben agruparse en packs.

Tipos:

### SRD

Contenido disponible legalmente bajo la licencia correspondiente.

### Oficial/licenciado

Contenido que la aplicación tenga derecho a distribuir.

### Homebrew

Contenido creado por usuarios.

### Propio

Contenido desarrollado por el proyecto.

### Importado

Contenido incorporado por el usuario cuando tenga derecho a utilizarlo.

Cada pack debe conservar:

- autor;
- fuente;
- versión;
- licencia;
- edición;
- idioma;
- fecha;
- compatibilidad.

---

# 49. PANTALLA DE PACKS

Mostrar:

```text
MIS PACKS

SRD
D&D 2024

Homebrew Alejo
12 elementos

Campaña Dragones
34 elementos
```

Acciones:

- activar;
- desactivar;
- editar;
- exportar;
- compartir;
- actualizar.

---

# 50. HOMEbrew

Pantalla:

```text
MI HOMEbrew

Clases
Subclases
Especies
Hechizos
Objetos
Monstruos
Reglas
...
```

Botón:

> + CREAR

---

# 51. EDITOR HOMEbrew

Debe ser un editor visual.

No requiere programación.

Ejemplo para crear un arma:

```text
Nombre
Tipo
Daño
Propiedades
Peso
Valor
Descripción
Efectos
Requisitos
Edición
```

Validar antes de guardar.

---

# 52. IMPORTAR

Pantalla:

> Importar contenido

Opciones:

- archivo;
- paquete;
- código;
- personaje;
- contenido.

Antes de importar:

> Vista previa

Mostrar:

- contenido;
- autor;
- fuente;
- edición;
- licencia declarada;
- versión;
- conflictos.

---

# 53. CONFLICTOS DE IMPORTACIÓN

Ejemplo:

> Ya existe "Espada de fuego".

Opciones:

- reemplazar;
- mantener ambas;
- crear copia;
- cancelar.

Nunca sobrescribir silenciosamente.

---

# 54. CAMPAÑAS

## Mis campañas

Mostrar:

- nombre;
- DM;
- personajes;
- última actividad;
- reglaset.

Acciones:

> Entrar

> Configurar

> Salir

---

# 55. CREAR CAMPAÑA

Campos:

- nombre;
- descripción;
- DM;
- reglaset;
- contenido habilitado;
- privacidad;
- código de invitación.

---

# 56. PANTALLA DE CAMPAÑA

```text
CAMPAÑA

Los hijos del dragón

Jugadores
Personajes

Sesiones
Notas
Contenido
Encounters
Monstruos
Loot
Configuración
```

---

# 57. ROL DEL JUGADOR

Un jugador puede:

- ver campaña;
- administrar personaje;
- participar;
- consultar contenido;
- recibir recompensas;
- compartir información permitida.

No puede modificar elementos administrativos salvo permiso.

---

# 58. ROL DEL DM

Arquitectura preparada para:

- encuentros;
- iniciativa;
- monstruos;
- NPC;
- mapas;
- notas;
- loot;
- recompensas;
- condiciones;
- eventos;
- gestión de jugadores.

---

# 59. NAVEGACIÓN DURANTE UNA CAMPAÑA

El personaje continúa teniendo:

> Modo Juego

Pero puede existir un contexto:

> Campaña actual.

Esto permitirá futuras funciones como:

- iniciativa compartida;
- efectos de campaña;
- recompensas;
- sincronización con DM.

---

# 60. PERFIL

Pantalla:

```text
Mi cuenta

Nombre
Idioma
Tema
Accesibilidad
Sincronización
Datos
Privacidad
Exportación
Acerca de
```

---

# 61. CONFIGURACIÓN

### Apariencia

- claro;
- oscuro;
- automático.

### Idioma

Sistema de traducciones.

### Accesibilidad

- tamaño de texto;
- contraste;
- movimiento reducido;
- feedback;
- accesibilidad táctil.

### Datos

- exportar;
- importar;
- eliminar.

---

# 62. OFFLINE

La aplicación debe seguir siendo funcional cuando no haya conexión.

El usuario debe poder:

- abrir personajes;
- utilizar Modo Juego;
- modificar HP;
- modificar inventario;
- tirar dados;
- utilizar recursos;
- lanzar hechizos;
- modificar dinero;
- consultar contenido previamente almacenado.

Al recuperar conexión:

> Sincronizando...

---

# 63. SINCRONIZACIÓN

El usuario puede utilizar:

> PC → teléfono → tablet

sin perder información.

El sistema debe manejar conflictos.

Ejemplo:

PC:

> Flechas 20

Teléfono:

> Flechas 18

Debe detectar conflicto y aplicar estrategia definida.

---

# 64. NAVEGACIÓN MOBILE

En teléfono, la navegación principal debe priorizar:

```text
Inicio
Personajes
Biblioteca
Campañas
Perfil
```

Cuando el usuario abre un personaje:

```text
Modo Juego
Modo Gestión
```

debe convertirse en la navegación dominante.

---

# 65. NAVEGACIÓN DESKTOP

En escritorio se puede utilizar un sidebar.

Ejemplo:

```text
D&D COMPANION

Inicio
Personajes
Biblioteca
Campañas
Contenido

────────

Personaje actual

Modo Juego
Modo Gestión
```

La funcionalidad es la misma.

Solo cambia la presentación.

---

# 66. SISTEMA DE NAVEGACIÓN CONTEXTUAL

No todas las funciones deben aparecer siempre.

Ejemplo:

Si el usuario está viendo un hechizo:

> Agregar a personaje

debe aparecer como acción principal.

Si está viendo una espada:

> Agregar al inventario

Si está viendo una condición:

> Aplicar a personaje

Si está viendo un recurso:

> Agregar recurso

La aplicación debe aprovechar el contexto.

---

# 67. ACCIONES GLOBALES

Desde cualquier parte debería ser posible acceder rápidamente a:

- búsqueda;
- dados;
- personaje activo;
- Modo Juego.

Esto reduce la navegación innecesaria.

---

# 68. PERSONAJE ACTIVO

El usuario puede definir un:

> Personaje activo.

El personaje activo permite que acciones contextuales sepan automáticamente a quién modificar.

Ejemplo:

Desde Biblioteca:

> Agregar espada larga.

El sistema pregunta o utiliza:

> Personaje activo: Tharion.

---

# 69. FAVORITOS

El usuario puede marcar:

- personajes;
- hechizos;
- ataques;
- objetos;
- reglas;
- condiciones;
- monstruos;
- contenido.

Los favoritos deben ser accesibles rápidamente.

---

# 70. NOTIFICACIONES Y FEEDBACK

Las acciones deben producir feedback.

Ejemplo:

> ✓ Poción utilizada.

> ✓ 5 HP recuperados.

> ✓ Flecha consumida.

> ⚠️ No tienes suficiente munición.

> ⚠️ Superas tu capacidad de carga.

El feedback debe ser claro pero no molesto.

---

# 71. MODALES Y CONFIRMACIONES

No utilizar confirmaciones para todo.

Confirmar cuando exista riesgo:

- eliminar;
- reemplazar;
- sobrescribir;
- cambiar reglaset;
- eliminar personaje;
- gastar recursos importantes si así lo configura el usuario.

Las acciones reversibles deben poder ejecutarse rápidamente.

---

# 72. SISTEMA DE DESHACER

Las modificaciones importantes deben generar eventos reversibles.

Ejemplo:

> Flechas 20 → 19

Puede aparecer:

> Deshacer

Esto será especialmente importante durante sesiones de juego.

---

# 73. ESTADO DE CARGA

La aplicación debe contemplar:

- cargando;
- vacío;
- error;
- offline;
- sincronizando;
- actualizado.

Nunca mostrar una pantalla rota.

---

# 74. EMPTY STATES

Ejemplo:

Sin personajes:

> Todavía no tienes personajes.

> [ CREAR PERSONAJE ]

> [ IMPORTAR ]

Sin campañas:

> Todavía no participas en una campaña.

Esto debe aplicarse a toda la aplicación.

---

# 75. SISTEMA DE AYUDA

Cada sección compleja puede incluir:

> ¿Cómo funciona?

Especialmente para:

- creación;
- características;
- hechizos;
- reglas;
- inventario;
- recursos.

El usuario avanzado podrá ocultar ayudas.

---

# 76. PRINCIPIO "BEGINNER / ADVANCED"

La aplicación debe tener dos niveles de experiencia:

### Beginner

Más explicaciones.

Más contexto.

Menos información simultánea.

### Advanced

Interfaz más compacta.

Menos explicaciones.

Acceso rápido.

Nunca deben existir dos sistemas de reglas diferentes.

Solo cambia la presentación.

---

# 77. FLUJO PRINCIPAL DEL USUARIO

El flujo ideal:

```text
Abrir aplicación
        ↓
Inicio
        ↓
Crear personaje
        ↓
Elegir reglas
        ↓
Crear personaje
        ↓
Ficha
        ↓
Modo Gestión
        ↓
Preparar personaje
        ↓
Iniciar partida
        ↓
Modo Juego
        ↓
Jugar
        ↓
Finalizar sesión
        ↓
Modo Gestión
```

---

# 78. FLUJO DE UNA ACCIÓN

Toda acción importante debe seguir:

```text
INTENCIÓN
   ↓
ACCIÓN
   ↓
VALIDACIÓN
   ↓
CÁLCULO
   ↓
ACTUALIZACIÓN
   ↓
REGISTRO
   ↓
FEEDBACK
```

Ejemplo:

```text
Atacar
 ↓
Verificar arma
 ↓
Verificar recursos/munición
 ↓
Calcular ataque
 ↓
Tirar d20
 ↓
Calcular resultado
 ↓
Consumir munición
 ↓
Registrar
 ↓
Mostrar resultado
```

---

# 79. REGLA DE ORO DE LA INTERFAZ

Nunca hacer que el usuario introduzca manualmente información que el sistema ya conoce.

Si la aplicación sabe:

- nivel;
- clase;
- competencia;
- arma;
- características;
- recursos;
- inventario;

debe utilizar esos datos automáticamente.

---

# 80. RESULTADO ESPERADO

Al finalizar esta arquitectura, la aplicación debe sentirse como:

> **Una ficha inteligente + inventario inteligente + manual + lanzador de dados + asistente de sesión + gestor de campaña.**

Pero el usuario no debe sentir que está utilizando seis aplicaciones diferentes.

Debe sentir que está utilizando:

# D&D COMPANION

Un único sistema conectado.

---

# 81. REGLA ARQUITECTÓNICA FINAL

Todas las pantallas deben ser representaciones de los mismos datos centrales.

Nunca:

```text
Modo Juego = datos propios
Modo Gestión = datos propios
Ficha = datos propios
Inventario = datos propios
```

Debe ser:

```text
                CHARACTER STATE
                      │
        ┌─────────────┼─────────────┐
        ↓             ↓             ↓
   MODO JUEGO    MODO GESTIÓN    CAMPAÑA
        │             │             │
        └─────────────┼─────────────┘
                      ↓
               REGLAS ENGINE
                      ↓
              DATABASE / SYNC
```

Esta estructura debe considerarse un requisito fundamental del producto.