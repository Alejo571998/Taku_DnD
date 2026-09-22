/// <reference lib="webworker" />
import { defaultCache } from '@serwist/next/worker';
import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist';
import { CacheFirst, ExpirationPlugin, Serwist, StaleWhileRevalidate } from 'serwist';

/**
 * SERVICE WORKER (MASTER SPEC §35)
 *
 * No convierte una web responsive en "PWA" por decreto: precachea el esqueleto
 * de la aplicación y el contenido del SRD para que abrir la app sin conexión
 * sea el camino normal, no un modo degradado.
 */

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    /**
     * Contenido del SRD: inmutable y versionado por pack, así que cache-first
     * es correcto y evita volver a bajar ~2,7 MB en cada arranque.
     */
    {
      matcher: ({ url }) => url.pathname.startsWith('/content/'),
      handler: new CacheFirst({
        cacheName: 'taku-content',
        plugins: [
          new ExpirationPlugin({
            maxEntries: 80,
            maxAgeSeconds: 365 * 24 * 60 * 60,
            purgeOnQuotaError: true,
          }),
        ],
      }),
    },
    {
      matcher: ({ url }) => url.pathname.startsWith('/icons/'),
      handler: new CacheFirst({
        cacheName: 'taku-icons',
        plugins: [new ExpirationPlugin({ maxEntries: 16, maxAgeSeconds: 365 * 24 * 60 * 60 })],
      }),
    },
    /**
     * La API de sincronización NUNCA se cachea: servir una respuesta vieja
     * corrompería el estado del personaje.
     */
    {
      matcher: ({ url }) => url.pathname.startsWith('/api/sync'),
      handler: new StaleWhileRevalidate({ cacheName: 'taku-no-store' }),
      method: 'GET',
    },
    ...defaultCache,
  ],
  fallbacks: {
    entries: [
      {
        url: '/offline',
        matcher: ({ request }) => request.destination === 'document',
      },
    ],
  },
});

serwist.addEventListeners();
