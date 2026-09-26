import type { Metadata, Viewport } from 'next';
import { Cinzel, Inter } from 'next/font/google';
import './globals.css';
import { AppProviders } from '@ui/components/AppProviders';

/**
 * Las fuentes se auto-alojan en el build: sin peticiones a terceros, sin
 * saltos de maquetación, y funcionan sin conexión — que en esta aplicación
 * no es un extra (MASTER SPEC §35).
 */
const cinzel = Cinzel({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-cinzel',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

/**
 * DÓNDE VIVE LA APLICACIÓN, PARA QUIEN LA COMPARTE.
 *
 * `og:image` TIENE que ser una URL absoluta: LinkedIn, WhatsApp y Slack
 * descargan la imagen desde sus propios servidores y una ruta relativa no les
 * dice nada. Next la construye a partir de `metadataBase`.
 *
 * Sale de las variables que Vercel pone sola, no de una que haya que acordarse
 * de configurar —se quitó `NEXT_PUBLIC_APP_URL` justo por eso—:
 *
 *   VERCEL_PROJECT_PRODUCTION_URL  el dominio de producción, siempre el mismo
 *   VERCEL_URL                     el de ESTE despliegue, distinto por rama
 *
 * Se prefiere el de producción para que una vista previa compartida por error
 * no reparta enlaces a un despliegue de rama que mañana no existe. En local no
 * hay ninguna de las dos y queda `localhost`, que es lo correcto: así se ve en
 * el HTML que las etiquetas están, aunque el enlace no sirva fuera.
 */
const SITIO = new URL(
  process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000',
);

const TITULO = 'TAKU D&D — Tu compañero de aventura';
const DESCRIPCION =
  'Creá, gestioná y jugá tus personajes de Dungeons & Dragons. Reglas 2014 y 2024, inventario, hechizos y dados. Funciona sin conexión.';

export const metadata: Metadata = {
  metadataBase: SITIO,
  title: {
    default: TITULO,
    template: '%s · TAKU D&D',
  },
  description: DESCRIPCION,
  applicationName: 'TAKU D&D',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'TAKU',
    statusBarStyle: 'black-translucent',
  },
  formatDetection: { telephone: false },
  icons: {
    /*
      Los tamaños chicos van primero y explícitos. Sin un 16 y un 32 de
      verdad, el navegador reduce el de 192 en cada pestaña y el resultado en
      una pestaña es una mancha verde: un personaje de cuerpo entero necesita
      su propia versión a ese tamaño, no un reescalado automático.

      El `.ico` queda para los sitios que solo miran ahí — accesos directos de
      Windows, lectores de RSS, algún agregador — y lleva los tres tamaños
      dentro.
    */
    icon: [
      { url: '/icons/favicon-16.png', sizes: '16x16', type: 'image/png' },
      { url: '/icons/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/favicon-48.png', sizes: '48x48', type: 'image/png' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    shortcut: [{ url: '/favicon.ico', sizes: '16x16 32x32 48x48' }],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180' }],
  },

  /**
   * LA TARJETA QUE SE VE AL PEGAR EL ENLACE
   *
   * Sin esto, LinkedIn muestra el enlace pelado: el dominio y poco más. Con
   * esto muestra la imagen grande, el título y la bajada.
   *
   * `width` y `height` no son opcionales en la práctica. LinkedIn decide entre
   * la tarjeta grande y una miniatura al lado del texto, y si no sabe la
   * proporción ANTES de descargar la imagen, tira por la miniatura. Declararlas
   * es lo que dispara la tarjeta grande.
   *
   * 1200×630 es la proporción 1.91:1 que esperan todos.
   *
   * LA IMAGEN NO SE DECLARA ACÁ. Vive en `src/app/opengraph-image.png` y Next
   * la encuentra por convención: le lee las dimensiones del propio archivo,
   * emite las etiquetas y le cuelga un hash para que las redes no sirvan una
   * versión vieja al cambiarla. El texto alternativo va en el `.alt.txt` de al
   * lado, y lo usan los lectores de pantalla de las propias redes.
   *
   * Está FUERA de `public/` a propósito, y no es un detalle de organización:
   * en `public/` la precargaba el service worker, medio mega que cada persona
   * se bajaba al instalar para ver una imagen que solo mira el servidor de
   * LinkedIn. Se intentó excluirla con `exclude` y con `globPublicPatterns`, y
   * seguía entrando en el manifiesto; sacarla de la carpeta lo resuelve de
   * raíz. Comprobado: 0 ocurrencias en `sw.js`.
   */
  openGraph: {
    type: 'website',
    siteName: 'TAKU D&D',
    locale: 'es_AR',
    url: SITIO,
    title: TITULO,
    description: DESCRIPCION,
  },

  /*
    X y todo lo que lee las etiquetas `twitter:`, que son unas cuantas.

    Sin `summary_large_image` sale la miniatura chica aunque la imagen sea
    ancha. No se repite la imagen: cuando falta `twitter:image`, X usa la de
    Open Graph, y duplicar medio mega en el repositorio para decir lo mismo no
    tiene sentido.
  */
  twitter: {
    card: 'summary_large_image',
    title: TITULO,
    description: DESCRIPCION,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#0A0507' },
    { media: '(prefers-color-scheme: light)', color: '#FBF7F2' },
  ],
  width: 'device-width',
  initialScale: 1,
  // Se permite ampliar: bloquear el zoom incumple WCAG (MASTER SPEC §49).
  maximumScale: 5,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-419" suppressHydrationWarning>
      <head>
        {/*
          El tema se aplica ANTES del primer pintado. Sin esto, quien tenga
          tema claro ve un destello negro en cada carga.
        */}
        {/*
          TAKU es oscuro por identidad, no por preferencia del sistema: se juega
          de noche, en mesas mal iluminadas. El tema claro existe y funciona,
          pero hay que pedirlo — no se hereda del sistema operativo.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('taku-theme');document.documentElement.setAttribute('data-theme',t==='light'?'light':'dark');}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();`,
          }}
        />
      </head>
      <body className={`${cinzel.variable} ${inter.variable}`}>
        <a
          href="#contenido"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-[var(--radius-md)] focus:bg-[var(--surface-overlay)] focus:px-4 focus:py-2 focus:text-sm"
        >
          Saltar al contenido
        </a>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
