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
  WeatherType,
  BeastKnowledgeLevel,
  TrackClue,
  TribalNPC,
} from '../../types/game.ts';
import {
  WEAPON_REGISTRY,
  ARMOR_REGISTRY,
  QUEST_CHAIN,
  calculateDamage,
  calculatePlayerDamageTaken,
  calculateStaminaCost,
  isDodgeInvulnerable,
  applyWeakPointDamage,
  createBeastWeakPoints,
  computeCameraRelativeMovement,
  stepAngleShortestArc,
} from '../logic/rules.ts';
import { MaterialCache } from '../graphics/materials.ts';
import {
  buildHunterModel,
  buildBeastModel,
  buildTribalNPCModel,
  HunterRig,
  BeastRig,
} from '../graphics/proceduralModels.ts';
import {
  createTerrain,
  createInitialTrackClues,
  getTerrainBiome,
  TerrainSystem,
} from '../graphics/terrain.ts';
import { sound } from '../audio/soundEngine.ts';
import { WeatherSystem, WEATHER_CONDITIONS } from './weatherSystem.ts';
import { TrailSystem } from './trailSystem.ts';

export interface EngineCallbacks {
  onStatsChange: (stats: PlayerStats) => void;
  onTargetChange: (beast: BeastState | null) => void;
  onNotification: (message: string, type: 'info' | 'loot' | 'danger') => void;
  onInteractPrompt: (prompt: string | null) => void;
  onOpenCrafting: () => void;
  onQuestUpdate: (questIndex: number) => void;
  onVictory: (stats: { time: number; beastsSlain: number; materialsGathered: number }) => void;
  onDefeat: () => void;
  onFocusChange: (active: boolean) => void;
  onWeaponChange: (weaponId: WeaponId) => void;
  onWeatherChange?: (weather: WeatherType) => void;
  onKnowledgeUpdate?: (knowledge: Record<BeastSpecies, BeastKnowledgeLevel>) => void;
}

interface ActiveBeastActor {
  state: BeastState;
  rig: BeastRig;
  homeX: number;
  homeZ: number;
  patrolAngle: number;
  chargeDirX: number;
  chargeDirZ: number;
  hitThisSwing: boolean;
}

interface ActiveNPCActor {
  data: TribalNPC;
  mesh: THREE.Group;
}

interface LureStoneProjectile {
  mesh: THREE.Mesh;
  vx: number;
  vy: number;
  vz: number;
  age: number;
  landed: boolean;
}

interface PlacedTrap {
  mesh: THREE.Group;
  x: number;
  z: number;
  active: boolean;
}

interface ParticleBurst {
  mesh: THREE.Mesh;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
}

export class GameEngine {
  private container: HTMLElement;
  private callbacks: EngineCallbacks;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private materialCache: MaterialCache;
  private terrain: TerrainSystem;
  private hunter: HunterRig;
  private weatherSystem: WeatherSystem;
  private trailSystem: TrailSystem;

  // Lights
  private hemiLight: THREE.HemisphereLight;
  private sunLight: THREE.DirectionalLight;
  private focusLight: THREE.PointLight;

  // Game State
  public gameState: GameState = 'title';
  public playerStats: PlayerStats;
  public equippedWeapon: WeaponId = 'flint_spear';
  public equippedArmor: ArmorId = 'scavenger_rags';
  public inventoryMaterials: Record<string, number> = {};
  public ownedWeapons: WeaponId[] = ['flint_spear'];
  public ownedArmors: ArmorId[] = ['scavenger_rags'];
  public currentQuestIndex = 0;
  public signalTowerProgress = 0;
  public beaconLit = false;
  public beastsHunted: BeastSpecies[] = [];
  public beastKnowledge: Record<BeastSpecies, BeastKnowledgeLevel> = {
    raptor: 'tracked',
    brontoshell: 'tracked',
    thunderhorn: 'tracked',
    frostfang: 'tracked',
    snapjaw: 'tracked',
    caldera_titan: 'tracked',
  };

  // Player Transform & Movement
  public playerPos = new THREE.Vector3(0, 1.8, 28);
  public playerRotation = 0;
  public cameraYaw = 0;
  public cameraPitch = 0.36;
  private cameraDistance = 7.8;
  private cameraShakeIntensity = 0;

  // Player Action States
  private keysPressed = new Set<string>();
  public virtualMoveX = 0;
  public virtualMoveY = 0;
  private isDodging = false;
  private dodgeTimer = 0;
  private dodgeDirX = 0;
  private dodgeDirZ = 1;
  private isAttacking = false;
  private isHeavyAttack = false;
  private attackTimer = 0;
  private isChargingHeavy = false;
  private heavyChargeTime = 0;
  public focusVisionActive = false;
  private focusTimer = 0;

  // Entities
  public beasts: ActiveBeastActor[] = [];
  public npcs: ActiveNPCActor[] = [];
  private clues: { data: TrackClue; mesh: THREE.Group }[] = [];
  private traps: PlacedTrap[] = [];
  private projectiles: LureStoneProjectile[] = [];
  private particles: ParticleBurst[] = [];
  private particlePoolGroup = new THREE.Group();

  // Loop
  private animFrameId = 0;
  private lastTime = 0;
  private elapsedRunTime = 0;
  private totalMaterialsGathered = 0;
  private titleOrbitAngle = 0;
  private isPointerDown = false;
  private lastPointerX = 0;
  private lastPointerY = 0;

