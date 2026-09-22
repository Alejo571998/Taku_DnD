'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import type { AuthError, CredentialIssue } from '@application/auth/gateway';
import { Logo } from '@ui/design-system/Logo';
import { TakuSprite } from '@ui/features/taku/TakuSprite';

/**
 * PANTALLAS DE CUENTA
 *
 * TAKU no pide una cuenta para empezar. Estas pantallas existen para UNA cosa
 * concreta —tener los personajes en varios dispositivos— y lo dicen así, en
 * vez de presentar el registro como un peaje obligatorio (MASTER SPEC §40).
 *
 * Es también el único sitio donde Taku aparece por pura calidez y no para
 * informar de algo: dar de alta una cuenta es la parte menos divertida de
 * cualquier aplicación, y el personaje está dibujado saludando.
 */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <main className="relative z-10 mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-5 py-10">
      <div className="mb-8 flex flex-col items-center text-center">
        <Link href="/" aria-label="TAKU D&D — Inicio" className="mb-6">
          <Logo size="lg" />
        </Link>
        <h1 className="font-display text-2xl leading-tight">{title}</h1>
        <p className="mt-2 text-sm text-[var(--text-tertiary)]">{subtitle}</p>
      </div>

      {/*
        Taku asomándose por detrás de la tarjeta.

        El orden de apilado es lo único que hace que funcione: el sprite va en
        z-0 y la tarjeta en z-10 con fondo opaco, así que la mitad de abajo del
        personaje queda TAPADA. Si los dos estuvieran al mismo nivel, Taku
        flotaría encima del formulario en vez de detrás.

        `overflow-visible` en el contenedor y no en la tarjeta: lo que sobresale
        por arriba tiene que poder salir.
      */}
      {/*
        `mt-12` le reserva sitio ARRIBA. Sin eso, la parte que sobresale se
        monta encima del subtítulo, que es contenido y gana siempre: asomarse
        no puede costarle una línea de texto a nadie.
      */}
      <div className="relative mt-12">
        <div className="pointer-events-none absolute -top-[3.5rem] right-4 z-0">
          <TakuSprite mood="greet" size={92} className="animate-taku-peek" priority />
        </div>

        <div className="surface-card relative z-10 p-5">{children}</div>
      </div>

      {footer && <div className="mt-6 text-center text-sm">{footer}</div>}

      <p className="mt-8 text-center text-xs text-[var(--text-tertiary)]">
        Podés seguir usando TAKU sin cuenta.{' '}
        <Link href="/" className="underline underline-offset-4 hover:text-[var(--text-secondary)]">
          Volver a la aplicación
        </Link>
      </p>
    </main>
  );
}

/** Mensajes de error. La interfaz JAMÁS muestra un código crudo. */
export const AUTH_ERROR_TEXT: Record<AuthError['code'], string> = {
  'auth.invalidCredentials': 'El correo o la contraseña no coinciden.',
  'auth.emailInUse': 'Ya hay una cuenta con ese correo. Probá iniciar sesión.',
  'auth.weakPassword': 'Esa contraseña es demasiado corta.',
  'auth.invalidEmail': 'Ese correo no parece válido.',
  'auth.emailNotConfirmed': 'Te falta confirmar el correo. Revisá tu bandeja.',
  'auth.rateLimited': 'Demasiados intentos seguidos. Esperá un minuto.',
  'auth.notConfigured': 'Este servidor todavía no tiene la nube configurada.',
  'auth.network': 'No pudimos conectarnos. Revisá tu conexión.',
  'auth.unknown': 'Algo falló y no sabemos qué. Probá de nuevo.',
};

export const ISSUE_TEXT: Record<CredentialIssue, string> = {
  'email.invalid': 'Escribí un correo válido.',
  'password.tooShort': 'La contraseña necesita al menos 8 caracteres.',
  'password.mismatch': 'Las dos contraseñas no coinciden.',
};

export function Field({
  id,
  label,
  type,
  value,
  onChange,
  autoComplete,
  placeholder,
  error,
}: {
  id: string;
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
  placeholder?: string;
  error?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-medium text-[var(--text-secondary)]">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className="mt-1.5 h-12 w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-raised)] px-3.5 text-sm outline-none transition-colors placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent)] aria-[invalid=true]:border-[var(--danger-text)]"
      />
      {error && (
        <p id={`${id}-error`} className="mt-1.5 text-xs text-[var(--danger-text)]">
          {error}
        </p>
      )}
    </div>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="rounded-[var(--radius-md)] border border-[var(--danger-text)]/35 bg-[var(--danger-muted)] px-3.5 py-2.5 text-sm text-[var(--text-secondary)]"
    >
      {message}
    </p>
  );
}

/** Se muestra cuando el despliegue no tiene backend configurado. */
export function CloudDisabledNotice() {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--surface-raised)] p-5 text-center">
      <p className="text-sm font-medium">La nube no está configurada</p>
      <p className="mt-2 text-sm leading-relaxed text-[var(--text-tertiary)]">
        Esta copia de TAKU guarda todo en tu dispositivo. Funciona entera —personajes, reglas,
        partidas— pero no sincroniza entre dispositivos hasta que quien la instaló configure el
        servidor.
      </p>
    </div>
  );
}
