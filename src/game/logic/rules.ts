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
    name: 'Flint-Tipped Hunting Spear',
    tier: 1,
    baseDamage: 24,
    heavyMultiplier: 1.75,
    staminaCostLight: 12,
    staminaCostHeavy: 26,
    critChance: 0.1,
    reach: 3.1,
    description: 'Balanced ash-wood shaft bound with rawhide and knapped river flint.',
    color: '#9c7a54',
    accentColor: '#d97706',
  },
  raptor_harpoon: {
    id: 'raptor_harpoon',
    name: 'Raptor-Claw Barbed Harpoon',
    tier: 2,
    baseDamage: 38,
    heavyMultiplier: 1.85,
    staminaCostLight: 13,
    staminaCostHeavy: 28,
    critChance: 0.22,
    reach: 3.4,
    description: 'Serrated raptor talons lash deep into beast hides, boosting critical strikes.',
    color: '#6d4c41',
    accentColor: '#ef4444',
  },
  thunder_lance: {
    id: 'thunder_lance',
    name: 'Thunderhorn Siege Lance',
    tier: 3,
    baseDamage: 56,
    heavyMultiplier: 2.0,
    staminaCostLight: 15,
    staminaCostHeavy: 30,
    critChance: 0.25,
    reach: 3.8,
    description: 'Forged from conductive crest-horn and obsidian cores. Shatters heavy armor plates.',
    color: '#374151',
    accentColor: '#38bdf8',
  },
  caldera_fang_glaive: {
    id: 'caldera_fang_glaive',
    name: 'Caldera Apex Glaive',
    tier: 4,
    baseDamage: 82,
    heavyMultiplier: 2.15,
    staminaCostLight: 14,
    staminaCostHeavy: 28,
    critChance: 0.35,
    reach: 4.1,
    description: 'The ultimate relic weapon infused with glowing volcanic magma-core and apex bone.',
    color: '#1f2937',
    accentColor: '#f97316',
  },
};

export const ARMOR_REGISTRY: Record<ArmorId, ArmorDef> = {
  scavenger_rags: {
    id: 'scavenger_rags',
    name: 'Castaway Leather Wraps',
    tier: 1,
    defense: 6,
    maxHpBonus: 0,
    maxStaminaBonus: 0,
    dodgeStaminaReduction: 0,
    description: 'Light cured hides allowing swift movement through dense fern jungles.',
    color: '#785a46',
    trimColor: '#a8a29e',
  },
  raptor_stalker_garb: {
    id: 'raptor_stalker_garb',
    name: 'Raptor-Scale Stalker Garb',
    tier: 2,
    defense: 16,
    maxHpBonus: 30,
    maxStaminaBonus: 25,
    dodgeStaminaReduction: 3,
    description: 'Supple feathered scales that reduce dodge roll fatigue and sharpen agility.',
    color: '#991b1b',
    trimColor: '#f59e0b',
  },
  bronto_plate_mail: {
    id: 'bronto_plate_mail',
    name: 'Brontoshell Carapace Plate',
    tier: 3,
    defense: 30,
    maxHpBonus: 70,
    maxStaminaBonus: 35,
    dodgeStaminaReduction: 4,
    description: 'Interlocking coastal shell plates capable of deflecting crushing tail slams.',
    color: '#1e3a8a',
    trimColor: '#38bdf8',
  },
  thunder_warden_aegis: {
    id: 'thunder_warden_aegis',
    name: 'Thunder-Warden Obsidian Aegis',
    tier: 4,
    defense: 48,
    maxHpBonus: 120,
    maxStaminaBonus: 60,
    dodgeStaminaReduction: 6,
    description: 'Masterwork prehistoric armor tempered in geothermal vents and volcanic glass.',
    color: '#18181b',
    trimColor: '#fb923c',
  },
};

