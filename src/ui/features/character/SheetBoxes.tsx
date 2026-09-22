'use client';

import type { CharacterSheet } from '@domain/character/sheet';
import { proficiencyEs, sizeEs } from '@domain/content/labels';
import { languagesEs } from '@domain/content/fields';
import { Card, Chip, SectionTitle } from '@ui/design-system/primitives';

/**
 * LAS CASILLAS QUE TIENE LA HOJA OFICIAL Y LA FICHA NO MOSTRABA
 *
 * Bonificador por competencia, tamaño, percepción pasiva, competencias con
 * equipo e idiomas. Los cinco estaban en `CharacterSheet` —el motor los
 * calcula— y solo aparecían en el creador de personaje o en ninguna parte.
 *
 * La forma imita la de la hoja de 2024: casillas con el título en versalitas
 * arriba y el número grande debajo, porque es lo que alguien que viene del
 * papel espera encontrar en el mismo sitio.
 */

export function HeaderBoxes({ sheet }: { sheet: CharacterSheet }) {
  const casillas = [
    { label: 'Competencia', value: `+${sheet.proficiencyBonus}` },
    { label: 'Iniciativa', value: formatSigned(sheet.initiative.value) },
    { label: 'Velocidad', value: `${sheet.speed.value}` },
    { label: 'Tamaño', value: sizeEs(sheet.size) },
    { label: 'Percep. pasiva', value: `${sheet.passivePerception}` },
  ];

  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
      {casillas.map((c) => (
        <div key={c.label} className="surface-card px-3 py-3.5 text-center">
          <p className="text-2xs uppercase tracking-[0.1em] text-[var(--text-tertiary)]">
            {c.label}
          </p>
          <p className="text-numeric mt-1.5 font-display text-2xl font-bold leading-none">
            {c.value}
          </p>
        </div>
      ))}
    </div>
  );
}

const formatSigned = (n: number) => (n >= 0 ? `+${n}` : `${n}`);

/** Las cuatro filas del recuadro «Entrenamiento y competencias con equipo». */
export function ProficienciesBlock({ sheet }: { sheet: CharacterSheet }) {
  const { armor, weapons, tools, languages } = sheet.proficiencies;

  /*
    Sin deduplicar, el pícaro saca dos veces «Herramientas de ladrón»: el
    volcado trae `thieves-tools` y `tool-thieves-tools`, que son lo mismo y
    traducen igual. Se unen DESPUÉS de traducir, que es donde se ve que
    chocan.
  */
  const competencias = (valores: readonly string[]) => [
    ...new Set(valores.map((v) => proficiencyEs(v))),
  ];

  const filas: { label: string; valores: readonly string[] }[] = [
    { label: 'Armaduras', valores: competencias(armor) },
    { label: 'Armas', valores: competencias(weapons) },
    { label: 'Herramientas', valores: competencias(tools) },
    // El idioma es el único que la hoja oficial pone en su propio recuadro,
    // pero viene de la misma fuente y separarlo obligaría a dos consultas.
    { label: 'Idiomas', valores: languages.map((l) => languagesEs(l)) },
  ];

  if (filas.every((f) => f.valores.length === 0)) return null;

  return (
    <section>
      <SectionTitle>Entrenamiento y competencias</SectionTitle>
      <Card className="divide-y divide-[var(--border-subtle)] p-0">
        {filas.map((fila) => (
          <div key={fila.label} className="px-3.5 py-3">
            <p className="text-2xs uppercase tracking-[0.1em] text-[var(--text-tertiary)]">
              {fila.label}
            </p>
            {fila.valores.length === 0 ? (
              <p className="mt-1 text-sm text-[var(--text-tertiary)]">Ninguna</p>
            ) : (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {fila.valores.map((v) => (
                  <Chip key={v} tone="neutral">
                    {v}
                  </Chip>
                ))}
              </div>
            )}
          </div>
        ))}
      </Card>
    </section>
  );
}
