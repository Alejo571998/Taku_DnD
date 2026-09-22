#!/usr/bin/env node
/**
 * CONSTRUCTOR DE CONTENT PACKS
 *
 * Transforma el SRD en bruto (data/srd-raw/) al formato normalizado de la
 * aplicacion y lo escribe en public/content/, desde donde el service worker
 * lo precachea y el cliente lo carga a IndexedDB en el primer arranque.
 *
 * El contenido NO se empaqueta en el bundle de JavaScript: son datos, se
 * sirven como datos.
 *
 *   node scripts/build-content.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RAW = path.join(ROOT, 'data', 'srd-raw');
const OUT = path.join(ROOT, 'public', 'content');

const SOURCES = {
  '2014': {
    id: 'srd-5.1',
    name: 'SRD 5.1',
    license: 'CC-BY-4.0',
    attribution:
      'This work includes material from the System Reference Document 5.1 ("SRD 5.1") by Wizards of the Coast LLC, available at https://dnd.wizards.com/resources/systems-reference-document. The SRD 5.1 is licensed under the Creative Commons Attribution 4.0 International License, available at https://creativecommons.org/licenses/by/4.0/legalcode.',
    url: 'https://dnd.wizards.com/resources/systems-reference-document',
    author: 'Wizards of the Coast LLC',
  },
  '2024': {
    id: 'srd-5.2',
    name: 'SRD 5.2',
    license: 'CC-BY-4.0',
    attribution:
      'This work includes material from the System Reference Document 5.2 ("SRD 5.2") by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2 is licensed under the Creative Commons Attribution 4.0 International License, available at https://creativecommons.org/licenses/by/4.0/legalcode.',
    url: 'https://www.dndbeyond.com/srd',
    author: 'Wizards of the Coast LLC',
  },
};

const PACK_ID = { '2014': 'srd-2014', '2024': 'srd-2024' };

// ── Utilidades ───────────────────────────────────────────────────────────────

const read = (rs, file) => {
  const p = path.join(RAW, rs, `${file}.json`);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
};

const did = (rs, type, slug) => `${PACK_ID[rs]}:${type}:${slug}`;
/** Libras -> centesimas de libra (enteros exactos). */
const toHundredths = (lb) => Math.round((Number(lb) || 0) * 100);
const arr = (v) => (Array.isArray(v) ? v : v == null ? [] : [v]);

/**
 * Los objetos magicos del SRD 5.2 vienen como UN solo parrafo.
 *
 * El volcado de 5.1 trae `desc` como array, un parrafo por elemento. El de 5.2
 * lo trae como una sola cadena con los parrafos pegados por «  \n » —dos
 * espacios, salto, un espacio—. Meterlo tal cual daba un bloque de texto de
 * hasta cuarenta parrafos sin separacion, ilegible en la ficha.
 *
 * El separador se busca EXACTO, no un `\n` cualquiera: las 3.813 cadenas de
 * 5.1 no lo traen ni una vez, y las 262 de 5.2 lo traen todas. Partir por
 * `\n` a secas reventaria las reglas de 5.1, que son documentos markdown
 * enteros dentro de una sola cadena.
 */
const PARRAFO_5_2 = /\s*\n\s*/;

/**
 * Al mismo volcado tambien se le caen espacios sueltos —`expendthe`,
 * `savingthrow`, `1d10plus`— y el salto que separaba un apartado en negrita,
 * que deja `...con enanos y duergar.Toughness. Tu Constitucion...` de corrido.
 *
 * Las palabras van en `2024/pegados.fix.json` porque son datos: una lista
 * cerrada, caso por caso, y ahi esta explicado por que no puede ser una regla.
 * El corte por punto o dos puntos pegados a mayuscula SI es una regla, y puede
 * serlo porque el patron no aparece ni una vez en las 3.813 cadenas de 5.1:
 * ahi no es prosa, es un salto perdido.
 */