export const CRAFTING_RECIPES: CraftingRecipe[] = [
  {
    id: 'craft_raptor_harpoon',
    name: 'Raptor-Claw Barbed Harpoon',
    category: 'weapon',
    targetId: 'raptor_harpoon',
    description: 'Upgrade your spear with serrated raptor talons (+14 Damage, +22% Crit).',
    tier: 2,
    ingredients: [
      { materialId: 'raptor_claw', count: 2 },
      { materialId: 'beast_bone', count: 2 },
    ],
  },
  {
    id: 'craft_raptor_garb',
    name: 'Raptor-Scale Stalker Garb',
    category: 'armor',
    targetId: 'raptor_stalker_garb',
    description: 'Craft agile hunter armor (+16 Def, +30 Max HP, +25 Stamina).',
    tier: 2,
    ingredients: [
      { materialId: 'raptor_hide', count: 2 },
      { materialId: 'beast_bone', count: 2 },
    ],
  },
  {
    id: 'craft_bronto_mail',
    name: 'Brontoshell Carapace Plate',
    category: 'armor',
    targetId: 'bronto_plate_mail',
    description: 'Heavy shell armor from the coastal behemoth (+30 Def, +70 Max HP).',
    tier: 3,
    ingredients: [
      { materialId: 'bronto_shell', count: 2 },
      { materialId: 'coral_stone', count: 2 },
    ],
  },
  {
    id: 'craft_thunder_lance',
    name: 'Thunderhorn Siege Lance',
    category: 'weapon',
    targetId: 'thunder_lance',
    description: 'High-impact siege lance (+56 Damage, 2.0x Heavy Thrust).',
    tier: 3,
    ingredients: [
      { materialId: 'thunder_horn', count: 1 },
      { materialId: 'obsidian_shard', count: 2 },
      { materialId: 'bronto_shell', count: 1 },
    ],
  },
  {
    id: 'craft_thunder_aegis',
    name: 'Thunder-Warden Obsidian Aegis',
    category: 'armor',
    targetId: 'thunder_warden_aegis',
    description: 'Volcanic plate armor built to withstand the Caldera Titan (+48 Def, +120 HP).',
    tier: 4,
    ingredients: [
      { materialId: 'thunder_horn', count: 1 },
      { materialId: 'obsidian_shard', count: 3 },
      { materialId: 'magma_core', count: 1 },
    ],
  },
  {
    id: 'craft_caldera_glaive',
    name: 'Caldera Apex Glaive',
    category: 'weapon',
    targetId: 'caldera_fang_glaive',
    description: 'Apex weapon forged from the Caldera Titan (+82 Damage, 35% Crit).',
    tier: 4,
    ingredients: [
      { materialId: 'titan_fang', count: 1 },
      { materialId: 'magma_core', count: 2 },
    ],
  },
  {
    id: 'craft_vitality_salve',
    name: 'Refill Vitality Salves (+2)',
    category: 'tool',
    targetId: 'vitality_salve',
    description: 'Distill glowing sun-herbs and geothermal resin into restorative salves.',
    tier: 1,
    ingredients: [{ materialId: 'sun_herb', count: 2 }],
  },
  {
    id: 'craft_snare_trap',
    name: 'Craft Sinew Snare Trap (+2)',
    category: 'tool',
    targetId: 'snare_trap',
    description: 'Binds charging beasts in place for 5 seconds, exposing weak points.',
    tier: 1,
    ingredients: [
      { materialId: 'beast_bone', count: 1 },
      { materialId: 'volcanic_resin', count: 1 },
    ],
  },
  {
    id: 'craft_signal_beacon',
    name: 'Ignite the Ancient Signal Tower',
    category: 'tower',
    targetId: 'ancient_flare',
    description: 'Combine an Apex Magma Heart with Obsidian and Resin to light the island rescue beacon.',
    tier: 4,
    ingredients: [
      { materialId: 'titan_fang', count: 1 },
      { materialId: 'obsidian_shard', count: 2 },
      { materialId: 'volcanic_resin', count: 2 },
    ],
  },
];

