/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { BeastSpecies, NPCId } from '../../types/game.ts';
import type { EnvironmentModelId } from '../logic/beastopediaData.ts';

export interface ReferenceArtSpec {
  id: string;
  title: string;
  subtitle: string;
  category: 'beasts' | 'characters' | 'environment';
  dimensions: string;
  palette: string[];
  callouts: { label: string; x: number; y: number; targetX: number; targetY: number }[];
}

const SPECS: Record<string, ReferenceArtSpec> = {
  raptor: {
    id: 'raptor',
    title: 'STALKER RAPTOR',
    subtitle: '2D Anatomical Reference & 3D Rig Blueprint',
    category: 'beasts',
    dimensions: 'Length: 4.2m | Height: 2.1m | Weight: 185kg',
    palette: ['#2e5a36', '#c2410c', '#86efac', '#f59e0b'],
    callouts: [
      { label: 'Feathered Cranial Crest (Weak Point 1.5x)', x: 0.76, y: 0.22, targetX: 0.68, targetY: 0.34 },
      { label: 'Articulated Sickle Talons', x: 0.74, y: 0.82, targetX: 0.56, targetY: 0.76 },
      { label: 'Counterbalance Plumed Tail (1.35x)', x: 0.18, y: 0.28, targetX: 0.28, targetY: 0.46 },
    ],
  },
  snapjaw: {
    id: 'snapjaw',
    title: 'RIVER SNAPJAW',
    subtitle: '2D Semi-Aquatic Apex Reference & 3D Rig Blueprint',
    category: 'beasts',
    dimensions: 'Length: 6.8m | Height: 1.6m | Weight: 940kg',
    palette: ['#134e4a', '#2dd4bf', '#99f6e4', '#ea580c'],
    callouts: [
      { label: 'Crushing Gharial-Crocodile Maw (1.45x)', x: 0.78, y: 0.26, targetX: 0.72, targetY: 0.48 },
      { label: 'Bioluminescent Dorsal Scute Ridge', x: 0.48, y: 0.2, targetX: 0.48, targetY: 0.42 },
      { label: 'Paddle-Fin Propulsion Tail (1.4x)', x: 0.16, y: 0.3, targetX: 0.22, targetY: 0.5 },
    ],
  },
  brontoshell: {
    id: 'brontoshell',
    title: 'BRONTOSHELL',
    subtitle: '2D Armored Herbivore Reference & 3D Rig Blueprint',
    category: 'beasts',
    dimensions: 'Length: 7.4m | Height: 3.4m | Weight: 3,600kg',
    palette: ['#3f6212', '#a3e635', '#57534e', '#facc15'],
    callouts: [
      { label: 'Layered Carapace Dome + Rim Spikes', x: 0.52, y: 0.18, targetX: 0.5, targetY: 0.38 },
      { label: 'Beaked Cranial Plate (1.35x)', x: 0.78, y: 0.3, targetX: 0.7, targetY: 0.5 },
      { label: 'Heavy Osteoderm Tail Club (1.6x)', x: 0.18, y: 0.26, targetX: 0.24, targetY: 0.52 },
    ],
  },
  frostfang: {
    id: 'frostfang',
    title: 'SABERTOOTH FROSTFANG',
    subtitle: '2D Glacial Peak Predator Reference & 3D Rig Blueprint',
    category: 'beasts',
    dimensions: 'Length: 5.1m | Height: 2.6m | Weight: 620kg',
    palette: ['#e0f2fe', '#38bdf8', '#0284c7', '#f8fafc'],
    callouts: [
      { label: 'Twin Glacial Saber Fangs (1.55x)', x: 0.78, y: 0.24, targetX: 0.7, targetY: 0.46 },
      { label: 'Crystalline Ice Dorsal Spines (1.4x)', x: 0.46, y: 0.18, targetX: 0.48, targetY: 0.36 },
      { label: 'Arctic Fur Mane & Forelimb Claws', x: 0.68, y: 0.82, targetX: 0.58, targetY: 0.68 },
    ],
  },
  thunderhorn: {
    id: 'thunderhorn',
    title: 'THUNDERHORN',
    subtitle: '2D Bio-Electric Ceratopsian Reference & 3D Rig Blueprint',
    category: 'beasts',
    dimensions: 'Length: 8.2m | Height: 3.9m | Weight: 4,800kg',
    palette: ['#1e293b', '#38bdf8', '#fde047', '#64748b'],
    callouts: [
      { label: 'Conductive Crown Frill & Brow Horns (1.5x)', x: 0.76, y: 0.2, targetX: 0.68, targetY: 0.36 },
      { label: 'Bio-Electric Underbelly Core (1.45x)', x: 0.52, y: 0.84, targetX: 0.5, targetY: 0.62 },
      { label: 'Basalt-Plated Hindquarters', x: 0.2, y: 0.26, targetX: 0.32, targetY: 0.44 },
    ],
  },
  sky_dragon: {
    id: 'sky_dragon',
    title: 'AURELIUS · SKY-WYVERN DRAGON',
    subtitle: '2D Aerodynamic Dragon Reference & 3D Winged Rig Blueprint',
    category: 'beasts',
    dimensions: 'Wingspan: 18.2m | Length: 14.8m | Wing Loading: 342 N/m²',
    palette: ['#1e1b4b', '#38bdf8', '#facc15', '#7dd3fc'],
    callouts: [
      { label: 'Draconic Flame-Gland Maw (1.75x)', x: 0.78, y: 0.22, targetX: 0.68, targetY: 0.38 },
      { label: 'Articulated Wing Patagium Membrane (1.55x)', x: 0.48, y: 0.16, targetX: 0.46, targetY: 0.34 },
      { label: 'Aerodynamic Rudder Tail Fin', x: 0.18, y: 0.28, targetX: 0.22, targetY: 0.48 },
    ],
  },
  caldera_titan: {
    id: 'caldera_titan',
    title: 'CALDERA TITAN',
    subtitle: '2D Volcanic Apex Reference & 3D Rig Blueprint',
    category: 'beasts',
    dimensions: 'Length: 12.5m | Height: 5.8m | Weight: 9,200kg',
    palette: ['#18181b', '#ef4444', '#f97316', '#facc15'],
    callouts: [
      { label: 'Obsidian Crown Horns & Maw (1.55x)', x: 0.78, y: 0.2, targetX: 0.68, targetY: 0.34 },
      { label: 'Exposed Molten Heart Core (1.75x)', x: 0.74, y: 0.78, targetX: 0.56, targetY: 0.52 },
      { label: 'Volcanic Dorsal Magma Vents', x: 0.22, y: 0.22, targetX: 0.38, targetY: 0.38 },
    ],
  },
  hunter_koa: {
    id: 'hunter_koa',
    title: 'MASTERCRAFT MITHRIL VANGUARD · BEYOND SKYRIM2',
    subtitle: '2D Mithril Knight Reference & 3D Sketchfab + Procedural Rig',
    category: 'characters',
    dimensions: 'Height: 1.86m | Panoply: Silver-Blue Mithril & Gold Filigree',
    palette: ['#e0f2fe', '#38bdf8', '#facc15', '#1d4ed8'],
    callouts: [
      { label: 'Plumed Mithril Winged-Crest Helm', x: 0.74, y: 0.2, targetX: 0.52, targetY: 0.26 },
      { label: 'Silver-Blue Mithril Cuirass & Gold Filigree', x: 0.22, y: 0.34, targetX: 0.46, targetY: 0.44 },
      { label: 'Pleated Mithril Tassets & Aetherial Wings', x: 0.76, y: 0.74, targetX: 0.62, targetY: 0.56 },
    ],
  },
  chief_kael: {
    id: 'chief_kael',
    title: 'ELDER CHIEF KAEL',
    subtitle: '2D Tribal Leader Reference & 3D Character Model',
    category: 'characters',
    dimensions: 'Height: 1.80m | Location: Sanctuary Base Camp (2.8, 25.5)',
    palette: ['#b5784a', '#f59e0b', '#ef4444', '#f8fafc'],
    callouts: [
      { label: 'Amber-Plumed Chieftain Headdress', x: 0.74, y: 0.18, targetX: 0.52, targetY: 0.22 },
      { label: 'Ceremonial Mammoth-Tusk Staff + Totem', x: 0.22, y: 0.3, targetX: 0.36, targetY: 0.42 },
      { label: 'Layered Tribal Mantle & Bone Amulet', x: 0.74, y: 0.76, targetX: 0.52, targetY: 0.5 },
    ],
  },
  scout_lyra: {
    id: 'scout_lyra',
    title: 'SCOUT LYRA',
    subtitle: '2D River & Alpine Tracker Reference & 3D Model',
    category: 'characters',
    dimensions: 'Height: 1.76m | Location: Crystal River Crossing (-18, -12)',
    palette: ['#c98a5b', '#0d9488', '#2dd4bf', '#78350f'],
    callouts: [
      { label: 'Turquoise River-Clan Scarf & Hood', x: 0.74, y: 0.22, targetX: 0.52, targetY: 0.28 },
      { label: 'Curved Ashwood Hunting Bow', x: 0.22, y: 0.34, targetX: 0.38, targetY: 0.48 },
      { label: 'Fletched Arrow Quiver & Agile Greaves', x: 0.74, y: 0.76, targetX: 0.56, targetY: 0.62 },
    ],
  },
  smith_torak: {
    id: 'smith_torak',
    title: 'FORGE-MASTER TORAK',
    subtitle: '2D Master Weapon-Smith Reference & 3D Model',
    category: 'characters',
    dimensions: 'Height: 1.92m | Location: Sanctuary Workbench (-2.8, 26.8)',
    palette: ['#a3663e', '#451a03', '#ea580c', '#57534e'],
    callouts: [
      { label: 'Broad-Shouldered Forge Physique', x: 0.22, y: 0.26, targetX: 0.46, targetY: 0.38 },
      { label: 'Heavy Basalt-Headed Smithing Hammer', x: 0.76, y: 0.32, targetX: 0.62, targetY: 0.48 },
      { label: 'Heat-Treated Brontoshell Leather Apron', x: 0.74, y: 0.78, targetX: 0.5, targetY: 0.58 },
    ],
  },
  forgemaster_torak: {
    id: 'forgemaster_torak',
    title: 'FORGE-MASTER TORAK',
    subtitle: '2D Master Weapon-Smith Reference & 3D Model',
    category: 'characters',
    dimensions: 'Height: 1.92m | Location: Sanctuary Workbench (-2.8, 26.8)',
    palette: ['#a3663e', '#451a03', '#ea580c', '#57534e'],
    callouts: [
      { label: 'Broad-Shouldered Forge Physique', x: 0.22, y: 0.26, targetX: 0.46, targetY: 0.38 },
      { label: 'Heavy Basalt-Headed Smithing Hammer', x: 0.76, y: 0.32, targetX: 0.62, targetY: 0.48 },
      { label: 'Heat-Treated Brontoshell Leather Apron', x: 0.74, y: 0.78, targetX: 0.5, targetY: 0.58 },
    ],
  },
  snow_mountain: {
    id: 'snow_mountain',
    title: 'COLD SNOW MOUNTAINS & GLACIAL CRAGS',
    subtitle: '2D Alpine Biome Reference & 3D Terrain Asset',
    category: 'environment',
    dimensions: 'Northwest Sector (-120, -110) | Max Elevation: +36m',
    palette: ['#f8fafc', '#cbd5e1', '#38bdf8', '#334155'],
    callouts: [
      { label: 'Snow-Capped Jagged Alpine Peaks', x: 0.74, y: 0.2, targetX: 0.52, targetY: 0.28 },
      { label: 'Translucent Blue Glacial Ice Spires', x: 0.22, y: 0.34, targetX: 0.38, targetY: 0.52 },
      { label: 'Frozen Granite Outcrops & Snowdrifts', x: 0.74, y: 0.78, targetX: 0.58, targetY: 0.7 },
    ],
  },
  river_ocean: {
    id: 'river_ocean',
    title: 'CRYSTAL RIVER, RAPIDS & DEEP OCEAN',
    subtitle: '2D Hydrological Reference & 3D Water/Fish System',
    category: 'environment',
    dimensions: 'River Span: 340m | Ocean Perimeter: 760m x 760m',
    palette: ['#0284c7', '#2dd4bf', '#f97316', '#cbd5e1'],
    callouts: [
      { label: 'Animated Winding Crystal River Channel', x: 0.24, y: 0.24, targetX: 0.44, targetY: 0.48 },
      { label: 'Schooling 3D Prehistoric River Fish', x: 0.74, y: 0.3, targetX: 0.58, targetY: 0.54 },
      { label: 'Smooth Riverbank Cobbles & Ocean Swells', x: 0.72, y: 0.78, targetX: 0.48, targetY: 0.7 },
    ],
  },
  trees_canopy: {
    id: 'trees_canopy',
    title: 'ANCIENT BANYAN, PALMS & FROST PINES',
    subtitle: '2D Botanical Reference & 3D Multi-Tier Tree Models',
    category: 'environment',
    dimensions: 'Canopy Height: 6m - 14m | 420+ Instanced 3D Trees',
    palette: ['#15803d', '#4d7c0f', '#78350f', '#e2e8f0'],
    callouts: [
      { label: 'Multi-Tiered Lush Banyan Leaf Crowns', x: 0.24, y: 0.22, targetX: 0.42, targetY: 0.32 },
      { label: 'Snow-Dusted Coniferous Alpine Pines', x: 0.76, y: 0.26, targetX: 0.64, targetY: 0.4 },
      { label: 'Flared Buttress Roots & Bark Normal Map', x: 0.72, y: 0.78, targetX: 0.46, targetY: 0.72 },
    ],
  },
  stones_boulders: {
    id: 'stones_boulders',
    title: 'MOSSY BOULDERS, RIVER STONES & COLUMNS',
    subtitle: '2D Geological Reference & 3D Rock Formations',
    category: 'environment',
    dimensions: 'Scale: 0.8m - 8.5m | Hexagonal & Glacial Variants',
    palette: ['#57534e', '#4d7c0f', '#2dd4bf', '#1e293b'],
    callouts: [
      { label: 'Hexagonal Volcanic Basalt Columns', x: 0.24, y: 0.22, targetX: 0.44, targetY: 0.36 },
      { label: 'Moss-Capped Jungle Boulders', x: 0.74, y: 0.28, targetX: 0.58, targetY: 0.54 },
      { label: 'Glowing Mineral Vein & River Stones', x: 0.72, y: 0.78, targetX: 0.48, targetY: 0.68 },
    ],
  },
  grass_shrubs: {
    id: 'grass_shrubs',
    title: 'FERN ROSETTES, GRASS BLADES & SHRUBS',
    subtitle: '2D Ground Flora Reference & 3D Foliage Clumps',
    category: 'environment',
    dimensions: '520+ 3D Grass Clumps | Interactive Healing Berry Shrubs',
    palette: ['#22c55e', '#15803d', '#ef4444', '#facc15'],
    callouts: [
      { label: 'Arching Multi-Frond Prehistoric Ferns', x: 0.24, y: 0.24, targetX: 0.42, targetY: 0.46 },
      { label: 'Clustered Crimson-Berry Shrub Bushes', x: 0.74, y: 0.28, targetX: 0.6, targetY: 0.52 },
      { label: 'Dense 3D Grass Tuft Blades', x: 0.72, y: 0.78, targetX: 0.48, targetY: 0.68 },
    ],
  },
  volcanic_caldera: {
    id: 'volcanic_caldera',
    title: 'SMOLDERING CALDERA & MAGMA FISSURES',
    subtitle: '2D Geothermal Reference & 3D Emissive Assets',
    category: 'environment',
    dimensions: 'Northeast Sector (95, -95) | Temp: 1,100°C Magma',
    palette: ['#18181b', '#ef4444', '#f97316', '#fde047'],
    callouts: [
      { label: 'Obsidian Monolith Spires', x: 0.24, y: 0.22, targetX: 0.42, targetY: 0.36 },
      { label: 'Pulsing Molten Lava Vent Pools', x: 0.74, y: 0.3, targetX: 0.56, targetY: 0.62 },
      { label: 'Sulfur Steam & Ember Fissures', x: 0.72, y: 0.78, targetX: 0.48, targetY: 0.72 },
    ],
  },
};

