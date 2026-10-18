/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type GameState = 'title' | 'playing' | 'paused' | 'gameover' | 'victory';

export type BiomeType = 'jungle' | 'coast' | 'springs' | 'lava' | 'caldera';

export interface Vector2D {
  x: number;
  z: number;
}

export interface PlayerStats {
  hp: number;
  maxHp: number;
  stamina: number;
  maxStamina: number;
  staminaRegen: number;
  healingFlasks: number;
  maxHealingFlasks: number;
  flaskHealAmount: number;
  traps: number;
  maxTraps: number;
  stones: number;
  attackPower: number;
  defense: number;
  critChance: number;
}

export type WeaponId = 'flint_spear' | 'bone_harpoon' | 'obsidian_glaive' | 'caldera_lance';
export type ArmorId = 'scavenger_rags' | 'beast_hide' | 'chitin_cuirass' | 'caldera_plate';
export type ToolId = 'bone_knife' | 'climbing_hook' | 'signal_igniter';

export interface WeaponDef {
  id: WeaponId;
  name: string;
  damage: number;
  staminaCost: number;
  range: number;
  critBonus: number;
  description: string;
  materialsRequired: Record<string, number>;
}

export interface ArmorDef {
  id: ArmorId;
  name: string;
  defense: number;
  staminaBonus: number;
  description: string;
  materialsRequired: Record<string, number>;
}

export interface CraftingRecipe {
  id: string;
  name: string;
  category: 'weapon' | 'armor' | 'supplies' | 'beacon';
  description: string;
  cost: Record<string, number>;
  unlockedByDefault?: boolean;
}

export type BeastSpecies = 'raptor' | 'brontoshell' | 'thunderhorn' | 'caldera_titan';

export interface BeastWeakPoint {
  id: string;
  name: string;
  offset: [number, number, number]; // relative to beast root
  radius: number;
  damageMultiplier: number;
  broken: boolean;
  breakThreshold: number;
  accumulatedDamage: number;
}

export interface BeastState {
  id: string;
  species: BeastSpecies;
  name: string;
  title: string;
  x: number;
  y: number;
  z: number;
  rotation: number;
  hp: number;
  maxHp: number;
  enraged: boolean;
  staggered: boolean;
  staggerTimer: number;
  attackCooldown: number;
  state: 'idle' | 'patrol' | 'stalk' | 'telegraph' | 'attack' | 'recover' | 'staggered' | 'flee' | 'dead';
  currentAttackName: string;
  telegraphProgress: number; // 0 to 1
  weakPoints: BeastWeakPoint[];
  drops: Record<string, number>;
  biome: BiomeType;
  carved: boolean;
  alertLevel: number; // 0 (unaware) to 1 (full combat)
}

export interface TrackClue {
  id: string;
  type: 'footprint' | 'broken_brush' | 'blood' | 'droppings' | 'claw_mark';
  x: number;
  y: number;
  z: number;
  rotation: number;
  beastId: string;
  species: BeastSpecies;
  age: number; // 0 is fresh, 1 is old
  inspected: boolean;
}

export interface QuestStep {
  id: string;
  title: string;
  description: string;
  targetRegion: BiomeType;
  completed: boolean;
  targetBeastSpecies?: BeastSpecies;
  requiredMaterial?: { id: string; count: number };
}

export interface Inventory {
  materials: Record<string, number>;
  weapons: WeaponId[];
  equippedWeapon: WeaponId;
  armors: ArmorId[];
  equippedArmor: ArmorId;
  tools: ToolId[];
}

export interface GameSettings {
  mouseSensitivity: number;
  touchSensitivity: number;
  invertY: boolean;
  masterVolume: number;
  sfxVolume: number;
  musicVolume: number;
  difficulty: 'story' | 'hunter' | 'savage';
  vibration: boolean;
}

export type WeatherType = 'clear' | 'heavy_rain' | 'dense_fog' | 'ash_storm';

export interface WeatherCondition {
  type: WeatherType;
  name: string;
  description: string;
  fogDensity: number;
  sunIntensity: number;
  skyColor: number;
  fogColor: number;
  beastAwarenessMod: number; // e.g. 0.8 in rain (harder for beast to hear player)
  beastSpeedMod: number; // e.g. 1.15 in ash storm (beasts agitated)
  scentDecayRate: number; // e.g. 1.8 in rain (tracks wash out faster)
}

export type BeastKnowledgeLevel = 'unknown' | 'tracked' | 'observed' | 'mastered';

export interface BeastopediaEntry {
  species: BeastSpecies;
  name: string;
  title: string;
  lore: string;
  habitat: string;
  diet: string;
  threatLevel: 'Moderate' | 'High' | 'Extreme' | 'Apex Sovereign';
  tells: Array<{
    name: string;
    description: string;
    counterplay: string;
  }>;
  attackModes: Array<{
    name: string;
    damageType: string;
    danger: string;
  }>;
  weaknesses: Array<{
    part: string;
    multiplier: string;
    breakEffect: string;
  }>;
  enragedBehavior: string;
  harvestableDrops: Array<{
    item: string;
    rarity: 'Common' | 'Uncommon' | 'Rare' | 'Legendary';
    description: string;
  }>;
  huntingTips: string[];
  associatedRecipes: string[];
}

export interface SaveData {
  version: number;
  timestamp: number;
  playerName: string;
  biome: BiomeType;
  playerPos: { x: number; y: number; z: number };
  playerStats: PlayerStats;
  inventory: Inventory;
  beastsHunted: string[];
  currentQuestIndex: number;
  signalTowerProgress: number; // 0 to 100
  beaconLit: boolean;
  settings: GameSettings;
  beastKnowledge?: Record<BeastSpecies, BeastKnowledgeLevel>;
  currentWeather?: WeatherType;
}
