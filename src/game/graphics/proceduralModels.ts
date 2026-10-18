/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import type { BeastSpecies, WeaponId, ArmorId } from '../../types/game.ts';
import type { MaterialCache } from './materials.ts';

export interface HunterRig {
  root: THREE.Group;
  torso: THREE.Group;
  head: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  weaponHolder: THREE.Group;
  weaponMesh: THREE.Group | null;
  armorMeshes: THREE.Mesh[];
  updateWeapon: (weaponId: WeaponId) => void;
  updateArmor: (armorId: ArmorId) => void;
}

export function buildHunterModel(mat: MaterialCache): HunterRig {
  const root = new THREE.Group();
  root.name = 'Hunter';

  // Torso group
  const torso = new THREE.Group();
  torso.position.y = 0.95;
  root.add(torso);

  // Torso body: muscular chest and abdomen
  const chestGeo = new THREE.BoxGeometry(0.55, 0.5, 0.32);
  const chestMesh = new THREE.Mesh(chestGeo, mat.hunterMaterial);
  chestMesh.position.y = 0.25;
  chestMesh.castShadow = true;
  torso.add(chestMesh);

  // Waist and loincloth
  const kiltGeo = new THREE.CylinderGeometry(0.3, 0.38, 0.45, 8);
  const kiltMesh = new THREE.Mesh(kiltGeo, mat.hunterArmorMaterials.scavenger_rags);
  kiltMesh.position.y = -0.15;
  kiltMesh.castShadow = true;
  torso.add(kiltMesh);

  // Head group
  const head = new THREE.Group();
  head.position.y = 0.55;
  torso.add(head);

  // Head skull
  const skullGeo = new THREE.SphereGeometry(0.18, 12, 10);
  const skullMesh = new THREE.Mesh(skullGeo, mat.hunterMaterial);
  head.add(skullMesh);

  // Hair crest / feather crown
  const hairGeo = new THREE.ConeGeometry(0.16, 0.35, 6);
  hairGeo.rotateX(-0.4);
  const hairMat = new THREE.MeshStandardMaterial({ color: 0x1a1512, roughness: 0.9 });
  const hairMesh = new THREE.Mesh(hairGeo, hairMat);
  hairMesh.position.set(0, 0.15, -0.06);
  head.add(hairMesh);

  // Headband
  const bandGeo = new THREE.TorusGeometry(0.19, 0.025, 6, 12);
  const bandMat = new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.7 });
  const bandMesh = new THREE.Mesh(bandGeo, bandMat);
  bandMesh.rotation.x = Math.PI / 2;
  head.add(bandMesh);

  // Left Arm
  const leftArm = new THREE.Group();
  leftArm.position.set(-0.35, 0.38, 0);
  torso.add(leftArm);
  const armGeo = new THREE.CylinderGeometry(0.08, 0.07, 0.55, 8);
  armGeo.translate(0, -0.25, 0);
  const leftArmMesh = new THREE.Mesh(armGeo, mat.hunterMaterial);
  leftArmMesh.castShadow = true;
  leftArm.add(leftArmMesh);

  // Right Arm (Weapon wielding)
  const rightArm = new THREE.Group();
  rightArm.position.set(0.35, 0.38, 0);
  torso.add(rightArm);
  const rightArmMesh = new THREE.Mesh(armGeo, mat.hunterMaterial);
  rightArmMesh.castShadow = true;
  rightArm.add(rightArmMesh);

  // Weapon holder attached to right hand
  const weaponHolder = new THREE.Group();
  weaponHolder.position.set(0, -0.5, 0.1);
  rightArm.add(weaponHolder);

  // Left Leg
  const leftLeg = new THREE.Group();
  leftLeg.position.set(-0.16, 0.85, 0);
  root.add(leftLeg);
  const legGeo = new THREE.CylinderGeometry(0.09, 0.07, 0.85, 8);
  legGeo.translate(0, -0.42, 0);
  const leftLegMesh = new THREE.Mesh(legGeo, mat.hunterMaterial);
  leftLegMesh.castShadow = true;
  leftLeg.add(leftLegMesh);

  // Right Leg
  const rightLeg = new THREE.Group();
  rightLeg.position.set(0.16, 0.85, 0);
  root.add(rightLeg);
  const rightLegMesh = new THREE.Mesh(legGeo, mat.hunterMaterial);
  rightLegMesh.castShadow = true;
  rightLeg.add(rightLegMesh);

  // Soft Contact Shadow Disc under player
  const shadowGeo = new THREE.CircleGeometry(0.65, 16);
  shadowGeo.rotateX(-Math.PI / 2);
  const shadowMat = new THREE.MeshBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
  });
  const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
  shadowMesh.position.y = 0.02;
  root.add(shadowMesh);

  let currentWeaponMesh: THREE.Group | null = null;
  const armorMeshes: THREE.Mesh[] = [kiltMesh];

  function updateWeapon(weaponId: WeaponId) {
    if (currentWeaponMesh) {
      weaponHolder.remove(currentWeaponMesh);
    }
    const wGroup = new THREE.Group();

    // Shaft
    const shaftGeo = new THREE.CylinderGeometry(0.03, 0.03, 2.2, 8);
    shaftGeo.translate(0, 0.6, 0);
    const shaftMesh = new THREE.Mesh(shaftGeo, mat.woodMaterial);
    shaftMesh.castShadow = true;
    wGroup.add(shaftMesh);

    // Spear Head
    let headMat = mat.stoneMaterial;
    let headScale = 1.0;
    if (weaponId === 'bone_harpoon') {
      headMat = mat.boneMaterial;
      headScale = 1.2;
    } else if (weaponId === 'obsidian_glaive') {
      headMat = mat.obsidianMaterial;
      headScale = 1.4;
    } else if (weaponId === 'caldera_lance') {
      headMat = mat.beastEnragedMaterials.caldera_titan;
      headScale = 1.6;
    }

    const spearBladeGeo = new THREE.ConeGeometry(0.1 * headScale, 0.5 * headScale, 4);
    spearBladeGeo.translate(0, 1.85, 0);
    const spearBlade = new THREE.Mesh(spearBladeGeo, headMat);
    spearBlade.castShadow = true;
    wGroup.add(spearBlade);

    // Decorative bindings
    const bindGeo = new THREE.TorusGeometry(0.05, 0.02, 6, 8);
    bindGeo.translate(0, 1.55, 0);
    const bindMesh = new THREE.Mesh(bindGeo, mat.hunterMaterial);
    wGroup.add(bindMesh);

    wGroup.rotation.x = Math.PI / 2 - 0.2;
    weaponHolder.add(wGroup);
    currentWeaponMesh = wGroup;
  }

  function updateArmor(armorId: ArmorId) {
    const selectedMat = mat.hunterArmorMaterials[armorId] || mat.hunterArmorMaterials.scavenger_rags;
    kiltMesh.material = selectedMat;
  }

  updateWeapon('flint_spear');
  updateArmor('scavenger_rags');

  return {
    root,
    torso,
    head,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    weaponHolder,
    weaponMesh: currentWeaponMesh,
    armorMeshes,
    updateWeapon,
    updateArmor,
  };
}

