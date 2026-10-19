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
  BiomeType,
  WeatherType,
  AtmosphericScienceState,
  CreatureEggNest,
  AdventureMission,
  DayNightState,
  PlayableCharacterId,
} from '../../types/game.ts';

export const PLAYABLE_CHARACTER_PROFILES: Record<
  PlayableCharacterId,
  {
    id: PlayableCharacterId;
    name: string;
    shortTitle: string;
    role: string;
    sketchfabId: string;
    modelUrl: string;
    moveSpeed: number;
    attackMultiplier: number;
    defenseBonus: number;
    accentHex: string;
  }
> = {
  demon_hunter: {
    id: 'demon_hunter',
    name: 'Demon Hunter',
    shortTitle: 'Glaive & Glide Specialist',
    role: 'Agile Melee & Aerial Glaive Specialist',
    sketchfabId: 'ff6a14371bc347d9a1526f5e64b29327',
    modelUrl: '/models/demon_hunter.glb',
    moveSpeed: 9.2,
    attackMultiplier: 1.25,
    defenseBonus: 8,
    accentHex: '#a855f7',
  },
  swat_operator: {
    id: 'swat_operator',
    name: 'S.W.A.T. Operator',
    shortTitle: 'Tactical Marksman',
    role: 'Tactical Ranged Marksman & Heavy Ordnance Specialist',
    sketchfabId: '9e82fabf26194896b5ad4a364d864eab',
    modelUrl: '/models/S.W.A.T.usdz',
    moveSpeed: 7.8,
    attackMultiplier: 1.35,
    defenseBonus: 18,
    accentHex: '#38bdf8',
  },
  bulky_knight: {
    id: 'bulky_knight',
    name: 'Bulky Knight',
    shortTitle: 'Heavy Tank & Forge Master',
    role: 'Heavy Tank, Campfire Forge Master & Leviathan Grappler',
    sketchfabId: '002a90cbf12941b792f968554687502c',
    modelUrl: '/models/bulky_knight.glb',
    moveSpeed: 6.4,
    attackMultiplier: 1.5,
    defenseBonus: 42,
    accentHex: '#f59e0b',
  },
};

/**
 * Pure function computing the Day-Night Cycle lighting parameters,
 * nocturnal beast aggression boost, and active diurnal/nocturnal gathering resource.
 */
