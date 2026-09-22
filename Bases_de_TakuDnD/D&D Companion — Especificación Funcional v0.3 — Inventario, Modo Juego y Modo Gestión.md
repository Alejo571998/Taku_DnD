# D&D COMPANION
## Especificación Funcional v0.3
### Inventario + Modo Juego + Modo Gestión

---

# 1. PRINCIPIO FUNDAMENTAL

La aplicación no debe comportarse como una ficha PDF digitalizada.

Debe funcionar como un **sistema vivo de personaje**.

Cada acción realizada por el jugador debe poder actualizar automáticamente las partes relacionadas del personaje.

Ejemplo:

El personaje tiene:

> 20 flechas

Ataca utilizando un arco.

La aplicación puede registrar:

> -1 flecha

Inventario:

> 19 flechas

Si el jugador recupera 6:

> +6 flechas

Inventario:

> 25 flechas

Si el personaje equipa un objeto que aumenta su CA:

> CA actualizada automáticamente.

Si obtiene una condición:

> La condición aparece en el estado del personaje.

Si lanza un hechizo:

> Se consume el recurso correspondiente.

La filosofía general es:

**El usuario realiza la acción una vez. El sistema actualiza todo lo relacionado.**

---

# 2. INVENTARIO INTELIGENTE

El inventario debe ser mucho más que una lista de objetos.

Debe funcionar como un sistema de:

- posesiones;
- cantidades;
- peso;
- equipamiento;
- consumibles;
- munición;
- objetos mágicos;
- recursos;
- monedas;
- capacidad de carga;
- modificaciones de estadísticas.

---

# 3. ESTRUCTURA DEL INVENTARIO

El inventario tendrá categorías principales:

### Equipado

Objetos actualmente utilizados por el personaje.

Ejemplos:

- armadura;
- escudo;
- arma principal;
- arma secundaria;
- casco;
- capa;
- anillos;
- amuleto;
- otros espacios configurables.

### Mochila

Objetos transportados pero no equipados.

### Armas

Listado de armas disponibles.

### Armaduras

Armaduras y escudos.

### Consumibles

Por ejemplo:

- pociones;
- pergaminos;
- raciones;
- antorchas;
- venenos;
- componentes;
- objetos de un solo uso.

### Munición

Por ejemplo:

- flechas;
- virotes;
- dardos;
- balas;
- munición Homebrew.

### Objetos mágicos

Con información adicional:

- rareza;
- sintonización;
- efectos;
- cargas;
- requisitos.

### Herramientas

Por ejemplo:

- herramientas de ladrón;
- herramientas de artesano;
- instrumentos;
- kits.

### Misceláneos

Cualquier objeto que no encaje en las categorías anteriores.

---

# 4. OBJETO VS INSTANCIA DEL OBJETO

El sistema debe distinguir entre:

## Definición

Ejemplo:

> Espada larga

La definición contiene:

- nombre;
- tipo;
- daño;
- propiedades;
- peso;
- valor;
- reglas;
- fuente;
- edición;
- traducción.

## Instancia

El personaje puede tener:

> Espada larga "Mordedora"

Esta instancia puede tener:

- nombre personalizado;
- propietario;
- cantidad;
- equipada;
- ubicación;
- notas;
- mejoras;
- daño adicional;
- durabilidad si el sistema lo permite;
- efectos Homebrew.

Esto permitirá que el sistema sea escalable.

---

# 5. CANTIDADES

Todo objeto que pueda acumularse debe tener una cantidad.

Ejemplo:

> Flechas × 27

Botones:

`− 27 +`

Al pulsar `−`:

> 26

Al pulsar `+`:

> 28

La modificación debe ser instantánea.

---

# 6. CONSUMO AUTOMÁTICO

Los objetos consumibles pueden estar conectados a acciones.

Ejemplo:

Personaje:

> Arco largo

Munición:

> Flechas × 20

El usuario pulsa:

> ATAQUE

El sistema puede:

