/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import type { BiomeType, TrackClue } from '../../types/game.ts';
import { MaterialCache } from './materials.ts';
import {
  buildFoliageModel,
  buildCampfireWorkbench,
  buildSignalTower,
  buildSnowMountainPeakModel,
  buildRiverBridgeModel,
  buildRiverFishModel,
} from './proceduralModels.ts';

export interface RiverFishActor {
  mesh: THREE.Group;
  baseX: number;
  baseZ: number;
  baseY: number;
  radiusX: number;
  radiusZ: number;
  speed: number;
  phase: number;
}

export interface GrassInstanceData {
  x: number;
  y: number;
  z: number;
  scale: number;
  rotY: number;
}

export interface TerrainSystem {
  mesh: THREE.Mesh;
  oceanMesh: THREE.Mesh;
  riverMesh: THREE.Mesh;
  lavaFlowMesh: THREE.Mesh;
  foliageGroup: THREE.Group;
  instancedGrass: THREE.InstancedMesh;
  grassData: GrassInstanceData[];
  campGroup: THREE.Group;
  towerGroup: THREE.Group;
  clueGroup: THREE.Group;
  fishActors: RiverFishActor[];
  getHeight: (x: number, z: number) => number;
  getBiome: (x: number, z: number) => BiomeType;
  updateTowerStage: (stage: number, lit: boolean) => void;
}

/**
 * Computes the Z center of the winding 3D Crystal River for any world X coordinate.
 * The river flows from the Eastern Cold Snow Mountains (x ~ +75) through the central valley
 * (passing between the Signal Tower z=5 and Campfire z=28) out to the Western Ocean Delta (x ~ -110).
 */
export function getRiverCenterZ(x: number): number {
  return 15 + Math.sin(x * 0.042) * 5.2 + Math.cos(x * 0.02) * 2.4;
}

/**
 * Pure deterministic height function for the expanded 420x420 3D island.
 */
export function getTerrainHeight(x: number, z: number): number {
  const distFromCenter = Math.hypot(x, z);

  // Base undulating island hills
  let h =
    Math.sin(x * 0.032) * Math.cos(z * 0.032) * 2.8 +
    Math.sin(x * 0.075 + z * 0.055) * 1.15 +
    2.4;

  // Flatten Campfire Haven (around 0, 28)
  const distToCamp = Math.hypot(x - 0, z - 28);
  if (distToCamp < 15) {
    const t = Math.max(0, (distToCamp - 6) / 9);
    h = h * t + 1.8 * (1 - t);
  }

  // Flatten Central Signal Tower Plateau (around 0, 5)
  const distToTower = Math.hypot(x - 0, z - 5);
  if (distToTower < 13) {
    const t = Math.max(0, (distToTower - 5) / 8);
    h = h * t + 3.4 * (1 - t);
  }

  // Eastern Cold Snow Mountain Range (centered around x: 64, z: -18, extending from x: 35 to 110, z: -65 to +22)
  const distToSnowRange = Math.hypot((x - 66) * 0.85, (z + 16) * 0.75);
  if (distToSnowRange < 44) {
    const snowFactor = Math.max(0, 1 - distToSnowRange / 44);
    // Smooth walkable pass on the western slope facing Frostfang Mammoth arena (x: 58, z: -18)
    const distToMammothArena = Math.hypot(x - 58, z + 18);
    if (distToMammothArena < 15) {
      const arenaBlend = Math.max(0, (distToMammothArena - 8) / 7);
      h = h * arenaBlend + 8.2 * (1 - arenaBlend);
    } else {
      const peakRidge =
        Math.pow(snowFactor, 1.35) * 22.0 +
        Math.abs(Math.sin(x * 0.14) * Math.cos(z * 0.14)) * 5.5 * snowFactor;
      h += peakRidge;
    }
  }

  // Northern Volcanic Caldera Ridge (z < -38)
  if (z < -32) {
    const northFactor = Math.min(1, (-32 - z) / 45);
    const distToBossArena = Math.hypot(x - 0, z - -64);
    if (distToBossArena < 22) {
      const arenaEdge = Math.max(0, (distToBossArena - 15) / 7);
      h = 7.2 + arenaEdge * 3.5;
    } else {
      h += northFactor * 8.5;
    }
  }

  // Winding Crystal River Channel (flows from x = -110 to x = +75 around getRiverCenterZ(x))
  if (x > -115 && x < 78) {
    const riverZ = getRiverCenterZ(x);
    const distToRiver = Math.abs(z - riverZ);
    const riverHalfWidth = 5.6;
    if (distToRiver < riverHalfWidth + 3.5) {
      const bankBlend = Math.max(0, Math.min(1, (distToRiver - riverHalfWidth) / 3.5));
      // Carve riverbed shallow enough to wade across (y ~ 0.55) while water surface sits at y ~ 1.15
      const riverbedHeight = 0.55 + (x > 35 ? (x - 35) * 0.08 : 0);
      h = h * bankBlend + riverbedHeight * (1 - bankBlend);
    }
  }

  // Outer Island Coastal Slope into the 3D Surrounding Ocean
  if (distFromCenter > 98) {
    const oceanBlend = Math.min(1, (distFromCenter - 98) / 36);
    h = h * (1 - oceanBlend) + -1.4 * oceanBlend;
  }

  return h;
}

