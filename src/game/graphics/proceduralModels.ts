/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import type { BeastSpecies, WeaponId, ArmorId, NPCId } from '../../types/game.ts';
import type { MaterialCache } from './materials.ts';
import type { EnvironmentModelId } from '../logic/beastopediaData.ts';
import { WEAPON_REGISTRY, ARMOR_REGISTRY } from '../logic/rules.ts';

export interface HunterRig {
  root: THREE.Group;
  pelvis: THREE.Group;
  torso: THREE.Group;
  head: THREE.Group;
  leftArm: THREE.Group;
  leftForearm: THREE.Group;
  leftHand: THREE.Group;
  rightArm: THREE.Group;
  rightForearm: THREE.Group;
  rightHand: THREE.Group;
  leftLeg: THREE.Group;
  leftShin: THREE.Group;
  leftFoot: THREE.Group;
  rightLeg: THREE.Group;
  rightShin: THREE.Group;
  rightFoot: THREE.Group;
  weaponMount: THREE.Group;
  cape?: THREE.Mesh;
  wings?: THREE.Group;
  wingsGroup?: THREE.Group;
  leftWing?: THREE.Group;
  rightWing?: THREE.Group;
  contactShadow?: THREE.Mesh;
  armorPads: THREE.Mesh[];
  updateWeapon: (weaponId: WeaponId) => void;
  updateArmor: (armorId: ArmorId) => void;
}

export interface BeastRig {
  root: THREE.Group;
  body: THREE.Group;
  head: THREE.Group;
  jaw: THREE.Group;
  tail: THREE.Group;
  leftWing?: THREE.Group;
  rightWing?: THREE.Group;
  legs: THREE.Group[];
  accentMeshes: THREE.Mesh[];
  weakPointIndicators: Map<string, THREE.Mesh>;
}

/**
 * Builds the 3D Hunter character model clad in the Mastercraft Mithril Armor Set
 * (inspired by Beyond Skyrim2 by Royraj Vichaidit) with a full 18-joint articulated
 * skeletal hierarchy (pelvis, spine/torso, neck/head, shoulder -> elbow -> hand,
 * hip -> knee -> ankle/foot), dorsal Aetherial Flight Harness (folded when grounded,
 * expanded when flying), hand-gripped weapon mount, and grounded contact shadow.
 */
