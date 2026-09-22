'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, isSupportedLocale, type Locale } from '@/i18n/config';
import { createTranslator, loadMessages, type MessageTree, type Translator } from '@/i18n/runtime';
import esMessages from '@/i18n/messages/es-419.json';

/**
 * IDIOMA DE LA INTERFAZ (MASTER SPEC §34)
 *
 * El español va en el bundle inicial porque es el idioma por defecto: pedirlo
 * por red haría parpadear cada pantalla en el primer pintado. El inglés se
 * carga solo si alguien lo elige.
 */

type LocaleContextValue = {
  readonly locale: Locale;
  readonly t: Translator;
  setLocale: (locale: Locale) => void;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

const LOCALE_KEY = 'taku-locale';
const LOCALE_EVENT = 'taku:locale-change';

function subscribeToLocale(onChange: () => void): () => void {
  window.addEventListener('storage', onChange);
  window.addEventListener(LOCALE_EVENT, onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(LOCALE_EVENT, onChange);
  };
}

function readLocale(): Locale {
  try {
    const stored = localStorage.getItem(LOCALE_KEY);
    return stored && isSupportedLocale(stored) ? stored : DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}

const serverLocale = (): Locale => DEFAULT_LOCALE;

export function LocaleProvider({ children }: { children: ReactNode }) {
  const locale = useSyncExternalStore(subscribeToLocale, readLocale, serverLocale);
  const [messages, setMessages] = useState<MessageTree>(esMessages as MessageTree);

  useEffect(() => {
    if (locale === DEFAULT_LOCALE) return;
    let cancelled = false;
    void loadMessages(locale).then((loaded) => {
      if (!cancelled) setMessages(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [locale]);

  // El atributo `lang` no es decorativo: los lectores de pantalla eligen la voz
  // con él, y sin esto leerían el español con pronunciación inglesa.
  useEffect(() => {
    document.documentElement.setAttribute('lang', locale);
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    try {
      localStorage.setItem(LOCALE_KEY, next);
    } catch {
      // Sin almacenamiento el idioma dura lo que dure la pestaña. Aceptable.
    }
    window.dispatchEvent(new Event(LOCALE_EVENT));
  }, []);

  const value = useMemo<LocaleContextValue>(
    () => ({ locale, t: createTranslator(messages), setLocale }),
    [locale, messages, setLocale],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error('useLocale() fuera de <LocaleProvider>');
  return ctx;
}

/** Atajo para el caso normal: solo traducir. */
export function useT(): Translator {
  return useLocale().t;
}

export { SUPPORTED_LOCALES };