/**
 * Determines the active biome at world coordinates (x, z).
 */
export function getTerrainBiome(x: number, z: number): BiomeType {
  const distFromCenter = Math.hypot(x, z);
  if (distFromCenter > 105) {
    return 'ocean';
  }
  if (x > -108 && x < 72 && Math.abs(z - getRiverCenterZ(x)) < 6.4) {
    return 'river';
  }
  const distToSnowRange = Math.hypot((x - 66) * 0.85, (z + 16) * 0.75);
  if (distToSnowRange < 38 || (x > 38 && z < 12 && z > -52)) {
    return 'snow';
  }
  if (z < -48) {
    return 'caldera';
  }
  if (z < -26 && x > 14 && x <= 42) {
    return 'lava';
  }
  if (x < -22 && z < 8) {
    return 'springs';
  }
  if (x > 16 && z >= 18) {
    return 'coast';
  }
  return 'jungle';
}

export function createTerrain(mat: MaterialCache): TerrainSystem {
  const size = 420;
  const segments = 160;
  const geometry = new THREE.PlaneGeometry(size, size, segments, segments);
  geometry.rotateX(-Math.PI / 2);

  const pos = geometry.attributes.position;
  const count = pos.count;
  const colors = new Float32Array(count * 3);

  const vColor = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const vx = pos.getX(i);
    const vz = pos.getZ(i);
    const vy = getTerrainHeight(vx, vz);
    pos.setY(i, vy);

    const biome = getTerrainBiome(vx, vz);
    vColor.setHex(0x2f5e2c); // rich jungle moss green

    if (biome === 'snow') {
      if (vy > 14) {
        // Pure alpine snow cap
        vColor.setHex(0xf1f5f9);
      } else {
        // Frosted alpine rock & snow
        vColor.setHex(0x94a3b8);
      }
    } else if (biome === 'river') {
      // Wet turquoise-slate riverbed cobbles
      vColor.setHex(0x1f626d);
    } else if (biome === 'ocean') {
      // Coastal seabed sand & reef
      vColor.setHex(0x134e6f);
    } else if (biome === 'coast') {
      vColor.setHex(0x272a30); // black volcanic sand shore
    } else if (biome === 'springs') {
      vColor.setHex(0x6c6538); // geothermal sulfur
    } else if (biome === 'lava') {
      vColor.setHex(0x45221a); // volcanic basalt
    } else if (biome === 'caldera') {
      vColor.setHex(0x363640); // summit ash
    }

    colors[i * 3] = vColor.r;
    colors[i * 3 + 1] = vColor.g;
    colors[i * 3 + 2] = vColor.b;
  }

  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();

  const terrainMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    color: 0xffffff,
    map: mat.terrainDetailMap,
    bumpMap: mat.terrainBumpMap,
    bumpScale: 0.14,
    roughnessMap: mat.terrainBumpMap,
    roughness: 0.86,
    metalness: 0.06,
  });

  const mesh = new THREE.Mesh(geometry, terrainMaterial);
  mesh.receiveShadow = true;

  // 1. Vast 3D Surrounding Coastal Ocean Plane
  const oceanGeo = new THREE.PlaneGeometry(520, 520, 32, 32);
  oceanGeo.rotateX(-Math.PI / 2);
  const oceanMesh = new THREE.Mesh(oceanGeo, mat.oceanMaterial);
  oceanMesh.position.y = 0.35;

  // 2. Winding 3D Crystal River Water Ribbon Mesh
  const riverLengthX = 190;
  const riverWidthZ = 13.5;
  const riverGeo = new THREE.PlaneGeometry(riverLengthX, riverWidthZ, 80, 8);
  riverGeo.rotateX(-Math.PI / 2);
  const rPos = riverGeo.attributes.position;
  for (let i = 0; i < rPos.count; i++) {
    const localX = rPos.getX(i) - 10; // spans from -105 to +85
    const localZOffset = rPos.getZ(i);
    const worldZ = getRiverCenterZ(localX) + localZOffset;
    const bankGroundY = getTerrainHeight(localX, getRiverCenterZ(localX));
    rPos.setX(i, localX);
    rPos.setZ(i, worldZ);
    rPos.setY(i, Math.max(0.45, bankGroundY + 1.15));
  }
  riverGeo.computeVertexNormals();
  const riverMesh = new THREE.Mesh(riverGeo, mat.waterMaterial);

  // 3. Lava river plane in the volcanic rift
  const lavaGeo = new THREE.PlaneGeometry(32, 65, 16, 32);
  lavaGeo.rotateX(-Math.PI / 2);
  const lavaPos = lavaGeo.attributes.position;
  for (let i = 0; i < lavaPos.count; i++) {
    const lx = 34 + lavaPos.getX(i);
    const lz = -32 + lavaPos.getZ(i);
    lavaPos.setY(i, getTerrainHeight(lx, lz) - 0.15);
  }
  lavaGeo.computeVertexNormals();
  const lavaFlowMesh = new THREE.Mesh(lavaGeo, mat.lavaMaterial);
  lavaFlowMesh.position.set(34, 0, -32);

  // 4. Populate 3D Mountains, Bridge, Trees, Stones, Grass, Shrubs & River Fish
  const foliageGroup = new THREE.Group();
  const fishActors: RiverFishActor[] = [];

  let seed = 1337;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  // 4a. Monumental 3D Cold Snow Mountain Peaks & Glacial Spires along the Eastern Alpine Range
  const mountainPeakCoords = [
    { x: 78, z: -28, scale: 2.3, rot: 0.4 },
    { x: 84, z: -6, scale: 2.0, rot: 1.8 },
    { x: 64, z: -42, scale: 1.85, rot: 2.5 },
    { x: 48, z: -36, scale: 1.5, rot: 0.9 },
    { x: 74, z: 12, scale: 1.65, rot: 3.1 },
  ];
  for (const mp of mountainPeakCoords) {
    const peakModel = buildSnowMountainPeakModel(mat, mp.scale);
    peakModel.position.set(mp.x, getTerrainHeight(mp.x, mp.z) - 1.2, mp.z);
    peakModel.rotation.y = mp.rot;
    foliageGroup.add(peakModel);
  }

  // 4b. Tribal Timber River Bridge crossing the Crystal River at x = -8
  const bridgeX = -8;
  const bridgeZ = getRiverCenterZ(bridgeX);
  const bridgeModel = buildRiverBridgeModel(mat);
  bridgeModel.position.set(bridgeX, getTerrainHeight(bridgeX, bridgeZ) + 0.95, bridgeZ);
  foliageGroup.add(bridgeModel);

  // 4c. Riverbank Wet Cobble Stones, Reeds & Boulders along both banks of the Crystal River
  for (let rx = -88; rx <= 56; rx += 5.5) {
    const rz = getRiverCenterZ(rx);
    for (const side of [-1, 1]) {
      if (Math.abs(rx - bridgeX) < 5) continue;
      const bankZ = rz + side * (5.6 + rand() * 2.2);
      const bankY = getTerrainHeight(rx, bankZ);
      const stoneProp = buildFoliageModel('river_stone', mat, 0.8 + rand() * 0.8);
      stoneProp.position.set(rx + (rand() - 0.5) * 2, bankY, bankZ);
      stoneProp.rotation.y = rand() * Math.PI * 2;
      foliageGroup.add(stoneProp);

      if (rand() > 0.35) {
        const reedProp = buildFoliageModel('reed', mat, 0.9 + rand() * 0.5);
        reedProp.position.set(rx + (rand() - 0.5) * 2.5, bankY, rz + side * (4.8 + rand() * 1.4));
        reedProp.rotation.y = rand() * Math.PI * 2;
        foliageGroup.add(reedProp);
      }
    }
  }

  // 4d. Swimming 3D Prehistoric Fish in the Crystal River & Coastal Ocean
  for (let f = 0; f < 22; f++) {
    const isOceanFish = f >= 14;
    const fx = isOceanFish ? 55 + (rand() - 0.5) * 40 : -75 + f * 9.5;
    const fz = isOceanFish ? 52 + (rand() - 0.5) * 35 : getRiverCenterZ(fx) + (rand() - 0.5) * 3.2;
    const groundY = getTerrainHeight(fx, fz);
    const fy = isOceanFish ? 0.15 : Math.max(0.35, groundY + 0.8);
    const fishMesh = buildRiverFishModel(mat, 0.75 + rand() * 0.55);
    fishMesh.position.set(fx, fy, fz);
    foliageGroup.add(fishMesh);
    fishActors.push({
      mesh: fishMesh,
      baseX: fx,
      baseZ: fz,
      baseY: fy,
      radiusX: isOceanFish ? 6.5 : 3.8,
      radiusZ: isOceanFish ? 5.5 : 1.6,
      speed: 1.4 + rand() * 1.2,
      phase: rand() * Math.PI * 2,
    });
  }

  // 4e. Scatter 420+ Trees, Snow Pines, Boulders, Shrubs, Grass Tufts & Ferns across the Island
  for (let i = 0; i < 420; i++) {
    const fx = (rand() - 0.5) * 230;
    const fz = (rand() - 0.5) * 230;

    // Keep immediate Campfire, Signal Tower, River Bridge, and Boss centers clear
    if (Math.hypot(fx - 0, fz - 28) < 9.5) continue;
    if (Math.hypot(fx - 0, fz - 5) < 8.5) continue;
    if (Math.hypot(fx - bridgeX, fz - bridgeZ) < 6.5) continue;
    if (Math.hypot(fx - 0, fz - -64) < 15) continue;
    if (Math.hypot(fx - 58, fz - -18) < 11) continue;

    const fy = getTerrainHeight(fx, fz);
    const biome = getTerrainBiome(fx, fz);

    if (biome === 'ocean' || biome === 'river') continue;

    let propType:
      | 'palm'
      | 'pine'
      | 'snow_pine'
      | 'banyan'
      | 'fern'
      | 'shrub'
      | 'grass'
      | 'reed'
      | 'boulder'
      | 'snow_boulder'
      | 'river_stone'
      | 'crystal'
      | 'ice_crystal'
      | 'spire' = 'palm';

    const r = rand();
    if (biome === 'jungle') {
      if (r < 0.16) propType = 'banyan';
      else if (r < 0.34) propType = 'palm';
      else if (r < 0.52) propType = 'shrub';
      else if (r < 0.74) propType = 'grass';
      else if (r < 0.9) propType = 'fern';
      else propType = 'boulder';
    } else if (biome === 'snow') {
      if (r < 0.42) propType = 'snow_pine';
      else if (r < 0.72) propType = 'snow_boulder';
      else if (r < 0.92) propType = 'ice_crystal';
      else propType = 'pine';
    } else if (biome === 'coast') {
      if (r < 0.32) propType = 'palm';
      else if (r < 0.58) propType = 'boulder';
      else if (r < 0.8) propType = 'grass';
      else propType = 'crystal';
    } else if (biome === 'springs') {
      if (r < 0.28) propType = 'pine';
      else if (r < 0.55) propType = 'crystal';
      else if (r < 0.78) propType = 'shrub';
      else propType = 'boulder';
    } else {
      propType = r > 0.35 ? 'spire' : 'boulder';
    }

    const scale = 0.8 + rand() * 0.75;
    const prop = buildFoliageModel(propType, mat, scale);
    prop.position.set(fx, fy, fz);
    prop.rotation.y = rand() * Math.PI * 2;
    foliageGroup.add(prop);
  }

  // 4f. High-Density Procedural Grass Instancing (1,800 InstancedMesh blades with per-instance tint & player-bend data)
  const grassCount = 1800;
  const bladeGeo = new THREE.ConeGeometry(0.11, 0.72, 4);
  bladeGeo.translate(0, 0.36, 0);
  const instancedGrass = new THREE.InstancedMesh(
    bladeGeo,
    mat.grassBladeMaterial,
    grassCount
  );
  instancedGrass.castShadow = false;
  instancedGrass.receiveShadow = true;

  const grassData: GrassInstanceData[] = [];
  const dummy = new THREE.Object3D();
  const gColor = new THREE.Color();
  const grassPalette = [0x4d8c3a, 0x3b7a36, 0x65a30d, 0x2e5c23, 0x5da13c];

  let gIdx = 0;
  for (let attempt = 0; attempt < 3400 && gIdx < grassCount; attempt++) {
    // Concentrate 45% of grass around the central valley & Campfire Haven for rich foreground micro-detail
    const isNearHaven = attempt < 850;
    const gx = isNearHaven ? (rand() - 0.5) * 68 : (rand() - 0.5) * 195;
    const gz = isNearHaven ? 18 + (rand() - 0.5) * 52 : (rand() - 0.5) * 195;

    // Keep immediate campfire firepit (radius 2.4m) and river channel clear
    if (Math.hypot(gx - 0, gz - 28) < 2.5) continue;
    if (Math.hypot(gx - 0, gz - 5) < 4.2) continue;
    const gBiome = getTerrainBiome(gx, gz);
    if (gBiome === 'ocean' || gBiome === 'river' || gBiome === 'lava' || gBiome === 'caldera') continue;

    const gy = getTerrainHeight(gx, gz);
    const gScale = 0.7 + rand() * 0.85;
    const gRotY = rand() * Math.PI * 2;

    dummy.position.set(gx, gy, gz);
    dummy.rotation.set((rand() - 0.5) * 0.22, gRotY, (rand() - 0.5) * 0.22);
    dummy.scale.set(gScale, gScale * (0.85 + rand() * 0.4), gScale);
    dummy.updateMatrix();
    instancedGrass.setMatrixAt(gIdx, dummy.matrix);

    if (gBiome === 'snow') {
      gColor.setHex(0x94a3b8);
    } else {
      gColor.setHex(grassPalette[gIdx % grassPalette.length]);
    }
    instancedGrass.setColorAt(gIdx, gColor);

    grassData.push({ x: gx, y: gy, z: gz, scale: gScale, rotY: gRotY });
    gIdx++;
  }
  instancedGrass.count = gIdx;
  instancedGrass.instanceMatrix.needsUpdate = true;
  if (instancedGrass.instanceColor) instancedGrass.instanceColor.needsUpdate = true;
  instancedGrass.computeBoundingSphere();

  // Campfire Workbench at (0, 28)
  const campGroup = buildCampfireWorkbench(mat);
  campGroup.position.set(0, getTerrainHeight(0, 28), 28);

  // Ancient Signal Tower at (0, 5)
  let towerGroup = buildSignalTower(mat, 0, false);
  towerGroup.position.set(0, getTerrainHeight(0, 5), 5);

  const clueGroup = new THREE.Group();

  const updateTowerStage = (stage: number, lit: boolean) => {
    const parent = towerGroup.parent;
    if (parent) {
      parent.remove(towerGroup);
    }
    towerGroup = buildSignalTower(mat, stage, lit);
    towerGroup.position.set(0, getTerrainHeight(0, 5), 5);
    if (parent) {
      parent.add(towerGroup);
    }
  };

  return {
    mesh,
    oceanMesh,
    riverMesh,
    lavaFlowMesh,
    foliageGroup,
    instancedGrass,
    grassData,
    campGroup,
    towerGroup,
    clueGroup,
    fishActors,
    getHeight: getTerrainHeight,
    getBiome: getTerrainBiome,
    updateTowerStage,
  };
}