export function buildHunterModel(mat: MaterialCache, initialArmor: ArmorId = 'scavenger_rags'): HunterRig {
  const root = new THREE.Group();

  // Soft Radial Ground Contact Shadow Disc
  const contactShadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.95, 24),
    mat.contactShadowMaterial
  );
  contactShadow.rotation.x = -Math.PI / 2;
  contactShadow.position.set(0, 0.02, 0);
  contactShadow.renderOrder = 1;
  root.add(contactShadow);

  // Dark Quilted Gambeson Under-Armor Material (contrasting matte roughness = 0.78)
  const gambesonMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.78,
    metalness: 0.12,
  });

  // 1. Articulated Pelvis & Hip Root (y = 0.92)
  const pelvis = new THREE.Group();
  pelvis.position.set(0, 0.92, 0);
  root.add(pelvis);

  const pelvisBlock = new THREE.Mesh(
    new THREE.CylinderGeometry(0.24, 0.22, 0.24, 14),
    gambesonMat
  );
  pelvisBlock.castShadow = true;
  pelvis.add(pelvisBlock);

  // Gilded War Belt & Fauld Waist Plates
  const beltMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.265, 0.275, 0.11, 16),
    mat.mithrilGoldTrimMaterial
  );
  beltMesh.position.set(0, 0.04, 0);
  beltMesh.castShadow = true;
  pelvis.add(beltMesh);

  // Sculpted Pleated Mithril Tassets & Royal Split Skirt
  const kiltGeo = new THREE.CylinderGeometry(0.25, 0.35, 0.36, 16, 1, true);
  const kiltMesh = new THREE.Mesh(kiltGeo, mat.mithrilCapeMaterial);
  kiltMesh.position.set(0, -0.16, 0);
  kiltMesh.castShadow = true;
  pelvis.add(kiltMesh);

  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2 + Math.PI / 6;
    const tassetGroup = new THREE.Group();
    tassetGroup.position.set(Math.sin(angle) * 0.27, -0.14, Math.cos(angle) * 0.27);
    tassetGroup.rotation.y = angle;
    tassetGroup.rotation.x = 0.14;

    const tassetPlate = new THREE.Mesh(
      new THREE.BoxGeometry(0.15, 0.3, 0.035),
      mat.mithrilSilverMaterial.clone()
    );
    tassetPlate.castShadow = true;
    tassetGroup.add(tassetPlate);

    const tassetTrim = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.04, 0.042),
      mat.mithrilGoldTrimMaterial
    );
    tassetTrim.position.set(0, -0.12, 0);
    tassetGroup.add(tassetTrim);
    pelvis.add(tassetGroup);
  }

  // 2. Articulated Spine & Upper Torso Cuirass
  const torso = new THREE.Group();
  torso.position.set(0, 0.14, 0);
  pelvis.add(torso);

  // Anatomical Lathe-Sculpted Mastercraft Mithril Cuirass
  const cuirassPoints = [
    new THREE.Vector2(0.21, 0.0),
    new THREE.Vector2(0.24, 0.16),
    new THREE.Vector2(0.31, 0.38),
    new THREE.Vector2(0.29, 0.56),
    new THREE.Vector2(0.20, 0.66),
  ];
  const chestGeo = new THREE.LatheGeometry(cuirassPoints, 18);
  const chestMesh = new THREE.Mesh(chestGeo, mat.mithrilSilverMaterial.clone());
  chestMesh.scale.set(1.08, 1.0, 0.82);
  chestMesh.castShadow = true;
  chestMesh.receiveShadow = true;
  torso.add(chestMesh);

  // Beveled V-Shaped Pectoral Plackart & Filigree Breastplate
  const pectoralPlate = new THREE.Mesh(
    new THREE.BoxGeometry(0.46, 0.34, 0.14),
    mat.mithrilSilverMaterial.clone()
  );
  pectoralPlate.position.set(0, 0.4, 0.16);
  pectoralPlate.rotation.x = -0.08;
  pectoralPlate.castShadow = true;
  torso.add(pectoralPlate);

  // Gold Filigree Gorget Collar
  const goldCollarGeo = new THREE.TorusGeometry(0.21, 0.032, 10, 22);
  goldCollarGeo.rotateX(Math.PI / 2);
  const goldCollar = new THREE.Mesh(goldCollarGeo, mat.mithrilGoldTrimMaterial);
  goldCollar.position.set(0, 0.62, 0.02);
  torso.add(goldCollar);

  // Glowing Aetherial Mithril Chest Core Matrix
  const chestGem = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.068, 0),
    new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 1.35,
      metalness: 0.9,
      roughness: 0.1,
    })
  );
  chestGem.position.set(0, 0.42, 0.24);
  torso.add(chestGem);

  // Gold Filigree Rib Trim Bands
  for (const ry of [0.26, 0.14]) {
    const ribTrim = new THREE.Mesh(
      new THREE.CylinderGeometry(0.26, 0.24, 0.03, 16),
      mat.mithrilGoldTrimMaterial
    );
    ribTrim.scale.set(1.08, 1, 0.84);
    ribTrim.position.set(0, ry, 0.01);
    torso.add(ribTrim);
  }

  // 3. Flowing Royal Mithril Mantle Cape (Multi-fold articulated cloth plane)
  const capeGeo = new THREE.BoxGeometry(0.58, 1.02, 0.025, 4, 6, 1);
  capeGeo.translate(0, -0.5, 0);
  const cape = new THREE.Mesh(capeGeo, mat.mithrilCapeMaterial);
  cape.position.set(0, 0.58, -0.2);
  cape.rotation.x = 0.16;
  cape.castShadow = true;
  torso.add(cape);

  // 4. Dorsal Aetherial Flight Harness & Articulated Wings (Always Visible on Back: Folded vs Deployed)
  const dorsalPack = new THREE.Group();
  dorsalPack.position.set(0, 0.44, -0.21);
  torso.add(dorsalPack);

  const packCore = new THREE.Mesh(
    new THREE.BoxGeometry(0.32, 0.36, 0.12),
    mat.mithrilGoldTrimMaterial
  );
  packCore.castShadow = true;
  dorsalPack.add(packCore);

  for (const side of [-1, 1]) {
    const thrusterPod = new THREE.Mesh(
      new THREE.CylinderGeometry(0.055, 0.07, 0.38, 10),
      mat.mithrilSilverMaterial
    );
    thrusterPod.position.set(side * 0.16, -0.02, -0.03);
    thrusterPod.rotation.z = side * -0.15;
    dorsalPack.add(thrusterPod);

    const nozzleGlow = new THREE.Mesh(
      new THREE.ConeGeometry(0.05, 0.14, 8),
      new THREE.MeshStandardMaterial({
        color: 0x7dd3fc,
        emissive: 0x38bdf8,
        emissiveIntensity: 1.5,
      })
    );
    nozzleGlow.position.set(side * 0.18, -0.24, -0.03);
    nozzleGlow.rotation.x = Math.PI;
    dorsalPack.add(nozzleGlow);
  }

  const wingsGroup = new THREE.Group();
  wingsGroup.position.set(0, 0.48, -0.24);
  // Keep wingsGroup visible at all times: compact folded on ground, expanded when flying!
  wingsGroup.visible = true;
  wingsGroup.scale.set(0.38, 0.45, 0.38);
  torso.add(wingsGroup);

  const wingMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x0284c7,
    emissiveIntensity: 0.75,
    metalness: 0.78,
    roughness: 0.18,
    side: THREE.DoubleSide,
  });

  const buildWingSide = (dir: 1 | -1) => {
    const wGroup = new THREE.Group();
    const spar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.02, 1.9, 8),
      mat.mithrilGoldTrimMaterial
    );
    spar.rotation.z = dir * -1.15;
    spar.position.set(dir * 0.85, 0.35, 0);
    spar.castShadow = true;
    wGroup.add(spar);

    for (let f = 0; f < 6; f++) {
      const featherBlade = new THREE.Mesh(
        new THREE.BoxGeometry(0.15, 1.02 - f * 0.11, 0.022),
        wingMat
      );
      featherBlade.position.set(dir * (0.32 + f * 0.3), 0.06 + f * 0.04, -0.02);
      featherBlade.rotation.z = dir * -0.32;
      wGroup.add(featherBlade);
    }
    return wGroup;
  };

  const leftWing = buildWingSide(1);
  const rightWing = buildWingSide(-1);
  // Default grounded folded posture
  leftWing.rotation.z = -0.75;
  rightWing.rotation.z = 0.75;
  wingsGroup.add(leftWing, rightWing);

  // 5. Articulated Neck, Head & Mastercraft Mithril Winged-Crest Sallet Helm
  const head = new THREE.Group();
  head.position.set(0, 0.8, 0);
  torso.add(head);

  const neckCollar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.15, 0.14, 12),
    gambesonMat
  );
  neckCollar.position.set(0, -0.1, 0);
  head.add(neckCollar);

  const helmDome = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 18, 16),
    mat.mithrilSilverMaterial.clone()
  );
  helmDome.scale.set(0.96, 1.08, 1.06);
  helmDome.castShadow = true;
  head.add(helmDome);

  // Sculpted Faceplate & Nasal Guard
  const faceplate = new THREE.Mesh(
    new THREE.CylinderGeometry(0.21, 0.18, 0.24, 12, 1, false, -Math.PI * 0.45, Math.PI * 0.9),
    mat.mithrilSilverMaterial.clone()
  );
  faceplate.position.set(0, -0.05, 0.03);
  head.add(faceplate);

  // Glowing Aetherial Visor Slit (facing +Z)
  const visorMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 0.042, 0.08),
    new THREE.MeshStandardMaterial({
      color: 0x7dd3fc,
      emissive: 0x38bdf8,
      emissiveIntensity: 1.5,
    })
  );
  visorMesh.position.set(0, 0.02, 0.19);
  head.add(visorMesh);

  // Golden Helm Crown Circlet & Winged Cheekguards
  const crownBand = new THREE.Mesh(
    new THREE.CylinderGeometry(0.228, 0.228, 0.055, 16),
    mat.mithrilGoldTrimMaterial
  );
  crownBand.position.set(0, 0.08, 0);
  head.add(crownBand);

  for (const side of [-1, 1]) {
    const helmWing = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.34, 0.14),
      mat.mithrilGoldTrimMaterial
    );
    helmWing.position.set(side * 0.23, 0.16, -0.04);
    helmWing.rotation.x = -0.38;
    helmWing.rotation.z = side * -0.25;
    head.add(helmWing);
  }

  // Swept Royal Azure Helm Crest Plume
  const plumeCrest = new THREE.Mesh(
    new THREE.ConeGeometry(0.11, 0.42, 10),
    mat.mithrilCapeMaterial
  );
  plumeCrest.position.set(0, 0.26, -0.1);
  plumeCrest.rotation.x = -0.68;
  head.add(plumeCrest);

  // 6. Articulated Left & Right Arms (Shoulder -> UpperArm -> Elbow -> Forearm -> Gauntlet Hand)
  const buildArticulatedArm = (side: 1 | -1) => {
    const shoulderRoot = new THREE.Group();
    shoulderRoot.position.set(side * 0.38, 0.54, 0);
    torso.add(shoulderRoot);

    // Multi-tiered Sculpted Mastercraft Spaulder (Pauldron)
    const pauldronMain = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.21, 0.2, 12, 1, false, 0, Math.PI * 1.3),
      mat.mithrilSilverMaterial.clone()
    );
    pauldronMain.rotation.z = side * -0.45;
    pauldronMain.rotation.y = side === 1 ? -0.4 : Math.PI - 0.4;
    pauldronMain.position.set(side * 0.04, 0.03, 0);
    pauldronMain.castShadow = true;
    shoulderRoot.add(pauldronMain);

    const pauldronRim = new THREE.Mesh(
      new THREE.TorusGeometry(0.17, 0.022, 8, 16, Math.PI * 1.2),
      mat.mithrilGoldTrimMaterial
    );
    pauldronRim.rotation.x = Math.PI / 2;
    pauldronRim.rotation.z = side === 1 ? -0.5 : Math.PI * 0.5;
    pauldronRim.position.set(side * 0.03, -0.03, 0);
    shoulderRoot.add(pauldronRim);

    // Upper Arm (Rerebrace)
    const upperArmMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.082, 0.072, 0.3, 12),
      mat.mithrilSilverMaterial.clone()
    );
    upperArmMesh.position.set(0, -0.16, 0);
    upperArmMesh.castShadow = true;
    shoulderRoot.add(upperArmMesh);

    // Elbow Joint (Couter) & Forearm Group
    const forearmGroup = new THREE.Group();
    forearmGroup.position.set(0, -0.31, 0);
    shoulderRoot.add(forearmGroup);

    const elbowCop = new THREE.Mesh(
      new THREE.SphereGeometry(0.082, 10, 10),
      mat.mithrilGoldTrimMaterial
    );
    forearmGroup.add(elbowCop);

    const vambraceMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.074, 0.062, 0.28, 12),
      mat.mithrilSilverMaterial.clone()
    );
    vambraceMesh.position.set(0, -0.15, 0);
    vambraceMesh.castShadow = true;
    forearmGroup.add(vambraceMesh);

    const bracerTrim = new THREE.Mesh(
      new THREE.CylinderGeometry(0.078, 0.068, 0.12, 12),
      mat.mithrilGoldTrimMaterial
    );
    bracerTrim.position.set(0, -0.2, 0);
    forearmGroup.add(bracerTrim);

    // Articulated Gauntlet Hand Group (Grips Weapon)
    const handGroup = new THREE.Group();
    handGroup.position.set(0, -0.3, 0.02);
    forearmGroup.add(handGroup);

    const palmMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.09, 0.11, 0.11),
      mat.mithrilGoldTrimMaterial
    );
    palmMesh.castShadow = true;
    handGroup.add(palmMesh);

    const fingersMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.085, 0.065, 0.085),
      mat.mithrilSilverMaterial
    );
    fingersMesh.position.set(0, -0.05, 0.03);
    handGroup.add(fingersMesh);

    return { shoulderRoot, forearmGroup, handGroup, pauldronMain };
  };

  const leftArmRig = buildArticulatedArm(1);
  const rightArmRig = buildArticulatedArm(-1);

  const leftArm = leftArmRig.shoulderRoot;
  const leftForearm = leftArmRig.forearmGroup;
  const leftHand = leftArmRig.handGroup;
  const rightArm = rightArmRig.shoulderRoot;
  const rightForearm = rightArmRig.forearmGroup;
  const rightHand = rightArmRig.handGroup;

  // Set natural combat ready bend in elbows
  leftForearm.rotation.x = -0.38;
  rightForearm.rotation.x = -0.52;

  // Weapon Mount gripped directly inside the Right Gauntlet Hand!
  const weaponMount = new THREE.Group();
  weaponMount.position.set(0, -0.02, 0.04);
  weaponMount.rotation.x = 0.35; // Angled forward in a natural combat grip
  rightHand.add(weaponMount);

  // 7. Articulated Left & Right Legs (Hip -> Thigh -> Knee -> Shin/Greave -> Ankle/Sabaton Foot)
  const buildArticulatedLeg = (side: 1 | -1) => {
    const hipRoot = new THREE.Group();
    hipRoot.position.set(side * 0.15, 0, 0);
    pelvis.add(hipRoot);

    // Thigh Cuisse
    const thighMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.115, 0.095, 0.44, 12),
      mat.mithrilSilverMaterial.clone()
    );
    thighMesh.position.set(0, -0.22, 0);
    thighMesh.castShadow = true;
    hipRoot.add(thighMesh);

    // Knee Joint (Poleyn) & Shin Group
    const shinGroup = new THREE.Group();
    shinGroup.position.set(0, -0.44, 0);
    hipRoot.add(shinGroup);

    const kneeCop = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.095, 1),
      mat.mithrilGoldTrimMaterial
    );
    kneeCop.position.set(0, 0, 0.03);
    shinGroup.add(kneeCop);

    const greaveMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.092, 0.075, 0.42, 12),
      mat.mithrilSilverMaterial.clone()
    );
    greaveMesh.position.set(0, -0.21, 0);
    greaveMesh.castShadow = true;
    shinGroup.add(greaveMesh);

    // Ankle & Sabaton Foot Group
    const footGroup = new THREE.Group();
    footGroup.position.set(0, -0.42, 0);
    shinGroup.add(footGroup);

    const sabatonBoot = new THREE.Mesh(
      new THREE.BoxGeometry(0.15, 0.12, 0.28),
      mat.mithrilGoldTrimMaterial
    );
    sabatonBoot.position.set(0, -0.04, 0.06);
    sabatonBoot.castShadow = true;
    footGroup.add(sabatonBoot);

    return { hipRoot, shinGroup, footGroup, thighMesh, greaveMesh };
  };

  const leftLegRig = buildArticulatedLeg(1);
  const rightLegRig = buildArticulatedLeg(-1);

  const leftLeg = leftLegRig.hipRoot;
  const leftShin = leftLegRig.shinGroup;
  const leftFoot = leftLegRig.footGroup;
  const rightLeg = rightLegRig.hipRoot;
  const rightShin = rightLegRig.shinGroup;
  const rightFoot = rightLegRig.footGroup;

  const armorPads = [
    chestMesh,
    pectoralPlate,
    leftArmRig.pauldronMain,
    rightArmRig.pauldronMain,
    helmDome,
    leftLegRig.thighMesh,
    rightLegRig.thighMesh,
    leftLegRig.greaveMesh,
    rightLegRig.greaveMesh,
  ];

  const updateWeapon = (weaponId: WeaponId) => {
    while (weaponMount.children.length > 0) {
      weaponMount.remove(weaponMount.children[0]);
    }
    const def = WEAPON_REGISTRY[weaponId] || WEAPON_REGISTRY.flint_spear;
    const spearGroup = new THREE.Group();

    // Grip Wrap around Hand Position (z = 0)
    const gripWrap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.042, 0.042, 0.36, 10),
      gambesonMat
    );
    gripWrap.rotation.x = Math.PI / 2;
    spearGroup.add(gripWrap);

    // Counterweight Pommel behind hand (z = -0.68)
    const pommel = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.065, 0),
      mat.mithrilGoldTrimMaterial
    );
    pommel.position.set(0, 0, -0.68);
    spearGroup.add(pommel);

    // Ashwood / Mithril Spear Shaft held through the gauntlet hand
    const shaftGeo = new THREE.CylinderGeometry(0.032, 0.028, 2.35, 12);
    shaftGeo.rotateX(Math.PI / 2);
    const shaftMat = new THREE.MeshStandardMaterial({
      color: def.color,
      metalness: 0.55,
      roughness: 0.38,
    });
    const shaft = new THREE.Mesh(shaftGeo, shaftMat);
    shaft.position.set(0, 0, 0.48);
    shaft.castShadow = true;
    spearGroup.add(shaft);

    // Ornate Mithril Crossguard Wings
    const crossguard = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.055, 0.065),
      mat.mithrilGoldTrimMaterial
    );
    crossguard.position.set(0, 0, 1.48);
    spearGroup.add(crossguard);

    // Faceted Diamond Spearhead Blade
    const tipGeo = new THREE.ConeGeometry(0.095, 0.58, 6);
    tipGeo.rotateX(Math.PI / 2);
    const tipMat = new THREE.MeshStandardMaterial({
      color: def.accentColor,
      emissive: def.accentColor,
      emissiveIntensity: 0.45,
      metalness: 0.88,
      roughness: 0.16,
    });
    const tip = new THREE.Mesh(tipGeo, tipMat);
    tip.scale.set(1.15, 0.48, 1.0);
    tip.position.set(0, 0, 1.82);
    tip.castShadow = true;
    spearGroup.add(tip);

    weaponMount.add(spearGroup);
  };

  const updateArmor = (armorId: ArmorId) => {
    const def = ARMOR_REGISTRY[armorId] || ARMOR_REGISTRY.scavenger_rags;
    armorPads.forEach((mesh) => {
      const m = mesh.material as THREE.MeshStandardMaterial;
      m.color.set(def.color || '#cbd5e1');
      m.metalness = 0.85;
      m.roughness = 0.25;
    });
  };

  updateWeapon('flint_spear');
  updateArmor(initialArmor);

  return {
    root,
    pelvis,
    torso,
    head,
    leftArm,
    leftForearm,
    leftHand,
    rightArm,
    rightForearm,
    rightHand,
    leftLeg,
    leftShin,
    leftFoot,
    rightLeg,
    rightShin,
    rightFoot,
    weaponMount,
    cape,
    wings: wingsGroup,
    wingsGroup,
    leftWing,
    rightWing,
    contactShadow,
    armorPads,
    updateWeapon,
    updateArmor,
  };
}

