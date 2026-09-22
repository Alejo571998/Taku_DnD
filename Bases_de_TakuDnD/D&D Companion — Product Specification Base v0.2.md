# D&D COMPANION
## Product Specification — Base v0.2

---

## 1. VISIÓN DEL PRODUCTO

Crear una aplicación web/PWA completa para jugadores y Directores de Juego de Dungeons & Dragons.

La aplicación debe funcionar como:

- creador de personajes;
- hoja de personaje digital inteligente;
- asistente durante las partidas;
- sistema de inventario;
- gestor de dinero;
- gestor de hechizos;
- gestor de recursos;
- lanzador de dados;
- biblioteca de reglas y contenido;
- gestor de campañas;
- plataforma Homebrew;
- sistema de importación de contenido;
- sistema preparado para diferentes ediciones/reglas.

El objetivo principal es que un jugador nuevo pueda utilizar la aplicación prácticamente desde el primer minuto, mientras que un jugador experimentado pueda acceder rápidamente a herramientas avanzadas.

La aplicación no debe ser una simple reproducción digital de una hoja de papel.

Debe ser una herramienta interactiva que entienda las relaciones entre los diferentes elementos del personaje y realice automáticamente los cálculos y actualizaciones correspondientes.

---

# 2. PRINCIPIOS FUNDAMENTALES

## 2.1 Simplicidad

La aplicación debe esconder la complejidad de las reglas cuando no sea necesaria.

El usuario debe poder utilizar una función sin conocer previamente cómo se calcula.

Ejemplo:

En lugar de pedir:

"Calcula tu modificador de ataque".

Mostrar:

ESPADA LARGA

Ataque: +5
Daño: 1d8+3

[ ATACAR ]

---

## 2.2 Automatización

Siempre que el sistema pueda calcular algo automáticamente, debe hacerlo.

Ejemplos:

- modificadores;
- competencia;
- salvaciones;
- habilidades;
- CA;
- iniciativa;
- velocidad;
- ataques;
- daño;
- CD de hechizos;
- cargas;
- usos disponibles;
- ranuras de hechizos;
- peso;
- capacidad de carga;
- cantidades de munición;
- efectos derivados de equipo;
- efectos derivados de características;
- progresión por nivel.

---

## 2.3 Mobile First

La experiencia principal debe estar diseñada para utilizarse durante una partida desde un teléfono.

La interfaz desktop debe adaptarse a la misma arquitectura, pero no debe ser el punto de partida.

La aplicación debe ser una PWA instalable desde el navegador.

Debe contemplarse:

- instalación en Android;
- instalación en iOS;
- instalación en desktop;
- funcionamiento offline;
- sincronización posterior.

---

# 3. EDICIONES Y REGLAS

La aplicación debe soportar:

## D&D 5e 2014

## D&D 2024

Ambas deben coexistir.

Cada personaje debe tener asociado un:

RULESET

Ejemplo:

Character
→ Ruleset: D&D 2014

o

Character
→ Ruleset: D&D 2024

También las campañas deben tener un Ruleset.

---

## 3.1 NO MEZCLAR REGLAS AUTOMÁTICAMENTE

El sistema nunca debe mezclar contenido de 2014 y 2024 silenciosamente.

Si un usuario intenta utilizar contenido de una edición diferente:

Mostrar advertencia.

Ejemplo:

"Este contenido pertenece a D&D 2014 y tu personaje utiliza D&D 2024."

Opciones:

[Usar de todos modos]

[Buscar alternativa compatible]

[Cancelar]

---

## 3.2 CONTENIDO COMPATIBLE

Cada elemento de contenido debe tener metadatos:

- edición;
- versión;
- fuente;
- tipo;
- autor;
- licencia;
- compatibilidad;
- idioma;
- fecha de creación;
- versión del contenido.

---

# 4. SISTEMA DE CONTENIDO

La aplicación debe soportar cuatro fuentes principales.

## 4.1 SRD

Contenido basado en SRD permitido.

Debe estar identificado claramente como:

SOURCE: SRD

---

## 4.2 CONTENIDO PROPIO

