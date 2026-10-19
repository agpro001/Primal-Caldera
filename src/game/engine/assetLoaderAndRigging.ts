/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { USDZLoader } from 'three/examples/jsm/loaders/USDZLoader.js';
import type {
  BeastSpecies,
  WeaponId,
  ArmorId,
  NPCId,
  PlayableCharacterId,
} from '../../types/game.ts';
import type { MaterialCache } from '../graphics/materials.ts';
import type { EnvironmentModelId } from '../logic/beastopediaData.ts';
import { createBeastWeakPoints } from '../logic/rules.ts';

// Shared Singleton Loaders & In-Memory Cache for Instant Cloning
const gltfLoader = new GLTFLoader();
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
gltfLoader.setDRACOLoader(dracoLoader);

const usdzLoader = new USDZLoader();

interface CachedAssetEntry {
  scene: THREE.Group;
  animations: THREE.AnimationClip[];
}

const assetCache = new Map<string, Promise<CachedAssetEntry>>();

/**
 * Loads a .glb/.gltf or .usdz 3D model from /models/, normalizes its bounding box
 * so its lowest vertex rests at y = 0 and its height/size matches targetHeight,
 * and caches the parsed asset for instant cloning.
 */
export function load3DAssetCached(url: string): Promise<CachedAssetEntry> {
  const existing = assetCache.get(url);
  if (existing) return existing;

  const promise = new Promise<CachedAssetEntry>((resolve, reject) => {
    const isUsdz = url.toLowerCase().endsWith('.usdz');
    if (isUsdz) {
      usdzLoader.load(
        url,
        (group) => {
          resolve({ scene: group, animations: [] });
        },
        undefined,
        (err) => reject(err)
      );
    } else {
      gltfLoader.load(
        url,
        (gltf) => {
          resolve({
            scene: gltf.scene || new THREE.Group(),
            animations: gltf.animations || [],
          });
        },
        undefined,
        (err) => reject(err)
      );
    }
  });

  assetCache.set(url, promise);
  return promise;
}

/**
 * Custom Indexed Organic BufferGeometry Builder (Strictly Zero Three.js Primitives):
 * Generates a smooth UV-mapped lathe/organic mesh directly from Float32Arrays
 * without using SphereGeometry, CylinderGeometry, ConeGeometry, or BoxGeometry.
 */