export interface BeastRig {
  root: THREE.Group;
  torso: THREE.Group;
  head: THREE.Group;
  jaw: THREE.Group | null;
  tail: THREE.Group;
  legs: THREE.Group[];
  weakPointMeshes: THREE.Mesh[];
  meshRenderers: THREE.Mesh[];
  setEnraged: (enraged: boolean) => void;
  setHitFlash: (active: boolean) => void;
}

export function buildBeastModel(species: BeastSpecies, mat: MaterialCache): BeastRig {
  const root = new THREE.Group();
  root.name = species;
  const legs: THREE.Group[] = [];
  const weakPointMeshes: THREE.Mesh[] = [];
  const meshRenderers: THREE.Mesh[] = [];

  const mainMat = mat.beastMaterials[species];
  const enragedMat = mat.beastEnragedMaterials[species];

  const torso = new THREE.Group();
  root.add(torso);

  let head = new THREE.Group();
  let jaw: THREE.Group | null = null;
  let tail = new THREE.Group();

  if (species === 'raptor') {
    // RAPTOR STALKER: Swift predatory biped
    torso.position.y = 1.2;

    const bodyGeo = new THREE.ConeGeometry(0.65, 2.0, 8);
    bodyGeo.rotateX(Math.PI / 2);
    const bodyMesh = new THREE.Mesh(bodyGeo, mainMat);
    bodyMesh.castShadow = true;
    torso.add(bodyMesh);
    meshRenderers.push(bodyMesh);

    // Neck & Head
    head.position.set(0, 0.45, 1.1);
    torso.add(head);

    const skullGeo = new THREE.ConeGeometry(0.32, 0.9, 6);
    skullGeo.rotateX(-Math.PI / 2);
    const skullMesh = new THREE.Mesh(skullGeo, mainMat);
    skullMesh.castShadow = true;
    head.add(skullMesh);
    meshRenderers.push(skullMesh);

    // Jaw
    jaw = new THREE.Group();
    jaw.position.set(0, -0.15, 0.2);
    const jawGeo = new THREE.BoxGeometry(0.25, 0.12, 0.6);
    const jawMesh = new THREE.Mesh(jawGeo, mainMat);
    jaw.add(jawMesh);
    head.add(jaw);
    meshRenderers.push(jawMesh);

    // Feather crest
    const crestGeo = new THREE.BufferGeometry();
    const crestMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.8 });
    const crestMesh = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.6, 4), crestMat);
    crestMesh.position.set(0, 0.35, -0.1);
    crestMesh.rotation.x = -0.6;
    head.add(crestMesh);

    // Tail
    tail.position.set(0, 0.1, -1.0);
    torso.add(tail);
    const tailGeo = new THREE.CylinderGeometry(0.06, 0.25, 2.4, 6);
    tailGeo.rotateX(-Math.PI / 2);
    tailGeo.translate(0, 0, -1.2);
    const tailMesh = new THREE.Mesh(tailGeo, mainMat);
    tailMesh.castShadow = true;
    tail.add(tailMesh);
    meshRenderers.push(tailMesh);

    // Hind Legs
    [-0.5, 0.5].forEach((xSide) => {
      const leg = new THREE.Group();
      leg.position.set(xSide, 1.2, -0.2);
      root.add(leg);

      const upperGeo = new THREE.CylinderGeometry(0.18, 0.12, 0.9, 6);
      upperGeo.translate(0, -0.45, 0.1);
      upperGeo.rotateX(0.3);
      const upper = new THREE.Mesh(upperGeo, mainMat);
      upper.castShadow = true;
      leg.add(upper);
      meshRenderers.push(upper);

      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.08, 0.4), mat.stoneMaterial);
      foot.position.set(0, -1.15, 0.2);
      foot.castShadow = true;
      leg.add(foot);

      // Sickle claw
      const claw = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.28, 4), mat.boneMaterial);
      claw.rotation.x = -Math.PI / 2;
      claw.position.set(0, -1.1, 0.4);
      leg.add(claw);

      legs.push(leg);
    });

  } else if (species === 'brontoshell') {
    // BRONTOSHELL: Armored quad beast
    torso.position.y = 1.0;

    // Colossal Carapace
    const shellGeo = new THREE.SphereGeometry(2.1, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55);
    const shellMesh = new THREE.Mesh(shellGeo, mainMat);
    shellMesh.position.y = 0.3;
    shellMesh.castShadow = true;
    torso.add(shellMesh);
    meshRenderers.push(shellMesh);

    // Soft underbelly
    const bellyGeo = new THREE.CylinderGeometry(2.0, 1.8, 0.5, 10);
    const bellyMat = new THREE.MeshStandardMaterial({ color: 0x854d0e, roughness: 0.9 });
    const bellyMesh = new THREE.Mesh(bellyGeo, bellyMat);
    bellyMesh.position.y = 0.1;
    torso.add(bellyMesh);

    // Head
    head.position.set(0, 0.5, 2.2);
    torso.add(head);
    const headGeo = new THREE.BoxGeometry(0.9, 0.7, 1.2);
    const headMesh = new THREE.Mesh(headGeo, mainMat);
    headMesh.castShadow = true;
    head.add(headMesh);
    meshRenderers.push(headMesh);

    // Horn beaks
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.6, 5), mat.stoneMaterial);
    beak.rotation.x = Math.PI / 2;
    beak.position.set(0, -0.1, 0.8);
    head.add(beak);

    // Tail with club
    tail.position.set(0, 0.3, -2.1);
    torso.add(tail);
    const tailGeo = new THREE.CylinderGeometry(0.2, 0.5, 1.8, 6);
    tailGeo.rotateX(-Math.PI / 2);
    tailGeo.translate(0, 0, -0.9);
    const tailMesh = new THREE.Mesh(tailGeo, mainMat);
    tail.add(tailMesh);
    const club = new THREE.Mesh(new THREE.DodecahedronGeometry(0.55), mat.stoneMaterial);
    club.position.set(0, 0, -1.8);
    club.castShadow = true;
    tail.add(club);

    // 4 Heavy Pillar Legs
    [
      [-1.4, 1.2],
      [1.4, 1.2],
      [-1.4, -1.2],
      [1.4, -1.2],
    ].forEach(([x, z]) => {
      const leg = new THREE.Group();
      leg.position.set(x, 1.0, z);
      root.add(leg);

      const pillarGeo = new THREE.CylinderGeometry(0.38, 0.45, 1.1, 8);
      pillarGeo.translate(0, -0.55, 0);
      const pillar = new THREE.Mesh(pillarGeo, mainMat);
      pillar.castShadow = true;
      leg.add(pillar);
      meshRenderers.push(pillar);
      legs.push(leg);
    });

  } else if (species === 'thunderhorn') {
    // THUNDERHORN: Horned quadruped rammer
    torso.position.y = 1.6;

    const bodyGeo = new THREE.BoxGeometry(1.8, 1.5, 3.2);
    const bodyMesh = new THREE.Mesh(bodyGeo, mainMat);
    bodyMesh.castShadow = true;
    torso.add(bodyMesh);
    meshRenderers.push(bodyMesh);

    // Head
    head.position.set(0, 0.6, 2.0);
    torso.add(head);

    const skullGeo = new THREE.BoxGeometry(1.1, 1.0, 1.4);
    const skullMesh = new THREE.Mesh(skullGeo, mainMat);
    skullMesh.castShadow = true;
    head.add(skullMesh);
    meshRenderers.push(skullMesh);

    // Dual Massive Thunder Horns
    [-0.55, 0.55].forEach((hx) => {
      const hornGeo = new THREE.ConeGeometry(0.28, 1.8, 6);
      hornGeo.rotateX(0.8);
      const hornMat = new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x0284c7,
        emissiveIntensity: 0.35,
        roughness: 0.3,
        metalness: 0.5,
      });
      const horn = new THREE.Mesh(hornGeo, hornMat);
      horn.position.set(hx, 0.6, 0.8);
      head.add(horn);
    });

    // Tail
    tail.position.set(0, 0.2, -1.8);
    torso.add(tail);
    const tailMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.3, 1.4, 6), mainMat);
    tailMesh.rotation.x = -Math.PI / 3;
    tailMesh.position.set(0, -0.4, -0.6);
    tail.add(tailMesh);

    // 4 Sturdy Legs
    [
      [-1.0, 1.2],
      [1.0, 1.2],
      [-1.0, -1.2],
      [1.0, -1.2],
    ].forEach(([x, z]) => {
      const leg = new THREE.Group();
      leg.position.set(x, 1.6, z);
      root.add(leg);

      const legGeo = new THREE.CylinderGeometry(0.28, 0.22, 1.6, 8);
      legGeo.translate(0, -0.8, 0);
      const legMesh = new THREE.Mesh(legGeo, mainMat);
      legMesh.castShadow = true;
      leg.add(legMesh);
      meshRenderers.push(legMesh);
      legs.push(leg);
    });

  } else {
    // CALDERA TITAN: Apex Volcanic Drake Titan
    torso.position.y = 2.8;

    const chestGeo = new THREE.ConeGeometry(2.2, 4.2, 8);
    chestGeo.rotateX(Math.PI / 2);
    const chestMesh = new THREE.Mesh(chestGeo, mainMat);
    chestMesh.castShadow = true;
    torso.add(chestMesh);
    meshRenderers.push(chestMesh);

    // Glowing Magma Core on chest
    const coreGeo = new THREE.SphereGeometry(0.9, 10, 8);
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0xff4500,
      emissive: 0xff6600,
      emissiveIntensity: 0.9,
      roughness: 0.2,
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    coreMesh.position.set(0, -0.2, 1.4);
    torso.add(coreMesh);
    weakPointMeshes.push(coreMesh);

    // Head
    head.position.set(0, 1.8, 2.4);
    torso.add(head);

    const titanSkullGeo = new THREE.ConeGeometry(1.2, 2.2, 6);
    titanSkullGeo.rotateX(-Math.PI / 2);
    const titanSkull = new THREE.Mesh(titanSkullGeo, mainMat);
    titanSkull.castShadow = true;
    head.add(titanSkull);
    meshRenderers.push(titanSkull);

    // Titan Horns
    [-0.8, 0.8].forEach((hx) => {
      const hGeo = new THREE.ConeGeometry(0.35, 2.0, 6);
      hGeo.rotateX(-0.5);
      const horn = new THREE.Mesh(hGeo, mat.obsidianMaterial);
      horn.position.set(hx, 1.1, -0.5);
      head.add(horn);
    });

    // Colossal Spiked Tail
    tail.position.set(0, 0.2, -2.4);
    torso.add(tail);
    const tailGeo = new THREE.CylinderGeometry(0.2, 1.0, 4.5, 6);
    tailGeo.rotateX(-Math.PI / 2);
    tailGeo.translate(0, 0, -2.2);
    const tailMesh = new THREE.Mesh(tailGeo, mainMat);
    tailMesh.castShadow = true;
    tail.add(tailMesh);
    meshRenderers.push(tailMesh);

    // Massive Hind Legs
    [-1.6, 1.6].forEach((lx) => {
      const leg = new THREE.Group();
      leg.position.set(lx, 2.8, -0.5);
      root.add(leg);

      const legGeo = new THREE.CylinderGeometry(0.65, 0.45, 2.8, 8);
      legGeo.translate(0, -1.4, 0);
      const legMesh = new THREE.Mesh(legGeo, mainMat);
      legMesh.castShadow = true;
      leg.add(legMesh);
      meshRenderers.push(legMesh);
      legs.push(leg);
    });
  }

  // Soft contact shadow disc
  const shadowRadius = species === 'caldera_titan' ? 3.5 : species === 'brontoshell' ? 2.8 : 1.6;
  const shadowGeo = new THREE.CircleGeometry(shadowRadius, 16);
  shadowGeo.rotateX(-Math.PI / 2);
  const shadowMesh = new THREE.Mesh(
    shadowGeo,
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.45, depthWrite: false })
  );
  shadowMesh.position.y = 0.02;
  root.add(shadowMesh);

  function setEnraged(enraged: boolean) {
    const targetMat = enraged ? enragedMat : mainMat;
    meshRenderers.forEach((m) => {
      m.material = targetMat;
    });
  }

  function setHitFlash(active: boolean) {
    if (active) {
      meshRenderers.forEach((m) => {
        (m.material as THREE.MeshStandardMaterial).emissive = new THREE.Color(0xffffff);
        (m.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.95;
      });
    } else {
      meshRenderers.forEach((m) => {
        (m.material as THREE.MeshStandardMaterial).emissive = new THREE.Color(0x000000);
        (m.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.0;
      });
    }
  }

  return {
    root,
    torso,
    head,
    jaw,
    tail,
    legs,
    weakPointMeshes,
    meshRenderers,
    setEnraged,
    setHitFlash,
  };
}

export function buildFoliageModel(type: 'palm' | 'fern' | 'basalt', mat: MaterialCache): THREE.Group {
  const group = new THREE.Group();

  if (type === 'palm') {
    // Prehistoric cycad palm: curved trunk + arched crown
    const trunkGeo = new THREE.CylinderGeometry(0.2, 0.45, 5.0, 6);
    trunkGeo.translate(0, 2.5, 0);
    const trunk = new THREE.Mesh(trunkGeo, mat.woodMaterial);
    trunk.castShadow = true;
    group.add(trunk);

    for (let i = 0; i < 7; i++) {
      const angle = (i / 7) * Math.PI * 2;
      const leafGeo = new THREE.ConeGeometry(0.7, 3.2, 3);
      leafGeo.rotateX(Math.PI / 2.6);
      leafGeo.translate(0, 4.8, 1.2);
      const leaf = new THREE.Mesh(leafGeo, mat.leafMaterial);
      leaf.rotation.y = angle;
      leaf.castShadow = true;
      group.add(leaf);
    }
  } else if (type === 'fern') {
    // Giant ground fern
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const frondGeo = new THREE.ConeGeometry(0.45, 1.8, 3);
      frondGeo.rotateX(Math.PI / 3.0);
      frondGeo.translate(0, 0.4, 0.8);
      const frond = new THREE.Mesh(frondGeo, mat.leafMaterial);
      frond.rotation.y = angle;
      group.add(frond);
    }
  } else {
    // Basalt column cluster
    [-0.5, 0, 0.6].forEach((bx, i) => {
      const colGeo = new THREE.CylinderGeometry(0.4, 0.45, 2.5 + i * 0.8, 6);
      colGeo.translate(0, (2.5 + i * 0.8) / 2, 0);
      const col = new THREE.Mesh(colGeo, mat.stoneMaterial);
      col.position.set(bx, 0, (i - 1) * 0.4);
      col.castShadow = true;
      group.add(col);
    });
  }

  return group;
}

