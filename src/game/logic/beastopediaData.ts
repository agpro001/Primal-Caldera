/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { BeastSpecies, BeastopediaEntry, NPCId } from '../../types/game.ts';

export type EnvironmentModelId =
  | 'snow_mountain'
  | 'river_ocean'
  | 'trees_canopy'
  | 'stones_boulders'
  | 'grass_shrubs'
  | 'river_fish';

export interface CharacterAtlasEntry {
  id: NPCId | 'hunter_koa';
  name: string;
  role: string;
  biomeName: string;
  weaponOrTool: string;
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
    id: 'hunter_koa',
    name: 'Koa the Apex Tracker (You)',
    role: 'Lead Island Beast Hunter',
    biomeName: 'All Island Biomes',
    weaponOrTool: 'Flint Spear, Raptor Harpoon, Siege Lance & Caldera Glaive',
    lore: 'Trained to read every footprint, broken fern, and telegraphed roar across the island. Koa wears articulated tribal shoulder pauldrons, war-painted war bands, and customizable prehistoric armor.',
    traits: [
      '360° Camera-Relative Movement with Calibrated Front/Back/Left/Right Joystick',
      'Invulnerability-Frame Dodge Roll & Heavy Charged Spear Thrusts',
      'Hunter Focus Vision (F) revealing glowing beast trails & anatomical weak points',
    ],
  },
  {
    id: 'chief_kael',
    name: 'Elder Chief Kael',
    role: 'Tribal Chieftain & Lorekeeper',
    biomeName: 'Campfire Haven (Southern Valley)',
    weaponOrTool: 'Carved Mammoth-Ivory Totem Staff & Feathered Headdress',
    lore: 'Keeper of the island’s oral history and ancestral maps. Chief Kael guides hunters at the central Campfire Haven, marking the paths toward the Cold Snow Mountains, Crystal River, and Caldera Summit.',
    traits: [
      'Wears ceremonial crimson-and-gold feathered crown and bone chestplate',
      'Provides hunting counsel and gifts Beast Bones when spoken to with [E]',
      'Oversees the restoration of the Ancient Signal Tower',
    ],
  },
  {
    id: 'smith_torak',
    name: 'Forge-Master Torak',
    role: 'Obsidian & Bone Weaponsmith',
    biomeName: 'Campfire Haven Workbench',
    weaponOrTool: 'Heavy Basalt Anvil Hammer & Heat-Resistant Bronto Apron',
    lore: 'A muscular tribal artisan who tempers volcanic obsidian, coastal carapace plates, and glacial ivory over the roaring camp forge.',
    traits: [
      'Wields a massive basalt forge hammer with glowing ember runes',
      'Gifts Obsidian Shards to aid your weapon upgrades when greeted with [E]',
      'Assists with crafting Tier 2–4 spears, lances, and armor sets',
    ],
  },
  {
    id: 'scout_lyra',
    name: 'Scout Lyra',
    role: 'River Pathfinder & Alpine Ranger',
    biomeName: 'Crystal River Crossing & Alpine Foothills',
    weaponOrTool: 'Recurve Bone Bow, Quiver & Camouflage Fern Cloak',
    lore: 'Stationed near the Crystal River bridge, Lyra monitors the amphibious River Snapjaw Leviathan and tracks the Frostfang Mammoth across the eastern snow peaks.',
    traits: [
      'Equipped with a feathered camouflage cloak and river-reed quiver',
      'Shares tactical intelligence on river and snow-mountain beasts [E]',
      'Gifts restorative Sun-Herbs harvested from the riverbank',
    ],
  },
];

