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

export const metadata: Metadata = {
  title: {
    default: 'TAKU D&D — Tu compañero de aventura',
    template: '%s · TAKU D&D',
  },
  description:
    'Creá, gestioná y jugá tus personajes de Dungeons & Dragons. Reglas 2014 y 2024, inventario, hechizos y dados. Funciona sin conexión.',
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