export const QUEST_CHAIN: QuestStep[] = [
  {
    id: 'q1_hunt_raptor',
    title: 'The Ravine & River Stalker',
    description: 'Explore the Jungle Ravine and Crystal River. Track the Razor-Crest Raptor or River Snapjaw Leviathan, speak with Chief Kael at camp, and carve bone for your harpoon.',
    targetBiome: 'jungle',
    targetX: -28,
    targetZ: 45,
    completed: false,
  },
  {
    id: 'q2_craft_harpoon',
    title: 'Fangs & Carapace',
    description: 'Return to the Campfire Workbench [E] or press [Tab] to forge a Tier 2 weapon or armor, or venture into the Cold Snow Mountains to hunt the Frostfang Mammoth.',
    targetBiome: 'jungle',
    targetX: 0,
    targetZ: 28,
    completed: false,
  },
  {
    id: 'q3_hunt_coastal_behemoth',
    title: 'Shell of the Black Coast',
    description: 'Venture east to the Black Sand Coast & Ocean Shallows and break the armored shell of the Brontoshell.',
    targetBiome: 'coast',
    targetX: 46,
    targetZ: 36,
    completed: false,
  },
  {
    id: 'q4_hunt_thunderhorn',
    title: 'Thunder in the Geothermal Mist',
    description: 'Cross the sulfur springs to defeat the charging Thunderhorn Charger and harvest its horn.',
    targetBiome: 'springs',
    targetX: -48,
    targetZ: -18,
    completed: false,
  },
  {
    id: 'q5_slay_caldera_titan',
    title: 'Sovereign of the Caldera',
    description: 'Ascend the northern volcanic ridge and slay Ignis-Rex, the Caldera Titan.',
    targetBiome: 'caldera',
    targetX: 0,
    targetZ: -64,
    completed: false,
  },
  {
    id: 'q6_ignite_signal_tower',
    title: 'Beacon of the Ancients',
    description: 'Carry the Titan Fang to the Ancient Signal Tower on the central plateau and ignite the beacon [E].',
    targetBiome: 'jungle',
    targetX: 0,
    targetZ: 5,
    completed: false,
  },
];

export const DEFAULT_PLAYER_STATS: PlayerStats = {
  hp: 140,
  maxHp: 140,
  stamina: 110,
  maxStamina: 110,
  staminaRegenRate: 24,
  attackPower: 24,
  defense: 6,
  critChance: 0.1,
  healingFlasks: 3,
  maxHealingFlasks: 4,
  traps: 2,
  maxTraps: 3,
  lureStones: 5,
  maxLureStones: 5,
};

export const DEFAULT_SETTINGS: GameSettings = {
  cameraSensitivity: 1.0,
  mouseSensitivity: 1.0,
  touchSensitivity: 1.0,
  invertY: false,
  audioVolume: 0.7,
  masterVolume: 0.85,
  sfxVolume: 0.9,
  musicVolume: 0.5,
  sfxMuted: false,
  difficulty: 'hunter',
  showDamageNumbers: true,
};

export interface CameraRelativeMovement {
  dx: number;
  dz: number;
  targetRotation: number;
  isMoving: boolean;
}

/**
 * Pure function that computes world-space movement (dx, dz) and character facing rotation
 * from camera yaw and directional inputs:
 * - moveForward > 0: moving FRONT (into the scene, away from camera)
 * - moveForward < 0: moving BACK (toward the camera)
 * - moveRight > 0: moving RIGHT on screen
 * - moveRight < 0: moving LEFT on screen
 *
 * Camera sits at:
 *   camX = playerPos.x - sin(cameraYaw) * cos(cameraPitch) * dist
 *   camZ = playerPos.z - cos(cameraYaw) * cos(cameraPitch) * dist
 * Therefore:
 *   Camera Forward unit vector on XZ plane = (+sin(cameraYaw), +cos(cameraYaw))
 *   Camera Right unit vector on XZ plane   = (-cos(cameraYaw), +sin(cameraYaw))
 */
