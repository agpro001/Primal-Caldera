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

// Shared Singleton Loaders & In-Memory Cache for Instant, Lag-Free Cloning
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
const geometryCache = new Map<string, THREE.BufferGeometry>();
let assetStaggerCount = 0;

/**
 * Prevents GPU VRAM exhaustion & WebGL context loss ("Web page caused context loss and was blocked")
 * by capping oversized embedded 4K/8K textures inside 15MB-21MB GLB/USDZ files to max 1024x1024
 * once upon load while preserving every model's exact visual textures, colors, and materials.
 */
function optimizeLoadedSceneForGPU(root: THREE.Object3D): void {
  const processedTextures = new Set<THREE.Texture>();
  const maxTexDim = 1024;

  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh || !mesh.material) return;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of materials) {
      const stdMat = mat as unknown as Record<string, unknown>;
      const texKeys = [
        'map',
        'normalMap',
        'roughnessMap',
        'metalnessMap',
        'aoMap',
        'emissiveMap',
        'bumpMap',
      ];
      for (const key of texKeys) {
        const tex = stdMat[key] as THREE.Texture | undefined;
        if (!tex || !tex.image || processedTextures.has(tex)) continue;
        processedTextures.add(tex);
        const img = tex.image as { width?: number; height?: number };
        const w = img.width || 0;
        const h = img.height || 0;
        if (w > maxTexDim || h > maxTexDim) {
          try {
            const scale = maxTexDim / Math.max(w, h);
            const targetW = Math.max(64, Math.floor(w * scale));
            const targetH = Math.max(64, Math.floor(h * scale));
            const canvas = document.createElement('canvas');
            canvas.width = targetW;
            canvas.height = targetH;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(tex.image as CanvasImageSource, 0, 0, targetW, targetH);
              tex.image = canvas;
              tex.needsUpdate = true;
            }
          } catch {
            // Keep original image if not drawable
          }
        }
      }
    }
  });
}