1. realizar la tirada;
2. calcular el ataque;
3. registrar el resultado;
4. consumir una flecha;
5. mostrar:

> Flechas: 19

El usuario debe poder desactivar el consumo automático si así lo desea.

---

# 7. MUNICIÓN

La munición tendrá un sistema específico.

Cada arma podrá definir qué tipo de munición utiliza.

Ejemplo:

> Arco corto → Flechas

> Ballesta → Virotes

> Arma Homebrew → Munición personalizada

El sistema debe impedir, o al menos advertir, cuando no existe munición suficiente.

Ejemplo:

> ⚠️ No tienes flechas.

Opciones:

- cancelar ataque;
- realizar ataque sin descontar;
- administrar inventario.

Esto debe ser configurable.

---

# 8. CONSUMIBLES

Los consumibles tendrán una acción rápida:

> USAR

Ejemplo:

**Poción de curación ×3**

Botón:

> USAR

El sistema pregunta o ejecuta:

> ¿Usar 1?

Resultado:

> ×2

Si el objeto produce un efecto conocido, el sistema puede aplicar el efecto.

Ejemplo:

> Poción de curación

→ consumir 1  
→ realizar curación  
→ actualizar HP.

---

# 9. PESO

El sistema calcula automáticamente:

**Peso total del inventario**

Ejemplo:

> Peso: 42,5 kg

También calcula:

> Capacidad máxima: 60 kg

Estado:

### Normal

Dentro de la capacidad.

### Cerca del límite

Advertencia configurable.

### Excedido

El sistema informa que el personaje supera su capacidad.

La fórmula debe depender del sistema de reglas utilizado y de cualquier modificador aplicable.

---

# 10. EQUIPAMIENTO INTELIGENTE

Equipar un objeto puede modificar automáticamente el personaje.

Ejemplo:

El personaje equipa:

> Escudo

El sistema actualiza:

> CA + correspondiente

Al desequiparlo:

> CA vuelve a calcularse.

No se deben guardar estadísticas derivadas como valores independientes si pueden calcularse.

Debe existir una fuente de verdad.

---

# 11. CONFLICTOS DE EQUIPAMIENTO

El sistema debe detectar incompatibilidades.

Ejemplo:

El personaje intenta equipar:

> Dos armas que requieren la misma mano.

La aplicación puede mostrar:

> ⚠️ Este equipamiento entra en conflicto.

Opciones:

- reemplazar;
- cancelar;
- mantener ambos sin equipar.

No debe tomar decisiones destructivas silenciosamente.

---

# 12. OBJETOS PERSONALIZADOS

El jugador puede crear objetos personalizados.

Ejemplo:

> Espada de Alejo

Propiedades:

- nombre;
- descripción;
- daño;
- tipo;
- peso;
- valor;
- propiedades;
- efectos;
- imagen opcional;
- Homebrew;
- notas.

Debe poder marcarse como:

> Privado

o

> Compartido.

---

# 13. OBJETOS MÁGICOS

Los objetos mágicos pueden tener:

- rareza;
- requisito de sintonización;
- cargas;
- efectos;
- activación;
- duración;
- restricciones;
- descripción;
- fuente;
- edición.

Si tiene cargas:

> Cargas 3/3

Botones:

`−` `+`

Al utilizarlo:

> Cargas 2/3

Si llega a 0:

> ⚠️ Sin cargas disponibles.

---

# 14. DINERO

El dinero debe funcionar como una entidad independiente del inventario.

Cinco denominaciones:

- oro;
- platino;
- electrum;
- plata;
- cobre.

En la interfaz española se priorizará la nomenclatura que definamos para cada edición.

Orden visual solicitado:

> **PO → PP → PE → PA → PC**

Importante:

Los códigos internos deben ser independientes del idioma para evitar conflictos de traducción.

Ejemplo interno:

`gp`
`pp`
`ep`
`sp`
`cp`

La interfaz puede mostrar las abreviaturas españolas correspondientes.

