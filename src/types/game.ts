/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type GameState = 'title' | 'playing' | 'paused' | 'crafting' | 'gameover' | 'defeat' | 'victory';

export type BiomeType = 'jungle' | 'coast' | 'springs' | 'lava' | 'caldera' | 'snow' | 'river' | 'ocean';

export type WeatherType = 'clear' | 'heavy_rain' | 'dense_fog' | 'ash_storm';

export interface WeatherCondition {
  type: WeatherType;
  name: string;
  description: string;
  fogDensity: number;
  sunIntensity: number;
  skyColor: number;
  fogColor: number;
  beastAwarenessMod: number;
  beastSpeedMod: number;
  scentDecayRate: number;
  staminaMultiplier?: number;
}

export type BeastSpecies =
  | 'raptor'
  | 'brontoshell'
  | 'thunderhorn'
  | 'frostfang'
  | 'snapjaw'
  | 'sky_dragon'
  | 'caldera_titan';

export type BeastKnowledgeLevel = 'unseen' | 'unknown' | 'tracked' | 'sighted' | 'mastered';

export type WeaponId =
  | 'flint_spear'
  | 'raptor_harpoon'
  | 'thunder_lance'
  | 'caldera_fang_glaive';

export type ArmorId =
  | 'scavenger_rags'
  | 'raptor_stalker_garb'
  | 'bronto_plate_mail'
  | 'thunder_warden_aegis';

export type ToolId = 'bone_knife' | 'sinew_trap' | 'snare_trap' | 'lure_stone' | 'vitality_salve';

export type MaterialId =
  | 'beast_bone'
  | 'raptor_claw'
  | 'raptor_hide'
  | 'bronto_shell'
  | 'bronto_tail_club'
  | 'thunder_horn'
  | 'electric_sac'
  | 'frost_fang'
  | 'glacial_pelt'
  | 'snapjaw_scale'
  | 'river_pearl'
  | 'dragon_scale'
  | 'dragon_egg_shell'
  | 'titan_fang'
  | 'magma_core'
  | 'sun_herb'
  | 'volcanic_resin'
  | 'obsidian_shard'
  | 'coral_stone';

export interface WeaponDef {
  id: WeaponId;
  name: string;
  tier: number;
  baseDamage: number;
  heavyMultiplier: number;
  staminaCostLight: number;
  staminaCostHeavy: number;
  critChance: number;
  reach: number;
  description: string;
  color: string;
  accentColor: string;
}

export interface ArmorDef {
  id: ArmorId;
  name: string;
  tier: number;
  defense: number;
  maxHpBonus: number;
  maxStaminaBonus: number;
  dodgeStaminaReduction: number;
  description: string;
  color: string;
  trimColor: string;
}

export interface CraftingRecipe {
  id: string;
  name: string;
  category: 'weapon' | 'armor' | 'tool' | 'tower';
  targetId: WeaponId | ArmorId | ToolId | 'ancient_flare';
  description: string;
  tier: number;
  ingredients: { materialId: MaterialId; count: number }[];
}

export interface BeastWeakPoint {
  id: string;
  name: string;
  localOffset: { x: number; y: number; z: number };
  radius: number;
  damageMultiplier: number;
  partHp: number;
  maxPartHp: number;
  broken: boolean;
  bonusDropMaterialId: MaterialId;
}

export type BeastAIState =
  | 'patrol'
  | 'alert'
  | 'chase'
  | 'telegraph_bite'
  | 'telegraph_charge'
  | 'telegraph_slam'
  | 'attack_bite'
  | 'attack_charge'
  | 'attack_slam'
  | 'staggered'
  | 'enraged_roar'
  | 'dead';

export interface BeastState {
  id: string;
  species: BeastSpecies;
  name: string;
  title: string;
  biome: BiomeType;
  hp: number;
  maxHp: number;
  stamina: number;
  maxStamina: number;
  enraged: boolean;
  staggered?: boolean;
  state?: string;
  telegraphProgress?: number;
  aiState: BeastAIState;
  stateTimer: number;
  x: number;
  y: number;
  z: number;
  rotation: number;
  scale?: number;
  isFlyingBeast?: boolean;
  flightAltitude?: number;
  weakPoints: BeastWeakPoint[];
  carved: boolean;
  snaredTimer: number;
}