export function buildCampfireModel(mat: MaterialCache): THREE.Group {
  const camp = new THREE.Group();

  // Stone ring
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(0.25), mat.stoneMaterial);
    stone.position.set(Math.cos(angle) * 0.8, 0.15, Math.sin(angle) * 0.8);
    camp.add(stone);
  }

  // Glowing embers
  const ember = new THREE.Mesh(
    new THREE.CylinderGeometry(0.6, 0.7, 0.15, 8),
    new THREE.MeshStandardMaterial({
      color: 0xff3b11,
      emissive: 0xff5500,
      emissiveIntensity: 0.9,
      roughness: 0.2,
    })
  );
  ember.position.y = 0.08;
  camp.add(ember);

  // Workbench table
  const bench = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.7, 0.8), mat.woodMaterial);
  bench.position.set(2.2, 0.35, 0);
  bench.castShadow = true;
  camp.add(bench);

  // Anvil stone on bench
  const anvil = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.4), mat.obsidianMaterial);
  anvil.position.set(2.2, 0.85, 0);
  camp.add(anvil);

  // Prehistoric Hide Lean-to / Hunter Tent
  const tent = new THREE.Group();
  tent.position.set(-2.8, 0, -1.5);
  tent.rotation.y = 0.4;

  // Timber poles
  for (let p = 0; p < 3; p++) {
    const poleGeo = new THREE.CylinderGeometry(0.06, 0.08, 3.2, 6);
    poleGeo.translate(0, 1.5, 0);
    const pole = new THREE.Mesh(poleGeo, mat.woodMaterial);
    pole.position.set((p - 1) * 1.2, 0, 0);
    pole.rotation.x = -0.35;
    pole.castShadow = true;
    tent.add(pole);
  }

  // Animal hide canopy
  const hideCover = new THREE.Mesh(
    new THREE.PlaneGeometry(3.2, 2.6),
    new THREE.MeshStandardMaterial({
      color: 0x78350f,
      roughness: 0.9,
      side: THREE.DoubleSide,
    })
  );
  hideCover.position.set(0, 1.3, -0.4);
  hideCover.rotation.x = -0.38;
  hideCover.castShadow = true;
  tent.add(hideCover);

  // Drying meat rack
  const rack = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.06, 0.06), mat.woodMaterial);
  rack.position.set(0, 1.8, 1.2);
  tent.add(rack);

  camp.add(tent);

  return camp;
}