const PEGADOS = (() => {
  const p = path.join(RAW, '2024', 'pegados.fix.json');
  if (!fs.existsSync(p)) return null;
  const { espacios, rayas, unidades } = JSON.parse(fs.readFileSync(p, 'utf8'));
  const mapa = { ...espacios, ...rayas };
  const claves = Object.keys(mapa).sort((a, b) => b.length - a.length);
  return {
    mapa,
    palabras: new RegExp(`\\b(${claves.join('|')})\\b`, 'g'),
    unidades: new RegExp(`(\\d)(${unidades.join('|')})(?![a-z])`, 'g'),
  };
})();
const CORTE_5_2 = /(?<=[a-z0-9][.:])(?=[A-Z])/;

const despegar = (x) =>
  PEGADOS === null
    ? x
    : x.replace(PEGADOS.palabras, (m) => PEGADOS.mapa[m]).replace(PEGADOS.unidades, '$1 $2');

const descOf = (o) =>
  arr(o?.desc)
    .filter((x) => typeof x === 'string')
    .flatMap((x) =>
      x.includes('  \n ')
        ? despegar(x)
            .split(PARRAFO_5_2)
            .flatMap((y) => y.split(CORTE_5_2))
        : [x],
    )
    .map((x) => x.trim())
    .filter((x) => x.length > 0);
const idxOf = (o) => o?.index ?? null;

/**
 * Las definiciones guardan `sourceId`, no el objeto `source` completo.
 * Repetir el texto de atribucion 3000 veces multiplicaba por tres el peso
 * del contenido, y eso se paga en cada carga offline. El cargador lo hidrata
 * desde el manifiesto del pack.
 */
function base(rs, type, o, extra = {}) {
  const d = {
    id: did(rs, type, o.index),
    type,
    name: o.name,
    rulesets: [rs],
    sourceId: SOURCES[rs].id,
    version: '1.0.0',
    language: 'en',
    ...extra,
  };
  const desc = extra.description ?? descOf(o);
  if (desc.length > 0) d.description = desc;
  return d;
}

// ── Conjuros ─────────────────────────────────────────────────────────────────

/**
 * En 5.2 hay nueve conjuros cuyo `range` se comio los componentes.
 *
 * Vienen como `range: "Touch Component: V, S"` con `components: []`. Dejarlo
 * asi ponia "Touch Component: V, S" en la fila de Alcance de la ficha y la de
 * Componentes vacia. El corte es exacto —la etiqueta "Component:" no aparece
 * en ningun alcance legitimo—, asi que se separa y cada mitad vuelve a su
 * campo. Si el volcado se arregla en origen, esto deja de hacer nada.
 */
function rangeAndComponents(s) {
  const bruto = s.range ?? '';
  const componentes = arr(s.components);
  const corte = bruto.match(/^(.*?)\s*Components?:\s*(.+)$/i);
  if (!corte) return { range: bruto, components: componentes };

  const letras = corte[2]
    .split(/[,\s]+/)
    .map((x) => x.trim().toUpperCase())
    .filter((x) => x === 'V' || x === 'S' || x === 'M');

  return {
    range: corte[1].trim(),
    components: componentes.length > 0 ? componentes : letras,
  };
}

function buildSpells(rs) {
  const raw = read(rs, 'Spells') ?? [];
  return raw.map((s) => {
    const dmg = arr(s.damage)[0] ?? s.damage;
    const { range, components } = rangeAndComponents(s);
    const spell = base(rs, 'spell', s, {
      level: s.level ?? 0,
      school: s.school?.name ?? 'Unknown',
      castingTime: s.casting_time ?? '1 action',
      range,
      components,
      duration: s.duration ?? '',
      concentration: Boolean(s.concentration),
      ritual: Boolean(s.ritual),
      higherLevel: arr(s.higher_level),
      classes: arr(s.classes).map(idxOf).filter(Boolean),
    });
    if (s.material) spell.material = s.material;
    if (dmg) {
      const d = {};
      if (dmg.damage_type?.index) d.damageType = dmg.damage_type.index;
      if (dmg.damage_at_slot_level) d.atSlotLevel = dmg.damage_at_slot_level;
      if (dmg.damage_at_character_level) d.atCharacterLevel = dmg.damage_at_character_level;
      if (Object.keys(d).length) spell.damage = d;
    }
    if (s.dc?.dc_type?.index) {
      spell.save = {
        ability: s.dc.dc_type.index,
        onSuccess: s.dc.dc_success === 'half' ? 'half' : s.dc.dc_success === 'none' ? 'none' : 'other',
      };
    }
    if (s.attack_type) spell.attackType = s.attack_type;
    if (s.area_of_effect) spell.areaOfEffect = s.area_of_effect;
    if (s.heal_at_slot_level) spell.healAtSlotLevel = s.heal_at_slot_level;
    return spell;
  });
}

