'use client';

import {
  BookOpen,
  Boxes,
  Coins,
  Crown,
  Flame,
  Ghost,
  Languages,
  Scroll,
  Shield,
  Sparkles,
  Swords,
  User,
  Wand2,
} from 'lucide-react';
import type { AnyDefinition } from '@domain/content/schemas';
import type { TranslationStatus } from '@domain/content/translation';
import {
  armorCategoryEs,
  damageTypeEs,
  magicSchoolEs,
  rarityEs,
  sizeEs,
  weaponCategoryEs,
  weaponMasteryEs,
  weaponPropertyEs,
  chargeRecoveryEs,
  coinEs,
  creatureTypeEs,
} from '@domain/content/labels';
import { ABILITY_ABBR_ES } from '@domain/character/ability';
import { languagesEs, saveAbilityEs, spellFieldEs } from '@domain/content/fields';
import { formatWeight, weightFromHundredths } from '@domain/shared/units';
import { Chip } from '@ui/design-system/primitives';
import { AddToCharacterButton } from './AddToCharacter';
import { SrdText } from './SrdText';

export const TYPE_LABEL: Record<string, string> = {
  spell: 'Hechizo',
  weapon: 'Arma',
  armor: 'Armadura',
  gear: 'Objeto',
  magicItem: 'Objeto mágico',
  class: 'Clase',
  subclass: 'Subclase',
  species: 'Especie',
  subspecies: 'Linaje',
  background: 'Trasfondo',
  feat: 'Dote',
  // Los dos eran "Rasgo". En una ficha se entiende por el contexto; en la lista
  // de cobertura por tipo aparecían dos filas con la misma etiqueta y números
  // distintos, y no había forma de saber cuál era cuál.
  feature: 'Rasgo de clase',
  trait: 'Rasgo de especie',
  condition: 'Condición',
  skill: 'Habilidad',
  language: 'Idioma',
  rule: 'Regla',
  monster: 'Criatura',
};

const TYPE_ICONS: Record<string, typeof Sparkles> = {
  spell: Sparkles,
  weapon: Swords,
  armor: Shield,
  gear: Boxes,
  magicItem: Wand2,
  class: Crown,
  subclass: Crown,
  species: User,
  subspecies: User,
  background: Scroll,
  feat: Flame,
  feature: Flame,
  trait: Flame,
  condition: Ghost,
  skill: BookOpen,
  language: BookOpen,
  rule: BookOpen,
  monster: Ghost,
};

/** Icono en cuadrado redondeado con halo, como en la dirección artística. */
export function TypeIcon({ type }: { type: string }) {
  const Icon = TYPE_ICONS[type] ?? BookOpen;
  return (
    <span className="flex size-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--accent-muted)]">
      <Icon className="size-4.5 text-[var(--accent-text)]" strokeWidth={2} />
    </span>
  );
}

/**
 * Ficha de contenido.
 *
 * Muestra SIEMPRE la atribución de la fuente: es una obligación de la
 * licencia CC-BY, no un detalle opcional, y tiene que verse en la aplicación
 * y no solo en el repositorio.
 */
export function DefinitionDetail({
  definition,
}: {
  definition: AnyDefinition & { translation?: TranslationStatus };
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Chip tone="accent">{TYPE_LABEL[definition.type] ?? definition.type}</Chip>
        {definition.rulesets.map((r) => (
          <Chip key={r} tone="neutral">
            {r}
          </Chip>
        ))}
      </div>

      <AddToCharacterButton definition={definition} />

      <SpecificDetails definition={definition} />

      {definition.description.length > 0 && <SrdText paragraphs={definition.description} />}

      {/*
        Honestidad sobre la traduccion (MASTER SPEC §37).
        El SRD esta en ingles y traducirlo entero lleva meses. Lo que esta
        traducido se ve traducido; lo que no, se dice — esconderlo haria que el
        usuario creyera que el texto en ingles es un error de la aplicacion.
      */}
      {definition.translation !== undefined && definition.translation !== 'full' && (
        <p className="flex items-start gap-2 rounded-[var(--radius-md)] bg-[var(--surface-sunken)] px-3 py-2 text-xs text-[var(--text-tertiary)]">
          <Languages className="mt-0.5 size-3.5 shrink-0" />
          {definition.translation === 'partial'
            ? 'El nombre está traducido; el texto sigue en inglés, tal como viene del SRD.'
            : 'Esta entrada todavía no está traducida: se muestra en inglés, tal como viene del SRD.'}
        </p>
      )}

      <footer className="border-t border-[var(--border-subtle)] pt-3">
        <p className="text-2xs leading-relaxed text-[var(--text-tertiary)]">
          Fuente: {definition.sourceId === 'srd-5.1' ? 'SRD 5.1' : definition.sourceId === 'srd-5.2' ? 'SRD 5.2' : definition.sourceId}
          {' · '}
          Contenido bajo licencia Creative Commons Attribution 4.0 de Wizards of the Coast LLC.
        </p>
      </footer>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <span className="text-xs text-[var(--text-tertiary)]">{label}</span>
      <span className="text-right text-sm">{value}</span>
    </div>
  );
}

