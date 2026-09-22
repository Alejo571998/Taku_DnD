'use client';

import { useEffect, useState } from 'react';
import { Database, Info, Languages, Moon, Sun, Wifi } from 'lucide-react';
import { cn } from '@ui/design-system/cn';
import { Card, Chip, SectionTitle } from '@ui/design-system/primitives';
import { Logo } from '@ui/design-system/Logo';
import { useConnection, useTheme, type ThemePreference } from '@ui/components/AppProviders';
import { useLocale } from '@ui/components/LocaleProvider';
import { useSession } from '@ui/components/SessionProvider';
import { LOCALE_LABELS, SUPPORTED_LOCALES } from '@/i18n/config';
import { usePendingSyncCount } from '@ui/hooks/useAppData';
import { storageEstimate } from '@infrastructure/local/db';
import { AccountSection } from '@ui/features/auth/AccountSection';
import { TranslationCoverageCard } from '@ui/features/library/TranslationCoverageCard';
import { DiagnosticsSection } from '@ui/features/diagnostics/DiagnosticsSection';
import { TakuSprite } from '@ui/features/taku/TakuSprite';
import { useTaku } from '@ui/features/taku/TakuProvider';

export default function ProfilePage() {
  const { preference, setPreference } = useTheme();
  const { muted: takuMuted, setMuted: setTakuMuted } = useTaku();
  const { locale, setLocale, t } = useLocale();
  const session = useSession();
  const syncing = session.isCloudEnabled && session.state.status === 'authenticated';
  const { online } = useConnection();
  const pending = usePendingSyncCount();
  const [storage, setStorage] = useState<{ usage: number; quota: number } | null>(null);

  useEffect(() => {
    void storageEstimate().then(setStorage);
  }, []);

  return (
    <div className="space-y-6 animate-fade-in">
      <header>
        <h1 className="font-display text-2xl">Perfil</h1>
      </header>

      <Card className="flex items-center gap-4 p-5">
        <Logo size="md" />
        <div className="ml-auto text-right">
          <p className="text-xs text-[var(--text-tertiary)]">Versión</p>
          <p className="text-numeric text-sm font-medium">0.1.0</p>
        </div>
      </Card>

      <AccountSection />

      <section>
        <SectionTitle>Apariencia</SectionTitle>
        <Card className="p-2">
          <div className="grid grid-cols-2 gap-1">
            {(
              [
                { key: 'dark', label: 'Oscuro', icon: Moon },
                { key: 'light', label: 'Claro', icon: Sun },
              ] as { key: ThemePreference; label: string; icon: typeof Moon }[]
            ).map((option) => {
              const Icon = option.icon;
              const active = preference === option.key;
              return (
                <button
                  key={option.key}
                  onClick={() => setPreference(option.key)}
                  aria-pressed={active}
                  className={cn(
                    'flex flex-col items-center gap-2 rounded-[var(--radius-md)] py-3 text-xs font-medium transition-colors',
                    active
                      ? 'bg-[var(--accent-muted)] text-[var(--accent-text)]'
                      : 'text-[var(--text-tertiary)] hover:bg-[var(--surface-interactive)]',
                  )}
                >
                  <Icon className="size-4.5" strokeWidth={2} />
                  {option.label}
                </button>
              );
            })}
          </div>
        </Card>

        {/*
          Silenciar a Taku tiene que estar a la vista, no escondido en un menú.
          Un acompañante del que no se puede escapar deja de ser compañía, y en
          una partida larga puede que alguien no quiera que nadie comente sus
          tiradas. Sigue en la esquina para abrir la ayuda: lo que se apaga son
          las intervenciones, no el acceso.
        */}
        <label className="mt-2 flex cursor-pointer items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-3.5">
          <TakuSprite mood={takuMuted ? 'idle' : 'greet'} size={40} />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium">Taku comenta la partida</span>
            <span className="block text-xs text-[var(--text-tertiary)]">
              Avisa de los críticos, de las salvaciones contra muerte y de lo que se olvida.
            </span>
          </span>
          <input
            type="checkbox"
            checked={!takuMuted}
            onChange={(e) => setTakuMuted(!e.target.checked)}
            className="size-5 shrink-0 accent-[var(--accent)]"
          />
        </label>
      </section>

      <section>
        <SectionTitle>Estado</SectionTitle>
        <Card className="divide-y divide-[var(--border-subtle)]">
          <Row
            icon={<Wifi className="size-4" />}
            label="Conexión"
            value={online ? 'En línea' : 'Sin conexión'}
            tone={online ? 'success' : 'warning'}
          />
          {/*
            Sin cuenta la cola no está "sin sincronizar": está guardada y
            esperando a que haya dónde subirla. Llamarla pendiente sugiere un
            problema que no existe.
          */}
          <Row
            icon={<Database className="size-4" />}
            label={syncing ? 'Cambios sin sincronizar' : 'Cambios guardados acá'}
            value={String(pending)}
            tone={syncing && pending > 0 ? 'warning' : 'neutral'}
          />
          {storage && (
            <Row
              icon={<Database className="size-4" />}
              label="Espacio usado"
              value={`${(storage.usage / 1024 / 1024).toFixed(1)} MB`}
              tone="neutral"
            />
          )}
        </Card>
      </section>

      {/*
        Atribución obligatoria de CC-BY-4.0. Tiene que estar EN la aplicación,
        no solo en el repositorio.
      */}
      <section>
        <SectionTitle>{t('settings.language')}</SectionTitle>
        <Card className="p-4">
          <div className="flex gap-2">
            {SUPPORTED_LOCALES.map((option) => (
              <button
                key={option}
                onClick={() => setLocale(option)}
                aria-pressed={locale === option}
                className={cn(
                  'flex flex-1 items-center justify-center gap-2 rounded-[var(--radius-md)] border px-3 py-2.5 text-sm font-medium transition-colors',
                  locale === option
                    ? 'border-[var(--accent)] bg-[var(--accent-muted)] text-[var(--accent-text)]'
                    : 'border-[var(--border-default)] text-[var(--text-secondary)]',
                )}
              >
                <Languages className="size-4" strokeWidth={2} />
                {LOCALE_LABELS[option]}
              </button>
            ))}
          </div>
          {/*
            Honestidad sobre el alcance: cambiar el idioma cambia los textos del
            SISTEMA de inmediato. El copy de cada pantalla sigue en español y el
            contenido del SRD tiene su propia traducción, con su propio avance.
          */}
          <p className="mt-3 text-xs leading-relaxed text-[var(--text-tertiary)]">
            {t('settings.languageHint')}
          </p>
        </Card>
      </section>

      <DiagnosticsSection />

      <TranslationCoverageCard />

      <section>
        <SectionTitle>Contenido y licencias</SectionTitle>
        <Card className="space-y-3 p-4">
          <div className="flex items-start gap-2.5">
            <Info className="mt-0.5 size-4 shrink-0 text-[var(--text-tertiary)]" />
            <div className="space-y-2 text-xs leading-relaxed text-[var(--text-tertiary)]">
              <p>
                Esta aplicación incluye material del System Reference Document 5.1 (&quot;SRD 5.1&quot;) y
                del System Reference Document 5.2 (&quot;SRD 5.2&quot;) de Wizards of the Coast LLC,
                disponibles bajo la licencia Creative Commons Attribution 4.0 International.
              </p>
              <p>
                TAKU D&amp;D no está afiliada ni respaldada por Wizards of the Coast. El contenido
                comercial de D&amp;D que no forma parte del SRD no se distribuye con la aplicación:
                podés crearlo como Homebrew o importarlo si tenés derecho a usarlo.
              </p>
            </div>
          </div>
        </Card>
      </section>
    </div>
  );
}

function Row({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: 'neutral' | 'success' | 'warning';
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className="text-[var(--text-tertiary)]">{icon}</span>
      <span className="flex-1 text-sm">{label}</span>
      <Chip tone={tone}>{value}</Chip>
    </div>
  );
}
