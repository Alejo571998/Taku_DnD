'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { cn } from '@ui/design-system/cn';
import { SessionProvider } from './SessionProvider';
import { LocaleProvider } from './LocaleProvider';

/**
 * Proveedores globales: tema, conexión y avisos.
 *
 * Deliberadamente pequeños. Un contexto por preocupación, sin un almacén
 * global que lo sepa todo — el estado del dominio vive en IndexedDB, no aquí
 */

// ── Tema ─────────────────────────────────────────────────────────────────────

/**
 * TAKU es oscuro por defecto, no por preferencia del sistema: la identidad del
 * producto es la obsidiana con carmesí, y se juega de noche. El tema claro es
 * una elección explícita del usuario, no algo que se hereda del sistema.
 */
export type ThemePreference = 'dark' | 'light';

type ThemeContextValue = {
  preference: ThemePreference;
  resolved: 'dark' | 'light';
  setPreference: (p: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

const THEME_KEY = 'taku-theme';
const THEME_EVENT = 'taku:theme-change';

/**
 * El tema vive en `localStorage`, que es estado EXTERNO a React.
 *
 * `useSyncExternalStore` es la herramienta correcta para leerlo: evita el
 * patrón "leer en un efecto y llamar a setState", que provoca renderizados en
 * cascada y un parpadeo visible en la primera carga.
 */
function subscribeToTheme(onChange: () => void): () => void {
  // `storage` cubre otras pestañas; el evento propio, esta misma.
  window.addEventListener('storage', onChange);
  window.addEventListener(THEME_EVENT, onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(THEME_EVENT, onChange);
  };
}

/** Oscuro salvo que el usuario haya pedido claro explícitamente. */
const readThemeSnapshot = (): ThemePreference =>
  localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark';

const serverThemeSnapshot = (): ThemePreference => 'dark';

function ThemeProvider({ children }: { children: React.ReactNode }) {
  const preference = useSyncExternalStore(subscribeToTheme, readThemeSnapshot, serverThemeSnapshot);
  const resolved = preference;

  // Sincronizar el DOM con el estado de React: esto SÍ es lo que un efecto
  // debe hacer — actualizar un sistema externo, sin setState.
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', resolved);
  }, [resolved]);

  const setPreference = useCallback((p: ThemePreference) => {
    localStorage.setItem(THEME_KEY, p);
    // `storage` solo se dispara en OTRAS pestañas; este evento avisa a esta.
    window.dispatchEvent(new Event(THEME_EVENT));
  }, []);

  const value = useMemo(() => ({ preference, resolved, setPreference }), [preference, resolved, setPreference]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme debe usarse dentro de AppProviders');
  return ctx;
}

// ── Conexión ─────────────────────────────────────────────────────────────────

type ConnectionContextValue = {
  online: boolean;
  /** Operaciones esperando en la cola de sincronización. */
  pendingOperations: number;
  setPendingOperations: (n: number) => void;
};

const ConnectionContext = createContext<ConnectionContextValue | null>(null);

function ConnectionProvider({ children }: { children: React.ReactNode }) {
  // Se asume conectado al arrancar: mostrar "sin conexión" durante la
  // hidratación y corregirlo medio segundo después es peor que no mostrarlo.
  const [online, setOnline] = useState(true);
  const [pendingOperations, setPendingOperations] = useState(0);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  const value = useMemo(
    () => ({ online, pendingOperations, setPendingOperations }),
    [online, pendingOperations],
  );
  return <ConnectionContext.Provider value={value}>{children}</ConnectionContext.Provider>;
}

export function useConnection(): ConnectionContextValue {
  const ctx = useContext(ConnectionContext);
  if (!ctx) throw new Error('useConnection debe usarse dentro de AppProviders');
  return ctx;
}

// ── Avisos (toasts) ──────────────────────────────────────────────────────────

export type ToastTone = 'neutral' | 'success' | 'danger' | 'arcane';

export type Toast = {
  id: string;
  message: string;
  detail?: string;
  tone: ToastTone;
  /** Acción opcional: es el canal de "Deshacer" (MASTER SPEC §54). */
  action?: { label: string; onClick: () => void };
  durationMs: number;
};

type ToastContextValue = {
  toasts: Toast[];
  notify: (toast: Omit<Toast, 'id' | 'tone' | 'durationMs'> & Partial<Pick<Toast, 'tone' | 'durationMs'>>) => string;
  dismiss: (id: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: string) => {
    setToasts((list) => list.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const notify = useCallback<ToastContextValue['notify']>(
    (input) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      // Con acción el aviso dura más: hay que darle tiempo a leer y decidir.
      const durationMs = input.durationMs ?? (input.action ? 7000 : 4000);
      const toast: Toast = { id, tone: 'neutral', ...input, durationMs };
      setToasts((list) => [...list.slice(-2), toast]);
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), durationMs),
      );
      return id;
    },
    [dismiss],
  );

  useEffect(() => {
    const map = timers.current;
    return () => {
      for (const timer of map.values()) clearTimeout(timer);
      map.clear();
    };
  }, []);

  const value = useMemo(() => ({ toasts, notify, dismiss }), [toasts, notify, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast debe usarse dentro de AppProviders');
  return ctx;
}

const TOAST_TONES: Record<ToastTone, string> = {
  neutral: 'border-[var(--border-default)]',
  success: 'border-[var(--success-text)]/40',
  danger: 'border-[var(--danger-text)]/40',
  arcane: 'border-[var(--arcane-text)]/40',
};

function ToastViewport({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  if (toasts.length === 0) return null;
  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-50 flex flex-col items-center gap-2 px-4"
      style={{ bottom: 'calc(var(--nav-offset) + 0.75rem)' }}
      role="region"
      aria-label="Avisos"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="status"
          aria-live="polite"
          className={cn(
            'animate-slide-up pointer-events-auto flex w-full max-w-md items-center gap-3',
            'rounded-[var(--radius-lg)] border bg-[var(--surface-overlay)]/95 px-4 py-3 shadow-[var(--shadow-overlay)] backdrop-blur-xl',
            TOAST_TONES[toast.tone],
          )}
        >
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{toast.message}</p>
            {toast.detail && <p className="truncate text-xs text-[var(--text-tertiary)]">{toast.detail}</p>}
          </div>
          {toast.action && (
            /*
              El nombre accesible lleva DE QUÉ aviso es.

              Los avisos se apilan: recibir daño dos veces deja «−10 PG» y
              «−2 PG» en pantalla a la vez. Con la etiqueta a secas se oían dos
              botones «Deshacer» idénticos y no había manera de saber cuál
              deshacía cuál. Quien ve la pantalla lo resuelve mirando la fila.
            */
            <button
              onClick={() => {
                toast.action?.onClick();
                onDismiss(toast.id);
              }}
              aria-label={`${toast.action.label}: ${toast.message}`}
              className="shrink-0 rounded-[var(--radius-sm)] px-2 py-1 text-sm font-semibold text-[var(--accent-text)] hover:bg-[var(--accent-muted)]"
            >
              {toast.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Composición ──────────────────────────────────────────────────────────────

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    /*
      El idioma va POR FUERA de todo: cualquier aviso, error o pantalla puede
      necesitar traducir, incluido el propio límite de error.
      La sesión va POR DENTRO de los avisos, porque iniciar sesión y adoptar el
      trabajo local tienen que poder avisar.
    */
    <LocaleProvider>
      <ThemeProvider>
        <ConnectionProvider>
          <ToastProvider>
            <SessionProvider>{children}</SessionProvider>
          </ToastProvider>
        </ConnectionProvider>
      </ThemeProvider>
    </LocaleProvider>
  );
}
