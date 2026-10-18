/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import type { BiomeType, BeastSpecies } from '../../types/game.ts';

function createTileCanvas(width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  draw(ctx);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

export function generateBiomeTexture(biome: BiomeType): THREE.CanvasTexture {
  return createTileCanvas(512, 512, (ctx) => {
    if (biome === 'jungle') {
      // Lush prehistoric moss and loam
      ctx.fillStyle = '#22381e';
      ctx.fillRect(0, 0, 512, 512);

      // Noise and fern scatter
      for (let i = 0; i < 1800; i++) {
        const x = Math.random() * 512;
        const y = Math.random() * 512;
        const r = Math.random() * 3 + 1;
        ctx.fillStyle = Math.random() > 0.4 ? '#33522a' : '#172714';
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      // Fallen golden leaves & twigs
      for (let i = 0; i < 120; i++) {
        ctx.strokeStyle = Math.random() > 0.5 ? '#5d4e28' : '#3d3016';
        ctx.lineWidth = Math.random() * 2 + 1;
        ctx.beginPath();
        const sx = Math.random() * 512;
        const sy = Math.random() * 512;
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + (Math.random() - 0.5) * 20, sy + (Math.random() - 0.5) * 20);
        ctx.stroke();
      }
    } else if (biome === 'coast') {
      // Black volcanic sand
      ctx.fillStyle = '#18191c';
      ctx.fillRect(0, 0, 512, 512);
      for (let i = 0; i < 2400; i++) {
        const x = Math.random() * 512;
        const y = Math.random() * 512;
        ctx.fillStyle = Math.random() > 0.7 ? '#2a2c33' : '#101114';
        ctx.fillRect(x, y, 2, 2);
      }
      // Shiny obsidian mica specks
      for (let i = 0; i < 150; i++) {
        ctx.fillStyle = '#4c5264';
        ctx.fillRect(Math.random() * 512, Math.random() * 512, 3, 3);
      }
    } else if (biome === 'springs') {
      // Sulfur geothermal mineral crust
      ctx.fillStyle = '#4a442e';
      ctx.fillRect(0, 0, 512, 512);
      // Bright sulfur bands
      for (let i = 0; i < 30; i++) {
        const grad = ctx.createRadialGradient(
          Math.random() * 512, Math.random() * 512, 5,
          Math.random() * 512, Math.random() * 512, 70
        );
        grad.addColorStop(0, '#a3973c');
        grad.addColorStop(0.5, '#6b6630');
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 512, 512);
      }
    } else if (biome === 'lava') {
      // Dark basalt crust with glowing magma fissures
      ctx.fillStyle = '#1c1716';
      ctx.fillRect(0, 0, 512, 512);
      for (let i = 0; i < 15; i++) {
        ctx.strokeStyle = '#e65100';
        ctx.lineWidth = Math.random() * 4 + 2;
        ctx.beginPath();
        let px = Math.random() * 512;
        let py = Math.random() * 512;
        ctx.moveTo(px, py);
        for (let j = 0; j < 6; j++) {
          px += (Math.random() - 0.5) * 80;
          py += (Math.random() - 0.5) * 80;
          ctx.lineTo(px, py);
        }
        ctx.stroke();
      }
      // Hot center veins
      ctx.strokeStyle = '#ffb300';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    } else {
      // Caldera summit: high ash and pumice stone
      ctx.fillStyle = '#222328';
      ctx.fillRect(0, 0, 512, 512);
      for (let i = 0; i < 1200; i++) {
        ctx.fillStyle = Math.random() > 0.5 ? '#363842' : '#141518';
        ctx.beginPath();
        ctx.arc(Math.random() * 512, Math.random() * 512, Math.random() * 4 + 1, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  });
}

export function generateMagmaFlowTexture(): THREE.CanvasTexture {
  return createTileCanvas(256, 256, (ctx) => {
    const grad = ctx.createLinearGradient(0, 0, 256, 256);
    grad.addColorStop(0, '#bf2600');
    grad.addColorStop(0.3, '#ff5722');
    grad.addColorStop(0.7, '#ffab00');
    grad.addColorStop(1, '#ff3d00');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);

    ctx.fillStyle = '#ffea00';
    for (let i = 0; i < 40; i++) {
      ctx.beginPath();
      ctx.arc(Math.random() * 256, Math.random() * 256, Math.random() * 12 + 4, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

export function generateBeastTexture(species: BeastSpecies): THREE.CanvasTexture {
  return createTileCanvas(256, 256, (ctx) => {
    if (species === 'raptor') {
      // Striped predatory reptile skin
      ctx.fillStyle = '#3a5f38';
      ctx.fillRect(0, 0, 256, 256);
      ctx.fillStyle = '#1f381e';
      for (let i = 0; i < 12; i++) {
        ctx.beginPath();
        ctx.moveTo(0, i * 22);
        ctx.lineTo(256, i * 22 + 10);
        ctx.lineTo(256, i * 22 + 20);
        ctx.lineTo(0, i * 22 + 8);
        ctx.fill();
      }
      // Feather spots
      ctx.fillStyle = '#d35400';
      for (let i = 0; i < 60; i++) {
        ctx.fillRect(Math.random() * 256, Math.random() * 256, 4, 6);
      }
    } else if (species === 'brontoshell') {
      // Rugged volcanic stone plates
      ctx.fillStyle = '#2c2d33';
      ctx.fillRect(0, 0, 256, 256);
      ctx.strokeStyle = '#4a4b54';
      ctx.lineWidth = 3;
      for (let x = 0; x < 256; x += 32) {
        for (let y = 0; y < 256; y += 32) {
          ctx.strokeRect(x, y, 30, 30);
        }
      }
    } else if (species === 'thunderhorn') {
      // Weathered leathery gray with electric teal streaks
      ctx.fillStyle = '#41474d';
      ctx.fillRect(0, 0, 256, 256);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      for (let i = 0; i < 8; i++) {
        ctx.beginPath();
        let x = Math.random() * 256;
        let y = 0;
        ctx.moveTo(x, y);
        while (y < 256) {
          x += (Math.random() - 0.5) * 30;
          y += 25;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    } else {
      // Caldera Titan: Black igneous scales with fiery veins
      ctx.fillStyle = '#161314';
      ctx.fillRect(0, 0, 256, 256);
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 3;
      for (let i = 0; i < 18; i++) {
        ctx.beginPath();
        ctx.arc(Math.random() * 256, Math.random() * 256, Math.random() * 24 + 8, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  });
}

export function generateHunterTexture(): THREE.CanvasTexture {
  return createTileCanvas(256, 256, (ctx) => {
    // Tanned skin with tribal ochre tattoos
    ctx.fillStyle = '#9e6749';
    ctx.fillRect(0, 0, 256, 256);

    // Ochre red tribal war markings
    ctx.fillStyle = '#b91c1c';
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.arc(60 + i * 28, 70, 8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = '#b91c1c';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(20, 140);
    ctx.lineTo(236, 140);
    ctx.moveTo(20, 160);
    ctx.lineTo(236, 160);
    ctx.stroke();
  });
}

export class MaterialCache {
  public groundMaterials: Record<BiomeType, THREE.MeshStandardMaterial>;
  public beastMaterials: Record<BeastSpecies, THREE.MeshStandardMaterial>;
  public beastEnragedMaterials: Record<BeastSpecies, THREE.MeshStandardMaterial>;
  public hunterMaterial: THREE.MeshStandardMaterial;
  public hunterArmorMaterials: Record<string, THREE.MeshStandardMaterial>;
  public lavaMaterial: THREE.MeshStandardMaterial;
  public obsidianMaterial: THREE.MeshStandardMaterial;
  public boneMaterial: THREE.MeshStandardMaterial;
  public woodMaterial: THREE.MeshStandardMaterial;
  public leafMaterial: THREE.MeshStandardMaterial;
  public stoneMaterial: THREE.MeshStandardMaterial;

  constructor() {
    this.groundMaterials = {
      jungle: new THREE.MeshStandardMaterial({
        map: generateBiomeTexture('jungle'),
        roughness: 0.85,
        metalness: 0.05,
      }),
      coast: new THREE.MeshStandardMaterial({
        map: generateBiomeTexture('coast'),
        roughness: 0.7,
        metalness: 0.15,
      }),
      springs: new THREE.MeshStandardMaterial({
        map: generateBiomeTexture('springs'),
        roughness: 0.6,
        metalness: 0.1,
      }),
      lava: new THREE.MeshStandardMaterial({
        map: generateBiomeTexture('lava'),
        roughness: 0.5,
        metalness: 0.2,
      }),
      caldera: new THREE.MeshStandardMaterial({
        map: generateBiomeTexture('caldera'),
        roughness: 0.8,
        metalness: 0.1,
      }),
    };

    // Configure repeat
    Object.values(this.groundMaterials).forEach((mat) => {
      if (mat.map) {
        mat.map.repeat.set(16, 16);
      }
    });

    this.beastMaterials = {
      raptor: new THREE.MeshStandardMaterial({
        map: generateBeastTexture('raptor'),
        roughness: 0.65,
        metalness: 0.1,
      }),
      brontoshell: new THREE.MeshStandardMaterial({
        map: generateBeastTexture('brontoshell'),
        roughness: 0.85,
        metalness: 0.15,
      }),
      thunderhorn: new THREE.MeshStandardMaterial({
        map: generateBeastTexture('thunderhorn'),
        roughness: 0.7,
        metalness: 0.2,
      }),
      caldera_titan: new THREE.MeshStandardMaterial({
        map: generateBeastTexture('caldera_titan'),
        roughness: 0.45,
        metalness: 0.35,
      }),
    };

    this.beastEnragedMaterials = {
      raptor: new THREE.MeshStandardMaterial({
        color: 0xff3b30,
        emissive: 0xaa1100,
        emissiveIntensity: 0.55,
        roughness: 0.5,
      }),
      brontoshell: new THREE.MeshStandardMaterial({
        color: 0xff4500,
        emissive: 0x992200,
        emissiveIntensity: 0.6,
        roughness: 0.6,
      }),
      thunderhorn: new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x0284c7,
        emissiveIntensity: 0.7,
        roughness: 0.4,
      }),
      caldera_titan: new THREE.MeshStandardMaterial({
        color: 0xff2200,
        emissive: 0xff4400,
        emissiveIntensity: 0.85,
        roughness: 0.3,
      }),
    };

    this.hunterMaterial = new THREE.MeshStandardMaterial({
      map: generateHunterTexture(),
      roughness: 0.75,
      metalness: 0.05,
    });

    this.hunterArmorMaterials = {
      scavenger_rags: new THREE.MeshStandardMaterial({ color: 0x5c4a38, roughness: 0.9 }),
      beast_hide: new THREE.MeshStandardMaterial({ color: 0x33442a, roughness: 0.7 }),
      chitin_cuirass: new THREE.MeshStandardMaterial({ color: 0x3b3d45, roughness: 0.5, metalness: 0.25 }),
      caldera_plate: new THREE.MeshStandardMaterial({ color: 0x241818, emissive: 0x4a1100, roughness: 0.35, metalness: 0.6 }),
    };

    this.lavaMaterial = new THREE.MeshStandardMaterial({
      map: generateMagmaFlowTexture(),
      emissive: 0xff4500,
      emissiveIntensity: 0.75,
      roughness: 0.3,
    });

    this.obsidianMaterial = new THREE.MeshStandardMaterial({
      color: 0x111317,
      roughness: 0.15,
      metalness: 0.8,
    });

    this.boneMaterial = new THREE.MeshStandardMaterial({
      color: 0xe6dfd1,
      roughness: 0.6,
      metalness: 0.05,
    });

    this.woodMaterial = new THREE.MeshStandardMaterial({
      color: 0x453120,
      roughness: 0.85,
    });

    this.leafMaterial = new THREE.MeshStandardMaterial({
      color: 0x2e5e29,
      roughness: 0.7,
      side: THREE.DoubleSide,
    });

    this.stoneMaterial = new THREE.MeshStandardMaterial({
      color: 0x5a5e66,
      roughness: 0.8,
    });
  }
}