export const ENVIRONMENT_ATLAS_ENTRIES: EnvironmentAtlasEntry[] = [
  {
    id: 'snow_mountain',
    name: 'Cold Snow Mountains & Glacial Peaks',
    category: 'Alpine Biome & Elevation Landform',
    biomeName: 'Eastern Glacial Range',
    description: 'Towering jagged granite mountains crowned with deep snow caps, translucent blue glacial ice spires, snow-dusted pine trees, and drifting frost mist.',
    features: [
      'Multi-peak 3D mountain geometry with steep rocky crags and snow-capped ridges',
      'Translucent turquoise-blue glacial ice crystals and frozen boulders',
      'Home to the colossal Frostfang Glacial Mammoth',
    ],
  },
  {
    id: 'river_ocean',
    name: 'Winding Crystal River & Surrounding Ocean',
    category: 'Hydrology, Riverbank & Marine Ecosystem',
    biomeName: 'Central River Valley & Island Perimeter Ocean',
    description: 'A sparkling turquoise river fed by alpine snowmelt that winds across the island under a wooden tribal bridge and empties into the vast surrounding 3D ocean.',
    features: [
      'Animated 3D river currents, shoreline foam, and deep ocean swells',
      'Lined with smooth wet river stones, reeds, and a timber suspension bridge',
      'Patrolled by the River Snapjaw Leviathan and schools of swimming 3D fish',
    ],
  },
  {
    id: 'trees_canopy',
    name: 'Prehistoric Trees (Jungle Banyan, Alpine Pine & Coastal Palm)',
    category: '3D Flora & Forest Canopy',
    biomeName: 'Jungle, Snow Mountains & Black Sand Coast',
    description: 'Detailed multi-tiered 3D trees including buttress-rooted jungle banyans, snow-capped alpine conifers, and curved coastal coconut palms.',
    features: [
      'Flared root buttresses, textured bark trunks, and layered 3D leaf crowns',
      'Snow-dusted needle tiers on high-altitude mountain pines',
      'Curved palm trunks with radiating fronds and coconuts along the ocean shore',
    ],
  },
  {
    id: 'stones_boulders',
    name: 'Mountain Boulders, River Stones & Volcanic Crags',
    category: '3D Geology & Rock Formations',
    biomeName: 'All Biomes',
    description: 'Faceted granite boulders, smooth water-worn river cobbles, mossy jungle rocks, snow-capped alpine stones, and glowing obsidian spires.',
    features: [
      'Multi-rock clusters with moss caps, snow patches, or wet river sheen',
      'Natural collision and cover landmarks across the 420m x 420m island',
      'Glowing geothermal crystal seams and volcanic basalt columns',
    ],
  },
  {
    id: 'grass_shrubs',
    name: 'Lush Grass Tufts, Berry Shrubs & Prehistoric Ferns',
    category: '3D Groundcover & Undergrowth',
    biomeName: 'Jungle Valley, Riverbanks & Foothills',
    description: 'Dense 3D ground vegetation featuring multi-blade swaying grass tufts, flowering berry shrubs, river reeds, and unfurling prehistoric fern fronds.',
    features: [
      'Clustered 3D grass blades with varied heights and natural green-gold hues',
      'Rounded woody shrubs dotted with vibrant red and amber prehistoric berries',
      'Rosette fern fronds and tall riverbank cattail reeds',
    ],
  },
  {
    id: 'river_fish',
    name: 'Prehistoric Armored River & Ocean Fish',
    category: 'Aquatic Wildlife',
    biomeName: 'Crystal River & Coastal Ocean Shallows',
    description: 'Schools of iridescent prehistoric fish with dorsal sails, pectoral fins, and articulated tail flukes swimming along the river channel and coastal bay.',
    features: [
      'Streamlined 3D body with metallic turquoise scales and orange fins',
      'Real-time swimming undulation and schooling trajectories in the water',
      'Brings the river and ocean ecosystems to life',
    ],
  },
];

