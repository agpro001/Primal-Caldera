/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import type { BiomeType, TrackClue, BeastSpecies } from '../../types/game.ts';
import { MaterialCache } from './materials.ts';
import {
  buildFoliageModel,
  buildCampfireModel,
  buildSignalTowerModel,
  buildAncientMonolith,
  buildTotemArch,
} from './proceduralModels.ts';

export interface TerrainSystem {
  mesh: THREE.Mesh;
  getHeight: (x: number, z: number) => number;
  getNormal: (x: number, z: number, target: THREE.Vector3) => THREE.Vector3;
  getBiomeAt: (x: number, z: number) => BiomeType;
  clues: TrackClue[];
  clueGroup: THREE.Group;
  foliageGroup: THREE.Group;
  campGroup: THREE.Group;
  towerGroup: THREE.Group;
  lavaFlowMesh: THREE.Mesh;
}

export function getTerrainHeight(x: number, z: number): number {
  const distFromCenter = Math.hypot(x, z);
  if (distFromCenter > 130) {
    return -4.0; // Outer ocean
  }

  // Volcanic Caldera Peak in the North (x: 0, z: -90)
  const calderaDist = Math.hypot(x, z + 90);
  let calderaHeight = 0;
  if (calderaDist < 55) {
    const factor = 1 - calderaDist / 55;
    calderaHeight = 22 * Math.pow(factor, 1.4);
    // Crater depression in very center of caldera
    if (calderaDist < 16) {
      calderaHeight -= (1 - calderaDist / 16) * 7.5;
    }
  }

  // Regional rolling hills and ravines
  const wave1 = Math.sin(x * 0.045) * Math.cos(z * 0.04) * 4.5;
  const wave2 = Math.sin(x * 0.12 + 1.2) * Math.sin(z * 0.09) * 2.2;
  const wave3 = Math.cos(x * 0.02 + z * 0.025) * 3.0;

  // Base island gradient: high in north/center, sloping to sea in south
  const islandSlope = ((120 - distFromCenter) / 120) * 5.0;

  let totalHeight = islandSlope + wave1 + wave2 + wave3 + calderaHeight;

  // Ravine cut in Jungle (South-West)
  if (x < -15 && z > 15 && z < 70) {
    const ravineCenter = -35 + Math.sin(z * 0.08) * 8;
    const rDist = Math.abs(x - ravineCenter);
    if (rDist < 12) {
      totalHeight -= (1 - rDist / 12) * 5.5;
    }
  }

  return Math.max(0.1, totalHeight);
}

export function getTerrainBiome(x: number, z: number): BiomeType {
  if (z < -55) {
    return 'caldera';
  }
  if (x > 15 && z < 10) {
    return 'lava';
  }
  if (x < -20 && z < 20) {
    return 'springs';
  }
  if (x > 10 && z >= 15) {
    return 'coast';
  }
  return 'jungle';
}