export function buildAncientMonolith(mat: MaterialCache): THREE.Group {
  const monolith = new THREE.Group();

  // Standing obelisk stone
  const stoneGeo = new THREE.BoxGeometry(1.2, 4.5, 0.8);
  stoneGeo.translate(0, 2.2, 0);
  const stoneMesh = new THREE.Mesh(stoneGeo, mat.stoneMaterial);
  stoneMesh.rotation.y = Math.random() * Math.PI;
  stoneMesh.castShadow = true;
  monolith.add(stoneMesh);

  // Carved runic band
  const runeBand = new THREE.Mesh(
    new THREE.BoxGeometry(1.24, 0.4, 0.84),
    new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xd97706,
      emissiveIntensity: 0.4,
      roughness: 0.6,
    })
  );
  runeBand.position.y = 2.4;
  monolith.add(runeBand);

  return monolith;
}

export function buildTotemArch(mat: MaterialCache): THREE.Group {
  const arch = new THREE.Group();

  // Twin giant mammoth tusks forming arch
  [-1.8, 1.8].forEach((xSide) => {
    const tuskGeo = new THREE.CylinderGeometry(0.15, 0.35, 4.8, 8);
    tuskGeo.translate(0, 2.3, 0);
    const tusk = new THREE.Mesh(tuskGeo, mat.boneMaterial);
    tusk.position.set(xSide, 0, 0);
    tusk.rotation.z = xSide > 0 ? -0.32 : 0.32;
    tusk.castShadow = true;
    arch.add(tusk);
  });

  // Cross timber beam tied with ropes
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 4.2, 6), mat.woodMaterial);
  beam.rotation.z = Math.PI / 2;
  beam.position.y = 3.8;
  beam.castShadow = true;
  arch.add(beam);

  // Suspended beast skull ornament
  const skull = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.8, 5), mat.boneMaterial);
  skull.position.set(0, 3.2, 0);
  skull.rotation.x = Math.PI;
  arch.add(skull);

  return arch;
}