Contenido creado por el desarrollador de la aplicación.

SOURCE: OFFICIAL APP CONTENT

---

## 4.3 HOMEBREW

Contenido creado por usuarios.

Ejemplos:

- clases;
- subclases;
- especies;
- subespecies;
- backgrounds;
- feats;
- hechizos;
- armas;
- armaduras;
- objetos;
- objetos mágicos;
- habilidades;
- monstruos;
- reglas;
- variantes.

---

## 4.4 IMPORTACIÓN

El usuario podrá importar contenido autorizado o creado por él.

La aplicación debe contemplar inicialmente formatos estructurados como:

- JSON;
- paquetes de contenido;
- archivos compatibles;
- importación mediante código;
- contenido compartido.

La importación debe mantener información de:

- fuente;
- autor;
- edición;
- licencia;
- versión.

IMPORTANTE:

La función de importación no debe interpretarse como una función para evadir copyright.

Debe permitir importar contenido que el usuario tenga derecho a utilizar.

---

# 5. BIBLIOTECA

Crear una biblioteca global.

Categorías:

- reglas;
- clases;
- subclases;
- especies;
- subespecies;
- backgrounds;
- feats;
- habilidades;
- hechizos;
- armas;
- armaduras;
- equipo;
- objetos;
- objetos mágicos;
- condiciones;
- monstruos;
- contenido Homebrew.

---

# 6. BUSCADOR GLOBAL

El usuario debe poder buscar desde cualquier parte.

Ejemplo:

"espada larga"

Resultado:

ESPADA LARGA

Tipo:
Arma marcial

Daño:
1d8

Propiedades:
Versátil

Fuente:
SRD

---

# 7. CREACIÓN DE PERSONAJE

La creación debe ser un wizard.

No debe presentarse como un formulario gigante.

Flujo recomendado:

1. Reglas
2. Concepto
3. Especie
4. Clase
5. Subclase cuando corresponda
6. Background
7. Atributos
8. Competencias
9. Equipamiento
10. Hechizos
11. Personalidad
12. Apariencia
13. Historia
14. Revisión
15. Crear personaje

---

# 8. MODO PRINCIPIANTE

Durante la creación:

El usuario puede activar:

"Modo principiante"

En este modo la aplicación explica cada elección.

Ejemplo:

FUERZA

"Representa la capacidad física de tu personaje. Influye en ataques cuerpo a cuerpo y determinadas habilidades."

Mostrar:

¿Por qué podría interesarte?

"Esta característica suele ser importante para guerreros, bárbaros y otros personajes físicos."

---

# 9. MODO AVANZADO

Los jugadores experimentados pueden activar:

"Modo avanzado"

La interfaz será más compacta.

Se reducen explicaciones y se prioriza velocidad.

---

# 10. ATRIBUTOS

Soportar:

- ingreso manual;
- Standard Array;
- Point Buy;
- tiradas;
- métodos personalizados.

Sistema de tiradas:

4d6 descartando el menor.

Debe poder configurarse si el sistema de la campaña utiliza otro método.

---

# 11. HOJA DE PERSONAJE INTELIGENTE

La hoja debe incluir como mínimo:

- nombre;
- nivel;
- experiencia;
- clase;
- subclase;
- especie;
- background;
- alineamiento si corresponde;
- inspiración;
- competencia;
- atributos;
- modificadores;
- salvaciones;
- habilidades;
- percepción pasiva;
- CA;
- iniciativa;
- velocidad;
- HP máximo;
- HP actual;
- HP temporal;
- dados de golpe;
- salvaciones contra muerte;
- ataques;
- hechizos;
- recursos;
- rasgos;
- feats;
- competencias;
- idiomas;
- equipo;
- inventario;
- dinero;
- notas.

---

# 12. COMBATE

Crear un "Modo Aventura".

Este modo debe mostrar únicamente la información relevante durante una partida.

Ejemplo:

PERSONAJE

Nivel 5

HP
34 / 42

CA
18

INICIATIVA
+4

---

ATAQUES

Espada larga
+7
1d8+3

[ ATACAR ]

Arco
+5
1d8+2

[ ATACAR ]

