/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { BeastSpecies, BeastopediaEntry } from '../../types/game.ts';

export const BEASTOPEDIA_ENTRIES: Record<BeastSpecies, BeastopediaEntry> = {
  raptor: {
    species: 'raptor',
    name: 'Razor-Crest Raptor Alpha',
    title: 'Pack Terror of the Ravines',
    threatLevel: 'Moderate',
    habitat: 'Jungle Ravines & Dense Cycad Groves',
    diet: 'Carnivorous Pack Predator',
    lore: 'The apex sprinter of the island lowlands. Raptor Alphas coordinate swift flank attacks with terrifying intelligence. Their iridescent feathered crests flush bright crimson to signal coordinated pack lunges. Their sickle claws are sharp enough to slice through prehistoric hardwood.',
    tells: [
      {
        name: 'Arched Feather Flare',
        description: 'The Raptor lowers its snout flush to the ground, raises its tail quills, and flares its amber crest feathers for 0.6s before leaping.',
        counterplay: 'Dodge diagonally forward under its leap arc to end up directly behind its exposed hind tendons.',
      },
      {
        name: 'Vocal Hiss & Circling Feint',
        description: 'Emits a sharp high-frequency clicking shriek while circling sideways to flank the hunter.',
        counterplay: 'Do not chase while it circles; hold ground and ready a charged spear thrust as it commits to the line-of-sight charge.',
      },
    ],
    attackModes: [
      {
        name: 'Sickle Claw Lunge',
        damageType: 'Piercing Slashing',
        danger: 'High speed direct pounce causing immediate knockdown.',
      },
      {
        name: 'Spinning Tail Sweep',
        damageType: 'Blunt Impact',
        danger: 'A 360-degree rotation that punishes hunters attempting to stay behind its tail.',
      },
    ],
    weaknesses: [
      {
        part: 'Throat & Crest',
        multiplier: '2.2x Damage',
        breakEffect: 'Severely reduces pack call aggression and lowers recovery time between lunges.',
      },
      {
        part: 'Hind Leg Tendon',
        multiplier: '1.6x Damage',
        breakEffect: 'Cripples sprint agility, shortening leap distance and causing a 3.0s ground stumble.',
      },
    ],
    enragedBehavior: 'At < 40% HP, volcanic adrenaline courses through its veins, turning its eye crests blazing orange. Attack recovery windows decrease by 40%, and it executes consecutive leap attacks.',
    harvestableDrops: [
      { item: 'raptor_claw', rarity: 'Common', description: 'Curved razor-sharp talon used as harpoon barb heads and arrowheads.' },
      { item: 'beast_bone', rarity: 'Common', description: 'Dense avian-dinosaur femur ideal for tool shafts and armor frames.' },
      { item: 'tough_tendon', rarity: 'Uncommon', description: 'High-tensile fibrous sinew essential for bowstrings and pitfall snares.' },
      { item: 'beast_hide', rarity: 'Common', description: 'Supple reptilian leather offering balanced defense and maximum agility.' },
    ],
    huntingTips: [
      'Lay a Shock-Vine Pitfall Trap right before engaging; lure its initial pounce into the snare for an immediate 3.5s punish window.',
      'Aimed stone throws will interrupt its stalking circle and provoke a predictable straight charge.',
      'Heavy spear thrusts to the throat break its crest quickly, neutralizing its speed.',
    ],
    associatedRecipes: [
      'Raptor Bone Harpoon (Weapon: +38 Dmg, Serrated Bleed)',
      'Stalker Leather Jerkin (Armor: +16 Def, +15 Stamina Pool)',
      'Shock-Vine Pitfall Trap (Supply: Grounds leaping beasts)',
    ],
  },

  brontoshell: {
    species: 'brontoshell',
    name: 'Gilded Brontoshell Behemoth',
    title: 'Ancient Carapace of the Black Coast',
    threatLevel: 'High',
    habitat: 'Black-Sand Coast, Basalt Tide Pools & Obsidian Caves',
    diet: 'Mineralivore & Tidal Kelp Grazer',
    lore: 'An ancient amphibious titan whose shell has fused with black volcanic sand, cooled magma crust, and glittering mineral deposits over centuries. It moves with ponderous deliberation, but can release concussive ground slams that crack basalt shores.',
    tells: [
      {
        name: 'Two-Legged Pillar Stance',
        description: 'Rears high onto its two hind legs for a prolonged 1.2s telegraph, casting a massive shadow before crashing down.',
        counterplay: 'Roll outward immediately as its front paws touch the ground; the seismic shockwave radiates 4 meters.',
      },
      {
        name: 'Carapace Vent Steam Whistle',
        description: 'Vents steam from its volcanic shell scutes, hissing loudly as it prepares a heavy spinning shell slide.',
        counterplay: 'Sprint perpendicular to its forward line of motion; do not attempt to block.',
      },
    ],
    attackModes: [
      {
        name: 'Seismic Carapace Slam',
        damageType: 'Crushing Earth Shock',
        danger: 'Massive area of effect that staggers and deals severe blunt trauma.',
      },
      {
        name: 'Obsidian Beak Snap',
        damageType: 'Shearing Pierce',
        danger: 'Forward horn strike that can shatter wooden weapons.',
      },
    ],
    weaknesses: [
      {
        part: 'Soft Underbelly',
        multiplier: '2.5x Damage',
        breakEffect: 'Massive vulnerability when exposed during rear-up and after pitfall trap triggers.',
      },
      {
        part: 'Unarmored Head',
        multiplier: '2.0x Damage',
        breakEffect: 'Breaks jaw horns and causes disorientation.',
      },
    ],
    enragedBehavior: 'When enraged, molten geysers erupt from its dorsal shell scutes, creating lingering magma hazard zones on the ground.',
    harvestableDrops: [
      { item: 'bronto_shell', rarity: 'Uncommon', description: 'Thick basalt carapace scute impervious to ordinary blunt attacks.' },
      { item: 'obsidian_shard', rarity: 'Uncommon', description: 'Razor volcanic glass flaked from its outer tide crust.' },
      { item: 'volcanic_resin', rarity: 'Common', description: 'Hardened geothermal amber used to fuse heavy plate bindings.' },
      { item: 'beast_bone', rarity: 'Common', description: 'Heavy structural bone capable of bearing immense loads.' },
    ],
    huntingTips: [
      'Striking its dorsal carapace deflects light spear hits. Always maneuver to its flanks or wait for its two-legged stance to strike the underbelly.',
      'In heavy rain weather, its shell cools and steam vents emit thicker clouds, revealing blind spots.',
      'Obsidian Glaives have enough blade curve to bypass its side shell rim.',
    ],
    associatedRecipes: [
      'Obsidian Razor Glaive (Weapon: +58 Dmg, Glass Lacerations)',
      'Brontoshell Chitin Plate (Armor: +32 Def, Absorbs Charge Damage)',
      'Signal Tower: Mirror Reflector (Tower Component: Progress +50%)',
    ],
  },

  thunderhorn: {
    species: 'thunderhorn',
    name: 'Thunderhorn Prime',
    title: 'Earth-Shaker of Steaming Springs',
    threatLevel: 'Extreme',
    habitat: 'Steaming Springs, Sulfur Caldera Basin & Geyser Vents',
    diet: 'Geothermal Mineral Fronds & Sulfur Salt Licks',
    lore: 'A thunderous quadrupedal colossus with dual piezoelectric ivory horns that store electrostatic energy from sulfuric geyser discharges. When startled or challenged, it accelerates like a runaway volcanic boulder, obliterating trees and stone pillars.',
    tells: [
      {
        name: 'Snout Scrape & Blue Arc Spark',
        description: 'Scrapes its hooves across sulfur dust three times while blue electric arcs jump between its dual horns.',
        counterplay: 'Stand directly in front of a basalt pillar or rock formation, then dodge at the exact split-second it charges to make it crash into the obstacle.',
      },
      {
        name: 'Head Toss Bellow',
        description: 'Tosses its heavy armored crown upward, shaking the ground with a deep guttural bellow.',
        counterplay: 'Punish with thrown stones or a heavy thrust right as its snout descends back to neutral height.',
      },
    ],
    attackModes: [
      {
        name: 'Freight-Train Horn Charge',
        damageType: 'Piercing Impact',
        danger: 'Catastrophic forward rush over 20 meters that deals devastating damage.',
      },
      {
        name: 'Lateral Horn Sweep',
        damageType: 'Electric Sweep',
        danger: 'High-arc horn flick covering a wide 180-degree frontal cone.',
      },
    ],
    weaknesses: [
      {
        part: 'Thunder Crest Horns',
        multiplier: '1.8x Damage',
        breakEffect: 'Shatters the primary horn, permanently disabling its high-damage charging momentum.',
      },
      {
        part: 'Rib Gland',
        multiplier: '2.0x Damage',
        breakEffect: 'Disrupts internal sulfur circulation, causing repeated exhaustion stumbles.',
      },
    ],
    enragedBehavior: 'In enraged mode, lightning crackles along its entire spine ridge. Its charge changes direction midway through the rush to track the hunter.',
    harvestableDrops: [
      { item: 'titan_horn', rarity: 'Rare', description: 'Electrically conductive titan horn used in apex weapons and brazier mounts.' },
      { item: 'obsidian_shard', rarity: 'Uncommon', description: 'Igneous glass dislodged from its mountain charging runs.' },
      { item: 'volcanic_resin', rarity: 'Common', description: 'Sulfur-rich volcanic sap with extreme heat resistance.' },
      { item: 'beast_hide', rarity: 'Common', description: 'Pachyderm-grade hide that insulates against electric and thermal shocks.' },
    ],
    huntingTips: [
      'Never attempt to trade blows with Thunderhorn while it is in motion; observation and spacing are paramount.',
      'Place a pitfall trap in its charge path to completely flip the beast onto its flank for a 4-second punish window.',
      'Breaking its horns yields the rare Titan Horn required for the Titan Magma Lance.',
    ],
    associatedRecipes: [
      'Titan Magma Lance (Weapon: +85 Dmg, Explosive Piercing)',
      'Signal Tower: Magma Igniter Brazier (Tower Component: Progress +100%)',
    ],
  },

  caldera_titan: {
    species: 'caldera_titan',
    name: 'Ignis Titanus Caldera',
    title: 'Apex Sovereign of the Volcanic Core',
    threatLevel: 'Apex Sovereign',
    habitat: 'Caldera Summit, Lava Core Crater & High Altar',
    diet: 'Molten Geothermal Energy & Ancient Primordial Beasts',
    lore: 'The primordial apex beast that slumbers inside the island’s molten heart. Born of liquid magma, basalt armor, and ancient dragon bone, its roar triggers earthquakes and volcanic ash storms. It guards the ancient signal tower peak against all intruders.',
    tells: [
      {
        name: 'Chest Core Deep Glow',
        description: 'The volcanic core in its chest ignites into blinding white-orange radiance for 1.0s, accompanied by deep sub-bass tremors.',
        counterplay: 'Prepare for an explosive magma torrent; sprint diagonally away from its mouth trajectory or roll into its flank.',
      },
      {
        name: 'Wings-Back Roar & Tail Coil',
        description: 'Coils its colossal spiked tail to the left while roaring into the sky.',
        counterplay: 'Jump or roll away from the clockwise tail sweep that covers a 12-meter circular zone.',
      },
    ],
    attackModes: [
      {
        name: 'Caldera Magma Breath',
        damageType: 'Molten Fire Wave',
        danger: 'Sustained cone of molten rock that leaves burning trails in the ash.',
      },
      {
        name: 'Cataclysm Ground Eruption',
        damageType: 'Seismic Flame Burst',
        danger: 'Summons 3 explosive magma pillars from cracks in the ground around the player.',
      },
    ],
    weaknesses: [
      {
        part: 'Glowing Magma Heart',
        multiplier: '2.6x Damage',
        breakEffect: 'Extinguishes its core glow and exposes its rib cage, preventing magma breath for 30 seconds.',
      },
      {
        part: 'Ancient Titan Horns',
        multiplier: '2.0x Damage',
        breakEffect: 'Weakens its headbutt and lowers resistance to stagger.',
      },
    ],
    enragedBehavior: 'At < 50% HP, the Caldera Titan enters Primordial Fury. The sky turns blood-red, ash storms intensify, and its tail strikes release explosive magma shockwaves.',
    harvestableDrops: [
      { item: 'magma_core', rarity: 'Legendary', description: 'A self-sustaining sphere of concentrated volcanic core energy.' },
      { item: 'titan_scale', rarity: 'Rare', description: 'Impervious dragon-titan scale forged in mantle-level heat.' },
      { item: 'titan_horn', rarity: 'Rare', description: 'Ancient titan crown horn of immense ceremonial and structural power.' },
      { item: 'obsidian_shard', rarity: 'Uncommon', description: 'Pristine black obsidian crystals from the caldera rim.' },
    ],
    huntingTips: [
      'Only approach after crafting the Brontoshell or Titan Harness armor to survive thermal shock.',
      'Focus all attacks on its chest core whenever it recovers from a magma breath burst.',
      'Defeating this creature permanently dispels volcanic interference and allows lighting the Signal Tower beacon.',
    ],
    associatedRecipes: [
      'Volcanic Titan Harness (Armor: +50 Def, +40 Stamina Bonus)',
      'Signal Tower Beacon Ignition (Final Objective: Beacon Fire Lit!)',
    ],
  },
};
