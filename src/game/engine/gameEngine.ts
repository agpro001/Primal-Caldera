/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type {
  GameState,
  BiomeType,
  BeastSpecies,
  BeastState,
  PlayerStats,
  WeaponId,
  ArmorId,
  SaveData,
  TrackClue,
  WeatherType,
  WeatherCondition,
  BeastKnowledgeLevel,
} from '../../types/game.ts';
import {
  calculateDamage,
  calculatePlayerDamageTaken,
  calculateStaminaCost,
  isDodgeInvulnerable,
  createBeastWeakPoints,
  getBeastDrops,
  applyWeakPointDamage,
  WEAPON_REGISTRY,
  ARMOR_REGISTRY,
} from '../logic/rules.ts';
import { sound } from '../audio/soundEngine.ts';
import { MaterialCache } from '../graphics/materials.ts';
import {
  buildHunterModel,
  buildBeastModel,
  HunterRig,
  BeastRig,
} from '../graphics/proceduralModels.ts';
import { createTerrain, TerrainSystem } from '../graphics/terrain.ts';
import { WeatherSystem } from './weatherSystem.ts';
import { TrailSystem } from './trailSystem.ts';

export interface EngineCallbacks {
  onStatsChange: (stats: PlayerStats) => void;
  onTargetChange: (target: BeastState | null) => void;
  onNotification: (message: string, type?: 'info' | 'loot' | 'danger') => void;
  onInteractPrompt: (prompt: string | null) => void;
  onOpenCrafting: () => void;
  onQuestUpdate: (questIdx: number) => void;
  onVictory: (stats: { time: number; beastsSlain: number; materialsGathered: number }) => void;
  onDefeat: () => void;
  onFocusChange: (active: boolean) => void;
  onWeaponChange: (weapon: WeaponId) => void;
  onWeatherChange?: (weather: WeatherType) => void;
  onKnowledgeUpdate?: (knowledge: Record<BeastSpecies, BeastKnowledgeLevel>) => void;
}

export class GameEngine {
  private container: HTMLElement;
  private callbacks: EngineCallbacks;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private materialCache: MaterialCache;
  private terrain: TerrainSystem;

  // Player Entity
  public hunter: HunterRig;
  public playerPos: THREE.Vector3 = new THREE.Vector3(0, 1.0, 28);
  public playerVel: THREE.Vector3 = new THREE.Vector3();
  public playerRotation: number = 0;
  public playerStats: PlayerStats;
  public equippedWeapon: WeaponId = 'flint_spear';
  public equippedArmor: ArmorId = 'scavenger_rags';

  // Combat & Movement State
  private playerAction: 'idle' | 'run' | 'attack' | 'dodge' | 'charge' | 'hurt' | 'carve' = 'idle';
  private actionTimer: number = 0;
  private attackCombo: number = 1;
  private chargeDuration: number = 0;
  private isCharging: boolean = false;
  private rollProgress: number = 0;
  private rollDirection: THREE.Vector3 = new THREE.Vector3();
  private focusVision: boolean = false;
  private hitstopTimer: number = 0;
  private cameraShake: number = 0;
  private timeScale: number = 1.0;

  // Beasts
  public beasts: Array<{
    state: BeastState;
    rig: BeastRig;
    targetPos: THREE.Vector3;
    baseSpawn: THREE.Vector3;
    mesh: THREE.Group;
    attackTimer: number;
    recoverTimer: number;
  }> = [];

  // Traps & Projectiles
  private activeTraps: Array<{ id: string; mesh: THREE.Group; x: number; y: number; z: number }> = [];
  private activeProjectiles: Array<{
    mesh: THREE.Mesh;
    pos: THREE.Vector3;
    vel: THREE.Vector3;
    life: number;
    damage: number;
  }> = [];

  // Particles
  private particles: Array<{
    mesh: THREE.Mesh;
    vel: THREE.Vector3;
    life: number;
    maxLife: number;
    color: number;
  }> = [];
  private particlePoolGroup: THREE.Group = new THREE.Group();

  // Environment & Lights
  private sunLight: THREE.DirectionalLight;
  private hemiLight: THREE.HemisphereLight;
  private focusLight: THREE.PointLight;

  // Camera Rig
  public cameraTarget: THREE.Vector3 = new THREE.Vector3();
  public cameraYaw: number = 0;
  public cameraPitch: number = 0.28;
  public cameraDistance: number = 6.5;

  // Input State
  public keys: Map<string, boolean> = new Map();
  public mouseDeltaX: number = 0;
  public mouseDeltaY: number = 0;
  public isMouseDown: boolean = false;
  public isRightMouseDown: boolean = false;
  public virtualMoveX: number = 0;
  public virtualMoveY: number = 0;

  // Session & Quest State
  public gameState: GameState = 'title';
  public currentQuestIndex: number = 0;
  public beastsHunted: string[] = [];
  public signalTowerProgress: number = 0;
  public beaconLit: boolean = false;
  public inventoryMaterials: Record<string, number> = {};
  public beastKnowledge: Record<BeastSpecies, BeastKnowledgeLevel>;
  public weatherSystem: WeatherSystem;
  public trailSystem: TrailSystem;
  private footprintTimer: number = 0;
  private runStartTime: number = Date.now();
  private totalMaterialsGathered: number = 0;

  // Animation Loop Handles
  private animFrameId: number | null = null;
  private lastTime: number = 0;
  private walkCycleTimer: number = 0;

