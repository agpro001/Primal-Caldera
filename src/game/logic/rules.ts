/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  WeaponDef,
  ArmorDef,
  WeaponId,
  ArmorId,
  CraftingRecipe,
  QuestStep,
  PlayerStats,
  BeastWeakPoint,
  BeastSpecies,
  GameSettings,
} from '../../types/game.ts';

export const WEAPON_REGISTRY: Record<WeaponId, WeaponDef> = {
  flint_spear: {
    id: 'flint_spear',
    name: 'Flint Spear',
    damage: 22,
    staminaCost: 18,
    range: 3.2,
    critBonus: 0.1,
    description: 'Carved river flint lashed to charred hardwood. Reliable reach and thrust speed.',
    materialsRequired: {},
  },
  bone_harpoon: {
    id: 'bone_harpoon',
    name: 'Raptor Bone Harpoon',
    damage: 38,
    staminaCost: 24,
    range: 3.5,
    critBonus: 0.2,
    description: 'Serrated raptor femur tip with gut-rope binding. Devastates wounded beasts.',
    materialsRequired: { raptor_claw: 3, beast_bone: 4, tough_tendon: 2 },
  },
  obsidian_glaive: {
    id: 'obsidian_glaive',
    name: 'Obsidian Razor Glaive',
    damage: 58,
    staminaCost: 30,
    range: 3.8,
    critBonus: 0.35,
    description: 'Black volcanic glass flaked into lethal curved blades. Causes hemorrhaging lacerations.',
    materialsRequired: { obsidian_shard: 5, bronto_shell: 2, beast_bone: 6 },
  },
  caldera_lance: {
    id: 'caldera_lance',
    name: 'Titan Magma Lance',
    damage: 85,
    staminaCost: 36,
    range: 4.2,
    critBonus: 0.45,
    description: 'Forged from cooled primordial caldera ore and drake horn. Channels explosive piercing force.',
    materialsRequired: { titan_horn: 2, magma_core: 3, obsidian_shard: 8 },
  },
};

export const ARMOR_REGISTRY: Record<ArmorId, ArmorDef> = {
  scavenger_rags: {
    id: 'scavenger_rags',
    name: 'Scavenger Pelts',
    defense: 6,
    staminaBonus: 0,
    description: 'Torn fur and hide wraps. Bare survival against the elements.',
    materialsRequired: {},
  },
  beast_hide: {
    id: 'beast_hide',
    name: 'Stalker Leather Jerkin',
    defense: 16,
    staminaBonus: 15,
    description: 'Tanned raptor hide stitched with tendon thread. Flexible and quick in tall grass.',
    materialsRequired: { beast_hide: 5, raptor_claw: 2 },
  },
  chitin_cuirass: {
    id: 'chitin_cuirass',
    name: 'Brontoshell Chitin Plate',
    defense: 32,
    staminaBonus: 25,
    description: 'Carved volcanic carapace overlapping across the chest. Absorbs crushing charges.',
    materialsRequired: { bronto_shell: 4, beast_bone: 6, volcanic_resin: 3 },
  },
  caldera_plate: {
    id: 'caldera_plate',
    name: 'Volcanic Titan Harness',
    defense: 50,
    staminaBonus: 40,
    description: 'Heat-tempered beast bone and obsidian scales. Shrugs off lethal titan blows.',
    materialsRequired: { titan_scale: 6, magma_core: 2, obsidian_shard: 6 },
  },
};