export function computeDayNightCycle(rawHours: number): DayNightState {
  const timeOfDayHours = ((rawHours % 24) + 24) % 24;

  // Determine phase:
  // Dawn: 5.5 - 7.5
  // Day: 7.5 - 17.5
  // Dusk: 17.5 - 19.5
  // Night: 19.5 - 24.0 and 0.0 - 5.5
  let phase: DayNightState['phase'] = 'day';
  if (timeOfDayHours >= 19.5 || timeOfDayHours < 5.5) {
    phase = 'night';
  } else if (timeOfDayHours >= 5.5 && timeOfDayHours < 7.5) {
    phase = 'dawn';
  } else if (timeOfDayHours >= 17.5 && timeOfDayHours < 19.5) {
    phase = 'dusk';
  }

  const isNight = phase === 'night';

  // Smooth elevation factor of sun (-1 at midnight, +1 at noon)
  const sunAngle = ((timeOfDayHours - 6) / 24) * Math.PI * 2;
  const sunElev = Math.sin(sunAngle); // +1 at 12:00, 0 at 6:00/18:00, -1 at 0:00

  let sunIntensity = 2.35;
  let ambientIntensity = 1.15;
  let skyColorHex = 0x1e293b;
  let fogColorHex = 0x263244;

  if (phase === 'night') {
    sunIntensity = 0.45;
    ambientIntensity = 0.52;
    skyColorHex = 0x060a14;
    fogColorHex = 0x09101f;
  } else if (phase === 'dawn') {
    const t = (timeOfDayHours - 5.5) / 2.0;
    sunIntensity = Number((0.45 + t * 1.9).toFixed(2));
    ambientIntensity = Number((0.52 + t * 0.63).toFixed(2));
    skyColorHex = 0x2b1d38;
    fogColorHex = 0x3b2439;
  } else if (phase === 'dusk') {
    const t = (timeOfDayHours - 17.5) / 2.0;
    sunIntensity = Number((2.35 - t * 1.9).toFixed(2));
    ambientIntensity = Number((1.15 - t * 0.63).toFixed(2));
    skyColorHex = 0x2d192b;
    fogColorHex = 0x381e2c;
  } else {
    sunIntensity = Number((1.95 + Math.max(0, sunElev) * 0.45).toFixed(2));
    ambientIntensity = 1.15;
    skyColorHex = 0x1a2636;
    fogColorHex = 0x243242;
  }

  return {
    timeOfDayHours: Number(timeOfDayHours.toFixed(2)),
    phase,
    isNight,
    sunIntensity,
    ambientIntensity,
    skyColorHex,
    fogColorHex,
    beastAggressionMultiplier: isNight ? 1.35 : phase === 'dusk' ? 1.15 : 1.0,
    beastAggroRadiusMultiplier: isNight ? 1.45 : phase === 'dusk' ? 1.2 : 1.0,
    activeGatheringResource: isNight ? 'luminous_night_spore' : 'sun_herb',
  };
}

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
    name: 'Mithril Scout Vanguard Mail',
    tier: 1,
    defense: 12,
    maxHpBonus: 10,
    maxStaminaBonus: 0,
    dodgeStaminaReduction: 0,
    description: 'Light Roscrean chainmail and fluted mithril shoulder guards with a wind-swept royal cloak.',
    color: '#94a3b8',
    trimColor: '#eab308',
  },
  raptor_stalker_garb: {
    id: 'raptor_stalker_garb',
    name: 'Raptor-Crest Mithril Cuirass',
    tier: 2,
    defense: 22,
    maxHpBonus: 40,
    maxStaminaBonus: 25,
    dodgeStaminaReduction: 3,
    description: 'Articulated silver-blue mithril breastplate reinforced with feathered raptor scales.',
    color: '#64748b',
    trimColor: '#f59e0b',
  },
  bronto_plate_mail: {
    id: 'bronto_plate_mail',
    name: 'Roscrean Mithril Carapace Plate',
    tier: 3,
    defense: 36,
    maxHpBonus: 80,
    maxStaminaBonus: 35,
    dodgeStaminaReduction: 4,
    description: 'Heavy interlocking mithril tassets and coastal carapace plating with gilded trim.',
    color: '#38bdf8',
    trimColor: '#fbbf24',
  },
  thunder_warden_aegis: {
    id: 'thunder_warden_aegis',
    name: 'Mastercraft Mithril Armor Set',
    tier: 4,
    defense: 56,
    maxHpBonus: 140,
    maxStaminaBonus: 60,
    dodgeStaminaReduction: 6,
    description: 'Ornate Beyond Skyrim Mastercraft Mithril panoply with gold filigree, plumed helm, armored skirt & cape.',
    color: '#bae6fd',
    trimColor: '#facc15',
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
    id: 'craft_roasted_ration',
    name: 'Cook Roasted Beast Rations (+2)',
    category: 'tool',
    targetId: 'vitality_salve',
    description: 'Roast nutrient-dense beast cuts with sun-herbs (+650 kcal Food & +45 HP per ration).',
    tier: 1,
    ingredients: [
      { materialId: 'beast_bone', count: 1 },
      { materialId: 'sun_herb', count: 1 },
    ],
  },
  {
    id: 'craft_glacial_canteen',
    name: 'Purify Glacial Water Canteens (+2)',
    category: 'tool',
    targetId: 'vitality_salve',
    description: 'Filter crystal river water through coral stone (+600 mL Hydration & +25 HP per canteen).',
    tier: 1,
    ingredients: [{ materialId: 'coral_stone', count: 1 }],
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
  hp: 150,
  maxHp: 150,
  food: 2400,
  maxFood: 2400,
  water: 2000,
  maxWater: 2000,
  foodRations: 4,
  maxFoodRations: 8,
  waterCanteens: 4,
  maxWaterCanteens: 6,
  eggsCollected: 0,
  eggInventory: {},
  isFlying: false,
  isJumping: false,
  altitude: 1.8,
  airSpeed: 0,
  bodyTempC: 37.0,
  stamina: 110,
  maxStamina: 110,
  staminaRegenRate: 100,
  attackPower: 28,
  defense: 12,
  critChance: 0.14,
  healingFlasks: 0,
  maxHealingFlasks: 0,
  traps: 3,
  maxTraps: 5,
  lureStones: 6,
  maxLureStones: 8,
};