export function computeCameraRelativeMovement(
  moveForward: number,
  moveRight: number,
  cameraYaw: number,
  speed: number,
  dt: number
): CameraRelativeMovement {
  const mag = Math.hypot(moveForward, moveRight);
  if (mag < 0.001 || speed <= 0 || dt <= 0) {
    return { dx: 0, dz: 0, targetRotation: cameraYaw, isMoving: false };
  }

  const normF = moveForward / Math.max(1, mag);
  const normR = moveRight / Math.max(1, mag);

  const forwardX = Math.sin(cameraYaw);
  const forwardZ = Math.cos(cameraYaw);
  const rightX = -Math.cos(cameraYaw);
  const rightZ = Math.sin(cameraYaw);

  const dirX = normF * forwardX + normR * rightX;
  const dirZ = normF * forwardZ + normR * rightZ;

  const dirLen = Math.hypot(dirX, dirZ) || 1;
  const unitX = dirX / dirLen;
  const unitZ = dirZ / dirLen;

  // Model's local +Z faces forward, so rotation around Y is atan2(unitX, unitZ)
  const targetRotation = Math.atan2(unitX, unitZ);

  return {
    dx: unitX * speed * Math.min(1, mag) * dt,
    dz: unitZ * speed * Math.min(1, mag) * dt,
    targetRotation,
    isMoving: true,
  };
}

/**
 * Shortest-arc angular interpolation so the hunter turns smoothly without spinning 360 deg.
 */
export function stepAngleShortestArc(currentAngle: number, targetAngle: number, t: number): number {
  let diff = targetAngle - currentAngle;
  while (diff < -Math.PI) diff += Math.PI * 2;
  while (diff > Math.PI) diff -= Math.PI * 2;
  return currentAngle + diff * Math.max(0, Math.min(1, t));
}

export interface DamageCalculationInput {
  weaponDamage: number;
  isHeavyAttack: boolean;
  heavyMultiplier: number;
  weakPointMultiplier: number;
  isEnraged: boolean;
  isStaggered: boolean;
  critRoll: number; // 0 to 1
  critChance: number;
  difficulty: 'story' | 'hunter' | 'apex';
}

export interface DamageCalculationResult {
  finalDamage: number;
  isCrit: boolean;
  isWeakPointHit: boolean;
}

/**
 * Pure function calculating hunter attack damage against a beast.
 */
export function calculateDamage(input: DamageCalculationInput): DamageCalculationResult {
  if (input.weaponDamage <= 0) {
    return { finalDamage: 0, isCrit: false, isWeakPointHit: false };
  }

  let dmg = input.weaponDamage;
  if (input.isHeavyAttack) {
    dmg *= Math.max(1, input.heavyMultiplier);
  }

  const isWeakPointHit = input.weakPointMultiplier > 1.05;
  dmg *= Math.max(0.5, input.weakPointMultiplier);

  if (input.isStaggered) {
    dmg *= 1.35;
  } else if (input.isEnraged) {
    dmg *= 1.1;
  }

  const isCrit = input.critRoll < Math.max(0, Math.min(1, input.critChance));
  if (isCrit) {
    dmg *= 1.5;
  }

  if (input.difficulty === 'story') {
    dmg *= 1.25;
  } else if (input.difficulty === 'apex') {
    dmg *= 0.9;
  }

  return {
    finalDamage: Math.max(1, Math.round(dmg)),
    isCrit,
    isWeakPointHit,
  };
}

/**
 * Pure function calculating damage taken by the hunter after armor defense.
 */
export function calculatePlayerDamageTaken(
  rawBeastDamage: number,
  playerDefense: number,
  difficulty: 'story' | 'hunter' | 'apex'
): number {
  if (rawBeastDamage <= 0) return 0;
  const diffScale = difficulty === 'story' ? 0.65 : difficulty === 'apex' ? 1.3 : 1.0;
  const scaledRaw = rawBeastDamage * diffScale;
  const mitigation = 100 / (100 + Math.max(0, playerDefense) * 1.8);
  return Math.max(1, Math.round(scaledRaw * mitigation));
}