---

# 15. TRANSACCIONES DE DINERO

No solamente mostrar el saldo.

El sistema puede registrar:

> +50 PO

o

> -10 PO

También permitir:

> Convertir monedas.

Ejemplo:

> Convertir 10 PO

El sistema calcula el equivalente según las reglas de moneda configuradas.

Debe existir confirmación antes de realizar conversiones.

---

# 16. MODO GESTIÓN

El **Modo Gestión** es donde el jugador administra completamente su personaje.

Es la experiencia profunda.

Aquí se encuentra:

- ficha completa;
- inventario;
- equipamiento;
- estadísticas;
- habilidades;
- características;
- dotes;
- hechizos;
- recursos;
- condiciones;
- historia;
- personalidad;
- notas;
- dinero;
- configuración.

Este modo puede contener mucha información.

Pero no debe intentar mostrarla toda al mismo tiempo.

---

# 17. NAVEGACIÓN DEL MODO GESTIÓN

La estructura propuesta:

## Personaje

Resumen general.

## Estadísticas

- características;
- modificadores;
- salvaciones;
- habilidades;
- competencia;
- percepción;
- iniciativa;
- velocidad;
- CA;
- HP;
- dados de golpe.

## Características

- clase;
- subclase;
- especie;
- trasfondo;
- dotes;
- características especiales.

## Hechizos

- conocidos;
- preparados;
- espacios;
- favoritos;
- historial.

## Inventario

Todo el sistema de objetos.

## Equipamiento

Objetos actualmente equipados.

## Recursos

Contadores y recursos.

## Condiciones

Estados actuales.

## Historia

- personalidad;
- apariencia;
- trasfondo;
- relaciones;
- objetivos;
- notas.

## Dinero

Todas las monedas.

---

# 18. MODO JUEGO

El **Modo Juego** es diferente.

Está diseñado para utilizarse:

> durante una sesión de D&D.

No debe parecer una aplicación de administración.

Debe parecer un **panel de control de personaje**.

La prioridad es:

> velocidad + claridad + pocos toques.

---

# 19. OBJETIVO DEL MODO JUEGO

Durante una partida el jugador no debería tener que navegar por diez pantallas para hacer algo.

Las acciones más frecuentes deben estar inmediatamente disponibles:

- atacar;
- lanzar hechizo;
- tirar dados;
- recibir daño;
- curarse;
- gastar recurso;
- aplicar condición;
- consultar inventario;
- consumir objeto;
- modificar munición;
- consultar CA;
- consultar HP;
- consultar iniciativa.

---

# 20. HOME DEL MODO JUEGO

La pantalla principal debe mostrar inmediatamente:

### Personaje

Nombre  
Nivel  
Clase / especie

### Combate

**HP**

> 34 / 42

Botones:

`− DAÑO`  
`+ CURAR`

### CA

> 18

### Iniciativa

> +4

### Velocidad

> 30 ft

### Recursos importantes

Por ejemplo:

> Inspiración  
> 1

> Segundo aliento  
> 1/1

> Espacios de nivel 1  
> 3/4

Los recursos deben poder configurarse.

---

# 21. ATAQUES RÁPIDOS

El jugador debe poder tener ataques favoritos.

Ejemplo:

### Espada larga

**+6**

`ATACAR`

Al tocar:

> d20 + 6

Resultado:

> 18

Luego:

> Daño 1d8 + 4

El sistema puede permitir:

> Tirar ataque y daño

o

> Tirar ataque primero.

---

# 22. ATAQUES FAVORITOS

El jugador puede seleccionar cuáles aparecen en Modo Juego.

Ejemplo:

- Espada larga;
- Arco largo;
- Rayo de fuego;
- Golpe desarmado.

Los demás permanecen disponibles en Gestión.

---

# 23. HECHIZOS RÁPIDOS

Los hechizos favoritos aparecen directamente en Modo Juego.

Ejemplo:

