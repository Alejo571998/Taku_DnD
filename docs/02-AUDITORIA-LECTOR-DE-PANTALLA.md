# Auditoría con lector de pantalla

**Tiempo estimado: 20 minutos.** No hace falta saber nada de accesibilidad.

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
| Jerarquía de encabezados y landmarks | axe-core |
| Foco atrapado en diálogos | `tests/e2e/keyboard.spec.ts` |
| Foco devuelto al cerrar | ídem |
| Anuncio del daño y la curación | ídem |
| Nombres distintos en filas repetidas | `tests/e2e/accessibility.spec.ts` |

Se corren con:

```bash
npx playwright test accessibility keyboard
```

Lo que queda para una persona es lo único que no se puede automatizar: **si se
entiende**.