// ── Equipo: armas, armaduras, utiles ─────────────────────────────────────────

/** Municion conocida del SRD, para vincular arma -> municion. */
const AMMO_FOR = {
  'longbow': 'arrow', 'shortbow': 'arrow',
  'light-crossbow': 'crossbow-bolt', 'hand-crossbow': 'crossbow-bolt', 'heavy-crossbow': 'crossbow-bolt',
  'sling': 'sling-bullet', 'blowgun': 'blowgun-needle',
};

const AMMO_INDEXES = new Set(['arrow', 'crossbow-bolt', 'sling-bullet', 'blowgun-needle', 'arrows', 'bolts', 'needles']);

/**
 * El SRD 2014 y el 2024 describen el equipo de formas distintas:
 *   2014 -> equipment_category (singular) + weapon_category / armor_category
 *   2024 -> equipment_categories (array) del que hay que inferir todo
 * Esta funcion normaliza ambas a una sola forma.
 */
function classifyEquipment(e) {
  const cats = arr(e.equipment_categories).map(idxOf).filter(Boolean);
  const single = e.equipment_category?.index;
  const all = new Set([...cats, single].filter(Boolean));
  const has = (s) => [...all].some((c) => c.includes(s));

  const isWeapon = Boolean(e.weapon_category) || has('weapon');
  const isArmor = Boolean(e.armor_category) || has('armor') || has('shield');

  if (isWeapon) {
    const martial = e.weapon_category
      ? String(e.weapon_category).toLowerCase().includes('martial')
      : has('martial');
    const ranged = e.weapon_range
      ? String(e.weapon_range).toLowerCase() === 'ranged'
      : has('ranged');
    return { kind: 'weapon', category: martial ? 'martial' : 'simple', rangeType: ranged ? 'ranged' : 'melee' };
  }

  if (isArmor) {
    const src = e.armor_category ? String(e.armor_category).toLowerCase() : [...all].join(' ');
    const category = src.includes('shield')
      ? 'shield'
      : src.includes('heavy')
        ? 'heavy'
        : src.includes('medium')
          ? 'medium'
          : 'light';
    return { kind: 'armor', category };
  }

  const label =
    e.gear_category?.name ??
    e.equipment_category?.name ??
    arr(e.equipment_categories)[0]?.name ??
    'Adventuring Gear';
  return { kind: 'gear', category: label };
}

function buildEquipment(rs) {
  const raw = read(rs, 'Equipment') ?? [];
  const weapons = [];
  const armors = [];
  const gear = [];

  for (const e of raw) {
    const cls = classifyEquipment(e);
    const cost = e.cost ? { quantity: e.cost.quantity, unit: e.cost.unit } : undefined;
    const weight = toHundredths(e.weight);

    if (cls.kind === 'weapon') {
      const w = base(rs, 'weapon', e, {
        category: cls.category,
        rangeType: cls.rangeType,
        properties: arr(e.properties).map(idxOf).filter(Boolean),
        weight,
      });
      if (cost) w.cost = cost;
      if (e.damage) w.damage = { dice: e.damage.damage_dice, damageType: e.damage.damage_type?.index ?? 'bludgeoning' };
      if (e.two_handed_damage) {
        w.twoHandedDamage = {
          dice: e.two_handed_damage.damage_dice,
          damageType: e.two_handed_damage.damage_type?.index ?? 'bludgeoning',
        };
      }
      if (e.range) w.range = e.range;
      if (e.throw_range) w.throwRange = e.throw_range;
      const ammo = AMMO_FOR[e.index];
      if (ammo) w.ammunitionType = did(rs, 'gear', ammo);
      const mastery = e.mastery?.index ?? e.mastery_property?.index;
      if (mastery) w.mastery = mastery;
      weapons.push(w);
      continue;
    }

    if (cls.kind === 'armor') {
      const a = base(rs, 'armor', e, {
        category: cls.category,
        baseAc: e.armor_class?.base ?? 10,
        addsDexBonus: Boolean(e.armor_class?.dex_bonus),
        maxDexBonus: e.armor_class?.max_bonus ?? null,
        strMinimum: e.str_minimum ?? 0,
        stealthDisadvantage: Boolean(e.stealth_disadvantage),
        weight,
      });
      if (cost) a.cost = cost;
      armors.push(a);
      continue;
    }

    /**
     * El SRD describe la municion por PAQUETES: "Arrows (20) — 1 gp, 1 lb".
     * El peso y el precio son del paquete entero, no de la unidad.
     *
     * El inventario cuenta unidades (una flecha gastada es una flecha), asi
     * que normalizamos el peso por unidad y conservamos `packSize` para que
     * la tienda pueda seguir vendiendo de a 20.
     */
    const packSize = e.quantity ?? 1;
    const g = base(rs, 'gear', e, {
      category: cls.category,
      weight: packSize > 1 ? Math.round(weight / packSize) : weight,
      packSize,
      consumable: /potion|ration|torch|oil|component|poison|antitoxin|acid|alchemist/i.test(e.name),
      ammunition: AMMO_INDEXES.has(e.index) || /^(arrows?|bolts?|bullets?|needles?)$/i.test(e.name),
    });
    if (cost) g.cost = cost;
    gear.push(g);
  }
  return { weapons, armors, gear };
}