### Bola de fuego

Nivel 3

`LANZAR`

El sistema puede:

1. verificar disponibilidad;
2. consumir el espacio;
3. mostrar la información;
4. ejecutar la tirada correspondiente si aplica.

Debe existir opción:

> Lanzar sin consumir recurso

para situaciones especiales o correcciones manuales.

---

# 24. RECURSOS RÁPIDOS

Todos los recursos importantes pueden convertirse en contadores.

Ejemplo:

### Segundo Aliento

`0 / 1`

Botones:

`−` `+`

### Acción adicional

`1 / 1`

### Cargas

`3 / 5`

La aplicación no debe obligar al usuario a buscar el recurso dentro de la ficha completa.

---

# 25. CONDICIONES EN MODO JUEGO

Las condiciones activas aparecen visualmente.

Ejemplo:

> 🔴 Envenenado

> 🟠 Asustado

> 🔵 Invisible

Al tocar una condición:

- descripción;
- efectos;
- duración;
- origen;
- notas.

También:

> ELIMINAR

---

# 26. DAÑO Y CURACIÓN

Debe existir una acción extremadamente rápida.

### Recibir daño

`−`

El usuario introduce:

> 8

Resultado:

> HP 26/42

### Curación

`+`

Introduce:

> 5

Resultado:

> HP 31/42

### HP temporal

Debe manejarse independientemente.

Ejemplo:

> HP 31/42  
> Temp HP 5

El sistema debe aplicar correctamente el daño primero sobre los HP temporales según las reglas correspondientes.

---

# 27. INVENTARIO EN MODO JUEGO

No se muestra todo el inventario.

Se muestra:

> Objetos rápidos

Ejemplo:

- Poción;
- antorcha;
- ración;
- cuerda;
- herramienta;
- munición.

Cada objeto puede tener:

`USAR`

o

`− / +`

El inventario completo permanece en Gestión.

---

# 28. DADOS EN MODO JUEGO

El dado debe estar siempre accesible.

Botón:

> 🎲

Abre el lanzador.

Opciones rápidas:

- d20;
- d12;
- d10;
- d8;
- d6;
- d4;
- d100.

También:

> Personalizado

Ejemplo:

> 8d6 + 4

---

# 29. VENTAJAS Y DESVENTAJAS

Para d20 debe existir una opción:

> Normal

> Ventaja

> Desventaja

El sistema ejecuta automáticamente la mecánica correspondiente.

---

# 30. HISTORIAL DE SESIÓN

Modo Juego puede registrar las acciones realizadas.

Ejemplo:

> 21:34 — Ataque con espada larga — 18

> 21:35 — Daño — 9

> 21:36 — Recibió 7 daño

> 21:37 — Lanzó Curar heridas

> 21:38 — Gastó 1 espacio de nivel 1

Esto permite recuperar información durante la partida.

---

# 31. DESHACER

Las acciones importantes deben poder deshacerse.

Ejemplo:

El jugador accidentalmente consume una poción.

Puede seleccionar:

> Deshacer

El sistema revierte:

- cantidad;
- HP;
- recursos;
- munición;
- condiciones;
- etc.

Debe existir un sistema de transacciones para permitirlo de forma segura.

---

# 32. CAMBIO ENTRE MODOS

El usuario debe poder cambiar rápidamente entre:

### MODO JUEGO

> Estoy jugando.

y

### MODO GESTIÓN

> Estoy administrando mi personaje.

No son dos personajes diferentes.

Son dos representaciones del mismo estado.

---

# 33. FUENTE ÚNICA DE VERDAD

Este punto es fundamental.

Ejemplo:

En Gestión:

> Flechas = 23

En Modo Juego:

> Flechas = 23

Si en Modo Juego dispara:

> 22

Al volver a Gestión:

> Flechas = 22

Lo mismo aplica para:

- HP;
- dinero;
- hechizos;
- recursos;
- condiciones;
- equipamiento;
- cargas;
- objetos;
- munición.