export const CRAFTING_RECIPES: CraftingRecipe[] = [
  {
    id: 'craft_bone_harpoon',
    name: 'Raptor Bone Harpoon',
    category: 'weapon',
    description: 'Heavy hunting harpoon crafted with razor raptor talons.',
    cost: { raptor_claw: 3, beast_bone: 4, tough_tendon: 2 },
  },
  {
    id: 'craft_obsidian_glaive',
    name: 'Obsidian Razor Glaive',
    category: 'weapon',
    description: 'Lethal volcanic glass polearm with extended sweeping arcs.',
    cost: { obsidian_shard: 5, bronto_shell: 2, beast_bone: 6 },
  },
  {
    id: 'craft_caldera_lance',
    name: 'Titan Magma Lance',
    category: 'weapon',
    description: 'Apex prehistoric weapon imbued with igneous stone and titan horn.',
    cost: { titan_horn: 2, magma_core: 3, obsidian_shard: 8 },
  },
  {
    id: 'craft_beast_hide',
    name: 'Stalker Leather Jerkin',
    category: 'armor',
    description: 'Supple armor increasing defense and stamina pool.',
    cost: { beast_hide: 5, raptor_claw: 2 },
  },
  {
    id: 'craft_chitin_cuirass',
    name: 'Brontoshell Chitin Plate',
    category: 'armor',
    description: 'Heavy carapace armor that reduces heavy beast charge impact.',
    cost: { bronto_shell: 4, beast_bone: 6, volcanic_resin: 3 },
  },
  {
    id: 'craft_caldera_plate',
    name: 'Volcanic Titan Harness',
    category: 'armor',
    description: 'Supreme armor forged from volcanic scales and magma core.',
    cost: { titan_scale: 6, magma_core: 2, obsidian_shard: 6 },
  },
  {
    id: 'craft_trap_satchel',
    name: 'Shock-Vine Pitfall Trap (x2)',
    category: 'supplies',
    description: 'Deploys a spring-loaded bone snare that grounds and staggers charging beasts.',
    cost: { beast_bone: 2, tough_tendon: 2 },
  },
  {
    id: 'craft_healing_brew',
    name: 'Vitality Magma Salve (x2)',
    category: 'supplies',
    description: 'Steeped prehistoric ferns and mineral resin restores 65 HP.',
    cost: { sun_herb: 2, volcanic_resin: 1 },
  },
  {
    id: 'repair_signal_beacon_1',
    name: 'Signal Tower: Mirror Reflector',
    category: 'beacon',
    description: 'Ground and align polished obsidian mirrors on the caldera peak.',
    cost: { obsidian_shard: 4, bronto_shell: 2 },
  },
  {
    id: 'repair_signal_beacon_2',
    name: 'Signal Tower: Magma Igniter Brazier',
    category: 'beacon',
    description: 'Install heat-resistant titan bone mounts and prime the ignite chamber.',
    cost: { titan_horn: 1, magma_core: 2 },
  },
];

export const QUEST_CHAIN: QuestStep[] = [
  {
    id: 'quest_1_stalk_raptors',
    title: 'The Ravine Stalker',
    description: 'Track the swift Raptor Stalkers through the Jungle Ravine. Study their pack movements, dodge their pounce, and carve bone for your first harpoon.',
    targetRegion: 'jungle',
    targetBeastSpecies: 'raptor',
    completed: false,
  },
  {
    id: 'quest_2_brontoshell',
    title: 'Carapace of the Black Sand',
    description: 'Venture to the volcanic Black-Sand Coast. Hunt the giant armored Brontoshell. Exploit its underbelly weak point after dodging its heavy body slam.',
    targetRegion: 'coast',
    targetBeastSpecies: 'brontoshell',
    completed: false,
  },
  {
    id: 'quest_3_thunderhorn',
    title: 'Echoes in the Steaming Springs',
    description: 'Ascend to the Steaming Springs geyser basin. Stalk the colossal Thunder-Horn Behemoth. Lure its freight-train charge into rocks or traps to break its horns.',
    targetRegion: 'springs',
    targetBeastSpecies: 'thunderhorn',
    completed: false,
  },
  {
    id: 'quest_4_signal_beacon',
    title: 'The Ancient Summit Ascent',
    description: 'Reach the high volcanic Caldera. Gather obsidian and titan materials to repair the ancient Island Signal Tower at the island pinnacle.',
    targetRegion: 'caldera',
    completed: false,
    requiredMaterial: { id: 'obsidian_shard', count: 4 },
  },
  {
    id: 'quest_5_caldera_titan',
    title: 'Apex Sovereign: The Caldera Titan',
    description: 'The ancient mountain trembles. Face the colossal Caldera Titan atop the volcano crater, survive its fiery wrath, and ignite the beacon fire to save your people!',
    targetRegion: 'caldera',
    targetBeastSpecies: 'caldera_titan',
    completed: false,
  },
];

export const DEFAULT_PLAYER_STATS: PlayerStats = {
  hp: 120,
  maxHp: 120,
  stamina: 100,
  maxStamina: 100,
  staminaRegen: 32, // per second
  healingFlasks: 3,
  maxHealingFlasks: 4,
  flaskHealAmount: 65,
  traps: 2,
  maxTraps: 4,
  stones: 5,
  attackPower: 10,
  defense: 6,
  critChance: 0.12,
};

