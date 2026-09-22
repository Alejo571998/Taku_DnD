import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * CONTRASTE (WCAG 2.1 AA — criterios 1.4.3 y 1.4.11, MASTER SPEC §49)
 *
 * El contraste es de las pocas cosas de accesibilidad que se pueden MEDIR, asi
 * que se mide. Sin un test, cualquier retoque del tema puede dejar un texto
 * ilegible y nadie se entera hasta que alguien no puede usar la aplicacion.
 *
 * Los tokens estan en oklch, que es lo correcto para elegir colores pero no se
 * puede comparar directo: hay que llevarlos a sRGB y calcular luminancia.
 */

const CSS = fs.readFileSync(path.resolve(process.cwd(), 'src/app/globals.css'), 'utf8');

const AA_NORMAL = 4.5;
const AA_LARGE = 3;

// ── oklch → sRGB ─────────────────────────────────────────────────────────────

type Rgb = readonly [number, number, number];

function oklchToRgb(L: number, C: number, hDeg: number): Rgb {
  const h = (hDeg * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);

  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;

  const lr = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const lg = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const lb = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;

  const gamma = (v: number) => {
    const c = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.abs(v) ** (1 / 2.4) - 0.055;
    return Math.min(255, Math.max(0, Math.round(c * 255)));
  };

  return [gamma(lr), gamma(lg), gamma(lb)];
}

function relativeLuminance([r, g, b]: Rgb): number {
  const f = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function contrast(a: Rgb, b: Rgb): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x) as [number, number];
  return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
}

// ── Lectura de los tokens ────────────────────────────────────────────────────

/**
 * Extrae los tokens de un bloque del tema y resuelve los alias.
 *
 * `--success-text: var(--color-vitality-600)` hay que seguirlo hasta el oklch
 * de verdad, o el test estaria comprobando un nombre en vez de un color.
 */
function readTheme(selector: string): Map<string, string> {
  const index = CSS.indexOf(selector);
  if (index < 0) throw new Error(`No encuentro el bloque ${selector} en globals.css`);

  const open = CSS.indexOf('{', index);
  let depth = 0;
  let end = open;
  for (let i = open; i < CSS.length; i++) {
    if (CSS[i] === '{') depth++;
    if (CSS[i] === '}') {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }

  const tokens = new Map<string, string>();
  for (const match of CSS.slice(open, end).matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    tokens.set(match[1]!, match[2]!.trim());
  }
  return tokens;
}

const palette = readTheme('@theme');
const dark = readTheme(':root');
const light = readTheme("[data-theme='light']");

function resolve(tokens: Map<string, string>, name: string, depth = 0): Rgb {
  if (depth > 6) throw new Error(`Alias circular en ${name}`);

  /**
   * Mismo orden que la cascada de CSS.
   *
   * `[data-theme='light']` solo redefine lo que cambia; todo lo demas lo
   * hereda de `:root`. Buscar unicamente en el bloque claro daria "token
   * desconocido" para colores que en el navegador se ven perfectamente.
   */
  const value = tokens.get(name) ?? dark.get(name) ?? palette.get(name);
  if (!value) throw new Error(`Token desconocido: ${name}`);

  const alias = value.match(/var\((--[\w-]+)\)/);
  if (alias) return resolve(tokens, alias[1]!, depth + 1);

  const oklch = value.match(/oklch\(\s*([\d.]+)%?\s+([\d.]+)\s+([\d.]+)/);
  if (!oklch) throw new Error(`No es un color oklch: ${name} = ${value}`);

  const raw = Number(oklch[1]);
  // El CSS admite `58.5%` y `0.585`: son lo mismo.
  const L = value.includes('%') && raw > 1 ? raw / 100 : raw;
  return oklchToRgb(L, Number(oklch[2]), Number(oklch[3]));
}

// ── Casos ────────────────────────────────────────────────────────────────────

const THEMES = [
  { name: 'oscuro', tokens: dark },
  { name: 'claro', tokens: light },
] as const;

/** Texto normal: 4.5:1. Es el grueso de la interfaz. */
const TEXT_ON_SURFACE = [
  '--text-primary',
  '--text-secondary',
  '--text-tertiary',
  '--accent-text',
  '--danger-text',
  '--warning-text',
  '--success-text',
] as const;

describe.each(THEMES)('Tema $name', ({ tokens }) => {
  const base = () => resolve(tokens, '--surface-base');
  const raised = () => resolve(tokens, '--surface-raised');

  it.each(TEXT_ON_SURFACE)('%s cumple AA sobre el fondo', (token) => {
    expect(contrast(resolve(tokens, token), base())).toBeGreaterThanOrEqual(AA_NORMAL);
  });

  it.each(TEXT_ON_SURFACE)('%s cumple AA sobre una superficie elevada', (token) => {
    expect(contrast(resolve(tokens, token), raised())).toBeGreaterThanOrEqual(AA_NORMAL);
  });

  it('el texto sobre el boton de acento cumple AA', () => {
    // El boton primario es la accion mas usada de la aplicacion.
    expect(contrast(resolve(tokens, '--accent-on'), resolve(tokens, '--accent'))).toBeGreaterThanOrEqual(
      AA_NORMAL,
    );
  });

  it('los bordes se distinguen del fondo (1.4.11)', () => {
    // Un borde que no se ve convierte cada tarjeta en un bloque de texto suelto.
    expect(contrast(resolve(tokens, '--border-strong'), base())).toBeGreaterThanOrEqual(AA_LARGE);
  });
});
