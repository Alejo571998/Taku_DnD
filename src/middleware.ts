import { NextResponse, type NextRequest } from 'next/server';

/**
 * CABECERAS DE SEGURIDAD (MASTER PROMPT §43 y §79)
 *
 * TAKU guarda personajes, notas privadas y —cuando hay cuenta— un token de
 * sesión en el navegador. Estas cabeceras son la defensa de base: no impiden
 * un fallo de lógica, pero suben mucho el costo de explotarlo.
 *
 * Deliberadamente NO hay redirección de rutas acá. La aplicación funciona sin
 * cuenta a propósito (MASTER SPEC §40): un middleware que mandara a iniciar
 * sesión contradiría el producto.
 */

/**
 * Sobre `script-src` y `'unsafe-inline'` — el compromiso, dicho sin adornos.
 *
 * Next inyecta la carga de hidratación como scripts EN LÍNEA. Bloquearlos
 * exige nonces, y un nonce obliga a leer cabeceras en el layout, lo que
 * convierte TODAS las páginas en dinámicas. Eso rompe el precacheado del
 * service worker, que es lo que hace que la aplicación abra sin conexión.
 *
 * Entre una política que finge ser estricta y una aplicación offline real,
 * elegimos la aplicación y lo escribimos acá en vez de esconderlo. Todo lo
 * demás —objetos, marcos, formularios, orígenes— sí va cerrado.
 */
function contentSecurityPolicy(isDev: boolean): string {
  const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const connect = ["'self'", supabase, supabase.replace('https://', 'wss://')].filter(Boolean);

  return [
    "default-src 'self'",
    // `unsafe-eval` solo en desarrollo: lo necesita el refresco en caliente.
    `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src ${connect.join(' ')}`,
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    // Nada de plugins, nada de incrustar la aplicación en un marco ajeno.
    "object-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    'upgrade-insecure-requests',
  ].join('; ');
}

const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  /** Nada de esto hace falta para jugar a D&D. */
  'Permissions-Policy':
    'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'X-DNS-Prefetch-Control': 'off',
};

export function middleware(request: NextRequest): NextResponse {
  const response = NextResponse.next();
  const isDev = process.env.NODE_ENV !== 'production';

  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(key, value);
  }
  response.headers.set('Content-Security-Policy', contentSecurityPolicy(isDev));

  if (!isDev) {
    response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  }

  // El API de sincronización nunca se cachea en ningún intermediario: servir
  // una respuesta vieja corrompería el estado de un personaje.
  if (request.nextUrl.pathname.startsWith('/api/')) {
    response.headers.set('Cache-Control', 'no-store, must-revalidate');
  }

  return response;
}

export const config = {
  /**
   * Se excluyen los estáticos: añadirles cabeceras en cada petición cuesta
   * tiempo de respuesta y no protege nada que no esté ya protegido.
   */
  matcher: ['/((?!_next/static|_next/image|icons/|content/|favicon.ico|manifest.webmanifest|sw.js).*)'],
};
