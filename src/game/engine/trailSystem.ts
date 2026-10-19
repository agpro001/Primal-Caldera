/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import type { BeastSpecies } from '../../types/game.ts';
import { createSculptedOrganicGeometry } from './assetLoaderAndRigging.ts';

export interface DynamicFootprint {
  id: string;
  x: number;
  y: number;
  z: number;
  rotation: number;
  species: BeastSpecies | 'hunter';
  age: number; // in seconds
  maxAge: number;
}

export class TrailSystem {
  public trailGroup: THREE.Group = new THREE.Group();
  public dynamicFootprints: DynamicFootprint[] = [];

  // Footprint Decal Meshes
  private footprintMeshes: Array<{
    group: THREE.Group;
    ringMesh: THREE.Mesh;
    printMesh: THREE.Mesh;
    ringMat: THREE.MeshBasicMaterial;
    printMat: THREE.MeshBasicMaterial;
  }> = [];

  // Floating Scent Particles (rising motes above tracks)
  private scentParticleMeshes: Array<{
    mesh: THREE.Mesh;
    mat: THREE.MeshBasicMaterial;
    phase: number;
    speed: number;
    swayRadius: number;
  }> = [];

  // Scent Ribbon line linking clues to target beast
  private scentRibbonLine: THREE.Line | null = null;
  private ribbonGeometry: THREE.BufferGeometry | null = null;
  private ribbonMat: THREE.LineBasicMaterial | null = null;

  // Scent Wave Pulses along the ribbon
  private ribbonPulseTime: number = 0;

  constructor() {
    this.initFootprints();
    this.initScentParticles();
    this.initScentRibbon();
  }

  private initFootprints() {
    const toeGeo = createSculptedOrganicGeometry(
      [
        [0.0, 0.05, 0.05],
        [0.5, 0.035, 0.035],
        [1.0, 0.005, 0.005],
      ],
      6,
      0.22,
      0
    );
    toeGeo.rotateX(Math.PI / 2);

    // Pre-allocate 45 footprint decal groups
    for (let i = 0; i < 45; i++) {
      const group = new THREE.Group();
      group.visible = false;

      // Outer glowing ripple ring
      const ringGeo = new THREE.RingGeometry(0.35, 0.58, 16);
      ringGeo.rotateX(-Math.PI / 2);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0xf59e0b,
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      group.add(ringMesh);

      // Inner claw / footprint print impression
      const printGeo = new THREE.CircleGeometry(0.24, 8);
      printGeo.rotateX(-Math.PI / 2);
      const printMat = new THREE.MeshBasicMaterial({
        color: 0xfbbf24,
        transparent: true,
        opacity: 0.95,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const printMesh = new THREE.Mesh(printGeo, printMat);
      printMesh.position.y = 0.005;
      group.add(printMesh);

      // Three toe claw marks for predator print
      for (let c = -1; c <= 1; c++) {
        const toeMesh = new THREE.Mesh(toeGeo, printMat);
        toeMesh.position.set(c * 0.12, 0.008, 0.26);
        toeMesh.rotation.y = c * 0.2;
        group.add(toeMesh);
      }

      this.trailGroup.add(group);
      this.footprintMeshes.push({ group, ringMesh, printMesh, ringMat, printMat });
    }
  }

  private initScentParticles() {
    // Pre-allocate 75 rising scent motes
    const moteGeo = createSculptedOrganicGeometry(
      [
        [0.0, 0.02, 0.02],
        [0.5, 0.09, 0.09],
        [1.0, 0.02, 0.02],
      ],
      8,
      0.16,
      -0.08
    );
    for (let i = 0; i < 75; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xfbbf24,
        transparent: true,
        opacity: 0.8,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(moteGeo, mat);
      mesh.visible = false;
      this.trailGroup.add(mesh);

      this.scentParticleMeshes.push({
        mesh,
        mat,
        phase: Math.random() * Math.PI * 2,
        speed: 0.9 + Math.random() * 0.7,
        swayRadius: 0.2 + Math.random() * 0.25,
      });
    }
  }

  private initScentRibbon() {
    const pointCount = 60;
    const ribbonPoints = new Float32Array(pointCount * 3);
    const colors = new Float32Array(pointCount * 3);

    this.ribbonGeometry = new THREE.BufferGeometry();
    this.ribbonGeometry.setAttribute('position', new THREE.BufferAttribute(ribbonPoints, 3));
    this.ribbonGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    this.ribbonMat = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      linewidth: 3,
      depthWrite: false,
    });

    this.scentRibbonLine = new THREE.Line(this.ribbonGeometry, this.ribbonMat);
    this.scentRibbonLine.visible = false;
    this.trailGroup.add(this.scentRibbonLine);
  }

