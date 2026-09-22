/**
 * PNG e ICO sin dependencias.
 *
 * El proyecto no tiene librerías de imagen a propósito: los iconos se generan
 * y se pueden auditar. Para llevar el retrato de Taku a los tamaños que hacen
 * falta hay que decodificar, escalar y volver a codificar, y eso son unas
 * doscientas líneas con solo `zlib`.
 *
 * Soporta lo que hace falta y nada más: RGBA de 8 bits sin entrelazado, que es
 * lo que produce cualquier exportador moderno.
 */
import zlib from 'node:zlib';

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

// ── Decodificación ───────────────────────────────────────────────────────────

/**
 * Deshace el filtrado por scanline.
 *
 * PNG resta a cada byte una predicción sacada de sus vecinos —izquierda,
 * arriba, o una media de los dos— porque eso hace que zlib comprima mucho
 * mejor. Hay que revertirlo fila por fila y EN ORDEN: cada fila se predice a
 * partir de la anterior ya reconstruida.
 */
function unfilter(raw, width, height, bytesPerPixel) {
  const stride = width * bytesPerPixel;
  const out = Buffer.alloc(stride * height);

  for (let y = 0; y < height; y++) {
    const filterType = raw[y * (stride + 1)];
    const src = y * (stride + 1) + 1;
    const dst = y * stride;
    const prev = dst - stride;

    for (let x = 0; x < stride; x++) {
      const value = raw[src + x];
      const left = x >= bytesPerPixel ? out[dst + x - bytesPerPixel] : 0;
      const up = y > 0 ? out[prev + x] : 0;
      const upLeft = y > 0 && x >= bytesPerPixel ? out[prev + x - bytesPerPixel] : 0;

      let prediction;
      switch (filterType) {
        case 0:
          prediction = 0;
          break;
        case 1:
          prediction = left;
          break;
        case 2:
          prediction = up;
          break;
        case 3:
          prediction = (left + up) >> 1;
          break;
        case 4: {
          // Paeth: se queda con el vecino más cercano a left + up - upLeft.
          const p = left + up - upLeft;
          const dL = Math.abs(p - left);
          const dU = Math.abs(p - up);
          const dUL = Math.abs(p - upLeft);
          prediction = dL <= dU && dL <= dUL ? left : dU <= dUL ? up : upLeft;
          break;
        }
        default:
          throw new Error(`Filtro PNG desconocido: ${filterType}`);
      }

      out[dst + x] = (value + prediction) & 0xff;
    }
  }

  return out;
}

export function decodePng(buffer) {
  if (!buffer.slice(0, 8).equals(SIGNATURE)) throw new Error('No es un PNG');

  let offset = 8;
  let header = null;
  const idat = [];

  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.slice(offset + 4, offset + 8).toString('ascii');
    const data = buffer.slice(offset + 8, offset + 8 + length);

    if (type === 'IHDR') {
      header = {
        width: data.readUInt32BE(0),
        height: data.readUInt32BE(4),
        depth: data[8],
        colorType: data[9],
        interlace: data[12],
      };
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') {
      break;
    }

    offset += 12 + length;
  }

  if (!header) throw new Error('PNG sin IHDR');
  if (header.depth !== 8) throw new Error(`Solo 8 bits por canal, no ${header.depth}`);
  if (header.interlace !== 0) throw new Error('Los PNG entrelazados no están soportados');

  const channels = { 0: 1, 2: 3, 4: 2, 6: 4 }[header.colorType];
  if (!channels) throw new Error(`Tipo de color no soportado: ${header.colorType}`);

  const raw = unfilter(
    zlib.inflateSync(Buffer.concat(idat)),
    header.width,
    header.height,
    channels,
  );

  // Todo se normaliza a RGBA: el resto del código no tiene por qué saber de
  // escala de grises ni de imágenes sin alfa.
  const pixels = Buffer.alloc(header.width * header.height * 4);
  for (let i = 0, n = header.width * header.height; i < n; i++) {
    const s = i * channels;
    const d = i * 4;
    if (channels === 4) {
      raw.copy(pixels, d, s, s + 4);
    } else if (channels === 3) {
      pixels[d] = raw[s];
      pixels[d + 1] = raw[s + 1];
      pixels[d + 2] = raw[s + 2];
      pixels[d + 3] = 255;
    } else if (channels === 2) {
      pixels.fill(raw[s], d, d + 3);
      pixels[d + 3] = raw[s + 1];
    } else {
      pixels.fill(raw[s], d, d + 3);
      pixels[d + 3] = 255;
    }
  }

  return { width: header.width, height: header.height, pixels };
}

// ── Codificación ─────────────────────────────────────────────────────────────

/**
 * Codifica RGBA a PNG probando los cinco filtros en cada fila.
 *
 * Elegir el filtro por heurística de suma absoluta es lo que hace la librería
 * de referencia, y aquí importa: para un retrato de 500 px con degradados,
 * filtrar bien es la diferencia entre 330 KB y unos 40.
 */
