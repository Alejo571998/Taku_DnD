import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * CLIENTES DE SUPABASE
 *
 * Dos clientes, dos propósitos, y NUNCA se confunden:
 *
 *   browserClient — clave publicable, sujeto a RLS. Puede llegar al navegador.
 *   serviceClient — clave de servicio, SALTA RLS. Solo servidor, jamás
 *                   expuesta. Si se filtra, se filtran todos los datos de
 *                   todos los usuarios.
 *
 * La regla de lint de `ui/` prohíbe importar este módulo desde componentes:
 * el único camino de escritura es application/ → /api/sync.
 */

export const isSupabaseConfigured = (): boolean =>
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

let browser: SupabaseClient | null = null;

/** Cliente del navegador. Sujeto a RLS; solo ve lo del usuario autenticado. */
export function getBrowserClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  browser ??= createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    },
  );
  return browser;
}

/*
  NO HAY CLIENTE CON LA CLAVE DE SERVICIO, Y ES A PROPOSITO.

  Hubo un `getServiceClient()` que creaba uno con `SUPABASE_SERVICE_ROLE_KEY`.
  No lo llamaba NADIE: las cuatro rutas de `/api/sync` usan el cliente con
  alcance de usuario de aqui abajo, que es la decision de diseño —la RLS sigue
  aplicando, asi que un fallo de autorizacion en el codigo de la aplicacion no
  basta para leer datos de otro inquilino—.

  Una funcion que salta la RLS entera, sin usos, es una puerta esperando a que
  alguien la abra «solo para esta consulta». Y mientras existia, el despliegue
  tenia que llevar la clave mas peligrosa del proyecto para nada: ahora
  produccion no la necesita ni la tiene.

  Si algun dia hace falta de verdad —una tarea programada, una migracion de
  datos— se escribe entonces, fuera de la aplicacion web, y con el motivo al
  lado.
*/

/**
 * Cliente de servidor actuando COMO el usuario que hace la petición.
 *
 * Es el que se usa en el API de sincronización: las políticas RLS siguen
 * aplicando, así que un fallo de autorización en el código de la aplicación
 * no basta para leer datos ajenos (defensa en profundidad).
 */
export function getUserScopedClient(accessToken: string): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}
