import type { DefinitionId } from '../shared/ids';
import type { Ruleset } from '../rules/ruleset';
import type {
  AnyDefinition,
  ArmorDefinition,
  BackgroundDefinition,
  ClassDefinition,
  ConditionDefinition,
  ContentSource,
  ContentType,
  FeatDefinition,
  FeatureDefinition,
  GearDefinition,
  ItemDefinition,
  MagicItemDefinition,
  SpeciesDefinition,
  SpellDefinition,
  SubclassDefinition,
  SubspeciesDefinition,
  TraitDefinition,
  WeaponDefinition,
} from './schemas';
import { isItemDefinition } from './schemas';

export * from './schemas';

/**
 * INDICE DE CONTENIDO
 *
 * Vista de solo lectura sobre todo el contenido activo para un ruleset.
 * El motor de personaje lo recibe como entrada y NUNCA lo modifica: las
 * definiciones son inmutables (MASTER PROMPT §77).
 */
export class ContentIndex {
  private readonly byId = new Map<string, AnyDefinition>();
  private readonly byType = new Map<ContentType, AnyDefinition[]>();
  private readonly sources = new Map<string, ContentSource>();

  constructor(definitions: readonly AnyDefinition[] = [], sources: readonly ContentSource[] = []) {
    for (const s of sources) this.sources.set(s.id, s);
    for (const d of definitions) this.add(d);
  }

  add(d: AnyDefinition): void {
    this.byId.set(d.id, d);
    const list = this.byType.get(d.type as ContentType);
    if (list) list.push(d);
    else this.byType.set(d.type as ContentType, [d]);
  }

  addSource(s: ContentSource): void {
    this.sources.set(s.id, s);
  }

  get size(): number {
    return this.byId.size;
  }

  has(id: DefinitionId | string): boolean {
    return this.byId.has(id);
  }

  get(id: DefinitionId | string | undefined | null): AnyDefinition | undefined {
    if (!id) return undefined;
    return this.byId.get(id);
  }

  /** Todas las definiciones, sin filtrar. Lo usa la medida de cobertura. */
  allDefinitions(): readonly AnyDefinition[] {
    return [...this.byId.values()];
  }

  all(type: ContentType): readonly AnyDefinition[] {
    return this.byType.get(type) ?? [];
  }

  /** Fuente de una definicion, para mostrar la atribucion obligatoria. */
  sourceOf(d: AnyDefinition): ContentSource | undefined {
    return this.sources.get(d.sourceId);
  }

  allSources(): readonly ContentSource[] {
    return [...this.sources.values()];
  }

  // ── Accesores tipados ──────────────────────────────────────────────────────

  private typed<T extends AnyDefinition>(id: DefinitionId | string | undefined, type: ContentType): T | undefined {
    const d = this.get(id);
    return d?.type === type ? (d as T) : undefined;
  }

  class(id?: DefinitionId | string) { return this.typed<ClassDefinition>(id, 'class'); }
  subclass(id?: DefinitionId | string) { return this.typed<SubclassDefinition>(id, 'subclass'); }
  species(id?: DefinitionId | string) { return this.typed<SpeciesDefinition>(id, 'species'); }
  subspecies(id?: DefinitionId | string) { return this.typed<SubspeciesDefinition>(id, 'subspecies'); }
  background(id?: DefinitionId | string) { return this.typed<BackgroundDefinition>(id, 'background'); }
  feat(id?: DefinitionId | string) { return this.typed<FeatDefinition>(id, 'feat'); }
  feature(id?: DefinitionId | string) { return this.typed<FeatureDefinition>(id, 'feature'); }
  trait(id?: DefinitionId | string) { return this.typed<TraitDefinition>(id, 'trait'); }
  spell(id?: DefinitionId | string) { return this.typed<SpellDefinition>(id, 'spell'); }
  weapon(id?: DefinitionId | string) { return this.typed<WeaponDefinition>(id, 'weapon'); }
  armor(id?: DefinitionId | string) { return this.typed<ArmorDefinition>(id, 'armor'); }
  gear(id?: DefinitionId | string) { return this.typed<GearDefinition>(id, 'gear'); }
  magicItem(id?: DefinitionId | string) { return this.typed<MagicItemDefinition>(id, 'magicItem'); }
  condition(id?: DefinitionId | string) { return this.typed<ConditionDefinition>(id, 'condition'); }

  /** Cualquier cosa que pueda estar en el inventario. */
  item(id?: DefinitionId | string): ItemDefinition | undefined {
    const d = this.get(id);
    return d && isItemDefinition(d) ? d : undefined;
  }

  classes(): readonly ClassDefinition[] { return this.all('class') as ClassDefinition[]; }
  speciesList(): readonly SpeciesDefinition[] { return this.all('species') as SpeciesDefinition[]; }
  backgrounds(): readonly BackgroundDefinition[] { return this.all('background') as BackgroundDefinition[]; }
  spells(): readonly SpellDefinition[] { return this.all('spell') as SpellDefinition[]; }
  conditions(): readonly ConditionDefinition[] { return this.all('condition') as ConditionDefinition[]; }
  magicItems(): readonly MagicItemDefinition[] { return this.all('magicItem') as MagicItemDefinition[]; }

  /** Subclases de una clase concreta. */
  subclassesOf(classId: DefinitionId | string): readonly SubclassDefinition[] {
    return (this.all('subclass') as SubclassDefinition[]).filter((s) => s.classId === classId);
  }

  subspeciesOf(speciesId: DefinitionId | string): readonly SubspeciesDefinition[] {
    return (this.all('subspecies') as SubspeciesDefinition[]).filter((s) => s.speciesId === speciesId);
  }

  /** Conjuros disponibles para una clase (por el slug de la clase, como en el SRD). */
  spellsForClass(classSlug: string): readonly SpellDefinition[] {
    return this.spells().filter((s) => s.classes.includes(classSlug));
  }

  /** Solo lo compatible con el ruleset. Nunca se mezclan ediciones en silencio. */
  compatibleWith(ruleset: Ruleset): ContentIndex {
    const filtered = [...this.byId.values()].filter((d) => d.rulesets.includes(ruleset));
    return new ContentIndex(filtered, [...this.sources.values()]);
  }
}

export const emptyContentIndex = (): ContentIndex => new ContentIndex();
