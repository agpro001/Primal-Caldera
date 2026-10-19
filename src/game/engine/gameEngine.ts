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
  CreatureEggNest,
  AtmosphericScienceState,
  AdventureMission,
} from '../../types/game.ts';
import {
  WEAPON_REGISTRY,
  ARMOR_REGISTRY,
  QUEST_CHAIN,
  INITIAL_EGG_NESTS,
  ADVENTURE_MISSIONS,
  calculateDamage,
  calculatePlayerDamageTaken,
  isDodgeInvulnerable,
  applyWeakPointDamage,
  createBeastWeakPoints,
  computeCameraRelativeMovement,
  computeAtmosphericPhysics,
  computeSurvivalMetabolism,
  stepAngleShortestArc,
} from '../logic/rules.ts';
import { MaterialCache } from '../graphics/materials.ts';
import {
  buildHunterModel,
  buildBeastModel,
  buildTribalNPCModel,
  buildEggNestModel,
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
  onAtmosphereChange?: (atmo: AtmosphericScienceState) => void;
  onAdventuresChange?: (missions: AdventureMission[], activeIndex: number) => void;
  onHitMarker?: (damage: number, isCrit: boolean, isWeakPoint: boolean) => void;
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
    sky_dragon: 'tracked',
    caldera_titan: 'tracked',
  };

  // Player Transform, Flight & Physics Kinematics
  public playerPos = new THREE.Vector3(0, 1.8, 31.8);
  public playerVelY = 0;
  public isGrounded = true;
  public isFlying = false;
  public playerRotation = Math.PI;
  public cameraYaw = Math.PI;
  public cameraPitch = 0.32;
  private cameraDistance = 7.2;
  private cameraShakeIntensity = 0;
  private gaitPhase = 0;
  private turnLeanAngle = 0;
  private upperBodyActionTimer = 0;
  public currentAtmosphere: AtmosphericScienceState;
  public adventureMissions: AdventureMission[] = ADVENTURE_MISSIONS.map((m) => ({
    ...m,
    stages: [...m.stages],
  }));
  public activeAdventureIndex = 0;

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

  // Entities & Diegetic 3D World Indicators
  public beasts: ActiveBeastActor[] = [];
  public npcs: ActiveNPCActor[] = [];
  public eggNests: { data: CreatureEggNest; mesh: THREE.Group }[] = [];
  private clues: { data: TrackClue; mesh: THREE.Group }[] = [];
  private traps: PlacedTrap[] = [];
  private projectiles: LureStoneProjectile[] = [];
  private particles: ParticleBurst[] = [];
  private particlePoolGroup = new THREE.Group();
  private airStreamGroup = new THREE.Group();
  private airRibbons: { mesh: THREE.Mesh; baseX: number; baseY: number; baseZ: number; phase: number }[] = [];
  private thermalColumns: { x: number; z: number; radius: number; ringMesh: THREE.Mesh }[] = [];
  private playerDiegeticGroup = new THREE.Group();
  private playerDirectionArrow!: THREE.Mesh;
  private beastThreatRing!: THREE.Mesh;
  private grassDummy = new THREE.Object3D();

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
    this.playerStats = {
      ...saveData.playerStats,
      food: saveData.playerStats.food ?? 2400,
      maxFood: saveData.playerStats.maxFood ?? 2400,
      water: saveData.playerStats.water ?? 2000,
      maxWater: saveData.playerStats.maxWater ?? 2000,
      foodRations: saveData.playerStats.foodRations ?? 4,
      maxFoodRations: saveData.playerStats.maxFoodRations ?? 8,
      waterCanteens: saveData.playerStats.waterCanteens ?? 4,
      maxWaterCanteens: saveData.playerStats.maxWaterCanteens ?? 6,
      eggsCollected: saveData.playerStats.eggsCollected ?? 0,
      eggInventory: { ...(saveData.playerStats.eggInventory ?? {}) },
      isFlying: false,
      isJumping: false,
      altitude: 1.8,
      airSpeed: 0,
      bodyTempC: 37.0,
    };
    this.equippedWeapon = saveData.inventory.equippedWeapon;
    this.equippedArmor = saveData.inventory.equippedArmor;
    this.ownedWeapons = [...saveData.inventory.weapons];
    this.ownedArmors = [...saveData.inventory.armors];
    this.inventoryMaterials = { ...saveData.inventory.materials };
    this.currentQuestIndex = saveData.currentQuestIndex;
    this.signalTowerProgress = saveData.signalTowerProgress;
    this.beaconLit = saveData.beaconLit;
    this.beastsHunted = [...saveData.beastsHunted];
    const defaultKnowledge: Record<BeastSpecies, BeastKnowledgeLevel> = {
      raptor: 'tracked',
      brontoshell: 'tracked',
      thunderhorn: 'tracked',
      frostfang: 'tracked',
      snapjaw: 'tracked',
      sky_dragon: 'tracked',
      caldera_titan: 'tracked',
    };
    this.beastKnowledge = {
      ...defaultKnowledge,
      ...(saveData.beastKnowledge ?? {}),
    };

    this.weatherSystem = new WeatherSystem();
    if (saveData.currentWeather) {
      this.weatherSystem.setWeather(saveData.currentWeather);
    }
    this.trailSystem = new TrailSystem();
    this.currentAtmosphere = computeAtmosphericPhysics(0, 2, 28, 'jungle', 'clear', 0);

    const isHeadless = navigator.webdriver || /HeadlessChrome/i.test(navigator.userAgent);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      powerPreference: 'high-performance',
      antialias: !isHeadless,
      stencil: false,
      preserveDrawingBuffer: true,
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

    // Materials & Terrain (including 3D Ocean, Winding River, Cold Snow Mountains, Instanced Grass, Trees, Stones, Shrubs)
    this.materialCache = new MaterialCache();
    this.terrain = createTerrain(this.materialCache);
    this.scene.add(this.terrain.mesh);
    this.scene.add(this.terrain.oceanMesh);
    this.scene.add(this.terrain.riverMesh);
    this.scene.add(this.terrain.lavaFlowMesh);
    this.scene.add(this.terrain.foliageGroup);
    this.scene.add(this.terrain.instancedGrass);
    this.scene.add(this.terrain.campGroup);
    this.scene.add(this.terrain.towerGroup);
    this.scene.add(this.terrain.clueGroup);
    this.scene.add(this.particlePoolGroup);
    this.scene.add(this.airStreamGroup);
    this.scene.add(this.weatherSystem.weatherParticleGroup);
    this.scene.add(this.trailSystem.trailGroup);

    // Hunter Model (Articulated 18-Joint Mastercraft Mithril Armor Knight)
    this.hunter = buildHunterModel(this.materialCache);
    this.hunter.updateWeapon(this.equippedWeapon);
    this.hunter.updateArmor(this.equippedArmor);

    let spawnX = saveData.playerPos.x;
    let spawnZ = saveData.playerPos.z;
    // Prevent spawning inside the Campfire Ring at (0, 28)
    if (Math.hypot(spawnX - 0, spawnZ - 28) < 2.2) {
      spawnX = 0;
      spawnZ = 31.8;
    }
    this.playerPos.set(spawnX, this.terrain.getHeight(spawnX, spawnZ), spawnZ);
    this.hunter.root.position.copy(this.playerPos);
    this.hunter.root.rotation.y = this.playerRotation;
    this.scene.add(this.hunter.root);

    // Initialize Diegetic 3D World Rings (Player Tactical Turf Ring + Beast Threat Ring)
    this.initDiegeticWorldUI();

    // Initialize Tribal Characters (NPCs)
    this.initNPCs();

    // Initialize All 7 Prehistoric & Draconic Beasts (including Flying Dragons!) + 7 Creature Egg Nests
    this.initBeasts();
    this.initEggNestsAndAirStreams();

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
        isFlying: this.isFlying,
        isGrounded: this.isGrounded,
        cameraYaw: this.cameraYaw,
        virtualMove: { x: this.virtualMoveX, y: this.virtualMoveY },
        biome: getTerrainBiome(this.playerPos.x, this.playerPos.z),
        atmosphere: this.currentAtmosphere,
        stats: {
          hp: this.playerStats.hp,
          food: this.playerStats.food,
          water: this.playerStats.water,
          eggsCollected: this.playerStats.eggsCollected,
        },
        beasts: this.beasts.map((b) => ({
          id: b.state.id,
          species: b.state.species,
          name: b.state.name,
          biome: b.state.biome,
          x: b.state.x,
          y: b.state.y,
          z: b.state.z,
          hp: b.state.hp,
          isFlyingBeast: b.state.isFlyingBeast,
        })),
        eggNests: this.eggNests.map((n) => ({
          id: n.data.id,
          species: n.data.species,
          x: n.data.x,
          z: n.data.z,
          collected: n.data.collected,
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
      toggleFlight: () => this.toggleFlightMode(),
      jump: () => this.jumpPlayer(),
      teleport: (x: number, z: number, yaw = 0) => {
        this.playerPos.set(x, this.terrain.getHeight(x, z), z);
        this.hunter.root.position.copy(this.playerPos);
        this.cameraYaw = yaw;
      },
    };
    (window as any).render_game_to_text = () =>
      JSON.stringify((window as any).__gameTest.getState());

    // Start loop
    this.lastTime = performance.now();
    this.tick = this.tick.bind(this);
    this.animFrameId = requestAnimationFrame(this.tick);
  }

  private initDiegeticWorldUI() {
    // 1. Diegetic 3D Turf Ring beneath Player (FC Mobile / Monster Hunter style)
    const turfRingGeo = new THREE.RingGeometry(0.86, 0.96, 36);
    turfRingGeo.rotateX(-Math.PI / 2);
    const turfRingMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.42,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const turfRing = new THREE.Mesh(turfRingGeo, turfRingMat);
    this.playerDiegeticGroup.add(turfRing);

    // 3D Directional Threat / Waypoint Arrow on the Player's Turf Ring
    const arrowGeo = new THREE.ConeGeometry(0.18, 0.42, 4);
    arrowGeo.rotateX(Math.PI / 2);
    arrowGeo.translate(0, 0.02, 1.18);
    const arrowMat = new THREE.MeshBasicMaterial({
      color: 0xfbbf24,
      transparent: true,
      opacity: 0.78,
      depthWrite: false,
    });
    this.playerDirectionArrow = new THREE.Mesh(arrowGeo, arrowMat);
    this.playerDiegeticGroup.add(this.playerDirectionArrow);
    this.scene.add(this.playerDiegeticGroup);

    // 2. Diegetic 3D Beast Lock-On / Telegraph Ring on the ground beneath targeted Beast
    const threatGeo = new THREE.RingGeometry(2.2, 2.48, 40);
    threatGeo.rotateX(-Math.PI / 2);
    const threatMat = new THREE.MeshBasicMaterial({
      color: 0xef4444,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.beastThreatRing = new THREE.Mesh(threatGeo, threatMat);
    this.beastThreatRing.visible = false;
    this.scene.add(this.beastThreatRing);
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
        greeting:
          'Chief Kael: "Hail, Mithril Vanguard! Press [V] to deploy your Flight Wings, raid the Dragon Egg nests, and watch your Food & Water homeostasis!"',
        giftMaterial: { id: 'beast_bone', count: 3, claimed: false },
      },
      {
        id: 'smith_torak',
        name: 'Forge-Master Torak',
        role: 'Mithril & Obsidian Weaponsmith',
        x: 3.2,
        y: 0,
        z: 24.5,
        rotation: -0.5,
        biome: 'jungle',
        greeting:
          'Torak: "Your Mastercraft Mithril panoply gleams like Beyond Skyrim steel! Bring me Dragon Scales or Frostfang Ivory to temper your glaive!"',
        giftMaterial: { id: 'obsidian_shard', count: 2, claimed: false },
      },
      {
        id: 'scout_lyra',
        name: 'Scout Lyra',
        role: 'River Hydrologist & Aerial Spotter',
        x: -13.5,
        y: 0,
        z: 16.8,
        rotation: 2.6,
        biome: 'river',
        greeting:
          'Scout Lyra: "Drink from the Crystal River [H] to refill your canteen! Overhead, Aurelius the Sky-Dragon circles the thermal updrafts guarding its Dragon Egg!"',
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
      isFlyingBeast?: boolean;
      flightAltitude?: number;
    }> = [
      {
        id: 'raptor_alpha',
        species: 'raptor',
        name: 'Razor-Crest Raptor Alpha',
        title: 'Pack Terror of the Ravines',
        x: -24,
        z: 42,
        hp: 240,
        biome: 'jungle',
      },
      {
        id: 'snapjaw_leviathan',
        species: 'snapjaw',
        name: 'River Snapjaw Leviathan',
        title: 'Amphibious Predator of River & Ocean',
        x: -9,
        z: 15.5,
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
        id: 'sky_dragon_aurelius',
        species: 'sky_dragon',
        name: 'Aurelius, Aetherial Sky-Wyvern',
        title: 'Flying Dragon of the Thermal Airways',
        x: 0,
        z: 8,
        hp: 560,
        biome: 'caldera',
        isFlyingBeast: true,
        flightAltitude: 8.5,
      },
      {
        id: 'sky_dragon_boreas',
        species: 'sky_dragon',
        name: 'Boreas, Glacial Sky-Dragon',
        title: 'Winged Sovereign of the Snow Peaks',
        x: 34,
        z: 2,
        hp: 540,
        biome: 'snow',
        isFlyingBeast: true,
        flightAltitude: 10.5,
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
      const groundY = this.terrain.getHeight(cfg.x, cfg.z);
      const y = groundY + (cfg.flightAltitude ?? 0);
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
        isFlyingBeast: cfg.isFlyingBeast,
        flightAltitude: cfg.flightAltitude,
        weakPoints,
        carved: false,
        snaredTimer: 0,
      };

      this.beasts.push({
        state,
        rig,
        homeX: cfg.x,
        homeZ: cfg.z,
        patrolAngle: Math.random() * Math.PI * 2,
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

  private initEggNestsAndAirStreams() {
    // 1. Spawn 7 3D Creature & Dragon Egg Nests across all biomes
    INITIAL_EGG_NESTS.forEach((nestCfg) => {
      const copy: CreatureEggNest = { ...nestCfg };
      copy.y = this.terrain.getHeight(copy.x, copy.z);
      const nestMesh = buildEggNestModel(copy.species, this.materialCache);
      nestMesh.position.set(copy.x, copy.y, copy.z);
      this.scene.add(nestMesh);
      this.eggNests.push({ data: copy, mesh: nestMesh });
    });

    // 2. Spawn 3D Thermal Updraft Columns & Wind Streamlines (Atmospheric Physics Visualization)
    const thermalSpots = [
      { x: -16, z: -38, radius: 7.5 }, // Caldera Dragon Trench Thermal
      { x: -42, z: -14, radius: 6.5 }, // Geothermal Springs Updraft
      { x: 48, z: -12, radius: 7.0 },  // Cold Snow Mountain Ridge Lift
      { x: 0, z: 12, radius: 6.0 },    // Central Tower Valley Thermal
    ];
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.36,
      side: THREE.DoubleSide,
    });
    for (const spot of thermalSpots) {
      const gy = this.terrain.getHeight(spot.x, spot.z);
      const ringMesh = new THREE.Mesh(
        new THREE.TorusGeometry(spot.radius * 0.65, 0.12, 8, 24),
        ringMat
      );
      ringMesh.rotation.x = Math.PI / 2;
      ringMesh.position.set(spot.x, gy + 2.5, spot.z);
      this.airStreamGroup.add(ringMesh);
      this.thermalColumns.push({ ...spot, ringMesh });
    }

    // 3D Wind Streamline Ribbons floating in the air
    const ribbonGeo = new THREE.BoxGeometry(2.8, 0.05, 0.08);
    const ribbonMat = new THREE.MeshBasicMaterial({
      color: 0xe0f2fe,
      transparent: true,
      opacity: 0.28,
    });
    for (let i = 0; i < 28; i++) {
      const rx = ((i * 37) % 160) - 80;
      const rz = ((i * 53) % 160) - 80;
      const ry = this.terrain.getHeight(rx, rz) + 3.5 + (i % 5) * 2.4;
      const mesh = new THREE.Mesh(ribbonGeo, ribbonMat);
      mesh.position.set(rx, ry, rz);
      this.airStreamGroup.add(mesh);
      this.airRibbons.push({ mesh, baseX: rx, baseY: ry, baseZ: rz, phase: i * 0.7 });
    }
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
      this.jumpPlayer();
    } else if (e.code === 'KeyV') {
      e.preventDefault();
      this.toggleFlightMode();
    } else if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
      this.startDodgeRoll();
    } else if (e.code === 'KeyF') {
      this.toggleHunterFocus();
    } else if (e.code === 'KeyQ') {
      this.eatFoodRation();
    } else if (e.code === 'KeyH') {
      this.drinkWaterCanteen();
    } else if (e.code === 'KeyG') {
      this.useCollectedEgg();
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
    this.isAttacking = true;
    this.isHeavyAttack = true;
    this.attackTimer = 0.48;
    this.beasts.forEach((b) => (b.hitThisSwing = false));
    sound.playSpearSwing(true);
    this.callbacks.onStatsChange(this.playerStats);
  }

  public startDodgeRoll() {
    if (this.isDodging) return;
    this.isDodging = true;
    this.isAttacking = false;
    this.dodgeTimer = 0.46;
    this.dodgeDirX = Math.sin(this.playerRotation);
    this.dodgeDirZ = Math.cos(this.playerRotation);
    sound.playDodgeRoll();
    this.callbacks.onStatsChange(this.playerStats);
  }

  public jumpPlayer() {
    if (this.isFlying) {
      // In flight mode, pressing Jump boosts upward altitude
      this.playerPos.y = Math.min(48, this.playerPos.y + 2.6);
      this.spawnParticles(this.playerPos.x, this.playerPos.y, this.playerPos.z, 0x38bdf8, 6);
      return;
    }
    if (this.isGrounded) {
      this.isGrounded = false;
      this.playerVelY = 9.6;
      this.playerStats.isJumping = true;
      sound.playDodgeRoll();
      this.spawnParticles(this.playerPos.x, this.playerPos.y, this.playerPos.z, 0xe2e8f0, 6);
    } else {
      // Pressing Jump again in mid-air engages Aetherial Mithril Flight Mode!
      this.toggleFlightMode();
    }
  }

  public toggleFlightMode() {
    this.isFlying = !this.isFlying;
    this.playerStats.isFlying = this.isFlying;
    if (this.hunter.wings) {
      this.hunter.wings.visible = true;
    }
    if (this.isFlying) {
      this.isGrounded = false;
      this.playerVelY = 0;
      const gy = this.terrain.getHeight(this.playerPos.x, this.playerPos.z);
      if (this.playerPos.y < gy + 3.2) {
        this.playerPos.y = gy + 3.8;
      }
      sound.playFocusPulse();
      this.spawnParticles(this.playerPos.x, this.playerPos.y, this.playerPos.z, 0x38bdf8, 12);
      this.callbacks.onNotification(
        'Mithril Aether-Wings Deployed! [W/A/S/D] Fly · [Space] Ascend · [C] Descend · [V] Land',
        'info'
      );
    } else {
      this.callbacks.onNotification('Flight Wings Folded into Dorsal Pack · Returning to Ground', 'info');
    }
    this.callbacks.onStatsChange(this.playerStats);
  }

  /**
   * Eat Cooked Meat & Sun-Berry Ration [Q]: Restores +650 kcal Nutrition and +45 Vitality HP via metabolic synthesis.
   */
  public eatFoodRation() {
    if (this.playerStats.foodRations <= 0) {
      this.callbacks.onNotification(
        'No Food Rations remaining! Harvest Berry Shrubs [E] or roast meat at Campfire.',
        'danger'
      );
      return;
    }
    this.playerStats.foodRations--;
    this.playerStats.food = Math.min(this.playerStats.maxFood, this.playerStats.food + 650);
    this.playerStats.hp = Math.min(this.playerStats.maxHp, this.playerStats.hp + 45);
    this.upperBodyActionTimer = 0.45;
    sound.playHeal();
    this.spawnParticles(this.playerPos.x, this.playerPos.y + 1, this.playerPos.z, 0xf59e0b, 10);
    this.callbacks.onNotification(
      'Consumed Nutrient Ration (+650 kcal Food · +45 HP Metabolic Recovery)',
      'loot'
    );
    this.callbacks.onStatsChange(this.playerStats);
  }

  /**
   * Drink Freshwater Canteen [H]: Restores +600 mL Hydration and regulates core body temperature.
   */
  public drinkWaterCanteen() {
    const biome = getTerrainBiome(this.playerPos.x, this.playerPos.z);
    if (biome === 'river' || biome === 'springs') {
      this.playerStats.water = this.playerStats.maxWater;
      this.playerStats.waterCanteens = this.playerStats.maxWaterCanteens;
      this.playerStats.hp = Math.min(this.playerStats.maxHp, this.playerStats.hp + 25);
      this.upperBodyActionTimer = 0.45;
      sound.playHeal();
      this.spawnParticles(this.playerPos.x, this.playerPos.y + 0.8, this.playerPos.z, 0x38bdf8, 12);
      this.callbacks.onNotification(
        'Drank & Refilled Canteens at Freshwater Source (+2,000 mL Hydration)',
        'loot'
      );
      this.callbacks.onStatsChange(this.playerStats);
      return;
    }

    if (this.playerStats.waterCanteens <= 0) {
      this.callbacks.onNotification(
        'Water Canteen empty! Visit the Crystal River to drink & refill.',
        'danger'
      );
      return;
    }
    this.playerStats.waterCanteens--;
    this.playerStats.water = Math.min(this.playerStats.maxWater, this.playerStats.water + 600);
    this.playerStats.hp = Math.min(this.playerStats.maxHp, this.playerStats.hp + 25);
    this.upperBodyActionTimer = 0.45;
    sound.playHeal();
    this.spawnParticles(this.playerPos.x, this.playerPos.y + 1, this.playerPos.z, 0x38bdf8, 10);
    this.callbacks.onNotification('Drank Freshwater Canteen (+600 mL Hydration · +25 HP)', 'loot');
    this.callbacks.onStatsChange(this.playerStats);
  }

  /**
   * Consume or Bio-Synthesize a Collected Creature Egg [G] for massive caloric & vitality surge!
   */
  public useCollectedEgg() {
    if (this.playerStats.eggsCollected <= 0) {
      this.callbacks.onNotification(
        'No Creature Eggs in inventory! Raid glowing 3D Egg Nests across the biomes [E].',
        'danger'
      );
      return;
    }
    this.playerStats.eggsCollected--;
    this.playerStats.food = this.playerStats.maxFood;
    this.playerStats.water = this.playerStats.maxWater;
    this.playerStats.hp = this.playerStats.maxHp;
    this.playerStats.attackPower += 4;
    this.upperBodyActionTimer = 0.55;
    sound.playVictoryFanfare();
    this.spawnParticles(this.playerPos.x, this.playerPos.y + 1.2, this.playerPos.z, 0xfacc15, 16);
    this.callbacks.onNotification(
      'Synthesized Creature Egg! Full Nutrition, Full Hydration, Max HP & +4 Permanent Attack Power!',
      'loot'
    );
    this.callbacks.onStatsChange(this.playerStats);
  }

  // Keep alias for any legacy caller
  public useHealFlask() {
    this.eatFoodRation();
  }

  public selectAdventureMission(index: number) {
    if (index >= 0 && index < this.adventureMissions.length) {
      this.activeAdventureIndex = index;
      this.callbacks.onAdventuresChange?.([...this.adventureMissions], this.activeAdventureIndex);
      const m = this.adventureMissions[index];
      this.callbacks.onNotification(`Active Operation: ${m.codeName} — ${m.title}`, 'info');
    }
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
    // 1. Check Creature & Sky-Dragon Egg Nests (ARK Wyvern Heist Mechanic!)
    for (const nest of this.eggNests) {
      if (!nest.data.collected) {
        const dist = Math.hypot(this.playerPos.x - nest.data.x, this.playerPos.z - nest.data.z);
        if (dist < 5.0) {
          nest.data.collected = true;
          const eggObj = nest.mesh.getObjectByName('creature_egg_mesh');
          if (eggObj) eggObj.visible = false;
          this.playerStats.eggsCollected = (this.playerStats.eggsCollected || 0) + 1;
          this.playerStats.eggInventory = {
            ...(this.playerStats.eggInventory || {}),
            [nest.data.species]: ((this.playerStats.eggInventory?.[nest.data.species] || 0) + 1),
          };
          this.playerStats.food = Math.min(
            this.playerStats.maxFood,
            this.playerStats.food + Math.round(nest.data.caloricValueKcal * 0.4)
          );
          this.playerStats.foodRations = Math.min(
            this.playerStats.maxFoodRations,
            this.playerStats.foodRations + 1
          );
          this.totalMaterialsGathered += 2;
          sound.playGather();
          this.spawnParticles(nest.data.x, nest.data.y + 0.8, nest.data.z, 0xfacc15, 14);

          // Alert nearby parent beast or Sky-Dragon!
          for (const b of this.beasts) {
            if (b.state.hp > 0 && (b.state.species === nest.data.species || b.state.species === 'sky_dragon')) {
              const dBeast = Math.hypot(b.state.x - nest.data.x, b.state.z - nest.data.z);
              if (dBeast < 55) {
                b.state.aiState = 'chase';
                b.state.enraged = true;
                sound.playBeastRoar(b.state.species);
              }
            }
          }

          this.advanceAdventureProgress(nest.data.species, 'egg');
          this.callbacks.onNotification(
            `Egg Extracted: ${nest.data.name} (${nest.data.eggWeightKg}kg · ${nest.data.caloricValueKcal} kcal)! Beware Parent Pursuit!`,
            'loot'
          );
          this.callbacks.onStatsChange(this.playerStats);
          return;
        }
      }
    }

    // 2. Check Tribal NPCs Conversation & Gift
    for (const npc of this.npcs) {
      const dist = Math.hypot(this.playerPos.x - npc.data.x, this.playerPos.z - npc.data.z);
      if (dist < 4.2) {
        sound.playGather();
        if (npc.data.giftMaterial && !npc.data.giftMaterial.claimed) {
          npc.data.giftMaterial.claimed = true;
          const matId = npc.data.giftMaterial.id;
          const cnt = npc.data.giftMaterial.count;
          this.inventoryMaterials[matId] = (this.inventoryMaterials[matId] || 0) + cnt;
          this.playerStats.foodRations = Math.min(this.playerStats.maxFoodRations, this.playerStats.foodRations + 2);
          this.callbacks.onNotification(
            `${npc.data.greeting} (+${cnt} ${matId.replace('_', ' ')} & +2 Food Rations)`,
            'loot'
          );
        } else {
          this.callbacks.onNotification(npc.data.greeting, 'info');
        }
        this.callbacks.onStatsChange(this.playerStats);
        return;
      }
    }

    // 3. Check Campfire Workbench (0, 28)
    const distCamp = Math.hypot(this.playerPos.x - 0, this.playerPos.z - 28);
    if (distCamp < 5.2) {
      this.playerStats.hp = this.playerStats.maxHp;
      this.playerStats.food = this.playerStats.maxFood;
      this.playerStats.water = this.playerStats.maxWater;
      this.playerStats.foodRations = Math.max(this.playerStats.foodRations, 5);
      this.playerStats.waterCanteens = this.playerStats.maxWaterCanteens;
      this.playerStats.lureStones = 6;
      this.callbacks.onStatsChange(this.playerStats);
      this.callbacks.onOpenCrafting();
      return;
    }

    // 4. Check Signal Tower (0, 5)
    const distTower = Math.hypot(this.playerPos.x - 0, this.playerPos.z - 5);
    if (distTower < 6.0) {
      if (
        this.beastsHunted.includes('caldera_titan') ||
        this.beastsHunted.includes('sky_dragon') ||
        (this.inventoryMaterials.titan_fang || 0) > 0 ||
        this.playerStats.eggsCollected >= 3
      ) {
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
          'Slay Ignis-Rex or Aurelius the Sky-Dragon (or collect 3 Creature Eggs) to ignite the Ancient Signal Tower!',
          'info'
        );
      }
      return;
    }

    // 5. Check Carve Fallen Beasts
    for (const actor of this.beasts) {
      if (actor.state.hp <= 0 && !actor.state.carved) {
        const dist = Math.hypot(this.playerPos.x - actor.state.x, this.playerPos.z - actor.state.z);
        if (dist < 6.0) {
          actor.state.carved = true;
          sound.playGather();
          this.grantBeastCarveDrops(actor.state.species);
          return;
        }
      }
    }

    // 6. Check Track Clues
    for (const c of this.clues) {
      if (!c.data.discovered) {
        const dist = Math.hypot(this.playerPos.x - c.data.x, this.playerPos.z - c.data.z);
        if (dist < 4.2) {
          c.data.discovered = true;
          c.mesh.visible = false;
          sound.playGather();
          this.inventoryMaterials.sun_herb = (this.inventoryMaterials.sun_herb || 0) + 1;
          this.playerStats.foodRations = Math.min(this.playerStats.maxFoodRations, this.playerStats.foodRations + 1);
          this.totalMaterialsGathered++;
          this.upgradeKnowledge(c.data.species, 'sighted');
          this.callbacks.onNotification(
            `Track Examined: ${c.data.description} (+1 Sun-Herb · +1 Food Ration)`,
            'loot'
          );
          this.callbacks.onStatsChange(this.playerStats);
          return;
        }
      }
    }

    // 7. Check Freshwater River / Springs Hydration & Berry Foraging
    const biome = getTerrainBiome(this.playerPos.x, this.playerPos.z);
    if (biome === 'river' || biome === 'springs') {
      this.drinkWaterCanteen();
      return;
    }
  }

  private advanceAdventureProgress(species: BeastSpecies, eventType: 'egg' | 'kill') {
    let updated = false;
    for (const adv of this.adventureMissions) {
      if (adv.completed) continue;
      if (eventType === 'egg' && adv.currentStage < 2) {
        adv.currentStage = Math.min(adv.stages.length - 1, adv.currentStage + 1);
        updated = true;
      } else if (eventType === 'kill') {
        adv.currentStage = adv.stages.length - 1;
        adv.completed = true;
        updated = true;
      }
    }
    if (updated) {
      this.callbacks.onAdventuresChange?.([...this.adventureMissions], this.activeAdventureIndex);
    }
  }

  private grantBeastCarveDrops(species: BeastSpecies) {
    this.playerStats.foodRations = Math.min(this.playerStats.maxFoodRations, this.playerStats.foodRations + 2);
    if (species === 'raptor') {
      this.inventoryMaterials.raptor_claw = (this.inventoryMaterials.raptor_claw || 0) + 2;
      this.inventoryMaterials.raptor_hide = (this.inventoryMaterials.raptor_hide || 0) + 2;
      this.inventoryMaterials.beast_bone = (this.inventoryMaterials.beast_bone || 0) + 2;
      this.callbacks.onNotification('Carved Raptor: +2 Talon, +2 Hide, +2 Bone & +2 Meat Rations!', 'loot');
    } else if (species === 'snapjaw') {
      this.inventoryMaterials.raptor_claw = (this.inventoryMaterials.raptor_claw || 0) + 2;
      this.inventoryMaterials.coral_stone = (this.inventoryMaterials.coral_stone || 0) + 2;
      this.inventoryMaterials.beast_bone = (this.inventoryMaterials.beast_bone || 0) + 3;
      this.callbacks.onNotification('Carved River Snapjaw: +2 Talon, +2 Coral Stone & +2 Fish Rations!', 'loot');
    } else if (species === 'brontoshell') {
      this.inventoryMaterials.bronto_shell = (this.inventoryMaterials.bronto_shell || 0) + 2;
      this.inventoryMaterials.coral_stone = (this.inventoryMaterials.coral_stone || 0) + 2;
      this.callbacks.onNotification('Carved: +2 Brontoshell Carapace, +2 Coral Stone & +2 Rations!', 'loot');
    } else if (species === 'frostfang') {
      this.inventoryMaterials.thunder_horn = (this.inventoryMaterials.thunder_horn || 0) + 2;
      this.inventoryMaterials.obsidian_shard = (this.inventoryMaterials.obsidian_shard || 0) + 2;
      this.inventoryMaterials.beast_bone = (this.inventoryMaterials.beast_bone || 0) + 3;
      this.callbacks.onNotification('Carved Frostfang Mammoth: +2 Glacial Ivory, +2 Obsidian & +2 Rations!', 'loot');
    } else if (species === 'thunderhorn') {
      this.inventoryMaterials.thunder_horn = (this.inventoryMaterials.thunder_horn || 0) + 2;
      this.inventoryMaterials.obsidian_shard = (this.inventoryMaterials.obsidian_shard || 0) + 3;
      this.callbacks.onNotification('Carved: +2 Conductive Crest-Horn, +3 Obsidian Shard & +2 Rations!', 'loot');
    } else if (species === 'sky_dragon') {
      this.inventoryMaterials.dragon_scale = (this.inventoryMaterials.dragon_scale || 0) + 3;
      this.inventoryMaterials.titan_fang = (this.inventoryMaterials.titan_fang || 0) + 2;
      this.inventoryMaterials.magma_core = (this.inventoryMaterials.magma_core || 0) + 2;
      this.callbacks.onNotification(
        'Carved Sky-Dragon: +3 Aetherial Dragon Scale, +2 Sovereign Fang & +2 Magma Core!',
        'loot'
      );
    } else if (species === 'caldera_titan') {
      this.inventoryMaterials.titan_fang = (this.inventoryMaterials.titan_fang || 0) + 2;
      this.inventoryMaterials.magma_core = (this.inventoryMaterials.magma_core || 0) + 2;
      this.callbacks.onNotification('Carved: +2 Sovereign Titan Fang, +2 Apex Magma Heart!', 'loot');
    }
    this.totalMaterialsGathered += 5;
    this.callbacks.onStatsChange(this.playerStats);
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
    this.playerStats.maxHp = 150 + def.maxHpBonus;
    this.playerStats.hp = Math.min(this.playerStats.maxHp, this.playerStats.hp + def.maxHpBonus);
    this.hunter.updateArmor(id);
    this.callbacks.onStatsChange(this.playerStats);
  }

  public setGameState(next: GameState) {
    this.gameState = next;
  }

  public respawnAtCampfire() {
    this.isFlying = false;
    this.playerPos.set(0, this.terrain.getHeight(0, 31.8), 31.8);
    this.playerRotation = Math.PI;
    this.cameraYaw = Math.PI;
    this.playerStats.hp = this.playerStats.maxHp;
    this.playerStats.food = this.playerStats.maxFood;
    this.playerStats.water = this.playerStats.maxWater;
    this.playerStats.foodRations = Math.max(this.playerStats.foodRations, 4);
    this.playerStats.waterCanteens = this.playerStats.maxWaterCanteens;
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
    // 1. Real Atmospheric & Fluid Physics calculation
    const biome = getTerrainBiome(this.playerPos.x, this.playerPos.z);
    this.currentAtmosphere = computeAtmosphericPhysics(
      this.playerPos.x,
      this.playerPos.y,
      this.playerPos.z,
      biome,
      this.weatherSystem.currentWeather,
      timeSec
    );
    this.callbacks.onAtmosphereChange?.(this.currentAtmosphere);

    // 2. Animate River & Ocean UV flow
    if (this.materialCache.waterMaterial.map) {
      this.materialCache.waterMaterial.map.offset.x = (timeSec * 0.18) % 1;
      this.materialCache.waterMaterial.map.offset.y = Math.sin(timeSec * 0.8) * 0.04;
    }
    if (this.materialCache.oceanMaterial.map) {
      this.materialCache.oceanMaterial.map.offset.y = (timeSec * 0.06) % 1;
    }
    this.terrain.oceanMesh.position.y = 0.35 + Math.sin(timeSec * 1.4) * 0.12;

    // 3. Animate 3D Air Streamlines & Thermal Updraft Columns
    const wx = this.currentAtmosphere.windVector.x;
    const wz = this.currentAtmosphere.windVector.z;
    const windRot = Math.atan2(wx, wz);
    for (const r of this.airRibbons) {
      const drift = (timeSec * 3.8 + r.phase * 5) % 28;
      r.mesh.position.x = r.baseX + (wx * drift) * 0.35;
      r.mesh.position.z = r.baseZ + (wz * drift) * 0.35;
      r.mesh.position.y = r.baseY + Math.sin(timeSec * 2 + r.phase) * 0.45;
      r.mesh.rotation.y = windRot + Math.PI / 2;
    }
    for (let i = 0; i < this.thermalColumns.length; i++) {
      const col = this.thermalColumns[i];
      const gy = this.terrain.getHeight(col.x, col.z);
      col.ringMesh.position.y = gy + 1.5 + ((timeSec * 3.5 + i * 2.2) % 9.5);
      const s = 0.85 + Math.sin(timeSec * 3 + i) * 0.2;
      col.ringMesh.scale.set(s, s, 1);
    }

    // 4. Wind Sway Physics on 3D Trees, Ferns, Shrubs & Campfire Flicker
    const foliageChildren = this.terrain.foliageGroup.children;
    const swayAmp = Math.min(0.09, this.currentAtmosphere.windSpeedMs * 0.008);
    for (let i = 0; i < foliageChildren.length; i += 2) {
      const prop = foliageChildren[i];
      prop.rotation.z = Math.sin(timeSec * 2.1 + i * 0.5) * swayAmp;
      prop.rotation.x = Math.cos(timeSec * 1.7 + i * 0.3) * swayAmp * 0.6;
    }

    // 4b. Dynamic Instanced Grass Bending around Player & Wind Sway (Roblox / AAA Turf Physics)
    const gData = this.terrain.grassData;
    const gMesh = this.terrain.instancedGrass;
    const px = this.playerPos.x;
    const pz = this.playerPos.z;
    let grassDirty = false;
    for (let i = 0; i < gData.length; i++) {
      const g = gData[i];
      const dx = g.x - px;
      const dz = g.z - pz;
      if (Math.abs(dx) < 14 && Math.abs(dz) < 14) {
        const dist = Math.hypot(dx, dz);
        this.grassDummy.position.set(g.x, g.y, g.z);
        const windTilt = Math.sin(timeSec * 2.8 + g.x * 0.4 + g.z * 0.4) * (0.12 + swayAmp);
        if (dist < 2.1 && this.isGrounded) {
          // Bend grass blades outward under player footsteps!
          const pushFactor = (1 - dist / 2.1) * 0.72;
          const pushAngle = Math.atan2(dx, dz);
          this.grassDummy.rotation.set(
            Math.cos(pushAngle) * pushFactor,
            g.rotY,
            -Math.sin(pushAngle) * pushFactor
          );
        } else {
          this.grassDummy.rotation.set(windTilt, g.rotY, windTilt * 0.6);
        }
        this.grassDummy.scale.set(g.scale, g.scale, g.scale);
        this.grassDummy.updateMatrix();
        gMesh.setMatrixAt(i, this.grassDummy.matrix);
        grassDirty = true;
      }
    }
    if (grassDirty) {
      gMesh.instanceMatrix.needsUpdate = true;
    }

    // 4c. Flickering Campfire Flame & PointLight Illumination
    const campFlame = this.terrain.campGroup.getObjectByName('campfire_flame');
    const campInner = this.terrain.campGroup.getObjectByName('campfire_flame_inner');
    const campLight = this.terrain.campGroup.getObjectByName('campfire_light') as THREE.PointLight | undefined;
    if (campFlame) {
      const flicker = 0.92 + Math.sin(timeSec * 14) * 0.12 + Math.cos(timeSec * 23) * 0.08;
      campFlame.scale.set(flicker, 0.9 + Math.sin(timeSec * 18) * 0.16, flicker);
      campFlame.rotation.y = timeSec * 1.5;
    }
    if (campInner) {
      campInner.scale.setScalar(0.9 + Math.cos(timeSec * 20) * 0.15);
    }
    if (campLight) {
      campLight.intensity = 5.2 + Math.sin(timeSec * 14) * 0.95 + Math.cos(timeSec * 23) * 0.55;
    }

    // 5. Animate Swimming 3D River & Ocean Fish
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

    // 6. Weather update
    const weatherChanged = this.weatherSystem.update(dt, this.playerPos);
    if (weatherChanged) {
      this.callbacks.onWeatherChange?.(this.weatherSystem.currentWeather);
    }
  }

  private updateNPCs(timeSec: number) {
    for (let i = 0; i < this.npcs.length; i++) {
      const npc = this.npcs[i];
      npc.mesh.position.y = npc.data.y + Math.sin(timeSec * 2.2 + i) * 0.03;
      const dist = Math.hypot(this.playerPos.x - npc.data.x, this.playerPos.z - npc.data.z);
      if (dist < 6.5) {
        const targetRot = Math.atan2(this.playerPos.x - npc.data.x, this.playerPos.z - npc.data.z);
        npc.mesh.rotation.y = stepAngleShortestArc(npc.mesh.rotation.y, targetRot, 0.08);
      }
    }
  }

  private resolveObstacleCollisions() {
    if (this.isFlying) return;
    const obstacles = [
      { x: 0, z: 28, r: 1.68 },     // Campfire Stone Ring (prevents clipping inside campfire!)
      { x: 2.8, z: 27.2, r: 1.25 }, // Crafting Workbench & Anvil
      { x: -3.4, z: 25.5, r: 2.1 }, // Tribal Canopy Tent
      { x: 0, z: 5, r: 3.75 },      // Ancient Signal Tower Base
    ];
    for (const obs of obstacles) {
      const dx = this.playerPos.x - obs.x;
      const dz = this.playerPos.z - obs.z;
      const dist = Math.hypot(dx, dz);
      if (dist < obs.r && dist > 0.0001) {
        this.playerPos.x = obs.x + (dx / dist) * obs.r;
        this.playerPos.z = obs.z + (dz / dist) * obs.r;
      } else if (dist <= 0.0001) {
        this.playerPos.z = obs.z + obs.r;
      }
    }
  }

  private updatePlayer(dt: number) {
    if (this.isChargingHeavy) {
      this.heavyChargeTime += dt;
      if (this.heavyChargeTime >= 0.75) {
        this.releaseHeavyThrust();
      }
    }

    if (this.upperBodyActionTimer > 0) {
      this.upperBodyActionTimer = Math.max(0, this.upperBodyActionTimer - dt);
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

    let isMovingHoriz = false;
    let moveStepDist = 0;

    // Dodge roll / Air-Dash movement
    if (this.isDodging) {
      this.dodgeTimer -= dt;
      const rollSpeed = this.isFlying ? 18.5 : 13.5;
      const step = rollSpeed * dt;
      this.playerPos.x += this.dodgeDirX * step;
      this.playerPos.z += this.dodgeDirZ * step;
      moveStepDist = step;
      this.hunter.torso.rotation.x = (1 - this.dodgeTimer / 0.46) * Math.PI * 2;
      if (this.dodgeTimer <= 0) {
        this.isDodging = false;
        this.hunter.torso.rotation.x = 0;
      }
      isMovingHoriz = true;
    } else {
      // Camera-Relative Joystick & Keyboard Movement
      let moveForward = -this.virtualMoveY;
      let moveRight = this.virtualMoveX;

      if (this.keysPressed.has('KeyW') || this.keysPressed.has('ArrowUp')) moveForward += 1;
      if (this.keysPressed.has('KeyS') || this.keysPressed.has('ArrowDown')) moveForward -= 1;
      if (this.keysPressed.has('KeyD') || this.keysPressed.has('ArrowRight')) moveRight += 1;
      if (this.keysPressed.has('KeyA') || this.keysPressed.has('ArrowLeft')) moveRight -= 1;

      const baseSpeed = this.isFlying ? 14.2 : 8.4;

      const moveResult = computeCameraRelativeMovement(
        moveForward,
        moveRight,
        this.cameraYaw,
        baseSpeed,
        dt
      );

      if (moveResult.isMoving) {
        isMovingHoriz = true;
        const prevRot = this.playerRotation;
        this.playerRotation = stepAngleShortestArc(
          this.playerRotation,
          moveResult.targetRotation,
          Math.min(1, dt * 14)
        );
        // Compute shortest-arc angular turn rate for FC Mobile / GTA turn-leaning
        let rotDelta = this.playerRotation - prevRot;
        while (rotDelta > Math.PI) rotDelta -= Math.PI * 2;
        while (rotDelta < -Math.PI) rotDelta += Math.PI * 2;
        const targetLean = Math.max(-0.42, Math.min(0.42, (rotDelta / Math.max(0.001, dt)) * 0.065));
        this.turnLeanAngle = THREE.MathUtils.damp(this.turnLeanAngle, targetLean, 10, dt);

        this.playerPos.x += moveResult.dx;
        this.playerPos.z += moveResult.dz;
        moveStepDist = Math.hypot(moveResult.dx, moveResult.dz);
      } else {
        this.turnLeanAngle = THREE.MathUtils.damp(this.turnLeanAngle, 0, 10, dt);
      }
    }

    // Resolve collisions against Campfire Stone Ring, Workbench, Tent, and Signal Tower
    this.resolveObstacleCollisions();

    // Clamp to Expanded 420x420 Island Bounds (-125 to +125)
    this.playerPos.x = Math.max(-125, Math.min(125, this.playerPos.x));
    this.playerPos.z = Math.max(-125, Math.min(125, this.playerPos.z));
    const groundY = Math.max(-0.2, this.terrain.getHeight(this.playerPos.x, this.playerPos.z));

    // Vertical Physics: 3D Aerodynamic Flight vs Newtonian Jump & Gravity
    if (this.isFlying) {
      let verticalSpeed = 0;
      if (this.keysPressed.has('Space')) verticalSpeed += 7.5;
      if (this.keysPressed.has('KeyC') || this.keysPressed.has('ControlLeft')) verticalSpeed -= 7.5;

      for (const col of this.thermalColumns) {
        if (Math.hypot(this.playerPos.x - col.x, this.playerPos.z - col.z) < col.radius) {
          verticalSpeed += 4.5;
          break;
        }
      }
      verticalSpeed += this.currentAtmosphere.thermalLiftMs * 0.25;

      this.playerPos.y = Math.max(groundY + 1.2, Math.min(52, this.playerPos.y + verticalSpeed * dt));
    } else if (!this.isGrounded) {
      this.playerVelY -= 19.6 * dt;
      this.playerPos.y += this.playerVelY * dt;
      if (this.playerPos.y <= groundY) {
        this.playerPos.y = groundY;
        this.playerVelY = 0;
        this.isGrounded = true;
        this.playerStats.isJumping = false;
      }
    } else {
      this.playerPos.y = groundY;
    }

    // Distance-Synced 18-Joint Skeletal Gait, Knee/Elbow Flexion & Terrain Foot IK
    if (isMovingHoriz && !this.isDodging) {
      this.gaitPhase += moveStepDist * (this.isFlying ? 1.5 : 3.2);
      const s = Math.sin(this.gaitPhase);
      const c = Math.cos(this.gaitPhase);

      if (this.isFlying) {
        this.hunter.pelvis.position.y = 0.92 + Math.sin(this.gaitPhase * 0.6) * 0.04;
        this.hunter.torso.rotation.x = 0.36;
        this.hunter.torso.rotation.z = -this.turnLeanAngle * 0.85;
        this.hunter.leftLeg.rotation.x = 0.28;
        this.hunter.leftShin.rotation.x = 0.35;
        this.hunter.rightLeg.rotation.x = 0.34;
        this.hunter.rightShin.rotation.x = 0.42;
      } else {
        // Grounded distance-synced sprint gait with articulated knee flexion & torso lean
        this.hunter.pelvis.position.y = 0.92 + Math.abs(c) * 0.055;
        this.hunter.torso.rotation.x = 0.14;
        this.hunter.torso.rotation.z = -this.turnLeanAngle;
        if (!this.isAttacking) {
          this.hunter.torso.rotation.y = -s * 0.14;
        }

        // Left & Right Hip + Knee Flexion (knees only bend backward/positively in local space)
        this.hunter.leftLeg.rotation.x = s * 0.68;
        this.hunter.leftShin.rotation.x = Math.max(0.05, -c * 0.72);
        this.hunter.leftFoot.rotation.x = -s * 0.25;

        this.hunter.rightLeg.rotation.x = -s * 0.68;
        this.hunter.rightShin.rotation.x = Math.max(0.05, c * 0.72);
        this.hunter.rightFoot.rotation.x = s * 0.25;

        if (!this.isAttacking) {
          this.hunter.leftArm.rotation.x = -s * 0.48;
          this.hunter.leftForearm.rotation.x = -0.45 - Math.max(0, s) * 0.35;
          this.hunter.rightArm.rotation.x = s * 0.38;
          this.hunter.rightForearm.rotation.x = -0.52 - Math.max(0, -s) * 0.28;
        }
      }
    } else if (!this.isDodging) {
      // Idle breathing & Terrain Foot IK planting on uneven slopes
      const breath = Math.sin(performance.now() * 0.003);
      this.hunter.pelvis.position.y = THREE.MathUtils.damp(
        this.hunter.pelvis.position.y,
        0.92 + breath * 0.015,
        8,
        dt
      );
      this.hunter.torso.rotation.x = THREE.MathUtils.damp(this.hunter.torso.rotation.x, 0, 8, dt);
      this.hunter.torso.rotation.z = THREE.MathUtils.damp(this.hunter.torso.rotation.z, 0, 8, dt);
      if (!this.isAttacking) {
        this.hunter.torso.rotation.y = THREE.MathUtils.damp(this.hunter.torso.rotation.y, 0, 8, dt);
      }

      // Sample terrain height under Left & Right feet for slope Foot IK
      const cosR = Math.cos(this.playerRotation);
      const sinR = Math.sin(this.playerRotation);
      const lFootWorldX = this.playerPos.x + 0.15 * cosR;
      const lFootWorldZ = this.playerPos.z - 0.15 * sinR;
      const rFootWorldX = this.playerPos.x - 0.15 * cosR;
      const rFootWorldZ = this.playerPos.z + 0.15 * sinR;
      const lDeltaY = Math.max(-0.18, Math.min(0.18, this.terrain.getHeight(lFootWorldX, lFootWorldZ) - groundY));
      const rDeltaY = Math.max(-0.18, Math.min(0.18, this.terrain.getHeight(rFootWorldX, rFootWorldZ) - groundY));

      const lKneeIK = this.isGrounded && lDeltaY > 0 ? lDeltaY * 2.2 : 0.06;
      const rKneeIK = this.isGrounded && rDeltaY > 0 ? rDeltaY * 2.2 : 0.06;

      this.hunter.leftLeg.rotation.x = THREE.MathUtils.damp(this.hunter.leftLeg.rotation.x, -lKneeIK * 0.5, 10, dt);
      this.hunter.leftShin.rotation.x = THREE.MathUtils.damp(this.hunter.leftShin.rotation.x, lKneeIK, 10, dt);
      this.hunter.leftFoot.rotation.x = THREE.MathUtils.damp(this.hunter.leftFoot.rotation.x, 0, 10, dt);

      this.hunter.rightLeg.rotation.x = THREE.MathUtils.damp(this.hunter.rightLeg.rotation.x, -rKneeIK * 0.5, 10, dt);
      this.hunter.rightShin.rotation.x = THREE.MathUtils.damp(this.hunter.rightShin.rotation.x, rKneeIK, 10, dt);
      this.hunter.rightFoot.rotation.x = THREE.MathUtils.damp(this.hunter.rightFoot.rotation.x, 0, 10, dt);

      if (!this.isAttacking) {
        this.hunter.leftArm.rotation.x = THREE.MathUtils.damp(this.hunter.leftArm.rotation.x, breath * 0.04, 8, dt);
        this.hunter.leftForearm.rotation.x = THREE.MathUtils.damp(this.hunter.leftForearm.rotation.x, -0.38, 8, dt);
        this.hunter.rightArm.rotation.x = THREE.MathUtils.damp(this.hunter.rightArm.rotation.x, -0.12 + breath * 0.04, 8, dt);
        this.hunter.rightForearm.rotation.x = THREE.MathUtils.damp(this.hunter.rightForearm.rotation.x, -0.52, 8, dt);
      }
    }

    // Upper-Body Additive Animation when Eating Ration / Drinking Water (Free Fire / Monster Hunter style)
    if (this.upperBodyActionTimer > 0) {
      const p = Math.sin((1 - this.upperBodyActionTimer / 0.45) * Math.PI);
      this.hunter.leftArm.rotation.x = -1.25 * p;
      this.hunter.leftForearm.rotation.x = -1.1 * p;
      this.hunter.head.rotation.x = 0.22 * p;
    } else {
      this.hunter.head.rotation.x = THREE.MathUtils.damp(this.hunter.head.rotation.x, 0, 8, dt);
    }

    // Smooth Dorsal Flight Harness Wing Articulation (Folded Chevron on Ground vs Full Span in Flight)
    if (this.hunter.wings && this.hunter.leftWing && this.hunter.rightWing) {
      const targetScaleX = this.isFlying ? 1.05 : 0.38;
      const targetScaleY = this.isFlying ? 1.05 : 0.45;
      this.hunter.wings.scale.x = THREE.MathUtils.damp(this.hunter.wings.scale.x, targetScaleX, 8, dt);
      this.hunter.wings.scale.y = THREE.MathUtils.damp(this.hunter.wings.scale.y, targetScaleY, 8, dt);
      this.hunter.wings.scale.z = THREE.MathUtils.damp(this.hunter.wings.scale.z, targetScaleX, 8, dt);

      if (this.isFlying) {
        const wingFlap = Math.sin(performance.now() * 0.009) * 0.34;
        this.hunter.leftWing.rotation.z = THREE.MathUtils.damp(this.hunter.leftWing.rotation.z, 0, 8, dt);
        this.hunter.rightWing.rotation.z = THREE.MathUtils.damp(this.hunter.rightWing.rotation.z, 0, 8, dt);
        this.hunter.leftWing.rotation.y = wingFlap;
        this.hunter.rightWing.rotation.y = -wingFlap;
      } else {
        this.hunter.leftWing.rotation.z = THREE.MathUtils.damp(this.hunter.leftWing.rotation.z, -0.75, 8, dt);
        this.hunter.rightWing.rotation.z = THREE.MathUtils.damp(this.hunter.rightWing.rotation.z, 0.75, 8, dt);
        this.hunter.leftWing.rotation.y = THREE.MathUtils.damp(this.hunter.leftWing.rotation.y, 0.18, 8, dt);
        this.hunter.rightWing.rotation.y = THREE.MathUtils.damp(this.hunter.rightWing.rotation.y, -0.18, 8, dt);
      }
    }

    // Scale Ground Contact Shadow based on height above ground
    if (this.hunter.contactShadow) {
      const heightAboveGround = Math.max(0, this.playerPos.y - groundY);
      const shadowScale = Math.max(0.35, 1 - heightAboveGround * 0.04);
      this.hunter.contactShadow.position.y = groundY - this.playerPos.y + 0.025;
      this.hunter.contactShadow.scale.setScalar(shadowScale);
    }

    // Animate Flowing Mastercraft Mithril Cape with Wind & Movement Physics
    if (this.hunter.cape) {
      const speedFactor = isMovingHoriz || this.isFlying ? 0.52 : 0.16;
      this.hunter.cape.rotation.x =
        speedFactor + Math.sin(performance.now() * 0.008) * (0.08 + this.currentAtmosphere.windSpeedMs * 0.01);
      this.hunter.cape.rotation.z = -this.turnLeanAngle * 0.6;
    }

    // Biological Survival Homeostasis (Food kcal & Water mL metabolism + cellular HP regen)
    const biome = getTerrainBiome(this.playerPos.x, this.playerPos.z);
    const inFreshWater = (biome === 'river' || biome === 'springs') && this.isGrounded;
    this.playerStats = computeSurvivalMetabolism(
      this.playerStats,
      this.currentAtmosphere,
      isMovingHoriz,
      this.isFlying,
      inFreshWater,
      dt
    );
    this.playerStats.isFlying = this.isFlying;
    this.playerStats.altitude = Math.round(this.playerPos.y * 12.5);
    this.playerStats.airSpeed = isMovingHoriz ? (this.isFlying ? 14.2 : 8.4) : 0;

    this.hunter.root.position.copy(this.playerPos);
    this.hunter.root.rotation.y = this.playerRotation;

    // Update Diegetic 3D Player Turf Ring position
    this.playerDiegeticGroup.position.set(this.playerPos.x, groundY + 0.035, this.playerPos.z);

    // Articulated 3-Phase Spear Attack (Windup -> Active Lunge Thrust -> Recovery)
    if (this.isAttacking) {
      this.attackTimer -= dt;
      const totalDur = this.isHeavyAttack ? 0.48 : 0.34;
      const swingProgress = 1 - this.attackTimer / totalDur;

      if (swingProgress < 0.25) {
        // Phase 1: Windup (draw shoulder back, cock elbow, coil torso)
        const w = swingProgress / 0.25;
        this.hunter.torso.rotation.y = -0.35 * w;
        this.hunter.rightArm.rotation.x = 0.45 * w;
        this.hunter.rightForearm.rotation.x = -0.85;
        this.hunter.weaponMount.position.z = 0.04 - 0.18 * w;
      } else if (swingProgress < 0.72) {
        // Phase 2: Active Lunge Thrust (snap torso forward, drive shoulder & extend elbow + spear)
        const a = Math.sin(((swingProgress - 0.25) / 0.47) * Math.PI);
        this.hunter.torso.rotation.y = 0.42 * a;
        this.hunter.torso.rotation.x = 0.24 * a;
        this.hunter.rightArm.rotation.x = -1.15 * a;
        this.hunter.rightForearm.rotation.x = -0.52 + 0.44 * a;
        this.hunter.rightHand.rotation.x = 0.32 * a;
        this.hunter.weaponMount.position.z = 0.04 + (this.isHeavyAttack ? 0.95 : 0.68) * a;
        this.evaluateSpearHits();
      } else {
        // Phase 3: Recovery
        const r = 1 - (swingProgress - 0.72) / 0.28;
        this.hunter.torso.rotation.y = 0.15 * r;
        this.hunter.rightArm.rotation.x = -0.3 * r;
        this.hunter.rightForearm.rotation.x = -0.52;
        this.hunter.rightHand.rotation.x = 0;
        this.hunter.weaponMount.position.z = 0.04;
      }

      if (this.attackTimer <= 0) {
        this.isAttacking = false;
        this.hunter.torso.rotation.y = 0;
        this.hunter.rightArm.rotation.x = -0.12;
        this.hunter.rightForearm.rotation.x = -0.52;
        this.hunter.rightHand.rotation.x = 0;
        this.hunter.weaponMount.position.z = 0.04;
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
      const distXZ = Math.hypot(tipX - actor.state.x, tipZ - actor.state.z);
      const distY = Math.abs(this.playerPos.y - actor.state.y);
      const hitRadius = actor.state.isFlyingBeast ? 5.8 : 4.4;
      if (distXZ > hitRadius || distY > 7.5) continue;

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
        if (Math.hypot(tipX - wpWorldX, tipZ - wpWorldZ) <= wp.radius + 1.4) {
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
      this.cameraShakeIntensity = Math.max(this.cameraShakeIntensity, this.isHeavyAttack ? 0.24 : 0.12);
      sound.playHitImpact(dmgRes.isWeakPointHit, dmgRes.isCrit);
      this.callbacks.onHitMarker?.(dmgRes.finalDamage, dmgRes.isCrit, dmgRes.isWeakPointHit);
      this.spawnParticles(
        actor.state.x,
        actor.state.y + 1.6,
        actor.state.z,
        dmgRes.isWeakPointHit ? 0xfbbf24 : 0xef4444,
        12
      );

      if (hitWpId) {
        const idx = actor.state.weakPoints.findIndex((w) => w.id === hitWpId);
        if (idx >= 0) {
          const res = applyWeakPointDamage(actor.state.weakPoints[idx], dmgRes.finalDamage);
          actor.state.weakPoints[idx] = res.updated;
          if (res.justBroke) {
            actor.state.aiState = 'staggered';
            actor.state.stateTimer = 4.2;
            sound.playPartBreak();
            const bonusMat = res.updated.bonusDropMaterialId;
            this.inventoryMaterials[bonusMat] = (this.inventoryMaterials[bonusMat] || 0) + 1;
            this.callbacks.onNotification(
              `Part Broken: ${res.updated.name}! Beast Grounded & Staggered! (+1 ${bonusMat.replace('_', ' ')})`,
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
        const gy = this.terrain.getHeight(actor.state.x, actor.state.z);
        actor.state.y = gy;
        actor.rig.root.rotation.z = Math.PI / 2.2;
        actor.rig.root.position.y = gy + 0.5;
        if (!this.beastsHunted.includes(actor.state.species)) {
          this.beastsHunted.push(actor.state.species);
        }
        this.upgradeKnowledge(actor.state.species, 'mastered');
        this.advanceQuestOnKill(actor.state.species);
        this.advanceAdventureProgress(actor.state.species, 'kill');
        this.callbacks.onNotification(
          `Slain: ${actor.state.name}! Approach and press [E] to Carve materials & rations.`,
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
    } else if ((species === 'caldera_titan' || species === 'sky_dragon') && this.currentQuestIndex <= 4) {
      this.currentQuestIndex = 5;
    }
    this.callbacks.onQuestUpdate(this.currentQuestIndex);
  }

  private updateBeasts(dt: number) {
    let closestBeast: BeastState | null = null;
    let closestDist = 30; // Only lock onto beasts that are genuinely within visual/combat range (<= 30m)

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
        if (trap.active && Math.hypot(s.x - trap.x, s.z - trap.z) < 2.5) {
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
        const orbitSpeed = s.isFlyingBeast ? 0.55 : 0.42;
        const orbitRadius = s.isFlyingBeast ? 14 : 6.5;
        actor.patrolAngle += dt * orbitSpeed;
        const targetX = actor.homeX + Math.cos(actor.patrolAngle) * orbitRadius;
        const targetZ = actor.homeZ + Math.sin(actor.patrolAngle) * orbitRadius;
        const dx = targetX - s.x;
        const dz = targetZ - s.z;
        s.rotation = stepAngleShortestArc(s.rotation, Math.atan2(dx, dz), dt * 4);
        const patrolSpeed = s.isFlyingBeast ? 6.8 : 2.2;
        s.x += Math.sin(s.rotation) * patrolSpeed * dt;
        s.z += Math.cos(s.rotation) * patrolSpeed * dt;

        // Only aggro when player approaches within direct combat proximity (16m ground, 20m flying)
        // and never aggro while the player is resting in the Campfire Haven safe radius (< 6m from 0, 28)
        const playerInCampSafeZone = Math.hypot(this.playerPos.x - 0, this.playerPos.z - 28) < 6.2;
        if (!playerInCampSafeZone && distToPlayer < (s.isFlyingBeast ? 20 : 16)) {
          s.aiState = 'chase';
          this.upgradeKnowledge(s.species, 'sighted');
          sound.playBeastRoar(s.species);
        }
      } else if (s.aiState === 'chase') {
        s.rotation = stepAngleShortestArc(s.rotation, angleToPlayer, dt * 6);
        const moveSpeed = s.isFlyingBeast ? (s.enraged ? 9.8 : 7.8) : s.enraged ? 6.2 : 4.6;
        if (distToPlayer > 4.2) {
          s.x += Math.sin(s.rotation) * moveSpeed * dt;
          s.z += Math.cos(s.rotation) * moveSpeed * dt;
        } else {
          s.aiState = 'telegraph_charge';
          s.stateTimer = s.enraged ? 0.75 : 1.05;
          actor.chargeDirX = Math.sin(angleToPlayer);
          actor.chargeDirZ = Math.cos(angleToPlayer);
        }
        if (distToPlayer > 34) {
          s.aiState = 'patrol';
        }
      } else if (s.aiState === 'telegraph_charge') {
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
        if (
          Math.hypot(this.playerPos.x - s.x, this.playerPos.z - s.z) < 3.1 &&
          Math.abs(this.playerPos.y - s.y) < 4.5
        ) {
          const elapsedDodge = 0.46 - this.dodgeTimer;
          if (!this.isDodging || !isDodgeInvulnerable(elapsedDodge, 0.46)) {
            const rawDmg =
              s.species === 'caldera_titan' || s.species === 'sky_dragon'
                ? 36
                : s.species === 'frostfang'
                ? 30
                : 22;
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

      const groundY = this.terrain.getHeight(s.x, s.z);
      const animT = performance.now() * 0.008;

      if (s.isFlyingBeast) {
        if (s.aiState === 'staggered') {
          s.y = groundY + 0.5;
        } else if (s.aiState === 'chase' || s.aiState === 'attack_charge' || s.aiState === 'telegraph_charge') {
          const targetY = Math.max(groundY + 2.2, this.playerPos.y + 1.2);
          s.y += (targetY - s.y) * Math.min(1, dt * 3.5);
        } else {
          const cruiseY = groundY + (s.flightAltitude ?? 8.5) + Math.sin(animT * 0.9) * 1.4;
          s.y += (cruiseY - s.y) * Math.min(1, dt * 2.5);
        }

        if (actor.rig.legs.length >= 2) {
          const flap = Math.sin(animT * 1.8) * 0.55;
          actor.rig.legs[0].rotation.z = flap;
          actor.rig.legs[1].rotation.z = -flap;
        }
      } else {
        s.y = groundY;
        actor.rig.legs.forEach((leg, idx) => {
          leg.rotation.x = Math.sin(animT + idx * Math.PI) * 0.32;
        });
      }

      actor.rig.root.position.set(s.x, s.y, s.z);
      actor.rig.root.rotation.y = s.rotation;
      actor.rig.tail.rotation.y = Math.sin(animT) * 0.25;
    }

    // Update Diegetic 3D Beast Threat Ring & Player Turf Directional Arrow
    if (closestBeast && closestBeast.hp > 0) {
      const bGroundY = this.terrain.getHeight(closestBeast.x, closestBeast.z);
      this.beastThreatRing.visible = true;
      this.beastThreatRing.position.set(closestBeast.x, bGroundY + 0.05, closestBeast.z);
      const isTelegraph = closestBeast.aiState.startsWith('telegraph') || closestBeast.aiState.startsWith('attack');
      (this.beastThreatRing.material as THREE.MeshBasicMaterial).color.setHex(
        isTelegraph ? 0xef4444 : 0xf59e0b
      );
      const pulse = 1 + Math.sin(performance.now() * 0.01) * (isTelegraph ? 0.14 : 0.05);
      this.beastThreatRing.scale.set(pulse, pulse, 1);

      const dirAngle = Math.atan2(closestBeast.x - this.playerPos.x, closestBeast.z - this.playerPos.z);
      this.playerDirectionArrow.rotation.y = dirAngle;
      (this.playerDirectionArrow.material as THREE.MeshBasicMaterial).color.setHex(0xf97316);
    } else {
      this.beastThreatRing.visible = false;
      const quest = QUEST_CHAIN[Math.min(this.currentQuestIndex, QUEST_CHAIN.length - 1)];
      if (quest) {
        const dirAngle = Math.atan2(quest.targetX - this.playerPos.x, quest.targetZ - this.playerPos.z);
        this.playerDirectionArrow.rotation.y = dirAngle;
        (this.playerDirectionArrow.material as THREE.MeshBasicMaterial).color.setHex(0x38bdf8);
      }
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
    const dist = this.isFlying ? 9.4 : this.cameraDistance;
    const camX =
      this.playerPos.x - Math.sin(this.cameraYaw) * Math.cos(this.cameraPitch) * dist;
    const camZ =
      this.playerPos.z - Math.cos(this.cameraYaw) * Math.cos(this.cameraPitch) * dist;
    const desiredY = this.playerPos.y + 1.8 + Math.sin(this.cameraPitch) * dist;
    const groundAtCam = this.terrain.getHeight(camX, camZ) + 0.85;
    let camY = Math.max(groundAtCam, desiredY);

    if (this.cameraShakeIntensity > 0) {
      camY += (Math.random() - 0.5) * this.cameraShakeIntensity;
      this.cameraShakeIntensity = Math.max(0, this.cameraShakeIntensity - dt * 1.8);
    }

    this.camera.position.set(camX, camY, camZ);
    this.camera.lookAt(this.playerPos.x, this.playerPos.y + 1.45, this.playerPos.z);
  }

  private checkInteractPrompts() {
    for (const nest of this.eggNests) {
      if (
        !nest.data.collected &&
        Math.hypot(this.playerPos.x - nest.data.x, this.playerPos.z - nest.data.z) < 5.0
      ) {
        this.callbacks.onInteractPrompt(
          `Press [E] or Tap to Extract ${nest.data.name} (${nest.data.caloricValueKcal} kcal)`
        );
        return;
      }
    }
    for (const npc of this.npcs) {
      if (Math.hypot(this.playerPos.x - npc.data.x, this.playerPos.z - npc.data.z) < 4.2) {
        this.callbacks.onInteractPrompt(`Press [E] or Tap to Speak with ${npc.data.name}`);
        return;
      }
    }
    if (Math.hypot(this.playerPos.x - 0, this.playerPos.z - 28) < 5.2) {
      this.callbacks.onInteractPrompt('Press [E] or Tap to Rest, Cook & Forge at Campfire');
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
        Math.hypot(this.playerPos.x - actor.state.x, this.playerPos.z - actor.state.z) < 6.0
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