Nunca deben existir dos inventarios independientes.

---

# 34. ESTADO DEL PERSONAJE

El sistema debe mantener un estado central del personaje.

Conceptualmente:

Character State

├── Statistics
├── HP
├── Conditions
├── Resources
├── Spells
├── Equipment
├── Inventory
├── Currency
├── Attacks
└── Notes

Los diferentes modos solamente presentan y modifican ese estado.

---

# 35. DISEÑO MOBILE FIRST

Como el producto será una **PWA instalable desde el navegador**, el Modo Juego debe estar especialmente optimizado para teléfonos.

Objetivos:

- botones grandes;
- una mano;
- mínimo texto innecesario;
- navegación inferior;
- acciones rápidas;
- buena legibilidad;
- feedback inmediato;
- funcionamiento offline.

La experiencia de escritorio puede aprovechar más espacio, pero no debe definir el diseño móvil.

---

# 36. DIFERENCIA ENTRE LOS DOS MODOS

| | Modo Juego | Modo Gestión |
|---|---|---|
| Objetivo | Jugar | Administrar |
| Velocidad | Máxima | Normal |
| Información | Esencial | Completa |
| Acciones | 1-2 toques | Más detalladas |
| Inventario | Objetos rápidos | Inventario completo |
| Combate | Prioritario | Secundario |
| Estadísticas | Resumen | Completo |
| Hechizos | Favoritos | Biblioteca completa |
| Recursos | Contadores | Administración |
| Configuración | Mínima | Completa |
| Uso | Durante sesión | Antes/después de sesión |

---

# 37. PRINCIPIO UX

La aplicación debe responder a esta pregunta:

> "¿Qué necesita el jugador en este momento?"

Antes de una partida:

> Modo Gestión.

Durante la partida:

> Modo Juego.

Después de la partida:

> Modo Gestión.

Esto evita que la enorme cantidad de información de D&D abrume al jugador.

---

# 38. EJEMPLO DE FLUJO COMPLETO

Personaje:

> Tharion  
> Guerrero nivel 5

Inventario:

> Espada larga ×1  
> Escudo ×1  
> Flechas ×20  
> Poción ×2

Durante la partida:

1. Activa Modo Juego.
2. Ve HP 38/45.
3. Pulsa "Espada larga".
4. Pulsa "Atacar".
5. Se tira automáticamente 1d20 + modificador.
6. El jugador confirma el resultado.
7. Se tira daño.
8. El sistema registra el ataque.
9. El enemigo hace 11 de daño.
10. El jugador pulsa `−`.
11. Introduce 11.
12. HP pasa a 27/45.
13. El jugador usa una poción.
14. Pulsa `USAR`.
15. El sistema consume una poción.
16. Aplica la curación.
17. Inventario queda en ×1.
18. Finaliza el combate.
19. Continúa jugando.
20. Más tarde entra en Gestión.
21. Todos los cambios ya están reflejados.

No hay que actualizar manualmente la ficha.

---

# 39. PRINCIPIO GENERAL DEL PRODUCTO

El sistema debe hacer el trabajo pesado.

El usuario debe tomar las decisiones.

La aplicación debe encargarse de:

- calcular;
- actualizar;
- validar;
- consumir;
- registrar;
- sincronizar;
- advertir;
- relacionar información.

El usuario debe poder concentrarse en:

> **JUGAR D&D.**

---

# 40. CONSECUENCIA PARA LA ARQUITECTURA

Esta definición obliga a que el proyecto tenga:

- un modelo de estado central del personaje;
- motor de reglas;
- sistema de eventos;
- sistema de inventario;
- sistema de recursos;
- sistema de transacciones;
- historial;
- sincronización;
- almacenamiento local;
- sistema de permisos;
- soporte 2014/2024;
- soporte Homebrew;
- sistema de contenido.

Por lo tanto, estas decisiones deben quedar definidas **antes de comenzar el desarrollo**.