/**
 * Builds distinct 3D Tribal NPC Character models (Chief Kael, Forge-Master Torak, Scout Lyra).
 */
export function buildTribalNPCModel(npcId: NPCId, mat: MaterialCache): THREE.Group {
  const rig = buildHunterModel(mat);
  const group = rig.root;

  if (npcId === 'chief_kael') {
    rig.updateArmor('thunder_warden_aegis');
    // Ceremonial Mammoth-Ivory Totem Staff & Grand Feathered Crown
    while (rig.weaponMount.children.length > 0) {
      rig.weaponMount.remove(rig.weaponMount.children[0]);
    }
    const staff = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.035, 2.5, 8), mat.boneMaterial);
    pole.position.set(0, 0.5, 0.2);
    staff.add(pole);

    const skullTotem = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 1), mat.tribalGold);
    skullTotem.position.set(0, 1.75, 0.2);
    staff.add(skullTotem);

    for (let i = -2; i <= 2; i++) {
      const crownFeather = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.42, 6), i % 2 === 0 ? mat.tribalClothRed : mat.tribalGold);
      crownFeather.position.set(i * 0.09, 0.36, -0.05);
      crownFeather.rotation.z = -i * 0.22;
      rig.head.add(crownFeather);
    }
    rig.weaponMount.add(staff);
  } else if (npcId === 'smith_torak') {
    rig.updateArmor('bronto_plate_mail');
    rig.torso.scale.set(1.22, 1.05, 1.2);
    while (rig.weaponMount.children.length > 0) {
      rig.weaponMount.remove(rig.weaponMount.children[0]);
    }
    // Heavy Basalt Anvil Hammer
    const hammer = new THREE.Group();
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.035, 1.4, 8), mat.woodMaterial);
    handle.rotateX(Math.PI / 2);
    handle.position.set(0, 0, 0.45);
    hammer.add(handle);
    const headBlock = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.28, 0.26), mat.obsidianMaterial);
    headBlock.position.set(0, 0, 1.1);
    hammer.add(headBlock);
    rig.weaponMount.add(hammer);
  } else if (npcId === 'scout_lyra') {
    rig.updateArmor('raptor_stalker_garb');
    // Feathered Fern Camouflage Cloak & Recurve Bone Bow
    const cloak = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.95, 10, 1, true), mat.foliageGreen);
    cloak.position.set(0, -0.05, -0.14);
    cloak.rotation.x = 0.22;
    rig.torso.add(cloak);

    while (rig.weaponMount.children.length > 0) {
      rig.weaponMount.remove(rig.weaponMount.children[0]);
    }
    const bow = new THREE.Mesh(
      new THREE.TorusGeometry(0.55, 0.035, 8, 16, Math.PI * 1.15),
      mat.boneMaterial
    );
    bow.rotation.y = Math.PI / 2;
    bow.position.set(0, 0, 0.35);
    rig.weaponMount.add(bow);
  }

  return group;
}

/**
 * Builds high-detail multi-part 3D Beast Rigs for all 6 Prehistoric Species:
 * - raptor (Razor-Crest Raptor Alpha)
 * - snapjaw (River Snapjaw Leviathan)
 * - brontoshell (Gilded Brontoshell Behemoth)
 * - frostfang (Frostfang Glacial Mammoth)
 * - thunderhorn (Thunderhorn Ceratopsian Prime)
 * - caldera_titan (Ignis-Rex, The Caldera Titan)
 */