/**
 * Correcciones al volcado de objetos magicos de 5.2 (deuda T17).
 *
 * Se aplica como PARCHE y no editando el volcado porque `Magic-Items.json` es
 * material de origen: si algun dia se vuelve a bajar, el parche queda a la
 * vista para comprobar si las entradas siguen rotas. El porque de cada
 * correccion esta en el propio `magic-items.fix.json`.
 */
function magicItemFixes(rs) {
  const ruta = path.join(RAW, rs, 'magic-items.fix.json');
  if (!fs.existsSync(ruta)) return {};
  const { _porque, ...fixes } = JSON.parse(fs.readFileSync(ruta, 'utf8'));
  return fixes;
}

function buildMagicItems(rs) {
  const raw = read(rs, 'Magic-Items') ?? [];
  const fixes = magicItemFixes(rs);
  const RARITY = new Set(['common', 'uncommon', 'rare', 'very rare', 'legendary', 'artifact', 'varies']);
  return raw.map((m) => {
    const rarity = String(m.rarity?.name ?? 'varies').toLowerCase();
    const description = fixes[m.index] ?? descOf(m);
    const text = description.join(' ');
    const attune = /requires attunement/i.test(text);
    const item = base(rs, 'magicItem', m, {
      rarity: RARITY.has(rarity) ? rarity : 'varies',
      requiresAttunement: attune,
      category: m.equipment_category?.name ?? 'Wondrous Items',
      weight: 0,
      description,
    });
    const req = text.match(/requires attunement([^)]*)/i);
    if (req && req[1] && req[1].trim()) item.attunementRequirement = req[1].trim();
    const ch = text.match(/has (\d+) charges/i);
    if (ch) item.charges = { maximum: Number(ch[1]), recovery: 'dawn' };
    return item;
  });
}

// ── Clases y progresion ──────────────────────────────────────────────────────

