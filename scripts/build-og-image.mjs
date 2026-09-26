/**
 * LA IMAGEN QUE SE VE AL COMPARTIR EL ENLACE
 *
 * 1200×630 en `public/og.png`, que es lo que piden LinkedIn, WhatsApp,
 * Telegram, Slack y X. Se genera UNA VEZ y se guarda en el repositorio.
 *
 * Por qué un archivo y no `opengraph-image.tsx` con `ImageResponse`:
 *
 *   - Un rastreador de enlaces no ejecuta JavaScript ni espera. Un PNG
 *     estático se sirve desde el CDN en una petición y no puede fallar.
 *   - `ImageResponse` usa Satori, que no entiende todo el CSS y obliga a
 *     descargar la fuente en el build. Más piezas para la misma imagen.
 *
 * El precio es que hay que volver a correr esto si cambia la marca, y por eso
 * es un script con nombre y no un apaño de una tarde:
 *
 *     npm run build:og
 *
 * Necesita Playwright, que ya está para los tests. NO corre en el despliegue:
 * Vercel sirve el PNG committeado.
 */

import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const ROOT = path.resolve(import.meta.dirname, '..');
const RETRATO = path.join(ROOT, 'assets', 'img', 'Taku-DD.png');
const SALIDA = path.join(ROOT, 'src', 'app', 'opengraph-image.png');

if (!fs.existsSync(RETRATO)) {
  console.error(`No encuentro el retrato en ${path.relative(ROOT, RETRATO)}`);
  process.exit(1);
}

const retrato = `data:image/png;base64,${fs.readFileSync(RETRATO).toString('base64')}`;

/*
  Los colores son los mismos tokens de `globals.css`, escritos a mano porque
  esto se renderiza fuera de la aplicación. Si algún día dejan de coincidir, la
  vista previa desentonará con el sitio y se verá enseguida.
*/
const HTML = `<!doctype html>
<html lang="es-419">
<head>
<meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700&family=Inter:wght@400;500&display=swap" rel="stylesheet">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: 1200px; height: 630px;
    background: #0A0507;
    font-family: Inter, system-ui, sans-serif;
    color: #F5EFE9;
    display: flex; align-items: center;
    position: relative; overflow: hidden;
  }
  /* El resplandor carmesí de la portada. */
  .glow {
    position: absolute; right: -180px; top: 50%;
    width: 900px; height: 900px; transform: translateY(-50%);
    background: radial-gradient(circle, rgba(190,30,50,0.42) 0%, rgba(190,30,50,0.10) 45%, transparent 70%);
  }
  .texto { position: relative; padding: 0 0 0 88px; width: 700px; }
  .marca { font-family: Cinzel, serif; font-weight: 700; font-size: 96px; letter-spacing: 0.16em; line-height: 1; }
  .dd { font-weight: 600; font-size: 30px; letter-spacing: 0.34em; color: #F2566B; margin-top: 14px; }
  .lema { font-size: 30px; line-height: 1.42; color: #CFC3BA; margin-top: 40px; max-width: 560px; }
  .pie { display: flex; gap: 12px; margin-top: 44px; }
  .pastilla {
    font-size: 19px; padding: 10px 20px; border-radius: 999px;
    border: 1px solid rgba(245,239,233,0.20); color: #CFC3BA;
    /* Sin esto «Reglas 2014 y 2024» parte en dos renglones y la fila
       queda descuadrada: son etiquetas, no párrafos. */
    white-space: nowrap;
  }
  .retrato {
    position: absolute; right: 54px; bottom: 0;
    height: 575px; filter: drop-shadow(0 24px 60px rgba(0,0,0,0.65));
  }
</style>
</head>
<body>
  <div class="glow"></div>
  <div class="texto">
    <div class="marca">TAKU</div>
    <div class="dd">D &amp; D</div>
    <div class="lema">Creá, gestioná y jugá tus personajes de Dungeons&nbsp;&amp;&nbsp;Dragons.</div>
    <div class="pie">
      <span class="pastilla">Reglas 2014 y 2024</span>
      <span class="pastilla">Sin conexión</span>
      <span class="pastilla">En español</span>
    </div>
  </div>
  <img class="retrato" src="${retrato}" alt="">
</body>
</html>`;

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1200, height: 630 },
  deviceScaleFactor: 1,
});

await page.setContent(HTML, { waitUntil: 'networkidle' });
// Las fuentes tienen que estar antes del disparo, o sale con la de respaldo.
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(400);

await page.screenshot({ path: SALIDA, type: 'png' });
await browser.close();

const kb = Math.round(fs.statSync(SALIDA).size / 1024);
console.log(`src/app/opengraph-image.png — 1200×630, ${kb} KB`);