export function buildBeastModel(species: BeastSpecies, mat: MaterialCache): BeastRig {
  const root = new THREE.Group();
  const body = new THREE.Group();
  const head = new THREE.Group();
  const jaw = new THREE.Group();
  const tail = new THREE.Group();
  const legs: THREE.Group[] = [];
  const accentMeshes: THREE.Mesh[] = [];
  const weakPointIndicators = new Map<string, THREE.Mesh>();

  // Soft Radial Ground Contact Shadow Disc beneath Beast
  if (species !== 'sky_dragon') {
    const shadowRadius =
      species === 'caldera_titan' || species === 'frostfang' || species === 'brontoshell'
        ? 2.8
        : 1.9;
    const beastShadow = new THREE.Mesh(
      new THREE.CircleGeometry(shadowRadius, 24),
      mat.contactShadowMaterial
    );
    beastShadow.rotation.x = -Math.PI / 2;
    beastShadow.position.set(0, 0.03, 0);
    beastShadow.renderOrder = 1;
    root.add(beastShadow);
  }

  const skinMat = mat.beastSkin[species];
  const bellyMat = mat.beastUnderbelly[species];
  const accentMat = mat.beastAccent[species];

  const addEyesAndTeeth = (
    headGroup: THREE.Group,
    jawGroup: THREE.Group,
    eyeX: number,
    eyeY: number,
    eyeZ: number,
    snoutWidth: number,
    snoutLen: number,
    toothCount = 6
  ) => {
    const eyeSphere = new THREE.SphereGeometry(0.09, 10, 10);
    const eyeL = new THREE.Mesh(eyeSphere, accentMat);
    eyeL.position.set(eyeX, eyeY, eyeZ);
    const eyeR = new THREE.Mesh(eyeSphere, accentMat);
    eyeR.position.set(-eyeX, eyeY, eyeZ);
    headGroup.add(eyeL, eyeR);
    accentMeshes.push(eyeL, eyeR);

    for (let t = 0; t < toothCount; t++) {
      const zOff = 0.25 + (t / toothCount) * (snoutLen * 0.75);
      const fangL = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.18, 5), mat.boneMaterial);
      fangL.rotation.x = Math.PI;
      fangL.position.set(snoutWidth * 0.42, -0.12, zOff);
      const fangR = fangL.clone();
      fangR.position.x = -snoutWidth * 0.42;
      headGroup.add(fangL, fangR);

      const lowerFangL = new THREE.Mesh(new THREE.ConeGeometry(0.038, 0.14, 5), mat.boneMaterial);
      lowerFangL.position.set(snoutWidth * 0.36, 0.1, zOff);
      const lowerFangR = lowerFangL.clone();
      lowerFangR.position.x = -snoutWidth * 0.36;
      jawGroup.add(lowerFangL, lowerFangR);
    }
  };

  if (species === 'raptor') {
    body.position.set(0, 1.45, 0);
    root.add(body);

    // Muscular Theropod Torso + Underbelly + Rib Musculature
    const torsoGeo = new THREE.CylinderGeometry(0.54, 0.68, 2.35, 14);
    torsoGeo.rotateX(Math.PI / 2);
    const torsoMesh = new THREE.Mesh(torsoGeo, skinMat);
    torsoMesh.castShadow = true;
    body.add(torsoMesh);

    const chestBelly = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.56, 2.15, 12), bellyMat);
    chestBelly.rotateX(Math.PI / 2);
    chestBelly.position.set(0, -0.14, 0);
    body.add(chestBelly);

    // Feathered Winged Forearms
    for (const side of [-1, 1]) {
      const armGroup = new THREE.Group();
      armGroup.position.set(side * 0.52, -0.1, 0.72);
      const armBone = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.06, 0.65, 8), skinMat);
      armBone.rotation.x = 0.7;
      armGroup.add(armBone);
      for (let f = 0; f < 4; f++) {
        const plume = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.42, 5), accentMat);
        plume.position.set(side * 0.06, -0.1 - f * 0.08, -0.18);
        plume.rotation.x = -1.2;
        armGroup.add(plume);
        accentMeshes.push(plume);
      }
      body.add(armGroup);
    }

    // S-Curved Neck & Head with Feathered Crown
    head.position.set(0, 0.62, 1.38);
    body.add(head);

    const neckMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.42, 0.85, 10), skinMat);
    neckMesh.position.set(0, -0.22, -0.25);
    neckMesh.rotation.x = 0.55;
    head.add(neckMesh);

    const snoutGeo = new THREE.ConeGeometry(0.38, 1.18, 10);
    snoutGeo.rotateX(Math.PI / 2);
    const snoutMesh = new THREE.Mesh(snoutGeo, skinMat);
    snoutMesh.position.set(0, 0.08, 0.42);
    head.add(snoutMesh);

    jaw.position.set(0, -0.12, 0.25);
    const jawGeo = new THREE.ConeGeometry(0.28, 0.9, 8);
    jawGeo.rotateX(Math.PI / 2);
    const jawMesh = new THREE.Mesh(jawGeo, bellyMat);
    jawMesh.position.set(0, 0, 0.25);
    jaw.add(jawMesh);
    head.add(jaw);

    addEyesAndTeeth(head, jaw, 0.22, 0.16, 0.25, 0.42, 0.85, 5);

    // Multi-plume Feathered Skull Crest
    for (let c = 0; c < 5; c++) {
      const crest = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.68 - c * 0.06, 6), accentMat);
      crest.position.set(0, 0.42 - c * 0.04, 0.15 - c * 0.14);
      crest.rotation.x = -0.65 - c * 0.12;
      head.add(crest);
      accentMeshes.push(crest);
    }

    // Articulated Tail with Feathered Fan Plume
    tail.position.set(0, 0.1, -1.15);
    body.add(tail);
    const tailGeo = new THREE.ConeGeometry(0.42, 2.55, 10);
    tailGeo.rotateX(-Math.PI / 2);
    const tailMesh = new THREE.Mesh(tailGeo, skinMat);
    tailMesh.position.set(0, 0, -1.18);
    tail.add(tailMesh);

    for (const side of [-1, 0, 1]) {
      const fan = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.95, 5), accentMat);
      fan.position.set(side * 0.16, 0.08, -2.15);
      fan.rotation.x = -Math.PI / 2;
      fan.rotation.z = side * 0.35;
      tail.add(fan);
      accentMeshes.push(fan);
    }

    // Hind Legs with Curved Sickle Talons
    for (const side of [-1, 1]) {
      const leg = new THREE.Group();
      leg.position.set(side * 0.56, 1.35, -0.1);
      const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.18, 0.9, 10), skinMat);
      thigh.position.set(0, -0.35, 0.08);
      thigh.rotation.x = -0.25;
      const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.11, 0.85, 10), skinMat);
      shin.position.set(0, -0.95, -0.08);
      shin.rotation.x = 0.25;
      const sickleClaw = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.045, 6, 12, Math.PI), mat.boneMaterial);
      sickleClaw.rotation.y = Math.PI / 2;
      sickleClaw.position.set(-side * 0.08, -1.28, 0.18);
      leg.add(thigh, shin, sickleClaw);
      root.add(leg);
      legs.push(leg);
    }
  } else if (species === 'snapjaw') {
    // RIVER SNAPJAW LEVIATHAN: Colossal Amphibious Spinosaur-Crocodile of the Crystal River & Ocean
    body.position.set(0, 1.25, 0);
    root.add(body);

    const torsoGeo = new THREE.CylinderGeometry(0.78, 0.88, 3.6, 14);
    torsoGeo.rotateX(Math.PI / 2);
    const torsoMesh = new THREE.Mesh(torsoGeo, skinMat);
    torsoMesh.scale.set(1.15, 0.82, 1.0);
    torsoMesh.castShadow = true;
    body.add(torsoMesh);

    // Towering Serrated Hydro-Sail Dorsal Fin
    for (let s = 0; s < 7; s++) {
      const sailHeight = 1.35 - Math.abs(s - 3) * 0.22;
      const spine = new THREE.Mesh(new THREE.ConeGeometry(0.16, sailHeight, 6), accentMat);
      spine.position.set(0, 0.65 + sailHeight * 0.35, 1.2 - s * 0.42);
      spine.rotation.x = -0.15;
      body.add(spine);
      accentMeshes.push(spine);
    }

    // Osteoderm Armored Scutes along Flanks
    for (const side of [-1, 1]) {
      for (let k = 0; k < 5; k++) {
        const scute = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 0), bellyMat);
        scute.position.set(side * 0.82, 0.28, 1.1 - k * 0.55);
        body.add(scute);
      }
    }

    // Elongated Crocodilian Snout & Bioluminescent Maw
    head.position.set(0, 0.15, 2.05);
    body.add(head);

    const upperJawGeo = new THREE.BoxGeometry(0.76, 0.36, 1.65);
    const upperJaw = new THREE.Mesh(upperJawGeo, skinMat);
    upperJaw.position.set(0, 0.12, 0.65);
    head.add(upperJaw);

    jaw.position.set(0, -0.14, 0.1);
    const lowerJaw = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.24, 1.5), bellyMat);
    lowerJaw.position.set(0, -0.05, 0.58);
    jaw.add(lowerJaw);
    head.add(jaw);

    addEyesAndTeeth(head, jaw, 0.3, 0.32, 0.25, 0.68, 1.35, 8);

    // Powerful Amphibious Paddle Tail
    tail.position.set(0, 0, -1.75);
    body.add(tail);
    const tailGeo = new THREE.ConeGeometry(0.68, 3.4, 10);
    tailGeo.rotateX(-Math.PI / 2);
    const tailMesh = new THREE.Mesh(tailGeo, skinMat);
    tailMesh.scale.set(0.65, 1.25, 1.0);
    tailMesh.position.set(0, 0, -1.55);
    tail.add(tailMesh);

    const tailFin = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.95, 2.6), accentMat);
    tailFin.position.set(0, 0.32, -1.5);
    tail.add(tailFin);
    accentMeshes.push(tailFin);

    // 4 Webbed Squat Legs
    const legCoords = [
      { x: 0.92, z: 1.05 },
      { x: -0.92, z: 1.05 },
      { x: 0.92, z: -1.05 },
      { x: -0.92, z: -1.05 },
    ];
    for (const lc of legCoords) {
      const leg = new THREE.Group();
      leg.position.set(lc.x, 1.05, lc.z);
      const limb = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.18, 1.05, 10), skinMat);
      limb.position.set(0, -0.45, 0);
      const webbedFoot = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.12, 0.52), accentMat);
      webbedFoot.position.set(0, -0.95, 0.12);
      leg.add(limb, webbedFoot);
      root.add(leg);
      legs.push(leg);
    }
  } else if (species === 'brontoshell') {
    body.position.set(0, 1.65, 0);
    root.add(body);

    // Domed Armored Carapace with Hexagonal Ridges & Shoulder Spikes
    const shellGeo = new THREE.SphereGeometry(1.78, 16, 14, 0, Math.PI * 2, 0, Math.PI * 0.62);
    const shellMesh = new THREE.Mesh(shellGeo, skinMat);
    shellMesh.scale.set(1.02, 0.9, 1.32);
    shellMesh.position.set(0, -0.15, 0);
    shellMesh.castShadow = true;
    body.add(shellMesh);

    const plastron = new THREE.Mesh(new THREE.CylinderGeometry(1.45, 1.55, 0.55, 14), bellyMat);
    plastron.scale.set(1.0, 1.0, 1.3);
    plastron.position.set(0, -0.35, 0);
    body.add(plastron);

    for (let i = -2; i <= 2; i++) {
      const ridge = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.68, 6), accentMat);
      ridge.position.set(0, 1.32 - Math.abs(i) * 0.12, i * 0.65);
      body.add(ridge);
      accentMeshes.push(ridge);

      for (const side of [-1, 1]) {
        const rimSpike = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.52, 5), mat.boneMaterial);
        rimSpike.position.set(side * 1.55, 0.25, i * 0.65);
        rimSpike.rotation.z = -side * 1.1;
        body.add(rimSpike);
      }
    }

    head.position.set(0, 0.0, 2.25);
    body.add(head);
    const headMesh = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.68, 1.05), bellyMat);
    headMesh.castShadow = true;
    head.add(headMesh);

    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.38, 0.55, 6), mat.boneMaterial);
    beak.rotateX(Math.PI / 2);
    beak.position.set(0, -0.05, 0.68);
    head.add(beak);

    jaw.position.set(0, -0.25, 0.1);
    const lowerBeak = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.2, 0.68), bellyMat);
    jaw.add(lowerBeak);
    head.add(jaw);

    addEyesAndTeeth(head, jaw, 0.36, 0.16, 0.25, 0.6, 0.6, 4);

    // Heavy Tail + Spiked Ankylosaur Mace Club
    tail.position.set(0, -0.1, -2.05);
    body.add(tail);
    const tailShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.38, 1.5, 10), bellyMat);
    tailShaft.rotateX(Math.PI / 2);
    tailShaft.position.set(0, 0, -0.6);
    tail.add(tailShaft);

    const club = new THREE.Mesh(new THREE.DodecahedronGeometry(0.56, 1), accentMat);
    club.scale.set(1.3, 0.75, 1.1);
    club.position.set(0, 0, -1.35);
    tail.add(club);
    accentMeshes.push(club);

    const legCoords = [
      { x: 1.25, z: 1.15 },
      { x: -1.25, z: 1.15 },
      { x: 1.25, z: -1.15 },
      { x: -1.25, z: -1.15 },
    ];
    for (const lc of legCoords) {
      const leg = new THREE.Group();
      leg.position.set(lc.x, 1.35, lc.z);
      const legMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.44, 1.35, 10), bellyMat);
      legMesh.position.set(0, -0.65, 0);
      legMesh.castShadow = true;
      leg.add(legMesh);
      root.add(leg);
      legs.push(leg);
    }
  } else if (species === 'frostfang') {
    // FROSTFANG GLACIAL MAMMOTH: Towering Woolly Behemoth of the Cold Snow Mountains
    body.position.set(0, 2.35, 0);
    root.add(body);

    // Massive Woolly Torso & High Glacial Shoulder Hump
    const torsoGeo = new THREE.CylinderGeometry(1.25, 1.38, 3.4, 16);
    torsoGeo.rotateX(Math.PI / 2);
    const torsoMesh = new THREE.Mesh(torsoGeo, skinMat);
    torsoMesh.castShadow = true;
    body.add(torsoMesh);

    const humpMesh = new THREE.Mesh(new THREE.SphereGeometry(1.18, 14, 12), skinMat);
    humpMesh.position.set(0, 0.72, 0.45);
    body.add(humpMesh);

    // Crystalline Ice Spires along the Spine Hump
    for (let c = 0; c < 5; c++) {
      const iceCrystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.36 - c * 0.04, 0), accentMat);
      iceCrystal.scale.set(0.8, 1.9, 0.8);
      iceCrystal.position.set(0, 1.45 - c * 0.18, 0.85 - c * 0.55);
      iceCrystal.rotation.x = -0.25;
      body.add(iceCrystal);
      accentMeshes.push(iceCrystal);
    }

    // Shaggy Hanging Winter Skirt Fur
    const furSkirt = new THREE.Mesh(new THREE.CylinderGeometry(1.32, 1.48, 0.9, 14), bellyMat);
    furSkirt.position.set(0, -0.95, 0);
    body.add(furSkirt);

    // Mammoth Head, Articulated Trunk & Colossal Curved Glacial Ivory Tusks
    head.position.set(0, 0.48, 1.95);
    body.add(head);

    const cranium = new THREE.Mesh(new THREE.SphereGeometry(0.92, 14, 14), skinMat);
    cranium.scale.set(0.95, 1.15, 0.95);
    head.add(cranium);

    // Segmented Prehensile Trunk
    for (let t = 0; t < 5; t++) {
      const seg = new THREE.Mesh(
        new THREE.CylinderGeometry(0.28 - t * 0.035, 0.24 - t * 0.035, 0.48, 10),
        skinMat
      );
      seg.position.set(0, -0.25 - t * 0.36, 0.68 + Math.sin(t * 0.5) * 0.22);
      seg.rotation.x = 0.35 - t * 0.18;
      head.add(seg);
    }

    // Giant Spiraled Glacial Ivory Tusks
    for (const side of [-1, 1]) {
      const tuskGroup = new THREE.Group();
      tuskGroup.position.set(side * 0.58, -0.35, 0.55);
      const tuskArc = new THREE.Mesh(
        new THREE.TorusGeometry(1.15, 0.14, 10, 20, Math.PI * 0.85),
        mat.boneMaterial
      );
      tuskArc.rotation.y = Math.PI / 2 + side * 0.22;
      tuskArc.rotation.x = -0.35;
      tuskArc.position.set(side * 0.15, 0.65, 0.85);
      tuskGroup.add(tuskArc);

      const frostTip = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.55, 8), accentMat);
      frostTip.position.set(side * 0.38, 1.35, 1.72);
      frostTip.rotation.x = -0.45;
      tuskGroup.add(frostTip);
      accentMeshes.push(frostTip);

      head.add(tuskGroup);
    }

    jaw.position.set(0, -0.5, 0.2);
    head.add(jaw);
    addEyesAndTeeth(head, jaw, 0.62, 0.22, 0.55, 0.6, 0.5, 2);

    // Short Tufted Tail
    tail.position.set(0, 0.1, -1.65);
    const tailTuft = new THREE.Mesh(new THREE.ConeGeometry(0.28, 1.1, 8), skinMat);
    tailTuft.rotation.x = -0.6;
    tailTuft.position.set(0, -0.4, -0.35);
    tail.add(tailTuft);
    body.add(tail);

    // 4 Pillar-like Mammoth Legs
    const legCoords = [
      { x: 0.88, z: 1.05 },
      { x: -0.88, z: 1.05 },
      { x: 0.88, z: -1.05 },
      { x: -0.88, z: -1.05 },
    ];
    for (const lc of legCoords) {
      const leg = new THREE.Group();
      leg.position.set(lc.x, 2.05, lc.z);
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.48, 2.05, 12), skinMat);
      pillar.position.set(0, -1.0, 0);
      pillar.castShadow = true;
      leg.add(pillar);
      root.add(leg);
      legs.push(leg);
    }
  } else if (species === 'thunderhorn') {
    body.position.set(0, 1.95, 0);
    root.add(body);

    const torsoGeo = new THREE.CylinderGeometry(1.12, 1.24, 3.25, 14);
    torsoGeo.rotateX(Math.PI / 2);
    const torsoMesh = new THREE.Mesh(torsoGeo, skinMat);
    torsoMesh.castShadow = true;
    body.add(torsoMesh);

    head.position.set(0, 0.3, 1.85);
    body.add(head);

    // Armored Scalloped Bone Frill Shield
    const frillGeo = new THREE.CylinderGeometry(1.58, 1.25, 0.26, 12);
    frillGeo.rotateX(Math.PI / 2.4);
    const frillMesh = new THREE.Mesh(frillGeo, skinMat);
    frillMesh.position.set(0, 0.68, -0.1);
    head.add(frillMesh);

    // Frill Rim Crown Studs
    for (let a = -3; a <= 3; a++) {
      const stud = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.36, 5), accentMat);
      stud.position.set(a * 0.36, 1.38 - Math.abs(a) * 0.14, -0.25);
      head.add(stud);
      accentMeshes.push(stud);
    }

    const skullMesh = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.88, 1.35), skinMat);
    skullMesh.position.set(0, 0, 0.5);
    head.add(skullMesh);

    jaw.position.set(0, -0.35, 0.3);
    const jawMesh = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.25, 0.9), bellyMat);
    jaw.add(jawMesh);
    head.add(jaw);

    addEyesAndTeeth(head, jaw, 0.52, 0.2, 0.45, 0.7, 0.8, 4);

    // Conductive Nasal Horn + Twin Brow Horns
    const nasalHorn = new THREE.Mesh(new THREE.ConeGeometry(0.28, 1.45, 8), accentMat);
    nasalHorn.rotation.x = Math.PI / 2.8;
    nasalHorn.position.set(0, 0.55, 1.25);
    head.add(nasalHorn);
    accentMeshes.push(nasalHorn);

    for (const side of [-1, 1]) {
      const browHorn = new THREE.Mesh(new THREE.ConeGeometry(0.19, 1.68, 8), mat.boneMaterial);
      browHorn.rotation.x = Math.PI / 2.3;
      browHorn.rotation.z = -side * 0.18;
      browHorn.position.set(side * 0.56, 0.85, 0.72);
      head.add(browHorn);
    }

    tail.position.set(0, 0.1, -1.65);
    body.add(tail);
    const tailGeo = new THREE.ConeGeometry(0.58, 2.25, 10);
    tailGeo.rotateX(-Math.PI / 2);
    const tailMesh = new THREE.Mesh(tailGeo, skinMat);
    tailMesh.position.set(0, 0, -1.0);
    tail.add(tailMesh);

    const legCoords = [
      { x: 0.96, z: 1.05 },
      { x: -0.96, z: 1.05 },
      { x: 0.96, z: -1.05 },
      { x: -0.96, z: -1.05 },
    ];
    for (const lc of legCoords) {
      const leg = new THREE.Group();
      leg.position.set(lc.x, 1.75, lc.z);
      const legMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.34, 1.75, 10), skinMat);
      legMesh.position.set(0, -0.85, 0);
      legMesh.castShadow = true;
      leg.add(legMesh);
      root.add(leg);
      legs.push(leg);
    }
  } else if (species === 'sky_dragon') {
    // SKY DRAGON: Aurelius, Aetherial Sky-Wyvern (Flying Dragon with Articulated Wings)
    body.position.set(0, 2.35, 0);
    root.add(body);

    const torsoGeo = new THREE.CylinderGeometry(0.75, 0.92, 3.6, 14);
    torsoGeo.rotateX(Math.PI / 2);
    const torsoMesh = new THREE.Mesh(torsoGeo, skinMat);
    torsoMesh.castShadow = true;
    body.add(torsoMesh);

    const bellyMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.76, 3.3, 12), bellyMat);
    bellyMesh.rotateX(Math.PI / 2);
    bellyMesh.position.set(0, -0.22, 0);
    body.add(bellyMesh);

    // Bioluminescent Aether Core & Dorsal Spines
    for (let i = -3; i <= 3; i++) {
      const spine = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.88, 6), accentMat);
      spine.position.set(0, 0.95, i * 0.48);
      spine.rotation.x = -0.38;
      body.add(spine);
      accentMeshes.push(spine);
    }

    // Sinuous Dragon Neck & Horned Draconic Head
    head.position.set(0, 0.85, 2.15);
    body.add(head);

    const neckMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.58, 1.35, 12), skinMat);
    neckMesh.position.set(0, -0.32, -0.45);
    neckMesh.rotation.x = 0.65;
    head.add(neckMesh);

    const snoutGeo = new THREE.ConeGeometry(0.56, 1.65, 10);
    snoutGeo.rotateX(Math.PI / 2);
    const snoutMesh = new THREE.Mesh(snoutGeo, skinMat);
    snoutMesh.position.set(0, 0.12, 0.68);
    head.add(snoutMesh);

    jaw.position.set(0, -0.18, 0.35);
    const jawGeo = new THREE.ConeGeometry(0.44, 1.35, 8);
    jawGeo.rotateX(Math.PI / 2);
    const jawMesh = new THREE.Mesh(jawGeo, bellyMat);
    jawMesh.position.set(0, 0, 0.42);
    jaw.add(jawMesh);
    head.add(jaw);

    addEyesAndTeeth(head, jaw, 0.36, 0.24, 0.4, 0.62, 1.2, 6);

    // Swept Draconic Crown Horns
    for (const side of [-1, 1]) {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.16, 1.45, 8), mat.tribalGold);
      horn.rotation.x = -Math.PI / 2.6;
      horn.rotation.z = side * 0.28;
      horn.position.set(side * 0.38, 0.56, -0.15);
      head.add(horn);
      accentMeshes.push(horn);
    }

    // Twin Colossal Articulated Dragon Wings (stored in legs[0] and legs[1] for wing-flap animation!)
    for (const side of [-1, 1]) {
      const wingGroup = new THREE.Group();
      wingGroup.position.set(side * 0.72, 0.52, 0.45);

      // Leading Wing Bone Spar
      const bone1 = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.08, 3.6, 8), skinMat);
      bone1.rotation.z = -side * (Math.PI / 2.15);
      bone1.position.set(side * 1.75, 0.35, 0.2);
      wingGroup.add(bone1);

      // Wing Patagium Membranes (3-fingered bat/wyvern wing fan)
      for (let f = 0; f < 3; f++) {
        const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.02, 2.8 - f * 0.35, 6), mat.boneMaterial);
        strut.rotation.z = -side * (Math.PI / 2.4);
        strut.rotation.y = side * (0.25 + f * 0.26);
        strut.position.set(side * (1.8 + f * 0.45), 0.15 - f * 0.12, -0.35 - f * 0.42);
        wingGroup.add(strut);

        const membrane = new THREE.Mesh(
          new THREE.ConeGeometry(0.95, 3.1 - f * 0.3, 4),
          f === 1 ? accentMat : skinMat
        );
        membrane.scale.set(1.0, 1.0, 0.14);
        membrane.rotation.z = -side * (Math.PI / 2.2);
        membrane.rotation.y = side * (0.18 + f * 0.2);
        membrane.position.set(side * (1.65 + f * 0.55), 0.05 - f * 0.1, -0.45 - f * 0.4);
        membrane.castShadow = true;
        wingGroup.add(membrane);
      }

      body.add(wingGroup);
      legs.push(wingGroup);
    }

    // Hind Talons
    for (const side of [-1, 1]) {
      const talonLeg = new THREE.Group();
      talonLeg.position.set(side * 0.68, 1.75, -0.65);
      const legMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.16, 1.45, 8), skinMat);
      legMesh.position.set(0, -0.65, 0);
      legMesh.rotation.x = 0.35;
      talonLeg.add(legMesh);
      root.add(talonLeg);
      legs.push(talonLeg);
    }

    // Long Whip-Tail with Arrowhead Aether Fluke
    tail.position.set(0, 0.05, -1.75);
    body.add(tail);
    const tailGeo = new THREE.ConeGeometry(0.52, 3.85, 10);
    tailGeo.rotateX(-Math.PI / 2);
    const tailMesh = new THREE.Mesh(tailGeo, skinMat);
    tailMesh.position.set(0, 0, -1.85);
    tail.add(tailMesh);

    const fluke = new THREE.Mesh(new THREE.OctahedronGeometry(0.52, 0), accentMat);
    fluke.scale.set(1.4, 0.25, 1.6);
    fluke.position.set(0, 0, -3.7);
    tail.add(fluke);
    accentMeshes.push(fluke);
  } else {
    // CALDERA TITAN: Ignis-Rex Apex Volcanic Dragon-Theropod
    body.position.set(0, 2.85, 0);
    root.add(body);

    const torsoGeo = new THREE.CylinderGeometry(1.22, 1.48, 4.1, 16);
    torsoGeo.rotateX(Math.PI / 2.3);
    const torsoMesh = new THREE.Mesh(torsoGeo, skinMat);
    torsoMesh.castShadow = true;
    body.add(torsoMesh);

    // Glowing Volcanic Heart Core in Chest
    const coreMesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.72, 1), accentMat);
    coreMesh.position.set(0, -0.35, 0.95);
    body.add(coreMesh);
    accentMeshes.push(coreMesh);

    // Dorsal Magma Spines & Obsidian Shoulder Wings
    for (let i = -3; i <= 2; i++) {
      const dorsal = new THREE.Mesh(new THREE.ConeGeometry(0.3, 1.15, 6), accentMat);
      dorsal.position.set(0, 1.35 - i * 0.14, i * 0.65);
      dorsal.rotation.x = -0.3;
      body.add(dorsal);
      accentMeshes.push(dorsal);
    }

    head.position.set(0, 1.35, 2.35);
    body.add(head);

    const skullMesh = new THREE.Mesh(new THREE.BoxGeometry(1.32, 1.05, 1.85), skinMat);
    skullMesh.position.set(0, 0.2, 0.65);
    head.add(skullMesh);

    jaw.position.set(0, -0.38, 0.25);
    const jawMesh = new THREE.Mesh(new THREE.BoxGeometry(1.12, 0.42, 1.65), bellyMat);
    jawMesh.position.set(0, 0, 0.55);
    jaw.add(jawMesh);
    head.add(jaw);

    addEyesAndTeeth(head, jaw, 0.58, 0.36, 0.55, 1.05, 1.45, 7);

    // Molten Crown Horns
    for (const side of [-1, 1]) {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.24, 1.48, 8), accentMat);
      horn.rotation.x = -Math.PI / 3;
      horn.rotation.z = side * 0.32;
      horn.position.set(side * 0.62, 0.85, 0.1);
      head.add(horn);
      accentMeshes.push(horn);
    }

    tail.position.set(0, -0.3, -1.9);
    body.add(tail);
    const tailGeo = new THREE.ConeGeometry(0.88, 4.1, 12);
    tailGeo.rotateX(-Math.PI / 2);
    const tailMesh = new THREE.Mesh(tailGeo, skinMat);
    tailMesh.position.set(0, 0, -1.85);
    tail.add(tailMesh);

    for (const side of [-1, 1]) {
      const leg = new THREE.Group();
      leg.position.set(side * 1.12, 2.6, -0.2);
      const legMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.4, 2.65, 12), skinMat);
      legMesh.position.set(0, -1.25, 0);
      legMesh.castShadow = true;
      leg.add(legMesh);
      root.add(leg);
      legs.push(leg);
    }
  }

  return {
    root,
    body,
    head,
    jaw,
    tail,
    legs,
    accentMeshes,
    weakPointIndicators,
  };
}

