/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { BeastSpecies, BeastopediaEntry, NPCId, PlayableCharacterId } from '../../types/game.ts';

export type EnvironmentModelId =
  | 'snow_mountain'
  | 'river_ocean'
  | 'trees_canopy'
  | 'stones_boulders'
  | 'grass_shrubs'
  | 'river_fish';

export interface SketchfabAssetSpec {
  id: string;
  title: string;
  category: 'character' | 'creature' | 'vehicle' | 'environment';
  sketchfabModelId: string;
  embedUrl: string;
  localModelPath: string;
  roleOrBiome: string;
  skeletalSummary: string;
}

export const SKETCHFAB_ASSET_REGISTRY: SketchfabAssetSpec[] = [
  {
    id: 'demon_hunter',
    title: 'Demon Hunter',
    category: 'character',
    sketchfabModelId: 'ff6a14371bc347d9a1526f5e64b29327',
    embedUrl: 'https://sketchfab.com/models/ff6a14371bc347d9a1526f5e64b29327/embed',
    localModelPath: '/models/demon_hunter.glb',
    roleOrBiome: 'Playable Hero 1 · Agile Melee & Aerial Glaive Specialist',
    skeletalSummary: 'Breathing chest, 4s head scan, 22° sprint lean, Twin Slash 45° spine twist, Demon Vault 360° spin & spectral wings, Shadow Dash.',
  },
  {
    id: 'swat_operator',
    title: 'S.W.A.T. Operator with Gun',
    category: 'character',
    sketchfabModelId: '9e82fabf26194896b5ad4a364d864eab',
    embedUrl: 'https://sketchfab.com/models/9e82fabf26194896b5ad4a364d864eab/embed',
    localModelPath: '/models/S.W.A.T.usdz',
    roleOrBiome: 'Playable Hero 2 · Tactical Ranged Marksman & Heavy Ordnance Specialist',
    skeletalSummary: 'Upper/lower body split aim, ADS shoulder stock alignment, damped recoil impulse, muzzle flash PointLight & brass shell ejection, Tactical Dive.',
  },
  {
    id: 'bulky_knight',
    title: 'Bulky Knight',
    category: 'character',
    sketchfabModelId: '002a90cbf12941b792f968554687502c',
    embedUrl: 'https://sketchfab.com/models/002a90cbf12941b792f968554687502c/embed',
    localModelPath: '/models/bulky_knight.glb',
    roleOrBiome: 'Playable Hero 3 · Heavy Tank, Campfire Forge Master & Leviathan Grappler',
    skeletalSummary: 'Heavy footstep shake & heel dust puffs, spring-lag pauldrons, 35° Heavy Cleave windup, Iron Bulwark 80% block, Earthshatter Slam.',
  },
  {
    id: 'dragon_boss',
    title: 'Dragon Character 3D (Apex Boss)',
    category: 'creature',
    sketchfabModelId: '7bad9ad76293430f8e5bb24cd499c53b',
    embedUrl: 'https://sketchfab.com/models/7bad9ad76293430f8e5bb24cd499c53b/embed',
    localModelPath: '/models/Dragon_Character_3d_by_Oscar_Creativo.usdz',
    roleOrBiome: 'OP-01 Guardian · DAE Diorama Forest & Wyvern Ravine',
    skeletalSummary: 'Multi-jointed wing flapping with -0.4 rad phalange phase wave, 3-segment neck look-at tracking, 40° Jaw fire breath, S-curve tail whip.',
  },
  {
    id: 'armor_dinosaur',
    title: 'Armor Dinosaur',
    category: 'creature',
    sketchfabModelId: '0f50cb2eb3ed4242815382371518de01',
    embedUrl: 'https://sketchfab.com/models/0f50cb2eb3ed4242815382371518de01/embed',
    localModelPath: '/models/armor_dinasour.glb',
    roleOrBiome: 'Heavy Armored Terrestrial Juggernaut · Fern Forest',
    skeletalSummary: 'Heavy alternating stomp gait, 0.2x dorsal armor spark deflection vs 1.8x exposed Core, 14m/s Bull Charge, tamable Spine_Mount_Socket.',
  },
  {
    id: 'jason_t',
    title: 'Jason T — Apex Ravine Stalker',
    category: 'creature',
    sketchfabModelId: 'e16a75e16de8468bbf7f39d8f8ba5daa',
    embedUrl: 'https://sketchfab.com/models/e16a75e16de8468bbf7f39d8f8ba5daa/embed',
    localModelPath: '/models/jason_t.glb',
    roleOrBiome: 'High-Speed Predatory Stalker (River Snapjaw Leviathan Class)',
    skeletalSummary: 'Low horizontal spine posture, avian-stabilized head lock, rapid digitigrade stride, 12m Ambush Pounce, Head-shot lunge interrupt.',
  },
  {
    id: 'triceratops_beetle',
    title: 'Triceratops Beetle',
    category: 'creature',
    sketchfabModelId: 'd9d16acc41084435b32740806c164e6d',
    embedUrl: 'https://sketchfab.com/models/d9d16acc41084435b32740806c164e6d/embed',
    localModelPath: '/models/triceratops.glb',
    roleOrBiome: 'Chitinous Horned Behemoth · Mystic Forest',
    skeletalSummary: '6-legged insectoid tripod gait (L1,R2,L3 vs R1,L2,R3), 3-horned cranial uppercut, 55° split Elytra wing-casings with high-frequency buzz.',
  },
  {
    id: 'space_fighter',
    title: 'Space Fighter (6-DOF Intercept Craft)',
    category: 'vehicle',
    sketchfabModelId: 'e76613664871441289d37d44a4bbcd3b',
    embedUrl: 'https://sketchfab.com/models/e76613664871441289d37d44a4bbcd3b/embed',
    localModelPath: '/models/spacecraft.glb',
    roleOrBiome: 'Base Camp Landing Pad · 6-DOF Atmospheric Fighter',
    skeletalSummary: '-65° articulating Canopy_Node, auto-retracting Landing Gear above 5m, tilting Ailerons/Rudder, Dual Plasma Cannons & Afterburner.',
  },
  {
    id: 'mystic_forest',
    title: 'Zone 1 — Mystic Forest',
    category: 'environment',
    sketchfabModelId: '92d36829b8ab483fa39bf44289f7b089',
    embedUrl: 'https://sketchfab.com/models/92d36829b8ab483fa39bf44289f7b089/embed',
    localModelPath: '/models/a_forest_3_with_a_road_at_night_for_game.glb',
    roleOrBiome: 'Southern Base Camp, Space Fighter Pad & Triceratops Beetle Habitat',
    skeletalSummary: 'Ancient glowing trees, volumetric fog, floating cyan spores, Campfire Forge, and nocturnal Luminous Night-Spores.',
  },
  {
    id: 'fern_forest',
    title: 'Zone 2 — Fern Forest Realistic Collection',
    category: 'environment',
    sketchfabModelId: 'e3fb505d5f6d47118da83ebacf92929c',
    embedUrl: 'https://sketchfab.com/models/e3fb505d5f6d47118da83ebacf92929c/embed',
    localModelPath: '/models/a_forest_3_with_a_road_at_night_for_game.glb',
    roleOrBiome: 'Central Riverbanks, Bending Fern Undergrowth & Predator Stalking Grounds',
    skeletalSummary: 'Dense realistic fern clusters that bend when characters walk through them, patrolled by Jason T and Armor Dinosaurs.',
  },
  {
    id: 'diorama_forest',
    title: 'Zone 3 — DAE Diorama Forest Loner & Wyvern Ravine',
    category: 'environment',
    sketchfabModelId: '7a758231ff474a32900f32a82b8ea827',
    embedUrl: 'https://sketchfab.com/models/7a758231ff474a32900f32a82b8ea827/embed',
    localModelPath: '/models/a_forest_3_with_a_road_at_night_for_game.glb',
    roleOrBiome: 'High-Altitude Rocky Canyon Cliffs, Thermal Updrafts & Dragon Nests',
    skeletalSummary: 'Rising 3D Thermal Updraft Wind Columns (>14m altitude), glowing Sky-Dragon Egg nests, and Apex Dragon Boss.',
  },
];