function buildClasses(rs) {
  const raw = read(rs, 'Classes') ?? [];
  const levels = read(rs, 'Levels') ?? [];
  const subclasses = read(rs, 'Subclasses') ?? [];

  const byClass = new Map();
  for (const l of levels) {
    const ci = l.class?.index;
    if (!ci) continue;
    if (!byClass.has(ci)) byClass.set(ci, []);
    byClass.get(ci).push(l);
  }

  const classes = raw.map((c) => {
    const rows = (byClass.get(c.index) ?? []).filter((r) => !r.subclass);
    const progression = {};
    for (const r of rows) {
      const lvl = String(r.level);
      const prev = progression[lvl];
      const features = [
        ...(prev?.features ?? []),
        ...arr(r.features).map((f) => did(rs, 'feature', f.index)),
      ];
      const entry = {
        profBonus: r.prof_bonus ?? prev?.profBonus ?? 2,
        features: [...new Set(features)],
        abilityScoreImprovement: (r.ability_score_bonuses ?? 0) > (rows.find((x) => x.level === r.level - 1)?.ability_score_bonuses ?? 0),
        resources: r.class_specific ?? {},
      };
      if (r.spellcasting) {
        const slots = [];
        for (let i = 1; i <= 9; i++) slots.push(r.spellcasting[`spell_slots_level_${i}`] ?? 0);
        entry.spellcasting = { slots };
        if (r.spellcasting.cantrips_known != null) entry.spellcasting.cantripsKnown = r.spellcasting.cantrips_known;
        if (r.spellcasting.spells_known != null) entry.spellcasting.spellsKnown = r.spellcasting.spells_known;
      }
      progression[lvl] = entry;
    }

    const skillChoice = arr(c.proficiency_choices).find((pc) =>
      arr(pc.from?.options).some((o) => o.item?.index?.startsWith('skill-')),
    );

    const cls = base(rs, 'class', c, {
      hitDie: c.hit_die,
      savingThrows: arr(c.saving_throws).map(idxOf).filter(Boolean),
      armorProficiencies: arr(c.proficiencies).map(idxOf).filter((i) => /armor|shield/i.test(i ?? '')),
      weaponProficiencies: arr(c.proficiencies).map(idxOf).filter((i) => /weapon/i.test(i ?? '')),
      toolProficiencies: arr(c.proficiencies).map(idxOf).filter((i) => /tool|instrument|supplies|kit/i.test(i ?? '')),
      startingEquipment: arr(c.starting_equipment).map((se) => ({
        definitionId: resolveEquipId(rs, se.equipment?.index),
        quantity: se.quantity ?? 1,
      })).filter((x) => x.definitionId),
      startingEquipmentOptions: buildEquipOptions(rs, c.starting_equipment_options),
      progression,
      subclassLevel: guessSubclassLevel(c.index, rs),
      subclasses: arr(c.subclasses).map((s) => did(rs, 'subclass', s.index)),
      description: [],
    });

    if (skillChoice) {
      cls.skillChoices = {
        choose: skillChoice.choose,
        from: arr(skillChoice.from?.options).map((o) => o.item?.index).filter(Boolean),
      };
    }
    if (c.spellcasting) {
      cls.spellcasting = {
        ability: c.spellcasting.spellcasting_ability?.index ?? 'int',
        startsAtLevel: c.spellcasting.level ?? 1,
        preparesSpells: ['cleric', 'druid', 'paladin', 'wizard', 'artificer'].includes(c.index),
        ritualCasting: ['wizard', 'cleric', 'druid', 'bard'].includes(c.index),
      };
    }
    if (c.multi_classing) {
      cls.multiclassing = {
        prerequisites: arr(c.multi_classing.prerequisites).map((p) => ({
          ability: p.ability_score?.index ?? 'str',
          minimum: p.minimum_score ?? 13,
        })),
        proficiencies: arr(c.multi_classing.proficiencies).map(idxOf).filter(Boolean),
      };
    }
    return cls;
  });

  const subs = subclasses.map((s) => {
    const rows = (byClass.get(s.class?.index) ?? []).filter((r) => r.subclass?.index === s.index);
    const progression = {};
    for (const r of rows) {
      const lvl = String(r.level);
      const feats = arr(r.features).map((f) => did(rs, 'feature', f.index));
      progression[lvl] = { features: [...new Set([...(progression[lvl]?.features ?? []), ...feats])] };
    }
    return base(rs, 'subclass', s, {
      classId: did(rs, 'class', s.class?.index ?? 'unknown'),
      flavor: s.subclass_flavor ?? '',
      progression,
    });
  });

  return { classes, subclasses: subs };
}

const SUBCLASS_LEVEL = {
  cleric: 1, sorcerer: 1, warlock: 1, wizard: 2, druid: 2, barbarian: 3,
  bard: 3, fighter: 3, monk: 3, paladin: 3, ranger: 3, rogue: 3,
};
const guessSubclassLevel = (idx, rs) => (rs === '2024' ? 3 : (SUBCLASS_LEVEL[idx] ?? 3));