export function createTerrain(mat: MaterialCache): TerrainSystem {
  const size = 260;
  const segments = 128;
  const geometry = new THREE.PlaneGeometry(size, size, segments, segments);
  geometry.rotateX(-Math.PI / 2);

  const pos = geometry.attributes.position;
  const count = pos.count;
  const colors = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    const vx = pos.getX(i);
    const vz = pos.getZ(i);
    const vy = getTerrainHeight(vx, vz);
    pos.setY(i, vy);

    const biome = getTerrainBiome(vx, vz);
    let r = 0.2, g = 0.35, b = 0.18; // jungle green
    if (biome === 'coast') {
      r = 0.12; g = 0.12; b = 0.14; // black sand
    } else if (biome === 'springs') {
      r = 0.45; g = 0.42; b = 0.25; // sulfur
    } else if (biome === 'lava') {
      r = 0.25; g = 0.15; b = 0.12; // basalt
    } else if (biome === 'caldera') {
      r = 0.2; g = 0.2; b = 0.25; // ash
    }

    colors[i * 3] = r;
    colors[i * 3 + 1] = g;
    colors[i * 3 + 2] = b;
  }

  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();

  // Terrain material with vertex colors and blended detail
  const terrainMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.85,
    metalness: 0.1,
  });

  const mesh = new THREE.Mesh(geometry, terrainMaterial);
  mesh.receiveShadow = true;

  // Lava river plane in the lava biome
  const lavaGeo = new THREE.PlaneGeometry(35, 75, 16, 32);
  lavaGeo.rotateX(-Math.PI / 2);
  const lavaPos = lavaGeo.attributes.position;
  for (let i = 0; i < lavaPos.count; i++) {
    const lx = 38 + lavaPos.getX(i);
    const lz = -25 + lavaPos.getZ(i);
    lavaPos.setY(i, getTerrainHeight(lx, lz) - 0.2);
  }
  lavaGeo.computeVertexNormals();
  const lavaFlowMesh = new THREE.Mesh(lavaGeo, mat.lavaMaterial);
  lavaFlowMesh.position.set(38, 0, -25);

  // Normal calculation helper
  const tempV = new THREE.Vector3();
  const getNormal = (x: number, z: number, target: THREE.Vector3): THREE.Vector3 => {
    const eps = 0.5;
    const hL = getTerrainHeight(x - eps, z);
    const hR = getTerrainHeight(x + eps, z);
    const hD = getTerrainHeight(x, z - eps);
    const hU = getTerrainHeight(x, z + eps);
    target.set(hL - hR, 2 * eps, hD - hU).normalize();
    return target;
  };

  // Groups
  const foliageGroup = new THREE.Group();
  const clueGroup = new THREE.Group();
  const campGroup = buildCampfireModel(mat);
  campGroup.position.set(0, getTerrainHeight(0, 25), 25);

  const towerGroup = buildSignalTowerModel(mat);
  const towerH = getTerrainHeight(0, -95);
  towerGroup.position.set(0, towerH, -95);

  // Scatter Foliage & Props across biomes
  const seededRandom = (seed: number) => {
    const x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
  };

  let seed = 42;
  for (let i = 0; i < 90; i++) {
    const fx = (seededRandom(seed++) - 0.5) * 190;
    const fz = (seededRandom(seed++) - 0.5) * 190;
    const distCenter = Math.hypot(fx, fz);
    if (distCenter > 115 || (Math.hypot(fx, fz - 25) < 8) || (Math.hypot(fx, fz + 95) < 18)) {
      continue;
    }
    const fy = getTerrainHeight(fx, fz);
    const biome = getTerrainBiome(fx, fz);

    if (biome === 'jungle') {
      const palm = buildFoliageModel('palm', mat);
      palm.position.set(fx, fy, fz);
      const s = 0.8 + seededRandom(seed++) * 0.4;
      palm.scale.set(s, s, s);
      foliageGroup.add(palm);

      const fern = buildFoliageModel('fern', mat);
      fern.position.set(fx + (seededRandom(seed++) - 0.5) * 4, fy, fz + (seededRandom(seed++) - 0.5) * 4);
      foliageGroup.add(fern);
    } else if (biome === 'lava' || biome === 'caldera') {
      const basalt = buildFoliageModel('basalt', mat);
      basalt.position.set(fx, fy, fz);
      foliageGroup.add(basalt);
    } else if (biome === 'coast') {
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(1.2 + seededRandom(seed++) * 1.5), mat.obsidianMaterial);
      rock.position.set(fx, fy + 0.4, fz);
      foliageGroup.add(rock);
    }
  }

  // Prehistoric Gateways & Landmarks
  const archConfigs = [
    { x: -14, z: 22, rot: 0.3 }, // Jungle Ravine Gateway
    { x: 18, z: 22, rot: -0.4 }, // Black-Sand Coast Gateway
    { x: -22, z: 8, rot: 1.1 }, // Steaming Springs Gateway
    { x: 0, z: -55, rot: 0 },   // High Caldera Summit Gateway
  ];

  archConfigs.forEach((cfg) => {
    const arch = buildTotemArch(mat);
    const ay = getTerrainHeight(cfg.x, cfg.z);
    arch.position.set(cfg.x, ay, cfg.z);
    arch.rotation.y = cfg.rot;
    foliageGroup.add(arch);
  });

  const monolithLocations = [
    { x: -5, z: 20 },
    { x: 8, z: 18 },
    { x: -38, z: -10 },
    { x: 35, z: 25 },
    { x: 10, z: -80 },
    { x: -10, z: -80 },
  ];

  monolithLocations.forEach((loc) => {
    const mono = buildAncientMonolith(mat);
    const my = getTerrainHeight(loc.x, loc.z);
    mono.position.set(loc.x, my, loc.z);
    foliageGroup.add(mono);
  });

  // Generate Tracking Clues across the map
  const clues: TrackClue[] = [
    // Raptor Trail in Jungle Ravine
    {
      id: 'clue_raptor_1',
      type: 'footprint',
      species: 'raptor',
      beastId: 'raptor_alpha',
      x: -12,
      y: getTerrainHeight(-12, 35) + 0.05,
      z: 35,
      rotation: 0.8,
      age: 0.1,
      inspected: false,
    },
    {
      id: 'clue_raptor_2',
      type: 'broken_brush',
      species: 'raptor',
      beastId: 'raptor_alpha',
      x: -24,
      y: getTerrainHeight(-24, 46) + 0.1,
      z: 46,
      rotation: 1.2,
      age: 0.2,
      inspected: false,
    },
    {
      id: 'clue_raptor_3',
      type: 'blood',
      species: 'raptor',
      beastId: 'raptor_alpha',
      x: -36,
      y: getTerrainHeight(-36, 58) + 0.05,
      z: 58,
      rotation: 0.4,
      age: 0.05,
      inspected: false,
    },

    // Brontoshell Trail on Coast
    {
      id: 'clue_bronto_1',
      type: 'droppings',
      species: 'brontoshell',
      beastId: 'bronto_behemoth',
      x: 25,
      y: getTerrainHeight(25, 32) + 0.1,
      z: 32,
      rotation: -0.4,
      age: 0.3,
      inspected: false,
    },
    {
      id: 'clue_bronto_2',
      type: 'footprint',
      species: 'brontoshell',
      beastId: 'bronto_behemoth',
      x: 42,
      y: getTerrainHeight(42, 45) + 0.05,
      z: 45,
      rotation: -0.7,
      age: 0.1,
      inspected: false,
    },

    // Thunderhorn Trail in Springs
    {
      id: 'clue_horn_1',
      type: 'claw_mark',
      species: 'thunderhorn',
      beastId: 'thunderhorn_prime',
      x: -30,
      y: getTerrainHeight(-30, 0) + 0.1,
      z: 0,
      rotation: -1.4,
      age: 0.2,
      inspected: false,
    },
    {
      id: 'clue_horn_2',
      type: 'footprint',
      species: 'thunderhorn',
      beastId: 'thunderhorn_prime',
      x: -45,
      y: getTerrainHeight(-45, -15) + 0.05,
      z: -15,
      rotation: -1.8,
      age: 0.05,
      inspected: false,
    },

    // Caldera Titan Trail
    {
      id: 'clue_titan_1',
      type: 'broken_brush',
      species: 'caldera_titan',
      beastId: 'caldera_titan_boss',
      x: 0,
      y: getTerrainHeight(0, -65) + 0.1,
      z: -65,
      rotation: 0,
      age: 0.05,
      inspected: false,
    },
  ];

  // Visual markers for clues
  clues.forEach((c) => {
    const clueMesh = new THREE.Group();
    clueMesh.name = c.id;
    clueMesh.position.set(c.x, c.y, c.z);

    // Indicator disk
    const disk = new THREE.Mesh(
      new THREE.RingGeometry(0.4, 0.7, 12),
      new THREE.MeshBasicMaterial({
        color: 0xf59e0b,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.75,
      })
    );
    disk.rotation.x = -Math.PI / 2;
    clueMesh.add(disk);

    // Pillar beacon for Tracker Vision
    const beacon = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, 2.5, 6),
      new THREE.MeshBasicMaterial({
        color: 0xfbbf24,
        transparent: true,
        opacity: 0.6,
      })
    );
    beacon.position.y = 1.25;
    clueMesh.add(beacon);

    clueGroup.add(clueMesh);
  });

  return {
    mesh,
    getHeight: getTerrainHeight,
    getNormal,
    getBiomeAt: getTerrainBiome,
    clues,
    clueGroup,
    foliageGroup,
    campGroup,
    towerGroup,
    lavaFlowMesh,
  };
}