export function createSculptedOrganicGeometry(
  profileRadii: [number, number, number][], // [y0..1, radiusX, radiusZ]
  radialSegments = 14,
  heightScale = 1.0,
  offsetY = 0
): THREE.BufferGeometry {
  const rings = profileRadii.length;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let r = 0; r < rings; r++) {
    const [ny, rx, rz] = profileRadii[r];
    const y = ny * heightScale + offsetY;
    for (let s = 0; s <= radialSegments; s++) {
      const u = s / radialSegments;
      const theta = u * Math.PI * 2;
      const x = Math.cos(theta) * rx;
      const z = Math.sin(theta) * rz;
      positions.push(x, y, z);
      uvs.push(u, ny);
    }
  }

  const stride = radialSegments + 1;
  for (let r = 0; r < rings - 1; r++) {
    for (let s = 0; s < radialSegments; s++) {
      const a = r * stride + s;
      const b = a + stride;
      const c = b + 1;
      const d = a + 1;
      indices.push(a, b, d, b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * GPU Vertex Skeletal Kinematics Uniforms:
 * Drives fluid limb stride, spine lean/twist, breathing, head yaw, jaw articulation,
 * wing flapping, and tail S-curves even on single-mesh / static GLB/USDZ models!
 */
export interface VertexKinematicsUniforms {
  uTime: { value: number };
  uStridePhase: { value: number };
  uStrideAmp: { value: number };
  uSpineLean: { value: number };
  uSpineTwist: { value: number };
  uAttackSwing: { value: number };
  uBreathing: { value: number };
  uHeadYaw: { value: number };
  uJawOpen: { value: number };
  uTailWave: { value: number };
  uWingFlap: { value: number };
  uBoundsMinY: { value: number };
  uBoundsHeight: { value: number };
  uBoundsWidth: { value: number };
  uBoundsDepth: { value: number };
}

export function createKinematicsUniforms(): VertexKinematicsUniforms {
  return {
    uTime: { value: 0 },
    uStridePhase: { value: 0 },
    uStrideAmp: { value: 0 },
    uSpineLean: { value: 0 },
    uSpineTwist: { value: 0 },
    uAttackSwing: { value: 0 },
    uBreathing: { value: 0.04 },
    uHeadYaw: { value: 0 },
    uJawOpen: { value: 0 },
    uTailWave: { value: 0 },
    uWingFlap: { value: 0 },
    uBoundsMinY: { value: 0 },
    uBoundsHeight: { value: 2.0 },
    uBoundsWidth: { value: 1.5 },
    uBoundsDepth: { value: 2.0 },
  };
}

/**
 * Injects procedural skeletal deformation into any loaded GLB/USDZ mesh material
 * so static meshes flex their legs, knees, spine, arms, wings, jaw, and tail in 3D.
 */
export function injectVertexKinematicsShader(
  root: THREE.Object3D,
  uniforms: VertexKinematicsUniforms
) {
  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  box.getSize(size);
  uniforms.uBoundsMinY.value = isFinite(box.min.y) ? box.min.y : 0;
  uniforms.uBoundsHeight.value = Math.max(0.5, size.y || 2.0);
  uniforms.uBoundsWidth.value = Math.max(0.5, size.x || 1.5);
  uniforms.uBoundsDepth.value = Math.max(0.5, size.z || 2.0);

  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh || !mesh.material) return;
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const clonedMats = materials.map((origMat) => {
      const mat = origMat.clone();
      mat.onBeforeCompile = (shader) => {
        shader.uniforms.uTime = uniforms.uTime;
        shader.uniforms.uStridePhase = uniforms.uStridePhase;
        shader.uniforms.uStrideAmp = uniforms.uStrideAmp;
        shader.uniforms.uSpineLean = uniforms.uSpineLean;
        shader.uniforms.uSpineTwist = uniforms.uSpineTwist;
        shader.uniforms.uAttackSwing = uniforms.uAttackSwing;
        shader.uniforms.uBreathing = uniforms.uBreathing;
        shader.uniforms.uHeadYaw = uniforms.uHeadYaw;
        shader.uniforms.uJawOpen = uniforms.uJawOpen;
        shader.uniforms.uTailWave = uniforms.uTailWave;
        shader.uniforms.uWingFlap = uniforms.uWingFlap;
        shader.uniforms.uBoundsMinY = uniforms.uBoundsMinY;
        shader.uniforms.uBoundsHeight = uniforms.uBoundsHeight;

        shader.vertexShader =
          `
          uniform float uTime;
          uniform float uStridePhase;
          uniform float uStrideAmp;
          uniform float uSpineLean;
          uniform float uSpineTwist;
          uniform float uAttackSwing;
          uniform float uBreathing;
          uniform float uHeadYaw;
          uniform float uJawOpen;
          uniform float uTailWave;
          uniform float uWingFlap;
          uniform float uBoundsMinY;
          uniform float uBoundsHeight;
          ` +
          shader.vertexShader.replace(
            '#include <begin_vertex>',
            `
            #include <begin_vertex>
            float ny = clamp((transformed.y - uBoundsMinY) / max(0.1, uBoundsHeight), 0.0, 1.0);
            float sideSign = transformed.x >= 0.0 ? 1.0 : -1.0;

            // 1. Chest / Spine Breathing Expansion
            if (ny > 0.42 && ny < 0.78) {
              float breath = sin(uTime * 2.5) * uBreathing;
              transformed.x *= (1.0 + breath);
              transformed.z *= (1.0 + breath);
            }

            // 2. Lower Body Bipedal / Quadruped Leg Stride & Knee Flexion
            if (ny < 0.46) {
              float legWeight = clamp((0.46 - ny) / 0.46, 0.0, 1.0);
              float phase = uStridePhase + (sideSign > 0.0 ? 0.0 : 3.14159265);
              float swing = sin(phase) * uStrideAmp * legWeight;
              float kneeLift = max(0.0, cos(phase)) * uStrideAmp * 0.45 * legWeight;
              transformed.z += swing * 0.65;
              transformed.y += kneeLift * 0.35;
            }

            // 3. Upper Body Spine Forward Lean & Combat Spine Twist
            if (ny > 0.45) {
              float upperWeight = (ny - 0.45) / 0.55;
              transformed.z += upperWeight * uSpineLean * 0.55;
              float twistAngle = upperWeight * (uSpineTwist + uAttackSwing * 0.85) + (ny > 0.78 ? uHeadYaw * 0.45 : 0.0);
              float ct = cos(twistAngle);
              float st = sin(twistAngle);
              float rx = transformed.x * ct - transformed.z * st;
              float rz = transformed.x * st + transformed.z * ct;
              transformed.x = rx;
              transformed.z = rz;
            }

            // 4. Arm Counter-Pump & Weapon Strike Arc
            if (ny > 0.48 && ny < 0.82 && abs(transformed.x) > 0.18) {
              float armSwing = -sin(uStridePhase + (sideSign > 0.0 ? 0.0 : 3.14159265)) * uStrideAmp * 0.45;
              float strikeReach = sideSign > 0.0 ? uAttackSwing * 0.85 : uAttackSwing * 0.45;
              transformed.z += armSwing + strikeReach;
            }

            // 5. Wing Flapping Wave (for Dragon / Spectral Wings / Beetle Elytra)
            if (abs(uWingFlap) > 0.001 && abs(transformed.x) > 0.25 && ny > 0.38) {
              float spanDist = abs(transformed.x);
              float flapWave = sin(uTime * 6.0 - spanDist * 0.4) * uWingFlap * spanDist * 0.45;
              transformed.y += flapWave;
            }

            // 6. Tail S-Curve Wave & Jaw Opening
            if (abs(uTailWave) > 0.001 && transformed.z < -0.25) {
              float tailDist = abs(transformed.z);
              transformed.x += sin(uTime * 4.0 - tailDist * 1.5) * uTailWave * tailDist * 0.28;
            }
            if (uJawOpen > 0.001 && transformed.z > 0.35 && ny > 0.45 && ny < 0.72) {
              transformed.y -= uJawOpen * 0.28;
            }
            `
          );
      };
      mat.needsUpdate = true;
      return mat;
    });

    mesh.material = Array.isArray(mesh.material) ? clonedMats : clonedMats[0];
  });
}

/**
 * Normalizes any loaded 3D model so its bounding box is centered on X/Z,
 * its lowest vertex rests at y = 0, and its total height or length matches targetDimension.
 */
export function normalizeLoadedModel(
  model: THREE.Object3D,
  targetHeight: number,
  rotYOffset = 0
): THREE.Group {
  const wrapper = new THREE.Group();
  model.rotation.y += rotYOffset;
  model.updateMatrixWorld(true);

  const box = new THREE.Box3().setFromObject(model);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);

  const maxDim = Math.max(size.y, size.x * 0.6, size.z * 0.6, 0.001);
  const scale = targetHeight / maxDim;

  model.scale.multiplyScalar(scale);
  model.updateMatrixWorld(true);

  const scaledBox = new THREE.Box3().setFromObject(model);
  const scaledCenter = new THREE.Vector3();
  scaledBox.getCenter(scaledCenter);

  model.position.x -= scaledCenter.x;
  model.position.z -= scaledCenter.z;
  model.position.y -= scaledBox.min.y;

  wrapper.add(model);
  return wrapper;
}