export function encodePng(pixels, width, height) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const bpp = 4;
  const stride = width * bpp;
  const raw = Buffer.alloc(height * (stride + 1));
  const candidate = Buffer.alloc(stride);

  for (let y = 0; y < height; y++) {
    const row = y * stride;
    const prevRow = row - stride;
    let best = null;
    let bestScore = Infinity;
    let bestType = 0;

    for (let type = 0; type < 5; type++) {
      let score = 0;
      for (let x = 0; x < stride; x++) {
        const value = pixels[row + x];
        const left = x >= bpp ? pixels[row + x - bpp] : 0;
        const up = y > 0 ? pixels[prevRow + x] : 0;
        const upLeft = y > 0 && x >= bpp ? pixels[prevRow + x - bpp] : 0;

        let prediction;
        if (type === 0) prediction = 0;
        else if (type === 1) prediction = left;
        else if (type === 2) prediction = up;
        else if (type === 3) prediction = (left + up) >> 1;
        else {
          const p = left + up - upLeft;
          const dL = Math.abs(p - left);
          const dU = Math.abs(p - up);
          const dUL = Math.abs(p - upLeft);
          prediction = dL <= dU && dL <= dUL ? left : dU <= dUL ? up : upLeft;
        }

        const byte = (value - prediction) & 0xff;
        candidate[x] = byte;
        // Los valores cerca de 0 o de 255 comprimen mejor: se puntúa la
        // distancia al cero con signo.
        score += byte < 128 ? byte : 256 - byte;
      }

      if (score < bestScore) {
        bestScore = score;
        bestType = type;
        best = Buffer.from(candidate);
      }
    }

    raw[y * (stride + 1)] = bestType;
    best.copy(raw, y * (stride + 1) + 1);
  }

  return Buffer.concat([
    SIGNATURE,
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ── Escalado ─────────────────────────────────────────────────────────────────

/**
 * Reduce por promedio de área, PREMULTIPLICANDO el alfa.
 *
 * Sin premultiplicar, los píxeles transparentes —que suelen ser negros con
 * alfa 0— arrastran su color al promedio y aparece un halo oscuro alrededor de
 * todo el contorno. En un personaje recortado con brillo verde eso se ve
 * enseguida y parece suciedad del archivo.
 */
export function resize(src, srcW, srcH, dstW, dstH) {
  const out = Buffer.alloc(dstW * dstH * 4);
  const xRatio = srcW / dstW;
  const yRatio = srcH / dstH;

  for (let y = 0; y < dstH; y++) {
    const y0 = Math.floor(y * yRatio);
    const y1 = Math.min(srcH, Math.ceil((y + 1) * yRatio));

    for (let x = 0; x < dstW; x++) {
      const x0 = Math.floor(x * xRatio);
      const x1 = Math.min(srcW, Math.ceil((x + 1) * xRatio));

      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let count = 0;

      for (let sy = y0; sy < y1; sy++) {
        for (let sx = x0; sx < x1; sx++) {
          const i = (sy * srcW + sx) * 4;
          const alpha = src[i + 3];
          r += src[i] * alpha;
          g += src[i + 1] * alpha;
          b += src[i + 2] * alpha;
          a += alpha;
          count++;
        }
      }

      const d = (y * dstW + x) * 4;
      if (a === 0 || count === 0) {
        out[d] = 0;
        out[d + 1] = 0;
        out[d + 2] = 0;
        out[d + 3] = 0;
        continue;
      }

      out[d] = Math.round(r / a);
      out[d + 1] = Math.round(g / a);
      out[d + 2] = Math.round(b / a);
      out[d + 3] = Math.round(a / count);
    }
  }

  return out;
}

/** Pega `src` centrado y escalado dentro de un lienzo, sobre un fondo opcional. */
export function compose(src, srcW, srcH, size, { scale = 1, background = null } = {}) {
  const canvas = Buffer.alloc(size * size * 4);

  if (background) {
    for (let i = 0; i < size * size; i++) {
      canvas[i * 4] = background[0];
      canvas[i * 4 + 1] = background[1];
      canvas[i * 4 + 2] = background[2];
      canvas[i * 4 + 3] = 255;
    }
  }

  const inner = Math.round(size * scale);
  const scaled = resize(src, srcW, srcH, inner, inner);
  const offset = Math.floor((size - inner) / 2);

  for (let y = 0; y < inner; y++) {
    for (let x = 0; x < inner; x++) {
      const s = (y * inner + x) * 4;
      const alpha = scaled[s + 3];
      if (alpha === 0) continue;

      const d = ((y + offset) * size + (x + offset)) * 4;
      const srcA = alpha / 255;
      const dstA = canvas[d + 3] / 255;
      const outA = srcA + dstA * (1 - srcA);

      for (let c = 0; c < 3; c++) {
        canvas[d + c] = Math.round(
          (scaled[s + c] * srcA + canvas[d + c] * dstA * (1 - srcA)) / outA,
        );
      }
      canvas[d + 3] = Math.round(outA * 255);
    }
  }

  return canvas;
}

// ── ICO ──────────────────────────────────────────────────────────────────────

/**
 * ICO con cargas PNG, una entrada por tamaño.
 *
 * El formato acepta PNG dentro desde Vista, y es lo que usa todo el mundo: un
 * BMP con máscara AND sería más compatible con Windows XP y bastante más
 * grande. Cero navegadores en uso necesitan eso.
 *
 * Un detalle del formato: el ancho y el alto se guardan en UN byte, y 256 se
 * escribe como 0. Por eso no hay iconos de más de 256 px.
 */
export function encodeIco(entries) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reservado
  header.writeUInt16LE(1, 2); // 1 = icono
  header.writeUInt16LE(entries.length, 4);

  const directory = Buffer.alloc(16 * entries.length);
  let offset = header.length + directory.length;

  entries.forEach((entry, index) => {
    const at = index * 16;
    directory[at] = entry.size >= 256 ? 0 : entry.size;
    directory[at + 1] = entry.size >= 256 ? 0 : entry.size;
    directory[at + 2] = 0; // paleta
    directory[at + 3] = 0; // reservado
    directory.writeUInt16LE(1, at + 4); // planos de color
    directory.writeUInt16LE(32, at + 6); // bits por píxel
    directory.writeUInt32LE(entry.png.length, at + 8);
    directory.writeUInt32LE(offset, at + 12);
    offset += entry.png.length;
  });

  return Buffer.concat([header, directory, ...entries.map((e) => e.png)]);
}