  constructor(container: HTMLElement, saveData: SaveData, callbacks: EngineCallbacks) {
    this.container = container;
    this.callbacks = callbacks;
    this.playerStats = { ...saveData.playerStats };
    this.equippedWeapon = saveData.inventory.equippedWeapon;
    this.equippedArmor = saveData.inventory.equippedArmor;
    this.inventoryMaterials = { ...saveData.inventory.materials };
    this.currentQuestIndex = saveData.currentQuestIndex;
    this.signalTowerProgress = saveData.signalTowerProgress;
    this.beaconLit = saveData.beaconLit;
    this.beastsHunted = [...saveData.beastsHunted];
    this.beastKnowledge = saveData.beastKnowledge || {
      raptor: 'tracked',
      brontoshell: 'tracked',
      thunderhorn: 'tracked',
      caldera_titan: 'tracked',
    };

    this.weatherSystem = new WeatherSystem();
    if (saveData.currentWeather) {
      this.weatherSystem.setWeather(saveData.currentWeather);
    }
    this.trailSystem = new TrailSystem();

    const isHeadless = navigator.webdriver || /HeadlessChrome/i.test(navigator.userAgent);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      powerPreference: 'high-performance',
      antialias: !isHeadless,
      stencil: false,
    });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(isHeadless ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.shadowMap.enabled = !isHeadless;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1820);
    this.scene.fog = new THREE.FogExp2(0x282024, 0.012);

    // Camera
    this.camera = new THREE.PerspectiveCamera(
      56,
      container.clientWidth / container.clientHeight,
      0.1,
      350
    );

    // PMREM Environment
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    // Lighting
    this.hemiLight = new THREE.HemisphereLight(0xffedd5, 0x1f2937, 0.65);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xfff7ed, 1.4);
    this.sunLight.position.set(45, 60, 40);
    this.sunLight.castShadow = !isHeadless;
    this.sunLight.shadow.mapSize.width = 1024;
    this.sunLight.shadow.mapSize.height = 1024;
    this.sunLight.shadow.bias = -0.0005;
    this.sunLight.shadow.normalBias = 0.02;
    this.sunLight.shadow.camera.left = -60;
    this.sunLight.shadow.camera.right = 60;
    this.sunLight.shadow.camera.top = 60;
    this.sunLight.shadow.camera.bottom = -60;
    this.scene.add(this.sunLight);

    // Focus Light for Hunter Instinct vision
    this.focusLight = new THREE.PointLight(0xf59e0b, 0, 15);
    this.scene.add(this.focusLight);

    // Materials & Terrain
    this.materialCache = new MaterialCache();
    this.terrain = createTerrain(this.materialCache);
    this.scene.add(this.terrain.mesh);
    this.scene.add(this.terrain.lavaFlowMesh);
    this.scene.add(this.terrain.foliageGroup);
    this.scene.add(this.terrain.campGroup);
    this.scene.add(this.terrain.towerGroup);
    this.scene.add(this.terrain.clueGroup);
    this.scene.add(this.particlePoolGroup);
    this.scene.add(this.weatherSystem.weatherParticleGroup);
    this.scene.add(this.trailSystem.trailGroup);

    // Hunter Model
    this.hunter = buildHunterModel(this.materialCache);
    this.hunter.updateWeapon(this.equippedWeapon);
    this.hunter.updateArmor(this.equippedArmor);
    this.playerPos.set(saveData.playerPos.x, this.terrain.getHeight(saveData.playerPos.x, saveData.playerPos.z), saveData.playerPos.z);
    this.hunter.root.position.copy(this.playerPos);
    this.scene.add(this.hunter.root);

    // Initialize Colossal Beasts
    this.initBeasts();

    // Pre-allocate particle geometries
    this.initParticles();

    // Pre-warm renderer
    this.renderer.compile(this.scene, this.camera);

    // Bind event listeners
    this.bindEvents();

    // Start loop
    this.lastTime = performance.now();
    this.tick = this.tick.bind(this);
    this.animFrameId = requestAnimationFrame(this.tick);
  }

  private initBeasts() {
    const beastConfigs: Array<{
      id: string;
      species: BeastSpecies;
      name: string;
      title: string;
      x: number;
      z: number;
      hp: number;
      biome: BiomeType;
    }> = [
      {
        id: 'raptor_alpha',
        species: 'raptor',
        name: 'Razor-Crest Raptor Alpha',
        title: 'Pack Terror of the Ravines',
        x: -28,
        z: 48,
        hp: 240,
        biome: 'jungle',
      },
      {
        id: 'bronto_behemoth',
        species: 'brontoshell',
        name: 'Gilded Brontoshell Behemoth',
        title: 'Ancient Carapace of the Black Coast',
        x: 48,
        z: 42,
        hp: 380,
        biome: 'coast',
      },
      {
        id: 'thunderhorn_prime',
        species: 'thunderhorn',
        name: 'Thunderhorn Prime',
        title: 'Earth-Shaker of Steaming Springs',
        x: -42,
        z: -18,
        hp: 520,
        biome: 'springs',
      },
      {
        id: 'caldera_titan_boss',
        species: 'caldera_titan',
        name: 'Ignis Titanus Caldera',
        title: 'Apex Sovereign of the Volcanic Core',
        x: 0,
        z: -88,
        hp: 850,
        biome: 'caldera',
      },
    ];

    beastConfigs.forEach((cfg) => {
      const rig = buildBeastModel(cfg.species, this.materialCache);
      const y = this.terrain.getHeight(cfg.x, cfg.z);
      rig.root.position.set(cfg.x, y, cfg.z);

      const state: BeastState = {
        id: cfg.id,
        species: cfg.species,
        name: cfg.name,
        title: cfg.title,
        x: cfg.x,
        y,
        z: cfg.z,
        rotation: Math.random() * Math.PI * 2,
        hp: cfg.hp,
        maxHp: cfg.hp,
        enraged: false,
        staggered: false,
        staggerTimer: 0,
        attackCooldown: 2.0,
        state: 'patrol',
        currentAttackName: 'Prowl',
        telegraphProgress: 0,
        weakPoints: createBeastWeakPoints(cfg.species),
        drops: getBeastDrops(cfg.species),
        biome: cfg.biome,
        carved: false,
        alertLevel: 0,
      };

      this.scene.add(rig.root);
      this.beasts.push({
        state,
        rig,
        targetPos: new THREE.Vector3(cfg.x, y, cfg.z),
        baseSpawn: new THREE.Vector3(cfg.x, y, cfg.z),
        mesh: rig.root,
        attackTimer: 0,
        recoverTimer: 0,
      });
    });
  }

  private initParticles() {
    const pGeo = new THREE.DodecahedronGeometry(0.08);
    const pMat = new THREE.MeshBasicMaterial({ color: 0xff7700 });
    for (let i = 0; i < 40; i++) {
      const mesh = new THREE.Mesh(pGeo, pMat.clone());
      mesh.visible = false;
      this.particlePoolGroup.add(mesh);
      this.particles.push({
        mesh,
        vel: new THREE.Vector3(),
        life: 0,
        maxLife: 1.0,
        color: 0xff7700,
      });
    }
  }

  public spawnParticles(x: number, y: number, z: number, count: number, color: number, speed: number = 2.5) {
    let spawned = 0;
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      if (p.life <= 0) {
        p.mesh.position.set(x, y, z);
        p.vel.set(
          (Math.random() - 0.5) * speed,
          Math.random() * speed + 0.5,
          (Math.random() - 0.5) * speed
        );
        p.life = 0.4 + Math.random() * 0.4;
        p.maxLife = p.life;
        (p.mesh.material as THREE.MeshBasicMaterial).color.setHex(color);
        p.mesh.visible = true;
        spawned++;
        if (spawned >= count) break;
      }
    }
  }

  private bindEvents() {
    const onKeyDown = (e: KeyboardEvent) => {
      this.keys.set(e.code, true);

      if (e.code === 'KeyF') {
        this.toggleHunterFocus();
      } else if (e.code === 'KeyE') {
        this.handleInteract();
      } else if (e.code === 'KeyQ') {
        this.useHealFlask();
      } else if (e.code === 'KeyT') {
        this.placeTrap();
      } else if (e.code === 'KeyR') {
        this.throwStone();
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      this.keys.set(e.code, false);
    };

    const onMouseDown = (e: MouseEvent) => {
      if (this.gameState !== 'playing') return;
      sound.triggerUserInteraction();
      if (e.button === 0) {
        this.isMouseDown = true;
        this.startSpearAttack();
      } else if (e.button === 2) {
        this.isRightMouseDown = true;
        this.isCharging = true;
      }
    };

    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 0) {
        this.isMouseDown = false;
      } else if (e.button === 2) {
        this.isRightMouseDown = false;
        if (this.isCharging) {
          this.releaseHeavyThrust();
          this.isCharging = false;
        }
      }
    };

    const onMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement === this.renderer.domElement) {
        this.cameraYaw -= e.movementX * 0.0022;
        this.cameraPitch = Math.max(0.05, Math.min(1.2, this.cameraPitch + e.movementY * 0.0022));
      }
    };

    const onBlur = () => {
      this.keys.clear();
      this.isMouseDown = false;
      this.isRightMouseDown = false;
      this.isCharging = false;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('blur', onBlur);

    // Right-click prevent default context menu in game
    this.renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());

    // Click canvas to request pointer lock
    this.renderer.domElement.addEventListener('click', () => {
      if (this.gameState === 'playing' && document.pointerLockElement !== this.renderer.domElement) {
        this.renderer.domElement.requestPointerLock?.();
      }
    });
  }

  public setGameState(state: GameState) {
    this.gameState = state;
    document.body.dataset.state = state;
    if (state !== 'playing' && document.pointerLockElement) {
      document.exitPointerLock?.();
    }
  }

  public toggleHunterFocus() {
    this.focusVision = !this.focusVision;
    sound.playFocusToggle(this.focusVision);
    this.focusLight.intensity = this.focusVision ? 2.5 : 0;
    this.callbacks.onFocusChange(this.focusVision);

    // Reveal glowing scent trails on clues
    this.terrain.clueGroup.children.forEach((c) => {
      c.visible = true;
      c.scale.setScalar(this.focusVision ? 1.4 : 1.0);
    });

    // Reveal beast weak point halos
    this.beasts.forEach((b) => {
      b.rig.weakPointMeshes.forEach((m) => {
        m.scale.setScalar(this.focusVision ? 1.5 : 1.0);
      });
    });

    this.callbacks.onNotification(
      this.focusVision ? "Hunter's Focus Active: Beast weak points and scent trails revealed" : "Hunter's Focus Deactivated",
      'info'
    );
  }

  public startSpearAttack() {
    if (this.playerAction !== 'idle' && this.playerAction !== 'run') return;
    const cost = calculateStaminaCost('light', this.equippedWeapon);
    if (this.playerStats.stamina < cost) {
      this.callbacks.onNotification('Exhausted! Recover stamina', 'danger');
      return;
    }

    this.playerStats.stamina -= cost;
    this.playerAction = 'attack';
    this.actionTimer = 0.38;
    sound.playSpearSwing(false);

    // Check hit immediately on active forward hitbox
    this.checkPlayerAttackHit(false);

    // Combo progression
    this.attackCombo = this.attackCombo === 1 ? 2 : this.attackCombo === 2 ? 3 : 1;
  }

  public releaseHeavyThrust() {
    if (this.playerAction !== 'idle' && this.playerAction !== 'run') return;
    const cost = calculateStaminaCost('heavy', this.equippedWeapon);
    if (this.playerStats.stamina < cost) {
      this.callbacks.onNotification('Not enough stamina for Heavy Thrust!', 'danger');
      return;
    }

    this.playerStats.stamina -= cost;
    this.playerAction = 'attack';
    this.actionTimer = 0.55;
    sound.playSpearSwing(true);
    this.checkPlayerAttackHit(true);
    this.attackCombo = 1;
  }

  public startDodgeRoll() {
    if (this.playerAction === 'dodge' || this.playerAction === 'hurt') return;
    const cost = calculateStaminaCost('dodge', this.equippedWeapon);
    if (this.playerStats.stamina < cost) {
      this.callbacks.onNotification('Too exhausted to dodge!', 'danger');
      return;
    }

    this.playerStats.stamina -= cost;
    this.playerAction = 'dodge';
    this.actionTimer = 0.62;
    this.rollProgress = 0;

    // Determine roll direction based on input or current forward
    const moveX = (this.keys.get('KeyD') ? 1 : 0) - (this.keys.get('KeyA') ? 1 : 0) + this.virtualMoveX;
    const moveZ = (this.keys.get('KeyS') ? 1 : 0) - (this.keys.get('KeyW') ? 1 : 0) + this.virtualMoveY;

    if (Math.hypot(moveX, moveZ) > 0.1) {
      const angle = this.cameraYaw + Math.atan2(moveX, moveZ);
      this.rollDirection.set(Math.sin(angle), 0, Math.cos(angle)).normalize();
    } else {
      this.rollDirection.set(Math.sin(this.playerRotation), 0, Math.cos(this.playerRotation)).normalize();
    }

    sound.playDodge();
    this.spawnParticles(this.playerPos.x, this.playerPos.y + 0.2, this.playerPos.z, 6, 0xd4d4d8, 1.2);
  }

  public useHealFlask() {
    if (this.playerStats.healingFlasks <= 0) {
      this.callbacks.onNotification('No healing salves remaining! Craft more at camp.', 'danger');
      return;
    }
    if (this.playerStats.hp >= this.playerStats.maxHp) {
      this.callbacks.onNotification('Vitality already full!', 'info');
      return;
    }

    this.playerStats.healingFlasks--;
    this.playerStats.hp = Math.min(this.playerStats.maxHp, this.playerStats.hp + this.playerStats.flaskHealAmount);
    sound.playHeal();
    this.spawnParticles(this.playerPos.x, this.playerPos.y + 1.2, this.playerPos.z, 12, 0x10b981, 1.8);
    this.callbacks.onNotification(`Restored ${this.playerStats.flaskHealAmount} HP!`, 'loot');
    this.callbacks.onStatsChange(this.playerStats);
  }

  public placeTrap() {
    if (this.playerStats.traps <= 0) {
      this.callbacks.onNotification('No pitfall traps in satchel! Craft them at Campfire.', 'danger');
      return;
    }

    this.playerStats.traps--;
    const tGroup = new THREE.Group();
    const trapRing = new THREE.Mesh(
      new THREE.RingGeometry(0.8, 1.2, 8),
      new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.9 })
    );
    trapRing.rotation.x = -Math.PI / 2;
    tGroup.add(trapRing);

    // Spikes
    for (let i = 0; i < 4; i++) {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.45, 4), this.materialCache.boneMaterial);
      spike.position.set(Math.cos((i / 4) * Math.PI * 2) * 0.9, 0.2, Math.sin((i / 4) * Math.PI * 2) * 0.9);
      tGroup.add(spike);
    }

    const y = this.terrain.getHeight(this.playerPos.x, this.playerPos.z) + 0.05;
    tGroup.position.set(this.playerPos.x, y, this.playerPos.z);
    this.scene.add(tGroup);

    this.activeTraps.push({
      id: `trap_${Date.now()}`,
      mesh: tGroup,
      x: this.playerPos.x,
      y,
      z: this.playerPos.z,
    });

    sound.playTrapSnap();
    this.callbacks.onNotification('Shock-Vine Pitfall Trap placed!', 'info');
    this.callbacks.onStatsChange(this.playerStats);
  }

  public throwStone() {
    if (this.playerStats.stones <= 0) {
      this.callbacks.onNotification('No throwing stones remaining!', 'info');
      return;
    }

    this.playerStats.stones--;
    const rockGeo = new THREE.DodecahedronGeometry(0.18);
    const rockMesh = new THREE.Mesh(rockGeo, this.materialCache.stoneMaterial);
    rockMesh.position.set(this.playerPos.x, this.playerPos.y + 1.4, this.playerPos.z);
    this.scene.add(rockMesh);

    const fwd = new THREE.Vector3(Math.sin(this.cameraYaw), 0.22, Math.cos(this.cameraYaw)).normalize();
    const vel = fwd.multiplyScalar(22);

    this.activeProjectiles.push({
      mesh: rockMesh,
      pos: rockMesh.position.clone(),
      vel,
      life: 2.2,
      damage: 15,
    });

    sound.playSpearSwing(false);
    this.callbacks.onStatsChange(this.playerStats);
  }

  private checkPlayerAttackHit(isHeavy: boolean) {
    const weapon = WEAPON_REGISTRY[this.equippedWeapon] || WEAPON_REGISTRY.flint_spear;
    const reach = weapon.range;

    // Check against each alive beast
    for (const b of this.beasts) {
      if (b.state.hp <= 0) continue;

      const beastDist = Math.hypot(b.state.x - this.playerPos.x, b.state.z - this.playerPos.z);
      if (beastDist > reach + 2.5) continue;

      // Check facing angle
      const toBeast = new THREE.Vector3(b.state.x - this.playerPos.x, 0, b.state.z - this.playerPos.z).normalize();
      const playerFwd = new THREE.Vector3(Math.sin(this.playerRotation), 0, Math.cos(this.playerRotation)).normalize();
      const dot = playerFwd.dot(toBeast);

      if (dot > 0.45 || beastDist < 2.0) {
        // Successful hit!
        let isWeakPointHit = false;
        let weakMultiplier = 1.0;

        // Check weak point proximity
        for (const wp of b.state.weakPoints) {
          if (!wp.broken) {
            // If facing the weak point sector
            isWeakPointHit = true;
            weakMultiplier = wp.damageMultiplier;
            const res = applyWeakPointDamage(wp, isHeavy ? 60 : 35);
            wp.broken = res.weakPoint.broken;
            wp.accumulatedDamage = res.weakPoint.accumulatedDamage;
            if (res.brokenNow) {
              b.state.staggered = true;
              b.state.staggerTimer = 2.8;
              sound.playBeastRoar(b.state.species, true);
              this.callbacks.onNotification(`${b.state.name}'s ${wp.name} BROKEN! Staggered!`, 'loot');
            }
            break;
          }
        }

        const calc = calculateDamage(
          this.playerStats.attackPower,
          weapon.damage,
          isHeavy,
          isWeakPointHit,
          weakMultiplier,
          b.state.enraged ? 15 : 8,
          this.playerStats.critChance + weapon.critBonus
        );

        b.state.hp = Math.max(0, b.state.hp - calc.damage);
        b.state.alertLevel = 1.0;

        // Visual and Audio feedback
        sound.playHit(calc.isWeakPoint, calc.isCrit);
        b.rig.setHitFlash(true);
        setTimeout(() => b.rig.setHitFlash(false), 80);

        this.spawnParticles(
          b.state.x + (Math.random() - 0.5) * 1.5,
          b.state.y + 1.2,
          b.state.z + (Math.random() - 0.5) * 1.5,
          calc.isCrit || calc.isWeakPoint ? 18 : 8,
          calc.isWeakPoint ? 0xf59e0b : 0xdc2626,
          3.2
        );

        // Simulation Hitstop
        this.hitstopTimer = calc.isCrit || isHeavy ? 0.07 : 0.035;
        this.cameraShake = calc.isCrit || isHeavy ? 0.45 : 0.2;

        // Enrage threshold check (< 40% HP)
        if (b.state.hp < b.state.maxHp * 0.4 && !b.state.enraged) {
          b.state.enraged = true;
          b.rig.setEnraged(true);
          sound.playBeastRoar(b.state.species, true);
          this.callbacks.onNotification(`${b.state.name} ENRAGED! Magma surges through its veins!`, 'danger');
        }

        // Update Beastopedia to observed
        if (this.beastKnowledge[b.state.species] === 'unknown' || this.beastKnowledge[b.state.species] === 'tracked') {
          this.beastKnowledge[b.state.species] = 'observed';
          this.callbacks.onKnowledgeUpdate?.(this.beastKnowledge);
          this.callbacks.onNotification(`Beastopedia Updated: Observed ${b.state.name} combat tactics!`, 'loot');
        }

        // Check beast death
        if (b.state.hp <= 0) {
          b.state.state = 'dead';
          this.beastKnowledge[b.state.species] = 'mastered';
          this.callbacks.onKnowledgeUpdate?.(this.beastKnowledge);
          sound.playBeastRoar(b.state.species, false);
          this.callbacks.onNotification(`COLOSSAL BEAST FELLED: ${b.state.name}! Beastopedia Mastered! Carve [E]`, 'loot');
          if (!this.beastsHunted.includes(b.state.id)) {
            this.beastsHunted.push(b.state.id);
          }
          this.checkQuestMilestones(b.state.species);
        }

        this.callbacks.onTargetChange(b.state);
        break;
      }
    }
  }

  private checkQuestMilestones(slainSpecies: BeastSpecies) {
    if (slainSpecies === 'raptor' && this.currentQuestIndex === 0) {
      this.currentQuestIndex = 1;
      this.callbacks.onQuestUpdate(1);
      this.callbacks.onNotification('Quest Updated: Journey to Black-Sand Coast for Brontoshell!', 'loot');
    } else if (slainSpecies === 'brontoshell' && this.currentQuestIndex === 1) {
      this.currentQuestIndex = 2;
      this.callbacks.onQuestUpdate(2);
      this.callbacks.onNotification('Quest Updated: Ascend to Steaming Springs to track Thunderhorn!', 'loot');
    } else if (slainSpecies === 'thunderhorn' && this.currentQuestIndex === 2) {
      this.currentQuestIndex = 3;
      this.callbacks.onQuestUpdate(3);
      this.callbacks.onNotification('Quest Updated: Summit the High Caldera & repair Signal Tower!', 'loot');
    } else if (slainSpecies === 'caldera_titan' && this.currentQuestIndex >= 4) {
      this.beaconLit = true;
      const flame = this.terrain.towerGroup.getObjectByName('beacon_flame') as THREE.Mesh;
      if (flame) {
        (flame.material as THREE.MeshStandardMaterial).emissive = new THREE.Color(0xff4400);
        (flame.material as THREE.MeshStandardMaterial).emissiveIntensity = 2.0;
        flame.scale.set(2.2, 2.2, 2.2);
      }
      sound.playVictory();
      this.callbacks.onVictory({
        time: Math.round((Date.now() - this.runStartTime) / 1000),
        beastsSlain: this.beastsHunted.length,
        materialsGathered: this.totalMaterialsGathered,
      });
    }
  }

  public handleInteract() {
    // 1. Check near Campfire Workbench (x: 0, z: 25)
    const distToCamp = Math.hypot(this.playerPos.x - 0, this.playerPos.z - 25);
    if (distToCamp < 4.5) {
      // Rest, restore health, open crafting
      this.playerStats.hp = this.playerStats.maxHp;
      this.playerStats.stamina = this.playerStats.maxStamina;
      this.playerStats.healingFlasks = this.playerStats.maxHealingFlasks;
      this.playerStats.stones = 5;
      sound.playHeal();
      this.callbacks.onStatsChange(this.playerStats);
      this.callbacks.onNotification('Rested at Campfire: HP & Vitality Salves restored! Workbench open.', 'loot');
      this.callbacks.onOpenCrafting();
      return;
    }

    // 2. Check near Dead Beasts to Carve
    for (const b of this.beasts) {
      if (b.state.state === 'dead' && !b.state.carved) {
        const dist = Math.hypot(b.state.x - this.playerPos.x, b.state.z - this.playerPos.z);
        if (dist < 4.5) {
          b.state.carved = true;
          this.playerAction = 'carve';
          this.actionTimer = 1.0;
          sound.playCarve();

          // Yield drops
          const drops = b.state.drops;
          const dropTexts: string[] = [];
          for (const [item, count] of Object.entries(drops)) {
            this.inventoryMaterials[item] = (this.inventoryMaterials[item] || 0) + count;
            this.totalMaterialsGathered += count;
            dropTexts.push(`${item.replace('_', ' ')} x${count}`);
          }

          this.spawnParticles(b.state.x, b.state.y + 0.8, b.state.z, 20, 0xf59e0b, 2.5);
          this.callbacks.onNotification(`CARVED ${b.state.name}: ${dropTexts.join(', ')}`, 'loot');
          return;
        }
      }
    }

    // 3. Check near Signal Tower at Caldera Summit (x: 0, z: -95)
    const distToTower = Math.hypot(this.playerPos.x - 0, this.playerPos.z - (-95));
    if (distToTower < 8.0) {
      if (this.signalTowerProgress < 50 && (this.inventoryMaterials['obsidian_shard'] || 0) >= 3) {
        this.inventoryMaterials['obsidian_shard'] -= 3;
        this.signalTowerProgress = 50;
        sound.playHeal();
        this.callbacks.onNotification('Signal Tower Reflector Dish installed! Progress: 50%. Next: Magma Igniter.', 'loot');
      } else if (this.signalTowerProgress === 50 && (this.inventoryMaterials['magma_core'] || 0) >= 1) {
        this.inventoryMaterials['magma_core'] -= 1;
        this.signalTowerProgress = 100;
        this.currentQuestIndex = 4;
        sound.playVictory();
        this.callbacks.onNotification('Signal Tower Prime Igniter Installed! The Caldera Titan awakens!', 'danger');
      } else if (this.signalTowerProgress === 100 && !this.beaconLit) {
        this.callbacks.onNotification('Caldera Titan must be defeated to ignite the summit beacon fire!', 'danger');
      } else {
        this.callbacks.onNotification('Signal Tower requires Obsidian Shards (x3) and Magma Core (x1) to ignite.', 'info');
      }
      return;
    }

    // 4. Check near Track Clues to Inspect
    for (const c of this.terrain.clues) {
      if (!c.inspected) {
        const d = Math.hypot(c.x - this.playerPos.x, c.z - this.playerPos.z);
        if (d < 3.2) {
          c.inspected = true;
          if (this.beastKnowledge[c.species] === 'unknown') {
            this.beastKnowledge[c.species] = 'tracked';
            this.callbacks.onKnowledgeUpdate?.(this.beastKnowledge);
          }
          sound.playHeal();
          this.callbacks.onNotification(
            `Studied Track: Fresh ${c.species.toUpperCase()} ${c.type.replace('_', ' ')}! Added to Beastopedia.`,
            'loot'
          );
          // Highlight track clue brightly
          const clueObj = this.terrain.clueGroup.getObjectByName(c.id);
          if (clueObj) {
            clueObj.scale.set(2, 2, 2);
          }
          return;
        }
      }
    }
  }

  public setEquippedWeapon(id: WeaponId) {
    this.equippedWeapon = id;
    this.hunter.updateWeapon(id);
    this.callbacks.onWeaponChange(id);
    this.callbacks.onNotification(`Equipped ${WEAPON_REGISTRY[id].name}`, 'info');
  }

  public setEquippedArmor(id: ArmorId) {
    this.equippedArmor = id;
    this.hunter.updateArmor(id);
    const def = ARMOR_REGISTRY[id];
    this.playerStats.defense = def.defense;
    this.playerStats.maxStamina = 100 + def.staminaBonus;
    this.callbacks.onStatsChange(this.playerStats);
    this.callbacks.onNotification(`Equipped ${def.name} (Def: ${def.defense})`, 'info');
  }

  private tick(now: number) {
    this.animFrameId = requestAnimationFrame(this.tick);
    const rawDt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    const dt = Math.min(rawDt, 0.05);

    // Hitstop freeze frame
    if (this.hitstopTimer > 0) {
      this.hitstopTimer -= dt;
      this.renderer.render(this.scene, this.camera);
      return;
    }

    // Camera shake decay
    if (this.cameraShake > 0) {
      this.cameraShake = Math.max(0, this.cameraShake - dt * 1.8);
    }

    if (this.gameState === 'playing') {
      const weather = this.weatherSystem.update(dt, this.playerPos, this.sunLight, this.scene);
      this.callbacks.onWeatherChange?.(weather.type);

      this.updatePlayer(dt);
      this.updateBeasts(dt, weather);
      this.updateTraps(dt);
      this.updateProjectiles(dt);
      this.updateParticles(dt);
      this.updateTrails(dt, weather.scentDecayRate);
      this.updateInteractionPrompt();
    } else if (this.gameState === 'title') {
      // Atmospheric circular flyover pan of volcanic island
      const angle = now * 0.00015;
      this.camera.position.set(Math.cos(angle) * 75, 38, Math.sin(angle) * 75);
      this.camera.lookAt(0, 15, -35);
      this.updateParticles(dt);
    }

    if (this.gameState === 'playing') {
      this.updateCamera(dt);
    }

    this.renderer.render(this.scene, this.camera);
  }

  private updatePlayer(dt: number) {
    // 1. Stamina Regeneration
    if (this.playerAction !== 'attack' && this.playerAction !== 'dodge') {
      this.playerStats.stamina = Math.min(
        this.playerStats.maxStamina,
        this.playerStats.stamina + this.playerStats.staminaRegen * dt
      );
    }

    // 2. Action Timers
    if (this.actionTimer > 0) {
      this.actionTimer -= dt;
      if (this.actionTimer <= 0) {
        this.playerAction = 'idle';
      }
    }

    // 3. Movement
    let inputX = (this.keys.get('KeyD') ? 1 : 0) - (this.keys.get('KeyA') ? 1 : 0) + this.virtualMoveX;
    let inputZ = (this.keys.get('KeyS') ? 1 : 0) - (this.keys.get('KeyW') ? 1 : 0) + this.virtualMoveY;

    // Check Dodge Key
    if (this.keys.get('Space')) {
      this.startDodgeRoll();
    }

    if (this.playerAction === 'dodge') {
      this.rollProgress += dt * 1.6;
      const speed = 14.5 * Math.sin(Math.min(Math.PI, this.rollProgress * Math.PI));
      this.playerPos.x += this.rollDirection.x * speed * dt;
      this.playerPos.z += this.rollDirection.z * speed * dt;

      // Dodge roll rotation on torso
      this.hunter.torso.rotation.x = this.rollProgress * Math.PI * 2;
    } else if (this.playerAction !== 'hurt' && this.playerAction !== 'carve') {
      this.hunter.torso.rotation.x = 0;
      const moveLen = Math.hypot(inputX, inputZ);

      if (moveLen > 0.08) {
        const speed = this.playerAction === 'attack' ? 2.5 : 7.2;
        const normX = inputX / moveLen;
        const normZ = inputZ / moveLen;

        // Angle relative to camera
        const moveAngle = this.cameraYaw + Math.atan2(normX, normZ);
        const targetRot = moveAngle;

        // Exponential rotation damp
        this.playerRotation = THREE.MathUtils.damp(this.playerRotation, targetRot, 14, dt);

        this.playerPos.x += Math.sin(moveAngle) * speed * dt;
        this.playerPos.z += Math.cos(moveAngle) * speed * dt;

        if (this.playerAction === 'idle') {
          this.playerAction = 'run';
        }

        // Walk cycle leg animations
        this.walkCycleTimer += dt * speed * 2.2;
        this.hunter.leftLeg.rotation.x = Math.sin(this.walkCycleTimer) * 0.65;
        this.hunter.rightLeg.rotation.x = -Math.sin(this.walkCycleTimer) * 0.65;
        this.hunter.leftArm.rotation.x = -Math.sin(this.walkCycleTimer) * 0.55;

        // Subtle footstep sound & footprint
        if (Math.sin(this.walkCycleTimer) > 0.95) {
          this.footprintTimer += dt;
          if (this.footprintTimer > 0.4) {
            sound.playFootstep();
            this.trailSystem.addFootprint(this.playerPos.x, this.playerPos.y, this.playerPos.z, this.playerRotation, 'hunter');
            this.footprintTimer = 0;
          }
        }
      } else {
        if (this.playerAction === 'run') {
          this.playerAction = 'idle';
        }
        // Idle breathing
        this.hunter.leftLeg.rotation.x = 0;
        this.hunter.rightLeg.rotation.x = 0;
        this.hunter.leftArm.rotation.x = 0;
        this.hunter.torso.position.y = 0.95 + Math.sin(performance.now() * 0.003) * 0.025;
      }
    }

    // Spear attack thrust animation
    if (this.playerAction === 'attack') {
      const progress = 1 - this.actionTimer / 0.38;
      this.hunter.rightArm.rotation.x = Math.sin(progress * Math.PI) * 1.6;
      this.hunter.weaponHolder.position.z = Math.sin(progress * Math.PI) * 0.6;
    } else {
      this.hunter.rightArm.rotation.x = 0.2;
      this.hunter.weaponHolder.position.z = 0.1;
    }

    // Clamp to terrain
    this.playerPos.y = this.terrain.getHeight(this.playerPos.x, this.playerPos.z);
    this.hunter.root.position.copy(this.playerPos);
    this.hunter.root.rotation.y = this.playerRotation;

    // Follow focus light
    this.focusLight.position.set(this.playerPos.x, this.playerPos.y + 2.5, this.playerPos.z);

    // Sync stats to UI
    this.callbacks.onStatsChange(this.playerStats);
  }

  private updateBeasts(dt: number, weather: WeatherCondition) {
    let closestBeast: BeastState | null = null;
    let closestDist = Infinity;

    // 1. Mutual Separation Force to prevent beasts overlapping or clumping
    for (let i = 0; i < this.beasts.length; i++) {
      for (let j = i + 1; j < this.beasts.length; j++) {
        const b1 = this.beasts[i];
        const b2 = this.beasts[j];
        if (b1.state.hp <= 0 || b2.state.hp <= 0) continue;
        const dx = b2.state.x - b1.state.x;
        const dz = b2.state.z - b1.state.z;
        const dist = Math.hypot(dx, dz);
        const minDist = 7.0;
        if (dist > 0.001 && dist < minDist) {
          const push = ((minDist - dist) / minDist) * 3.5 * dt;
          b1.state.x -= (dx / dist) * push;
          b1.state.z -= (dz / dist) * push;
          b2.state.x += (dx / dist) * push;
          b2.state.z += (dz / dist) * push;
        }
      }
    }

    // 2. Individual Beast State Machine & Kinematics
    for (const b of this.beasts) {
      if (b.state.hp <= 0) {
        // Dead beast: smoothly tilt onto side and rest cleanly on ground without clipping
        b.rig.root.rotation.z = THREE.MathUtils.damp(b.rig.root.rotation.z, Math.PI / 2, 5.0, dt);
        const deadYOffset = b.state.species === 'caldera_titan' ? 0.9 : b.state.species === 'brontoshell' ? 0.75 : 0.45;
        b.rig.root.position.set(b.state.x, this.terrain.getHeight(b.state.x, b.state.z) + deadYOffset, b.state.z);
        // Calm all limbs
        b.rig.legs.forEach((leg) => {
          leg.rotation.x = THREE.MathUtils.damp(leg.rotation.x, 0, 8.0, dt);
        });
        if (b.rig.jaw) b.rig.jaw.rotation.x = 0;
        continue;
      }

      const distToPlayer = Math.hypot(this.playerPos.x - b.state.x, this.playerPos.z - b.state.z);
      if (distToPlayer < closestDist) {
        closestDist = distToPlayer;
        closestBeast = b.state;
      }

      // Beast AI influenced by weather
      const aggroRange = (b.state.enraged ? 38 : 26) * weather.beastAwarenessMod;
      const attackRange = b.state.species === 'caldera_titan' ? 7.5 : b.state.species === 'thunderhorn' ? 6.5 : 4.0;
      let isMoving = false;
      const baseSpd = b.state.species === 'raptor' ? 8.5 : b.state.species === 'thunderhorn' ? 6.8 : 4.6;
      const speed = baseSpd * (b.state.enraged ? 1.35 : 1.0) * weather.beastSpeedMod;

      // Decrement attack cooldown
      if (b.state.attackCooldown > 0) {
        b.state.attackCooldown -= dt * (weather.type === 'ash_storm' ? 1.25 : 1.0);
      }

      // Handle Staggered state
      if (b.state.staggered) {
        b.state.staggerTimer -= dt;
        if (b.state.staggerTimer <= 0) {
          b.state.staggered = false;
          b.state.state = 'stalk';
        }
        // Stagger topple posture: head low, torso tilted
        b.rig.torso.rotation.x = THREE.MathUtils.damp(b.rig.torso.rotation.x, 0.42, 6.0, dt);
        if (b.rig.jaw) b.rig.jaw.rotation.x = 0.2;
        // Legs stay planted
        b.rig.legs.forEach((leg) => {
          leg.rotation.x = THREE.MathUtils.damp(leg.rotation.x, 0, 8.0, dt);
        });
        // Ground clamp
        b.state.y = this.terrain.getHeight(b.state.x, b.state.z);
        b.rig.root.position.set(b.state.x, b.state.y, b.state.z);
        b.rig.root.rotation.y = b.state.rotation;
        continue;
      }

      // Combat Behavior when aware
      if (distToPlayer < aggroRange || b.state.alertLevel > 0.2) {
        b.state.alertLevel = 1.0;

        // Turn towards player using shortest-arc angular interpolation (eliminates 360 spinning glitch)
        const targetAngle = Math.atan2(this.playerPos.x - b.state.x, this.playerPos.z - b.state.z);
        let diff = targetAngle - b.state.rotation;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        b.state.rotation += diff * Math.min(1.0, dt * 5.5);

        if (b.state.state === 'telegraph') {
          // 1. TELEGRAPH PHASE: Pre-strike windup
          const telegraphDuration = (b.state.enraged ? 0.55 : 0.85);
          b.state.telegraphProgress += dt / telegraphDuration;

          // Windup telegraph animation: rearing back, fanning quills/jaw
          b.rig.torso.position.y += Math.sin(b.state.telegraphProgress * Math.PI) * 0.06;
          b.rig.torso.rotation.x = -Math.sin(b.state.telegraphProgress * Math.PI) * 0.25;
          if (b.rig.jaw) b.rig.jaw.rotation.x = Math.sin(b.state.telegraphProgress * Math.PI) * 0.45;

          if (b.state.telegraphProgress >= 1.0) {
            // Transition directly into ATTACK strike
            b.state.state = 'attack';
            b.attackTimer = 0.28;
            sound.playBeastRoar(b.state.species, b.state.enraged);

            // Check hit once at strike commitment
            if (distToPlayer <= attackRange + 1.2) {
              if (this.playerAction === 'dodge' && isDodgeInvulnerable(this.rollProgress)) {
                // Glorious Perfect Dodge!
                this.timeScale = 0.35;
                setTimeout(() => (this.timeScale = 1.0), 320);
                sound.playDodge();
                this.callbacks.onNotification('PERFECT DODGE! Beast vulnerable for punish!', 'loot');
              } else {
                const basePower = b.state.species === 'caldera_titan' ? 48 : b.state.species === 'thunderhorn' ? 36 : 28;
                const dmg = calculatePlayerDamageTaken(basePower * (b.state.enraged ? 1.3 : 1.0), this.playerStats.defense);

                this.playerStats.hp = Math.max(0, this.playerStats.hp - dmg);
                sound.playHurt();
                this.cameraShake = 0.65;
                this.spawnParticles(this.playerPos.x, this.playerPos.y + 1.0, this.playerPos.z, 16, 0xef4444, 3.0);

                // Directional Knockback
                this.playerPos.x += Math.sin(b.state.rotation) * 3.5;
                this.playerPos.z += Math.cos(b.state.rotation) * 3.5;
                this.playerAction = 'hurt';
                this.actionTimer = 0.45;

                this.callbacks.onNotification(`Hit by ${b.state.name}! Took ${dmg} damage.`, 'danger');

                if (this.playerStats.hp <= 0) {
                  sound.playDefeat();
                  this.setGameState('gameover');
                  this.callbacks.onDefeat();
                }
              }
            }
          }
        } else if (b.state.state === 'attack') {
          // 2. ATTACK EXECUTION PHASE: Lunge forward with momentum
          b.attackTimer -= dt;
          b.state.x += Math.sin(b.state.rotation) * speed * 1.8 * dt;
          b.state.z += Math.cos(b.state.rotation) * speed * 1.8 * dt;
          if (b.rig.jaw) b.rig.jaw.rotation.x = 0; // snap jaw shut
          b.rig.torso.rotation.x = THREE.MathUtils.damp(b.rig.torso.rotation.x, 0.15, 8.0, dt);

          if (b.attackTimer <= 0) {
            // Transition into RECOVER punish window
            b.state.state = 'recover';
            b.recoverTimer = b.state.species === 'caldera_titan' ? 0.9 : 0.65;
            b.state.attackCooldown = (b.state.enraged ? 2.0 : 3.2) / (weather.type === 'ash_storm' ? 1.2 : 1.0);
          }
        } else if (b.state.state === 'recover') {
          // 3. RECOVER PUNISH WINDOW: Panting / momentarily stationary
          b.recoverTimer -= dt;
          b.rig.torso.rotation.x = THREE.MathUtils.damp(b.rig.torso.rotation.x, 0, 5.0, dt);
          if (b.recoverTimer <= 0) {
            b.state.state = 'stalk';
          }
        } else {
          // 4. STALK / APPROACH PHASE
          b.rig.torso.rotation.x = THREE.MathUtils.damp(b.rig.torso.rotation.x, 0, 5.0, dt);
          if (distToPlayer > attackRange) {
            // Walk toward player
            b.state.x += Math.sin(b.state.rotation) * speed * dt;
            b.state.z += Math.cos(b.state.rotation) * speed * dt;
            b.state.state = 'stalk';
            isMoving = true;

            // Emit beast footprints intermittently
            if (Math.random() < 0.035) {
              this.trailSystem.addFootprint(b.state.x, b.state.y, b.state.z, b.state.rotation, b.state.species);
            }
          } else {
            // Within attack range: initiate telegraph if cooldown ready
            if (b.state.attackCooldown <= 0) {
              b.state.state = 'telegraph';
              b.state.telegraphProgress = 0;
              sound.playTelegraph();
            }
          }
        }
      } else {
        // Idle / Patrol wander around base spawn
        b.state.state = 'patrol';
        b.rig.torso.rotation.x = THREE.MathUtils.damp(b.rig.torso.rotation.x, 0, 4.0, dt);
        const wanderTime = performance.now() * 0.00035 + b.state.x * 0.1;
        const targetX = b.baseSpawn.x + Math.sin(wanderTime) * 8;
        const targetZ = b.baseSpawn.z + Math.cos(wanderTime) * 8;

        const targetWanderAngle = Math.atan2(targetX - b.state.x, targetZ - b.state.z);
        let diff = targetWanderAngle - b.state.rotation;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        b.state.rotation += diff * Math.min(1.0, dt * 2.5);

        const patrolDist = Math.hypot(targetX - b.state.x, targetZ - b.state.z);
        if (patrolDist > 0.5) {
          b.state.x += Math.sin(b.state.rotation) * 2.5 * dt;
          b.state.z += Math.cos(b.state.rotation) * 2.5 * dt;
          isMoving = true;
        }
      }

      // Gait & leg walk cycles: only swing legs when actively walking
      if (isMoving) {
        const walkCycle = performance.now() * 0.006 * speed;
        b.rig.legs.forEach((leg, idx) => {
          leg.rotation.x = Math.sin(walkCycle + (idx % 2 === 0 ? 0 : Math.PI)) * 0.45;
        });
        b.rig.tail.rotation.y = Math.sin(walkCycle * 0.6) * 0.28;
      } else {
        b.rig.legs.forEach((leg) => {
          leg.rotation.x = THREE.MathUtils.damp(leg.rotation.x, 0, 8.0, dt);
        });
        b.rig.tail.rotation.y = THREE.MathUtils.damp(b.rig.tail.rotation.y, 0, 5.0, dt);
      }

      // Ground clamp & root transform
      b.state.y = this.terrain.getHeight(b.state.x, b.state.z);
      b.rig.root.position.set(b.state.x, b.state.y, b.state.z);
      b.rig.root.rotation.y = b.state.rotation;
    }

    this.callbacks.onTargetChange(closestDist < 30 ? closestBeast : null);
  }

  private updateTrails(dt: number, scentDecayRate: number) {
    let closestBeastPos: THREE.Vector3 | null = null;
    let minD = Infinity;

    for (const b of this.beasts) {
      if (b.state.hp > 0) {
        const d = Math.hypot(b.state.x - this.playerPos.x, b.state.z - this.playerPos.z);
        if (d < minD) {
          minD = d;
          closestBeastPos = new THREE.Vector3(b.state.x, b.state.y, b.state.z);
        }
      }
    }

    this.trailSystem.update(dt, this.focusVision, closestBeastPos, this.playerPos, scentDecayRate);
  }

  private updateTraps(dt: number) {
    for (let i = this.activeTraps.length - 1; i >= 0; i--) {
      const trap = this.activeTraps[i];
      for (const b of this.beasts) {
        if (b.state.hp <= 0) continue;
        const d = Math.hypot(b.state.x - trap.x, b.state.z - trap.z);
        if (d < 2.8) {
          // Trigger trap!
          sound.playTrapSnap();
          b.state.staggered = true;
          b.state.staggerTimer = 3.8;
          b.state.hp = Math.max(0, b.state.hp - 45);
          this.spawnParticles(trap.x, trap.y + 0.5, trap.z, 20, 0x854d0e, 3.0);
          this.callbacks.onNotification(`${b.state.name} triggered pitfall trap! Heavily Staggered!`, 'loot');

          this.scene.remove(trap.mesh);
          this.activeTraps.splice(i, 1);
          break;
        }
      }
    }
  }

  private updateProjectiles(dt: number) {
    for (let i = this.activeProjectiles.length - 1; i >= 0; i--) {
      const p = this.activeProjectiles[i];
      p.life -= dt;
      p.vel.y -= 9.8 * dt; // gravity
      p.pos.addScaledVector(p.vel, dt);
      p.mesh.position.copy(p.pos);

      // Check collision with beasts
      for (const b of this.beasts) {
        if (b.state.hp <= 0) continue;
        const dist = Math.hypot(b.state.x - p.pos.x, b.state.z - p.pos.z);
        if (dist < 2.5 && Math.abs(b.state.y + 1.2 - p.pos.y) < 2.5) {
          // Hit beast!
          b.state.hp = Math.max(0, b.state.hp - p.damage);
          b.state.alertLevel = 1.0;
          sound.playHit(false, false);
          this.spawnParticles(p.pos.x, p.pos.y, p.pos.z, 10, 0x64748b, 2.0);
          p.life = 0;
          break;
        }
      }

      if (p.life <= 0 || p.pos.y < this.terrain.getHeight(p.pos.x, p.pos.z)) {
        this.scene.remove(p.mesh);
        this.activeProjectiles.splice(i, 1);
      }
    }
  }

  private updateParticles(dt: number) {
    for (const p of this.particles) {
      if (p.life > 0) {
        p.life -= dt;
        p.mesh.position.addScaledVector(p.vel, dt);
        p.vel.y -= 4.0 * dt;
        const alpha = Math.max(0, p.life / p.maxLife);
        p.mesh.scale.setScalar(alpha);
        if (p.life <= 0) {
          p.mesh.visible = false;
        }
      }
    }
  }

  private updateInteractionPrompt() {
    // 1. Camp
    if (Math.hypot(this.playerPos.x - 0, this.playerPos.z - 25) < 4.5) {
      this.callbacks.onInteractPrompt('Press [E] or Tap to Rest at Campfire & Craft');
      return;
    }
    // 2. Dead Beast
    for (const b of this.beasts) {
      if (b.state.state === 'dead' && !b.state.carved) {
        if (Math.hypot(b.state.x - this.playerPos.x, b.state.z - this.playerPos.z) < 4.5) {
          this.callbacks.onInteractPrompt(`Press [E] or Tap to Carve ${b.state.name}`);
          return;
        }
      }
    }
    // 3. Tower
    if (Math.hypot(this.playerPos.x - 0, this.playerPos.z - (-95)) < 8.0) {
      this.callbacks.onInteractPrompt(
        this.signalTowerProgress < 100
          ? 'Press [E] or Tap to Repair Signal Tower'
          : 'Press [E] or Tap to Ignite Island Beacon'
      );
      return;
    }
    // 4. Clue
    for (const c of this.terrain.clues) {
      if (!c.inspected && Math.hypot(c.x - this.playerPos.x, c.z - this.playerPos.z) < 3.2) {
        this.callbacks.onInteractPrompt(`Press [E] or Tap to Inspect ${c.species} ${c.type}`);
        return;
      }
    }
    this.callbacks.onInteractPrompt(null);
  }

  private updateCamera(dt: number) {
    // Smooth target follow
    const targetY = this.playerPos.y + 1.6;
    this.cameraTarget.x = THREE.MathUtils.damp(this.cameraTarget.x, this.playerPos.x, 12, dt);
    this.cameraTarget.y = THREE.MathUtils.damp(this.cameraTarget.y, targetY, 12, dt);
    this.cameraTarget.z = THREE.MathUtils.damp(this.cameraTarget.z, this.playerPos.z, 12, dt);

    const dist = this.cameraDistance;
    const camX = this.cameraTarget.x - Math.sin(this.cameraYaw) * Math.cos(this.cameraPitch) * dist;
    const camY = this.cameraTarget.y + Math.sin(this.cameraPitch) * dist;
    const camZ = this.cameraTarget.z - Math.cos(this.cameraYaw) * Math.cos(this.cameraPitch) * dist;

    // Ground collision prevention
    const groundH = this.terrain.getHeight(camX, camZ) + 0.8;
    const finalY = Math.max(groundH, camY);

    // Apply trauma shake
    const shakeOffset = this.cameraShake * this.cameraShake * 0.45;
    const sx = (Math.random() - 0.5) * shakeOffset;
    const sy = (Math.random() - 0.5) * shakeOffset;

    this.camera.position.set(camX + sx, finalY + sy, camZ);
    this.camera.lookAt(this.cameraTarget.x, this.cameraTarget.y + 0.3, this.cameraTarget.z);
  }

  public handleResize() {
    if (!this.container || !this.renderer) return;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  public getSaveSnapshot(playerName: string = 'Koa'): SaveData {
    return {
      version: 1,
      timestamp: Date.now(),
      playerName,
      biome: this.terrain.getBiomeAt(this.playerPos.x, this.playerPos.z),
      playerPos: { x: this.playerPos.x, y: this.playerPos.y, z: this.playerPos.z },
      playerStats: { ...this.playerStats },
      inventory: {
        materials: { ...this.inventoryMaterials },
        weapons: ['flint_spear', 'bone_harpoon', 'obsidian_glaive', 'caldera_lance'].filter(
          (w) => w === 'flint_spear' || (this.inventoryMaterials['beast_bone'] || 0) > 0
        ) as WeaponId[],
        equippedWeapon: this.equippedWeapon,
        armors: ['scavenger_rags', 'beast_hide', 'chitin_cuirass', 'caldera_plate'],
        equippedArmor: this.equippedArmor,
        tools: ['bone_knife'],
      },
      beastsHunted: [...this.beastsHunted],
      currentQuestIndex: this.currentQuestIndex,
      signalTowerProgress: this.signalTowerProgress,
      beaconLit: this.beaconLit,
      beastKnowledge: { ...this.beastKnowledge },
      currentWeather: this.weatherSystem.currentWeather,
      settings: {
        mouseSensitivity: 1.0,
        touchSensitivity: 1.2,
        invertY: false,
        masterVolume: 0.8,
        sfxVolume: 0.9,
        musicVolume: 0.7,
        difficulty: 'hunter',
        vibration: true,
      },
    };
  }

  public dispose() {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
    }
    this.renderer.dispose();
  }
}