export interface CharacterAtlasEntry {
  id: NPCId | 'hunter_koa' | PlayableCharacterId;
  name: string;
  role: string;
  biomeName: string;
  weaponOrTool: string;
  sketchfabEmbedUrl?: string;
  lore: string;
  traits: string[];
}

export interface EnvironmentAtlasEntry {
  id: EnvironmentModelId;
  name: string;
  category: string;
  biomeName: string;
  description: string;
  features: string[];
}

export const CHARACTER_ATLAS_ENTRIES: CharacterAtlasEntry[] = [
  {
    id: 'demon_hunter',
    name: 'Demon Hunter (Hero 1)',
    role: 'Agile Melee & Aerial Glaive Specialist',
    biomeName: 'All Island Biomes & Thermal Updrafts',
    weaponOrTool: 'Twin Shadow Glaives · Spectral Glide Wings · Shadow Dash',
    sketchfabEmbedUrl: 'https://sketchfab.com/models/ff6a14371bc347d9a1526f5e64b29327/embed',
    lore: 'Loaded from demon_hunter.glb (Model ID: ff6a14371bc347d9a1526f5e64b29327). Features breathing chest expansion, 4-second head scan, 22° sprint lean, 45° spine-twist Twin Slash, 360° Demon Vault with spectral wings, and purple-afterimage Shadow Dash.',
    traits: [
      'Tap STRIKE: Twin Slash (140ms horizontal arc + 45° Spine twist)',
      'Swipe Up STRIKE: Demon Vault & 360° Double-Jump Spectral Wing Glide',
      'Swipe Down STRIKE: Shadow Dash (8m forward crouch dash with i-frames)',
    ],
  },
  {
    id: 'swat_operator',
    name: 'S.W.A.T. Operator with Gun (Hero 2)',
    role: 'Tactical Ranged Marksman & Heavy Ordnance Specialist',
    biomeName: 'Fern Forest & Tactical Perimeter',
    weaponOrTool: 'Scoped Tactical Carbine · Electro-Net Mine · Muzzle Flash & Brass Ejection',
    sketchfabEmbedUrl: 'https://sketchfab.com/models/9e82fabf26194896b5ad4a364d864eab/embed',
    lore: 'Loaded from S.W.A.T.usdz (Model ID: 9e82fabf26194896b5ad4a364d864eab). Uses upper/lower body split blending for 8-directional strafing while aiming at the crosshair, ADS shoulder alignment on Focus, damped spring recoil, and full-body Tactical Dive.',
    traits: [
      'Hold Focus: Aim-Down-Sights (ADS) raising stock to right shoulder & 12° head tilt',
      'Tap STRIKE: High-velocity rifle fire with PointLight muzzle flash & brass shell ejection',
      'Tap DODGE: 450ms full-body combat roll into kneeling firing stance',
    ],
  },
  {
    id: 'bulky_knight',
    name: 'Bulky Knight (Hero 3)',
    role: 'Heavy Tank, Campfire Forge Master & Leviathan Grappler',
    biomeName: 'Mystic Forest Campfire & Caldera Frontline',
    weaponOrTool: 'Colossal Greataxe / Siege Lance · Iron Bulwark Shield',
    sketchfabEmbedUrl: 'https://sketchfab.com/models/002a90cbf12941b792f968554687502c/embed',
    lore: 'Loaded from bulky_knight.glb (Model ID: 002a90cbf12941b792f968554687502c). Features heavy-impact footsteps that shake the camera and kick up heel dust puffs, spring-lag pauldrons, 80% damage-reduction Iron Bulwark block, and Earthshatter Slam.',
    traits: [
      'Tap STRIKE: 35° hip/spine windup into 3.5m Heavy Cleave / Thrust',
      'Hold Focus: Iron Bulwark shield wall (-80% incoming damage & fireball deflection)',
      'Swipe Up STRIKE: Earthshatter Slam creating an expanding stun shockwave ring',
    ],
  },
  {
    id: 'hunter_koa',
    name: 'Koa · Mastercraft Mithril Vanguard',
    role: 'Mithril Dragon-Knight & Island Vanguard',
    biomeName: 'All Island Biomes & Stratospheric Airways',
    weaponOrTool: 'Mastercraft Mithril Armor Set (Beyond Skyrim2) · Aetherial Flight Wings',
    sketchfabEmbedUrl: 'https://sketchfab.com/models/3ae9057e840e4da0bf05269865c29c91/embed',
    lore: 'Clad in the ornate Mastercraft Mithril Armor Set for Beyond Skyrim2, forged from silver-blue Mithril plate with gold filigree, royal cape, and deployable Aetherial Glider Wings.',
    traits: [
      'Instant GTA V Sky-Camera Character Swap between Demon Hunter, S.W.A.T., and Bulky Knight',
      'Can board the Space Fighter on the landing pad for 6-DOF atmospheric combat',
      'Biologically Grounded Food (kcal), Water (mL) & Creature Egg Survival Metabolism',
    ],
  },
  {
    id: 'chief_kael',
    name: 'Elder Chief Kael',
    role: 'Tribal Chieftain & Lorekeeper',
    biomeName: 'Mystic Forest Base Camp',
    weaponOrTool: 'Carved Mammoth-Ivory Totem Staff',
    lore: 'Keeper of the island’s oral history and ancestral maps at the central Campfire Haven.',
    traits: [
      'Provides hunting counsel and gifts Beast Bones when greeted',
      'Oversees the restoration of the Ancient Signal Tower',
    ],
  },
  {
    id: 'smith_torak',
    name: 'Forge-Master Torak',
    role: 'Obsidian & Bone Weaponsmith',
    biomeName: 'Campfire Haven Workbench',
    weaponOrTool: 'Heavy Basalt Anvil Hammer',
    lore: 'Tempers volcanic obsidian, armored dinosaur plates, and conductive horns over the camp forge.',
    traits: [
      'Gifts Obsidian Shards to aid weapon upgrades',
      'Assists with crafting Tier 2–4 weapons, armor, rations, and snare traps',
    ],
  },
  {
    id: 'scout_lyra',
    name: 'Scout Lyra',
    role: 'River Pathfinder & Ravine Ranger',
    biomeName: 'Fern Forest River Crossing',
    weaponOrTool: 'Recurve Bone Bow & Tracking Lens',
    lore: 'Stationed near the Crystal River bridge, Lyra tracks Jason T and Armor Dinosaurs across the Fern Forest.',
    traits: [
      'Shares tactical intelligence on nocturnal beast aggression and Focus Vision trails',
      'Gifts restorative Sun-Herbs harvested from the riverbank',
    ],
  },
];