/**
 * Builds a 3D Creature / Dragon Egg Nest with woven timber/stone rim and glowing speckled Egg.
 */
export function buildEggNestModel(species: BeastSpecies, mat: MaterialCache): THREE.Group {
  const group = new THREE.Group();

  // Woven Nest Base Ring
  const nestRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.85, 0.24, 8, 18),
    species === 'sky_dragon' || species === 'caldera_titan' ? mat.obsidianMaterial : mat.woodMaterial
  );
  nestRing.rotation.x = Math.PI / 2;
  nestRing.position.y = 0.18;
  nestRing.castShadow = true;
  group.add(nestRing);

  // Surrounding Nest Stones / Twigs
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(0.24, 0), mat.stoneMaterial);
    stone.position.set(Math.cos(a) * 0.95, 0.16, Math.sin(a) * 0.95);
    group.add(stone);
  }

  // Primary Creature Egg (Ovoid Sphere) + Secondary Clutch Eggs
  const eggMat = mat.beastAccent[species] || mat.tribalGold;
  const mainEgg = new THREE.Mesh(new THREE.SphereGeometry(0.46, 16, 14), eggMat);
  mainEgg.scale.set(0.85, 1.32, 0.85);
  mainEgg.position.set(0, 0.58, 0);
  mainEgg.name = 'creature_egg_mesh';
  mainEgg.castShadow = true;
  group.add(mainEgg);

  for (const off of [
    { x: 0.36, z: 0.25, s: 0.62 },
    { x: -0.34, z: -0.22, s: 0.58 },
  ]) {
    const subEgg = new THREE.Mesh(new THREE.SphereGeometry(0.38, 12, 12), mat.beastSkin[species] || mat.boneMaterial);
    subEgg.scale.set(0.82 * off.s, 1.28 * off.s, 0.82 * off.s);
    subEgg.position.set(off.x, 0.42, off.z);
    group.add(subEgg);
  }

  return group;
}