/**
 * Pure function computing stamina cost for actions.
 */
export function calculateStaminaCost(
  action: 'light' | 'heavy' | 'dodge' | 'sprint',
  weapon: WeaponDef,
  armor: ArmorDef,
  dt = 1
): number {
  switch (action) {
    case 'light':
      return Math.max(4, weapon.staminaCostLight);
    case 'heavy':
      return Math.max(8, weapon.staminaCostHeavy);
    case 'dodge':
      return Math.max(8, 22 - armor.dodgeStaminaReduction);
    case 'sprint':
      return Math.max(2, 14 * dt);
    default:
      return 0;
  }
}

/**
 * Pure function determining if a dodge roll grants invulnerability frames (i-frames) at elapsed time.
 */
export function isDodgeInvulnerable(dodgeElapsed: number, totalDodgeDuration = 0.48): boolean {
  if (dodgeElapsed < 0 || dodgeElapsed > totalDodgeDuration) return false;
  return dodgeElapsed >= 0.04 && dodgeElapsed <= 0.36;
}

/**
 * Pure function checking if inventory has enough materials to craft a recipe.
 */
export function canCraftRecipe(
  recipe: CraftingRecipe,
  materials: Record<string, number>,
  ownedWeapons: WeaponId[],
  ownedArmors: ArmorId[]
): boolean {
  if (recipe.category === 'weapon' && ownedWeapons.includes(recipe.targetId as WeaponId)) {
    return false;
  }
  if (recipe.category === 'armor' && ownedArmors.includes(recipe.targetId as ArmorId)) {
    return false;
  }
  for (const req of recipe.ingredients) {
    const have = materials[req.materialId] || 0;
    if (have < req.count) return false;
  }
  return true;
}

/**
 * Pure function returning updated materials map after deducting recipe ingredients.
 */
export function deductCraftingMaterials(
  recipe: CraftingRecipe,
  materials: Record<string, number>
): Record<string, number> {
  const next = { ...materials };
  for (const req of recipe.ingredients) {
    const current = next[req.materialId] || 0;
    next[req.materialId] = Math.max(0, current - req.count);
  }
  return next;
}

/**
 * Pure function applying damage to a beast weak point and returning updated weak point + stagger trigger.
 */
export function applyWeakPointDamage(
  weakPoint: BeastWeakPoint,
  damage: number
): { updated: BeastWeakPoint; justBroke: boolean } {
  if (weakPoint.broken || damage <= 0) {
    return { updated: { ...weakPoint }, justBroke: false };
  }
  const nextHp = Math.max(0, weakPoint.partHp - damage);
  const justBroke = nextHp === 0 && !weakPoint.broken;
  return {
    updated: {
      ...weakPoint,
      partHp: nextHp,
      broken: nextHp === 0,
    },
    justBroke,
  };
}

/**
 * Factory for beast weak points per species.
 */