---

RECURSOS

Segundo Aliento
1 / 1

[ − ] [ + ]

---

DADOS

[ d20 ]

---

# 13. ATAQUES

El usuario puede pulsar:

ATACAR

El sistema tira automáticamente el dado correspondiente.

Ejemplo:

d20 + 7

Resultado:

17 + 7 = 24

Después:

"¿Tirar daño?"

[ TIRAR DAÑO ]

La aplicación tira:

1d8 + 3

Resultado:

8

---

# 14. PUNTOS DE VIDA

Debe existir:

HP máximo
HP actual
HP temporal

Acciones rápidas:

[ − DAÑO ]

[ + CURAR ]

[ HP TEMPORAL ]

También debe permitir introducir una cantidad manual.

---

# 15. ESTADOS Y CONDICIONES

Crear sistema de condiciones.

Ejemplos:

- cegado;
- encantado;
- ensordecido;
- asustado;
- agarrado;
- incapacitado;
- invisible;
- paralizado;
- petrificado;
- envenenado;
- derribado;
- restringido;
- aturdido;
- inconsciente;
- etc.

Cada condición debe poder activarse/desactivarse.

Opcionalmente:

- duración;
- ronda;
- origen;
- notas.

---

# 16. SISTEMA DE RECURSOS

Cualquier recurso consumible debe utilizar un contador.

Ejemplo:

SEGUNDO ALIENTO

1 / 1

[ − ] [ + ]

Otro:

RANURAS DE NIVEL 1

3 / 4

[ − ] [ + ]

Otro:

CARGAS

2 / 3

[ − ] [ + ]

---

# 17. HECHIZOS

Sistema completo de hechizos.

Separar:

- conocidos;
- preparados;
- disponibles;
- lanzados;
- favoritos.

Mostrar:

- nivel;
- escuela;
- tiempo de lanzamiento;
- alcance;
- componentes;
- duración;
- concentración;
- ritual;
- descripción;
- daño;
- salvación;
- fuente.

---

# 18. LANZAMIENTO DE HECHIZOS

Botón:

[ LANZAR ]

Debe poder consumir automáticamente:

- ranura;
- carga;
- recurso correspondiente.

El usuario puede cancelar o modificar el consumo.

---

# 19. INVENTARIO

Sistema completo.

Categorías:

- equipado;
- mochila;
- armas;
- armaduras;
- objetos;
- objetos mágicos;
- consumibles;
- herramientas;
- misceláneos;
- munición.

Cada elemento debe tener:

- nombre;
- cantidad;
- peso;
- valor;
- categoría;
- descripción;
- propiedades;
- equipado;
- ubicación.

---

# 20. EQUIPO EQUIPADO

Crear slots.

Ejemplo:

- mano principal;
- mano secundaria;
- armadura;
- casco;
- capa;
- anillo;
- amuleto;
- etc.

Los slots deben ser configurables según reglas/contenido.

Equipar un objeto puede modificar automáticamente estadísticas.

---

# 21. MUNICIÓN Y ELEMENTOS CONSUMIBLES

Debe existir tracking individual.

Ejemplo:

Flechas

23

[ − ] [ + ]

Si el usuario utiliza:

"Disparar"

23 → 22

También:

- antorchas;
- raciones;
- dardos;
- virotes;
- pociones;
- componentes consumibles;
- cargas;
- etc.

---

# 22. PESO Y CAPACIDAD

Calcular automáticamente el peso total.

Mostrar:

Peso actual / capacidad

Ejemplo:

67 / 90 lb

Estados:

Normal
Cerca del límite
Excedido

---

# 23. DINERO

Soportar las cinco denominaciones:

- PO — Platino
- PO/GP según nomenclatura interna elegida para oro
- PE — Electrum
- PA/PP según nomenclatura definida para plata
- PC — Cobre

IMPORTANTE:

La aplicación debe definir una nomenclatura de UI consistente en español latino y conservar internamente códigos inequívocos para evitar confusiones entre denominaciones.

La interfaz debe mostrar las cinco monedas con su nombre completo.

Cada moneda:

[ − ] [ + ]

También:

"Valor total equivalente"

sin destruir ni convertir automáticamente las monedas originales.

---

# 24. DADOS

Crear Dice Roller independiente.

Dados:

d4
d6
d8
d10
d10%
d12
d20

Debe permitir cantidades múltiples.

Ejemplos:

1d20
2d20
4d6
8d6
2d8+4

Debe permitir:

- cantidad;
- tipo;
- modificador;
- ventaja;
- desventaja;
- repetir;
- tirar múltiples conjuntos;
- historial.

---

# 25. HISTORIAL DE DADOS

Guardar:

- fecha;
- hora;
- fórmula;
- resultado;
- contexto opcional.

Ejemplo:

12:43

2d6 + 3

Resultado: 11

---

# 26. HOMEBREW

Sistema completo para crear contenido.

CREAR:

- clase;
- subclase;
- especie;
- subespecie;
- background;
- feat;
- hechizo;
- arma;
- armadura;
- objeto;
- objeto mágico;
- habilidad;
- regla;
- monstruo.

---

# 27. EDITOR HOMEBREW

Debe existir un editor visual.

El usuario no debería necesitar programar.

Ejemplo:

CREAR HECHIZO

Nombre
Nivel
Escuela
Tiempo
Alcance
Componentes
Duración
Concentración
Descripción
Daño
Tipo de daño
Salvación
Efectos
Escalado

[ GUARDAR ]

---

# 28. IMPORTAR / EXPORTAR

Personajes:

- importar;
- exportar;
- duplicar;
- compartir.

Contenido:

- importar;
- exportar;
- compartir;
- versionar.

Debe existir validación antes de importar.

---

# 29. CAMPAÑAS

El sistema debe soportar campañas.

Una campaña contiene:

- DM;
- jugadores;
- personajes;
- configuración;
- ruleset;
- contenido habilitado.

Ejemplo:

CAMPAÑA

"La Maldición..."

Jugadores:

- Personaje A
- Personaje B
- Personaje C

---

# 30. PERFILES

Roles:

PLAYER
DM
ADMIN

En futuras versiones podrían existir:

CONTENT CREATOR
MODERATOR

---

# 31. DM

Aunque la experiencia inicial pueda estar enfocada al jugador, la arquitectura debe soportar herramientas de DM.

Futuras funciones:

- administrar campaña;
- jugadores;
- encuentros;
- iniciativa;
- monstruos;
- NPC;
- notas;
- mapas;
- recompensas;
- loot;
- encuentros;
- condiciones.

---

# 32. IDIOMAS

La interfaz debe ser internacionalizable.

Primera prioridad:

Español latinoamericano.

Segundo idioma:

English.

Arquitectura preparada para:

- portugués;
- francés;
- italiano;
- alemán;
- otros.

No traducir directamente strings hardcodeados.

Utilizar sistema de internacionalización.

---

# 33. CONTENIDO MULTIIDIOMA

La base de datos debe permitir que un mismo elemento tenga diferentes traducciones.

Ejemplo:

Spell ID:
12345

English:
Fire Bolt

Español:
Rayo de fuego

Esto permite cambiar idioma sin duplicar entidades.

---

# 34. MOTOR DE REGLAS

Este será uno de los componentes técnicos más importantes.

Las reglas no deben estar completamente hardcodeadas en componentes visuales.

Crear un sistema capaz de representar:

- requisitos;
- condiciones;
- modificadores;
- efectos;
- recursos;
- progresión;
- dependencias;
- restricciones;
- acciones.

Ejemplo conceptual:

ABILITY

trigger:
attack

condition:
weapon_is_martial

effect:
add_proficiency_bonus

Esto permitirá incorporar:

- 2014;
- 2024;
- Homebrew;
- reglas personalizadas.

---

# 35. SISTEMA DE COMPATIBILIDAD

Cada elemento debe declarar:

compatible_rulesets

Ejemplo:

Contenido A:

2014

Contenido B:

2024

Contenido C:

2014 + 2024

Contenido D:

Homebrew

---

# 36. SISTEMA DE VERSIONADO

Todo contenido modificable debe tener:

version

created_at

