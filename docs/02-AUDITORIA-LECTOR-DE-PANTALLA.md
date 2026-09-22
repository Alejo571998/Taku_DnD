# Auditoría con lector de pantalla

**Tiempo estimado: 20 minutos.** No hace falta saber nada de accesibilidad.

---

## Estado: la mitad mecánica ya se hizo (22/09/2026)

Las seis pruebas de abajo se recorrieron leyendo el **árbol de accesibilidad**,
que es literalmente lo que un lector de pantalla consume: roles, nombres,
estados y regiones vivas. Salieron **seis fallos**, todos arreglados, y ninguno
lo veía axe-core —axe comprueba que un botón TENGA nombre, no que el nombre
sirva para algo—:

| Dónde | Qué pasaba |
|---|---|
| Creador, cada paso | El paso cambiaba en silencio: «Especie», «3 de 12» eran párrafos sueltos |
| Creador, «Siguiente» bloqueado | Con `disabled` nativo salía del recorrido por tabulador: no se encontraba el botón ni el motivo |
| Biblioteca | El contador de resultados cambiaba sin anunciarse, y «sin resultados» tampoco |
| Avisos de deshacer | Dos avisos apilados daban dos botones «Deshacer» idénticos |
| Ficha, al abrirla | Cantaba «12 de 12 puntos de golpe» sin que nadie lo pidiera, y en `assertive`: cortaba lo que el lector estuviera diciendo |
| Ficha, cerrar un diálogo | El foco acababa en `<body>`, no en el botón que lo abrió |

Los dos últimos son los que más cuesta encontrar leyendo código, porque el
componente tenía escrito el arreglo y **no funcionaba**: se vieron midiendo.

Eso quedó fijado en `tests/e2e/lector-de-pantalla.spec.ts` (18 casos), así que
las seis pruebas ya no se repiten a mano: se corren.

```bash
npx playwright test lector-de-pantalla
```

**Lo que sigue necesitando una persona con oídos** es lo de siempre, y es lo
que hay que hacer con esta guía: si las frases se entienden al escucharlas, si
el ritmo de las interrupciones molesta, y si el recorrido resulta cómodo. Una
máquina comprueba que la información LLEGA; no que se entienda.

---

## Qué es esto y por qué no lo puede hacer una máquina

Un **lector de pantalla** es un programa que lee la pantalla en voz alta. Lo usa
quien no ve, o ve muy poco. No usa el mouse: se mueve con el teclado, y la
computadora le va diciendo dónde está.

Una máquina puede comprobar cosas como *«¿este botón tiene nombre?»* o *«¿este
texto tiene suficiente contraste?»*. Eso ya está hecho: **cero infracciones** en
las seis pantallas y en los dos temas.

Lo que **no** puede comprobar una máquina es si lo que se escucha tiene sentido.
Un ejemplo real de este proyecto:

> Tocás «recibir 5 de daño». En la pantalla el número pasa de 23 a 18.
> Si no ves la pantalla… **no escuchás nada**. No sabés si funcionó, si tocaste
> el botón equivocado, o si la aplicación se colgó.

Eso estaba roto y ya se arregló — ahora dice *«18 de 44 puntos de golpe»*. Pero
lo encontramos porque alguien pensó en escuchar. Las cosas de este tipo se
encuentran usando la app con los ojos cerrados, no leyendo el código.

---

## Preparación

| Sistema | Lector | Cómo se activa |
|---|---|---|
| Windows | **NVDA** (gratis, nvaccess.org) | Se instala y arranca |
| Windows | Narrador (ya viene) | `Ctrl + Win + Enter` |
| Mac | VoiceOver (ya viene) | `Cmd + F5` |
| Android | TalkBack | Ajustes → Accesibilidad |
| iPhone | VoiceOver | Ajustes → Accesibilidad |

Teclas que vas a usar: **Tab** (siguiente), **Shift+Tab** (anterior),
**Enter** o **Espacio** (activar), **Escape** (cerrar).

> **Consejo:** hacelo con la pantalla apagada o mirando a otro lado. Si ves la
> pantalla, tu cerebro rellena los huecos y no vas a notar lo que falta.

---

## Las seis pruebas