export const ADVENTURE_MISSIONS: AdventureMission[] = [
  {
    id: 'adv_wyvern_egg_heist',
    codeName: 'OP-01 · WYVERN TRENCH HEIST',
    title: 'Aetherial Sky-Dragon Egg Heist',
    category: 'heist',
    biome: 'caldera',
    targetX: -18,
    targetZ: -44,
    stages: [
      'RECON: Activate Mithril Flight [V] and ride a thermal updraft column above 14m altitude',
      'INFILTRATE: Locate a glowing Creature or Sky-Dragon Egg Nest and extract the Egg [E]',
      'ESCAPE: Outfly or defeat the pursuing Aetherial Sky-Wyvern in aerial or ground combat',
    ],
    currentStage: 0,
    completed: false,
    rewardSummary: '+1 Sky-Dragon Egg · +650 kcal Nutrition · Unlocks Dragon Lore',
  },
  {
    id: 'adv_hydro_ambush',
    codeName: 'OP-02 · HYDROLOGICAL EXTRACTION',
    title: 'Crystal River Snapjaw & Hydration Survey',
    category: 'science',
    biome: 'river',
    targetX: -22,
    targetZ: 14,
    stages: [
      'SAMPLE: Wade into the Crystal River and replenish Freshwater Canteens [H]',
      'EGG RECOVERY: Collect the submerged Snapjaw Leviathan Egg on the river shoal [E]',
      'HUNT: Slay or break the Hydro-Sail of the River Snapjaw Leviathan',
    ],
    currentStage: 0,
    completed: false,
    rewardSummary: '+1 Snapjaw Egg · Full Hydration · +2 Coral Stone',
  },
  {
    id: 'adv_glacial_expedition',
    codeName: 'OP-03 · CRYO-PEAK EXPEDITION',
    title: 'Cold Snow Mountain & Frostfang Ivory Heist',
    category: 'expedition',
    biome: 'snow',
    targetX: 58,
    targetZ: -18,
    stages: [
      'ASCENT: Fly or climb into the Eastern Cold Snow Mountains (< 0°C alpine zone)',
      'NEST RAID: Secure the Insulated Frostfang Egg from the glacier crag [E]',
      'TITAN CLASH: Break the Curved Glacial Ivory Tusks of the Frostfang Mammoth',
    ],
    currentStage: 0,
    completed: false,
    rewardSummary: '+1 Frostfang Egg · +2 Glacial Ivory · Mastercraft Mithril Blueprint',
  },
  {
    id: 'adv_coastal_fortress',
    codeName: 'OP-04 · BLACK COAST SIEGE',
    title: 'Brontoshell Carapace & Ocean Reef Raid',
    category: 'apex_hunt',
    biome: 'coast',
    targetX: 42,
    targetZ: 38,
    stages: [
      'SCOUT: Glide to the Black Sand Coast & Ocean Bay and locate the Brontoshell Nest',
      'BREACH: Use a Heavy Thrust [Right-Click] to crack the Brontoshell Behemoth head or tail club',
      'HARVEST: Carve coastal carapace plates for Roscrean Mithril armor reinforcement',
    ],
    currentStage: 0,
    completed: false,
    rewardSummary: '+1 Brontoshell Egg · +2 Bronto Carapace · +450 kcal Rations',
  },
  {
    id: 'adv_geothermal_capacitor',
    codeName: 'OP-05 · BIO-CAPACITOR HEIST',
    title: 'Thunderhorn Geothermal Charge Operation',
    category: 'heist',
    biome: 'springs',
    targetX: -44,
    targetZ: -16,
    stages: [
      'SETUP: Place a Sinew Snare Trap [T] along the steaming sulfur springs trail',
      'LURE: Throw an Acoustic Lure Stone [R] and snare the Thunderhorn Prime',
      'EXTRACTION: Collect the Bio-Electric Thunderhorn Egg & Conductive Horn',
    ],
    currentStage: 0,
    completed: false,
    rewardSummary: '+1 Thunderhorn Egg · +2 Conductive Horn · +3 Obsidian Shard',
  },
  {
    id: 'adv_caldera_sovereign',
    codeName: 'OP-06 · FINALE: SOVEREIGN STRIKE',
    title: 'Ignis-Rex & The Ancient Signal Beacon',
    category: 'apex_hunt',
    biome: 'caldera',
    targetX: 0,
    targetZ: -62,
    stages: [
      'PREP: Maintain > 1,200 kcal Food & > 1,000 mL Water for peak metabolic regeneration',
      'CONFRONTATION: Defeat Ignis-Rex the Caldera Titan or Aurelius the Sky-Dragon',
      'IGNITION: Carry the Sovereign Fang to the Signal Tower (0, 5) and ignite the Beacon [E]',
    ],
    currentStage: 0,
    completed: false,
    rewardSummary: 'Island Sovereign Victory · Mastercraft Mithril Panoply Complete',
  },
];