/** Un apartado del bloque de estadísticas: «Ataque múltiple. El dragón hace…». */
function StatBlock({
  title,
  blocks,
}: {
  title: string;
  blocks: readonly { name: string; desc: string }[];
}) {
  if (blocks.length === 0) return null;
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium">{title}</p>
      <div className="space-y-2">
        {blocks.map((b, i) => (
          <p key={i} className="text-sm text-[var(--text-secondary)]">
            <span className="font-medium text-[var(--text-primary)]">{b.name}.</span> {b.desc}
          </p>
        ))}
      </div>
    </div>
  );
}

function SpecificDetails({ definition }: { definition: AnyDefinition }) {
  switch (definition.type) {
    case 'spell':
      return (
        <div className="divide-y divide-[var(--border-subtle)] rounded-[var(--radius-md)] border border-[var(--border-subtle)] px-3.5 py-1">
          <Row label="Nivel" value={definition.level === 0 ? 'Truco' : `${definition.level}`} />
          <Row label="Escuela" value={magicSchoolEs(definition.school)} />
          <Row label="Tiempo de lanzamiento" value={spellFieldEs(definition.castingTime)} />
          <Row label="Alcance" value={spellFieldEs(definition.range)} />
          <Row label="Componentes" value={definition.components.join(', ') + (definition.material ? ` (${definition.material})` : '')} />
          <Row label="Duración" value={spellFieldEs(definition.duration)} />
          {definition.concentration && <Row label="Concentración" value="Sí" />}
          {definition.ritual && <Row label="Ritual" value="Sí" />}
          {definition.save && <Row label="Salvación" value={saveAbilityEs(definition.save.ability)} />}
        </div>
      );

    case 'weapon':
      return (
        <div className="divide-y divide-[var(--border-subtle)] rounded-[var(--radius-md)] border border-[var(--border-subtle)] px-3.5 py-1">
          <Row label="Categoría" value={weaponCategoryEs(definition.category)} />
          <Row label="Tipo" value={definition.rangeType === 'ranged' ? 'A distancia' : 'Cuerpo a cuerpo'} />
          {definition.damage && (
            <Row label="Daño" value={`${definition.damage.dice} ${damageTypeEs(definition.damage.damageType)}`} />
          )}
          {definition.twoHandedDamage && (
            <Row label="A dos manos" value={`${definition.twoHandedDamage.dice} ${damageTypeEs(definition.twoHandedDamage.damageType)}`} />
          )}
          {definition.properties.length > 0 && (
            <Row label="Propiedades" value={definition.properties.map(weaponPropertyEs).join(', ')} />
          )}
          <Row label="Peso" value={formatWeight(weightFromHundredths(definition.weight))} />
          {definition.cost && <Row label="Precio" value={`${definition.cost.quantity} ${coinEs(definition.cost.unit)}`} />}
          {definition.mastery && <Row label="Maestría" value={weaponMasteryEs(definition.mastery)} />}
        </div>
      );

    case 'armor':
      return (
        <div className="divide-y divide-[var(--border-subtle)] rounded-[var(--radius-md)] border border-[var(--border-subtle)] px-3.5 py-1">
          <Row label="Categoría" value={armorCategoryEs(definition.category)} />
          <Row
            label="Clase de armadura"
            value={
              definition.baseAc +
              (definition.addsDexBonus
                ? definition.maxDexBonus != null
                  ? ` + DES (máx. ${definition.maxDexBonus})`
                  : ' + DES'
                : '')
            }
          />
          {definition.strMinimum > 0 && <Row label="Fuerza mínima" value={String(definition.strMinimum)} />}
          {definition.stealthDisadvantage && <Row label="Sigilo" value="Desventaja" />}
          <Row label="Peso" value={formatWeight(weightFromHundredths(definition.weight))} />
          {definition.cost && <Row label="Precio" value={`${definition.cost.quantity} ${coinEs(definition.cost.unit)}`} />}
        </div>
      );

    case 'magicItem':
      return (
        <div className="divide-y divide-[var(--border-subtle)] rounded-[var(--radius-md)] border border-[var(--border-subtle)] px-3.5 py-1">
          <Row label="Rareza" value={rarityEs(definition.rarity)} />
          <Row label="Sintonización" value={definition.requiresAttunement ? 'Requiere' : 'No requiere'} />
          {definition.charges && (
            <Row label="Cargas" value={`${definition.charges.maximum} · recupera al ${chargeRecoveryEs(definition.charges.recovery)}`} />
          )}
        </div>
      );

    case 'monster':
      return (
        <div className="space-y-3">
          <div className="divide-y divide-[var(--border-subtle)] rounded-[var(--radius-md)] border border-[var(--border-subtle)] px-3.5 py-1">
            <Row label="Tipo" value={`${sizeEs(definition.size)} ${creatureTypeEs(definition.creatureType)}`} />
            <Row label="Clase de armadura" value={String(definition.armorClass)} />
            <Row label="Puntos de golpe" value={`${definition.hitPoints} (${definition.hitDice})`} />
            <Row label="Valor de desafío" value={`${definition.challengeRating} (${definition.xp} PX)`} />
            {definition.languages && <Row label="Idiomas" value={languagesEs(definition.languages)} />}
          </div>

          <div className="grid grid-cols-6 gap-1.5">
            {(['str', 'dex', 'con', 'int', 'wis', 'cha'] as const).map((a) => (
              <div key={a} className="rounded-[var(--radius-sm)] border border-[var(--border-subtle)] py-2 text-center">
                <p className="text-2xs text-[var(--text-tertiary)]">{ABILITY_ABBR_ES[a]}</p>
                <p className="text-numeric text-sm font-semibold">{definition.abilities[a]}</p>
              </div>
            ))}
          </div>

          {/*
            Los tres bloques, no solo las acciones. «Resistencia legendaria» y
            «Ataque de ala» son reglas que deciden un combate, y estaban en el
            contenido sin que la ficha las pintara.
          */}
          <StatBlock title="Rasgos" blocks={definition.specialAbilities} />
          <StatBlock title="Acciones" blocks={definition.actions} />
          <StatBlock title="Acciones legendarias" blocks={definition.legendaryActions} />
        </div>
      );

    case 'class':
      return (
        <div className="divide-y divide-[var(--border-subtle)] rounded-[var(--radius-md)] border border-[var(--border-subtle)] px-3.5 py-1">
          <Row label="Dado de golpe" value={`d${definition.hitDie}`} />
          <Row label="Salvaciones" value={definition.savingThrows.map((s) => s.toUpperCase()).join(', ')} />
          {definition.spellcasting && (
            <Row label="Lanzamiento" value={definition.spellcasting.ability.toUpperCase()} />
          )}
          <Row label="Subclase a nivel" value={String(definition.subclassLevel)} />
        </div>
      );

    case 'species':
      return (
        <div className="divide-y divide-[var(--border-subtle)] rounded-[var(--radius-md)] border border-[var(--border-subtle)] px-3.5 py-1">
          <Row label="Tamaño" value={sizeEs(definition.size)} />
          <Row label="Velocidad" value={`${definition.speed} pies`} />
          {definition.abilityBonuses.length > 0 && (
            <Row
              label="Bonificadores"
              value={definition.abilityBonuses.map((b) => `${ABILITY_ABBR_ES[b.ability]} +${b.bonus}`).join(', ')}
            />
          )}
          {definition.languages.length > 0 && (
            <Row label="Idiomas" value={languagesEs(definition.languages.join(', '))} />
          )}
        </div>
      );

    case 'gear':
      return (
        <div className="divide-y divide-[var(--border-subtle)] rounded-[var(--radius-md)] border border-[var(--border-subtle)] px-3.5 py-1">
          <Row label="Categoría" value={definition.category} />
          <Row label="Peso" value={formatWeight(weightFromHundredths(definition.weight))} />
          {definition.packSize > 1 && <Row label="Se vende de a" value={String(definition.packSize)} />}
          {definition.cost && <Row label="Precio" value={`${definition.cost.quantity} ${coinEs(definition.cost.unit)}`} />}
        </div>
      );

    default:
      return null;
  }
}

export { Coins };