updated_at

author

source

license

ruleset

language

---

# 37. OFFLINE FIRST

La aplicación debe continuar funcionando sin conexión.

El usuario debe poder:

- abrir personajes;
- consultar información;
- tirar dados;
- modificar HP;
- modificar recursos;
- modificar inventario;
- lanzar hechizos;
- modificar dinero.

Los cambios se sincronizan cuando vuelva la conexión.

---

# 38. SINCRONIZACIÓN

Modelo:

LOCAL DATABASE
↓
SYNC ENGINE
↓
CLOUD DATABASE

Debe contemplarse resolución de conflictos.

---

# 39. SEGURIDAD

Cada usuario sólo puede modificar sus propios personajes salvo que tenga permisos explícitos dentro de una campaña.

Las campañas deben controlar:

- propietario;
- miembros;
- roles;
- permisos.

---

# 40. NAVEGACIÓN PRINCIPAL

En mobile:

INICIO

PERSONAJE

AVENTURA

INVENTARIO

HECHIZOS

DADOS

BIBLIOTECA

CAMPAÑA

CONFIGURACIÓN

No necesariamente todos deben aparecer simultáneamente en la barra inferior.

La navegación debe priorizar las funciones utilizadas durante una partida.

---

# 41. DASHBOARD

Al abrir la aplicación:

"Continuar"

Personajes recientes.

Ejemplo:

ARAGORN

Nivel 5
Guerrero

HP 34/42

[ CONTINUAR ]

---

# 42. FAVORITOS

Permitir marcar:

- ataques;
- hechizos;
- objetos;
- habilidades;
- reglas;
- elementos de biblioteca.

Los favoritos deben estar disponibles rápidamente durante una partida.

---

# 43. NOTAS

Cada personaje debe poder tener:

- notas generales;
- historia;
- objetivos;
- relaciones;
- secretos;
- notas de campaña.

---

# 44. EXPERIENCIA DE USUARIO

Principio:

"Una acción importante = un toque."

Evitar:

- menús innecesarios;
- formularios gigantes;
- información redundante;
- cálculos manuales;
- navegación profunda durante combate.

---

# 45. ACCESIBILIDAD

Contemplar:

- tamaño de texto;
- contraste;
- navegación táctil;
- lectores de pantalla;
- reducción de animaciones;
- feedback visual;
- feedback sonoro opcional.

Los botones utilizados durante combate deben ser grandes y fáciles de tocar.

---

# 46. ARQUITECTURA CONCEPTUAL

USER

→ Campaigns

→ Characters

→ Character Ruleset

→ Character Content

→ Inventory

→ Equipment

→ Spells

→ Resources

→ Conditions

→ Currency

→ Dice History

→ Notes

---

# 47. MODELO DE DATOS CONCEPTUAL

User

Campaign

Character

Ruleset

ContentSource

ContentPack

Species

Subspecies

Class

Subclass

Background

Feat

Ability

Skill

Spell

Weapon

Armor

Equipment

MagicItem

Condition

Resource

InventoryItem

Currency

CharacterFeature

CharacterSpell

CharacterAttack

CharacterNote

DiceRoll

Language

Translation

HomebrewContent

ImportPackage

---

# 48. PRINCIPIO CLAVE DEL MODELO DE DATOS

NO duplicar información innecesariamente.

Ejemplo:

La espada larga existe una vez en la biblioteca.

El personaje posee una instancia:

CharacterInventoryItem

quantity: 1

equipped: true

Esto permite que miles de personajes utilicen el mismo elemento sin duplicar el contenido base.

---

# 49. SISTEMA DE INSTANCIAS

Diferenciar:

CONTENT DEFINITION

de

CHARACTER INSTANCE

Ejemplo:

SwordLongsword

es la definición.

CharacterInventoryItem #987

es la espada concreta que posee el personaje.

Esto permitirá posteriormente:

- durabilidad;
- nombre personalizado;
- mejoras;
- encantamientos;
- propietario;
- notas.

---

# 50. EXPERIENCIA DURANTE PARTIDA

Crear un modo específico:

## AVENTURA

Debe priorizar:

1. HP
2. CA
3. iniciativa
4. ataques
5. hechizos
6. recursos
7. estados
8. dados
9. inventario
10. notas

La información secundaria debe estar oculta hasta que sea necesaria.

---

# 51. OBJETIVO FINAL DEL PRODUCTO

La aplicación debe lograr que un jugador pueda:

CREAR PERSONAJE

↓

ENTENDER SU PERSONAJE

↓

EQUIPARLO

↓

PREPARAR HECHIZOS

↓

ENTRAR A UNA CAMPAÑA

↓

JUGAR

↓

TIRAR DADOS

↓

ATACAR

↓

RECIBIR DAÑO

↓

GASTAR RECURSOS

↓

CONSUMIR OBJETOS

↓

ACTUALIZAR INVENTARIO

↓

GANAR EXPERIENCIA

↓

SUBIR DE NIVEL

↓

ACTUALIZAR AUTOMÁTICAMENTE SU PERSONAJE

sin tener que abandonar la aplicación.

---

# 52. DIFERENCIADOR PRINCIPAL

La aplicación no debe competir únicamente como:

"una hoja de personaje digital".

Debe posicionarse conceptualmente como:

"D&D en tu bolsillo."

Una herramienta que acompaña al jugador antes, durante y después de la partida.

---

# 53. PRIORIDAD DE PRODUCTO

PRIORIDAD 1

Experiencia de usuario.

PRIORIDAD 2

Exactitud de las reglas.

PRIORIDAD 3

Automatización.

PRIORIDAD 4

Velocidad durante partida.

PRIORIDAD 5

Flexibilidad Homebrew.

PRIORIDAD 6

Compatibilidad 2014/2024.

PRIORIDAD 7

Escalabilidad.

---

# 54. REGLA DE DISEÑO FUNDAMENTAL

Nunca sacrificar la facilidad de uso para mostrar toda la información disponible simultáneamente.

La aplicación puede contener una enorme cantidad de información.

La interfaz NO debe parecer enorme.

La complejidad debe estar en el sistema.

La simplicidad debe estar en la interfaz.

---

# 55. FASES DEL PROYECTO

Aunque el objetivo sea una aplicación ultra completa, el desarrollo debe dividirse internamente en fases para evitar construir todo de manera desordenada.

FASE 0
Discovery + arquitectura.

FASE 1
Sistema base + usuarios + reglas + contenido.

FASE 2
Creador de personajes.

FASE 3
Hoja inteligente.

FASE 4
Inventario + equipo + dinero.

FASE 5
Hechizos + recursos + condiciones.

FASE 6
Dados + modo aventura.

FASE 7
Homebrew + importación.

FASE 8
Campañas + DM.

FASE 9
Offline + sincronización.

FASE 10
Pulido + accesibilidad + internacionalización.

---

# 56. REQUISITO PARA LA IA DE DESARROLLO

La IA que desarrolle este proyecto NO debe comenzar escribiendo código inmediatamente.

Primero debe:

1. analizar esta especificación;
2. detectar inconsistencias;
3. detectar requisitos faltantes;
4. proponer arquitectura;
5. diseñar modelo de datos;
6. diseñar sistema de reglas;
7. diseñar sistema de contenido;
8. diseñar navegación;
9. definir componentes;
10. definir estrategia offline;
11. definir estrategia de sincronización;
12. definir seguridad;
13. definir internacionalización;
14. definir estructura del proyecto;
15. presentar un plan de implementación.

Sólo después de validar esa arquitectura debe comenzar el desarrollo.

---

# 57. RESULTADO ESPERADO

El producto final debe sentirse como una aplicación moderna, rápida y profesional.

NO debe parecer:

- una hoja PDF convertida en web;
- una base de datos con formularios;
- una wiki;
- una aplicación antigua;
- una interfaz llena de tablas.

Debe sentirse como:

UN COMPAÑERO DIGITAL DE D&D.

Simple para principiantes.

Potente para jugadores experimentados.

Flexible para Homebrew.

Compatible con múltiples reglas.

Rápido durante una partida.

Y escalable para campañas y herramientas de DM.