export function buildSignalTowerModel(mat: MaterialCache): THREE.Group {
  const tower = new THREE.Group();

  // Megalithic stepped base
  const base1 = new THREE.Mesh(new THREE.BoxGeometry(12, 2.5, 12), mat.stoneMaterial);
  base1.position.y = 1.25;
  base1.castShadow = true;
  tower.add(base1);

  const base2 = new THREE.Mesh(new THREE.BoxGeometry(8, 5, 8), mat.stoneMaterial);
  base2.position.y = 5.0;
  base2.castShadow = true;
  tower.add(base2);

  // Tower Pillar
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 3.5, 14, 8), mat.stoneMaterial);
  pillar.position.y = 14.5;
  pillar.castShadow = true;
  tower.add(pillar);

  // Beacon Brazier Basin
  const brazier = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 2.5, 2.2, 8), mat.obsidianMaterial);
  brazier.position.y = 22.5;
  brazier.castShadow = true;
  tower.add(brazier);

  // Signal Reflector Dish
  const dish = new THREE.Mesh(
    new THREE.SphereGeometry(2.8, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.4),
    mat.obsidianMaterial
  );
  dish.rotation.x = Math.PI;
  dish.position.y = 24.5;
  tower.add(dish);

  // Flame Beacon Core (initially unlit or dim)
  const flameMesh = new THREE.Mesh(
    new THREE.SphereGeometry(1.8, 10, 8),
    new THREE.MeshStandardMaterial({
      color: 0xffaa00,
      emissive: 0xff4400,
      emissiveIntensity: 0.2,
      roughness: 0.1,
    })
  );
  flameMesh.name = 'beacon_flame';
  flameMesh.position.y = 23.5;
  tower.add(flameMesh);

  return tower;
}
