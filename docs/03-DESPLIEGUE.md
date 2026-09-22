# Desplegar en Vercel

**Tiempo estimado: 15 minutos.** Hace falta la cuenta de Vercel y el panel de
Supabase abiertos.

---

## Antes de nada: lo que NO puede subir

En la carpeta del proyecto hay **1,2 GB de libros con derechos** —Manual del
Jugador, Manual del Dungeon Master, Manual de Monstruos, *The GM book of NPCs* y
dos aventuras publicadas— en `PDFs_Taku_DnD/`.

Están en `.gitignore` y se comprobó que la regla funciona:

```bash
git check-ignore -v "PDFs_Taku_DnD/Manual del Dungeon Master.pdf"
```

Tiene que responder con la línea de `.gitignore` que los excluye. Si algún día
deja de hacerlo, **pará**: subirlos a GitHub es distribuirlos, y en un
repositorio público lo es para cualquiera. Además GitHub rechaza archivos de
más de 100 MB, así que el push fallaría a mitad y dejaría el historial sucio.

Lo que alimenta la aplicación es el **SRD**, que es CC-BY y sí se puede
redistribuir. Vive en `data/srd-raw/` y ese sí va al repositorio.

---

## 1 · Subir el código

El repositorio ya está iniciado, con el primer commit hecho y el remoto
apuntando a GitHub. Queda empujarlo:

```bash
git push -u origin main
```

Si la URL del remoto no es la correcta, se cambia sin perder nada:

```bash
git remote set-url origin https://github.com/TU-USUARIO/Taku_DnD.git
```

---

## 2 · Importar el proyecto en Vercel

New Project → importar `Taku_DnD`. Vercel detecta Next.js solo. **No hay que
tocar los comandos de build:** `npm run build` ya encadena `prebuild`, que
construye el contenido del SRD y los recursos de Taku.

> El build usa **webpack, no Turbopack**, y es a propósito: con Turbopack,
> Serwist no genera `public/sw.js` y la aplicación deja de funcionar sin
> conexión, que es la mitad del producto. Está anotado como T2 en el plan.

---

## 3 · Las variables de entorno

Son **dos**, y ninguna más:

| Variable | Dónde sale |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ídem |

**No hace falta la clave de servicio (`service_role`)**, y no conviene ponerla:
no hay un solo camino en la aplicación que salte la RLS. Las cuatro rutas de
`/api/sync` actúan COMO el usuario que pide, así que las políticas siguen
aplicando aunque el código de la aplicación se equivoque. La clave que salta
RLS no tiene por qué existir en producción.

`DATABASE_URL` tampoco va en Vercel: solo la usan los tests contra la base real,
que se corren desde tu máquina.

### La trampa que cuesta una tarde

El CSP arma su `connect-src` leyendo `NEXT_PUBLIC_SUPABASE_URL` en el
middleware (`src/middleware.ts`). **Si esa variable falta en Vercel, el
navegador bloquea toda conexión a Supabase** y el inicio de sesión falla sin un
error que lo explique: la aplicación se ve bien, y nada funciona.

Las variables `NEXT_PUBLIC_*` se incrustan **en el build**. Si las agregás
después de desplegar, hay que **volver a desplegar**; cambiarlas en el panel no
alcanza.

---

## 4 · Decirle a Supabase cuál es la URL

Authentication → URL Configuration:

- **Site URL**: la URL de producción de Vercel.
- **Redirect URLs**: agregá `https://TU-DOMINIO.vercel.app/**`.

El `/**` importa: los *preview deploys* de Vercel tienen un dominio distinto en
cada rama, y sin el comodín el enlace de confirmación no vuelve desde ninguno.

La aplicación arma esos enlaces con `window.location.origin`, así que funcionan
igual en localhost, en las vistas previas y en producción sin tocar nada — pero
Supabase solo acepta los que estén en esta lista.

---

## 5 · Comprobar que quedó bien

```bash
npm run test:db:remote
```

48 casos contra la instancia real: aislamiento entre inquilinos, idempotencia,
concurrencia optimista y cursor. Si pasan, las migraciones están aplicadas y el
contrato del servidor se cumple.

Y en el sitio desplegado, las tres cosas que fallan distinto:

1. **Sin cuenta**: crear un personaje y recargar. Tiene que seguir ahí — es
   local-first, la nube es opcional.
2. **Con cuenta**: registrarse y revisar el correo. Si el enlace no vuelve, es
   el paso 4.
3. **Sin conexión**: modo avión y recargar. Si sale la página de sin conexión en
   vez de la aplicación, el service worker no se generó (paso 2).

---

## Lo que un usuario todavía no va a poder hacer

Nada de esto impide desplegar, pero conviene saberlo antes de pedir opiniones:

- La **sincronización con dos aparatos físicos** a la vez no se ha ejercitado.
  El contrato del servidor sí, con dos pilas completas en `tests/integration/`.
- Nadie usó la aplicación con un **lector de pantalla** real. La parte mecánica
  está auditada y cubierta por tests; falta si se entiende escuchándola
  (`docs/02-AUDITORIA-LECTOR-DE-PANTALLA.md`).
- El **rendimiento** está medido con la CPU estrangulada a un cuarto, no en un
  teléfono de verdad.
