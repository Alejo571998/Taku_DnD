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

/**
 * Mensajes de error. La interfaz JAMÁS muestra un código crudo.
 *
 * Cada uno dice DOS cosas: qué pasó y qué hacer. Un mensaje que solo dice que
 * algo salió mal deja a quien lo lee sin salida —no sabe si escribió mal la
 * contraseña, si le falta confirmar el correo o si el problema es nuestro— y
 * lo único que puede hacer es repetir lo mismo a ver si cambia.
 *
 * El único que sigue siendo vago es `auth.unknown`, y ahí la honestidad es
 * decir que el fallo es NUESTRO y no suyo: repetir el intento no lo va a
 * arreglar. El detalle técnico va aparte, debajo, para poder copiarlo.
 */
export const AUTH_ERROR_TEXT: Record<AuthError['code'], string> = {
  'auth.invalidCredentials': 'El correo o la contraseña no coinciden.',
  'auth.emailInUse': 'Ya hay una cuenta con ese correo. Probá iniciar sesión.',
  'auth.weakPassword': 'Esa contraseña es demasiado corta: necesita 8 caracteres o más.',
  'auth.invalidEmail': 'Ese correo no parece válido.',
  'auth.emailNotConfirmed':
    'Te falta confirmar el correo. Buscá el mail que te mandamos y tocá el enlace; mirá también en el correo no deseado.',
  'auth.rateLimited': 'Demasiados intentos seguidos. Esperá un minuto y volvé a probar.',
  'auth.notConfigured':
    'Esta copia de TAKU no tiene la nube configurada, así que todavía no se puede entrar con cuenta. Podés seguir jugando sin ella.',
  'auth.network': 'No pudimos conectarnos. Revisá tu conexión y volvé a probar.',
  'auth.workspaceMissing':
    'Tu contraseña es correcta, pero no pudimos abrir tu espacio. Es un problema nuestro, no tuyo: volvé a intentar en un minuto y, si sigue, escribinos.',
  'auth.unknown':
    'No pudimos completar la operación, y el fallo es nuestro. Repetir el intento probablemente dé lo mismo.',
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

export function FormError({ message, detail }: { message: string | null; detail?: string }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="rounded-[var(--radius-md)] border border-[var(--danger-text)]/35 bg-[var(--danger-muted)] px-3.5 py-2.5 text-sm text-[var(--text-secondary)]"
    >
      <p>{message}</p>
      {/*
        El detalle técnico se VE, no se esconde en la consola.

        Nadie va a abrir las herramientas de desarrollo para contarnos qué le
        pasó. Puesto acá, quien quiera reportarlo lo copia y pega; quien no,
        lee la primera línea y ya está. Es texto del servidor de
        autenticación, nunca la contraseña ni el token.
      */}
      {detail && (
        <p className="mt-1.5 font-mono text-2xs leading-relaxed text-[var(--text-tertiary)]">
          {detail}
        </p>
      )}
    </div>
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