export const INITIAL_EGG_NESTS: CreatureEggNest[] = [
  {
    id: 'nest_raptor',
    species: 'raptor',
    name: 'Feathered Raptor Clutch Egg',
    biome: 'jungle',
    x: -31,
    y: 0,
    z: 49,
    collected: false,
    eggWeightKg: 4.2,
    incubationTempC: 31.5,
    caloricValueKcal: 520,
  },
  {
    id: 'nest_snapjaw',
    species: 'snapjaw',
    name: 'Bioluminescent River Leviathan Egg',
    biome: 'river',
    x: -26,
    y: 0,
    z: 10,
    collected: false,
    eggWeightKg: 7.8,
    incubationTempC: 22.0,
    caloricValueKcal: 680,
  },
  {
    id: 'nest_brontoshell',
    species: 'brontoshell',
    name: 'Calcified Coastal Behemoth Egg',
    biome: 'coast',
    x: 48,
    y: 0,
    z: 42,
    collected: false,
    eggWeightKg: 14.5,
    incubationTempC: 28.0,
    caloricValueKcal: 780,
  },
  {
    id: 'nest_frostfang',
    species: 'frostfang',
    name: 'Cryo-Insulated Glacial Relic Egg',
    biome: 'snow',
    x: 64,
    y: 0,
    z: -22,
    collected: false,
    eggWeightKg: 18.0,
    incubationTempC: -4.0,
    caloricValueKcal: 920,
  },
  {
    id: 'nest_thunderhorn',
    species: 'thunderhorn',
    name: 'Piezoelectric Ceratopsian Egg',
    biome: 'springs',
    x: -49,
    y: 0,
    z: -20,
    collected: false,
    eggWeightKg: 12.4,
    incubationTempC: 38.5,
    caloricValueKcal: 840,
  },
  {
    id: 'nest_sky_dragon',
    species: 'sky_dragon',
    name: 'Aetherial Sky-Wyvern Dragon Egg',
    biome: 'caldera',
    x: -18,
    y: 0,
    z: -44,
    collected: false,
    eggWeightKg: 22.5,
    incubationTempC: 85.0,
    caloricValueKcal: 1250,
  },
  {
    id: 'nest_caldera_titan',
    species: 'caldera_titan',
    name: 'Molten Sovereign Titan Egg',
    biome: 'caldera',
    x: 8,
    y: 0,
    z: -66,
    collected: false,
    eggWeightKg: 28.0,
    incubationTempC: 110.0,
    caloricValueKcal: 1500,
  },
];

/**
 * Real Atmospheric & Fluid Physics Calculator:
 * Computes barometric pressure P(h), air density rho(h) via Ideal Gas Law,
 * biome + altitude temperature gradient, 3D wind vector, and thermal updraft lift.
 */
