import type { AnyDefinition, ContentIndex, ContentType } from '../content';
import type { CompatibilityOption, CompatibilityReport, Ruleset } from './ruleset';
import { checkCompatibility } from './ruleset';

/**
 * COMPATIBILIDAD ENTRE EDICIONES (MASTER SPEC §4)
 *
 * La regla del producto es "NUNCA MEZCLAR EN SILENCIO", no "nunca mezclar".
 * Una mesa puede querer un objeto de 2024 en una partida de 2014 y está en su
 * derecho; lo que no puede pasar es que ocurra sin que nadie se entere.
 *
 * `checkCompatibility` (en ruleset.ts) dice SI encaja. Esto añade lo que hace
 * falta para que el usuario pueda decidir: qué alternativa hay en su edición.
 */

export type CompatibilityDecision = {
  readonly report: CompatibilityReport;
  readonly definition: AnyDefinition;
  /** Equivalente en la edición del personaje, si existe. */
  readonly alternative?: AnyDefinition;
};

/**
 * Busca el equivalente en la edición de destino.
 *
 * Se compara por NOMBRE, no por id: las dos ediciones numeran distinto pero
 * "Fireball" sigue llamándose "Fireball". Es una heurística y se presenta como
 * tal —"quizá quisiste decir"—, nunca como una sustitución automática.
 */
export function findAlternative(
  definition: AnyDefinition,
  target: ContentIndex,
): AnyDefinition | undefined {
  const wanted = definition.name.trim().toLowerCase();
  const sameType = target.all(definition.type as ContentType);

  const exact = sameType.find((d) => d.name.trim().toLowerCase() === wanted);
  if (exact) return exact;

  // Segundo intento: la otra edición renombra algunas cosas ("Race" → "Species",
  // "Hit Dice" → "Hit Point Dice"). Un prefijo común basta para sugerir.
  return sameType.find(
    (d) =>
      d.name.toLowerCase().startsWith(wanted.slice(0, Math.max(4, wanted.length - 4))) ||
      wanted.startsWith(d.name.toLowerCase().slice(0, Math.max(4, d.name.length - 4))),
  );
}

/** Todo lo que la interfaz necesita para plantear la decisión. */
export function decideCompatibility(
  definition: AnyDefinition,
  target: Ruleset,
  targetContent: ContentIndex,
): CompatibilityDecision {
  const report = checkCompatibility(definition.rulesets, target);
  if (report.verdict === 'compatible') return { report, definition };

  const alternative = findAlternative(definition, targetContent);
  return {
    report: alternative
      ? report
      : // Sin equivalente, ofrecer "buscar alternativa" sería una promesa vacía.
        { ...report, options: report.options.filter((o) => o !== 'findAlternative') },
    definition,
    ...(alternative ? { alternative } : {}),
  };
}

/** Texto de cada opción, en el orden en que debe ofrecerse. */
export const COMPATIBILITY_OPTION_ORDER: readonly CompatibilityOption[] = [
  'findAlternative',
  'useAnyway',
  'cancel',
];