export const DEFAULT_SETTINGS: GameSettings = {
  mouseSensitivity: 1.0,
  touchSensitivity: 1.2,
  invertY: false,
  masterVolume: 0.8,
  sfxVolume: 0.9,
  musicVolume: 0.7,
  difficulty: 'hunter',
  vibration: true,
};

/**
 * Combat damage formula with weak point multiplier, weapon scale, and difficulty modifiers.
 */
export function calculateDamage(
  attackerBasePower: number,
  weaponBonus: number,
  isHeavyAttack: boolean,
  isWeakPointHit: boolean,
  weakPointMultiplier: number = 1.0,
  targetDefense: number = 0,
  critChance: number = 0.1,
  difficulty: 'story' | 'hunter' | 'savage' = 'hunter',
  randomFloat = Math.random
): { damage: number; isCrit: boolean; isWeakPoint: boolean } {
  const baseDmg = (attackerBasePower + weaponBonus) * (isHeavyAttack ? 1.85 : 1.0);
  const isCrit = randomFloat() < critChance;
  const critMultiplier = isCrit ? 1.6 : 1.0;
  const weakMult = isWeakPointHit ? Math.max(1.0, weakPointMultiplier) : 1.0;

  let netDmg = (baseDmg * critMultiplier * weakMult) - (targetDefense * 0.45);
  netDmg = Math.max(6, netDmg);

  if (difficulty === 'story') {
    netDmg *= 1.25;
  } else if (difficulty === 'savage') {
    netDmg *= 0.85;
  }

  return {
    damage: Math.round(netDmg),
    isCrit,
    isWeakPoint: isWeakPointHit,
  };
}

/**
 * Calculates beast damage dealt to the player based on beast attack power, player armor, and difficulty.
 */
export function calculatePlayerDamageTaken(
  beastAttackPower: number,
  playerArmorDefense: number,
  difficulty: 'story' | 'hunter' | 'savage' = 'hunter'
): number {
  let net = beastAttackPower - (playerArmorDefense * 0.55);
  net = Math.max(5, net);

  if (difficulty === 'story') {
    net *= 0.65;
  } else if (difficulty === 'savage') {
    net *= 1.4;
  }

  return Math.round(net);
}

/**
 * Stamina consumption rule
 */
export function calculateStaminaCost(
  action: 'light' | 'heavy' | 'dodge' | 'throw',
  weaponId: WeaponId = 'flint_spear',
  difficulty: 'story' | 'hunter' | 'savage' = 'hunter'
): number {
  const weapon = WEAPON_REGISTRY[weaponId] || WEAPON_REGISTRY.flint_spear;
  let cost = 15;
  switch (action) {
    case 'light':
      cost = weapon.staminaCost;
      break;
    case 'heavy':
      cost = weapon.staminaCost * 1.7;
      break;
    case 'dodge':
      cost = 22;
      break;
    case 'throw':
      cost = 12;
      break;
  }
  if (difficulty === 'story') cost *= 0.8;
  if (difficulty === 'savage') cost *= 1.2;
  return Math.round(cost);
}

/**
 * Check if a dodge roll is currently granting invulnerability frames (i-frames).
 * Standard roll lasts ~0.65s, i-frames occur between 0.08s and 0.42s (over 50% generous window).
 */
export function isDodgeInvulnerable(rollProgress: number): boolean {
  return rollProgress >= 0.1 && rollProgress <= 0.65;
}

/**
 * Verify whether player has required materials for a recipe
 */
export function canCraftRecipe(
  recipeCost: Record<string, number>,
  materials: Record<string, number>
): boolean {
  for (const [mat, count] of Object.entries(recipeCost)) {
    if ((materials[mat] || 0) < count) {
      return false;
    }
  }
  return true;
}

/**
 * Deduct materials upon crafting
 */
export function deductCraftingMaterials(
  recipeCost: Record<string, number>,
  materials: Record<string, number>
): Record<string, number> {
  const updated = { ...materials };
  for (const [mat, count] of Object.entries(recipeCost)) {
    updated[mat] = Math.max(0, (updated[mat] || 0) - count);
  }
  return updated;
}

/**
 * Progress beast weak point status
 */