export const BEASTOPEDIA_ENTRIES: Record<BeastSpecies, BeastopediaEntry> = {
  raptor: {
    species: 'raptor',
    name: 'Razor-Crest Raptor Alpha',
    title: 'Pack Terror of the Ravines',
    biomeName: 'Emerald Cycad Jungle',
    threatLevel: 2,
    diet: 'Carnivorous Pack Predator',
    sizeLabel: '6.8m Length · 2.6m Height',
    lore: 'The apex sprinter of the island lowlands. Raptor Alphas coordinate swift flank attacks with terrifying intelligence. Their iridescent crimson-and-gold feathered crests flush bright scarlet to signal pack lunges, while their curved sickle talons can slice through hardened timber.',
    enrageTrigger: 'At < 40% HP, volcanic adrenaline flushes its crest blazing orange and increases leap speed by 40%.',
    tells: [
      {
        name: 'Pounce Windup',
        cue: 'Lowers feathered torso to the ground, spreads winged forelimbs, and hisses with a crimson crest flash.',
        counter: 'Dodge roll sideways perpendicular to its line of sight, then strike the head crest during recovery.',
      },
      {
        name: 'Spinning Tail Whip',
        cue: 'Pivots head over shoulder and coils its stiffened counterbalance tail.',
        counter: 'Roll backward out of tail radius or iframe through the sweep.',
      },
    ],
    weaknesses: [
      {
        part: 'Feathered Skull Crest',
        multiplier: '1.55x Damage',
        breakBonus: 'Drops extra Raptor Talon + causes long knockdown stagger',
      },
      {
        part: 'Counterbalance Tail Plume',
        multiplier: '1.35x Damage',
        breakBonus: 'Drops Raptor Scale-Hide + reduces pounce distance',
      },
    ],
    drops: ['Raptor Talon', 'Raptor Scale-Hide', 'Dense Beast Bone'],
    huntingTips: [
      'Throw a Lure Stone [R] near a Sinew Snare Trap [T] to lock the Raptor Alpha in place.',
      'Use Heavy Thrusts [Right Click] on its Feathered Skull Crest right after it misses a lunge.',
    ],
  },
  snapjaw: {
    species: 'snapjaw',
    name: 'River Snapjaw Leviathan',
    title: 'Amphibious Predator of River & Ocean',
    biomeName: 'Crystal River & Coastal Shallows',
    threatLevel: 3,
    diet: 'Piscivorous & Ambush Apex',
    sizeLabel: '10.4m Length · 3.1m Height',
    lore: 'An armored prehistoric crocodilian-spinosaur leviathan that rules the winding Crystal River and ocean delta. Covered in turquoise-slate osteoderms with a towering hydro-sail fin and interlocking rows of conical teeth, it surges from the water to ambush prey along the river stones.',
    enrageTrigger: 'At < 45% HP, its dorsal hydro-sail and gullet glow electric cyan as it unleashes rapid hydro-lunges.',
    tells: [
      {
        name: 'Tidal Jaw Lunge',
        cue: 'Gapes its massive toothed jaws wide with a cyan bioluminescent throat glow and thrashes its tail.',
        counter: 'Sidestep onto the dry riverbank boulders and pierce its exposed gullet.',
      },
      {
        name: 'Hydro-Tail Cyclone',
        cue: 'Arches its dorsal sail fin and curls its armored paddle-tail sideways.',
        counter: 'Dodge away from the water splash radius, then counter-attack the dorsal sail.',
      },
    ],
    weaknesses: [
      {
        part: 'Bioluminescent River Maw',
        multiplier: '1.60x Damage',
        breakBonus: 'Drops Raptor Talon + shatters jaw bite power',
      },
      {
        part: 'Serrated Hydro-Sail Crest',
        multiplier: '1.45x Damage',
        breakBonus: 'Drops Calcified Coral Stone + triggers long stagger',
      },
    ],
    drops: ['Calcified Coral Stone', 'Raptor Talon', 'Dense Beast Bone'],
    huntingTips: [
      'Fight near the wooden river bridge or wide cobble shoals so you have room to dodge its lunge.',
      'Aim heavy spear thrusts at its towering dorsal sail when it pauses after a charge.',
    ],
  },
  brontoshell: {
    species: 'brontoshell',
    name: 'Gilded Brontoshell Behemoth',
    title: 'Ancient Carapace of the Black Coast',
    biomeName: 'Black Sand Coast & Ocean Bay',
    threatLevel: 3,
    diet: 'Armored Lithovore & Kelp Grazer',
    sizeLabel: '11.2m Length · 4.5m Height',
    lore: 'A living fortress of the Black Sand Coast. Over decades, the Brontoshell fuses abyssal coral, hexagonal basalt scutes, and gilded mineral deposits into an impenetrable domed shell. Only its horned beak and spiked tail club remain exposed.',
    enrageTrigger: 'At < 40% HP, bioluminescent coastal vents along its shell rim glow cyan and its seismic slams create wider shockwaves.',
    tells: [
      {
        name: 'Bulldozer Shell Charge',
        cue: 'Tucks limbs slightly inward and scrapes the black sand twice with front claws.',
        counter: 'Lead its charge into coastal boulders or dodge sideways, then punish the exposed head.',
      },
      {
        name: 'Seismic Tail Club Slam',
        cue: 'Rears its massive front legs skyward before crashing down and swinging its spiked tail mace.',
        counter: 'Sprint or roll clear of the shockwave ring, then rush in to strike the tail club.',
      },
    ],
    weaknesses: [
      {
        part: 'Beaked Head',
        multiplier: '1.60x Damage',
        breakBonus: 'Drops Brontoshell Carapace + stuns beast for 4.5s',
      },
      {
        part: 'Spiked Tail Club',
        multiplier: '1.45x Damage',
        breakBonus: 'Drops Calcified Coral Stone + shrinks slam shockwave',
      },
    ],
    drops: ['Brontoshell Carapace', 'Calcified Coral Stone', 'Dense Beast Bone'],
    huntingTips: [
      'Body strikes deal reduced damage against its domed shell—always target the Beaked Head or Spiked Tail Club.',
      'Activate Hunter Focus [F] to highlight both weak points clearly against the dark coastal sand.',
    ],
  },
  frostfang: {
    species: 'frostfang',
    name: 'Frostfang Glacial Mammoth',
    title: 'Colossus of the Cold Snow Mountains',
    biomeName: 'Eastern Cold Snow Mountains',
    threatLevel: 4,
    diet: 'Alpine Pine & Permafrost Grazer',
    sizeLabel: '12.6m Length · 5.4m Height',
    lore: 'Towering above the snow-dusted pines of the eastern mountain peaks, the Frostfang Glacial Mammoth is draped in thick white-and-slate winter wool, crystalline ice armor along its humped spine, and a pair of colossal spiraled ivory tusks that can shatter granite boulders.',
    enrageTrigger: 'At < 45% HP, a localized blizzard swirls around its crystalline ice hump and its tusks glow with sub-zero frost.',
    tells: [
      {
        name: 'Avalanche Tusk Gore',
        cue: 'Raises its muscular trunk high, trumpets a echoing horn blast, and lowers its giant curved ivory tusks.',
        counter: 'Dodge laterally as it thunders past, then strike the curved tusks while they are wedged in the snow.',
      },
      {
        name: 'Permafrost Stomp',
        cue: 'Lifts both pillar-like forelegs and crystallizes frost around its hooves.',
        counter: 'Roll backward out of the frost shockwave and counter-attack its head or ice-ridge hump.',
      },
    ],
    weaknesses: [
      {
        part: 'Curved Glacial Ivory Tusks',
        multiplier: '1.65x Damage',
        breakBonus: 'Drops Conductive Crest-Horn Ivory + massive stagger window',
      },
      {
        part: 'Crystalline Ice-Ridge Hump',
        multiplier: '1.45x Damage',
        breakBonus: 'Drops Dense Beast Bone + weakens frost shockwaves',
      },
    ],
    drops: ['Conductive Crest-Horn', 'Dense Beast Bone', 'Obsidian Shard'],
    huntingTips: [
      'Climb the eastern snow mountain trail carefully and watch for its white silhouette against the glacial spires.',
      'Shattering its Curved Glacial Ivory Tusks deals massive bonus damage and topples the colossus.',
    ],
  },
  thunderhorn: {
    species: 'thunderhorn',
    name: 'Thunderhorn Ceratopsian Prime',
    title: 'Warden of the Geothermal Springs',
    biomeName: 'Sulfur Geothermal Springs',
    threatLevel: 4,
    diet: 'Sulfur-Flora Herbivore (Highly Territorial)',
    sizeLabel: '12.5m Length · 4.8m Height',
    lore: 'Inhabiting the boiling mineral terraces, the Thunderhorn channels static electricity through its metallic nasal horn and scalloped bone frill. When threatened, its frill arcs with golden bio-lightning capable of shattering stone.',
    enrageTrigger: 'At < 45% HP, static arcs crackle continuously across its frill and it chains double gore charges.',
    tells: [
      {
        name: 'Lightning Gore Rush',
        cue: 'Lowers its huge armored frill, pawing the sulfur crust as golden sparks erupt from its nasal horn.',
        counter: 'Wait until the final moment of the windup to dodge sideways, then strike the Exposed Thermal Flank.',
      },
      {
        name: 'Cranial Horn Uppercut',
        cue: 'Dips its snout below knee level and lets out a metallic bellow.',
        counter: 'Roll diagonally behind its front shoulder and unleash a fully charged Heavy Thrust.',
      },
    ],
    weaknesses: [
      {
        part: 'Conductive Nasal Horn',
        multiplier: '1.65x Damage',
        breakBonus: 'Guaranteed Conductive Crest-Horn drop + massive knockdown',
      },
      {
        part: 'Exposed Thermal Vent Flank',
        multiplier: '1.40x Damage',
        breakBonus: 'Drops Obsidian Shard + slows charge turn rate',
      },
    ],
    drops: ['Conductive Crest-Horn', 'Obsidian Shard', 'Dense Beast Bone'],
    huntingTips: [
      'Craft the Brontoshell Carapace Plate before challenging the Thunderhorn to survive its high-voltage charges.',
      'Sinew Snare Traps interrupt its gore charge and expose its Conductive Nasal Horn at eye level.',
    ],
  },
  caldera_titan: {
    species: 'caldera_titan',
    name: 'Ignis-Rex, The Caldera Titan',
    title: 'Sovereign of the Molten Summit',
    biomeName: 'Volcanic Rift & Caldera Summit',
    threatLevel: 5,
    diet: 'Apex Volcanic Predator',
    sizeLabel: '16.4m Length · 6.5m Height',
    lore: 'The undisputed ruler of Primal Caldera. Ignis-Rex is an ancient theropod-dragon whose obsidian hide is veined with living magma. Its heart beats like a volcanic furnace—only by claiming its Titan Fang and Magma Heart can the Ancient Signal Tower be ignited.',
    enrageTrigger: 'At < 50% HP, magma veins across its entire body flare incandescent white-orange, unleashing devastating eruption slams.',
    tells: [
      {
        name: 'Cataclysmic Jaws Charge',
        cue: 'Inhales embers into its molten maw, roaring as lava drips from its fangs before lunging.',
        counter: 'Time your dodge i-frames through the initial snap, then counter-strike the Molten Maw.',
      },
      {
        name: 'Caldera Eruption Stomp',
        cue: 'Raises its massive clawed foot high while its Volcanic Heart Core pulses bright gold.',
        counter: 'Evade the ground impact, then rush directly under its chest to pierce the Volcanic Heart Core.',
      },
    ],
    weaknesses: [
      {
        part: 'Molten Maw & Crown',
        multiplier: '1.75x Damage',
        breakBonus: 'Drops Sovereign Titan Fang + triggers long collapse stagger',
      },
      {
        part: 'Volcanic Heart Core',
        multiplier: '1.60x Damage',
        breakBonus: 'Drops Apex Magma Heart + suppresses magma rage aura',
      },
    ],
    drops: ['Sovereign Titan Fang', 'Apex Magma Heart', 'Obsidian Shard'],
    huntingTips: [
      'Forge the Thunderhorn Siege Lance and Thunder-Warden Aegis at the Campfire before ascending the Caldera.',
      'Save your Sinew Snare Traps for when Ignis-Rex enters its Enraged phase below 50% HP.',
    ],
  },
};
