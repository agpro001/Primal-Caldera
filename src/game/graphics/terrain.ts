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
  populateForestBiomeGrid,
  createSculptedOrganicGeometry,
} from '../engine/assetLoaderAndRigging.ts';

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
 */
export function getRiverCenterZ(x: number): number {
  return 15 + Math.sin(x * 0.042) * 5.2 + Math.cos(x * 0.02) * 2.4;
}

export const FOREST_PLATEAU_Y = 2.4;

/**
 * Pure deterministic height function for the expanded 680x680 3D island.
 */
export function getTerrainHeight(x: number, z: number): number {
  const distFromCenter = Math.hypot(x, z);

  // Base undulating island hills
  let h =
    Math.sin(x * 0.032) * Math.cos(z * 0.032) * 2.4 +
    Math.sin(x * 0.075 + z * 0.055) * 0.95 +
    2.4;

  // Flatten Campfire Haven (around 0, 28)
  const distToCamp = Math.hypot(x - 0, z - 28);
  if (distToCamp < 16) {
    const t = Math.max(0, (distToCamp - 7) / 9);
    h = h * t + 2.4 * (1 - t);
  }

  // Flatten vast Mystic Forest Expanse Plane (z from 30 to 185, x from -140 to +120)
  // so all 15 connected 3D Forest GLB tiles sit on the exact same coplanar level with zero glitch!
  if (z > 28 && z < 190 && x > -145 && x < 125) {
    const edgeX = Math.min(1, Math.min(x - -145, 125 - x) / 14);
    const edgeZ = Math.min(1, Math.min(z - 28, 190 - z) / 12);
    const blend = Math.max(0, Math.min(1, edgeX * edgeZ));
    h = h * (1 - blend) + FOREST_PLATEAU_Y * blend;
  }

  // Flatten Central Signal Tower Plateau (around 0, 5)
  const distToTower = Math.hypot(x - 0, z - 5);
  if (distToTower < 13) {
    const t = Math.max(0, (distToTower - 5) / 8);
    h = h * t + 3.4 * (1 - t);
  }

  // Eastern Cold Snow Mountain Range (centered around x: 76, z: -18)
  const distToSnowRange = Math.hypot((x - 76) * 0.82, (z + 16) * 0.72);
  if (distToSnowRange < 48) {
    const snowFactor = Math.max(0, 1 - distToSnowRange / 48);
    const distToMammothArena = Math.hypot(x - 58, z + 18);
    if (distToMammothArena < 16) {
      const arenaBlend = Math.max(0, (distToMammothArena - 9) / 7);
      h = h * arenaBlend + 6.8 * (1 - arenaBlend);
    } else {
      const peakRidge =
        Math.pow(snowFactor, 1.45) * 19.5 +
        Math.abs(Math.sin(x * 0.11) * Math.cos(z * 0.11)) * 3.8 * snowFactor;
      h += peakRidge;
    }
  }

  // Northern Volcanic Caldera Ridge (z < -38)
  if (z < -32) {
    const northFactor = Math.min(1, (-32 - z) / 55);
    const distToBossArena = Math.hypot(x - 0, z - -64);
    if (distToBossArena < 24) {
      const arenaEdge = Math.max(0, (distToBossArena - 16) / 8);
      h = 6.8 + arenaEdge * 3.0;
    } else {
      h += northFactor * 7.8;
    }
  }

  // Winding Crystal River Channel (flows from x = -155 to x = +85 around getRiverCenterZ(x))
  if (x > -160 && x < 88) {
    const riverZ = getRiverCenterZ(x);
    const distToRiver = Math.abs(z - riverZ);
    const riverHalfWidth = 5.6;
    if (distToRiver < riverHalfWidth + 3.5) {
      const bankBlend = Math.max(0, Math.min(1, (distToRiver - riverHalfWidth) / 3.5));
      const riverbedHeight = 0.55 + (x > 42 ? (x - 42) * 0.06 : 0);
      h = h * bankBlend + riverbedHeight * (1 - bankBlend);
    }
  }

  // Outer Island Coastal Slope into the 3D Surrounding Ocean
  if (distFromCenter > 210) {
    const oceanBlend = Math.min(1, (distFromCenter - 210) / 48);
    h = h * (1 - oceanBlend) + -1.4 * oceanBlend;
  }

  return h;
}

