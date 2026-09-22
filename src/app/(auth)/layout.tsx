import type { ReactNode } from 'react';

/**
 * Las pantallas de cuenta no llevan la navegación de la aplicación: quien está
 * iniciando sesión tiene una sola tarea, y ofrecerle seis destinos a la vez la
 * estorba. El único enlace de salida es volver a la aplicación.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