  constructor(container: HTMLElement, saveData: SaveData, callbacks: EngineCallbacks) {
    this.container = container;
    this.callbacks = callbacks;
    this.playerStats = { ...saveData.playerStats };
    this.equippedWeapon = saveData.inventory.equippedWeapon;
    this.equippedArmor = saveData.inventory.equippedArmor;
    this.ownedWeapons = [...saveData.inventory.weapons];
    this.ownedArmors = [...saveData.inventory.armors];
    this.inventoryMaterials = { ...saveData.inventory.materials };
    this.currentQuestIndex = saveData.currentQuestIndex;
    this.signalTowerProgress = saveData.signalTowerProgress;
    this.beaconLit = saveData.beaconLit;
    this.beastsHunted = [...saveData.beastsHunted];
    this.beastKnowledge = saveData.beastKnowledge
      ? { ...saveData.beastKnowledge }
      : {
          raptor: 'tracked',
          brontoshell: 'tracked',
          thunderhorn: 'tracked',
          frostfang: 'tracked',
          snapjaw: 'tracked',
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
    this.scene.fog = new THREE.FogExp2(0x282024, 0.0085);

    // Camera
    this.camera = new THREE.PerspectiveCamera(
      56,
      container.clientWidth / container.clientHeight,
      0.1,
      460
    );

    // PMREM Environment
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.28;
    pmrem.dispose();

    // Lighting
    this.hemiLight = new THREE.HemisphereLight(0xffedd5, 0x1f2937, 0.55);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xfff7ed, 1.35);
    this.sunLight.position.set(45, 65, 40);
    this.sunLight.castShadow = !isHeadless;
    this.sunLight.shadow.mapSize.width = 1024;
    this.sunLight.shadow.mapSize.height = 1024;
    this.sunLight.shadow.bias = -0.0005;
    this.sunLight.shadow.normalBias = 0.02;
    this.sunLight.shadow.camera.left = -75;
    this.sunLight.shadow.camera.right = 75;
    this.sunLight.shadow.camera.top = 75;
    this.sunLight.shadow.camera.bottom = -75;
    this.scene.add(this.sunLight);

    // Focus Light for Hunter Instinct vision
    this.focusLight = new THREE.PointLight(0xf59e0b, 0, 16);
    this.scene.add(this.focusLight);

    // Materials & Terrain (including 3D Ocean, Winding River, Cold Snow Mountains, Trees, Stones, Shrubs)
    this.materialCache = new MaterialCache();
    this.terrain = createTerrain(this.materialCache);
    this.scene.add(this.terrain.mesh);
    this.scene.add(this.terrain.oceanMesh);
    this.scene.add(this.terrain.riverMesh);
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
    this.playerPos.set(
      saveData.playerPos.x,
      this.terrain.getHeight(saveData.playerPos.x, saveData.playerPos.z),
      saveData.playerPos.z
    );
    this.hunter.root.position.copy(this.playerPos);
    this.scene.add(this.hunter.root);

    // Initialize Tribal Characters (NPCs)
    this.initNPCs();

    // Initialize All 6 Prehistoric Beasts
    this.initBeasts();

    // Pre-allocate particle geometries
    this.initParticles();

    // Pre-warm renderer
    this.renderer.compile(this.scene, this.camera);

    // Bind event listeners
    this.bindEvents();

    // Expose deterministic test & inspection hooks
    (window as any).__PRIMAL_ENGINE__ = this;
    (window as any).__gameTest = {
      getState: () => ({
        gameState: this.gameState,
        playerPos: { x: this.playerPos.x, y: this.playerPos.y, z: this.playerPos.z },
        playerRotation: this.playerRotation,
        cameraYaw: this.cameraYaw,
        virtualMove: { x: this.virtualMoveX, y: this.virtualMoveY },
        biome: getTerrainBiome(this.playerPos.x, this.playerPos.z),
        beasts: this.beasts.map((b) => ({
          id: b.state.id,
          species: b.state.species,
          name: b.state.name,
          biome: b.state.biome,
          x: b.state.x,
          z: b.state.z,
          hp: b.state.hp,
        })),
        npcs: this.npcs.map((n) => ({
          id: n.data.id,
          name: n.data.name,
          x: n.data.x,
          z: n.data.z,
        })),
      }),
      setVirtualMove: (x: number, y: number) => {
        this.virtualMoveX = x;
        this.virtualMoveY = y;
      },
      teleport: (x: number, z: number, yaw = 0) => {
        this.playerPos.set(x, this.terrain.getHeight(x, z), z);
        this.hunter.root.position.copy(this.playerPos);
        this.cameraYaw = yaw;
      },
    };

    // Start loop
    this.lastTime = performance.now();
    this.tick = this.tick.bind(this);
    this.animFrameId = requestAnimationFrame(this.tick);
  }

