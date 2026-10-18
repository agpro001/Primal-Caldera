/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import type { BiomeType, BeastSpecies } from '../../types/game.ts';

function createTileCanvas(
  width: number,
  height: number,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  draw(ctx, width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export class MaterialCache {
  public biomeGround: Record<BiomeType, THREE.MeshStandardMaterial>;
  public beastSkin: Record<BeastSpecies, THREE.MeshStandardMaterial>;
  public beastUnderbelly: Record<BeastSpecies, THREE.MeshStandardMaterial>;
  public beastAccent: Record<BeastSpecies, THREE.MeshStandardMaterial>;
  public beastEnrageAccent: THREE.MeshStandardMaterial;
  public weakPointGlow: THREE.MeshStandardMaterial;
  public focusClueGlow: THREE.MeshStandardMaterial;
  public hunterSkin: THREE.MeshStandardMaterial;
  public hunterHair: THREE.MeshStandardMaterial;
  public woodMaterial: THREE.MeshStandardMaterial;
  public stoneMaterial: THREE.MeshStandardMaterial;
  public riverStoneMaterial: THREE.MeshStandardMaterial;
  public snowMaterial: THREE.MeshStandardMaterial;
  public glacierIceMaterial: THREE.MeshStandardMaterial;
  public obsidianMaterial: THREE.MeshStandardMaterial;
  public boneMaterial: THREE.MeshStandardMaterial;
  public foliageGreen: THREE.MeshStandardMaterial;
  public foliageDarkGreen: THREE.MeshStandardMaterial;
  public pineSnowGreen: THREE.MeshStandardMaterial;
  public shrubLeafMaterial: THREE.MeshStandardMaterial;
  public grassBladeMaterial: THREE.MeshStandardMaterial;
  public lavaMaterial: THREE.MeshStandardMaterial;
  public waterMaterial: THREE.MeshStandardMaterial;
  public oceanMaterial: THREE.MeshStandardMaterial;
  public fishScaleMaterial: THREE.MeshStandardMaterial;
  public tribalClothRed: THREE.MeshStandardMaterial;
  public tribalClothBlue: THREE.MeshStandardMaterial;
  public tribalGold: THREE.MeshStandardMaterial;

  constructor() {
    // 1. Biome Ground Textures
    this.biomeGround = {
      jungle: new THREE.MeshStandardMaterial({
        map: createTileCanvas(128, 128, (ctx, w, h) => {
          ctx.fillStyle = '#2d4c2b';
          ctx.fillRect(0, 0, w, h);
          for (let i = 0; i < 180; i++) {
            ctx.fillStyle = i % 2 === 0 ? '#243e22' : '#385d34';
            ctx.fillRect((i * 37) % w, (i * 53) % h, 8, 8);
          }
        }),
        roughness: 0.88,
        metalness: 0.05,
      }),
      coast: new THREE.MeshStandardMaterial({
        map: createTileCanvas(128, 128, (ctx, w, h) => {
          ctx.fillStyle = '#2a2d34';
          ctx.fillRect(0, 0, w, h);
          for (let i = 0; i < 160; i++) {
            ctx.fillStyle = i % 3 === 0 ? '#3b4252' : '#1f232a';
            ctx.fillRect((i * 29) % w, (i * 43) % h, 6, 6);
          }
        }),
        roughness: 0.75,
        metalness: 0.15,
      }),
      springs: new THREE.MeshStandardMaterial({
        map: createTileCanvas(128, 128, (ctx, w, h) => {
          ctx.fillStyle = '#5c5336';
          ctx.fillRect(0, 0, w, h);
          for (let i = 0; i < 140; i++) {
            ctx.fillStyle = i % 2 === 0 ? '#786b40' : '#38bdf8';
            ctx.fillRect((i * 41) % w, (i * 61) % h, 7, 7);
          }
        }),
        roughness: 0.65,
        metalness: 0.2,
      }),
      lava: new THREE.MeshStandardMaterial({
        map: createTileCanvas(128, 128, (ctx, w, h) => {
          ctx.fillStyle = '#1c1917';
          ctx.fillRect(0, 0, w, h);
          ctx.strokeStyle = '#ea580c';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(0, 32);
          ctx.lineTo(64, 64);
          ctx.lineTo(128, 48);
          ctx.stroke();
        }),
        roughness: 0.8,
        metalness: 0.25,
      }),
      caldera: new THREE.MeshStandardMaterial({
        map: createTileCanvas(128, 128, (ctx, w, h) => {
          ctx.fillStyle = '#181211';
          ctx.fillRect(0, 0, w, h);
          for (let i = 0; i < 90; i++) {
            ctx.fillStyle = i % 4 === 0 ? '#f97316' : '#292524';
            ctx.fillRect((i * 31) % w, (i * 47) % h, 6, 6);
          }
        }),
        roughness: 0.78,
        metalness: 0.3,
      }),
      snow: new THREE.MeshStandardMaterial({
        map: createTileCanvas(128, 128, (ctx, w, h) => {
          ctx.fillStyle = '#e2e8f0';
          ctx.fillRect(0, 0, w, h);
          for (let i = 0; i < 180; i++) {
            ctx.fillStyle = i % 3 === 0 ? '#f8fafc' : '#cbd5e1';
            ctx.fillRect((i * 23) % w, (i * 41) % h, 8, 8);
          }
        }),
        roughness: 0.55,
        metalness: 0.12,
      }),
      river: new THREE.MeshStandardMaterial({
        map: createTileCanvas(128, 128, (ctx, w, h) => {
          ctx.fillStyle = '#334155';
          ctx.fillRect(0, 0, w, h);
          for (let i = 0; i < 160; i++) {
            ctx.fillStyle = i % 2 === 0 ? '#475569' : '#0f766e';
            ctx.beginPath();
            ctx.arc((i * 37) % w, (i * 53) % h, 5, 0, Math.PI * 2);
            ctx.fill();
          }
        }),
        roughness: 0.45,
        metalness: 0.2,
      }),
      ocean: new THREE.MeshStandardMaterial({
        color: 0x0369a1,
        roughness: 0.25,
        metalness: 0.35,
      }),
    };

    // 2. Beast Scales & Fur Skins (All 6 Species)
    this.beastSkin = {
      raptor: new THREE.MeshStandardMaterial({
        map: createTileCanvas(128, 128, (ctx, w, h) => {
          ctx.fillStyle = '#2e5339';
          ctx.fillRect(0, 0, w, h);
          ctx.fillStyle = '#1b3524';
          for (let y = 0; y < h; y += 16) {
            ctx.fillRect(0, y, w, 6);
          }
          ctx.fillStyle = '#d97706';
          for (let i = 0; i < 60; i++) {
            ctx.fillRect((i * 19) % w, (i * 31) % h, 4, 4);
          }
        }),
        roughness: 0.55,
        metalness: 0.12,
      }),
      brontoshell: new THREE.MeshStandardMaterial({
        map: createTileCanvas(128, 128, (ctx, w, h) => {
          ctx.fillStyle = '#1e3a5f';
          ctx.fillRect(0, 0, w, h);
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 2;
          for (let x = 0; x < w; x += 24) {
            for (let y = 0; y < h; y += 24) {
              ctx.strokeRect(x + 2, y + 2, 20, 20);
            }
          }
        }),
        roughness: 0.42,
        metalness: 0.35,
      }),
      thunderhorn: new THREE.MeshStandardMaterial({
        map: createTileCanvas(128, 128, (ctx, w, h) => {
          ctx.fillStyle = '#4b3f35';
          ctx.fillRect(0, 0, w, h);
          ctx.fillStyle = '#ca8a04';
          for (let y = 0; y < h; y += 20) {
            ctx.fillRect(0, y, w, 4);
          }
        }),
        roughness: 0.5,
        metalness: 0.25,
      }),
      frostfang: new THREE.MeshStandardMaterial({
        map: createTileCanvas(128, 128, (ctx, w, h) => {
          ctx.fillStyle = '#cbd5e1';
          ctx.fillRect(0, 0, w, h);
          ctx.fillStyle = '#94a3b8';
          for (let x = 0; x < w; x += 8) {
            ctx.fillRect(x, 0, 3, h);
          }
          ctx.fillStyle = '#f8fafc';
          for (let i = 0; i < 90; i++) {
            ctx.fillRect((i * 17) % w, (i * 29) % h, 3, 12);
          }
        }),
        roughness: 0.72,
        metalness: 0.08,
      }),
      snapjaw: new THREE.MeshStandardMaterial({
        map: createTileCanvas(128, 128, (ctx, w, h) => {
          ctx.fillStyle = '#0f5257';
          ctx.fillRect(0, 0, w, h);
          ctx.fillStyle = '#0b3c49';
          for (let x = 0; x < w; x += 16) {
            for (let y = 0; y < h; y += 16) {
              ctx.fillRect(x + 2, y + 2, 12, 12);
            }
          }
          ctx.fillStyle = '#22d3ee';
          for (let i = 0; i < 45; i++) {
            ctx.fillRect((i * 23) % w, (i * 37) % h, 4, 4);
          }
        }),
        roughness: 0.35,
        metalness: 0.28,
      }),
      caldera_titan: new THREE.MeshStandardMaterial({
        map: createTileCanvas(128, 128, (ctx, w, h) => {
          ctx.fillStyle = '#18181b';
          ctx.fillRect(0, 0, w, h);
          ctx.strokeStyle = '#f97316';
          ctx.lineWidth = 3;
          for (let y = 0; y < h; y += 24) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(w / 2, y + 10);
            ctx.lineTo(w, y);
            ctx.stroke();
          }
        }),
        emissive: new THREE.Color(0x7c2d12),
        emissiveIntensity: 0.45,
        roughness: 0.4,
        metalness: 0.45,
      }),
    };

    this.beastUnderbelly = {
      raptor: new THREE.MeshStandardMaterial({ color: 0xa39274, roughness: 0.7 }),
      brontoshell: new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.65 }),
      thunderhorn: new THREE.MeshStandardMaterial({ color: 0x78716c, roughness: 0.65 }),
      frostfang: new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.75 }),
      snapjaw: new THREE.MeshStandardMaterial({ color: 0x99f6e4, roughness: 0.5 }),
      caldera_titan: new THREE.MeshStandardMaterial({
        color: 0x431407,
        emissive: 0x9a3412,
        emissiveIntensity: 0.35,
        roughness: 0.5,
      }),
    };

    this.beastAccent = {
      raptor: new THREE.MeshStandardMaterial({
        color: 0xef4444,
        emissive: 0x991b1b,
        emissiveIntensity: 0.35,
        roughness: 0.4,
      }),
      brontoshell: new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x0284c7,
        emissiveIntensity: 0.35,
        roughness: 0.35,
      }),
      thunderhorn: new THREE.MeshStandardMaterial({
        color: 0xfacc15,
        emissive: 0xca8a04,
        emissiveIntensity: 0.45,
        roughness: 0.3,
      }),
      frostfang: new THREE.MeshStandardMaterial({
        color: 0x7dd3fc,
        emissive: 0x0284c7,
        emissiveIntensity: 0.45,
        roughness: 0.22,
        metalness: 0.35,
      }),
      snapjaw: new THREE.MeshStandardMaterial({
        color: 0x22d3ee,
        emissive: 0x0891b2,
        emissiveIntensity: 0.5,
        roughness: 0.25,
      }),
      caldera_titan: new THREE.MeshStandardMaterial({
        color: 0xf97316,
        emissive: 0xea580c,
        emissiveIntensity: 0.85,
        roughness: 0.25,
      }),
    };

    this.beastEnrageAccent = new THREE.MeshStandardMaterial({
      color: 0xffedd5,
      emissive: 0xff4500,
      emissiveIntensity: 1.5,
      roughness: 0.2,
    });

    this.weakPointGlow = new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      emissive: 0xf59e0b,
      emissiveIntensity: 1.1,
      roughness: 0.25,
      transparent: true,
      opacity: 0.88,
    });

    this.focusClueGlow = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0ea5e9,
      emissiveIntensity: 1.3,
      roughness: 0.2,
    });

    this.hunterSkin = new THREE.MeshStandardMaterial({
      color: 0xc6865c,
      roughness: 0.62,
      metalness: 0.05,
    });

    this.hunterHair = new THREE.MeshStandardMaterial({
      color: 0x1c1917,
      roughness: 0.78,
    });

    this.woodMaterial = new THREE.MeshStandardMaterial({
      map: createTileCanvas(64, 64, (ctx, w, h) => {
        ctx.fillStyle = '#5c3a21';
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#472b16';
        for (let x = 0; x < w; x += 8) {
          ctx.fillRect(x, 0, 3, h);
        }
      }),
      roughness: 0.82,
    });

    this.stoneMaterial = new THREE.MeshStandardMaterial({
      map: createTileCanvas(64, 64, (ctx, w, h) => {
        ctx.fillStyle = '#57534e';
        ctx.fillRect(0, 0, w, h);
        for (let i = 0; i < 45; i++) {
          ctx.fillStyle = i % 2 === 0 ? '#44403c' : '#78716c';
          ctx.fillRect((i * 19) % w, (i * 29) % h, 8, 8);
        }
      }),
      roughness: 0.85,
      metalness: 0.1,
    });

    this.riverStoneMaterial = new THREE.MeshStandardMaterial({
      map: createTileCanvas(64, 64, (ctx, w, h) => {
        ctx.fillStyle = '#475569';
        ctx.fillRect(0, 0, w, h);
        for (let i = 0; i < 40; i++) {
          ctx.fillStyle = i % 2 === 0 ? '#64748b' : '#334155';
          ctx.beginPath();
          ctx.arc((i * 17) % w, (i * 23) % h, 5, 0, Math.PI * 2);
          ctx.fill();
        }
      }),
      roughness: 0.32,
      metalness: 0.22,
    });

    this.snowMaterial = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      emissive: 0xbae6fd,
      emissiveIntensity: 0.12,
      roughness: 0.5,
      metalness: 0.08,
    });

    this.glacierIceMaterial = new THREE.MeshStandardMaterial({
      color: 0x7dd3fc,
      emissive: 0x0284c7,
      emissiveIntensity: 0.35,
      roughness: 0.15,
      metalness: 0.45,
      transparent: true,
      opacity: 0.86,
    });

    this.obsidianMaterial = new THREE.MeshStandardMaterial({
      color: 0x18181b,
      roughness: 0.18,
      metalness: 0.82,
    });

    this.boneMaterial = new THREE.MeshStandardMaterial({
      color: 0xf5f5f4,
      roughness: 0.45,
      metalness: 0.08,
    });

    this.foliageGreen = new THREE.MeshStandardMaterial({
      color: 0x3b7a36,
      roughness: 0.72,
      flatShading: true,
    });

    this.foliageDarkGreen = new THREE.MeshStandardMaterial({
      color: 0x1e4d24,
      roughness: 0.76,
      flatShading: true,
    });

    this.pineSnowGreen = new THREE.MeshStandardMaterial({
      color: 0x1f4e3d,
      roughness: 0.7,
      flatShading: true,
    });

    this.shrubLeafMaterial = new THREE.MeshStandardMaterial({
      color: 0x4d8c3a,
      roughness: 0.68,
      flatShading: true,
    });

    this.grassBladeMaterial = new THREE.MeshStandardMaterial({
      color: 0x5da13c,
      roughness: 0.65,
      side: THREE.DoubleSide,
    });

    this.lavaMaterial = new THREE.MeshStandardMaterial({
      color: 0xf97316,
      emissive: 0xea580c,
      emissiveIntensity: 1.3,
      roughness: 0.25,
    });

    this.waterMaterial = new THREE.MeshStandardMaterial({
      map: createTileCanvas(128, 128, (ctx, w, h) => {
        ctx.fillStyle = '#0ea5e9';
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = '#7dd3fc';
        ctx.lineWidth = 2;
        for (let y = 8; y < h; y += 16) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.quadraticCurveTo(w * 0.25, y - 5, w * 0.5, y);
          ctx.quadraticCurveTo(w * 0.75, y + 5, w, y);
          ctx.stroke();
        }
      }),
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.22,
      roughness: 0.14,
      metalness: 0.35,
      transparent: true,
      opacity: 0.84,
    });

    this.oceanMaterial = new THREE.MeshStandardMaterial({
      map: createTileCanvas(128, 128, (ctx, w, h) => {
        ctx.fillStyle = '#0369a1';
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2;
        for (let y = 12; y < h; y += 24) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.quadraticCurveTo(w * 0.5, y - 6, w, y);
          ctx.stroke();
        }
      }),
      color: 0x0284c7,
      emissive: 0x075985,
      emissiveIntensity: 0.2,
      roughness: 0.18,
      metalness: 0.42,
      transparent: true,
      opacity: 0.9,
    });

    this.fishScaleMaterial = new THREE.MeshStandardMaterial({
      color: 0x2dd4bf,
      emissive: 0x0d9488,
      emissiveIntensity: 0.3,
      roughness: 0.25,
      metalness: 0.5,
    });

    this.tribalClothRed = new THREE.MeshStandardMaterial({
      color: 0xb91c1c,
      roughness: 0.65,
    });

    this.tribalClothBlue = new THREE.MeshStandardMaterial({
      color: 0x0369a1,
      roughness: 0.65,
    });

    this.tribalGold = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xb45309,
      emissiveIntensity: 0.25,
      roughness: 0.3,
      metalness: 0.65,
    });
  }

  public dispose(): void {
    Object.values(this.biomeGround).forEach((m) => m.dispose());
    Object.values(this.beastSkin).forEach((m) => m.dispose());
    Object.values(this.beastUnderbelly).forEach((m) => m.dispose());
    Object.values(this.beastAccent).forEach((m) => m.dispose());
    this.beastEnrageAccent.dispose();
    this.weakPointGlow.dispose();
    this.focusClueGlow.dispose();
    this.hunterSkin.dispose();
    this.hunterHair.dispose();
    this.woodMaterial.dispose();
    this.stoneMaterial.dispose();
    this.riverStoneMaterial.dispose();
    this.snowMaterial.dispose();
    this.glacierIceMaterial.dispose();
    this.obsidianMaterial.dispose();
    this.boneMaterial.dispose();
    this.foliageGreen.dispose();
    this.foliageDarkGreen.dispose();
    this.pineSnowGreen.dispose();
    this.shrubLeafMaterial.dispose();
    this.grassBladeMaterial.dispose();
    this.lavaMaterial.dispose();
    this.waterMaterial.dispose();
    this.oceanMaterial.dispose();
    this.fishScaleMaterial.dispose();
    this.tribalClothRed.dispose();
    this.tribalClothBlue.dispose();
    this.tribalGold.dispose();
  }
}