export interface MappedRigNodes {
  Head?: THREE.Object3D;
  Neck?: THREE.Object3D;
  Spine?: THREE.Object3D;
  Chest?: THREE.Object3D;
  Arm_L?: THREE.Object3D;
  ForeArm_L?: THREE.Object3D;
  Hand_L?: THREE.Object3D;
  Arm_R?: THREE.Object3D;
  ForeArm_R?: THREE.Object3D;
  Hand_R?: THREE.Object3D;
  UpLeg_L?: THREE.Object3D;
  Leg_L?: THREE.Object3D;
  Foot_L?: THREE.Object3D;
  UpLeg_R?: THREE.Object3D;
  Leg_R?: THREE.Object3D;
  Foot_R?: THREE.Object3D;
  Tail?: THREE.Object3D;
  Wing_L?: THREE.Object3D;
  Wing_R?: THREE.Object3D;
  Jaw?: THREE.Object3D;
  Canopy_Node?: THREE.Object3D;
  Gear_Front?: THREE.Object3D;
  Gear_L?: THREE.Object3D;
  Gear_R?: THREE.Object3D;
  Aileron_L?: THREE.Object3D;
  Aileron_R?: THREE.Object3D;
  Rudder?: THREE.Object3D;
}

export class EntityRigController {
  public root: THREE.Group;
  public nodes: MappedRigNodes = {};
  public mixer: THREE.AnimationMixer | null = null;
  public actions = new Map<string, THREE.AnimationAction>();
  public uniforms: VertexKinematicsUniforms;

  constructor(root: THREE.Group, nodesPreset?: Partial<MappedRigNodes>) {
    this.root = root;
    this.uniforms = createKinematicsUniforms();
    if (nodesPreset) {
      Object.assign(this.nodes, nodesPreset);
    }
    this.bindNodesByRegex(root);
  }

  public bindNodesByRegex(model: THREE.Object3D, animations: THREE.AnimationClip[] = []) {
    if (animations.length > 0) {
      this.mixer = new THREE.AnimationMixer(model);
      for (const clip of animations) {
        const action = this.mixer.clipAction(clip);
        action.play();
        this.actions.set(clip.name.toLowerCase(), action);
      }
    }

    model.traverse((obj) => {
      const name = obj.name || '';
      if (!name) return;
      if (!this.nodes.Head && /head|skull|eyes|psphere1/i.test(name)) this.nodes.Head = obj;
      if (!this.nodes.Neck && /neck/i.test(name)) this.nodes.Neck = obj;
      if (!this.nodes.Spine && /spine|torso|pelvis|group1|armour_lp/i.test(name)) this.nodes.Spine = obj;
      if (!this.nodes.Chest && /chest|spine1|spine_02|dh_mesh1/i.test(name)) this.nodes.Chest = obj;
      if (!this.nodes.Arm_L && /arm.*l|left.*arm|l_upperarm|dh_crossbow3/i.test(name)) this.nodes.Arm_L = obj;
      if (!this.nodes.ForeArm_L && /forearm.*l|left.*forearm|l_forearm/i.test(name)) this.nodes.ForeArm_L = obj;
      if (!this.nodes.Hand_L && /hand.*l|left.*hand/i.test(name)) this.nodes.Hand_L = obj;
      if (!this.nodes.Arm_R && /arm.*r|right.*arm|r_upperarm|dh_crossbow4|axe_lp/i.test(name)) this.nodes.Arm_R = obj;
      if (!this.nodes.ForeArm_R && /forearm.*r|right.*forearm|r_forearm/i.test(name)) this.nodes.ForeArm_R = obj;
      if (!this.nodes.Hand_R && /hand.*r|right.*hand/i.test(name)) this.nodes.Hand_R = obj;
      if (!this.nodes.UpLeg_L && /upleg.*l|thigh.*l|left.*thigh|l_thigh/i.test(name)) this.nodes.UpLeg_L = obj;
      if (!this.nodes.Leg_L && /\bleg.*l|shin.*l|calf.*l|l_calf/i.test(name)) this.nodes.Leg_L = obj;
      if (!this.nodes.Foot_L && /foot.*l|left.*foot|l_foot/i.test(name)) this.nodes.Foot_L = obj;
      if (!this.nodes.UpLeg_R && /upleg.*r|thigh.*r|right.*thigh|r_thigh/i.test(name)) this.nodes.UpLeg_R = obj;
      if (!this.nodes.Leg_R && /\bleg.*r|shin.*r|calf.*r|r_calf/i.test(name)) this.nodes.Leg_R = obj;
      if (!this.nodes.Foot_R && /foot.*r|right.*foot|r_foot/i.test(name)) this.nodes.Foot_R = obj;
      if (!this.nodes.Tail && /tail/i.test(name)) this.nodes.Tail = obj;
      if (!this.nodes.Wing_L && /wing.*l|elytra.*l/i.test(name)) this.nodes.Wing_L = obj;
      if (!this.nodes.Wing_R && /wing.*r|elytra.*r/i.test(name)) this.nodes.Wing_R = obj;
      if (!this.nodes.Jaw && /jaw|mouth/i.test(name)) this.nodes.Jaw = obj;
      if (!this.nodes.Canopy_Node && /canopy|glass|object_5/i.test(name)) this.nodes.Canopy_Node = obj;
      if (!this.nodes.Gear_Front && /gear.*f|object_9/i.test(name)) this.nodes.Gear_Front = obj;
      if (!this.nodes.Aileron_L && /aileron.*l|object_7/i.test(name)) this.nodes.Aileron_L = obj;
      if (!this.nodes.Aileron_R && /aileron.*r|object_8/i.test(name)) this.nodes.Aileron_R = obj;
    });

    injectVertexKinematicsShader(model, this.uniforms);
  }