/** El SRD no marca la categoria del objeto en las opciones; se resuelve por indice. */
let EQUIP_INDEX = new Map();
function resolveEquipId(rs, index) {
  if (!index) return null;
  return EQUIP_INDEX.get(`${rs}:${index}`) ?? null;
}

function buildEquipOptions(rs, options) {
  return arr(options).map((opt) => ({
    choose: opt.choose ?? 1,
    label: opt.desc ?? '',
    options: arr(opt.from?.options).map((o) => {
      const items = [];
      if (o.of?.index) items.push({ definitionId: resolveEquipId(rs, o.of.index), quantity: o.count ?? 1 });
      for (const it of arr(o.items)) {
        if (it.of?.index) items.push({ definitionId: resolveEquipId(rs, it.of.index), quantity: it.count ?? 1 });
      }
      return {
        label:
          o.of?.name ||
          arr(o.items).map((i) => i.of?.name).filter(Boolean).join(' + ') ||
          o.choice?.desc ||
          'Opcion',
        items: items.filter((i) => i.definitionId),
      };
    }).filter((o) => o.items.length > 0),
  })).filter((o) => o.options.length > 0);
}

// ── Especies, trasfondos, dotes, rasgos ──────────────────────────────────────

function buildSpecies(rs) {
  const speciesRaw = read(rs, rs === '2024' ? 'Species' : 'Races') ?? [];
  const subRaw = read(rs, rs === '2024' ? 'Subspecies' : 'Subraces') ?? [];

  const species = speciesRaw.map((r) =>
    base(rs, 'species', r, {
      speed: typeof r.speed === 'number' ? r.speed : (r.speed?.walk ?? 30),
      size: r.size ?? 'Medium',
      sizeDescription: r.size_description ?? '',
      abilityBonuses: arr(r.ability_bonuses).map((b) => ({ ability: b.ability_score?.index, bonus: b.bonus })).filter((b) => b.ability),
      languages: arr(r.languages).map((l) => l.name).filter(Boolean),
      traits: arr(r.traits).map((t) => did(rs, 'trait', t.index)),
      subspecies: arr(r.subraces ?? r.subspecies).map((s) => did(rs, 'subspecies', s.index)),
      age: r.age ?? '',
      alignment: r.alignment ?? '',
      description: [r.size_description, r.age, r.alignment, r.language_desc].filter(Boolean),
    }),
  );

  const subspecies = subRaw.map((s) =>
    base(rs, 'subspecies', s, {
      speciesId: did(rs, 'species', s.race?.index ?? s.species?.index ?? 'unknown'),
      abilityBonuses: arr(s.ability_bonuses).map((b) => ({ ability: b.ability_score?.index, bonus: b.bonus })).filter((b) => b.ability),
      traits: arr(s.racial_traits ?? s.traits).map((t) => did(rs, 'trait', t.index)),
    }),
  );

  const traits = (read(rs, 'Traits') ?? []).map((t) =>
    base(rs, 'trait', t, {
      speciesIds: arr(t.races ?? t.species).map((r) => did(rs, 'species', r.index)),
    }),
  );

  return { species, subspecies, traits };
}

/**
 * El SRD da el oro inicial como `{quantity, unit}`, no como un número.
 *
 * Copiarlo tal cual metía un OBJETO donde el esquema declara un entero, y
 * `formatCurrency` lo pasaba a `Intl.NumberFormat`: la ficha de cualquier
 * personaje con trasfondo Acólito mostraba **«NaN PO»**. El filtro previo
 * `c[d] !== 0` no lo atrapaba porque `NaN !== 0` es cierto.
 */
const goldOf = (g) => {
  if (typeof g === 'number') return g;
  if (!g || typeof g.quantity !== 'number') return 0;
  const enOro = { cp: 1 / 100, sp: 1 / 10, ep: 1 / 2, gp: 1, pp: 10 };
  return Math.round(g.quantity * (enOro[g.unit] ?? 1));
};

