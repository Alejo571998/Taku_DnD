'use client';

import { Pencil } from 'lucide-react';
import { useState } from 'react';
import type { AppearanceState, PersonalityState } from '@domain/character/state';
import type { CharacterSheet } from '@domain/character/sheet';
import { Card, PanelTitle, SectionTitle } from '@ui/design-system/primitives';
import { Button } from '@ui/design-system/Button';
import { Sheet } from '@ui/design-system/Sheet';
import type { DispatchFn } from '@ui/hooks/useAppData';

/**
 * ASPECTO, HISTORIA Y PERSONALIDAD, ALINEAMIENTO
 *
 * Los tres recuadros de la segunda página de la hoja oficial. Estaban en el
 * estado persistido y se preguntaban en el creador, pero NINGUNA pantalla los
 * mostraba después: se escribían una vez y desaparecían. `UpdateIdentity`
 * existía como comando y no se despachaba desde ningún sitio.
 *
 * Se muestran y se editan aquí, con el mismo orden y los mismos rótulos que el
 * papel, para que quien viene de la hoja encuentre las cosas donde las dejó.
 */

const CAMPOS_ASPECTO: { key: keyof AppearanceState; label: string }[] = [
  { key: 'age', label: 'Edad' },
  { key: 'height', label: 'Altura' },
  { key: 'weight', label: 'Peso' },
  { key: 'eyes', label: 'Ojos' },
  { key: 'skin', label: 'Piel' },
  { key: 'hair', label: 'Pelo' },
];

const CAMPOS_PERSONALIDAD: { key: keyof PersonalityState; label: string }[] = [
  { key: 'traits', label: 'Rasgos de personalidad' },
  { key: 'ideals', label: 'Ideales' },
  { key: 'bonds', label: 'Vínculos' },
  { key: 'flaws', label: 'Defectos' },
];

