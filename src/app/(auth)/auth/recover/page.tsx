'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { MailCheck } from 'lucide-react';
import { validateCredentials, type CredentialIssue } from '@application/auth/gateway';
import { isErr } from '@domain/shared/result';
import { Button } from '@ui/design-system/Button';
import { LoadingState } from '@ui/design-system/primitives';
import { useSession } from '@ui/components/SessionProvider';
import {
  AUTH_ERROR_TEXT,
  AuthShell,
  CloudDisabledNotice,
  Field,
  FormError,
  ISSUE_TEXT,
} from '@ui/features/auth/AuthShell';

/**
 * RECUPERACIÓN DE CONTRASEÑA
 *
 * Dos pantallas en una ruta, porque son dos momentos del MISMO trámite:
 *   1. pedir el enlace
 *   2. volver desde el correo y escribir la contraseña nueva
 *
 * El enlace de Supabase deja una sesión de recuperación activa al aterrizar,
 * así que el segundo paso se detecta por eso y no por un parámetro que
 * cualquiera podría escribir a mano.
 */
function RecoverContent() {
  const router = useRouter();
  const { sendRecovery, updatePassword, isCloudEnabled, state } = useSession();
  const fromEmail = useSearchParams().get('type') === 'recovery' || state.status === 'authenticated';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [issues, setIssues] = useState<readonly CredentialIssue[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  if (!isCloudEnabled) {
    return (
      <AuthShell title="Recuperar el acceso" subtitle="Te mandamos un enlace para volver a entrar.">
        <CloudDisabledNotice />
      </AuthShell>
    );
  }

  const request = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const found = validateCredentials({ email, password: 'placeholder8' }).filter(
      (i) => i === 'email.invalid',
    );
    setIssues(found);
    if (found.length > 0) return;

    setBusy(true);
    const outcome = await sendRecovery(email);
    setBusy(false);

    // Se confirma igual exista o no la cuenta: decir "ese correo no está
    // registrado" le regala a cualquiera una lista de usuarios.
    if (isErr(outcome) && outcome.error.code !== 'auth.unknown') {
      setError(AUTH_ERROR_TEXT[outcome.error.code]);
      return;
    }
    setSent(true);
  };

  const change = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const found = validateCredentials({ email: 'a@b.co', password, confirm }).filter(
      (i) => i !== 'email.invalid',
    );
    setIssues(found);
    if (found.length > 0) return;

    setBusy(true);
    const outcome = await updatePassword(password);
    setBusy(false);

    if (isErr(outcome)) {
      setError(AUTH_ERROR_TEXT[outcome.error.code]);
      return;
    }
    router.push('/');
  };

  if (sent) {
    return (
      <AuthShell title="Revisá tu correo" subtitle="Si hay una cuenta con ese correo, el enlace ya salió.">
        <div className="flex flex-col items-center rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--surface-raised)] p-6 text-center">
          <span className="mb-4 flex size-12 items-center justify-center rounded-full bg-[var(--accent-muted)]">
            <MailCheck className="size-5 text-[var(--accent-text)]" strokeWidth={2} />
          </span>
          <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
            Abrí el enlace desde este dispositivo para elegir una contraseña nueva.
          </p>
        </div>
      </AuthShell>
    );
  }

  if (fromEmail) {
    return (
      <AuthShell title="Elegí una contraseña nueva" subtitle="Y volvés a tu mesa.">
        <form onSubmit={change} className="space-y-4">
          <FormError message={error} />
          <Field
            id="password"
            label="Contraseña nueva"
            type="password"
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
            {...(issues.includes('password.tooShort') ? { error: ISSUE_TEXT['password.tooShort'] } : {})}
          />
          <Field
            id="confirm"
            label="Repetir contraseña"
            type="password"
            value={confirm}
            onChange={setConfirm}
            autoComplete="new-password"
            {...(issues.includes('password.mismatch') ? { error: ISSUE_TEXT['password.mismatch'] } : {})}
          />
          <Button type="submit" variant="primary" size="lg" loading={busy} className="w-full">
            Guardar y entrar
          </Button>
        </form>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Recuperar el acceso"
      subtitle="Te mandamos un enlace para elegir una contraseña nueva."
      footer={
        <Link href="/auth/sign-in" className="font-medium text-[var(--accent-text)] underline underline-offset-4">
          Volver a entrar
        </Link>
      }
    >
      <form onSubmit={request} className="space-y-4">
        <FormError message={error} />
        <Field
          id="email"
          label="Correo"
          type="email"
          value={email}
          onChange={setEmail}
          autoComplete="email"
          placeholder="vos@ejemplo.com"
          {...(issues.includes('email.invalid') ? { error: ISSUE_TEXT['email.invalid'] } : {})}
        />
        <Button type="submit" variant="primary" size="lg" loading={busy} className="w-full">
          Enviar enlace
        </Button>
      </form>
    </AuthShell>
  );
}

export default function RecoverPage() {
  return (
    <Suspense fallback={<LoadingState label="Abriendo…" />}>
      <RecoverContent />
    </Suspense>
  );
}