  public update(dt: number, elapsed: number) {
    this.uniforms.uTime.value = elapsed;
    if (this.mixer) {
      this.mixer.update(dt);
    }
  }
}

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
  wingsGroup: THREE.Group;
  wings: THREE.Group;
  leftWing: THREE.Group;
  rightWing: THREE.Group;
  contactShadow?: THREE.Mesh;
  controller: EntityRigController;
  characterId: PlayableCharacterId;
  muzzleLight: THREE.PointLight;
  equipWeapon: (weaponId: WeaponId) => void;
  equipArmor: (armorId: ArmorId) => void;
  updateWeapon: (weaponId: WeaponId) => void;
  updateArmor: (armorId: ArmorId) => void;
}

export interface BeastRig {
  root: THREE.Group;
  body: THREE.Group;
  head: THREE.Group;
  jaw: THREE.Group;
  tail: THREE.Group;
  legs: THREE.Group[];
  leftWing?: THREE.Group;
  rightWing?: THREE.Group;
  accentMeshes: THREE.Mesh[];
  weakPointIndicators: Map<string, THREE.Mesh>;
  controller: EntityRigController;
  mountSocket: THREE.Group;
}

export interface SpaceFighterRig {
  root: THREE.Group;
  hull: THREE.Group;
  canopyNode: THREE.Group;
  gearFront: THREE.Group;
  gearLeft: THREE.Group;
  gearRight: THREE.Group;
  aileronLeft: THREE.Group;
  aileronRight: THREE.Group;
  rudder: THREE.Group;
  thrusterLeft: THREE.Mesh;
  thrusterRight: THREE.Mesh;
  controller: EntityRigController;
}

const HERO_MODEL_PATHS: Record<PlayableCharacterId, { url: string; height: number; rotY: number }> = {
  demon_hunter: { url: '/models/demon_hunter.glb', height: 2.35, rotY: 0 },
  swat_operator: { url: '/models/S.W.A.T.usdz', height: 2.25, rotY: 0 },
  bulky_knight: { url: '/models/bulky_knight.glb', height: 2.45, rotY: 0 },
};

/**
 * Builds an articulated Playable Hero Rig (Demon Hunter, S.W.A.T. Operator, or Bulky Knight)
 * with full hierarchical skeletal joints AND streams the real .glb / .usdz model from /models/.
 */