export function applyWeakPointDamage(
  weakPoint: BeastWeakPoint,
  damage: number
): { brokenNow: boolean; weakPoint: BeastWeakPoint } {
  if (weakPoint.broken) {
    return { brokenNow: false, weakPoint };
  }
  const acc = weakPoint.accumulatedDamage + damage;
  const brokenNow = acc >= weakPoint.breakThreshold;
  return {
    brokenNow,
    weakPoint: {
      ...weakPoint,
      accumulatedDamage: acc,
      broken: brokenNow,
    },
  };
}

/**
 * Beast weak points template per species
 */
export function createBeastWeakPoints(species: BeastSpecies): BeastWeakPoint[] {
  switch (species) {
    case 'raptor':
      return [
        {
          id: 'head',
          name: 'Throat & Crest',
          offset: [0, 1.6, 1.8],
          radius: 0.9,
          damageMultiplier: 2.2,
          broken: false,
          breakThreshold: 60,
          accumulatedDamage: 0,
        },
        {
          id: 'tendon',
          name: 'Hind Leg Tendon',
          offset: [0.6, 0.7, -0.6],
          radius: 0.8,
          damageMultiplier: 1.6,
          broken: false,
          breakThreshold: 45,
          accumulatedDamage: 0,
        },
      ];
    case 'brontoshell':
      return [
        {
          id: 'underbelly',
          name: 'Soft Underbelly',
          offset: [0, 0.7, 0.2],
          radius: 1.4,
          damageMultiplier: 2.5,
          broken: false,
          breakThreshold: 120,
          accumulatedDamage: 0,
        },
        {
          id: 'eye_socket',
          name: 'Unarmored Head',
          offset: [0, 1.8, 2.5],
          radius: 1.0,
          damageMultiplier: 2.0,
          broken: false,
          breakThreshold: 90,
          accumulatedDamage: 0,
        },
      ];
    case 'thunderhorn':
      return [
        {
          id: 'horn_ridge',
          name: 'Thunder Crest Horns',
          offset: [0, 2.8, 2.8],
          radius: 1.5,
          damageMultiplier: 1.8,
          broken: false,
          breakThreshold: 150,
          accumulatedDamage: 0,
        },
        {
          id: 'flank',
          name: 'Rib Gland',
          offset: [1.6, 1.6, -0.2],
          radius: 1.2,
          damageMultiplier: 2.0,
          broken: false,
          breakThreshold: 110,
          accumulatedDamage: 0,
        },
      ];
    case 'caldera_titan':
      return [
        {
          id: 'magma_core',
          name: 'Glowing Magma Heart',
          offset: [0, 3.2, 1.2],
          radius: 1.8,
          damageMultiplier: 2.6,
          broken: false,
          breakThreshold: 220,
          accumulatedDamage: 0,
        },
        {
          id: 'crown_horns',
          name: 'Ancient Titan Horns',
          offset: [0, 5.0, 2.4],
          radius: 1.6,
          damageMultiplier: 2.0,
          broken: false,
          breakThreshold: 180,
          accumulatedDamage: 0,
        },
      ];
  }
}

/**
 * Determine drops for each beast
 */
export function getBeastDrops(species: BeastSpecies): Record<string, number> {
  switch (species) {
    case 'raptor':
      return {
        raptor_claw: 2 + Math.floor(Math.random() * 2),
        beast_bone: 3 + Math.floor(Math.random() * 3),
        tough_tendon: 2,
        beast_hide: 2 + Math.floor(Math.random() * 2),
      };
    case 'brontoshell':
      return {
        bronto_shell: 2 + Math.floor(Math.random() * 2),
        beast_bone: 4 + Math.floor(Math.random() * 3),
        obsidian_shard: 2 + Math.floor(Math.random() * 3),
        volcanic_resin: 2,
      };
    case 'thunderhorn':
      return {
        titan_horn: 1 + Math.floor(Math.random() * 2),
        beast_bone: 6,
        beast_hide: 4,
        volcanic_resin: 3,
        obsidian_shard: 3,
      };
    case 'caldera_titan':
      return {
        magma_core: 2 + Math.floor(Math.random() * 2),
        titan_scale: 4 + Math.floor(Math.random() * 3),
        titan_horn: 2,
        obsidian_shard: 6,
      };
  }
}