export interface AtmosphericScienceState {
  altitudeM: number;
  airDensityKgM3: number;
  pressureHpa: number;
  temperatureC: number;
  windSpeedMs: number;
  windDirectionDeg: number;
  windVector: { x: number; y: number; z: number };
  thermalLiftMs: number;
  aerodynamicLiftN: number;
  metabolicRateKcalHr: number;
  humidityPercent: number;
}

export interface CreatureEggNest {
  id: string;
  species: BeastSpecies;
  name: string;
  biome: BiomeType;
  x: number;
  y: number;
  z: number;
  collected: boolean;
  eggWeightKg: number;
  incubationTempC: number;
  caloricValueKcal: number;
}

export interface AdventureMission {
  id: string;
  codeName: string;
  title: string;
  category: 'heist' | 'expedition' | 'science' | 'apex_hunt';
  biome: BiomeType;
  targetX: number;
  targetZ: number;
  stages: string[];
  currentStage: number;
  completed: boolean;
  rewardSummary: string;
}

export interface PlayerStats {
  hp: number;
  maxHp: number;
  // Food, Water & Creature Eggs (Replaces Stamina & Heal Salves)
  food: number;
  maxFood: number;
  water: number;
  maxWater: number;
  foodRations: number;
  maxFoodRations: number;
  waterCanteens: number;
  maxWaterCanteens: number;
  eggsCollected: number;
  eggInventory?: Partial<Record<BeastSpecies, number>>;
  // Flight & Physics State
  isFlying?: boolean;
  isJumping?: boolean;
  altitude?: number;
  airSpeed?: number;
  bodyTempC?: number;
  // Combat & Tactical Gear
  attackPower: number;
  defense: number;
  critChance: number;
  traps: number;
  maxTraps: number;
  lureStones: number;
  maxLureStones: number;
  // Legacy compatibility fields
  stamina: number;
  maxStamina: number;
  staminaRegenRate: number;
  healingFlasks: number;
  maxHealingFlasks: number;
}

export interface QuestStep {
  id: string;
  title: string;
  description: string;
  targetBiome: BiomeType;
  targetX: number;
  targetZ: number;
  completed: boolean;
}

export interface TrackClue {
  id: string;
  species: BeastSpecies;
  biome: BiomeType;
  x: number;
  y: number;
  z: number;
  discovered: boolean;
  clueType?: 'footprint' | 'claw_mark' | 'shed_scale' | 'charred_bone' | 'frozen_fur' | 'river_slide';
  description: string;
}

export type NPCId = 'chief_kael' | 'smith_torak' | 'forgemaster_torak' | 'scout_lyra';

export interface TribalNPC {
  id: NPCId;
  name: string;
  role: string;
  biome: BiomeType;
  x: number;
  y: number;
  z: number;
  rotation: number;
  greeting: string;
  tip?: string;
  giftMaterial?: { id: MaterialId; count: number; claimed: boolean };
}

export interface BeastopediaEntry {
  species: BeastSpecies;
  name: string;
  title: string;
  threatLevel: 1 | 2 | 3 | 4 | 5;
  biomeName: string;
  diet: string;
  sizeLabel: string;
  scientificName?: string;
  wingLoadingNm2?: string;
  metabolicOutput?: string;
  eggSpecs?: string;
  lore: string;
  tells: {
    name: string;
    cue: string;
    counter: string;
  }[];
  weaknesses: {
    part: string;
    multiplier: string;
    breakBonus: string;
  }[];
  huntingTips: string[];
  drops: string[];
  enrageTrigger: string;
}

export interface GameSettings {
  cameraSensitivity: number;
  mouseSensitivity: number;
  touchSensitivity: number;
  invertY: boolean;
  audioVolume: number;
  masterVolume: number;
  sfxVolume: number;
  musicVolume: number;
  sfxMuted: boolean;
  difficulty: 'story' | 'hunter' | 'savage' | 'apex';
  showDamageNumbers: boolean;
}

export interface SaveData {
  version: number;
  timestamp: number;
  playerName: string;
  biome: BiomeType;
  playerPos: { x: number; y: number; z: number };
  playerStats: PlayerStats;
  inventory: {
    materials: Record<string, number>;
    weapons: WeaponId[];
    equippedWeapon: WeaponId;
    armors: ArmorId[];
    equippedArmor: ArmorId;
    tools: ToolId[];
  };
  beastsHunted: BeastSpecies[];
  currentQuestIndex: number;
  signalTowerProgress: number;
  beaconLit: boolean;
  beastKnowledge: Record<BeastSpecies, BeastKnowledgeLevel>;
  currentWeather?: WeatherType;
  settings: GameSettings;
}