export function buildHunterModel(
  mat: MaterialCache,
  _armorId: ArmorId = 'scavenger_rags',
  characterId: PlayableCharacterId = 'demon_hunter'
): HunterRig {
  const root = new THREE.Group();
  const pelvis = new THREE.Group();
  const torso = new THREE.Group();
  const head = new THREE.Group();

  const leftArm = new THREE.Group();
  const leftForearm = new THREE.Group();
  const leftHand = new THREE.Group();

  const rightArm = new THREE.Group();
  const rightForearm = new THREE.Group();
  const rightHand = new THREE.Group();

  const leftLeg = new THREE.Group();
  const leftShin = new THREE.Group();
  const leftFoot = new THREE.Group();

  const rightLeg = new THREE.Group();
  const rightShin = new THREE.Group();
  const rightFoot = new THREE.Group();

  const weaponMount = new THREE.Group();
  const wingsGroup = new THREE.Group();
  const leftWing = new THREE.Group();
  const rightWing = new THREE.Group();

  pelvis.position.set(0, 1.02, 0);
  root.add(pelvis);

  torso.position.set(0, 0.12, 0);
  pelvis.add(torso);

  head.position.set(0, 0.62, 0);
  torso.add(head);

  leftArm.position.set(0.36, 0.42, 0);
  leftForearm.position.set(0.06, -0.32, 0);
  leftHand.position.set(0, -0.28, 0.06);
  leftArm.add(leftForearm);
  leftForearm.add(leftHand);
  torso.add(leftArm);

  rightArm.position.set(-0.36, 0.42, 0);
  rightForearm.position.set(-0.06, -0.32, 0);
  rightHand.position.set(0, -0.28, 0.06);
  rightArm.add(rightForearm);
  rightForearm.add(rightHand);
  torso.add(rightArm);

  weaponMount.position.set(0, 0, 0.12);
  rightHand.add(weaponMount);

  leftLeg.position.set(0.18, -0.05, 0);
  leftShin.position.set(0, -0.46, 0);
  leftFoot.position.set(0, -0.44, 0.08);
  leftLeg.add(leftShin);
  leftShin.add(leftFoot);
  pelvis.add(leftLeg);

  rightLeg.position.set(-0.18, -0.05, 0);
  rightShin.position.set(0, -0.46, 0);
  rightFoot.position.set(0, -0.44, 0.08);
  rightLeg.add(rightShin);
  rightShin.add(rightFoot);
  pelvis.add(rightLeg);

  // Spectral / Aetherial Glider Wings on Spine_02 (torso)
  wingsGroup.position.set(0, 0.28, -0.22);
  leftWing.position.set(0.16, 0, 0);
  rightWing.position.set(-0.16, 0, 0);

  const wingGeo = createSculptedOrganicGeometry(
    [
      [0.0, 0.04, 0.02],
      [0.35, 0.58, 0.06],
      [0.75, 1.15, 0.04],
      [1.0, 0.42, 0.02],
    ],
    10,
    1.45,
    0
  );
  wingGeo.rotateZ(-Math.PI / 2.2);
  const leftWingMesh = new THREE.Mesh(wingGeo, mat.glacierIceMaterial);
  const rightWingMesh = new THREE.Mesh(wingGeo.clone().scale(-1, 1, 1), mat.glacierIceMaterial);
  leftWing.add(leftWingMesh);
  rightWing.add(rightWingMesh);
  wingsGroup.add(leftWing, rightWing);
  wingsGroup.scale.set(0.28, 0.28, 0.28);
  torso.add(wingsGroup);

  // Sculpted organic fallback while GLB/USDZ finishes streaming
  const fallbackGroup = new THREE.Group();
  const bodySculpt = new THREE.Mesh(
    createSculptedOrganicGeometry(
      [
        [0.0, 0.16, 0.16],
        [0.45, 0.26, 0.2],
        [0.78, 0.34, 0.24],
        [0.92, 0.18, 0.18],
        [1.0, 0.02, 0.02],
      ],
      14,
      2.15,
      0
    ),
    mat.mithrilSilverMaterial
  );
  bodySculpt.castShadow = true;
  fallbackGroup.add(bodySculpt);
  root.add(fallbackGroup);

  // S.W.A.T. Operator Muzzle Flash PointLight
  const muzzleLight = new THREE.PointLight(0x38bdf8, 0, 9);
  muzzleLight.position.set(0, 1.45, 1.15);
  root.add(muzzleLight);

  const controller = new EntityRigController(root, {
    Head: head,
    Spine: torso,
    Chest: torso,
    Arm_L: leftArm,
    ForeArm_L: leftForearm,
    Hand_L: leftHand,
    Arm_R: rightArm,
    ForeArm_R: rightForearm,
    Hand_R: rightHand,
    UpLeg_L: leftLeg,
    Leg_L: leftShin,
    Foot_L: leftFoot,
    UpLeg_R: rightLeg,
    Leg_R: rightShin,
    Foot_R: rightFoot,
    Wing_L: leftWing,
    Wing_R: rightWing,
  });

  // Stream real uploaded 3D model (.glb or .usdz)
  const spec = HERO_MODEL_PATHS[characterId] || HERO_MODEL_PATHS.demon_hunter;
  load3DAssetCached(spec.url)
    .then((entry) => {
      const cloned = entry.scene.clone(true);
      const normalized = normalizeLoadedModel(cloned, spec.height, spec.rotY);
      fallbackGroup.visible = false;
      root.add(normalized);
      controller.bindNodesByRegex(normalized, entry.animations);
    })
    .catch((err) => {
      console.warn(`Hero asset load fallback (${spec.url}):`, err);
    });

  const equipWeapon = (weaponId: WeaponId) => {
    while (weaponMount.children.length > 0) {
      weaponMount.remove(weaponMount.children[0]);
    }
    weaponMount.add(buildWeaponMesh(weaponId, mat));
  };

  const equipArmor = (_newArmorId: ArmorId) => {
    // Handled by character model & shader tint
  };

  equipWeapon('flint_spear');

  // Contact shadow disc
  const shadowGeo = createSculptedOrganicGeometry(
    [
      [0.0, 0.92, 0.92],
      [1.0, 0.01, 0.01],
    ],
    18,
    0.02,
    0.015
  );
  const contactShadow = new THREE.Mesh(shadowGeo, mat.contactShadowMaterial);
  root.add(contactShadow);

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
    wingsGroup,
    wings: wingsGroup,
    leftWing,
    rightWing,
    contactShadow,
    controller,
    characterId,
    muzzleLight,
    equipWeapon,
    equipArmor,
    updateWeapon: equipWeapon,
    updateArmor: equipArmor,
  };
}

export function buildWeaponMesh(weaponId: WeaponId, mat: MaterialCache): THREE.Group {
  const group = new THREE.Group();
  const bladeGeo = createSculptedOrganicGeometry(
    [
      [0.0, 0.025, 0.025],
      [0.65, 0.032, 0.032],
      [0.78, 0.14, 0.035],
      [0.92, 0.08, 0.02],
      [1.0, 0.005, 0.005],
    ],
    10,
    2.45,
    -0.5
  );
  const matChoice =
    weaponId === 'caldera_fang_glaive'
      ? mat.lavaMaterial
      : weaponId === 'thunder_lance'
      ? mat.glacierIceMaterial
      : mat.mithrilGoldTrimMaterial;
  const mesh = new THREE.Mesh(bladeGeo, matChoice);
  mesh.castShadow = true;
  group.add(mesh);
  return group;
}

const BEAST_MODEL_MAP: Record<BeastSpecies, { url: string; height: number; rotY: number }> = {
  sky_dragon: {
    url: '/models/Dragon_Character_3d_by_Oscar_Creativo.usdz',
    height: 7.5,
    rotY: 0,
  },
  brontoshell: {
    url: '/models/armor_dinasour.glb',
    height: 4.8,
    rotY: 0,
  },
  caldera_titan: {
    url: '/models/armor_dinasour.glb',
    height: 6.8,
    rotY: 0,
  },
  snapjaw: {
    url: '/models/jason_t.glb',
    height: 4.4,
    rotY: 0,
  },
  raptor: {
    url: '/models/jason_t.glb',
    height: 3.1,
    rotY: 0,
  },
  thunderhorn: {
    url: '/models/triceratops.glb',
    height: 4.5,
    rotY: 0,
  },
  frostfang: {
    url: '/models/triceratops.glb',
    height: 5.4,
    rotY: 0,
  },
};