function buildBackgrounds(rs) {
  return (read(rs, 'Backgrounds') ?? []).map((b) => {
    const bg = base(rs, 'background', b, {
      skillProficiencies: arr(b.starting_proficiencies).map(idxOf).filter((i) => i?.startsWith('skill-')),
      toolProficiencies: arr(b.starting_proficiencies).map(idxOf).filter((i) => i && !i.startsWith('skill-')),
      languageOptions: b.language_options?.choose ?? 0,
      abilityBonuses: arr(b.ability_options?.from?.options ?? []).length ? [] : [],
      startingEquipment: arr(b.starting_equipment).map((se) => ({
        definitionId: resolveEquipId(rs, se.equipment?.index),
        quantity: se.quantity ?? 1,
      })).filter((x) => x.definitionId),
      startingGold: goldOf(b.starting_gold),
      personalityTraits: arr(b.personality_traits?.from?.options).map((o) => o.string).filter(Boolean),
      ideals: arr(b.ideals?.from?.options).map((o) => o.desc ?? o.string).filter(Boolean),
      bonds: arr(b.bonds?.from?.options).map((o) => o.string).filter(Boolean),
      flaws: arr(b.flaws?.from?.options).map((o) => o.string).filter(Boolean),
    });
    if (b.feature) bg.feature = { name: b.feature.name, description: arr(b.feature.desc) };
    if (b.feat?.index) bg.feat = did(rs, 'feat', b.feat.index);
    return bg;
  });
}

function buildSimple(rs) {
  const conditions = (read(rs, 'Conditions') ?? []).map((c) => base(rs, 'condition', c));
  const skills = (read(rs, 'Skills') ?? []).map((s) =>
    base(rs, 'skill', s, { ability: s.ability_score?.index ?? 'int' }),
  );
  const languages = (read(rs, 'Languages') ?? []).map((l) =>
    base(rs, 'language', l, { category: l.type ?? 'Standard', script: l.script ?? '' }),
  );
  const feats = (read(rs, 'Feats') ?? []).map((f) =>
    base(rs, 'feat', f, {
      prerequisites: arr(f.prerequisites).map((p) =>
        p.ability_score ? `${p.ability_score.name} ${p.minimum_score}+` : (p.type ?? ''),
      ).filter(Boolean),
      category: f.category ?? 'general',
    }),
  );
  const features = (read(rs, 'Features') ?? []).map((f) => {
    const feature = base(rs, 'feature', f, { level: f.level ?? 1 });
    if (f.class?.index) feature.classId = did(rs, 'class', f.class.index);
    if (f.subclass?.index) feature.subclassId = did(rs, 'subclass', f.subclass.index);
    return feature;
  });
  const ruleSections = [
    ...(read(rs, 'Rules') ?? []),
    ...(read(rs, 'Rule-Sections') ?? []),
  ].map((r) => base(rs, 'rule', r, { category: r.parent?.name ?? 'general' }));

  return { conditions, skills, languages, feats, features, rules: ruleSections };
}

function buildMonsters(rs) {
  return (read(rs, 'Monsters') ?? []).map((m) => {
    const acRaw = Array.isArray(m.armor_class) ? m.armor_class[0]?.value : m.armor_class;
    const speed = {};
    for (const [k, v] of Object.entries(m.speed ?? {})) speed[k] = String(v);
    return base(rs, 'monster', m, {
      size: m.size ?? 'Medium',
      creatureType: m.type ?? 'humanoid',
      alignment: m.alignment ?? 'unaligned',
      armorClass: Number(acRaw) || 10,
      hitPoints: m.hit_points ?? 1,
      hitDice: m.hit_dice ?? '1d8',
      speed,
      abilities: {
        str: m.strength ?? 10, dex: m.dexterity ?? 10, con: m.constitution ?? 10,
        int: m.intelligence ?? 10, wis: m.wisdom ?? 10, cha: m.charisma ?? 10,
      },
      challengeRating: m.challenge_rating ?? 0,
      xp: m.xp ?? 0,
      proficiencyBonus: m.proficiency_bonus ?? 2,
      senses: m.senses ?? {},
      languages: m.languages ?? '',
      damageVulnerabilities: arr(m.damage_vulnerabilities),
      damageResistances: arr(m.damage_resistances),
      damageImmunities: arr(m.damage_immunities),
      conditionImmunities: arr(m.condition_immunities).map((c) => c.index ?? c).filter(Boolean),
      specialAbilities: arr(m.special_abilities).map((a) => ({ name: a.name, desc: a.desc })),
      actions: arr(m.actions).map((a) => ({ name: a.name, desc: a.desc })),
      legendaryActions: arr(m.legendary_actions).map((a) => ({ name: a.name, desc: a.desc })),
      description: [],
    });
  });
}