export function IdentityBlock({
  sheet,
  dispatch,
}: {
  sheet: CharacterSheet;
  dispatch: DispatchFn;
}) {
  const [editando, setEditando] = useState(false);
  const { appearance, personality, backstory, alignment } = sheet.state;

  const rasgosFisicos = CAMPOS_ASPECTO.filter((c) => appearance[c.key]);
  const rasgosPersonales = CAMPOS_PERSONALIDAD.filter((c) => personality[c.key].length > 0);
  const vacio =
    rasgosFisicos.length === 0 &&
    rasgosPersonales.length === 0 &&
    !appearance.description &&
    !backstory &&
    !alignment;

  return (
    <section>
      <div className="flex items-center justify-between">
        <SectionTitle>Personaje</SectionTitle>
        <button
          onClick={() => setEditando(true)}
          className="flex items-center gap-1.5 text-xs text-[var(--text-tertiary)] transition-colors hover:text-[var(--text-primary)]"
        >
          <Pencil className="size-3.5" />
          Editar
        </button>
      </div>

      <Card className="space-y-4 p-3.5">
        {vacio ? (
          <p className="text-sm text-[var(--text-tertiary)]">
            Todavía no escribiste nada de tu personaje. Tocá «Editar» para el aspecto, la historia y
            el alineamiento.
          </p>
        ) : (
          <>
            {(rasgosFisicos.length > 0 || appearance.description) && (
              <Bloque titulo="Aspecto">
                {rasgosFisicos.length > 0 && (
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3">
                    {rasgosFisicos.map((c) => (
                      <div key={c.key}>
                        <dt className="text-2xs uppercase tracking-[0.1em] text-[var(--text-tertiary)]">
                          {c.label}
                        </dt>
                        <dd className="text-sm">{appearance[c.key]}</dd>
                      </div>
                    ))}
                  </dl>
                )}
                {appearance.description && (
                  <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
                    {appearance.description}
                  </p>
                )}
              </Bloque>
            )}

            {(rasgosPersonales.length > 0 || backstory || alignment) && (
              <Bloque titulo="Historia y personalidad">
                {rasgosPersonales.map((c) => (
                  <div key={c.key}>
                    <p className="text-2xs uppercase tracking-[0.1em] text-[var(--text-tertiary)]">
                      {c.label}
                    </p>
                    <ul className="mt-0.5 space-y-0.5">
                      {personality[c.key].map((v, i) => (
                        <li key={i} className="text-sm text-[var(--text-secondary)]">
                          {v}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
                {backstory && (
                  <p className="whitespace-pre-line text-sm leading-relaxed text-[var(--text-secondary)]">
                    {backstory}
                  </p>
                )}
                {alignment && (
                  <p className="text-sm">
                    <span className="text-2xs uppercase tracking-[0.1em] text-[var(--text-tertiary)]">
                      Alineamiento{' '}
                    </span>
                    {alignment}
                  </p>
                )}
              </Bloque>
            )}
          </>
        )}
      </Card>

      {editando && (
        <EditarSheet sheet={sheet} dispatch={dispatch} onClose={() => setEditando(false)} />
      )}
    </section>
  );
}

function Bloque({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      {/* `h3` porque la tarjeta entera ya cuelga del `SectionTitle` «Personaje». */}
      <PanelTitle level={3}>{titulo}</PanelTitle>
      {children}
    </div>
  );
}

function EditarSheet({
  sheet,
  dispatch,
  onClose,
}: {
  sheet: CharacterSheet;
  dispatch: DispatchFn;
  onClose: () => void;
}) {
  const { appearance, personality, backstory, alignment } = sheet.state;

  const [aspecto, setAspecto] = useState<AppearanceState>(appearance);
  // Las listas se editan como texto, una por línea: es lo que hace el papel.
  const [personal, setPersonal] = useState<Record<string, string>>(
    Object.fromEntries(CAMPOS_PERSONALIDAD.map((c) => [c.key, personality[c.key].join('\n')])),
  );
  const [historia, setHistoria] = useState(backstory);
  const [alineamiento, setAlineamiento] = useState(alignment ?? '');

  const guardar = () => {
    const lineas = (v: string) =>
      v
        .split('\n')
        .map((x) => x.trim())
        .filter((x) => x.length > 0);

    void dispatch({
      type: 'UpdateIdentity',
      patch: {
        appearance: aspecto,
        personality: Object.fromEntries(
          CAMPOS_PERSONALIDAD.map((c) => [c.key, lineas(personal[c.key] ?? '')]),
        ) as unknown as PersonalityState,
        backstory: historia,
        alignment: alineamiento.trim(),
      },
    });
    onClose();
  };

  const input =
    'h-11 w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-sunken)] px-3.5 text-sm outline-none focus:border-[var(--accent)]';
  const area =
    'w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-sunken)] p-3.5 text-sm leading-relaxed outline-none focus:border-[var(--accent)]';

  return (
    <Sheet open onOpenChange={(v) => !v && onClose()} title="Tu personaje" size="lg">
      <p className="text-2xs font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
        Aspecto
      </p>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {CAMPOS_ASPECTO.map((c) => (
          <label key={c.key} className="block">
            <span className="text-2xs text-[var(--text-tertiary)]">{c.label}</span>
            <input
              value={aspecto[c.key] ?? ''}
              onChange={(e) => setAspecto({ ...aspecto, [c.key]: e.target.value })}
              className={input}
            />
          </label>
        ))}
      </div>

      <textarea
        value={aspecto.description ?? ''}
        onChange={(e) => setAspecto({ ...aspecto, description: e.target.value })}
        rows={3}
        placeholder="Cómo se ve, cómo se mueve, qué lleva puesto…"
        aria-label="Descripción del aspecto"
        className={`mt-2 ${area}`}
      />

      <p className="mt-5 text-2xs font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
        Historia y personalidad
      </p>
      <div className="mt-2 space-y-2">
        {CAMPOS_PERSONALIDAD.map((c) => (
          <label key={c.key} className="block">
            <span className="text-2xs text-[var(--text-tertiary)]">{c.label} — uno por línea</span>
            <textarea
              value={personal[c.key] ?? ''}
              onChange={(e) => setPersonal({ ...personal, [c.key]: e.target.value })}
              rows={2}
              className={area}
            />
          </label>
        ))}
      </div>

      <textarea
        value={historia}
        onChange={(e) => setHistoria(e.target.value)}
        rows={6}
        placeholder="De dónde viene, qué lo trajo hasta acá…"
        aria-label="Historia"
        className={`mt-2 ${area}`}
      />

      <label className="mt-3 block">
        <span className="text-2xs text-[var(--text-tertiary)]">Alineamiento</span>
        <input
          value={alineamiento}
          onChange={(e) => setAlineamiento(e.target.value)}
          placeholder="Neutral bueno"
          className={input}
        />
      </label>

      <div className="mt-5 flex gap-2.5">
        <Button variant="primary" onClick={guardar} className="flex-1">
          Guardar
        </Button>
        <Button variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
      </div>
    </Sheet>
  );
}