export const ENVIRONMENT_ATLAS_ENTRIES: EnvironmentAtlasEntry[] = [
  {
    id: 'trees_canopy',
    name: 'Zone 1 — Mystic Forest (92d36829b8ab483fa39bf44289f7b089)',
    category: 'Ecological Zone 1 · Base Camp & Spaceport',
    biomeName: 'Mystic Forest & Southern Sanctuary',
    description: 'Ancient glowing forest loaded from a_forest_3_with_a_road_at_night_for_game.glb with volumetric fog, floating cyan spores, Campfire Forge, Space Fighter Landing Pad, and Triceratops Beetles.',
    features: [
      'Home to the Campfire Forge and Space Fighter Stone Landing Pad',
      'Spawns Sun-Herbs by day and glowing Luminous Night-Spores at night',
      'Patrolled by Chitinous Triceratops Beetles',
    ],
  },
  {
    id: 'grass_shrubs',
    name: 'Zone 2 — Fern Forest Realistic Collection (e3fb505d5f6d47118da83ebacf92929c)',
    category: 'Ecological Zone 2 · Predatory River Valley',
    biomeName: 'Dense Fern Forest & Crystal Riverbanks',
    description: 'Dense undergrowth and realistic fern clusters that bend dynamically when characters walk through them, prowled by Jason T and Armor Dinosaurs.',
    features: [
      '1,800 instanced fern and grass clusters with proximity vertex bending',
      'Ambush hunting grounds of Jason T (River Snapjaw Leviathan class)',
      'Heavy grazing territory of the tamable Armor Dinosaur',
    ],
  },
  {
    id: 'snow_mountain',
    name: 'Zone 3 — DAE Diorama Forest Loner & Wyvern Ravine (7a758231ff474a32900f32a82b8ea827)',
    category: 'Ecological Zone 3 · High-Altitude Crags & Thermals',
    biomeName: 'Wyvern Ravine, Alpine Crags & Caldera',
    description: 'High-altitude rocky canyon cliffs with rising 3D Thermal Updraft Wind Columns (>14m altitude), glowing Sky-Dragon Egg nests, and the patrolling Dragon Character 3D boss.',
    features: [
      'Rising convective thermal updraft columns for Demon Hunter & Space Fighter lift',
      'Guarded by the Apex Boss: Dragon Character 3D (7bad9ad76293430f8e5bb24cd499c53b)',
      'Stealing a glowing Dragon Egg triggers immediate aerial chase',
    ],
  },
  {
    id: 'river_ocean',
    name: 'Winding Crystal River & Surrounding Ocean',
    category: 'Hydrology, Riverbank & Marine Ecosystem',
    biomeName: 'Central River Valley & Island Perimeter Ocean',
    description: 'A turquoise river fed by alpine snowmelt that winds across the island under a timber bridge and empties into the surrounding 3D ocean.',
    features: [
      'Standing in freshwater automatically rehydrates Cellular Hydration (mL)',
      'Lined with wet river stones, reeds, and timber suspension bridge',
      'Schools of articulated 3D fish swimming along the channel',
    ],
  },
  {
    id: 'stones_boulders',
    name: 'Space Fighter Landing Pad & Volcanic Crags',
    category: '3D Structures & Geology',
    biomeName: 'All Biomes',
    description: 'Reinforced stone landing pad housing the playable Space Fighter (e76613664871441289d37d44a4bbcd3b) alongside destructible boulders and geothermal spires.',
    features: [
      'Interactive Space Fighter boarding within 3.5m of the landing pad',
      'Destructible barricades when riding a tamed Armor Dinosaur',
      'Glowing geothermal crystal seams and basalt columns',
    ],
  },
  {
    id: 'river_fish',
    name: 'Nocturnal & Diurnal Ecosystem Flora/Fauna',
    category: 'Dynamic Day-Night Ecology',
    biomeName: 'Island-Wide Ecosystem',
    description: 'Real-time Day-Night Cycle that shifts lighting, elevates nocturnal beast aggression (+35%), and transforms gathering nodes.',
    features: [
      'Daytime: Golden solar illumination & Sun-Herb gathering',
      'Nighttime: Moonlight shadows, +35% Beast Aggression & Luminous Night-Spores',
      'Focus Vision [F] reveals glowing 3D footprint tracking trails to nearby beasts',
    ],
  },
];