export function createBeastWeakPoints(species: BeastSpecies): BeastWeakPoint[] {
  switch (species) {
    case 'raptor':
      return [
        {
          id: 'raptor_head_crest',
          name: 'Feathered Skull Crest',
          localOffset: { x: 0, y: 1.7, z: 1.6 },
          radius: 1.15,
          damageMultiplier: 1.55,
          partHp: 90,
          maxPartHp: 90,
          broken: false,
          bonusDropMaterialId: 'raptor_claw',
        },
        {
          id: 'raptor_tail_plume',
          name: 'Counterbalance Tail',
          localOffset: { x: 0, y: 1.2, z: -1.9 },
          radius: 1.1,
          damageMultiplier: 1.35,
          partHp: 80,
          maxPartHp: 80,
          broken: false,
          bonusDropMaterialId: 'raptor_hide',
        },
      ];
    case 'brontoshell':
      return [
        {
          id: 'bronto_cranial_crown',
          name: 'Beaked Head',
          localOffset: { x: 0, y: 1.6, z: 2.3 },
          radius: 1.25,
          damageMultiplier: 1.6,
          partHp: 140,
          maxPartHp: 140,
          broken: false,
          bonusDropMaterialId: 'bronto_shell',
        },
        {
          id: 'bronto_tail_club',
          name: 'Spiked Tail Club',
          localOffset: { x: 0, y: 1.1, z: -2.5 },
          radius: 1.3,
          damageMultiplier: 1.45,
          partHp: 130,
          maxPartHp: 130,
          broken: false,
          bonusDropMaterialId: 'coral_stone',
        },
      ];
    case 'thunderhorn':
      return [
        {
          id: 'thunder_crest_horn',
          name: 'Conductive Nasal Horn',
          localOffset: { x: 0, y: 2.1, z: 2.4 },
          radius: 1.35,
          damageMultiplier: 1.65,
          partHp: 170,
          maxPartHp: 170,
          broken: false,
          bonusDropMaterialId: 'thunder_horn',
        },
        {
          id: 'thunder_hind_flank',
          name: 'Exposed Thermal Vent Flank',
          localOffset: { x: 0, y: 1.6, z: -1.8 },
          radius: 1.4,
          damageMultiplier: 1.4,
          partHp: 150,
          maxPartHp: 150,
          broken: false,
          bonusDropMaterialId: 'obsidian_shard',
        },
      ];
    case 'frostfang':
      return [
        {
          id: 'frostfang_glacial_tusks',
          name: 'Curved Glacial Ivory Tusks',
          localOffset: { x: 0, y: 2.2, z: 2.7 },
          radius: 1.45,
          damageMultiplier: 1.65,
          partHp: 190,
          maxPartHp: 190,
          broken: false,
          bonusDropMaterialId: 'thunder_horn',
        },
        {
          id: 'frostfang_ice_hump',
          name: 'Crystalline Ice-Ridge Hump',
          localOffset: { x: 0, y: 3.1, z: -0.4 },
          radius: 1.4,
          damageMultiplier: 1.45,
          partHp: 160,
          maxPartHp: 160,
          broken: false,
          bonusDropMaterialId: 'beast_bone',
        },
      ];
    case 'snapjaw':
      return [
        {
          id: 'snapjaw_gullet',
          name: 'Bioluminescent River Maw',
          localOffset: { x: 0, y: 1.1, z: 2.5 },
          radius: 1.3,
          damageMultiplier: 1.6,
          partHp: 130,
          maxPartHp: 130,
          broken: false,
          bonusDropMaterialId: 'raptor_claw',
        },
        {
          id: 'snapjaw_dorsal_fin',
          name: 'Serrated Hydro-Sail Crest',
          localOffset: { x: 0, y: 1.9, z: -0.5 },
          radius: 1.35,
          damageMultiplier: 1.45,
          partHp: 120,
          maxPartHp: 120,
          broken: false,
          bonusDropMaterialId: 'coral_stone',
        },
      ];
    case 'caldera_titan':
      return [
        {
          id: 'titan_magma_jaw',
          name: 'Molten Maw & Crown',
          localOffset: { x: 0, y: 2.8, z: 2.8 },
          radius: 1.5,
          damageMultiplier: 1.75,
          partHp: 220,
          maxPartHp: 220,
          broken: false,
          bonusDropMaterialId: 'titan_fang',
        },
        {
          id: 'titan_core_chest',
          name: 'Volcanic Heart Core',
          localOffset: { x: 0, y: 2.1, z: 0.6 },
          radius: 1.4,
          damageMultiplier: 1.6,
          partHp: 200,
          maxPartHp: 200,
          broken: false,
          bonusDropMaterialId: 'magma_core',
        },
      ];
  }
}