function drawSilhouetteAndAnatomy(
  ctx: CanvasRenderingContext2D,
  id: string,
  cx: number,
  cy: number,
  scale: number
) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);

  if (id === 'raptor') {
    // Tail + Body + Neck + Head + Crest + Legs
    ctx.fillStyle = '#2e5a36';
    ctx.strokeStyle = '#86efac';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(-125, -8);
    ctx.quadraticCurveTo(-65, -24, -15, -18);
    ctx.quadraticCurveTo(25, -22, 48, -55);
    ctx.lineTo(86, -62);
    ctx.lineTo(95, -48);
    ctx.lineTo(64, -38);
    ctx.quadraticCurveTo(42, -5, 18, 18);
    ctx.lineTo(-28, 22);
    ctx.quadraticCurveTo(-75, 12, -125, -8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Feathered crest & tail fan
    ctx.fillStyle = '#ea580c';
    ctx.beginPath();
    ctx.moveTo(52, -58);
    ctx.lineTo(42, -82);
    ctx.lineTo(62, -74);
    ctx.lineTo(74, -60);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(-105, -12);
    ctx.lineTo(-142, -26);
    ctx.lineTo(-136, 6);
    ctx.closePath();
    ctx.fill();

    // Hind legs & sickle claw
    ctx.strokeStyle = '#bbf7d0';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(2, 14);
    ctx.lineTo(-12, 46);
    ctx.lineTo(8, 76);
    ctx.lineTo(28, 76);
    ctx.stroke();
  } else if (id === 'snapjaw') {
    // Long low crocodile body + scutes + long jaws
    ctx.fillStyle = '#134e4a';
    ctx.strokeStyle = '#2dd4bf';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(-145, 6);
    ctx.quadraticCurveTo(-70, -24, 25, -20);
    ctx.lineTo(125, -14);
    ctx.lineTo(132, -2);
    ctx.lineTo(48, 2);
    ctx.lineTo(122, 12);
    ctx.lineTo(35, 18);
    ctx.quadraticCurveTo(-45, 24, -145, 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Dorsal glowing scutes
    ctx.fillStyle = '#2dd4bf';
    for (let x = -95; x <= 35; x += 22) {
      ctx.beginPath();
      ctx.moveTo(x - 8, -18);
      ctx.lineTo(x, -34);
      ctx.lineTo(x + 8, -18);
      ctx.closePath();
      ctx.fill();
    }
  } else if (id === 'brontoshell') {
    // Massive arched carapace shell + tail club + armored head
    ctx.fillStyle = '#3f6212';
    ctx.strokeStyle = '#a3e635';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, 8, 68, Math.PI, 0, false);
    ctx.lineTo(95, 4);
    ctx.lineTo(88, 24);
    ctx.lineTo(-98, 24);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Tail club
    ctx.fillStyle = '#eab308';
    ctx.beginPath();
    ctx.arc(-112, 16, 18, 0, Math.PI * 2);
    ctx.fill();

    // Pillar legs
    ctx.fillStyle = '#57534e';
    ctx.fillRect(-48, 24, 22, 46);
    ctx.fillRect(28, 24, 22, 46);
  } else if (id === 'frostfang') {
    // Muscular prowler + twin long saber fangs + ice dorsal crystals
    ctx.fillStyle = '#cbd5e1';
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(-70, -28, 135, 52, 22);
    ctx.fill();
    ctx.stroke();

    // Head + Twin Saber Fangs
    ctx.beginPath();
    ctx.arc(78, -18, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#e0f2fe';
    ctx.beginPath();
    ctx.moveTo(86, -6);
    ctx.lineTo(92, 34);
    ctx.lineTo(100, -6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Ice dorsal crystals
    ctx.fillStyle = '#38bdf8';
    for (let x = -45; x <= 35; x += 26) {
      ctx.beginPath();
      ctx.moveTo(x - 10, -28);
      ctx.lineTo(x + 4, -62);
      ctx.lineTo(x + 12, -28);
      ctx.closePath();
      ctx.fill();
    }
  } else if (id === 'thunderhorn') {
    // Huge ceratopsian crest + twin brow horns + nasal horn
    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(-78, -26, 138, 62, 24);
    ctx.fill();
    ctx.stroke();

    // Crown Shield Frill
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.moveTo(42, -28);
    ctx.lineTo(28, -76);
    ctx.lineTo(78, -52);
    ctx.lineTo(86, 8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Long Golden Brow Horns
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(68, -28);
    ctx.lineTo(132, -52);
    ctx.moveTo(84, -8);
    ctx.lineTo(112, -28);
    ctx.stroke();
  } else if (id === 'sky_dragon') {
    // Winged Sky-Dragon silhouette with spread patagium wings, horned head, and arrow tail
    ctx.fillStyle = '#1e1b4b';
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(-135, 18);
    ctx.quadraticCurveTo(-65, -8, -12, -14);
    // Great Wing Arch
    ctx.lineTo(-48, -86);
    ctx.lineTo(15, -72);
    ctx.lineTo(28, -22);
    // Neck & Horned Dragon Head
    ctx.lineTo(76, -54);
    ctx.lineTo(118, -46);
    ctx.lineTo(95, -24);
    ctx.lineTo(44, 12);
    ctx.quadraticCurveTo(-25, 26, -135, 18);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Glowing Aether Core & Wing Veins
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-10, -18);
    ctx.lineTo(-36, -74);
    ctx.moveTo(-10, -18);
    ctx.lineTo(6, -64);
    ctx.stroke();
  } else if (id === 'caldera_titan') {
    // Colossal apex biped + glowing magma chest + dorsal vents + obsidian horns
    ctx.fillStyle = '#18181b';
    ctx.strokeStyle = '#f97316';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(-128, 12);
    ctx.lineTo(-35, -36);
    ctx.lineTo(48, -68);
    ctx.lineTo(96, -64);
    ctx.lineTo(88, -28);
    ctx.lineTo(45, 22);
    ctx.lineTo(-42, 32);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Glowing molten chest core
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(32, -16, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fde047';
    ctx.beginPath();
    ctx.arc(32, -16, 9, 0, Math.PI * 2);
    ctx.fill();
  } else if (id === 'hunter_koa') {
    // Mastercraft Mithril Armor Knight Silhouette with Winged Helm, Cape & Aetherial Flight Wings
    // Aetherial Flight Wings
    ctx.fillStyle = 'rgba(56, 189, 248, 0.25)';
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -25);
    ctx.lineTo(-92, -68);
    ctx.lineTo(-76, 6);
    ctx.closePath();
    ctx.moveTo(0, -25);
    ctx.lineTo(92, -68);
    ctx.lineTo(76, 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Silver-Blue Mithril Helm + Winged Crest
    ctx.fillStyle = '#e0f2fe';
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(0, -64, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Mithril Cuirass + Gold Filigree
    ctx.fillStyle = '#bae6fd';
    ctx.beginPath();
    ctx.roundRect(-26, -42, 52, 62, 10);
    ctx.fill();
    ctx.stroke();

    // Mithril Greaves & Vambraces
    ctx.strokeStyle = '#e0f2fe';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(-26, -32);
    ctx.lineTo(-54, 12);
    ctx.moveTo(26, -32);
    ctx.lineTo(54, 8);
    ctx.moveTo(-13, 20);
    ctx.lineTo(-16, 78);
    ctx.moveTo(13, 20);
    ctx.lineTo(16, 78);
    ctx.stroke();
  } else if (
    id === 'chief_kael' ||
    id === 'scout_lyra' ||
    id === 'smith_torak' ||
    id === 'shaman_sol' ||
    id === 'elder_kael' ||
    id === 'scout_lani' ||
    id === 'forgemaster_torak'
  ) {
    // Detailed Character T-Pose / Action Orthographic Silhouette
    ctx.fillStyle = '#c68652';
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2.2;
    // Head
    ctx.beginPath();
    ctx.arc(0, -64, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Torso
    ctx.fillStyle =
      id === 'scout_lyra' || id === 'scout_lani'
        ? '#0f766e'
        : id === 'chief_kael' || id === 'elder_kael'
        ? '#7c2d12'
        : '#451a03';
    ctx.beginPath();
    ctx.roundRect(-24, -42, 48, 62, 10);
    ctx.fill();
    ctx.stroke();
    // Arms & Legs
    ctx.strokeStyle = '#c68652';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(-24, -32);
    ctx.lineTo(-52, 12);
    ctx.moveTo(24, -32);
    ctx.lineTo(52, 8);
    ctx.moveTo(-12, 20);
    ctx.lineTo(-16, 78);
    ctx.moveTo(12, 20);
    ctx.lineTo(16, 78);
    ctx.stroke();

    // Signature weapon/staff
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(54, -78);
    ctx.lineTo(54, 78);
    ctx.stroke();
  } else if (id === 'snow_mountain') {
    // Alpine jagged peaks + ice spires
    ctx.fillStyle = '#475569';
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-120, 65);
    ctx.lineTo(-55, -52);
    ctx.lineTo(-8, 18);
    ctx.lineTo(42, -74);
    ctx.lineTo(118, 65);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Snow caps
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.moveTo(42, -74);
    ctx.lineTo(14, -22);
    ctx.lineTo(40, -30);
    ctx.lineTo(72, -18);
    ctx.closePath();
    ctx.fill();
  } else if (id === 'river_ocean') {
    // Winding river waves + fish
    ctx.fillStyle = '#0284c7';
    ctx.beginPath();
    ctx.roundRect(-125, -28, 250, 76, 18);
    ctx.fill();
    ctx.fillStyle = '#2dd4bf';
    ctx.beginPath();
    ctx.ellipse(0, 8, 95, 22, 0, 0, Math.PI * 2);
    ctx.fill();
    // Fish silhouettes
    ctx.fillStyle = '#f97316';
    for (const fx of [-38, 12, 52]) {
      ctx.beginPath();
      ctx.ellipse(fx, 8, 14, 6, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (id === 'trees_canopy') {
    // Trunk + Layered canopies + Snow pine
    ctx.fillStyle = '#78350f';
    ctx.fillRect(-48, -10, 18, 75);
    ctx.fillStyle = '#15803d';
    ctx.beginPath();
    ctx.arc(-39, -28, 42, 0, Math.PI * 2);
    ctx.fill();

    // Frost Pine beside it
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.moveTo(52, -68);
    ctx.lineTo(18, 35);
    ctx.lineTo(86, 35);
    ctx.closePath();
    ctx.fill();
  } else if (id === 'stones_boulders') {
    ctx.fillStyle = '#57534e';
    ctx.strokeStyle = '#a8a29e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-75, -45, 36, 105, 6);
    ctx.roundRect(-32, -68, 38, 128, 6);
    ctx.arc(48, 22, 38, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (id === 'grass_shrubs') {
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 4;
    for (let a = -60; a <= 60; a += 15) {
      ctx.beginPath();
      ctx.moveTo(a, 55);
      ctx.quadraticCurveTo(a * 1.4, -15, a * 1.8, -42);
      ctx.stroke();
    }
    ctx.fillStyle = '#ef4444';
    for (const bx of [-35, -12, 18, 42]) {
      ctx.beginPath();
      ctx.arc(bx, 18, 6, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    // Volcanic caldera
    ctx.fillStyle = '#18181b';
    ctx.beginPath();
    ctx.moveTo(-110, 58);
    ctx.lineTo(-58, -45);
    ctx.lineTo(58, -45);
    ctx.lineTo(110, 58);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#f97316';
    ctx.beginPath();
    ctx.ellipse(0, 32, 68, 18, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

export function render2DReferenceCardDataURL(
  id: BeastSpecies | NPCId | 'hunter_koa' | EnvironmentModelId,
  width = 640,
  height = 360
): string {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const spec = SPECS[id] || SPECS.raptor;

  // Parchment-slate technical blueprint background
  const grad = ctx.createLinearGradient(0, 0, width, height);
  grad.addColorStop(0, '#0c0a09');
  grad.addColorStop(0.5, '#1c1917');
  grad.addColorStop(1, '#0f172a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // Blueprint Measurement Grid
  ctx.strokeStyle = 'rgba(245, 158, 11, 0.08)';
  ctx.lineWidth = 1;
  for (let x = 0; x < width; x += 24) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y < height; y += 24) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  // Outer technical border
  ctx.strokeStyle = 'rgba(245, 158, 11, 0.45)';
  ctx.lineWidth = 2;
  ctx.strokeRect(10, 10, width - 20, height - 20);

  // Header Stamp
  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 15px monospace';
  ctx.fillText(`STEP 1: 2D CONCEPT & ANATOMICAL BLUEPRINT // ${spec.title}`, 24, 34);

  ctx.fillStyle = '#a8a29e';
  ctx.font = '11px monospace';
  ctx.fillText(`${spec.subtitle}  |  ${spec.dimensions}`, 24, 52);

  // Color Palette Swatches (Top Right)
  spec.palette.forEach((hex, idx) => {
    const sx = width - 135 + idx * 26;
    ctx.fillStyle = hex;
    ctx.fillRect(sx, 22, 20, 20);
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 1;
    ctx.strokeRect(sx, 22, 20, 20);
  });

  // Center Orthographic Silhouette + Anatomy Illustration
  drawSilhouetteAndAnatomy(ctx, id, width * 0.5, height * 0.56, 1.15);

  // Anatomical Callout Pointers
  spec.callouts.forEach((c) => {
    const lx = c.x * width;
    const ly = c.y * height;
    const tx = c.targetX * width;
    const ty = c.targetY * height;

    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(lx, ly);
    ctx.lineTo(tx, ty);
    ctx.stroke();

    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.arc(tx, ty, 4, 0, Math.PI * 2);
    ctx.fill();

    // Label pill
    ctx.font = 'bold 10px sans-serif';
    const textW = ctx.measureText(c.label).width + 12;
    const boxX = lx > width * 0.5 ? lx - textW * 0.5 : lx - textW * 0.5;
    ctx.fillStyle = 'rgba(12, 10, 9, 0.88)';
    ctx.fillRect(boxX, ly - 14, textW, 18);
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.6)';
    ctx.strokeRect(boxX, ly - 14, textW, 18);
    ctx.fillStyle = '#fef3c7';
    ctx.fillText(c.label, boxX + 6, ly - 2);
  });

  // Footer verification tag
  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 10px monospace';
  ctx.fillText(
    'VERIFIED 2D REFERENCE -> 1:1 PROCEDURAL 3D RIG & PBR MATERIAL MATCH',
    24,
    height - 20
  );

  return canvas.toDataURL('image/png');
}

export const REFERENCE_ART_SPECS = SPECS;
export const generateReferenceImageDataUrl = render2DReferenceCardDataURL;