  public addFootprint(
    x: number,
    y: number,
    z: number,
    rotation: number,
    species: BeastSpecies | 'hunter'
  ) {
    this.dynamicFootprints.unshift({
      id: `fp_${Date.now()}_${Math.random()}`,
      x,
      y: y + 0.035,
      z,
      rotation,
      species,
      age: 0,
      maxAge: 85, // fades dynamically over 85 seconds
    });

    if (this.dynamicFootprints.length > 45) {
      this.dynamicFootprints.pop();
    }
  }

  public update(
    dt: number,
    focusVisionActive: boolean,
    targetBeastPos: THREE.Vector3 | null,
    playerPos: THREE.Vector3,
    weatherDecayMultiplier: number = 1.0
  ) {
    // 1. Age existing footprints dynamically
    for (let i = this.dynamicFootprints.length - 1; i >= 0; i--) {
      const fp = this.dynamicFootprints[i];
      fp.age += dt * weatherDecayMultiplier;
      if (fp.age >= fp.maxAge) {
        this.dynamicFootprints.splice(i, 1);
      }
    }

    const now = performance.now();
    this.ribbonPulseTime += dt * 2.2;

    // 2. Render footprints with pulsing glowing ripples
    for (let i = 0; i < this.footprintMeshes.length; i++) {
      const item = this.footprintMeshes[i];
      if (i < this.dynamicFootprints.length && focusVisionActive) {
        const fp = this.dynamicFootprints[i];
        item.group.position.set(fp.x, fp.y, fp.z);
        item.group.rotation.y = fp.rotation;

        const freshness = Math.max(0, 1 - fp.age / fp.maxAge);

        // Dynamic multi-stage color transition
        // Fresh: luminous gold/cyan -> Mid: warm amber -> Old: faint smolder red
        if (freshness > 0.65) {
          item.ringMat.color.setHex(0x38bdf8); // Fresh trail shines celestial blue/gold
          item.printMat.color.setHex(0xfef08a);
          item.ringMat.opacity = 0.95 * freshness;
          item.printMat.opacity = 1.0 * freshness;
        } else if (freshness > 0.3) {
          item.ringMat.color.setHex(0xf59e0b); // Warm predator amber
          item.printMat.color.setHex(0xf97316);
          item.ringMat.opacity = 0.8 * freshness;
          item.printMat.opacity = 0.85 * freshness;
        } else {
          item.ringMat.color.setHex(0xb45309); // Smoldering faint ember
          item.printMat.color.setHex(0x7c2d12);
          item.ringMat.opacity = 0.45 * freshness;
          item.printMat.opacity = 0.5 * freshness;
        }

        // Resonant pulse scale
        const pulseCycle = (now * 0.004 + i * 0.3) % (Math.PI * 2);
        const pulse = 1.0 + Math.sin(pulseCycle) * 0.18;
        item.ringMesh.scale.set(pulse, 1, pulse);

        // Species-specific footprint scaling
        const speciesScale =
          fp.species === 'caldera_titan'
            ? 2.2
            : fp.species === 'brontoshell'
            ? 1.8
            : fp.species === 'thunderhorn'
            ? 1.5
            : 1.0;
        item.group.scale.set(speciesScale, 1, speciesScale);

        item.group.visible = true;
      } else {
        item.group.visible = false;
      }
    }

    // 3. Scent Particles: Animated rising glowing motes drifting upward from tracks
    for (let i = 0; i < this.scentParticleMeshes.length; i++) {
      const p = this.scentParticleMeshes[i];
      const fpIdx = i % Math.max(1, this.dynamicFootprints.length);

      if (focusVisionActive && this.dynamicFootprints.length > 0 && fpIdx < this.dynamicFootprints.length) {
        const fp = this.dynamicFootprints[fpIdx];
        const freshness = Math.max(0, 1 - fp.age / fp.maxAge);

        const cycle = ((now * 0.001 * p.speed + p.phase) % 2.0) / 2.0; // 0 to 1 loop
        const riseY = cycle * 2.6; // rise up to 2.6m above ground

        // Swirling vortex movement
        const angle = now * 0.003 + p.phase + cycle * 4;
        const swayX = Math.cos(angle) * (p.swayRadius + cycle * 0.3);
        const swayZ = Math.sin(angle) * (p.swayRadius + cycle * 0.3);

        p.mesh.position.set(fp.x + swayX, fp.y + riseY, fp.z + swayZ);

        // Scale shrinks as particle ascends into air
        const scale = (1 - cycle * 0.6) * 1.2 * freshness;
        p.mesh.scale.set(scale, scale, scale);

        // Opacity fades at the apex
        const alpha = Math.sin(cycle * Math.PI) * freshness * 0.9;
        p.mat.opacity = Math.max(0, alpha);

        if (freshness > 0.6) {
          p.mat.color.setHex(0x38bdf8);
        } else if (freshness > 0.3) {
          p.mat.color.setHex(0xfbbf24);
        } else {
          p.mat.color.setHex(0xf97316);
        }

        p.mesh.visible = true;
      } else {
        p.mesh.visible = false;
      }
    }

    // 4. Continuous Luminescent Scent Ribbon leading straight toward the colossal beast
    if (focusVisionActive && targetBeastPos && this.scentRibbonLine && this.ribbonGeometry) {
      this.scentRibbonLine.visible = true;
      const positions = this.ribbonGeometry.attributes.position as THREE.BufferAttribute;
      const colors = this.ribbonGeometry.attributes.color as THREE.BufferAttribute;
      const count = 60;

      for (let i = 0; i < count; i++) {
        const t = i / (count - 1);
        // Hermite curve between player and target beast with an undulating arc
        const cx = THREE.MathUtils.lerp(playerPos.x, targetBeastPos.x, t);
        const cz = THREE.MathUtils.lerp(playerPos.z, targetBeastPos.z, t);
        const baseH = THREE.MathUtils.lerp(playerPos.y + 1.2, targetBeastPos.y + 2.0, t);

        // Travelling sine wave pulse
        const wave = Math.sin(t * Math.PI * 6 - this.ribbonPulseTime) * 0.6;
        const arcHeight = Math.sin(t * Math.PI) * 3.5;

        positions.setXYZ(i, cx, baseH + arcHeight + wave, cz);

        // Luminescent pulse gradient along the line
        const pulseHighlight = Math.max(0, Math.sin(t * 12 - this.ribbonPulseTime * 2));
        const r = THREE.MathUtils.lerp(0.95, 0.22, pulseHighlight);
        const g = THREE.MathUtils.lerp(0.75, 0.74, pulseHighlight);
        const b = THREE.MathUtils.lerp(0.15, 0.97, pulseHighlight);

        colors.setXYZ(i, r, g, b);
      }

      positions.needsUpdate = true;
      colors.needsUpdate = true;
    } else if (this.scentRibbonLine) {
      this.scentRibbonLine.visible = false;
    }
  }
}
