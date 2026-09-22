# QUÉ TRAE EL SRD Y QUÉ NO

Este documento existe para una pregunta concreta: **qué falta cargar a mano**.

La app trae el SRD —el material que Wizards publicó bajo licencia abierta— en
sus dos ediciones. No trae, ni puede traer, el contenido de los libros
comerciales. Abajo está el inventario exacto de lo que sí hay, y después lo que
el SRD deja fuera por diseño.

Todos los números salen de `public/content/`, no de una estimación.

---

## Lo que hay, por edición

| | SRD 5.1 (2014) | SRD 5.2 (2024) |
|---|---|---|
| Conjuros | 319 | 339 |
| Objetos mágicos | 362 | 262 |
| Rasgos de clase | 407 | 232 |
| Monstruos | 334 | **3** |
| Equipo | 187 | 131 |
| Armas | 37 | 38 |
| Armaduras | 13 | 13 |
| Reglas | 39 | — |
| Rasgos de especie | 38 | 67 |
| Habilidades | 18 | 18 |
| Condiciones | 15 | 15 |
| Idiomas | 16 | 19 |
| Clases | 12 | 12 |
| Subclases | **12** | **12** |
| Especies | 9 | 9 |
| Subespecies | 4 | 24 |
| Trasfondos | **1** | **4** |
| Dotes | **1** | 17 |
| **Total** | **1.824** | **1.215** |

Las 3.039 definiciones están traducidas al español: los 2.241 nombres y los
1.601 textos, 198.201 palabras. Las otras 1.438 definiciones no traen prosa que
traducir —son entradas de datos, como un arma o una subespecie—.

---

## Lo que el SRD deja fuera, y se nota

Los números en negrita de arriba son los huecos reales. No son casualidades:
el SRD da **un ejemplo de cada cosa** para que se pueda construir encima, no el
catálogo completo.

### Una subclase por clase, no tres o cuatro

Las 12 subclases del SRD son exactamente una por clase, en las dos ediciones:

| Clase | La única del SRD |
|---|---|
| Bárbaro | Senda del Berserker |
| Bardo | Colegio del Saber |
| Clérigo | Dominio de la Vida |
| Druida | Círculo de la Tierra |
| Guerrero | Campeón |
| Monje | Guerrero de la Mano Abierta |
| Paladín | Juramento de Devoción |
| Explorador | Cazador |
| Pícaro | Ladrón |
| Hechicero | Hechicería Dracónica |
| Brujo | Patrón Infernal |
| Mago | Evocador |

Todo lo demás —Tótem, Espadas, Luz, Luna, Caballero Arcano, Sombra, Venganza,
Asesino, Salvaje, Archifey, Adivinación…— está solo en los libros.

### Trasfondos y dotes: casi nada en 2014

5.1 trae **un** trasfondo (Acólito) y **una** dote (Luchador). 5.2 mejora algo:
4 trasfondos (Acólito, Criminal, Sabio, Soldado) y 17 dotes, contando los
estilos de combate y los dones épicos.

### Monstruos: 5.2 prácticamente no trae

5.1 trae 334 criaturas, que es un bestiario usable. 5.2 trae **3**: Aboleth,
Dragón negro adulto y Dragón azul adulto. Si jugás con la edición de 2024 y
necesitás monstruos, la biblioteca de 5.1 sigue ahí y se consulta igual.

### Reglas: solo están en 5.1

Las 39 reglas de consulta en mesa —combate, movimiento, descansos, trampas—
vienen del SRD 5.1. El volcado de 5.2 no las trae.

---

## Cómo se llena un hueco

Con el editor de `/homebrew`, sin escribir JSON. El editor cubre:

- **Objetos y conjuros** propios
- **Dotes** y **trasfondos**
- **Especies** con sus rasgos
- **Clases enteras** con progresión de nivel 1 a 20
- **Subclases** con sus rasgos por nivel
- **Equipo inicial**, fijo y a elegir, en clase y trasfondo

Lo que se carga ahí queda en tu cuenta y se sincroniza con tus dispositivos. No
se publica ni se comparte.

---

## Lo que no se puede hacer

Volcar el Manual del Jugador, la Guía del Dungeon Master, el Manual de
Monstruos o cualquier otro libro comercial dentro de la app. Son obras con
derechos vigentes: comprarlas da derecho a usarlas en la mesa, no a reproducir
su texto dentro de un programa (MASTER PROMPT §9 y §67).

La diferencia con el SRD es de licencia, no de tamaño: el SRD 5.2 se publica
bajo Creative Commons Attribution 4.0, y por eso está acá.