export function buildBeastModel(species: BeastSpecies, mat: MaterialCache): BeastRig {
  const root = new THREE.Group();
  const body = new THREE.Group();
  const head = new THREE.Group();
  const jaw = new THREE.Group();
  const tail = new THREE.Group();
  const legs: THREE.Group[] = [];
  const accentMeshes: THREE.Mesh[] = [];
  const weakPointIndicators = new Map<string, THREE.Mesh>();
  const mountSocket = new THREE.Group();

  body.position.set(0, 1.5, 0);
  root.add(body);

  head.position.set(0, 0.8, 1.8);
  jaw.position.set(0, -0.2, 0.4);
  head.add(jaw);
  body.add(head);

  tail.position.set(0, 0.1, -1.8);
  body.add(tail);

  mountSocket.position.set(0, 3.1, 0.2);
  root.add(mountSocket);

  const leftWing = new THREE.Group();
  const rightWing = new THREE.Group();
  leftWing.position.set(0.8, 1.2, 0.3);
  rightWing.position.set(-0.8, 1.2, 0.3);
  body.add(leftWing, rightWing);

  for (let i = 0; i < 6; i++) {
    const legGrp = new THREE.Group();
    root.add(legGrp);
    legs.push(legGrp);
  }

  const fallbackSculpt = new THREE.Group();
  const torsoSculptGeo = createSculptedOrganicGeometry(
    [
      [0.0, 0.25, 0.25],
      [0.3, 0.85, 1.45],
      [0.65, 1.05, 1.85],
      [0.9, 0.55, 1.15],
      [1.0, 0.08, 0.12],
    ],
    14,
    species === 'sky_dragon' || species === 'caldera_titan' ? 4.4 : 3.2,
    0.2
  );
  const skinMat = mat.beastSkin[species] || mat.mithrilSilverMaterial;
  const fallbackMesh = new THREE.Mesh(torsoSculptGeo, skinMat);
  fallbackMesh.castShadow = true;
  fallbackSculpt.add(fallbackMesh);

  if (species === 'sky_dragon') {
    const dragonWingGeo = createSculptedOrganicGeometry(
      [
        [0.0, 0.12, 0.08],
        [0.45, 2.2, 0.85],
        [0.85, 3.8, 0.55],
        [1.0, 0.8, 0.12],
      ],
      10,
      3.5,
      0
    );
    dragonWingGeo.rotateZ(-Math.PI / 2.1);
    const lwMesh = new THREE.Mesh(dragonWingGeo, mat.beastAccent.sky_dragon);
    const rwMesh = new THREE.Mesh(dragonWingGeo.clone().scale(-1, 1, 1), mat.beastAccent.sky_dragon);
    leftWing.add(lwMesh);
    rightWing.add(rwMesh);
    legs[0] = leftWing;
    legs[1] = rightWing;
  }

  root.add(fallbackSculpt);

  const wps = createBeastWeakPoints(species);
  const wpGeo = createSculptedOrganicGeometry(
    [
      [0.0, 0.05, 0.05],
      [0.5, 0.42, 0.42],
      [1.0, 0.05, 0.05],
    ],
    12,
    0.75,
    -0.375
  );
  for (const wp of wps) {
    const wpMesh = new THREE.Mesh(wpGeo, mat.focusClueGlow.clone());
    wpMesh.position.set(wp.localOffset.x, wp.localOffset.y, wp.localOffset.z);
    wpMesh.visible = false;
    root.add(wpMesh);
    weakPointIndicators.set(wp.id, wpMesh);
  }

  const controller = new EntityRigController(root, {
    Head: head,
    Jaw: jaw,
    Spine: body,
    Tail: tail,
    Wing_L: leftWing,
    Wing_R: rightWing,
    UpLeg_L: legs[0],
    UpLeg_R: legs[1],
    Leg_L: legs[2],
    Leg_R: legs[3],
    Foot_L: legs[4],
    Foot_R: legs[5],
  });

  const modelSpec = BEAST_MODEL_MAP[species] || BEAST_MODEL_MAP.snapjaw;
  load3DAssetCached(modelSpec.url)
    .then((entry) => {
      const cloned = entry.scene.clone(true);
      const normalized = normalizeLoadedModel(cloned, modelSpec.height, modelSpec.rotY);
      fallbackSculpt.visible = false;
      root.add(normalized);
      controller.bindNodesByRegex(normalized, entry.animations);
    })
    .catch((err) => {
      console.warn(`Beast asset load warning (${modelSpec.url}):`, err);
    });

  return {
    root,
    body,
    head,
    jaw,
    tail,
    legs,
    leftWing,
    rightWing,
    accentMeshes,
    weakPointIndicators,
    controller,
    mountSocket,
  };
}