export const BEASTOPEDIA_ENTRIES: Record<BeastSpecies, BeastopediaEntry> = {
  sky_dragon: {
    species: 'sky_dragon',
    name: 'Dragon Character 3D · Aurelius Sky-Wyvern',
    title: 'Apex Guardian of OP-01 Wyvern Trench Heist',
    biomeName: 'Zone 3 · DAE Diorama Forest & Wyvern Ravine',
    threatLevel: 5,
    diet: 'Aerial Apex Carnivore & Thermal Glider',
    sizeLabel: '18.2m Wingspan · Model 7bad9ad76293430f8e5bb24cd499c53b',
    scientificName: 'Draconis aetherius volans',
    wingLoadingNm2: '342 N/m² (Multi-Joint Phalange Wave)',
    metabolicOutput: '14,800 kcal/hr (Volumetric Fire Breath)',
    eggSpecs: '22.5 kg · 85°C Volcanic Incubation · Triggers OnEggStolen Chase',
    lore: 'Loaded from Dragon_Character_3d_by_Oscar_Creativo.usdz (Sketchfab ID: 7bad9ad76293430f8e5bb24cd499c53b). Features multi-jointed wing flapping with -0.4 rad outer phalange phase delay, 3-segment neck look-at tracking, 40° jaw articulation with volumetric fire breath, and a 180° S-curve tail whip. Picking up a Dragon Egg immediately triggers its CHASE state.',
    enrageTrigger: 'OnEggStolen event or < 45% HP: Wing membranes and throat ignite cyan-orange; dealing 80+ damage to Wing hitboxes forces a GROUNDED crash-land.',
    tells: [
      {
        name: 'Volumetric Fire Breath Sweep',
        cue: '3-segment neck locks onto the active hero, Jaw rotates open 40° (0.7 rad), and throat glows orange-cyan.',
        counter: 'Use Bulky Knight Iron Bulwark (Focus) to deflect fireballs or strafe behind its neck.',
      },
      {
        name: '180° S-Curve Tail Whip & Claw Swoop',
        cue: 'Tail_01 through Tail_04 coil in a rapid sinusoidal wave when attacked from behind.',
        counter: 'Shadow Dash with Demon Hunter or fire S.W.A.T. rifle / Space Fighter plasma cannons into its Wing hitboxes (80+ dmg to ground it).',
      },
    ],
    weaknesses: [
      {
        part: 'Head & 40° Flame-Gland Jaw',
        multiplier: '1.75x Damage',
        breakBonus: 'Drops Aetherial Dragon Scale + interrupts fire breath',
      },
      {
        part: 'Articulated Wing Patagium (Wing_L / Wing_R)',
        multiplier: '1.55x Damage',
        breakBonus: 'Dealing 80+ damage shreds lift and forces GROUNDED crash-land state',
      },
    ],
    drops: ['Aetherial Dragon Scale', 'Apex Magma Heart', 'Sovereign Titan Fang'],
    huntingTips: [
      'Board the Space Fighter or use S.W.A.T. ADS rifle to deal 80+ damage to its Wings and force it to crash-land.',
      'Stealing a glowing Dragon Egg from the ravine nest immediately triggers OnEggStolen pursuit.',
    ],
  },
  brontoshell: {
    species: 'brontoshell',
    name: 'Armor Dinosaur · Terrestrial Juggernaut',
    title: 'Heavy Armored Behemoth & Tamable Living Tank',
    biomeName: 'Zone 2 · Fern Forest & Black Coast',
    threatLevel: 4,
    diet: 'Armored Lithovore (Tamable Mount)',
    sizeLabel: '11.2m Length · Model 0f50cb2eb3ed4242815382371518de01',
    lore: 'Loaded from armor_dinasour.glb (Sketchfab ID: 0f50cb2eb3ed4242815382371518de01). Features heavy alternating leg stomps with torso roll and vibrating dorsal scutes. Frontal and dorsal hits deflect off its armor with metallic sparks (0.2x damage), while flanking its unarmored Core deals 1.8x damage. Can be snared with a Trap and fed a Ration to mount!',
    enrageTrigger: 'At < 40% HP or when agitated, scrapes Foot_R twice kicking up dust clouds and executes a 14m/s Bull Charge.',
    tells: [
      {
        name: '14m/s Bull Charge',
        cue: 'Lowers Head and Neck parallel to the ground and scrapes Foot_R twice against the dirt.',
        counter: 'Dodge laterally, then flank its unarmored Core underbelly for 1.8x damage.',
      },
      {
        name: 'Dorsal Armor Deflection (0.2x)',
        cue: 'Angles its armored skull and dorsal carapace toward frontal attackers.',
        counter: 'Deploy a Trap (3) and feed it a Ration to tame and mount its Spine_Mount_Socket!',
      },
    ],
    weaknesses: [
      {
        part: 'Unarmored Flank & Underbelly Core',
        multiplier: '1.80x Damage',
        breakBonus: 'Drops Brontoshell Carapace + stuns juggernaut for 4.5s',
      },
      {
        part: 'Dorsal Armor & Front Skull (Armored)',
        multiplier: '0.20x Deflection',
        breakBonus: 'Spawns metallic spark deflection—flank to the side instead!',
      },
    ],
    drops: ['Brontoshell Carapace', 'Calcified Coral Stone', 'Dense Beast Bone'],
    huntingTips: [
      'Avoid hitting its front skull or dorsal shell (0.2x damage)—dodge to its flank to hit the Core for 1.8x damage.',
      'Catch it in a Trap and press Interact / Ration to mount and ride the Armor Dinosaur as a living tank!',
    ],
  },
  snapjaw: {
    species: 'snapjaw',
    name: 'Jason T — Apex Ravine Stalker (River Snapjaw Leviathan)',
    title: 'High-Speed Predatory Stalker (340 / 340 HP)',
    biomeName: 'Zone 2 · Fern Forest & Crystal River Ravine',
    threatLevel: 3,
    diet: 'Hyper-Carnivorous Ambush Stalker',
    sizeLabel: '10.4m Length · Model e16a75e16de8468bbf7f39d8f8ba5daa',
    lore: 'Loaded from jason_t.glb (Sketchfab ID: e16a75e16de8468bbf7f39d8f8ba5daa). Exhibits a low horizontal spine posture (0.25 rad), rapid digitigrade stride, and avian-stabilized head lock on prey with snapping jaw lunges. Stalks through the Fern Forest at half speed before executing a 12m horizontal Ambush Pounce.',
    enrageTrigger: 'AtNight or < 45% HP: Stalking speed and pounce frequency increase by 35%.',
    tells: [
      {
        name: '12m Ambush Pounce (vy=6, vFwd=16)',
        cue: 'Crouches in the bending ferns and leaps horizontally with jaws wide open to pin the player.',
        counter: 'Shoot or spear the Head weak point during its lunge to interrupt the pin and trigger a stunned stagger!',
      },
      {
        name: 'Rapid Jaw Bite Lunge',
        cue: 'Stabilized Head locks onto prey with zero vertical bobbing before snapping.',
        counter: 'Sidestep with Demon Hunter or block with Bulky Knight Iron Bulwark.',
      },
    ],
    weaknesses: [
      {
        part: 'Head (Interrupts Ambush Pounce)',
        multiplier: '1.65x Damage',
        breakBonus: 'Interrupts pounce pin + triggers long stunned stagger',
      },
      {
        part: 'Core & Legs',
        multiplier: '1.45x Damage',
        breakBonus: 'Drops Calcified Coral Stone + slows digitigrade sprint',
      },
    ],
    drops: ['Calcified Coral Stone', 'Raptor Talon', 'Dense Beast Bone'],
    huntingTips: [
      'Target the Head weak point while Jason T lunges to immediately interrupt its pounce and stun it.',
      'Use Focus Vision to reveal its glowing footprint trail winding through the Fern Forest.',
    ],
  },
  thunderhorn: {
    species: 'thunderhorn',
    name: 'Triceratops Beetle · Chitinous Horned Behemoth',
    title: '6-Legged Horned Behemoth & Hover Charger',
    biomeName: 'Zone 1 · Mystic Forest & Geothermal Springs',
    threatLevel: 4,
    diet: 'Chitinous Mineral & Spore Harvester',
    sizeLabel: '9.8m Length · Model d9d16acc41084435b32740806c164e6d',
    lore: 'Loaded from triceratops.glb (Sketchfab ID: d9d16acc41084435b32740806c164e6d). Moves with an authentic 6-legged insectoid tripod gait (L1,R2,L3 alternating with R1,L2,R3 every 0.25s). Pitches its massive 3-horned head down then violently upward to launch attackers, and splits its outer Elytra wing-casings 55° to buzz across chasms in hover charges.',
    enrageTrigger: 'When agitated, Elytra_L and Elytra_R split open 55° while translucent inner wings buzz at sin(t * 45) for hover charges.',
    tells: [
      {
        name: 'Three-Horned Cranial Uppercut',
        cue: 'Pitches Head_Horn_Node down (+0.5 rad) before snapping violently upward (-0.8 rad).',
        counter: 'Dodge sideways and strike the exposed Wing-Casings or Core.',
      },
      {
        name: '55° Elytra Split Hover Charge',
        cue: 'Hard outer shell casings split open 55° with a high-frequency wing buzz.',
        counter: 'Fire S.W.A.T. rifle into the open translucent wings to ground the beetle.',
      },
    ],
    weaknesses: [
      {
        part: 'Three-Horned Head Node',
        multiplier: '1.65x Damage',
        breakBonus: 'Drops Conductive Crest-Horn + massive knockdown',
      },
      {
        part: 'Split Elytra Wing-Casings',
        multiplier: '1.50x Damage',
        breakBonus: 'Drops Obsidian Shard + disables hover charge',
      },
    ],
    drops: ['Conductive Crest-Horn', 'Obsidian Shard', 'Dense Beast Bone'],
    huntingTips: [
      'Watch its 6-legged tripod gait and strike when its Elytra wing-casings split open 55°.',
      'Place a Trap along its Mystic Forest patrol spline to expose its Three-Horned Head.',
    ],
  },
  raptor: {
    species: 'raptor',
    name: 'Ravine Stalker Pack-Mate (Jason T Subspecies)',
    title: 'Swift Digitigrade Ravine Predator',
    biomeName: 'Zone 2 · Fern Forest Ravines',
    threatLevel: 2,
    diet: 'Carnivorous Pack Predator',
    sizeLabel: '7.2m Length · Model e16a75e16de8468bbf7f39d8f8ba5daa',
    lore: 'Agile juvenile subspecies of Jason T (jason_t.glb) that prowls the Fern Forest undergrowth with stabilized avian head tracking and rapid leaping bites.',
    enrageTrigger: 'At night or < 40% HP, pack aggression and leap velocity increase by 35%.',
    tells: [
      {
        name: 'Fern Ambush Leap',
        cue: 'Lowers spine parallel to the ferns and snaps jaws.',
        counter: 'Counter-slash with Demon Hunter Twin Slash or S.W.A.T. headshot.',
      },
    ],
    weaknesses: [
      {
        part: 'Head & Snapping Jaw',
        multiplier: '1.55x Damage',
        breakBonus: 'Drops Raptor Talon + knockdown stagger',
      },
      {
        part: 'Core & Tail',
        multiplier: '1.35x Damage',
        breakBonus: 'Drops Raptor Scale-Hide',
      },
    ],
    drops: ['Raptor Talon', 'Raptor Scale-Hide', 'Dense Beast Bone'],
    huntingTips: [
      'Interrupt its pounce with a headshot or Demon Vault.',
    ],
  },
  frostfang: {
    species: 'frostfang',
    name: 'Glacial Horned Behemoth (Alpine Triceratops)',
    title: 'Cryo-Chitin Colossus of the High Crags',
    biomeName: 'Zone 3 · High-Altitude Canyon & Snow Ridge',
    threatLevel: 4,
    diet: 'Alpine Permafrost Grazer',
    sizeLabel: '11.8m Length · Model d9d16acc41084435b32740806c164e6d',
    lore: 'High-altitude frost-adapted variant of the Horned Behemoth (triceratops.glb) whose three cranial horns are coated in glacial rime.',
    enrageTrigger: 'At < 45% HP, splits its frost-plated Elytra casings and unleashes sub-zero hover charges.',
    tells: [
      {
        name: 'Glacial Horn Uppercut',
        cue: 'Lowers three-horned crown into the snow before heaving upward.',
        counter: 'Evade laterally and strike its exposed flank.',
      },
    ],
    weaknesses: [
      {
        part: 'Glacial Cranial Horns',
        multiplier: '1.65x Damage',
        breakBonus: 'Drops Conductive Crest-Horn Ivory + stagger',
      },
      {
        part: 'Elytra Wing-Casing Core',
        multiplier: '1.45x Damage',
        breakBonus: 'Drops Dense Beast Bone',
      },
    ],
    drops: ['Conductive Crest-Horn', 'Dense Beast Bone', 'Obsidian Shard'],
    huntingTips: [
      'Use the Space Fighter or Bulky Knight Earthshatter Slam to crack its frost horns.',
    ],
  },
  caldera_titan: {
    species: 'caldera_titan',
    name: 'Ignis-Rex · Apex Volcanic Armor Titan',
    title: 'Sovereign Juggernaut of the Molten Caldera',
    biomeName: 'Zone 3 · Volcanic Caldera Summit',
    threatLevel: 5,
    diet: 'Apex Volcanic Juggernaut',
    sizeLabel: '15.4m Length · Model 0f50cb2eb3ed4242815382371518de01',
    lore: 'Colossal magma-infused apex variant of the Armor Dinosaur (armor_dinasour.glb) ruling the northern caldera. Frontal hits ricochet off its obsidian dorsal plates (0.2x), requiring hunters to flank its molten Core (1.8x).',
    enrageTrigger: 'At < 50% HP, magma veins flare orange-white and it chains 14m/s Bull Charges.',
    tells: [
      {
        name: 'Cataclysmic Bull Charge',
        cue: 'Scrapes right foot twice in volcanic ash and charges at 14m/s.',
        counter: 'Shadow Dash or Tactical Dive aside and strike its unarmored Core.',
      },
    ],
    weaknesses: [
      {
        part: 'Volcanic Heart Core (Flank)',
        multiplier: '1.80x Damage',
        breakBonus: 'Drops Sovereign Titan Fang & Apex Magma Heart',
      },
      {
        part: 'Obsidian Dorsal Armor (Armored)',
        multiplier: '0.20x Deflection',
        breakBonus: 'Deflects frontal blows with sparks—flank to the side!',
      },
    ],
    drops: ['Sovereign Titan Fang', 'Apex Magma Heart', 'Obsidian Shard'],
    huntingTips: [
      'Flank around its armored skull to hit the Volcanic Heart Core for 1.8x damage.',
    ],
  },
};