export function computeAtmosphericPhysics(
  x: number,
  y: number,
  z: number,
  biome: BiomeType,
  weather: WeatherType,
  timeSec: number
): AtmosphericScienceState {
  const altitudeM = Math.max(0, y * 12.5); // 1 world unit = 12.5m elevation scale

  // Biome base temperature at sea level (deg C)
  const biomeTempMap: Record<BiomeType, number> = {
    jungle: 27.5,
    coast: 24.0,
    river: 21.0,
    ocean: 22.5,
    springs: 34.0,
    lava: 42.0,
    caldera: 46.5,
    snow: -8.5,
  };
  const baseTemp = biomeTempMap[biome] ?? 25.0;
  const weatherTempOffset =
    weather === 'heavy_rain' ? -3.5 : weather === 'dense_fog' ? -1.8 : weather === 'ash_storm' ? 4.5 : 0;

  // Tropospheric lapse rate: -6.5 C per 1000m
  const temperatureC = Number((baseTemp + weatherTempOffset - (altitudeM / 1000) * 6.5).toFixed(1));
  const tempKelvin = temperatureC + 273.15;

  // Barometric formula: P = P0 * (1 - 0.0065 * h / T0)^5.25588
  const pressureHpa = Number(
    (1013.25 * Math.pow(Math.max(0.1, 1 - (0.0065 * altitudeM) / 288.15), 5.25588)).toFixed(1)
  );

  // Ideal gas law for dry air: rho = P / (R_specific * T), R_specific = 287.058 J/(kg*K)
  const airDensityKgM3 = Number(((pressureHpa * 100) / (287.058 * tempKelvin)).toFixed(3));

  // Wind speed & vector (higher at altitude and during storms)
  const weatherWindMult =
    weather === 'ash_storm' ? 2.1 : weather === 'heavy_rain' ? 1.65 : weather === 'dense_fog' ? 0.65 : 1.0;
  const windAngle = 0.65 + Math.sin(timeSec * 0.12) * 0.35;
  const windSpeedMs = Number(
    ((4.2 + altitudeM * 0.018 + Math.sin(timeSec * 0.45 + x * 0.03) * 1.4) * weatherWindMult).toFixed(1)
  );

  const windVector = {
    x: Number((Math.cos(windAngle) * windSpeedMs).toFixed(2)),
    y: Number((Math.sin(timeSec * 0.7) * 0.35).toFixed(2)),
    z: Number((Math.sin(windAngle) * windSpeedMs).toFixed(2)),
  };

  // Thermal updraft velocity (m/s) over volcanic caldera, geothermal springs, or high ridges
  let thermalLiftMs = 0;
  if (biome === 'caldera' || biome === 'lava') {
    thermalLiftMs = 5.4;
  } else if (biome === 'springs') {
    thermalLiftMs = 3.8;
  } else if (biome === 'snow' && altitudeM > 60) {
    thermalLiftMs = 2.6; // Ridge lift
  }

  // Relative humidity (%)
  const humidityMap: Record<BiomeType, number> = {
    river: 88,
    ocean: 84,
    jungle: 78,
    springs: 92,
    coast: 74,
    snow: 48,
    lava: 22,
    caldera: 18,
  };
  const humidityPercent = Math.min(
    100,
    Math.round((humidityMap[biome] ?? 65) + (weather === 'heavy_rain' ? 18 : 0))
  );

  return {
    altitudeM: Math.round(altitudeM),
    airDensityKgM3,
    pressureHpa,
    temperatureC,
    windSpeedMs,
    windDirectionDeg: Math.round(((windAngle * 180) / Math.PI + 360) % 360),
    windVector,
    thermalLiftMs,
    aerodynamicLiftN: Math.round(0.5 * airDensityKgM3 * windSpeedMs * windSpeedMs * 4.8 * 1.15),
    metabolicRateKcalHr: Math.round(
      320 + (temperatureC < 5 ? (5 - temperatureC) * 12 : 0) + (temperatureC > 35 ? (temperatureC - 35) * 9 : 0)
    ),
    humidityPercent,
  };
}

/**
 * Pure function modeling human survival metabolism (Food kcal & Water mL) and natural HP homeostasis.
 * Replaces arbitrary Stamina & Heal Flasks with biologically grounded nutrition and hydration.
 */