// ── Orquestacion ─────────────────────────────────────────────────────────────

function buildPack(rs) {
  // Primero el indice de equipo: clases y trasfondos lo necesitan resuelto.
  const equipRaw = read(rs, 'Equipment') ?? [];
  EQUIP_INDEX = new Map();
  for (const e of equipRaw) {
    EQUIP_INDEX.set(`${rs}:${e.index}`, did(rs, classifyEquipment(e).kind, e.index));
  }

  const { weapons, armors, gear } = buildEquipment(rs);
  const { classes, subclasses } = buildClasses(rs);
  const { species, subspecies, traits } = buildSpecies(rs);
  const { conditions, skills, languages, feats, features, rules } = buildSimple(rs);

  const collections = {
    spell: buildSpells(rs),
    weapon: weapons,
    armor: armors,
    gear,
    magicItem: buildMagicItems(rs),
    class: classes,
    subclass: subclasses,
    species,
    subspecies,
    trait: traits,
    background: buildBackgrounds(rs),
    feat: feats,
    feature: features,
    condition: conditions,
    skill: skills,
    language: languages,
    rule: rules,
    monster: buildMonsters(rs),
  };

  const counts = {};
  for (const [k, v] of Object.entries(collections)) counts[k] = v.length;

  const manifest = {
    id: PACK_ID[rs],
    name: `${SOURCES[rs].name} (${rs})`,
    description:
      rs === '2014'
        ? 'Contenido del System Reference Document 5.1 para las reglas de 2014.'
        : 'Contenido del System Reference Document 5.2 para las reglas de 2024.',
    version: '1.0.0',
    ruleset: rs,
    language: 'en',
    source: SOURCES[rs],
    /** Fuentes referenciables por `sourceId` desde cada definicion del pack. */
    sources: { [SOURCES[rs].id]: SOURCES[rs] },
    builtIn: true,
    counts,
  };

  const dir = path.join(OUT, PACK_ID[rs]);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest));
  for (const [type, items] of Object.entries(collections)) {
    fs.writeFileSync(path.join(dir, `${type}.json`), JSON.stringify(items));
  }

  return { manifest, collections };
}

function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const index = [];
  for (const rs of ['2014', '2024']) {
    if (!fs.existsSync(path.join(RAW, rs))) {
      console.warn(`! Sin datos en bruto para ${rs}, se omite.`);
      continue;
    }
    const { manifest } = buildPack(rs);
    index.push(manifest);
    const total = Object.values(manifest.counts).reduce((a, b) => a + b, 0);
    console.log(`\n${manifest.name}  ->  ${total} definiciones`);
    const rows = Object.entries(manifest.counts)
      .filter(([, n]) => n > 0)
      .sort((a, b) => b[1] - a[1]);
    for (const [k, n] of rows) console.log(`   ${String(n).padStart(5)}  ${k}`);
  }
  copyTranslations();
  fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify(index));
  console.log(`\nEscrito en public/content/`);
}

/**
 * Traducciones del contenido.
 *
 * Se escriben a mano en data/translations/ y se sirven como datos, igual que
 * el resto del contenido: el service worker las precachea y la aplicacion las
 * aplica campo a campo. Lo que no este traducido se queda en ingles.
 */
function copyTranslations() {
  const src = path.join(ROOT, 'data', 'translations');
  if (!fs.existsSync(src)) return;

  const dir = path.join(OUT, 'translations');
  fs.mkdirSync(dir, { recursive: true });

  for (const file of fs.readdirSync(src).filter((f) => f.endsWith('.json'))) {
    const overlay = JSON.parse(fs.readFileSync(path.join(src, file), 'utf8'));
    const names = Object.keys(overlay.names ?? {}).length;
    const entries = Object.keys(overlay.entries ?? {}).length;
    fs.writeFileSync(path.join(dir, file), JSON.stringify(overlay));
    console.log(`\nTraduccion ${file}  ->  ${names} nombres, ${entries} textos`);
  }
}

main();
