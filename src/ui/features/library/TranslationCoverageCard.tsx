'use client';

import { useMemo } from 'react';
import { Languages } from 'lucide-react';
import { measureCoverage } from '@domain/content/translation';
import { RULESETS } from '@domain/rules/ruleset';
import { Card, ProgressBar, SectionTitle } from '@ui/design-system/primitives';
import { TYPE_LABEL } from './DefinitionDetail';
import { useContentIndex, useTranslationOverlay } from '@ui/hooks/useAppData';

/**
 * COBERTURA DE LA TRADUCCIÓN (MASTER SPEC §37)
 *
 * Decir "aplicación en español" con el 90% del contenido en inglés sería
 * mentir. Esta tarjeta enseña el número real, por tipo, sin maquillarlo.
 *
 * También es el mejor recordatorio de qué falta: la traducción crece
 * añadiendo datos, sin tocar una línea de código.
 */
export function TranslationCoverageCard() {
  const overlay = useTranslationOverlay();
  const index2014 = useContentIndex(RULESETS[0]);
  const index2024 = useContentIndex(RULESETS[1]);

  const coverage = useMemo(() => {
    if (!index2014 || !index2024) return null;
    const all = [
      ...index2014.allDefinitions(),
      ...index2024.allDefinitions(),
    ];
    return measureCoverage(all, overlay);
  }, [index2014, index2024, overlay]);

  if (!coverage || coverage.total === 0) return null;

  /*
    LA BARRA MIDE LO COMPLETO, NO LO EMPEZADO.

    Medir "tiene algo en español" llenaba la barra mientras la mitad de los
    textos seguía en inglés: esa es la mentira que esta tarjeta existe para no
    contar (MASTER PROMPT §75). La barra cuenta lo que no deja NADA en inglés.

    Hoy eso da 100%, pero el texto de abajo se bifurca a propósito: en cuanto
    entre una definición sin traducir —contenido nuevo del SRD— la tarjeta
    vuelve sola a decir cuántas faltan, en vez de seguir cantando victoria.
  */
  const percent = Math.round((coverage.full / coverage.total) * 100);
  const pending = coverage.partial;

  const covered = Object.entries(coverage.byType).sort(
    (a, b) => b[1].full / b[1].total - a[1].full / a[1].total,
  );

  return (
    <section>
      <SectionTitle>Idioma del contenido</SectionTitle>
      <Card className="space-y-3 p-4">
        <div className="flex items-start gap-2.5">
          <Languages className="mt-0.5 size-4 shrink-0 text-[var(--text-tertiary)]" />
          <div className="min-w-0 flex-1">
            <p className="text-sm">
              <span className="text-numeric font-medium">{percent}%</span> del contenido está entero
              en español
            </p>
            <p className="mt-1 text-xs leading-relaxed text-[var(--text-tertiary)]">
              {pending === 0 ? (
                <>
                  No queda nada en inglés: las{' '}
                  <span className="text-numeric">{coverage.total.toLocaleString('es')}</span>{' '}
                  definiciones del SRD tienen nombre y texto en español, en las dos ediciones.
                </>
              ) : (
                <>
                  Todos los nombres están traducidos, así que podés buscar en español. En{' '}
                  <span className="text-numeric">{pending.toLocaleString('es')}</span> entradas el
                  texto sigue en inglés, tal como viene del SRD: se muestra así en vez de
                  esconderlo.
                </>
              )}
            </p>
          </div>
        </div>

        <ProgressBar
          value={coverage.full}
          max={coverage.total}
          tone="accent"
          label="Contenido traducido por completo"
        />

        <ul className="space-y-1">
          {covered.map(([type, v]) => (
            <li key={type} className="flex items-baseline justify-between text-xs">
              <span className="text-[var(--text-tertiary)]">{TYPE_LABEL[type] ?? type}</span>
              <span className="text-numeric">
                {v.full} de {v.total}
              </span>
            </li>
          ))}
        </ul>

        <p className="border-t border-[var(--border-subtle)] pt-3 text-2xs leading-relaxed text-[var(--text-tertiary)]">
          La traducción es propia y se publica bajo la misma licencia Creative Commons Attribution
          4.0 del material original.
        </p>
      </Card>
    </section>
  );
}