export function computeSurvivalMetabolism(
  stats: PlayerStats,
  atmo: AtmosphericScienceState,
  isMoving: boolean,
  isFlying: boolean,
  inFreshWater: boolean,
  dt: number
): PlayerStats {
  const next = { ...stats };

  // Caloric expenditure (kcal/s)
  const activityMult = isFlying ? 2.4 : isMoving ? 1.65 : 1.0;
  const coldThermogenesis = atmo.temperatureC < 0 ? 1.45 : 1.0;
  const kcalBurnPerSec = 1.15 * activityMult * coldThermogenesis;
  next.food = Math.max(0, next.food - kcalBurnPerSec * dt);

  // Hydration flux (mL/s): standing in freshwater river/springs rehydrates automatically
  if (inFreshWater) {
    next.water = Math.min(next.maxWater, next.water + 85 * dt);
    next.waterCanteens = next.maxWaterCanteens;
  } else {
    const heatSweatMult = atmo.temperatureC > 32 ? 2.1 : atmo.temperatureC > 26 ? 1.35 : 0.9;
    const waterLossPerSec = 1.1 * activityMult * heatSweatMult;
    next.water = Math.max(0, next.water - waterLossPerSec * dt);
  }

  // Core body temperature homeostasis (36.5C - 37.8C normal)
  const targetBodyTemp =
    37.0 + (atmo.temperatureC - 24.0) * 0.035 + (isMoving || isFlying ? 0.25 : 0);
  next.bodyTempC = Number(targetBodyTemp.toFixed(1));

  // Natural cellular regeneration when nourished (Food > 35% and Water > 35%)
  const foodRatio = next.food / Math.max(1, next.maxFood);
  const waterRatio = next.water / Math.max(1, next.maxWater);
  if (foodRatio > 0.35 && waterRatio > 0.35 && next.hp > 0 && next.hp < next.maxHp) {
    const regenRate = foodRatio > 0.7 && waterRatio > 0.7 ? 4.2 : 2.1;
    next.hp = Math.min(next.maxHp, next.hp + regenRate * dt);
  }

  return next;
}

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
    case 'sky_dragon':
      return [
        {
          id: 'dragon_aether_crest',
          name: 'Draconic Flame-Gland Maw',
          localOffset: { x: 0, y: 2.2, z: 2.9 },
          radius: 1.55,
          damageMultiplier: 1.75,
          partHp: 180,
          maxPartHp: 180,
          broken: false,
          bonusDropMaterialId: 'dragon_scale',
        },
        {
          id: 'dragon_wing_membrane',
          name: 'Aetherial Wing Patagium',
          localOffset: { x: 0, y: 2.5, z: 0.2 },
          radius: 1.85,
          damageMultiplier: 1.55,
          partHp: 160,
          maxPartHp: 160,
          broken: false,
          bonusDropMaterialId: 'magma_core',
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

export interface DayNightCycleMetrics {
  timeOfDayHours: number;
  phase: 'dawn' | 'day' | 'dusk' | 'night';
  isNight: boolean;
  sunElevationSin: number;
  sunIntensity: number;
  moonIntensity: number;
  beastAggressionMultiplier: number;
  beastDetectionRangeBonus: number;
  nocturnalResourceBonusCount: number;
  bonusResourceId: string;
}

/**
 * Pure function calculating the Day-Night Cycle state from a 24-hour clock (0..24):
 * - Updates lighting intensities (sun vs moon)
 * - Increases beast aggression & detection radius at night
 * - Changes available gathering resources at night (nocturnal bioluminescent drops)
 */
export function computeDayNightCycleState(
  timeOfDayHours: number,
  biome: BiomeType = 'jungle'
): DayNightCycleMetrics {
  const normalizedHours = ((timeOfDayHours % 24) + 24) % 24;
  const phase: 'dawn' | 'day' | 'dusk' | 'night' =
    normalizedHours >= 5.5 && normalizedHours < 7.5
      ? 'dawn'
      : normalizedHours >= 7.5 && normalizedHours < 17.5
      ? 'day'
      : normalizedHours >= 17.5 && normalizedHours < 19.5
      ? 'dusk'
      : 'night';

  const isNight = phase === 'night' || phase === 'dusk';
  const sunAngle = ((normalizedHours - 6) / 24) * Math.PI * 2;
  const sunElevationSin = Number(Math.sin(sunAngle).toFixed(4));
  const dayFactor = Math.max(0, Math.min(1, (sunElevationSin + 0.15) / 1.15));

  const sunIntensity = Number((0.18 + dayFactor * 2.25).toFixed(2));
  const moonIntensity = Number((0.35 + (1 - dayFactor) * 0.95).toFixed(2));

  const beastAggressionMultiplier = isNight ? 1.35 : 1.0;
  const beastDetectionRangeBonus = isNight ? 12 : 0;
  const nocturnalResourceBonusCount = isNight ? 1 : 0;
  const bonusResourceId =
    biome === 'caldera' || biome === 'lava' ? 'magma_core' : 'glow_moss';

  return {
    timeOfDayHours: Number(normalizedHours.toFixed(2)),
    phase,
    isNight,
    sunElevationSin,
    sunIntensity,
    moonIntensity,
    beastAggressionMultiplier,
    beastDetectionRangeBonus,
    nocturnalResourceBonusCount,
    bonusResourceId,
  };
}