  private initNPCs() {
    const npcConfigs: TribalNPC[] = [
      {
        id: 'chief_kael',
        name: 'Elder Chief Kael',
        role: 'Tribal Chieftain & Lorekeeper',
        x: -3.2,
        y: 0,
        z: 24.2,
        rotation: 0.45,
        biome: 'jungle',
        greeting: 'Chief Kael: "Walk with the wind, Koa! East lie the Cold Snow Mountains & Frostfang Mammoth; north flows the Crystal River where the Snapjaw Leviathan lurks."',
        giftMaterial: { id: 'beast_bone', count: 3, claimed: false },
      },
      {
        id: 'smith_torak',
        name: 'Forge-Master Torak',
        role: 'Obsidian & Bone Weaponsmith',
        x: 3.2,
        y: 0,
        z: 24.5,
        rotation: -0.5,
        biome: 'jungle',
        greeting: 'Torak: "Bring me Raptor Claws, Brontoshell Plates, or Frostfang Ivory and I will forge you weapons fit for the Caldera Titan!"',
        giftMaterial: { id: 'obsidian_shard', count: 2, claimed: false },
      },
      {
        id: 'scout_lyra',
        name: 'Scout Lyra',
        role: 'River Pathfinder & Herbalist',
        x: -13.5,
        y: 0,
        z: 16.8,
        rotation: 2.6,
        biome: 'river',
        greeting: 'Scout Lyra: "Watch the turquoise river shallows! The River Snapjaw Leviathan strikes from the water, and upstream in the snow peaks roams the Frostfang Mammoth."',
        giftMaterial: { id: 'sun_herb', count: 3, claimed: false },
      },
    ];

    npcConfigs.forEach((cfg) => {
      cfg.y = this.terrain.getHeight(cfg.x, cfg.z);
      const mesh = buildTribalNPCModel(cfg.id, this.materialCache);
      mesh.position.set(cfg.x, cfg.y, cfg.z);
      mesh.rotation.y = cfg.rotation;
      this.scene.add(mesh);
      this.npcs.push({ data: cfg, mesh });
    });
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
        x: -26,
        z: 46,
        hp: 240,
        biome: 'jungle',
      },
      {
        id: 'snapjaw_leviathan',
        species: 'snapjaw',
        name: 'River Snapjaw Leviathan',
        title: 'Amphibious Predator of River & Ocean',
        x: -22,
        z: 14,
        hp: 340,
        biome: 'river',
      },
      {
        id: 'bronto_behemoth',
        species: 'brontoshell',
        name: 'Gilded Brontoshell Behemoth',
        title: 'Ancient Carapace of the Black Coast',
        x: 42,
        z: 38,
        hp: 380,
        biome: 'coast',
      },
      {
        id: 'frostfang_mammoth',
        species: 'frostfang',
        name: 'Frostfang Glacial Mammoth',
        title: 'Colossus of the Cold Snow Mountains',
        x: 58,
        z: -18,
        hp: 490,
        biome: 'snow',
      },
      {
        id: 'thunderhorn_prime',
        species: 'thunderhorn',
        name: 'Thunderhorn Ceratopsian Prime',
        title: 'Warden of the Geothermal Springs',
        x: -44,
        z: -16,
        hp: 460,
        biome: 'springs',
      },
      {
        id: 'caldera_titan_boss',
        species: 'caldera_titan',
        name: 'Ignis-Rex, The Caldera Titan',
        title: 'Sovereign of the Molten Summit',
        x: 0,
        z: -62,
        hp: 680,
        biome: 'caldera',
      },
    ];

    beastConfigs.forEach((cfg) => {
      const rig = buildBeastModel(cfg.species, this.materialCache);
      const y = this.terrain.getHeight(cfg.x, cfg.z);
      rig.root.position.set(cfg.x, y, cfg.z);
      this.scene.add(rig.root);

      const weakPoints = createBeastWeakPoints(cfg.species);
      weakPoints.forEach((wp) => {
        const indicator = new THREE.Mesh(
          new THREE.SphereGeometry(wp.radius * 0.45, 10, 10),
          this.materialCache.weakPointGlow
        );
        indicator.position.set(wp.localOffset.x, wp.localOffset.y, wp.localOffset.z);
        indicator.visible = false;
        rig.root.add(indicator);
        rig.weakPointIndicators.set(wp.id, indicator);
      });

      const state: BeastState = {
        id: cfg.id,
        species: cfg.species,
        name: cfg.name,
        title: cfg.title,
        biome: cfg.biome,
        hp: cfg.hp,
        maxHp: cfg.hp,
        stamina: 100,
        maxStamina: 100,
        enraged: false,
        aiState: 'patrol',
        stateTimer: 0,
        x: cfg.x,
        y,
        z: cfg.z,
        rotation: 0,
        weakPoints,
        carved: false,
        snaredTimer: 0,
      };

      this.beasts.push({
        state,
        rig,
        homeX: cfg.x,
        homeZ: cfg.z,
        patrolAngle: 0,
        chargeDirX: 0,
        chargeDirZ: 1,
        hitThisSwing: false,
      });
    });

    // Track Clues
    const initialClues = createInitialTrackClues();
    initialClues.forEach((clue) => {
      const group = new THREE.Group();
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.65, 0.08, 8, 16),
        this.materialCache.focusClueGlow
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.15;
      group.add(ring);
      group.position.set(clue.x, clue.y, clue.z);
      this.terrain.clueGroup.add(group);
      this.clues.push({ data: clue, mesh: group });
    });
  }

  private initParticles() {
    const geo = new THREE.BoxGeometry(0.18, 0.18, 0.18);
    for (let i = 0; i < 40; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: 0xf97316 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.visible = false;
      this.particlePoolGroup.add(mesh);
      this.particles.push({
        mesh,
        vx: 0,
        vy: 0,
        vz: 0,
        life: 0,
        maxLife: 0.5,
      });
    }
  }

  public spawnParticles(x: number, y: number, z: number, colorHex: number, count = 8) {
    let spawned = 0;
    for (const p of this.particles) {
      if (p.life <= 0) {
        p.mesh.position.set(x, y, z);
        (p.mesh.material as THREE.MeshBasicMaterial).color.setHex(colorHex);
        p.mesh.visible = true;
        const angle = Math.random() * Math.PI * 2;
        const speed = 2 + Math.random() * 4;
        p.vx = Math.cos(angle) * speed;
        p.vy = 2 + Math.random() * 4;
        p.vz = Math.sin(angle) * speed;
        p.maxLife = 0.4 + Math.random() * 0.3;
        p.life = p.maxLife;
        spawned++;
        if (spawned >= count) break;
      }
    }
  }

  private bindEvents() {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    this.renderer.domElement.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    this.renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  private onKeyDown = (e: KeyboardEvent) => {
    this.keysPressed.add(e.code);
    if (this.gameState !== 'playing') return;

    if (e.code === 'Space') {
      e.preventDefault();
      this.startDodgeRoll();
    } else if (e.code === 'KeyF') {
      this.toggleHunterFocus();
    } else if (e.code === 'KeyQ') {
      this.useHealFlask();
    } else if (e.code === 'KeyT') {
      this.placeTrap();
    } else if (e.code === 'KeyR') {
      this.throwStone();
    } else if (e.code === 'KeyE') {
      this.handleInteract();
    }
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keysPressed.delete(e.code);
  };

  private onPointerDown = (e: PointerEvent) => {
    sound.triggerUserInteraction();
    if (this.gameState !== 'playing') return;
    if (e.button === 0) {
      this.isPointerDown = true;
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;
      this.startSpearAttack();
    } else if (e.button === 2) {
      this.isChargingHeavy = true;
      this.heavyChargeTime = 0;
    }
  };

  private onPointerMove = (e: PointerEvent) => {
    if (this.gameState !== 'playing') return;
    if (this.isPointerDown || document.pointerLockElement === this.renderer.domElement) {
      const dx = e.movementX || e.clientX - this.lastPointerX;
      const dy = e.movementY || e.clientY - this.lastPointerY;
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;
      this.cameraYaw -= dx * 0.0045;
      this.cameraPitch = Math.max(0.08, Math.min(1.15, this.cameraPitch + dy * 0.0035));
    }
  };

  private onPointerUp = (e: PointerEvent) => {
    if (e.button === 0) {
      this.isPointerDown = false;
    } else if (e.button === 2 && this.isChargingHeavy) {
      this.releaseHeavyThrust();
    }
  };

  public startSpearAttack() {
    if (this.isAttacking || this.isDodging) return;
    const weapon = WEAPON_REGISTRY[this.equippedWeapon];
    const armor = ARMOR_REGISTRY[this.equippedArmor];
    const cost = calculateStaminaCost('light', weapon, armor);
    if (this.playerStats.stamina < cost) {
      this.callbacks.onNotification('Low Stamina!', 'danger');
      return;
    }
    this.playerStats.stamina -= cost;
    this.isAttacking = true;
    this.isHeavyAttack = false;
    this.attackTimer = 0.34;
    this.beasts.forEach((b) => (b.hitThisSwing = false));
    sound.playSpearSwing(false);
    this.callbacks.onStatsChange(this.playerStats);
  }

  public releaseHeavyThrust() {
    this.isChargingHeavy = false;
    if (this.isAttacking || this.isDodging) return;
    const weapon = WEAPON_REGISTRY[this.equippedWeapon];
    const armor = ARMOR_REGISTRY[this.equippedArmor];
    const cost = calculateStaminaCost('heavy', weapon, armor);
    if (this.playerStats.stamina < cost) {
      this.callbacks.onNotification('Not enough stamina for Heavy Thrust!', 'danger');
      return;
    }
    this.playerStats.stamina -= cost;
    this.isAttacking = true;
    this.isHeavyAttack = true;
    this.attackTimer = 0.48;
    this.beasts.forEach((b) => (b.hitThisSwing = false));
    sound.playSpearSwing(true);
    this.callbacks.onStatsChange(this.playerStats);
  }

  public startDodgeRoll() {
    if (this.isDodging) return;
    const weapon = WEAPON_REGISTRY[this.equippedWeapon];
    const armor = ARMOR_REGISTRY[this.equippedArmor];
    const cost = calculateStaminaCost('dodge', weapon, armor);
    if (this.playerStats.stamina < cost) return;

    this.playerStats.stamina -= cost;
    this.isDodging = true;
    this.isAttacking = false;
    this.dodgeTimer = 0.46;
    this.dodgeDirX = Math.sin(this.playerRotation);
    this.dodgeDirZ = Math.cos(this.playerRotation);
    sound.playDodgeRoll();
    this.callbacks.onStatsChange(this.playerStats);
  }

  public useHealFlask() {
    if (this.playerStats.healingFlasks <= 0) {
      this.callbacks.onNotification('No Vitality Salves remaining! Craft more at camp.', 'danger');
      return;
    }
    if (this.playerStats.hp >= this.playerStats.maxHp) return;
    this.playerStats.healingFlasks--;
    this.playerStats.hp = Math.min(this.playerStats.maxHp, this.playerStats.hp + 65);
    sound.playHeal();
    this.spawnParticles(this.playerPos.x, this.playerPos.y + 1, this.playerPos.z, 0x22c55e, 12);
    this.callbacks.onNotification('Used Vitality Salve (+65 HP)', 'loot');
    this.callbacks.onStatsChange(this.playerStats);
  }

  public placeTrap() {
    if (this.playerStats.traps <= 0) {
      this.callbacks.onNotification('No Sinew Snare Traps remaining!', 'danger');
      return;
    }
    this.playerStats.traps--;
    const trapGroup = new THREE.Group();
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.1, 0.08, 8, 18),
      this.materialCache.boneMaterial
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.12;
    trapGroup.add(ring);
    trapGroup.position.set(this.playerPos.x, this.playerPos.y, this.playerPos.z);
    this.scene.add(trapGroup);
    this.traps.push({ mesh: trapGroup, x: this.playerPos.x, z: this.playerPos.z, active: true });
    sound.playTrapPlace();
    this.callbacks.onNotification('Placed Sinew Snare Trap!', 'info');
    this.callbacks.onStatsChange(this.playerStats);
  }

  public throwStone() {
    if (this.playerStats.lureStones <= 0) return;
    this.playerStats.lureStones--;
    const stoneMesh = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.18, 0),
      this.materialCache.stoneMaterial
    );
    stoneMesh.position.set(this.playerPos.x, this.playerPos.y + 1.4, this.playerPos.z);
    this.scene.add(stoneMesh);

    const forwardX = Math.sin(this.playerRotation);
    const forwardZ = Math.cos(this.playerRotation);
    this.projectiles.push({
      mesh: stoneMesh,
      vx: forwardX * 16,
      vy: 6.5,
      vz: forwardZ * 16,
      age: 0,
      landed: false,
    });
    this.callbacks.onStatsChange(this.playerStats);
  }

  public toggleHunterFocus() {
    this.focusVisionActive = !this.focusVisionActive;
    this.focusTimer = this.focusVisionActive ? 10 : 0;
    sound.playFocusPulse();
    this.callbacks.onFocusChange(this.focusVisionActive);
    this.beasts.forEach((b) => {
      b.rig.weakPointIndicators.forEach((mesh, id) => {
        const wp = b.state.weakPoints.find((w) => w.id === id);
        mesh.visible = this.focusVisionActive && !!wp && !wp.broken && b.state.hp > 0;
      });
    });
  }

  public handleInteract() {
    // 1. Check Tribal NPCs Conversation & Gift
    for (const npc of this.npcs) {
      const dist = Math.hypot(this.playerPos.x - npc.data.x, this.playerPos.z - npc.data.z);
      if (dist < 4.2) {
        sound.playGather();
        if (npc.data.giftMaterial && !npc.data.giftMaterial.claimed) {
          npc.data.giftMaterial.claimed = true;
          const matId = npc.data.giftMaterial.id;
          const cnt = npc.data.giftMaterial.count;
          this.inventoryMaterials[matId] = (this.inventoryMaterials[matId] || 0) + cnt;
          this.callbacks.onNotification(`${npc.data.greeting} (+${cnt} ${matId.replace('_', ' ')})`, 'loot');
        } else {
          this.callbacks.onNotification(npc.data.greeting, 'info');
        }
        return;
      }
    }

    // 2. Check Campfire Workbench (0, 28)
    const distCamp = Math.hypot(this.playerPos.x - 0, this.playerPos.z - 28);
    if (distCamp < 5.2) {
      this.playerStats.hp = this.playerStats.maxHp;
      this.playerStats.stamina = this.playerStats.maxStamina;
      this.playerStats.healingFlasks = Math.max(this.playerStats.healingFlasks, 3);
      this.playerStats.lureStones = 5;
      this.callbacks.onStatsChange(this.playerStats);
      this.callbacks.onOpenCrafting();
      return;
    }

    // 3. Check Signal Tower (0, 5)
    const distTower = Math.hypot(this.playerPos.x - 0, this.playerPos.z - 5);
    if (distTower < 6.0) {
      if (this.beastsHunted.includes('caldera_titan') || (this.inventoryMaterials.titan_fang || 0) > 0) {
        this.beaconLit = true;
        this.signalTowerProgress = 3;
        this.terrain.updateTowerStage(3, true);
        sound.playVictoryFanfare();
        this.callbacks.onVictory({
          time: Math.round(this.elapsedRunTime),
          beastsSlain: this.beastsHunted.length,
          materialsGathered: this.totalMaterialsGathered,
        });
      } else {
        this.callbacks.onNotification(
          'Slay Ignis-Rex the Caldera Titan or craft the Beacon at Campfire to ignite the Signal Tower!',
          'info'
        );
      }
      return;
    }

    // 4. Check Carve Fallen Beasts
    for (const actor of this.beasts) {
      if (actor.state.hp <= 0 && !actor.state.carved) {
        const dist = Math.hypot(this.playerPos.x - actor.state.x, this.playerPos.z - actor.state.z);
        if (dist < 5.2) {
          actor.state.carved = true;
          sound.playGather();
          this.grantBeastCarveDrops(actor.state.species);
          return;
        }
      }
    }

    // 5. Check Track Clues
    for (const c of this.clues) {
      if (!c.data.discovered) {
        const dist = Math.hypot(this.playerPos.x - c.data.x, this.playerPos.z - c.data.z);
        if (dist < 4.2) {
          c.data.discovered = true;
          c.mesh.visible = false;
          sound.playGather();
          this.inventoryMaterials.sun_herb = (this.inventoryMaterials.sun_herb || 0) + 1;
          this.totalMaterialsGathered++;
          this.upgradeKnowledge(c.data.species, 'sighted');
          this.callbacks.onNotification(`Track Examined: ${c.data.description} (+1 Sun-Herb)`, 'loot');
          return;
        }
      }
    }
  }

  private grantBeastCarveDrops(species: BeastSpecies) {
    if (species === 'raptor') {
      this.inventoryMaterials.raptor_claw = (this.inventoryMaterials.raptor_claw || 0) + 2;
      this.inventoryMaterials.raptor_hide = (this.inventoryMaterials.raptor_hide || 0) + 2;
      this.inventoryMaterials.beast_bone = (this.inventoryMaterials.beast_bone || 0) + 2;
      this.callbacks.onNotification('Carved: +2 Raptor Talon, +2 Raptor Hide, +2 Beast Bone!', 'loot');
    } else if (species === 'snapjaw') {
      this.inventoryMaterials.raptor_claw = (this.inventoryMaterials.raptor_claw || 0) + 2;
      this.inventoryMaterials.coral_stone = (this.inventoryMaterials.coral_stone || 0) + 2;
      this.inventoryMaterials.beast_bone = (this.inventoryMaterials.beast_bone || 0) + 3;
      this.callbacks.onNotification('Carved River Snapjaw: +2 Talon, +2 Coral Stone, +3 Beast Bone!', 'loot');
    } else if (species === 'brontoshell') {
      this.inventoryMaterials.bronto_shell = (this.inventoryMaterials.bronto_shell || 0) + 2;
      this.inventoryMaterials.coral_stone = (this.inventoryMaterials.coral_stone || 0) + 2;
      this.callbacks.onNotification('Carved: +2 Brontoshell Carapace, +2 Coral Stone!', 'loot');
    } else if (species === 'frostfang') {
      this.inventoryMaterials.thunder_horn = (this.inventoryMaterials.thunder_horn || 0) + 2;
      this.inventoryMaterials.obsidian_shard = (this.inventoryMaterials.obsidian_shard || 0) + 2;
      this.inventoryMaterials.beast_bone = (this.inventoryMaterials.beast_bone || 0) + 3;
      this.callbacks.onNotification('Carved Frostfang Mammoth: +2 Glacial Ivory Horn, +2 Obsidian, +3 Bone!', 'loot');
    } else if (species === 'thunderhorn') {
      this.inventoryMaterials.thunder_horn = (this.inventoryMaterials.thunder_horn || 0) + 2;
      this.inventoryMaterials.obsidian_shard = (this.inventoryMaterials.obsidian_shard || 0) + 3;
      this.callbacks.onNotification('Carved: +2 Conductive Crest-Horn, +3 Obsidian Shard!', 'loot');
    } else if (species === 'caldera_titan') {
      this.inventoryMaterials.titan_fang = (this.inventoryMaterials.titan_fang || 0) + 2;
      this.inventoryMaterials.magma_core = (this.inventoryMaterials.magma_core || 0) + 2;
      this.callbacks.onNotification('Carved: +2 Sovereign Titan Fang, +2 Apex Magma Heart!', 'loot');
    }
    this.totalMaterialsGathered += 5;
  }

  private upgradeKnowledge(species: BeastSpecies, level: BeastKnowledgeLevel) {
    const order: BeastKnowledgeLevel[] = ['unseen', 'tracked', 'sighted', 'mastered'];
    const currIdx = order.indexOf(this.beastKnowledge[species] || 'tracked');
    const nextIdx = order.indexOf(level);
    if (nextIdx > currIdx) {
      this.beastKnowledge[species] = level;
      this.callbacks.onKnowledgeUpdate?.({ ...this.beastKnowledge });
    }
  }

  public setEquippedWeapon(id: WeaponId) {
    this.equippedWeapon = id;
    if (!this.ownedWeapons.includes(id)) this.ownedWeapons.push(id);
    const def = WEAPON_REGISTRY[id];
    this.playerStats.attackPower = def.baseDamage;
    this.playerStats.critChance = def.critChance;
    this.hunter.updateWeapon(id);
    this.callbacks.onWeaponChange(id);
    this.callbacks.onStatsChange(this.playerStats);
  }

  public setEquippedArmor(id: ArmorId) {
    this.equippedArmor = id;
    if (!this.ownedArmors.includes(id)) this.ownedArmors.push(id);
    const def = ARMOR_REGISTRY[id];
    this.playerStats.defense = def.defense;
    this.playerStats.maxHp = 140 + def.maxHpBonus;
    this.playerStats.hp = Math.min(this.playerStats.maxHp, this.playerStats.hp + def.maxHpBonus);
    this.playerStats.maxStamina = 110 + def.maxStaminaBonus;
    this.hunter.updateArmor(id);
    this.callbacks.onStatsChange(this.playerStats);
  }

  public setGameState(next: GameState) {
    this.gameState = next;
  }

  public respawnAtCampfire() {
    this.playerPos.set(0, this.terrain.getHeight(0, 28), 28);
    this.playerStats.hp = this.playerStats.maxHp;
    this.playerStats.stamina = this.playerStats.maxStamina;
    this.playerStats.healingFlasks = Math.max(this.playerStats.healingFlasks, 3);
    this.callbacks.onStatsChange(this.playerStats);
  }

  public getSaveSnapshot(): SaveData {
    return {
      version: 1,
      timestamp: Date.now(),
      playerName: 'Koa',
      biome: this.terrain.getBiome(this.playerPos.x, this.playerPos.z),
      playerPos: { x: this.playerPos.x, y: this.playerPos.y, z: this.playerPos.z },
      playerStats: { ...this.playerStats },
      inventory: {
        materials: { ...this.inventoryMaterials },
        weapons: [...this.ownedWeapons],
        equippedWeapon: this.equippedWeapon,
        armors: [...this.ownedArmors],
        equippedArmor: this.equippedArmor,
        tools: ['bone_knife'],
      },
      beastsHunted: [...this.beastsHunted],
      currentQuestIndex: this.currentQuestIndex,
      signalTowerProgress: this.signalTowerProgress,
      beaconLit: this.beaconLit,
      settings: {
        cameraSensitivity: 1,
        mouseSensitivity: 1,
        touchSensitivity: 1,
        invertY: false,
        audioVolume: 0.7,
        masterVolume: 0.85,
        sfxVolume: 0.9,
        musicVolume: 0.5,
        sfxMuted: false,
        difficulty: 'hunter',
        showDamageNumbers: true,
      },
      beastKnowledge: { ...this.beastKnowledge },
      currentWeather: this.weatherSystem.currentWeather,
    };
  }

  private tick(now: number) {
    this.animFrameId = requestAnimationFrame(this.tick);
    const dt = Math.min(0.05, Math.max(0.001, (now - this.lastTime) / 1000));
    this.lastTime = now;

    this.animateEnvironment(now * 0.001, dt);

    if (this.gameState === 'title') {
      this.titleOrbitAngle += dt * 0.18;
      const camX = Math.cos(this.titleOrbitAngle) * 24;
      const camZ = 18 + Math.sin(this.titleOrbitAngle) * 20;
      const camY = this.terrain.getHeight(camX, camZ) + 7.5;
      this.camera.position.set(camX, camY, camZ);
      this.camera.lookAt(0, 3.5, 16);
      this.renderer.render(this.scene, this.camera);
      return;
    }

    if (this.gameState === 'playing') {
      this.elapsedRunTime += dt;
      this.updatePlayer(dt);
      this.updateNPCs(now * 0.001);
      this.updateBeasts(dt);
      this.updateProjectilesAndParticles(dt);
      this.updateCamera(dt);
      this.checkInteractPrompts();
    }

    this.renderer.render(this.scene, this.camera);
  }

  private animateEnvironment(timeSec: number, dt: number) {
    // Animate River & Ocean UV flow
    if (this.materialCache.waterMaterial.map) {
      this.materialCache.waterMaterial.map.offset.x = (timeSec * 0.18) % 1;
      this.materialCache.waterMaterial.map.offset.y = Math.sin(timeSec * 0.8) * 0.04;
    }
    if (this.materialCache.oceanMaterial.map) {
      this.materialCache.oceanMaterial.map.offset.y = (timeSec * 0.06) % 1;
    }
    this.terrain.oceanMesh.position.y = 0.35 + Math.sin(timeSec * 1.4) * 0.12;

    // Animate Swimming 3D River & Ocean Fish
    for (const fish of this.terrain.fishActors) {
      const t = timeSec * fish.speed + fish.phase;
      const nx = fish.baseX + Math.cos(t) * fish.radiusX;
      const nz = fish.baseZ + Math.sin(t) * fish.radiusZ;
      const dx = -Math.sin(t) * fish.radiusX;
      const dz = Math.cos(t) * fish.radiusZ;
      fish.mesh.position.set(nx, fish.baseY + Math.sin(t * 2.5) * 0.08, nz);
      fish.mesh.rotation.y = Math.atan2(dx, dz);
      fish.mesh.rotation.z = Math.sin(t * 6) * 0.12;
    }

    // Weather update
    const weatherChanged = this.weatherSystem.update(dt, this.playerPos);
    if (weatherChanged) {
      this.callbacks.onWeatherChange?.(this.weatherSystem.currentWeather);
    }
  }

  private updateNPCs(timeSec: number) {
    for (let i = 0; i < this.npcs.length; i++) {
      const npc = this.npcs[i];
      npc.mesh.position.y = npc.data.y + Math.sin(timeSec * 2.2 + i) * 0.04;
      // Face player gently when nearby
      const dist = Math.hypot(this.playerPos.x - npc.data.x, this.playerPos.z - npc.data.z);
      if (dist < 6.5) {
        const targetRot = Math.atan2(this.playerPos.x - npc.data.x, this.playerPos.z - npc.data.z);
        npc.mesh.rotation.y = stepAngleShortestArc(npc.mesh.rotation.y, targetRot, 0.08);
      }
    }
  }

  private updatePlayer(dt: number) {
    // Stamina regen
    if (!this.isDodging && !this.isAttacking && !this.isChargingHeavy) {
      const weatherMult = WEATHER_CONDITIONS[this.weatherSystem.currentWeather].staminaMultiplier ?? 1;
      this.playerStats.stamina = Math.min(
        this.playerStats.maxStamina,
        this.playerStats.stamina + this.playerStats.staminaRegenRate * weatherMult * dt
      );
    }

    if (this.isChargingHeavy) {
      this.heavyChargeTime += dt;
      if (this.heavyChargeTime >= 0.75) {
        this.releaseHeavyThrust();
      }
    }

    if (this.focusVisionActive) {
      this.focusTimer -= dt;
      this.focusLight.position.set(this.playerPos.x, this.playerPos.y + 2.2, this.playerPos.z);
      this.focusLight.intensity = 2.8;
      if (this.focusTimer <= 0) {
        this.focusVisionActive = false;
        this.focusLight.intensity = 0;
        this.callbacks.onFocusChange(false);
      }
    } else {
      this.focusLight.intensity = 0;
    }

    // Dodge roll movement
    if (this.isDodging) {
      this.dodgeTimer -= dt;
      const rollSpeed = 12.5;
      this.playerPos.x += this.dodgeDirX * rollSpeed * dt;
      this.playerPos.z += this.dodgeDirZ * rollSpeed * dt;
      this.hunter.torso.rotation.x = (1 - this.dodgeTimer / 0.46) * Math.PI * 2;
      if (this.dodgeTimer <= 0) {
        this.isDodging = false;
        this.hunter.torso.rotation.x = 0;
      }
    } else {
      // FIXED CAMERA-RELATIVE JOYSTICK & KEYBOARD MOVEMENT:
      // Pulling joystick UP (virtualMoveY < 0) or pressing W/ArrowUp yields moveForward > 0 (moves FRONT, into scene).
      // Pulling joystick DOWN (virtualMoveY > 0) or pressing S/ArrowDown yields moveForward < 0 (moves BACK, toward camera).
      // Pulling joystick RIGHT (virtualMoveX > 0) or pressing D/ArrowRight yields moveRight > 0 (moves RIGHT on screen).
      // Pulling joystick LEFT (virtualMoveX < 0) or pressing A/ArrowLeft yields moveRight < 0 (moves LEFT on screen).
      let moveForward = -this.virtualMoveY;
      let moveRight = this.virtualMoveX;

      if (this.keysPressed.has('KeyW') || this.keysPressed.has('ArrowUp')) moveForward += 1;
      if (this.keysPressed.has('KeyS') || this.keysPressed.has('ArrowDown')) moveForward -= 1;
      if (this.keysPressed.has('KeyD') || this.keysPressed.has('ArrowRight')) moveRight += 1;
      if (this.keysPressed.has('KeyA') || this.keysPressed.has('ArrowLeft')) moveRight -= 1;

      const isSprinting = this.keysPressed.has('ShiftLeft') && this.playerStats.stamina > 5;
      const baseSpeed = isSprinting ? 10.2 : 7.4;

      const moveResult = computeCameraRelativeMovement(
        moveForward,
        moveRight,
        this.cameraYaw,
        baseSpeed,
        dt
      );

      if (moveResult.isMoving) {
        this.playerRotation = stepAngleShortestArc(
          this.playerRotation,
          moveResult.targetRotation,
          Math.min(1, dt * 14)
        );
        this.playerPos.x += moveResult.dx;
        this.playerPos.z += moveResult.dz;

        // Animated walk cycle
        const walkCycle = performance.now() * 0.011;
        this.hunter.leftLeg.rotation.x = Math.sin(walkCycle) * 0.65;
        this.hunter.rightLeg.rotation.x = -Math.sin(walkCycle) * 0.65;
        if (!this.isAttacking) {
          this.hunter.leftArm.rotation.x = -Math.sin(walkCycle) * 0.45;
          this.hunter.rightArm.rotation.x = Math.sin(walkCycle) * 0.45;
        }
      } else {
        this.hunter.leftLeg.rotation.x *= 0.82;
        this.hunter.rightLeg.rotation.x *= 0.82;
        if (!this.isAttacking) {
          this.hunter.leftArm.rotation.x *= 0.82;
          this.hunter.rightArm.rotation.x *= 0.82;
        }
      }
    }

    // Clamp to Expanded 420x420 Island Bounds (-125 to +125)
    this.playerPos.x = Math.max(-125, Math.min(125, this.playerPos.x));
    this.playerPos.z = Math.max(-125, Math.min(125, this.playerPos.z));
    const groundY = this.terrain.getHeight(this.playerPos.x, this.playerPos.z);
    // Keep hunter wading above water surface if in shallow ocean
    this.playerPos.y = Math.max(-0.2, groundY);

    this.hunter.root.position.copy(this.playerPos);
    this.hunter.root.rotation.y = this.playerRotation;

    // Spear Attack Hit Detection
    if (this.isAttacking) {
      this.attackTimer -= dt;
      const swingProgress = 1 - this.attackTimer / (this.isHeavyAttack ? 0.48 : 0.34);
      this.hunter.rightArm.rotation.x = -Math.sin(swingProgress * Math.PI) * 1.45;
      this.hunter.weaponMount.position.z = 0.1 + Math.sin(swingProgress * Math.PI) * 0.85;

      if (swingProgress > 0.25 && swingProgress < 0.8) {
        this.evaluateSpearHits();
      }

      if (this.attackTimer <= 0) {
        this.isAttacking = false;
        this.hunter.rightArm.rotation.x = 0;
        this.hunter.weaponMount.position.z = 0.1;
      }
    }

    this.callbacks.onStatsChange(this.playerStats);
  }

  private evaluateSpearHits() {
    const weapon = WEAPON_REGISTRY[this.equippedWeapon];
    const tipX = this.playerPos.x + Math.sin(this.playerRotation) * weapon.reach;
    const tipZ = this.playerPos.z + Math.cos(this.playerRotation) * weapon.reach;

    for (const actor of this.beasts) {
      if (actor.state.hp <= 0 || actor.hitThisSwing) continue;
      const dist = Math.hypot(tipX - actor.state.x, tipZ - actor.state.z);
      if (dist > 4.2) continue;

      actor.hitThisSwing = true;

      // Check Weak Points
      let wpMult = 1.0;
      let hitWpId: string | null = null;
      for (const wp of actor.state.weakPoints) {
        if (wp.broken) continue;
        const cosR = Math.cos(actor.state.rotation);
        const sinR = Math.sin(actor.state.rotation);
        const wpWorldX = actor.state.x + wp.localOffset.x * cosR + wp.localOffset.z * sinR;
        const wpWorldZ = actor.state.z - wp.localOffset.x * sinR + wp.localOffset.z * cosR;
        if (Math.hypot(tipX - wpWorldX, tipZ - wpWorldZ) <= wp.radius + 1.2) {
          wpMult = wp.damageMultiplier;
          hitWpId = wp.id;
          break;
        }
      }

      const dmgRes = calculateDamage({
        weaponDamage: weapon.baseDamage,
        isHeavyAttack: this.isHeavyAttack,
        heavyMultiplier: weapon.heavyMultiplier,
        weakPointMultiplier: wpMult,
        isEnraged: actor.state.enraged,
        isStaggered: actor.state.aiState === 'staggered',
        critRoll: Math.random(),
        critChance: weapon.critChance,
        difficulty: 'hunter',
      });

      actor.state.hp = Math.max(0, actor.state.hp - dmgRes.finalDamage);
      sound.playHitImpact(dmgRes.isWeakPointHit, dmgRes.isCrit);
      this.spawnParticles(
        actor.state.x,
        actor.state.y + 1.6,
        actor.state.z,
        dmgRes.isWeakPointHit ? 0xfbbf24 : 0xef4444,
        10
      );

      if (hitWpId) {
        const idx = actor.state.weakPoints.findIndex((w) => w.id === hitWpId);
        if (idx >= 0) {
          const res = applyWeakPointDamage(actor.state.weakPoints[idx], dmgRes.finalDamage);
          actor.state.weakPoints[idx] = res.updated;
          if (res.justBroke) {
            actor.state.aiState = 'staggered';
            actor.state.stateTimer = 3.6;
            sound.playPartBreak();
            const bonusMat = res.updated.bonusDropMaterialId;
            this.inventoryMaterials[bonusMat] = (this.inventoryMaterials[bonusMat] || 0) + 1;
            this.callbacks.onNotification(
              `Part Broken: ${res.updated.name}! Beast Staggered! (+1 ${bonusMat.replace('_', ' ')})`,
              'loot'
            );
          }
        }
      }

      if (!actor.state.enraged && actor.state.hp > 0 && actor.state.hp < actor.state.maxHp * 0.45) {
        actor.state.enraged = true;
        actor.state.aiState = 'enraged_roar';
        actor.state.stateTimer = 1.6;
        sound.playBeastRoar(actor.state.species);
        this.cameraShakeIntensity = 0.45;
        this.callbacks.onNotification(`${actor.state.name} is ENRAGED!`, 'danger');
      }

      if (actor.state.hp <= 0) {
        actor.state.aiState = 'dead';
        actor.rig.root.rotation.z = Math.PI / 2.2;
        actor.rig.root.position.y = actor.state.y + 0.5;
        if (!this.beastsHunted.includes(actor.state.species)) {
          this.beastsHunted.push(actor.state.species);
        }
        this.upgradeKnowledge(actor.state.species, 'mastered');
        this.advanceQuestOnKill(actor.state.species);
        this.callbacks.onNotification(
          `Slain: ${actor.state.name}! Approach and press [E] to Carve materials.`,
          'loot'
        );
      }

      this.callbacks.onTargetChange(actor.state);
    }
  }

  private advanceQuestOnKill(species: BeastSpecies) {
    if ((species === 'raptor' || species === 'snapjaw') && this.currentQuestIndex === 0) {
      this.currentQuestIndex = 1;
    } else if ((species === 'brontoshell' || species === 'frostfang') && this.currentQuestIndex <= 2) {
      this.currentQuestIndex = 3;
    } else if (species === 'thunderhorn' && this.currentQuestIndex <= 3) {
      this.currentQuestIndex = 4;
    } else if (species === 'caldera_titan' && this.currentQuestIndex <= 4) {
      this.currentQuestIndex = 5;
    }
    this.callbacks.onQuestUpdate(this.currentQuestIndex);
  }

  private updateBeasts(dt: number) {
    let closestBeast: BeastState | null = null;
    let closestDist = 42;

    for (const actor of this.beasts) {
      const s = actor.state;
      if (s.hp <= 0) {
        const dDead = Math.hypot(this.playerPos.x - s.x, this.playerPos.z - s.z);
        if (dDead < 8 && !s.carved) closestBeast = s;
        continue;
      }

      const distToPlayer = Math.hypot(this.playerPos.x - s.x, this.playerPos.z - s.z);
      if (distToPlayer < closestDist) {
        closestDist = distToPlayer;
        closestBeast = s;
      }

      // Check snare traps
      for (const trap of this.traps) {
        if (trap.active && Math.hypot(s.x - trap.x, s.z - trap.z) < 2.2) {
          trap.active = false;
          trap.mesh.visible = false;
          s.snaredTimer = 4.5;
          s.aiState = 'staggered';
          s.stateTimer = 4.5;
          sound.playPartBreak();
          this.callbacks.onNotification(`${s.name} caught in Sinew Snare Trap!`, 'loot');
        }
      }

      if (s.snaredTimer > 0) {
        s.snaredTimer -= dt;
      }

      // AI State Machine
      s.stateTimer -= dt;
      const toPlayerX = this.playerPos.x - s.x;
      const toPlayerZ = this.playerPos.z - s.z;
      const angleToPlayer = Math.atan2(toPlayerX, toPlayerZ);

      if (s.aiState === 'staggered' || s.aiState === 'enraged_roar') {
        if (s.stateTimer <= 0) {
          s.aiState = 'chase';
        }
      } else if (s.aiState === 'patrol') {
        actor.patrolAngle += dt * 0.45;
        const targetX = actor.homeX + Math.cos(actor.patrolAngle) * 7;
        const targetZ = actor.homeZ + Math.sin(actor.patrolAngle) * 7;
        const dx = targetX - s.x;
        const dz = targetZ - s.z;
        s.rotation = stepAngleShortestArc(s.rotation, Math.atan2(dx, dz), dt * 4);
        s.x += Math.sin(s.rotation) * 2.4 * dt;
        s.z += Math.cos(s.rotation) * 2.4 * dt;

        if (distToPlayer < 22) {
          s.aiState = 'chase';
          this.upgradeKnowledge(s.species, 'sighted');
          sound.playBeastRoar(s.species);
        }
      } else if (s.aiState === 'chase') {
        s.rotation = stepAngleShortestArc(s.rotation, angleToPlayer, dt * 6);
        const moveSpeed = s.enraged ? 6.2 : 4.6;
        if (distToPlayer > 4.2) {
          s.x += Math.sin(s.rotation) * moveSpeed * dt;
          s.z += Math.cos(s.rotation) * moveSpeed * dt;
        } else {
          s.aiState = 'telegraph_charge';
          s.stateTimer = s.enraged ? 0.75 : 1.05;
          actor.chargeDirX = Math.sin(angleToPlayer);
          actor.chargeDirZ = Math.cos(angleToPlayer);
        }
        if (distToPlayer > 36) {
          s.aiState = 'patrol';
        }
      } else if (s.aiState === 'telegraph_charge') {
        // Rear back / open jaw windup tell
        actor.rig.head.rotation.x = -0.35;
        actor.rig.jaw.rotation.x = 0.45;
        if (s.stateTimer <= 0) {
          actor.rig.head.rotation.x = 0;
          actor.rig.jaw.rotation.x = 0;
          s.aiState = 'attack_charge';
          s.stateTimer = 0.65;
        }
      } else if (s.aiState === 'attack_charge') {
        const dashSpeed = s.enraged ? 15.5 : 12.2;
        s.x += actor.chargeDirX * dashSpeed * dt;
        s.z += actor.chargeDirZ * dashSpeed * dt;

        // Check player hit
        if (Math.hypot(this.playerPos.x - s.x, this.playerPos.z - s.z) < 2.9) {
          const elapsedDodge = 0.46 - this.dodgeTimer;
          if (!this.isDodging || !isDodgeInvulnerable(elapsedDodge, 0.46)) {
            const rawDmg = s.species === 'caldera_titan' ? 38 : s.species === 'frostfang' ? 32 : 24;
            const taken = calculatePlayerDamageTaken(rawDmg, this.playerStats.defense, 'hunter');
            this.playerStats.hp = Math.max(0, this.playerStats.hp - taken);
            this.cameraShakeIntensity = 0.35;
            sound.playPlayerHurt();
            this.callbacks.onStatsChange(this.playerStats);
            s.stateTimer = 0;
            if (this.playerStats.hp <= 0) {
              this.callbacks.onDefeat();
            }
          }
        }

        if (s.stateTimer <= 0) {
          s.aiState = 'chase';
          s.stateTimer = 1.2;
        }
      }

      s.y = this.terrain.getHeight(s.x, s.z);
      actor.rig.root.position.set(s.x, s.y, s.z);
      actor.rig.root.rotation.y = s.rotation;

      // Leg & Tail animation
      const animT = performance.now() * 0.008;
      actor.rig.tail.rotation.y = Math.sin(animT) * 0.22;
      actor.rig.legs.forEach((leg, idx) => {
        leg.rotation.x = Math.sin(animT + idx * Math.PI) * 0.32;
      });
    }

    this.callbacks.onTargetChange(closestBeast);
  }

  private updateProjectilesAndParticles(dt: number) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.age += dt;
      if (!p.landed) {
        p.vy -= 18 * dt;
        p.mesh.position.x += p.vx * dt;
        p.mesh.position.y += p.vy * dt;
        p.mesh.position.z += p.vz * dt;
        const gy = this.terrain.getHeight(p.mesh.position.x, p.mesh.position.z);
        if (p.mesh.position.y <= gy + 0.15) {
          p.mesh.position.y = gy + 0.15;
          p.landed = true;
          // Lure nearby beasts
          for (const b of this.beasts) {
            if (b.state.hp > 0 && Math.hypot(b.state.x - p.mesh.position.x, b.state.z - p.mesh.position.z) < 22) {
              b.homeX = p.mesh.position.x;
              b.homeZ = p.mesh.position.z;
            }
          }
        }
      } else if (p.age > 4) {
        this.scene.remove(p.mesh);
        this.projectiles.splice(i, 1);
      }
    }

    for (const part of this.particles) {
      if (part.life > 0) {
        part.life -= dt;
        part.vy -= 9.8 * dt;
        part.mesh.position.x += part.vx * dt;
        part.mesh.position.y += part.vy * dt;
        part.mesh.position.z += part.vz * dt;
        if (part.life <= 0) {
          part.mesh.visible = false;
        }
      }
    }
  }

  private updateCamera(dt: number) {
    const camX =
      this.playerPos.x - Math.sin(this.cameraYaw) * Math.cos(this.cameraPitch) * this.cameraDistance;
    const camZ =
      this.playerPos.z - Math.cos(this.cameraYaw) * Math.cos(this.cameraPitch) * this.cameraDistance;
    const desiredY = this.playerPos.y + 1.8 + Math.sin(this.cameraPitch) * this.cameraDistance;
    const groundAtCam = this.terrain.getHeight(camX, camZ) + 0.85;
    let camY = Math.max(groundAtCam, desiredY);

    if (this.cameraShakeIntensity > 0) {
      camY += (Math.random() - 0.5) * this.cameraShakeIntensity;
      this.cameraShakeIntensity = Math.max(0, this.cameraShakeIntensity - dt * 1.8);
    }

    this.camera.position.set(camX, camY, camZ);
    this.camera.lookAt(this.playerPos.x, this.playerPos.y + 1.5, this.playerPos.z);
  }

  private checkInteractPrompts() {
    for (const npc of this.npcs) {
      if (Math.hypot(this.playerPos.x - npc.data.x, this.playerPos.z - npc.data.z) < 4.2) {
        this.callbacks.onInteractPrompt(`Press [E] or Tap to Speak with ${npc.data.name}`);
        return;
      }
    }
    if (Math.hypot(this.playerPos.x - 0, this.playerPos.z - 28) < 5.2) {
      this.callbacks.onInteractPrompt('Press [E] or Tap to Rest at Campfire & Craft');
      return;
    }
    if (Math.hypot(this.playerPos.x - 0, this.playerPos.z - 5) < 6.0) {
      this.callbacks.onInteractPrompt('Press [E] or Tap to Ignite Ancient Signal Tower');
      return;
    }
    for (const actor of this.beasts) {
      if (
        actor.state.hp <= 0 &&
        !actor.state.carved &&
        Math.hypot(this.playerPos.x - actor.state.x, this.playerPos.z - actor.state.z) < 5.2
      ) {
        this.callbacks.onInteractPrompt(`Press [E] or Tap to Carve ${actor.state.name}`);
        return;
      }
    }
    for (const c of this.clues) {
      if (
        !c.data.discovered &&
        Math.hypot(this.playerPos.x - c.data.x, this.playerPos.z - c.data.z) < 4.2
      ) {
        this.callbacks.onInteractPrompt('Press [E] or Tap to Inspect Beast Tracks');
        return;
      }
    }
    this.callbacks.onInteractPrompt(null);
  }

  public handleResize() {
    if (!this.container) return;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  public dispose() {
    cancelAnimationFrame(this.animFrameId);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.renderer.domElement.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    this.materialCache.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
