'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MailCheck } from 'lucide-react';
import { validateCredentials, type CredentialIssue } from '@application/auth/gateway';
import { isErr } from '@domain/shared/result';
import { Button } from '@ui/design-system/Button';
import { useCharacters } from '@ui/hooks/useAppData';
import { useSession } from '@ui/components/SessionProvider';
import {
  AUTH_ERROR_TEXT,
  AuthShell,
  CloudDisabledNotice,
  Field,
  FormError,
  ISSUE_TEXT,
} from '@ui/features/auth/AuthShell';

export default function SignUpPage() {
  const router = useRouter();
  const { signUp, isCloudEnabled } = useSession();
  const characters = useCharacters();

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [issues, setIssues] = useState<readonly CredentialIssue[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);

  const localCount = characters?.length ?? 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const found = validateCredentials({ email, password, confirm });
    setIssues(found);
    if (found.length > 0) return;

    setBusy(true);
    const outcome = await signUp({
      email,
      password,
      ...(displayName.trim() ? { displayName: displayName.trim() } : {}),
    });
    setBusy(false);

    if (isErr(outcome)) {
      setError(AUTH_ERROR_TEXT[outcome.error.code]);
      return;
    }

    // Sin sesión = hay confirmación por correo pendiente. Decirlo es mejor que
    // dejar al usuario mirando una pantalla que no cambia.
    if (outcome.value === null) setCheckEmail(true);
    else router.push('/');
  };

  if (checkEmail) {
    return (
      <AuthShell title="Revisá tu correo" subtitle="Te mandamos un enlace para confirmar la cuenta.">
        <div className="flex flex-col items-center rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--surface-raised)] p-6 text-center">
          <span className="mb-4 flex size-12 items-center justify-center rounded-full bg-[var(--accent-muted)]">
            <MailCheck className="size-5 text-[var(--accent-text)]" strokeWidth={2} />
          </span>
          <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
            Enviamos un enlace a <strong className="font-medium text-[var(--text-primary)]">{email}</strong>.
            Abrilo desde este dispositivo para terminar.
          </p>
          <p className="mt-4 text-xs text-[var(--text-tertiary)]">
            Mientras tanto podés seguir jugando: tus personajes están guardados acá y se subirán solos
            cuando entres.
          </p>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Crear tu cuenta"
      subtitle="Sirve para una sola cosa: llevarte tus personajes a otro dispositivo."
      footer={
        <>
          <span className="text-[var(--text-tertiary)]">¿Ya tenés cuenta? </span>
          <Link href="/auth/sign-in" className="font-medium text-[var(--accent-text)] underline underline-offset-4">
            Entrar
          </Link>
        </>
      }
    >
      {!isCloudEnabled ? (
        <CloudDisabledNotice />
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <FormError message={error} />

          {/*
            Quien ya jugó sin cuenta necesita saber que no va a perder nada.
            Es la duda que frena el registro, y contestarla cuesta una frase.
          */}
          {localCount > 0 && (
            <p className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-sunken)] px-3.5 py-2.5 text-xs leading-relaxed text-[var(--text-secondary)]">
              Tenés {localCount} {localCount === 1 ? 'personaje' : 'personajes'} en este dispositivo.
              Al crear la cuenta {localCount === 1 ? 'pasa' : 'pasan'} a ella tal cual: no se pierde
              ni se duplica nada.
            </p>
          )}

          <Field
            id="displayName"
            label="Cómo te llamamos (opcional)"
            type="text"
            value={displayName}
            onChange={setDisplayName}
            autoComplete="nickname"
            placeholder="Alejo"
          />

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

          <Field
            id="password"
            label="Contraseña"
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
            Crear cuenta
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