/**
 * Builds a monumental 3D Cold Snow Mountain Peak with rocky granite crags, deep white snow cap, and glacial ice spires.
 */
export function buildSnowMountainPeakModel(mat: MaterialCache, scale = 1): THREE.Group {
  const group = new THREE.Group();

  // Main Granite Base Peak
  const basePeak = new THREE.Mesh(new THREE.ConeGeometry(11.5, 22, 9), mat.stoneMaterial);
  basePeak.position.set(0, 10.5, 0);
  basePeak.castShadow = true;
  basePeak.receiveShadow = true;
  group.add(basePeak);

  // Upper Snow-Capped Crown
  const snowCap = new THREE.Mesh(new THREE.ConeGeometry(6.8, 12.5, 9), mat.snowMaterial);
  snowCap.position.set(0, 15.6, 0);
  group.add(snowCap);

  // Secondary Side Ridge + Snow Shoulder
  const sidePeak = new THREE.Mesh(new THREE.ConeGeometry(7.5, 14.5, 8), mat.stoneMaterial);
  sidePeak.position.set(6.5, 6.8, 3.2);
  group.add(sidePeak);

  const sideSnow = new THREE.Mesh(new THREE.ConeGeometry(4.6, 8.2, 8), mat.snowMaterial);
  sideSnow.position.set(6.5, 10.3, 3.2);
  group.add(sideSnow);

  // Glacial Blue Ice Spires
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2 + 0.4;
    const spire = new THREE.Mesh(new THREE.OctahedronGeometry(1.6, 0), mat.glacierIceMaterial);
    spire.scale.set(0.7, 2.4, 0.7);
    spire.position.set(Math.cos(angle) * 5.2, 8.5 + i * 1.2, Math.sin(angle) * 5.2);
    spire.rotation.z = (i % 2 === 0 ? 1 : -1) * 0.2;
    group.add(spire);
  }

  group.scale.setScalar(scale);
  return group;
}

/**
 * Builds a 3D Prehistoric Armored River & Ocean Fish with dorsal sail and tail fluke.
 */
