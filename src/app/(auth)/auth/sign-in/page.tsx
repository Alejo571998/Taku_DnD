'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { validateCredentials, type CredentialIssue } from '@application/auth/gateway';
import { isErr } from '@domain/shared/result';
import { Button } from '@ui/design-system/Button';
import { useSession } from '@ui/components/SessionProvider';
import {
  AUTH_ERROR_TEXT,
  AuthShell,
  CloudDisabledNotice,
  Field,
  FormError,
  ISSUE_TEXT,
} from '@ui/features/auth/AuthShell';

export default function SignInPage() {
  const router = useRouter();
  const { signIn, isCloudEnabled } = useSession();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [issues, setIssues] = useState<readonly CredentialIssue[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const found = validateCredentials({ email, password });
    setIssues(found);
    if (found.length > 0) return;

    setBusy(true);
    const outcome = await signIn({ email, password });
    setBusy(false);

    if (isErr(outcome)) {
      setError(AUTH_ERROR_TEXT[outcome.error.code]);
      return;
    }
    router.push('/');
  };

  return (
    <AuthShell
      title="Entrar a tu cuenta"
      subtitle="Para tener tus personajes en todos tus dispositivos."
      footer={
        <>
          <span className="text-[var(--text-tertiary)]">¿Todavía no tenés cuenta? </span>
          <Link href="/auth/sign-up" className="font-medium text-[var(--accent-text)] underline underline-offset-4">
            Crear una
          </Link>
        </>
      }
    >
      {!isCloudEnabled ? (
        <CloudDisabledNotice />
      ) : (
        <form onSubmit={submit} className="space-y-4">
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

          <Field
            id="password"
            label="Contraseña"
            type="password"
            value={password}
            onChange={setPassword}
            autoComplete="current-password"
            {...(issues.includes('password.tooShort') ? { error: ISSUE_TEXT['password.tooShort'] } : {})}
          />

          <Button type="submit" variant="primary" size="lg" loading={busy} className="w-full">
            Entrar
          </Button>

          <p className="text-center text-xs">
            <Link
              href="/auth/recover"
              className="text-[var(--text-tertiary)] underline underline-offset-4 hover:text-[var(--text-secondary)]"
            >
              Olvidé mi contraseña
            </Link>
          </p>
        </form>
      )}
    </AuthShell>
  );
}