export function createInitialTrackClues(): TrackClue[] {
  return [
    {
      id: 'clue_raptor_1',
      species: 'raptor',
      biome: 'jungle',
      x: -14,
      y: getTerrainHeight(-14, 34),
      z: 34,
      discovered: false,
      description: 'Deep three-toed sickle talon prints pressed into soft jungle mud.',
    },
    {
      id: 'clue_snapjaw_1',
      species: 'snapjaw',
      biome: 'river',
      x: -16,
      y: getTerrainHeight(-16, 16),
      z: 16,
      discovered: false,
      description: 'Webbed claw marks and crushed turquoise fish scales along the wet river cobbles.',
    },
    {
      id: 'clue_bronto_1',
      species: 'brontoshell',
      biome: 'coast',
      x: 24,
      y: getTerrainHeight(24, 30),
      z: 30,
      discovered: false,
      description: 'Crushed black-sand furrow and shed mineralized carapace fragments.',
    },
    {
      id: 'clue_frostfang_1',
      species: 'frostfang',
      biome: 'snow',
      x: 42,
      y: getTerrainHeight(42, -10),
      z: -10,
      discovered: false,
      description: 'Massive wool-lined crater footprints and tusk-scored alpine pine bark in the snow.',
    },
    {
      id: 'clue_thunder_1',
      species: 'thunderhorn',
      biome: 'springs',
      x: -26,
      y: getTerrainHeight(-26, -6),
      z: -6,
      discovered: false,
      description: 'Scorched sulfur crust vitrified by a high-voltage horn discharge.',
    },
    {
      id: 'clue_titan_1',
      species: 'caldera_titan',
      biome: 'caldera',
      x: 0,
      y: getTerrainHeight(0, -36),
      z: -36,
      discovered: false,
      description: 'Smoldering claw craters radiating intense volcanic heat toward the summit.',
    },
  ];
}