export function buildRiverFishModel(mat: MaterialCache, scale = 1): THREE.Group {
  const group = new THREE.Group();

  const bodyGeo = new THREE.ConeGeometry(0.22, 0.95, 10);
  bodyGeo.rotateX(Math.PI / 2);
  const body = new THREE.Mesh(bodyGeo, mat.fishScaleMaterial);
  body.scale.set(0.65, 1.0, 1.0);
  group.add(body);

  const headGeo = new THREE.SphereGeometry(0.21, 10, 10);
  const head = new THREE.Mesh(headGeo, mat.fishScaleMaterial);
  head.scale.set(0.65, 0.95, 1.2);
  head.position.set(0, 0, 0.42);
  group.add(head);

  const dorsal = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.35, 4), mat.tribalGold);
  dorsal.position.set(0, 0.24, 0.05);
  dorsal.rotation.x = -0.35;
  group.add(dorsal);

  const tailFin = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.38, 3), mat.tribalGold);
  tailFin.rotateX(-Math.PI / 2);
  tailFin.scale.set(0.3, 1.2, 1.0);
  tailFin.position.set(0, 0, -0.58);
  group.add(tailFin);

  group.scale.setScalar(scale);
  return group;
}

/**
 * Builds a 3D Wooden Tribal River Crossing Bridge with rope posts and timber planks.
 */
export function buildRiverBridgeModel(mat: MaterialCache): THREE.Group {
  const group = new THREE.Group();
  const bridgeLen = 14;
  const bridgeWidth = 3.6;

  // Main Support Beams
  for (const side of [-1, 1]) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.28, bridgeLen), mat.woodMaterial);
    beam.position.set(side * (bridgeWidth * 0.44), 0.35, 0);
    group.add(beam);

    // Railing Posts
    for (let z = -bridgeLen / 2 + 1; z <= bridgeLen / 2 - 1; z += 3) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 1.45, 8), mat.woodMaterial);
      post.position.set(side * (bridgeWidth * 0.46), 0.9, z);
      group.add(post);

      const torchTop = new THREE.Mesh(new THREE.OctahedronGeometry(0.14, 0), mat.tribalGold);
      torchTop.position.set(side * (bridgeWidth * 0.46), 1.68, z);
      group.add(torchTop);
    }
  }

  // Timber Deck Planks
  for (let z = -bridgeLen / 2 + 0.4; z <= bridgeLen / 2 - 0.4; z += 0.65) {
    const plank = new THREE.Mesh(new THREE.BoxGeometry(bridgeWidth, 0.12, 0.52), mat.woodMaterial);
    plank.position.set(0, 0.52, z);
    plank.receiveShadow = true;
    group.add(plank);
  }

  return group;
}

/**
 * Builds procedural 3D environment props:
 * trees (palm, pine, snow_pine, banyan), shrubs, grass tufts, river reeds, boulders, river stones, crystals, spires.
 */
export function buildFoliageModel(
  type:
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
    | 'spire',
  mat: MaterialCache,
  scale = 1
): THREE.Group {
  const group = new THREE.Group();

  if (type === 'palm') {
    // Segmented curved trunk + coconuts + lush radiating fronds
    for (let s = 0; s < 4; s++) {
      const seg = new THREE.Mesh(
        new THREE.CylinderGeometry(0.22 - s * 0.025, 0.25 - s * 0.025, 1.15, 8),
        mat.woodMaterial
      );
      seg.position.set(s * 0.12, 0.55 + s * 1.02, 0);
      seg.rotation.z = -s * 0.08;
      seg.castShadow = true;
      group.add(seg);
    }

    const crownX = 0.42;
    const crownY = 4.35;
    for (let i = 0; i < 7; i++) {
      const angle = (i / 7) * Math.PI * 2;
      const frondGeo = new THREE.ConeGeometry(0.55, 2.45, 5);
      const frond = new THREE.Mesh(frondGeo, mat.foliageGreen);
      frond.position.set(crownX + Math.cos(angle) * 0.95, crownY, Math.sin(angle) * 0.95);
      frond.rotation.z = -Math.cos(angle) * 1.12;
      frond.rotation.x = Math.sin(angle) * 1.12;
      frond.castShadow = true;
      group.add(frond);
    }
  } else if (type === 'pine' || type === 'snow_pine') {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.36, 2.8, 8), mat.woodMaterial);
    trunk.position.y = 1.4;
    trunk.castShadow = true;
    group.add(trunk);

    for (let t = 0; t < 3; t++) {
      const cone = new THREE.Mesh(
        new THREE.ConeGeometry(1.75 - t * 0.38, 2.1, 8),
        type === 'snow_pine' ? mat.pineSnowGreen : mat.foliageDarkGreen
      );
      cone.position.y = 2.4 + t * 1.25;
      cone.castShadow = true;
      group.add(cone);

      if (type === 'snow_pine') {
        const snowCap = new THREE.Mesh(
          new THREE.ConeGeometry(1.55 - t * 0.34, 0.95, 8),
          mat.snowMaterial
        );
        snowCap.position.y = 2.98 + t * 1.25;
        group.add(snowCap);
      }
    }
  } else if (type === 'banyan') {
    // Ancient Jungle Canopy Banyan Tree with flared roots and multi-dome crown
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.78, 3.6, 10), mat.woodMaterial);
    trunk.position.y = 1.8;
    trunk.castShadow = true;
    group.add(trunk);

    const canopyOffsets = [
      { x: 0, y: 4.1, z: 0, r: 1.95 },
      { x: 1.2, y: 3.6, z: 0.8, r: 1.45 },
      { x: -1.1, y: 3.5, z: -0.9, r: 1.5 },
      { x: -0.8, y: 3.8, z: 1.1, r: 1.35 },
    ];
    for (const co of canopyOffsets) {
      const dome = new THREE.Mesh(new THREE.DodecahedronGeometry(co.r, 1), mat.foliageGreen);
      dome.scale.set(1.15, 0.72, 1.15);
      dome.position.set(co.x, co.y, co.z);
      dome.castShadow = true;
      group.add(dome);
    }
  } else if (type === 'shrub') {
    // Lush 3D Bush Shrub with Prehistoric Berries
    for (let b = 0; b < 3; b++) {
      const bush = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.68 - b * 0.1, 1),
        b % 2 === 0 ? mat.shrubLeafMaterial : mat.foliageGreen
      );
      bush.position.set((b - 1) * 0.38, 0.45 + (b % 2) * 0.12, (b % 2) * 0.25);
      bush.scale.set(1.1, 0.82, 1.1);
      bush.castShadow = true;
      group.add(bush);
    }
    for (let r = 0; r < 5; r++) {
      const berry = new THREE.Mesh(new THREE.SphereGeometry(0.075, 6, 6), mat.tribalClothRed);
      const a = (r / 5) * Math.PI * 2;
      berry.position.set(Math.cos(a) * 0.55, 0.58, Math.sin(a) * 0.55);
      group.add(berry);
    }
  } else if (type === 'grass') {
    // Multi-blade 3D swaying grass tuft
    for (let g = 0; g < 9; g++) {
      const angle = (g / 9) * Math.PI * 2;
      const dist = (g % 3) * 0.14;
      const h = 0.65 + (g % 4) * 0.18;
      const blade = new THREE.Mesh(new THREE.ConeGeometry(0.07, h, 4), mat.grassBladeMaterial);
      blade.position.set(Math.cos(angle) * dist, h * 0.45, Math.sin(angle) * dist);
      blade.rotation.z = Math.cos(angle) * 0.28;
      blade.rotation.x = Math.sin(angle) * 0.28;
      group.add(blade);
    }
  } else if (type === 'reed') {
    // Tall riverbank cattail reeds
    for (let r = 0; r < 6; r++) {
      const xOff = (r - 2.5) * 0.14;
      const zOff = ((r * 3) % 4) * 0.1;
      const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 1.55, 6), mat.foliageGreen);
      stalk.position.set(xOff, 0.75, zOff);
      group.add(stalk);
      if (r % 2 === 0) {
        const cattail = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.32, 6), mat.woodMaterial);
        cattail.position.set(xOff, 1.35, zOff);
        group.add(cattail);
      }
    }
  } else if (type === 'fern') {
    for (let i = 0; i < 7; i++) {
      const angle = (i / 7) * Math.PI * 2;
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.28, 1.25, 4), mat.foliageGreen);
      leaf.position.set(Math.cos(angle) * 0.42, 0.38, Math.sin(angle) * 0.42);
      leaf.rotation.z = -Math.cos(angle) * 0.95;
      leaf.rotation.x = Math.sin(angle) * 0.95;
      group.add(leaf);
    }
  } else if (type === 'boulder' || type === 'snow_boulder') {
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(1.25, 1), mat.stoneMaterial);
    rock.scale.set(1.25, 0.82, 1.05);
    rock.position.y = 0.55;
    rock.castShadow = true;
    rock.receiveShadow = true;
    group.add(rock);

    const subRock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.72, 0), mat.stoneMaterial);
    subRock.position.set(0.95, 0.35, 0.45);
    group.add(subRock);

    if (type === 'snow_boulder') {
      const snowCap = new THREE.Mesh(new THREE.DodecahedronGeometry(1.05, 1), mat.snowMaterial);
      snowCap.scale.set(1.2, 0.45, 0.98);
      snowCap.position.set(0, 0.92, 0);
      group.add(snowCap);
    }
  } else if (type === 'river_stone') {
    // Cluster of smooth water-worn river cobbles
    const offsets = [
      { x: 0, z: 0, rx: 0.95, ry: 0.42, rz: 0.78 },
      { x: 0.65, z: 0.35, rx: 0.58, ry: 0.32, rz: 0.52 },
      { x: -0.55, z: 0.28, rx: 0.48, ry: 0.28, rz: 0.45 },
    ];
    for (const o of offsets) {
      const cobble = new THREE.Mesh(new THREE.SphereGeometry(0.65, 10, 8), mat.riverStoneMaterial);
      cobble.scale.set(o.rx, o.ry, o.rz);
      cobble.position.set(o.x, o.ry * 0.35, o.z);
      cobble.receiveShadow = true;
      group.add(cobble);
    }
  } else if (type === 'crystal' || type === 'ice_crystal') {
    const crystalMat = type === 'ice_crystal' ? mat.glacierIceMaterial : mat.focusClueGlow;
    for (let i = 0; i < 4; i++) {
      const shard = new THREE.Mesh(new THREE.OctahedronGeometry(0.45, 0), crystalMat);
      shard.scale.set(0.6, 2.35, 0.6);
      shard.position.set((i - 1.5) * 0.28, 0.85, (i % 2) * 0.22);
      shard.rotation.z = (i - 1.5) * 0.24;
      group.add(shard);
    }
  } else if (type === 'spire') {
    const spire = new THREE.Mesh(new THREE.ConeGeometry(1.15, 4.6, 6), mat.obsidianMaterial);
    spire.position.y = 2.3;
    spire.castShadow = true;
    group.add(spire);
  }

  group.scale.setScalar(scale);
  return group;
}

