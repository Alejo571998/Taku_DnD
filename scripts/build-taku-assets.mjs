#!/usr/bin/env node
/**
 * ASSETS DE TAKU
 *
 * Una sola fuente —`assets/img/Taku-DD.png`, 500×500 RGBA— y de ahí salen
 * todos los tamaños. El retrato NO se retoca: solo se escala.
 *
 * Por qué se generan en vez de guardarse a mano:
 *
 *   · El original pesa 328 KB. Servirlo como favicon sería mandar 328 KB para
 *     pintar 16 píxeles.
 *   · Un `.ico` de verdad necesita varios tamaños dentro. Renombrar un PNG a
 *     `.ico` funciona por olfateo de contenido en los navegadores actuales,
 *     pero no es el formato y no deja elegir resolución.
 *   · Los iconos enmascarables se recortan a un círculo. Un personaje de
 *     cuerpo entero a tamaño completo pierde las botas y la cabeza, así que
 *     hay que meterlo dentro de la zona segura sobre fondo opaco.
 *
 *   node scripts/build-taku-assets.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compose, decodePng, encodeIco, encodePng, resize } from './lib/png.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = path.join(ROOT, 'assets', 'img', 'Taku-DD.png');
const SPRITES = path.join(ROOT, 'public', 'taku');
const ICONS = path.join(ROOT, 'public', 'icons');

// Obsidiana, en sincronía con `--bg-base` de globals.css.
const OBSIDIAN = [10, 5, 7];

if (!fs.existsSync(SOURCE)) {
  console.error(`No encuentro el retrato en ${path.relative(ROOT, SOURCE)}`);
  process.exit(1);
}

const source = decodePng(fs.readFileSync(SOURCE));
console.log(`Fuente: ${source.width}×${source.height}`);

fs.mkdirSync(SPRITES, { recursive: true });
fs.mkdirSync(ICONS, { recursive: true });

const written = [];
const write = (dir, name, buffer) => {
  fs.writeFileSync(path.join(dir, name), buffer);
  written.push([path.relative(ROOT, path.join(dir, name)), buffer.length]);
};

const scaled = (size) => {
  const pixels = resize(source.pixels, source.width, source.height, size, size);
  return encodePng(pixels, size, size);
};

// ── Sprites de la interfaz ───────────────────────────────────────────────────
//
// Taku se muestra a 56 px en el ancla y hasta 128 en los estados vacíos. Con
// 192 y 384 se cubren esos tamaños a 1x, 2x y 3x sin que el navegador tenga
// que reducir un archivo enorme en cada pintado.
write(SPRITES, 'taku-192.png', scaled(192));
write(SPRITES, 'taku-384.png', scaled(384));

// ── Favicons ─────────────────────────────────────────────────────────────────
const faviconSizes = [16, 32, 48];
for (const size of faviconSizes) write(ICONS, `favicon-${size}.png`, scaled(size));

write(
  path.join(ROOT, 'public'),
  'favicon.ico',
  encodeIco(faviconSizes.map((size) => ({ size, png: scaled(size) }))),
);

// ── Iconos de aplicación ─────────────────────────────────────────────────────
write(ICONS, 'icon-192.png', scaled(192));
write(ICONS, 'icon-512.png', scaled(512));
write(ICONS, 'apple-touch-icon.png', scaled(180));

/**
 * Enmascarables: Taku al 64% sobre obsidiana.
 *
 * La especificación reserva el 80% central como zona segura y el sistema
 * recorta el resto con la forma que quiera —círculo, cuadrado redondeado,
 * gota—. A tamaño completo se le cortarían las botas; al 64% entra entero
 * incluso en el recorte más agresivo.
 */
for (const size of [192, 512]) {
  write(
    ICONS,
    `icon-maskable-${size}.png`,
    encodePng(
      compose(source.pixels, source.width, source.height, size, {
        scale: 0.64,
        background: OBSIDIAN,
      }),
      size,
      size,
    ),
  );
}

console.log();
for (const [name, bytes] of written) {
  console.log(`  ${name.padEnd(36)} ${(bytes / 1024).toFixed(1).padStart(7)} KB`);
}
console.log(`\n${written.length} archivos generados desde un solo retrato.`);