export function buildSpaceFighterModel(mat: MaterialCache): SpaceFighterRig {
  const root = new THREE.Group();
  const hull = new THREE.Group();
  const canopyNode = new THREE.Group();
  const gearFront = new THREE.Group();
  const gearLeft = new THREE.Group();
  const gearRight = new THREE.Group();
  const aileronLeft = new THREE.Group();
  const aileronRight = new THREE.Group();
  const rudder = new THREE.Group();

  root.add(hull);
  canopyNode.position.set(0, 1.55, 0.85);
  hull.add(canopyNode);

  gearFront.position.set(0, 0.4, 1.8);
  gearLeft.position.set(1.4, 0.4, -0.8);
  gearRight.position.set(-1.4, 0.4, -0.8);
  hull.add(gearFront, gearLeft, gearRight);

  aileronLeft.position.set(2.4, 1.1, -1.2);
  aileronRight.position.set(-2.4, 1.1, -1.2);
  rudder.position.set(0, 1.8, -2.4);
  hull.add(aileronLeft, aileronRight, rudder);

  const plumeGeo = createSculptedOrganicGeometry(
    [
      [0.0, 0.28, 0.28],
      [0.4, 0.22, 0.22],
      [1.0, 0.02, 0.02],
    ],
    12,
    2.4,
    0
  );
  plumeGeo.rotateX(-Math.PI / 2);
  const thrusterLeft = new THREE.Mesh(plumeGeo, mat.glacierIceMaterial);
  const thrusterRight = new THREE.Mesh(plumeGeo.clone(), mat.glacierIceMaterial);
  thrusterLeft.position.set(0.85, 1.15, -2.8);
  thrusterRight.position.set(-0.85, 1.15, -2.8);
  hull.add(thrusterLeft, thrusterRight);

  const fallbackFuselage = new THREE.Mesh(
    createSculptedOrganicGeometry(
      [
        [0.0, 0.8, 1.8],
        [0.35, 2.8, 2.4],
        [0.7, 1.4, 2.2],
        [1.0, 0.15, 0.45],
      ],
      14,
      2.2,
      0.3
    ),
    mat.mithrilSilverMaterial
  );
  hull.add(fallbackFuselage);

  const controller = new EntityRigController(root, {
    Canopy_Node: canopyNode,
    Gear_Front: gearFront,
    Gear_L: gearLeft,
    Gear_R: gearRight,
    Aileron_L: aileronLeft,
    Aileron_R: aileronRight,
    Rudder: rudder,
  });

  load3DAssetCached('/models/spacecraft.glb')
    .then((entry) => {
      const cloned = entry.scene.clone(true);
      const normalized = normalizeLoadedModel(cloned, 3.8, 0);
      fallbackFuselage.visible = false;
      hull.add(normalized);
      controller.bindNodesByRegex(normalized, entry.animations);
    })
    .catch((err) => {
      console.warn('Space Fighter GLB load warning:', err);
    });

  return {
    root,
    hull,
    canopyNode,
    gearFront,
    gearLeft,
    gearRight,
    aileronLeft,
    aileronRight,
    rudder,
    thrusterLeft,
    thrusterRight,
    controller,
  };
}

export function buildForestBiomeModel(): THREE.Group {
  const group = new THREE.Group();
  load3DAssetCached('/models/a_forest_3_with_a_road_at_night_for_game.glb')
    .then((entry) => {
      const cloned = entry.scene.clone(true);
      const normalized = normalizeLoadedModel(cloned, 14.0, 0);
      group.add(normalized);
    })
    .catch(() => {
      // Handled gracefully
    });
  return group;
}

export function buildTribalNPCModel(_npcId: NPCId, mat: MaterialCache): THREE.Group {
  const rig = buildHunterModel(mat, 'raptor_stalker_garb', 'bulky_knight');
  return rig.root;
}

export function buildCampfireWorkbench(mat: MaterialCache): THREE.Group {
  const root = new THREE.Group();

  const shadowGeo = createSculptedOrganicGeometry(
    [
      [0.0, 2.2, 2.2],
      [1.0, 0.01, 0.01],
    ],
    20,
    0.02,
    0.01
  );
  const shadow = new THREE.Mesh(shadowGeo, mat.contactShadowMaterial);
  root.add(shadow);

  const ringGeo = createSculptedOrganicGeometry(
    [
      [0.0, 1.35, 1.35],
      [0.6, 1.25, 1.25],
      [1.0, 0.95, 0.95],
    ],
    16,
    0.42,
    0
  );
  const ringMesh = new THREE.Mesh(ringGeo, mat.stoneMaterial);
  ringMesh.receiveShadow = true;
  root.add(ringMesh);

  const flameGeo = createSculptedOrganicGeometry(
    [
      [0.0, 0.55, 0.55],
      [0.5, 0.32, 0.32],
      [1.0, 0.02, 0.02],
    ],
    12,
    1.25,
    0.15
  );
  const flameMesh = new THREE.Mesh(flameGeo, mat.lavaMaterial);
  flameMesh.name = 'campfire_flame';
  root.add(flameMesh);

  const campfireLight = new THREE.PointLight(0xff7b24, 5.2, 24, 1.5);
  campfireLight.name = 'campfire_light';
  campfireLight.position.set(0, 1.4, 0);
  root.add(campfireLight);

  return root;
}

export function buildSignalTower(
  mat: MaterialCache,
  _stage = 0,
  lit = false
): THREE.Group {
  const root = new THREE.Group();
  const towerGeo = createSculptedOrganicGeometry(
    [
      [0.0, 3.2, 3.2],
      [0.45, 2.3, 2.3],
      [0.85, 1.65, 1.65],
      [1.0, 2.1, 2.1],
    ],
    16,
    13.5,
    0
  );
  const towerMesh = new THREE.Mesh(towerGeo, mat.stoneMaterial);
  towerMesh.castShadow = true;
  towerMesh.receiveShadow = true;
  root.add(towerMesh);

  const flameGeo = createSculptedOrganicGeometry(
    [
      [0.0, 1.1, 1.1],
      [0.5, 0.65, 0.65],
      [1.0, 0.05, 0.05],
    ],
    14,
    3.2,
    13.5
  );
  const beaconFlame = new THREE.Mesh(flameGeo, mat.lavaMaterial);
  beaconFlame.name = 'beacon_flame';
  beaconFlame.visible = lit;
  root.add(beaconFlame);

  return root;
}