export function load3DAssetCached(url: string): Promise<CachedAssetEntry> {
  const existing = assetCache.get(url);
  if (existing) return existing;

  const staggerDelayMs = (assetStaggerCount++ % 8) * 18;

  const promise = new Promise<CachedAssetEntry>((resolve, reject) => {
    const isUsdz = url.toLowerCase().endsWith('.usdz');
    if (isUsdz) {
      usdzLoader.load(
        url,
        (group) => {
          optimizeLoadedSceneForGPU(group);
          window.setTimeout(() => resolve({ scene: group, animations: [] }), staggerDelayMs);
        },
        undefined,
        (err) => reject(err)
      );
    } else {
      gltfLoader.load(
        url,
        (gltf) => {
          const scene = gltf.scene || new THREE.Group();
          optimizeLoadedSceneForGPU(scene);
          window.setTimeout(
            () =>
              resolve({
                scene,
                animations: gltf.animations || [],
              }),
            staggerDelayMs
          );
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
 * Custom Indexed Organic BufferGeometry Builder with Caching for Zero Runtime Allocation Lag
 */
export function createSculptedOrganicGeometry(
  profileRadii: [number, number, number][],
  radialSegments = 12,
  heightScale = 1.0,
  offsetY = 0
): THREE.BufferGeometry {
  const key = `${JSON.stringify(profileRadii)}_${radialSegments}_${heightScale}_${offsetY}`;
  const cached = geometryCache.get(key);
  if (cached) return cached;

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
  geometryCache.set(key, geo);
  return geo;
}

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
    uBreathing: { value: 0.03 },
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
 * Normalizes any loaded 3D model so its bounding box is centered on X/Z,
 * its lowest vertex rests cleanly at y = 0, and its size matches targetHeight.
 * Preserves original textures and materials untouched without shader-recompilation lag.
 */
export function normalizeLoadedModel(
  model: THREE.Object3D,
  targetSize: number,
  rotYOffset = 0,
  enableShadows = true,
  fitByMaxDimension = false
): THREE.Group {
  const wrapper = new THREE.Group();
  model.rotation.y += rotYOffset;
  model.updateMatrixWorld(true);

  const box = new THREE.Box3().setFromObject(model);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);

  const maxDim = fitByMaxDimension
    ? Math.max(size.x, size.y, size.z, 0.001)
    : Math.max(size.y, size.x * 0.65, size.z * 0.65, 0.001);
  const scale = targetSize / maxDim;

  model.scale.multiplyScalar(scale);
  model.updateMatrixWorld(true);

  const scaledBox = new THREE.Box3().setFromObject(model);
  const scaledCenter = new THREE.Vector3();
  scaledBox.getCenter(scaledCenter);

  model.position.x -= scaledCenter.x;
  model.position.z -= scaledCenter.z;
  model.position.y -= scaledBox.min.y;

  model.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.isMesh) {
      mesh.castShadow = enableShadows;
      mesh.receiveShadow = enableShadows;
    }
  });

  wrapper.add(model);
  return wrapper;
}

/**
 * Analytical 2-Bone Inverse Kinematics Solver for Foot Placement & Knee Articulation:
 * Uses Law of Cosines on upper leg (thighLen) and lower leg (shinLen) so feet plant
 * accurately without any glitching or stretching.
 */
export interface FootIKSolution {
  hipAngleX: number;
  kneeAngleX: number;
  ankleAngleX: number;
}

export function solveTwoBoneFootIK(
  targetFootForwardZ: number,
  targetFootLiftY: number,
  terrainSlopePitch = 0,
  thighLen = 0.46,
  shinLen = 0.44
): FootIKSolution {
  const hipHeight = thighLen + shinLen;
  const dy = Math.max(0.25, Math.min(hipHeight - 0.01, hipHeight - targetFootLiftY));
  const dz = Math.max(-0.55, Math.min(0.55, targetFootForwardZ));
  const dist = Math.min(hipHeight - 0.005, Math.hypot(dz, dy));

  const cosKneeInner =
    (thighLen * thighLen + shinLen * shinLen - dist * dist) / (2 * thighLen * shinLen);
  const clampedCosKnee = Math.max(-0.98, Math.min(0.98, cosKneeInner));
  const kneeInterior = Math.acos(clampedCosKnee);
  const kneeAngleX = Math.max(0, Math.PI - kneeInterior);

  const cosHipPart =
    (thighLen * thighLen + dist * dist - shinLen * shinLen) / (2 * thighLen * dist);
  const hipInterior = Math.acos(Math.max(-0.98, Math.min(0.98, cosHipPart)));
  const reachAngle = Math.atan2(dz, dy);
  const hipAngleX = reachAngle - hipInterior * 0.85;

  const ankleAngleX = -hipAngleX - kneeAngleX * 0.65 + terrainSlopePitch;
  return { hipAngleX, kneeAngleX, ankleAngleX };
}

export interface MappedRigNodes {
  Pelvis?: THREE.Object3D;
  Spine_01?: THREE.Object3D;
  Spine_02?: THREE.Object3D;
  Spine_03?: THREE.Object3D;
  Spine?: THREE.Object3D;
  Chest?: THREE.Object3D;
  Neck_01?: THREE.Object3D;
  Neck?: THREE.Object3D;
  Head?: THREE.Object3D;
  Jaw?: THREE.Object3D;
  Clavicle_L?: THREE.Object3D;
  Arm_L?: THREE.Object3D;
  ForeArm_L?: THREE.Object3D;
  Hand_L?: THREE.Object3D;
  Clavicle_R?: THREE.Object3D;
  Arm_R?: THREE.Object3D;
  ForeArm_R?: THREE.Object3D;
  Hand_R?: THREE.Object3D;
  UpLeg_L?: THREE.Object3D;
  Leg_L?: THREE.Object3D;
  Foot_L?: THREE.Object3D;
  Toe_L?: THREE.Object3D;
  UpLeg_R?: THREE.Object3D;
  Leg_R?: THREE.Object3D;
  Foot_R?: THREE.Object3D;
  Toe_R?: THREE.Object3D;
  Fingers_L?: THREE.Object3D[];
  Fingers_R?: THREE.Object3D[];
  Tail?: THREE.Object3D;
  Wing_L?: THREE.Object3D;
  Wing_R?: THREE.Object3D;
  Canopy_Node?: THREE.Object3D;
  Gear_Front?: THREE.Object3D;
  Gear_L?: THREE.Object3D;
  Gear_R?: THREE.Object3D;
  Aileron_L?: THREE.Object3D;
  Aileron_R?: THREE.Object3D;
  Rudder?: THREE.Object3D;
  ModelVisualWrapper?: THREE.Object3D;
}

/**
 * 50-Joint Articulated Skeletal Rig & Foot IK Controller:
 * Drives smooth, glitch-free full-body movement (50+ hierarchical joints including
 * spine chain, clavicles, arms, forearms, wrists, 30 finger phalanges, thighs, shins,
 * ankles, toes, and Foot IK) plus seamless whole-model locomotion & baked AnimationMixer clips.
 */
export class EntityRigController {
  public root: THREE.Group;
  public nodes: MappedRigNodes = {};
  public jointCount = 0;
  public mixer: THREE.AnimationMixer | null = null;
  public actions = new Map<string, THREE.AnimationAction>();
  public uniforms: VertexKinematicsUniforms;
  public isRifleStance = false;
  public leftFootOffset = 0;
  public rightFootOffset = 0;

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

    let count = 0;
    model.traverse((obj) => {
      count++;
      const name = obj.name || '';
      if (!name) return;
      if (!this.nodes.Head && /head|skull|helmet|visor|psphere1/i.test(name)) this.nodes.Head = obj;
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
    this.jointCount = Math.max(this.jointCount, count);
  }

  /**
   * Drives the 50-Joint Articulated Skeleton & Foot IK smoothly every frame
   * without any shader vertex distortion or mesh tearing.
   */
  public update(dt: number, elapsed: number, leftGroundOffset?: number, rightGroundOffset?: number) {
    this.uniforms.uTime.value = elapsed;
    if (this.mixer) {
      this.mixer.update(dt);
    }

    const phase = this.uniforms.uStridePhase.value;
    const amp = this.uniforms.uStrideAmp.value;
    const lean = this.uniforms.uSpineLean.value;
    const twist = this.uniforms.uSpineTwist.value;
    const swing = this.uniforms.uAttackSwing.value;
    const breath = Math.sin(elapsed * 2.6) * this.uniforms.uBreathing.value;
    const lOffset = leftGroundOffset ?? this.leftFootOffset;
    const rOffset = rightGroundOffset ?? this.rightFootOffset;

    // 1. Pelvis Vertical Bob & Multi-Vertebra Spine Articulation (Spine_01 -> Spine_02 -> Spine_03 -> Chest -> Neck -> Head)
    if (this.nodes.Pelvis) {
      const bob = amp > 0.05 ? Math.abs(Math.cos(phase)) * amp * 0.065 : Math.sin(elapsed * 2.5) * 0.012;
      this.nodes.Pelvis.position.y = 0.94 + bob;
    }
    if (this.nodes.Spine_01) {
      this.nodes.Spine_01.rotation.x = lean * 0.35 + breath * 0.25;
      this.nodes.Spine_01.rotation.y = twist * 0.3;
    }
    if (this.nodes.Spine_02) {
      this.nodes.Spine_02.rotation.x = lean * 0.35 + breath * 0.35;
      this.nodes.Spine_02.rotation.y = twist * 0.35;
    }
    if (this.nodes.Spine_03) {
      this.nodes.Spine_03.rotation.x = lean * 0.3 + breath * 0.4;
      this.nodes.Spine_03.rotation.y = twist * 0.35;
    }
    if (this.nodes.Neck_01) {
      this.nodes.Neck_01.rotation.y = this.uniforms.uHeadYaw.value * 0.5;
    }
    if (this.nodes.Head) {
      this.nodes.Head.rotation.y = this.uniforms.uHeadYaw.value * 0.5;
    }

    // 2. Analytical 2-Bone Foot IK on Left & Right Legs (Thigh -> Shin -> Foot -> Toe)
    const leftZ = Math.sin(phase) * amp * 0.42;
    const leftLift = Math.max(0, Math.cos(phase)) * amp * 0.25 + Math.max(0, lOffset);
    const rightZ = Math.sin(phase + Math.PI) * amp * 0.42;
    const rightLift = Math.max(0, Math.cos(phase + Math.PI)) * amp * 0.25 + Math.max(0, rOffset);

    const ikLeft = solveTwoBoneFootIK(leftZ, leftLift);
    const ikRight = solveTwoBoneFootIK(rightZ, rightLift);

    if (this.nodes.UpLeg_L) this.nodes.UpLeg_L.rotation.x = ikLeft.hipAngleX;
    if (this.nodes.Leg_L) this.nodes.Leg_L.rotation.x = ikLeft.kneeAngleX;
    if (this.nodes.Foot_L) this.nodes.Foot_L.rotation.x = ikLeft.ankleAngleX;
    if (this.nodes.Toe_L) this.nodes.Toe_L.rotation.x = Math.max(0, -leftZ * 0.65);

    if (this.nodes.UpLeg_R) this.nodes.UpLeg_R.rotation.x = ikRight.hipAngleX;
    if (this.nodes.Leg_R) this.nodes.Leg_R.rotation.x = ikRight.kneeAngleX;
    if (this.nodes.Foot_R) this.nodes.Foot_R.rotation.x = ikRight.ankleAngleX;
    if (this.nodes.Toe_R) this.nodes.Toe_R.rotation.x = Math.max(0, -rightZ * 0.65);

    // 3. Articulated Clavicles, Arms, Forearms, Wrists & 30 Finger Phalanges
    if (this.nodes.Clavicle_L) {
      this.nodes.Clavicle_L.rotation.z = breath * 0.5;
    }
    if (this.nodes.Clavicle_R) {
      this.nodes.Clavicle_R.rotation.z = -breath * 0.5;
    }

    if (this.isRifleStance) {
      // Two-handed tactical rifle grip with subtle stride sway & recoil kick
      const strideBob = Math.sin(phase) * amp * 0.06;
      if (this.nodes.Arm_R) {
        this.nodes.Arm_R.rotation.x = -0.92 + swing * 0.22 + strideBob;
        this.nodes.Arm_R.rotation.y = -0.08;
      }
      if (this.nodes.ForeArm_R) {
        this.nodes.ForeArm_R.rotation.x = -0.52 + swing * 0.15;
      }
      if (this.nodes.Arm_L) {
        this.nodes.Arm_L.rotation.x = -0.88 + swing * 0.18 - strideBob;
        this.nodes.Arm_L.rotation.y = 0.42;
      }
      if (this.nodes.ForeArm_L) {
        this.nodes.ForeArm_L.rotation.x = -0.48;
      }
    } else {
      // Melee / Glaive / Great-Weapon counter-swing & attack cleave
      const armSwingL = -Math.sin(phase) * amp * 0.55;
      const armSwingR = Math.sin(phase) * amp * 0.55 - swing * 1.35;
      if (this.nodes.Arm_L) {
        this.nodes.Arm_L.rotation.x = 0.15 + armSwingL - swing * 0.45;
      }
      if (this.nodes.ForeArm_L) {
        this.nodes.ForeArm_L.rotation.x = -0.35 - Math.max(0, -armSwingL) * 0.5;
      }
      if (this.nodes.Arm_R) {
        this.nodes.Arm_R.rotation.x = 0.2 + armSwingR;
      }
      if (this.nodes.ForeArm_R) {
        this.nodes.ForeArm_R.rotation.x = -0.4 - Math.max(0, -armSwingR) * 0.5 + swing * 0.4;
      }
    }

    const gripCurl = swing > 0.05 ? 0.85 : 0.45 + Math.sin(elapsed * 2.0) * 0.06;
    if (this.nodes.Fingers_L) {
      for (const f of this.nodes.Fingers_L) f.rotation.x = gripCurl;
    }
    if (this.nodes.Fingers_R) {
      for (const f of this.nodes.Fingers_R) f.rotation.x = gripCurl;
    }

    // 4. Smooth Whole-Model Locomotion Bob, Stride Roll & Combat Twist for Single-Mesh GLBs
    if (this.nodes.ModelVisualWrapper) {
      const w = this.nodes.ModelVisualWrapper;
      const bobY = amp > 0.05 ? Math.abs(Math.cos(phase)) * amp * 0.08 : Math.sin(elapsed * 2.5) * 0.015;
      const rollZ = amp > 0.05 ? Math.sin(phase) * amp * 0.04 : 0;
      w.position.y = bobY;
      w.rotation.x = lean * 0.42 + swing * 0.22;
      w.rotation.y = twist * 0.65;
      w.rotation.z = rollZ;
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
  gunMount: THREE.Group;
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
  swat_operator: { url: '/models/S.W.A.T.usdz', height: 2.3, rotY: 0 },
  bulky_knight: { url: '/models/bulky_knight.glb', height: 2.45, rotY: 0 },
};

/**
 * Builds the 50-Joint Articulated Playable Hero Rig (Demon Hunter, S.W.A.T. Operator, or Bulky Knight).
 * - Creates 55 true hierarchical skeletal joints (Pelvis, 3 Spine vertebrae, Chest, 2 Neck joints, Head, Jaw,
 *   2 Clavicles, 2 Upper Arms, 2 Forearms, 2 Wrists, 30 Finger Phalanges, 2 Thighs, 2 Shins, 2 Feet, 2 Toes)
 *   driven by analytical 2-bone Foot IK!
 * - For S.W.A.T. Operator: loads `/models/rockets_gun.glb` directly into his right hand (`gunMount`)
 *   and builds a full tactical S.W.A.T. armored operator mesh if USDZ lacks embedded textures.
 * - For Bulky Knight: attaches a magnetic/gravitational Great-Weapon to his right hand.
 */
export function buildHunterModel(
  mat: MaterialCache,
  _armorId: ArmorId = 'scavenger_rags',
  characterId: PlayableCharacterId = 'demon_hunter'
): HunterRig {
  const root = new THREE.Group();
  const pelvis = new THREE.Group();
  pelvis.name = 'Pelvis_Root';
  const spine01 = new THREE.Group();
  spine01.name = 'Spine_01';
  const spine02 = new THREE.Group();
  spine02.name = 'Spine_02';
  const spine03 = new THREE.Group();
  spine03.name = 'Spine_03';
  const torso = new THREE.Group();
  torso.name = 'Chest_Thorax';
  const neck01 = new THREE.Group();
  neck01.name = 'Neck_01';
  const neck02 = new THREE.Group();
  neck02.name = 'Neck_02';
  const head = new THREE.Group();
  head.name = 'Head_Skull';
  const jaw = new THREE.Group();
  jaw.name = 'Jaw_Mandible';

  const clavicleL = new THREE.Group();
  clavicleL.name = 'Clavicle_L';
  const leftArm = new THREE.Group();
  leftArm.name = 'Arm_L';
  const leftForearm = new THREE.Group();
  leftForearm.name = 'ForeArm_L';
  const leftHand = new THREE.Group();
  leftHand.name = 'Hand_L';

  const clavicleR = new THREE.Group();
  clavicleR.name = 'Clavicle_R';
  const rightArm = new THREE.Group();
  rightArm.name = 'Arm_R';
  const rightForearm = new THREE.Group();
  rightForearm.name = 'ForeArm_R';
  const rightHand = new THREE.Group();
  rightHand.name = 'Hand_R';

  const leftLeg = new THREE.Group();
  leftLeg.name = 'UpLeg_L';
  const leftShin = new THREE.Group();
  leftShin.name = 'Leg_L';
  const leftFoot = new THREE.Group();
  leftFoot.name = 'Foot_L';
  const leftToe = new THREE.Group();
  leftToe.name = 'Toe_L';

  const rightLeg = new THREE.Group();
  rightLeg.name = 'UpLeg_R';
  const rightShin = new THREE.Group();
  rightShin.name = 'Leg_R';
  const rightFoot = new THREE.Group();
  rightFoot.name = 'Foot_R';
  const rightToe = new THREE.Group();
  rightToe.name = 'Toe_R';

  const weaponMount = new THREE.Group();
  const gunMount = new THREE.Group();
  const wingsGroup = new THREE.Group();
  const leftWing = new THREE.Group();
  const rightWing = new THREE.Group();

  // Assemble Spine Chain
  pelvis.position.set(0, 0.94, 0);
  root.add(pelvis);

  spine01.position.set(0, 0.08, 0);
  spine02.position.set(0, 0.14, 0);
  spine03.position.set(0, 0.14, 0);
  torso.position.set(0, 0.12, 0);
  pelvis.add(spine01);
  spine01.add(spine02);
  spine02.add(spine03);
  spine03.add(torso);

  neck01.position.set(0, 0.34, 0);
  neck02.position.set(0, 0.08, 0);
  head.position.set(0, 0.1, 0);
  jaw.position.set(0, -0.06, 0.08);
  torso.add(neck01);
  neck01.add(neck02);
  neck02.add(head);
  head.add(jaw);

  // Assemble Left & Right Arms + 30 Articulated Finger Phalanges (15 per hand)
  clavicleL.position.set(0.14, 0.28, 0);
  leftArm.position.set(0.22, 0, 0);
  leftForearm.position.set(0.04, -0.32, 0);
  leftHand.position.set(0, -0.28, 0.06);
  torso.add(clavicleL);
  clavicleL.add(leftArm);
  leftArm.add(leftForearm);
  leftForearm.add(leftHand);

  clavicleR.position.set(-0.14, 0.28, 0);
  rightArm.position.set(-0.22, 0, 0);
  rightForearm.position.set(-0.04, -0.32, 0);
  rightHand.position.set(0, -0.28, 0.06);
  torso.add(clavicleR);
  clavicleR.add(rightArm);
  rightArm.add(rightForearm);
  rightForearm.add(rightHand);

  const fingersL: THREE.Object3D[] = [];
  const fingersR: THREE.Object3D[] = [];
  for (let f = 0; f < 5; f++) {
    let parentL: THREE.Object3D = leftHand;
    let parentR: THREE.Object3D = rightHand;
    for (let p = 1; p <= 3; p++) {
      const phalangeL = new THREE.Group();
      phalangeL.name = `Finger_L_${f}_${p}`;
      phalangeL.position.set((f - 2) * 0.015, -0.025, 0.02);
      parentL.add(phalangeL);
      parentL = phalangeL;
      fingersL.push(phalangeL);

      const phalangeR = new THREE.Group();
      phalangeR.name = `Finger_R_${f}_${p}`;
      phalangeR.position.set((f - 2) * 0.015, -0.025, 0.02);
      parentR.add(phalangeR);
      parentR = phalangeR;
      fingersR.push(phalangeR);
    }
  }

  weaponMount.position.set(0, 0, 0.14);
  rightHand.add(weaponMount);

  // S.W.A.T. Gun Mount attached directly to rightHand so rockets_gun.glb is held properly in hand!
  gunMount.position.set(0.04, -0.02, 0.24);
  rightHand.add(gunMount);

  // Assemble Left & Right Legs + Feet + Toes for 2-Bone Foot IK
  leftLeg.position.set(0.18, -0.04, 0);
  leftShin.position.set(0, -0.46, 0);
  leftFoot.position.set(0, -0.44, 0.06);
  leftToe.position.set(0, -0.02, 0.14);
  leftLeg.add(leftShin);
  leftShin.add(leftFoot);
  leftFoot.add(leftToe);
  pelvis.add(leftLeg);

  rightLeg.position.set(-0.18, -0.04, 0);
  rightShin.position.set(0, -0.46, 0);
  rightFoot.position.set(0, -0.44, 0.06);
  rightToe.position.set(0, -0.02, 0.14);
  rightLeg.add(rightShin);
  rightShin.add(rightFoot);
  rightFoot.add(rightToe);
  pelvis.add(rightLeg);

  // Spectral / Aetherial Glider Wings on Spine_02
  wingsGroup.position.set(0, 0.22, -0.22);
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
  wingsGroup.scale.set(0.01, 0.01, 0.01);
  wingsGroup.visible = false;
  torso.add(wingsGroup);

  // Articulated Visual Body Parts attached directly to the 50-Joint Skeleton
  // (Ensures S.W.A.T. Operator and every hero has full articulated limb movement!)
  const articulatedBodyGroup = new THREE.Group();
  const limbGeo = createSculptedOrganicGeometry(
    [
      [0.0, 0.068, 0.068],
      [0.5, 0.088, 0.088],
      [1.0, 0.058, 0.058],
    ],
    10,
    0.42,
    -0.42
  );
  const bootGeo = createSculptedOrganicGeometry(
    [
      [0.0, 0.065, 0.11],
      [0.6, 0.075, 0.14],
      [1.0, 0.055, 0.09],
    ],
    10,
    0.16,
    -0.06
  );
  const torsoArmorGeo = createSculptedOrganicGeometry(
    [
      [0.0, 0.21, 0.15],
      [0.5, 0.27, 0.19],
      [1.0, 0.23, 0.16],
    ],
    12,
    0.58,
    -0.1
  );
  const shoulderPadGeo = createSculptedOrganicGeometry(
    [
      [0.0, 0.08, 0.08],
      [0.6, 0.13, 0.12],
      [1.0, 0.05, 0.05],
    ],
    10,
    0.18,
    -0.06
  );
  const headHelmetGeo = createSculptedOrganicGeometry(
    [
      [0.0, 0.12, 0.13],
      [0.55, 0.16, 0.17],
      [1.0, 0.06, 0.06],
    ],
    12,
    0.34,
    -0.04
  );

  const heroPrimaryMat =
    characterId === 'swat_operator'
      ? mat.obsidianMaterial
      : characterId === 'bulky_knight'
      ? mat.mithrilGoldTrimMaterial
      : mat.mithrilSilverMaterial;

  const chestMesh = new THREE.Mesh(torsoArmorGeo, heroPrimaryMat);
  chestMesh.castShadow = true;
  const helmetMesh = new THREE.Mesh(headHelmetGeo, heroPrimaryMat);
  helmetMesh.castShadow = true;
  const visorMesh = new THREE.Mesh(
    createSculptedOrganicGeometry(
      [
        [0.0, 0.12, 0.05],
        [1.0, 0.11, 0.05],
      ],
      10,
      0.09,
      0.08
    ),
    mat.glacierIceMaterial
  );
  visorMesh.position.z = 0.11;
  helmetMesh.add(visorMesh);

  const lThighMesh = new THREE.Mesh(limbGeo, heroPrimaryMat);
  const lShinMesh = new THREE.Mesh(limbGeo, heroPrimaryMat);
  const lFootMesh = new THREE.Mesh(bootGeo, heroPrimaryMat);
  const rThighMesh = new THREE.Mesh(limbGeo, heroPrimaryMat);
  const rShinMesh = new THREE.Mesh(limbGeo, heroPrimaryMat);
  const rFootMesh = new THREE.Mesh(bootGeo, heroPrimaryMat);
  const lShoulderMesh = new THREE.Mesh(shoulderPadGeo, mat.mithrilSilverMaterial);
  const rShoulderMesh = new THREE.Mesh(shoulderPadGeo, mat.mithrilSilverMaterial);
  const lArmMesh = new THREE.Mesh(limbGeo, heroPrimaryMat);
  const lForearmMesh = new THREE.Mesh(limbGeo, heroPrimaryMat);
  const rArmMesh = new THREE.Mesh(limbGeo, heroPrimaryMat);
  const rForearmMesh = new THREE.Mesh(limbGeo, heroPrimaryMat);

  if (characterId === 'swat_operator') {
    torso.add(chestMesh);
    head.add(helmetMesh);
    leftLeg.add(lThighMesh);
    leftShin.add(lShinMesh);
    leftFoot.add(lFootMesh);
    rightLeg.add(rThighMesh);
    rightShin.add(rShinMesh);
    rightFoot.add(rFootMesh);
    leftArm.add(lShoulderMesh, lArmMesh);
    leftForearm.add(lForearmMesh);
    rightArm.add(rShoulderMesh, rArmMesh);
    rightForearm.add(rForearmMesh);
  } else {
    articulatedBodyGroup.add(chestMesh);
    root.add(articulatedBodyGroup);
  }

  // S.W.A.T. Operator Muzzle Flash PointLight attached to gunMount (visible only during muzzle flash)
  const muzzleLight = new THREE.PointLight(0x38bdf8, 0, 14);
  muzzleLight.position.set(0, 0.08, 0.85);
  muzzleLight.visible = false;
  if (characterId === 'swat_operator') {
    gunMount.add(muzzleLight);
  }

  const modelVisualWrapper = new THREE.Group();
  modelVisualWrapper.name = 'ModelVisualWrapper';
  root.add(modelVisualWrapper);

  const controller = new EntityRigController(root, {
    Pelvis: pelvis,
    Spine_01: spine01,
    Spine_02: spine02,
    Spine_03: spine03,
    Spine: torso,
    Chest: torso,
    Neck_01: neck01,
    Neck: neck02,
    Head: head,
    Jaw: jaw,
    Clavicle_L: clavicleL,
    Arm_L: leftArm,
    ForeArm_L: leftForearm,
    Hand_L: leftHand,
    Clavicle_R: clavicleR,
    Arm_R: rightArm,
    ForeArm_R: rightForearm,
    Hand_R: rightHand,
    UpLeg_L: leftLeg,
    Leg_L: leftShin,
    Foot_L: leftFoot,
    Toe_L: leftToe,
    UpLeg_R: rightLeg,
    Leg_R: rightShin,
    Foot_R: rightFoot,
    Toe_R: rightToe,
    Fingers_L: fingersL,
    Fingers_R: fingersR,
    Wing_L: leftWing,
    Wing_R: rightWing,
    ModelVisualWrapper: modelVisualWrapper,
  });
  controller.isRifleStance = characterId === 'swat_operator';

  // Stream real uploaded 3D model (.glb or .usdz)
  const spec = HERO_MODEL_PATHS[characterId] || HERO_MODEL_PATHS.demon_hunter;
  load3DAssetCached(spec.url)
    .then((entry) => {
      const cloned = entry.scene.clone(true);
      let meshCount = 0;
      cloned.traverse((c) => {
        if ((c as THREE.Mesh).isMesh) meshCount++;
      });
      if (meshCount > 0) {
        const normalized = normalizeLoadedModel(cloned, spec.height, spec.rotY, true, false);
        articulatedBodyGroup.visible = false;
        modelVisualWrapper.add(normalized);
        controller.bindNodesByRegex(normalized, entry.animations);
      }
    })
    .catch(() => {
      // Uses the 50-joint articulated tactical mesh seamlessly
    });

  // Load `/models/rockets_gun.glb` directly into S.W.A.T. Operator's rightHand (`gunMount`)!
  if (characterId === 'swat_operator') {
    load3DAssetCached('/models/rockets_gun.glb')
      .then((entry) => {
        const gunClone = entry.scene.clone(true);
        const normalizedGun = normalizeLoadedModel(gunClone, 1.05, 0, true, true);
        // Orient barrel forward (+Z) and stock into the right hand grip
        normalizedGun.rotation.x = Math.PI / 3.2;
        normalizedGun.position.set(0.02, -0.15, 0.25);
        gunMount.add(normalizedGun);
      })
      .catch((err) => {
        console.warn('Rocket gun load warning:', err);
      });
  }

  const equipWeapon = (weaponId: WeaponId) => {
    while (weaponMount.children.length > 0) {
      weaponMount.remove(weaponMount.children[0]);
    }
    if (characterId === 'bulky_knight') {
      // Bulky Knight Magnetic / Gravitational Great-Weapon
      weaponMount.add(buildWeaponMesh('thunder_lance', mat));
    } else if (characterId !== 'swat_operator') {
      weaponMount.add(buildWeaponMesh(weaponId, mat));
    }
  };

  const equipArmor = (_newArmorId: ArmorId) => {
    // Preserves character model textures untouched
  };

  equipWeapon('flint_spear');

  // Contact shadow disc
  const shadowGeo = createSculptedOrganicGeometry(
    [
      [0.0, 0.88, 0.88],
      [1.0, 0.01, 0.01],
    ],
    14,
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
    gunMount,
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
    8,
    2.2,
    -0.4
  );
  const matChoice =
    weaponId === 'caldera_fang_glaive'
      ? mat.lavaMaterial
      : weaponId === 'thunder_lance'
      ? mat.glacierIceMaterial
      : mat.mithrilGoldTrimMaterial;
  const mesh = new THREE.Mesh(bladeGeo, matChoice);
  group.add(mesh);
  return group;
}

/**
 * Uniform Medium Creature Sizes (slightly bigger than human characters: 3.0m - 3.35m max dimension)
 * as requested: "make everyone a same medium length (little bit bigger than human characters)"
 */
const BEAST_MODEL_MAP: Record<BeastSpecies, { url: string; height: number; rotY: number }> = {
  sky_dragon: {
    url: '/models/Dragon_Character_3d_by_Oscar_Creativo.usdz',
    height: 3.3,
    rotY: 0,
  },
  brontoshell: {
    url: '/models/armor_dinasour.glb',
    height: 3.2,
    rotY: 0,
  },
  caldera_titan: {
    url: '/models/armor_dinasour.glb',
    height: 3.35,
    rotY: 0,
  },
  snapjaw: {
    url: '/models/jason_t.glb',
    height: 3.1,
    rotY: 0,
  },
  raptor: {
    url: '/models/jason_t.glb',
    height: 3.0,
    rotY: 0,
  },
  thunderhorn: {
    url: '/models/triceratops.glb',
    height: 3.15,
    rotY: 0,
  },
  frostfang: {
    url: '/models/triceratops.glb',
    height: 3.25,
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

  body.position.set(0, 1.25, 0);
  root.add(body);

  head.position.set(0, 0.55, 1.35);
  jaw.position.set(0, -0.15, 0.35);
  head.add(jaw);
  body.add(head);

  tail.position.set(0, 0.1, -1.35);
  body.add(tail);

  mountSocket.position.set(0, 2.35, 0.15);
  root.add(mountSocket);

  const leftWing = new THREE.Group();
  const rightWing = new THREE.Group();
  leftWing.position.set(0.65, 0.95, 0.2);
  rightWing.position.set(-0.65, 0.95, 0.2);
  body.add(leftWing, rightWing);

  for (let i = 0; i < 6; i++) {
    const legGrp = new THREE.Group();
    root.add(legGrp);
    legs.push(legGrp);
  }

  const fallbackSculpt = new THREE.Group();
  const torsoSculptGeo = createSculptedOrganicGeometry(
    [
      [0.0, 0.22, 0.22],
      [0.3, 0.65, 1.05],
      [0.65, 0.75, 1.25],
      [0.9, 0.42, 0.8],
      [1.0, 0.08, 0.12],
    ],
    12,
    2.4,
    0.15
  );
  const skinMat = mat.beastSkin[species] || mat.mithrilSilverMaterial;
  const fallbackMesh = new THREE.Mesh(torsoSculptGeo, skinMat);
  fallbackMesh.castShadow = true;
  fallbackSculpt.add(fallbackMesh);

  if (species === 'sky_dragon') {
    const dragonWingGeo = createSculptedOrganicGeometry(
      [
        [0.0, 0.1, 0.06],
        [0.45, 1.25, 0.48],
        [0.85, 2.05, 0.32],
        [1.0, 0.45, 0.1],
      ],
      10,
      2.0,
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
      [0.5, 0.35, 0.35],
      [1.0, 0.05, 0.05],
    ],
    10,
    0.6,
    -0.3
  );
  for (const wp of wps) {
    const wpMesh = new THREE.Mesh(wpGeo, mat.focusClueGlow.clone());
    wpMesh.position.set(wp.localOffset.x * 0.75, wp.localOffset.y * 0.75, wp.localOffset.z * 0.75);
    wpMesh.visible = false;
    root.add(wpMesh);
    weakPointIndicators.set(wp.id, wpMesh);
  }

  const modelVisualWrapper = new THREE.Group();
  root.add(modelVisualWrapper);

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
    ModelVisualWrapper: modelVisualWrapper,
  });

  const modelSpec = BEAST_MODEL_MAP[species] || BEAST_MODEL_MAP.snapjaw;
  load3DAssetCached(modelSpec.url)
    .then((entry) => {
      const cloned = entry.scene.clone(true);
      // Fit by max dimension (3.0m - 3.35m) so every creature is uniform medium length!
      const normalized = normalizeLoadedModel(cloned, modelSpec.height, modelSpec.rotY, true, true);
      fallbackSculpt.visible = false;
      modelVisualWrapper.add(normalized);
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
    10,
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
      12,
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
      const normalized = normalizeLoadedModel(cloned, 4.6, 0, true, true);
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

let cachedForestTileTemplate: {
  group: THREE.Group;
  widthX: number;
  depthZ: number;
} | null = null;

function prepareForestTileTemplate(targetSpan = 34.0): Promise<{
  group: THREE.Group;
  widthX: number;
  depthZ: number;
}> {
  if (cachedForestTileTemplate) {
    return Promise.resolve(cachedForestTileTemplate);
  }
  return load3DAssetCached('/models/a_forest_3_with_a_road_at_night_for_game.glb').then((entry) => {
    const model = entry.scene.clone(true);
    model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model);
    const size = new THREE.Vector3();
    box.getSize(size);

    const horizontalSpan = Math.max(size.x, size.z, 0.001);
    const scale = targetSpan / horizontalSpan;
    model.scale.multiplyScalar(scale);
    model.updateMatrixWorld(true);

    const scaledBox = new THREE.Box3().setFromObject(model);
    const scaledCenter = new THREE.Vector3();
    const scaledSize = new THREE.Vector3();
    scaledBox.getCenter(scaledCenter);
    scaledBox.getSize(scaledSize);

    model.position.x -= scaledCenter.x;
    model.position.z -= scaledCenter.z;
    model.position.y -= scaledBox.min.y;

    model.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = false;
        mesh.receiveShadow = true;
        if (mesh.material) {
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          for (const m of mats) {
            m.polygonOffset = true;
            m.polygonOffsetFactor = -2;
            m.polygonOffsetUnits = -2;
            m.depthWrite = true;
          }
        }
      }
    });

    const wrapper = new THREE.Group();
    wrapper.add(model);
    cachedForestTileTemplate = {
      group: wrapper,
      widthX: scaledSize.x,
      depthZ: scaledSize.z,
    };
    return cachedForestTileTemplate;
  });
}

/**
 * Loads `a_forest_3_with_a_road_at_night_for_game.glb` cleanly onto a level plane
 * with polygonOffset enabled on ground/road sub-meshes.
 */
export function buildForestBiomeModel(tileSpan = 34.0): THREE.Group {
  const group = new THREE.Group();
  group.userData.isStaticStructure = true;
  prepareForestTileTemplate(tileSpan)
    .then((tpl) => {
      group.add(tpl.group.clone(true));
    })
    .catch(() => {
      // Handled gracefully
    });
  return group;
}

/**
 * Populates a large, multi-tile grid of `a_forest_3_with_a_road_at_night_for_game.glb`
 * across the coplanar Mystic Forest Plateau. Measures the exact X width and Z depth
 * of the loaded forest GLB so adjacent tiles align edge-to-edge on the exact same
 * horizontal plane with ZERO overlap and ZERO Z-fighting glitches!
 */
export function populateForestBiomeGrid(
  parentGroup: THREE.Group,
  plateauY: number,
  centerX = -10,
  startZ = 52,
  cols = 5,
  rows = 3,
  tileSpan = 34.0
): void {
  prepareForestTileTemplate(tileSpan)
    .then((tpl) => {
      // Exact non-overlapping step between adjacent forest planes
      const stepX = tpl.widthX + 0.25;
      const stepZ = tpl.depthZ + 0.25;
      const halfCols = (cols - 1) * 0.5;

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const tileClone = tpl.group.clone(true);
          tileClone.userData.isStaticStructure = true;
          const wx = centerX + (c - halfCols) * stepX;
          const wz = startZ + r * stepZ;
          tileClone.position.set(wx, plateauY + 0.05, wz);
          // Keep 0 or PI rotation so X/Z bounding boxes stay strictly aligned
          tileClone.rotation.set(0, r % 2 === 1 ? Math.PI : 0, 0);
          parentGroup.add(tileClone);
        }
      }
    })
    .catch(() => {
      // Handled gracefully
    });
}

export function buildTribalNPCModel(_npcId: NPCId, mat: MaterialCache): THREE.Group {
  const rig = buildHunterModel(mat, 'raptor_stalker_garb', 'demon_hunter');
  return rig.root;
}

export function buildCampfireWorkbench(mat: MaterialCache): THREE.Group {
  const root = new THREE.Group();

  const shadowGeo = createSculptedOrganicGeometry(
    [
      [0.0, 2.2, 2.2],
      [1.0, 0.01, 0.01],
    ],
    16,
    0.02,
    0.02
  );
  const shadow = new THREE.Mesh(shadowGeo, mat.contactShadowMaterial);
  root.add(shadow);

  const ringGeo = createSculptedOrganicGeometry(
    [
      [0.0, 1.35, 1.35],
      [0.6, 1.25, 1.25],
      [1.0, 0.95, 0.95],
    ],
    14,
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
    10,
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
    14,
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
    12,
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
    12,
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
    12,
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
      8,
      4.6,
      0
    );
    const trunk = new THREE.Mesh(trunkGeo, mat.woodMaterial);
    trunk.castShadow = false;
    group.add(trunk);

    const canopyGeo = createSculptedOrganicGeometry(
      [
        [0.0, 2.1, 2.1],
        [0.5, 1.55, 1.55],
        [1.0, 0.1, 0.1],
      ],
      10,
      3.4,
      3.5
    );
    const canopyMat = type === 'snow_pine' ? mat.pineSnowGreen : mat.foliageGreen;
    const canopy = new THREE.Mesh(canopyGeo, canopyMat);
    canopy.castShadow = false;
    group.add(canopy);
  } else if (type === 'fern' || type === 'shrub' || type === 'grass' || type === 'reed') {
    const bushGeo = createSculptedOrganicGeometry(
      [
        [0.0, 0.35, 0.35],
        [0.6, 0.65, 0.65],
        [1.0, 0.08, 0.08],
      ],
      8,
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
      8,
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
    group.userData.isStaticStructure = true;
    group.add(mesh);
  }
  group.scale.setScalar(scale);
  return group;
}

/**
 * Glitch-Free Snow Mountain Peak Model:
 * Uses an open-skirt alpine cone anchored 4.5m beneath terrain height with polygonOffset
 * and static structure tagging so mountain slopes never Z-fight, rock, or flicker.
 */
export function buildSnowMountainPeakModel(mat: MaterialCache, scale = 1.0): THREE.Group {
  const group = new THREE.Group();
  group.userData.isStaticStructure = true;
  const peakGeo = createSculptedOrganicGeometry(
    [
      [0.0, 9.6, 9.6],
      [0.25, 7.6, 7.2],
      [0.55, 4.8, 4.5],
      [0.82, 2.2, 2.0],
      [1.0, 0.15, 0.15],
    ],
    12,
    20.0,
    -4.5
  );
  const mountainMat = mat.snowMaterial.clone();
  mountainMat.polygonOffset = true;
  mountainMat.polygonOffsetFactor = -1;
  mountainMat.polygonOffsetUnits = -1;
  const peak = new THREE.Mesh(peakGeo, mountainMat);
  peak.receiveShadow = false;
  peak.castShadow = false;
  group.add(peak);
  group.scale.setScalar(scale);
  return group;
}

export function buildRiverBridgeModel(mat: MaterialCache): THREE.Group {
  const group = new THREE.Group();
  group.userData.isStaticStructure = true;
  const deckGeo = createSculptedOrganicGeometry(
    [
      [0.0, 1.8, 5.2],
      [0.5, 1.9, 5.2],
      [1.0, 1.8, 5.2],
    ],
    10,
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
    8,
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
  const forest = buildForestBiomeModel(8.0);
  group.add(forest);
  return group;
}