/**
 * Builds a complete standalone 3D Environment Showcase Diorama for the Beastopedia / 3D World Atlas Modal.
 */
export function buildEnvironmentShowcaseModel(id: EnvironmentModelId, mat: MaterialCache): THREE.Group {
  const group = new THREE.Group();

  if (id === 'snow_mountain') {
    const mountain = buildSnowMountainPeakModel(mat, 0.16);
    mountain.position.set(0, -1.1, 0);
    group.add(mountain);
    const pineL = buildFoliageModel('snow_pine', mat, 0.38);
    pineL.position.set(-1.35, -0.9, 0.9);
    const pineR = buildFoliageModel('snow_pine', mat, 0.34);
    pineR.position.set(1.25, -0.9, 0.8);
    group.add(pineL, pineR);
  } else if (id === 'river_ocean') {
    const waterBase = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.1, 0.28, 24), mat.waterMaterial);
    waterBase.position.set(0, -0.8, 0);
    group.add(waterBase);

    const bridge = buildRiverBridgeModel(mat);
    bridge.scale.setScalar(0.24);
    bridge.position.set(0, -0.72, 0);
    group.add(bridge);

    const stoneL = buildFoliageModel('river_stone', mat, 0.55);
    stoneL.position.set(-1.2, -0.68, 0.8);
    const reedR = buildFoliageModel('reed', mat, 0.65);
    reedR.position.set(1.2, -0.68, -0.7);
    const fish = buildRiverFishModel(mat, 0.65);
    fish.position.set(0.65, -0.58, 0.65);
    group.add(stoneL, reedR, fish);
  } else if (id === 'trees_canopy') {
    const banyan = buildFoliageModel('banyan', mat, 0.42);
    banyan.position.set(-0.95, -0.9, -0.2);
    const snowPine = buildFoliageModel('snow_pine', mat, 0.45);
    snowPine.position.set(0.15, -0.9, 0.4);
    const palm = buildFoliageModel('palm', mat, 0.42);
    palm.position.set(1.1, -0.9, -0.2);
    group.add(banyan, snowPine, palm);
  } else if (id === 'stones_boulders') {
    const snowB = buildFoliageModel('snow_boulder', mat, 0.62);
    snowB.position.set(-0.85, -0.85, 0);
    const riverS = buildFoliageModel('river_stone', mat, 0.85);
    riverS.position.set(0.75, -0.85, 0.55);
    const iceC = buildFoliageModel('ice_crystal', mat, 0.68);
    iceC.position.set(0.35, -0.85, -0.65);
    group.add(snowB, riverS, iceC);
  } else if (id === 'grass_shrubs') {
    const shrub = buildFoliageModel('shrub', mat, 0.85);
    shrub.position.set(-0.65, -0.85, 0.2);
    const grass = buildFoliageModel('grass', mat, 1.15);
    grass.position.set(0.65, -0.85, 0.45);
    const fern = buildFoliageModel('fern', mat, 0.85);
    fern.position.set(0.1, -0.85, -0.65);
    const reed = buildFoliageModel('reed', mat, 0.78);
    reed.position.set(-0.95, -0.85, -0.55);
    group.add(shrub, grass, fern, reed);
  } else if (id === 'river_fish') {
    const f1 = buildRiverFishModel(mat, 1.35);
    f1.position.set(0, 0.25, 0);
    const f2 = buildRiverFishModel(mat, 0.95);
    f2.position.set(-0.95, -0.25, -0.45);
    f2.rotation.y = 0.35;
    const f3 = buildRiverFishModel(mat, 0.85);
    f3.position.set(0.9, -0.35, 0.4);
    f3.rotation.y = -0.3;
    group.add(f1, f2, f3);
  }

  return group;
}

/**
 * Builds the Campfire Haven Workbench landmark with warm flickering illumination and contact shadows.
 */
export function buildCampfireWorkbench(mat: MaterialCache): THREE.Group {
  const group = new THREE.Group();

  // Soft Contact Shadow under the Campfire Ring
  const fireShadow = new THREE.Mesh(
    new THREE.CircleGeometry(2.1, 24),
    mat.contactShadowMaterial
  );
  fireShadow.rotation.x = -Math.PI / 2;
  fireShadow.position.set(0, 0.02, 0);
  group.add(fireShadow);

  // Glowing Warm Ember Bed Disc
  const emberBed = new THREE.Mesh(
    new THREE.CircleGeometry(0.92, 18),
    new THREE.MeshStandardMaterial({
      color: 0xea580c,
      emissive: 0xdc2626,
      emissiveIntensity: 1.4,
      roughness: 0.6,
    })
  );
  emberBed.rotation.x = -Math.PI / 2;
  emberBed.position.set(0, 0.04, 0);
  group.add(emberBed);

  // Ring of stones with warm inner rim
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(0.32, 1), mat.stoneMaterial);
    stone.position.set(Math.cos(a) * 1.15, 0.18, Math.sin(a) * 1.15);
    stone.scale.set(1.15, 0.78, 1.05);
    stone.rotation.y = a;
    stone.castShadow = true;
    stone.receiveShadow = true;
    group.add(stone);
  }

  // Charred Split Logs & Multi-Layer Flickering Fire Cones
  for (let i = 0; i < 4; i++) {
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 1.55, 8), mat.woodMaterial);
    log.rotation.z = Math.PI / 2 - 0.18;
    log.rotation.y = (i / 4) * Math.PI;
    log.position.y = 0.2;
    log.castShadow = true;
    group.add(log);
  }

  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.52, 1.35, 8), mat.lavaMaterial);
  flame.position.y = 0.7;
  flame.name = 'campfire_flame';
  group.add(flame);

  const innerFlame = new THREE.Mesh(
    new THREE.ConeGeometry(0.28, 0.95, 7),
    new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: 0xfacc15,
      emissiveIntensity: 2.0,
      roughness: 0.1,
    })
  );
  innerFlame.position.set(0, 0.58, 0);
  innerFlame.name = 'campfire_flame_inner';
  group.add(innerFlame);

  const fireLight = new THREE.PointLight(0xff7b24, 5.2, 22, 1.6);
  fireLight.position.set(0, 1.65, 0);
  fireLight.name = 'campfire_light';
  group.add(fireLight);

  // Crafting Workbench Rack & Anvil beside fire with Contact Shadow
  const benchShadow = new THREE.Mesh(
    new THREE.CircleGeometry(1.65, 18),
    mat.contactShadowMaterial
  );
  benchShadow.rotation.x = -Math.PI / 2;
  benchShadow.position.set(2.8, 0.025, -0.8);
  group.add(benchShadow);

  // Sculpted Timber Workbench with Legs, Crossbars & Tool Rack
  const tableTop = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.16, 1.05), mat.woodMaterial);
  tableTop.position.set(2.8, 0.84, -0.8);
  tableTop.castShadow = true;
  tableTop.receiveShadow = true;
  group.add(tableTop);

  for (const lx of [-0.8, 0.8]) {
    for (const lz of [-0.4, 0.4]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.82, 0.16), mat.woodMaterial);
      leg.position.set(2.8 + lx, 0.41, -0.8 + lz);
      leg.castShadow = true;
      group.add(leg);
    }
  }

  const anvilBase = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.26, 0.42), mat.stoneMaterial);
  anvilBase.position.set(2.8, 1.05, -0.8);
  group.add(anvilBase);

  const anvilHorn = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.24, 0.36), mat.obsidianMaterial);
  anvilHorn.position.set(2.8, 1.28, -0.8);
  anvilHorn.castShadow = true;
  group.add(anvilHorn);

  // Tribal Tents / Canopy Shelter behind campfire
  const tentShadow = new THREE.Mesh(
    new THREE.CircleGeometry(2.6, 20),
    mat.contactShadowMaterial
  );
  tentShadow.rotation.x = -Math.PI / 2;
  tentShadow.position.set(-3.4, 0.025, -2.5);
  group.add(tentShadow);

  const tent = new THREE.Mesh(new THREE.ConeGeometry(2.4, 2.8, 7), mat.woodMaterial);
  tent.position.set(-3.4, 1.4, -2.5);
  tent.castShadow = true;
  tent.receiveShadow = true;
  group.add(tent);

  return group;
}

/**
 * Builds the Ancient Signal Tower landmark at the center of the island.
 */
export function buildSignalTower(mat: MaterialCache, stage: number, beaconLit: boolean): THREE.Group {
  const group = new THREE.Group();

  const base = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 4.0, 2.5, 8), mat.stoneMaterial);
  base.position.y = 1.25;
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);

  const mid = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.9, 4.5, 8), mat.stoneMaterial);
  mid.position.y = 4.75;
  mid.castShadow = true;
  group.add(mid);

  const brazier = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 1.6, 1.2, 8), mat.obsidianMaterial);
  brazier.position.y = 7.5;
  group.add(brazier);

  if (beaconLit || stage >= 3) {
    const beaconFire = new THREE.Mesh(new THREE.ConeGeometry(1.8, 5.5, 10), mat.lavaMaterial);
    beaconFire.position.y = 10.5;
    beaconFire.name = 'tower_beacon_flame';
    group.add(beaconFire);

    const beaconLight = new THREE.PointLight(0xf97316, 8, 60);
    beaconLight.position.set(0, 12, 0);
    group.add(beaconLight);
  }

  return group;
}