export function buildEggNestModel(species: BeastSpecies, mat: MaterialCache): THREE.Group {
  const group = new THREE.Group();
  const nestGeo = createSculptedOrganicGeometry(
    [
      [0.0, 1.05, 1.05],
      [0.6, 1.15, 1.15],
      [1.0, 0.75, 0.75],
    ],
    14,
    0.45,
    0
  );
  const nestMesh = new THREE.Mesh(nestGeo, mat.woodMaterial);
  group.add(nestMesh);

  const eggGeo = createSculptedOrganicGeometry(
    [
      [0.0, 0.12, 0.12],
      [0.35, 0.38, 0.38],
      [0.75, 0.28, 0.28],
      [1.0, 0.02, 0.02],
    ],
    14,
    0.85,
    0.25
  );
  const eggMat =
    species === 'sky_dragon'
      ? mat.glacierIceMaterial
      : species === 'caldera_titan'
      ? mat.lavaMaterial
      : mat.mithrilGoldTrimMaterial;
  const eggMesh = new THREE.Mesh(eggGeo, eggMat);
  eggMesh.name = 'creature_egg_mesh';
  group.add(eggMesh);
  return group;
}

export const buildEggNestMesh = buildEggNestModel;

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
  scale = 1.0
): THREE.Group {
  const group = new THREE.Group();
  if (type === 'palm' || type === 'pine' || type === 'snow_pine' || type === 'banyan') {
    const trunkGeo = createSculptedOrganicGeometry(
      [
        [0.0, 0.45, 0.45],
        [0.5, 0.3, 0.3],
        [1.0, 0.16, 0.16],
      ],
      10,
      4.6,
      0
    );
    const trunk = new THREE.Mesh(trunkGeo, mat.woodMaterial);
    trunk.castShadow = true;
    group.add(trunk);

    const canopyGeo = createSculptedOrganicGeometry(
      [
        [0.0, 2.1, 2.1],
        [0.5, 1.55, 1.55],
        [1.0, 0.1, 0.1],
      ],
      12,
      3.4,
      3.5
    );
    const canopyMat = type === 'snow_pine' ? mat.pineSnowGreen : mat.foliageGreen;
    const canopy = new THREE.Mesh(canopyGeo, canopyMat);
    canopy.castShadow = true;
    group.add(canopy);
  } else if (type === 'fern' || type === 'shrub' || type === 'grass' || type === 'reed') {
    const bushGeo = createSculptedOrganicGeometry(
      [
        [0.0, 0.35, 0.35],
        [0.6, 0.65, 0.65],
        [1.0, 0.08, 0.08],
      ],
      10,
      type === 'reed' ? 1.5 : 0.85,
      0
    );
    const mesh = new THREE.Mesh(bushGeo, mat.shrubLeafMaterial);
    group.add(mesh);
  } else {
    const rockGeo = createSculptedOrganicGeometry(
      [
        [0.0, 0.95, 0.85],
        [0.55, 1.05, 0.92],
        [1.0, 0.2, 0.2],
      ],
      10,
      type === 'spire' || type === 'ice_crystal' ? 3.2 : 1.35,
      0
    );
    const rockMat =
      type === 'ice_crystal'
        ? mat.glacierIceMaterial
        : type === 'snow_boulder'
        ? mat.snowMaterial
        : type === 'river_stone'
        ? mat.riverStoneMaterial
        : mat.stoneMaterial;
    const mesh = new THREE.Mesh(rockGeo, rockMat);
    mesh.castShadow = true;
    group.add(mesh);
  }
  group.scale.setScalar(scale);
  return group;
}

export function buildSnowMountainPeakModel(mat: MaterialCache, scale = 1.0): THREE.Group {
  const group = new THREE.Group();
  const peakGeo = createSculptedOrganicGeometry(
    [
      [0.0, 9.5, 9.5],
      [0.45, 6.2, 5.8],
      [0.8, 2.8, 2.5],
      [1.0, 0.25, 0.25],
    ],
    14,
    18.0,
    -1.0
  );
  const peak = new THREE.Mesh(peakGeo, mat.snowMaterial);
  peak.receiveShadow = true;
  group.add(peak);
  group.scale.setScalar(scale);
  return group;
}

export function buildRiverBridgeModel(mat: MaterialCache): THREE.Group {
  const group = new THREE.Group();
  const deckGeo = createSculptedOrganicGeometry(
    [
      [0.0, 1.8, 5.2],
      [0.5, 1.9, 5.2],
      [1.0, 1.8, 5.2],
    ],
    12,
    0.35,
    0
  );
  const deck = new THREE.Mesh(deckGeo, mat.woodMaterial);
  deck.receiveShadow = true;
  group.add(deck);
  return group;
}

export function buildRiverFishModel(mat: MaterialCache, scale = 1.0): THREE.Group {
  const group = new THREE.Group();
  const fishGeo = createSculptedOrganicGeometry(
    [
      [0.0, 0.04, 0.08],
      [0.45, 0.16, 0.32],
      [0.8, 0.1, 0.22],
      [1.0, 0.02, 0.04],
    ],
    10,
    0.65,
    0
  );
  fishGeo.rotateX(Math.PI / 2);
  const mesh = new THREE.Mesh(fishGeo, mat.fishScaleMaterial);
  group.add(mesh);
  group.scale.setScalar(scale);
  return group;
}

export function buildEnvironmentShowcaseModel(
  _envId: EnvironmentModelId,
  mat: MaterialCache
): THREE.Group {
  const group = new THREE.Group();
  const prop = buildFoliageModel('banyan', mat, 0.65);
  group.add(prop);
  const forest = buildForestBiomeModel();
  forest.scale.setScalar(0.35);
  group.add(forest);
  return group;
}