Para cada una: si lo que escuchás alcanza para saber qué pasó, pasa. Si tenés
que mirar la pantalla para entender, **falla** — y eso es un hallazgo útil, no
un problema tuyo.

### 1 · Llegar a lo importante (2 min)

Abrí la app y tocá **Tab** una vez.

- [ ] Se escucha «Saltar al contenido». Enter te lleva al contenido.
- [ ] Siguiendo con Tab, se entiende dónde estás sin mirar.

**Falla si:** tenés que pasar por quince cosas antes de llegar a lo que importa.

### 2 · Crear un personaje (6 min)

Andá a crear un personaje y hacelo **entero** solo con el teclado.

- [ ] En cada paso se escucha en qué paso estás y cuántos faltan.
- [ ] Al elegir especie o clase, se escucha qué elegiste.
- [ ] Cuando «Siguiente» está deshabilitado, se entiende **por qué**.
- [ ] Llegás al final sin quedarte trabado.

**Falla si:** en algún punto no sabés qué se espera de vos.

### 3 · Recibir daño (3 min)

En Modo Juego, tocá «recibir 5 de daño».

- [ ] Se escucha el valor nuevo de puntos de golpe.
- [ ] Al quedar en 0, se escucha que el personaje cayó.
- [ ] «Deshacer» se anuncia y se entiende qué deshace.

**Esto es lo que estaba roto.** Si no se escucha nada, volvió a romperse.

### 4 · Abrir y cerrar un diálogo (3 min)

En Homebrew, abrí «Crear». Después cerralo con Escape.

- [ ] Al abrir, la voz entra al diálogo y dice su título.
- [ ] Con Tab no te salís del diálogo.
- [ ] Al cerrar con Escape, volvés **al botón que lo abrió** — no al principio.

**Esto también estaba roto** (el foco se perdía) y ya está arreglado.

### 5 · Buscar en la biblioteca (3 min)

- [ ] Se escucha cuántos resultados hay.
- [ ] Se puede recorrer la lista y entender cada entrada.
- [ ] Al abrir un conjuro, se lee su contenido en orden razonable.

**Falla si:** escribís y no hay forma de saber que la lista cambió.

### 6 · Tirar un dado (3 min)

- [ ] Se escucha el resultado sin tener que ir a buscarlo.
- [ ] Se entiende qué dado se tiró.

---

## Cómo anotar lo que encuentres

No hace falta formato. Con esto alcanza:

```
PANTALLA:   Modo Juego
QUÉ HICE:   Tab hasta el botón de curar, Enter
QUÉ ESPERABA ESCUCHAR: el valor nuevo
QUÉ ESCUCHÉ: nada
```

Tres líneas así valen más que un informe largo, porque se puede reproducir.

---

## Lo que ya está comprobado por máquina

Para que no gastes tiempo en esto:

| | |
|---|---|
| Nombres, roles y etiquetas | axe-core, 0 infracciones |
| Contraste AA | test propio, 32 comprobaciones, los dos temas |
| Jerarquía de encabezados y landmarks | axe-core, y la jerarquía completa de la ficha en `official-sheet.spec.ts` |
| Foco atrapado en diálogos | `tests/e2e/keyboard.spec.ts` |
| Foco devuelto al cerrar | `keyboard.spec.ts` (Homebrew) y `lector-de-pantalla.spec.ts` (la ficha) |
| Anuncio del daño y la curación | `keyboard.spec.ts` y `lector-de-pantalla.spec.ts` |
| Nombres distintos en filas repetidas | `tests/e2e/accessibility.spec.ts` |
| Las seis pruebas de esta guía, su parte mecánica | `tests/e2e/lector-de-pantalla.spec.ts` |

> **Ojo con esta tabla.** Antes decía que el foco devuelto al cerrar ya estaba
> comprobado, y era verdad **a medias**: el test existía, pasaba, y cubría el
> diálogo de Homebrew. El de la ficha, con el mismo componente, dejaba el foco
> en `<body>`. Que una fila diga «comprobado» significa que hay un test, no
> que cubra todas las pantallas.

Se corren con:

```bash
npx playwright test accessibility keyboard lector-de-pantalla
```

Lo que queda para una persona es lo único que no se puede automatizar: **si se
entiende**.
