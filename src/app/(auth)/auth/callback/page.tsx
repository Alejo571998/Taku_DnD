'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@ui/components/SessionProvider';
import { AuthShell } from '@ui/features/auth/AuthShell';
import { LoadingState } from '@ui/design-system/primitives';

/**
 * ATERRIZAJE DEL ENLACE DE CORREO
 *
 * El cliente de Supabase lee el fragmento de la URL y deja la sesión lista
 * (`detectSessionInUrl`). Aquí solo se espera a que el proveedor lo note y se
 * sigue adelante — sin tocar tokens a mano, que es donde se cometen los
 * errores caros.
 */
export default function AuthCallbackPage() {
  const router = useRouter();
  const { state } = useSession();

  useEffect(() => {
    if (state.status === 'authenticated') router.replace('/');
    else if (state.status === 'anonymous' || state.status === 'disabled') {
      // El enlace caducó o ya se usó: no dejar al usuario girando.
      const timer = setTimeout(() => router.replace('/auth/sign-in'), 2500);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [state, router]);

  return (
    <AuthShell title="Confirmando…" subtitle="Un segundo y estás adentro.">
      <LoadingState label="Verificando el enlace" />
    </AuthShell>
  );
}