/**
 * Determines the active biome at world coordinates (x, z).
 */
export function getTerrainBiome(x: number, z: number): BiomeType {
  const distFromCenter = Math.hypot(x, z);
  if (distFromCenter > 220) {
    return 'ocean';
  }
  if (x > -155 && x < 82 && Math.abs(z - getRiverCenterZ(x)) < 6.4) {
    return 'river';
  }
  const distToSnowRange = Math.hypot((x - 76) * 0.82, (z + 16) * 0.72);
  if (distToSnowRange < 42 || (x > 44 && z < 12 && z > -56)) {
    return 'snow';
  }
  if (z < -48) {
    return 'caldera';
  }
  if (z < -26 && x > 14 && x <= 44) {
    return 'lava';
  }
  if (x < -26 && z < 8) {
    return 'springs';
  }
  if (x > 36 && z >= 18 && z < 34) {
    return 'coast';
  }
  return 'jungle';
}

export function createTerrain(mat: MaterialCache): TerrainSystem {
  const size = 680;
  const segments = 150;
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
        vColor.setHex(0xf1f5f9);
      } else {
        vColor.setHex(0x94a3b8);
      }
    } else if (biome === 'river') {
      vColor.setHex(0x1f626d);
    } else if (biome === 'ocean') {
      vColor.setHex(0x134e6f);
    } else if (biome === 'coast') {
      vColor.setHex(0x272a30);
    } else if (biome === 'springs') {
      vColor.setHex(0x6c6538);
    } else if (biome === 'lava') {
      vColor.setHex(0x45221a);
    } else if (biome === 'caldera') {
      vColor.setHex(0x363640);
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
  const oceanGeo = new THREE.PlaneGeometry(680, 680, 32, 32);
  oceanGeo.rotateX(-Math.PI / 2);
  const oceanMesh = new THREE.Mesh(oceanGeo, mat.oceanMaterial);
  oceanMesh.position.y = 0.35;

  // 2. Winding 3D Crystal River Water Ribbon Mesh
  const riverLengthX = 210;
  const riverWidthZ = 13.5;
  const riverGeo = new THREE.PlaneGeometry(riverLengthX, riverWidthZ, 80, 8);
  riverGeo.rotateX(-Math.PI / 2);
  const rPos = riverGeo.attributes.position;
  for (let i = 0; i < rPos.count; i++) {
    const localX = rPos.getX(i) - 18;
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
    { x: 88, z: -28, scale: 2.1, rot: 0.4 },
    { x: 94, z: -6, scale: 1.9, rot: 1.8 },
    { x: 74, z: -44, scale: 1.75, rot: 2.5 },
    { x: 84, z: 14, scale: 1.6, rot: 3.1 },
  ];
  for (const mp of mountainPeakCoords) {
    const peakModel = buildSnowMountainPeakModel(mat, mp.scale);
    peakModel.position.set(mp.x, getTerrainHeight(mp.x, mp.z), mp.z);
    peakModel.rotation.y = mp.rot;
    peakModel.userData.isStaticStructure = true;
    foliageGroup.add(peakModel);
  }

  // 4b. Tribal Timber River Bridge crossing the Crystal River at x = -8
  const bridgeX = -8;
  const bridgeZ = getRiverCenterZ(bridgeX);
  const bridgeModel = buildRiverBridgeModel(mat);
  bridgeModel.position.set(bridgeX, getTerrainHeight(bridgeX, bridgeZ) + 0.95, bridgeZ);
  bridgeModel.userData.isStaticStructure = true;
  foliageGroup.add(bridgeModel);

  // 4c. Riverbank Wet Cobble Stones, Reeds & Boulders along both banks of the Crystal River
  for (let rx = -105; rx <= 64; rx += 7.5) {
    const rz = getRiverCenterZ(rx);
    for (const side of [-1, 1]) {
      if (Math.abs(rx - bridgeX) < 5) continue;
      const bankZ = rz + side * (5.6 + rand() * 2.2);
      const bankY = getTerrainHeight(rx, bankZ);
      const stoneProp = buildFoliageModel('river_stone', mat, 0.8 + rand() * 0.8);
      stoneProp.position.set(rx + (rand() - 0.5) * 2, bankY, bankZ);
      stoneProp.rotation.y = rand() * Math.PI * 2;
      stoneProp.userData.isStaticStructure = true;
      foliageGroup.add(stoneProp);

      if (rand() > 0.45) {
        const reedProp = buildFoliageModel('reed', mat, 0.9 + rand() * 0.5);
        reedProp.position.set(rx + (rand() - 0.5) * 2.5, bankY, rz + side * (4.8 + rand() * 1.4));
        reedProp.rotation.y = rand() * Math.PI * 2;
        foliageGroup.add(reedProp);
      }
    }
  }

  // 4d. Swimming 3D Prehistoric Fish in the Crystal River & Coastal Ocean
  for (let f = 0; f < 16; f++) {
    const isOceanFish = f >= 10;
    const fx = isOceanFish ? 65 + (rand() - 0.5) * 40 : -75 + f * 12.5;
    const fz = isOceanFish ? 55 + (rand() - 0.5) * 35 : getRiverCenterZ(fx) + (rand() - 0.5) * 3.2;
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

  // 4e. Scatter Trees, Snow Pines, Boulders, Shrubs, Grass Tufts & Ferns across the Expanded Island
  for (let i = 0; i < 360; i++) {
    const fx = (rand() - 0.5) * 380;
    const fz = (rand() - 0.5) * 380;

    // Keep immediate Campfire, Signal Tower, River Bridge, Boss centers, and Forest GLB Road clear
    if (Math.hypot(fx - 0, fz - 28) < 10.5) continue;
    if (Math.hypot(fx - 0, fz - 5) < 8.5) continue;
    if (Math.hypot(fx - bridgeX, fz - bridgeZ) < 6.5) continue;
    if (Math.hypot(fx - 0, fz - -64) < 15) continue;
    if (Math.hypot(fx - 58, fz - -18) < 11) continue;
    if (fz > 34 && fz < 165 && fx > -105 && fx < 85) continue;

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
      if (r < 0.18) propType = 'banyan';
      else if (r < 0.36) propType = 'palm';
      else if (r < 0.54) propType = 'shrub';
      else if (r < 0.76) propType = 'grass';
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
    if (propType.includes('boulder') || propType.includes('crystal') || propType === 'spire') {
      prop.userData.isStaticStructure = true;
    }
    foliageGroup.add(prop);
  }

  // 4f. Expanded 15-Tile Coplanar Mystic Forest Biome Grid (a_forest_3_with_a_road_at_night_for_game.glb)
  // Measures exact X and Z dimensions of the loaded forest GLB and places a 5x3 grid
  // edge-to-edge on the exact same horizontal plane (FOREST_PLATEAU_Y + 0.05) with zero overlap or glitch!
  populateForestBiomeGrid(foliageGroup, FOREST_PLATEAU_Y, -10, 52, 5, 3, 34.0);

  // 4g. Optimized Procedural Grass Instancing (900 InstancedMesh blades for smooth 60 FPS on any device)
  const grassCount = 900;
  const bladeGeo = createSculptedOrganicGeometry(
    [
      [0.0, 0.11, 0.04],
      [0.5, 0.08, 0.03],
      [1.0, 0.005, 0.005],
    ],
    5,
    0.72,
    0
  );
  const instancedGrass = new THREE.InstancedMesh(
    bladeGeo,
    mat.grassBladeMaterial,
    grassCount
  );
  instancedGrass.castShadow = false;
  instancedGrass.receiveShadow = false;

  const grassData: GrassInstanceData[] = [];
  const dummy = new THREE.Object3D();
  const gColor = new THREE.Color();
  const grassPalette = [0x4d8c3a, 0x3b7a36, 0x65a30d, 0x2e5c23, 0x5da13c];

  let gIdx = 0;
  for (let attempt = 0; attempt < 1800 && gIdx < grassCount; attempt++) {
    const isNearHaven = attempt < 450;
    const gx = isNearHaven ? (rand() - 0.5) * 78 : (rand() - 0.5) * 240;
    const gz = isNearHaven ? 26 + (rand() - 0.5) * 65 : (rand() - 0.5) * 240;

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
