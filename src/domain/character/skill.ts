import type { AbilityId } from './ability';

/** Las 18 habilidades de 5e y la caracteristica de la que dependen. */
export const SKILLS = [
  'acrobatics', 'animal-handling', 'arcana', 'athletics', 'deception',
  'history', 'insight', 'intimidation', 'investigation', 'medicine',
  'nature', 'perception', 'performance', 'persuasion', 'religion',
  'sleight-of-hand', 'stealth', 'survival',
] as const;

export type SkillId = (typeof SKILLS)[number];

export const SKILL_ABILITY: Record<SkillId, AbilityId> = {
  acrobatics: 'dex',
  'animal-handling': 'wis',
  arcana: 'int',
  athletics: 'str',
  deception: 'cha',
  history: 'int',
  insight: 'wis',
  intimidation: 'cha',
  investigation: 'int',
  medicine: 'wis',
  nature: 'int',
  perception: 'wis',
  performance: 'cha',
  persuasion: 'cha',
  religion: 'int',
  'sleight-of-hand': 'dex',
  stealth: 'dex',
  survival: 'wis',
};

export const SKILL_NAME_ES: Record<SkillId, string> = {
  acrobatics: 'Acrobacias',
  'animal-handling': 'Trato con animales',
  arcana: 'Arcanos',
  athletics: 'Atletismo',
  deception: 'Engaño',
  history: 'Historia',
  insight: 'Perspicacia',
  intimidation: 'Intimidación',
  investigation: 'Investigación',
  medicine: 'Medicina',
  nature: 'Naturaleza',
  perception: 'Percepción',
  performance: 'Interpretación',
  persuasion: 'Persuasión',
  religion: 'Religión',
  'sleight-of-hand': 'Juego de manos',
  stealth: 'Sigilo',
  survival: 'Supervivencia',
};

export function isSkillId(v: string): v is SkillId {
  return (SKILLS as readonly string[]).includes(v);
}

/** El SRD identifica las habilidades como `skill-athletics`. */
export function skillFromSrdIndex(index: string): SkillId | null {
  const slug = index.startsWith('skill-') ? index.slice('skill-'.length) : index;
  return isSkillId(slug) ? slug : null;
}

/**
 * Grado de competencia.
 *   none      — solo el modificador de caracteristica
 *   half      — media competencia, redondeada hacia abajo (Bardo: Aprendiz de todo)
 *   proficient— competencia completa
 *   expertise — el doble (Picaro: Pericia)
 */
export type ProficiencyLevel = 'none' | 'half' | 'proficient' | 'expertise';

export const PROFICIENCY_MULTIPLIER: Record<ProficiencyLevel, number> = {
  none: 0,
  half: 0.5,
  proficient: 1,
  expertise: 2,
};

export function proficiencyContribution(level: ProficiencyLevel, profBonus: number): number {
  return Math.floor(profBonus * PROFICIENCY_MULTIPLIER[level]);
}
