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
  PlayableCharacterId,
  StrikeGestureType,
  DayNightState,
} from '../../types/game.ts';
import {
  WEAPON_REGISTRY,
  ARMOR_REGISTRY,
  QUEST_CHAIN,
  INITIAL_EGG_NESTS,
  ADVENTURE_MISSIONS,
  PLAYABLE_CHARACTER_PROFILES,
  calculateDamage,
  calculatePlayerDamageTaken,
  isDodgeInvulnerable,
  applyWeakPointDamage,
  createBeastWeakPoints,
  computeCameraRelativeMovement,
  computeAtmosphericPhysics,
  computeSurvivalMetabolism,
  computeDayNightCycle,
  stepAngleShortestArc,
} from '../logic/rules.ts';
import { MaterialCache } from '../graphics/materials.ts';
import {
  buildHunterModel,
  buildBeastModel,
  buildSpaceFighterModel,
  buildTribalNPCModel,
  buildEggNestModel,
  createSculptedOrganicGeometry,
  type HunterRig,
  type BeastRig,
  type SpaceFighterRig,
} from './assetLoaderAndRigging.ts';
import {
  createTerrain,
  createInitialTrackClues,
  getTerrainBiome,
  type TerrainSystem,
} from '../graphics/terrain.ts';
import { sound } from '../audio/soundEngine.ts';
import { WeatherSystem } from './weatherSystem.ts';
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
  onDayNightChange?: (dayNight: DayNightState) => void;
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
  wingDamageAccumulated: number;
  footprintTimer: number;
}

interface ActiveNPCActor {
  data: TribalNPC;
  mesh: THREE.Group;
}

interface ActiveProjectile {
  mesh: THREE.Mesh;
  vx: number;
  vy: number;
  vz: number;
  age: number;
  landed: boolean;
  kind: 'lure_stone' | 'rifle_bullet' | 'plasma_bolt' | 'brass_casing';
  damage: number;
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

interface CompanionHeroSlot {
  id: PlayableCharacterId;
  rig: HunterRig;
  pos: THREE.Vector3;
  rotation: number;
  gaitPhase: number;
  aiAngle: number;
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
  private heroRoster = new Map<PlayableCharacterId, CompanionHeroSlot>();
  public activeCharacterId: PlayableCharacterId = 'demon_hunter';

  // Playable Space Fighter & Tamable Armor Dinosaur Mount
  private spaceFighter!: SpaceFighterRig;
  private spaceFighterPadPos = new THREE.Vector3(10.5, 0, 26.2);
  private spaceFighterPos = new THREE.Vector3(10.5, 0, 26.2);
  private spaceFighterRotY = Math.PI;
  private spaceFighterRoll = 0;
  private spaceFighterPitch = 0;
  public isPilotingSpaceFighter = false;
  public mountedBeastActor: ActiveBeastActor | null = null;

  // GTA V Sky-Camera Transition State
  private gtaSkyCamTimer = 0;
  private gtaSkyCamDuration = 0.65;
  private gtaSkyCamFrom = new THREE.Vector3();
  private gtaSkyCamTo = new THREE.Vector3();

  // Day-Night Cycle State
  public timeOfDayHours = 10.5;
  public dayNightState: DayNightState = computeDayNightCycle(10.5);
  private scratchTargetVec = new THREE.Vector3();

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
  private muzzleFlashTimer = 0;
  private recoilImpulse = 0;
  private activeGesture: StrikeGestureType = 'tap';
  private shockwaveRingMesh!: THREE.Mesh;
  private shockwaveTimer = 0;

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
  private projectiles: ActiveProjectile[] = [];
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
      activeCharacter: 'demon_hunter',
      isPilotingSpaceFighter: false,
      isMountedOnBeast: false,
      timeOfDayHours: 10.5,
      isNight: false,
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
    this.scene.background = new THREE.Color(0x1a2636);
    this.scene.fog = new THREE.FogExp2(0x243242, 0.0082);

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

    // Materials & Terrain
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

    // Spawn Playable Roster (GTA V Instant Character Swap: Demon Hunter, S.W.A.T. Operator, Bulky Knight)
    let spawnX = saveData.playerPos.x;
    let spawnZ = saveData.playerPos.z;
    if (Math.hypot(spawnX - 0, spawnZ - 28) < 2.2) {
      spawnX = 0;
      spawnZ = 31.8;
    }
    this.playerPos.set(spawnX, this.terrain.getHeight(spawnX, spawnZ), spawnZ);

    const rosterCoords: Record<PlayableCharacterId, { x: number; z: number; rot: number }> = {
      demon_hunter: { x: spawnX, z: spawnZ, rot: Math.PI },
      swat_operator: { x: -4.2, z: 29.8, rot: 2.8 },
      bulky_knight: { x: 4.2, z: 29.5, rot: -2.8 },
    };

    (['demon_hunter', 'swat_operator', 'bulky_knight'] as PlayableCharacterId[]).forEach((charId, idx) => {
      const rig = buildHunterModel(this.materialCache, this.equippedArmor, charId);
      rig.updateWeapon(this.equippedWeapon);
      rig.updateArmor(this.equippedArmor);
      const c = rosterCoords[charId];
      const cy = this.terrain.getHeight(c.x, c.z);
      const pos = new THREE.Vector3(c.x, cy, c.z);
      rig.root.position.copy(pos);
      rig.root.rotation.y = c.rot;
      this.scene.add(rig.root);
      this.heroRoster.set(charId, {
        id: charId,
        rig,
        pos,
        rotation: c.rot,
        gaitPhase: idx * 1.4,
        aiAngle: idx * 2.1,
      });
    });

    this.hunter = this.heroRoster.get('demon_hunter')!.rig;

    // Initialize Playable 6-DOF Space Fighter on Base Camp Stone Landing Pad
    this.initSpaceFighter();

    // Initialize Diegetic 3D World Rings (Player Tactical Turf Ring + Beast Threat Ring + Shockwave)
    this.initDiegeticWorldUI();

    // Initialize Tribal Characters (NPCs)
    this.initNPCs();

    // Initialize All 7 Prehistoric & Draconic Beasts + 7 Creature Egg Nests
    this.initBeasts();
    this.initEggNestsAndAirStreams();

    // Pre-allocate particle geometries
    this.initParticles();

    // Seed initial beast footprints so Focus Vision [F] shows tracking trails immediately
    this.seedInitialFootprintTrails();

    // Pre-warm renderer
    this.renderer.compile(this.scene, this.camera);

    // Bind event listeners
    this.bindEvents();

    // Expose deterministic test & inspection hooks
    (window as any).__PRIMAL_ENGINE__ = this;
    (window as any).__gameTest = {
      getState: () => ({
        gameState: this.gameState,
        activeCharacter: this.activeCharacterId,
        isPilotingSpaceFighter: this.isPilotingSpaceFighter,
        isMountedOnBeast: Boolean(this.mountedBeastActor),
        dayNight: this.dayNightState,
        focusVisionActive: this.focusVisionActive,
        footprintCount: this.trailSystem.dynamicFootprints.length,
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
          aiState: b.state.aiState,
          isFlyingBeast: b.state.isFlyingBeast,
        })),
      }),
      setVirtualMove: (x: number, y: number) => {
        this.virtualMoveX = x;
        this.virtualMoveY = y;
      },
      switchCharacter: (charId: PlayableCharacterId) => this.switchCharacter(charId),
      advanceTimeOfDay: (hours = 6) => this.advanceTimeOfDay(hours),
      toggleFocus: () => this.toggleHunterFocus(),
      toggleFlight: () => this.toggleFlightMode(),
      toggleSpaceFighter: () => this.toggleSpaceFighterBoarding(),
      strike: (gesture: StrikeGestureType = 'tap') => this.performStrike(gesture),
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

  private initSpaceFighter() {
    const padY = this.terrain.getHeight(this.spaceFighterPadPos.x, this.spaceFighterPadPos.z);
    this.spaceFighterPadPos.y = padY;
    this.spaceFighterPos.set(this.spaceFighterPadPos.x, padY + 0.25, this.spaceFighterPadPos.z);

    // Stone Landing Pad Apron
    const padGeo = createSculptedOrganicGeometry(
      [
        [0.0, 3.8, 3.8],
        [0.8, 3.5, 3.5],
        [1.0, 3.3, 3.3],
      ],
      24,
      0.24,
      0
    );
    const padMesh = new THREE.Mesh(padGeo, this.materialCache.stoneMaterial);
    padMesh.position.copy(this.spaceFighterPadPos);
    padMesh.receiveShadow = true;
    this.scene.add(padMesh);

    const padRing = new THREE.Mesh(
      new THREE.RingGeometry(2.85, 3.05, 32).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.55,
      })
    );
    padRing.position.set(this.spaceFighterPadPos.x, padY + 0.26, this.spaceFighterPadPos.z);
    this.scene.add(padRing);

    this.spaceFighter = buildSpaceFighterModel(this.materialCache);
    this.spaceFighter.root.position.copy(this.spaceFighterPos);
    this.spaceFighter.root.rotation.y = this.spaceFighterRotY;
    this.scene.add(this.spaceFighter.root);
  }

  private initDiegeticWorldUI() {
    // 1. Diegetic 3D Turf Ring beneath Player
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

    // 3D Directional Threat / Waypoint Arrow on the Player's Turf Ring (Sculpted - Zero Primitives)
    const arrowGeo = createSculptedOrganicGeometry(
      [
        [0.0, 0.18, 0.08],
        [0.5, 0.11, 0.05],
        [1.0, 0.005, 0.005],
      ],
      6,
      0.42,
      0
    );
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

    // 2. Diegetic 3D Beast Lock-On / Telegraph Ring
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

    // 3. Bulky Knight Earthshatter Slam Shockwave Ring
    const shockGeo = new THREE.RingGeometry(0.8, 1.25, 36);
    shockGeo.rotateX(-Math.PI / 2);
    const shockMat = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.shockwaveRingMesh = new THREE.Mesh(shockGeo, shockMat);
    this.shockwaveRingMesh.visible = false;
    this.scene.add(this.shockwaveRingMesh);
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
          'Chief Kael: "Swap between Demon Hunter [1], S.W.A.T. Operator [2], and Bulky Knight [3]! Board the Space Fighter [E] or activate Focus Vision [F] to follow glowing beast footprints!"',
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
          'Torak: "Beware nightfall! Beasts grow +35% more aggressive in the dark, but Luminous Night-Spores bloom across the Mystic Forest!"',
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
          'Scout Lyra: "Jason T stalks the Fern Forest ahead! Shoot its Head during a lunge to stun it, or snare an Armor Dinosaur in a Trap [R] to mount and ride it!"',
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
        name: 'Ravine Stalker Alpha (Jason T Pack)',
        title: 'Swift Digitigrade Predator',
        x: -24,
        z: 42,
        hp: 240,
        biome: 'jungle',
      },
      {
        id: 'snapjaw_leviathan',
        species: 'snapjaw',
        name: 'Jason T — River Snapjaw Leviathan',
        title: 'Apex Ravine Stalker of the Fern Forest',
        x: -9,
        z: 15.5,
        hp: 340,
        biome: 'river',
      },
      {
        id: 'bronto_behemoth',
        species: 'brontoshell',
        name: 'Armor Dinosaur Juggernaut',
        title: 'Tamable Heavy Carapace Tank',
        x: 42,
        z: 38,
        hp: 380,
        biome: 'coast',
      },
      {
        id: 'frostfang_mammoth',
        species: 'frostfang',
        name: 'Glacial Horned Behemoth',
        title: 'Colossus of the Cold Snow Mountains',
        x: 58,
        z: -18,
        hp: 490,
        biome: 'snow',
      },
      {
        id: 'thunderhorn_prime',
        species: 'thunderhorn',
        name: 'Triceratops Beetle Prime',
        title: 'Chitinous 6-Legged Horned Behemoth',
        x: -44,
        z: -16,
        hp: 460,
        biome: 'springs',
      },
      {
        id: 'sky_dragon_aurelius',
        species: 'sky_dragon',
        name: 'Dragon Character 3D · Aurelius',
        title: 'Apex Guardian of OP-01 Wyvern Trench',
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
        name: 'Ignis-Rex, Volcanic Armor Titan',
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
        wingDamageAccumulated: 0,
        footprintTimer: Math.random() * 0.4,
      });
    });

    // Track Clues (Sculpted Rings - Zero Primitives)
    const initialClues = createInitialTrackClues();
    const clueRingGeo = new THREE.RingGeometry(0.48, 0.68, 20);
    clueRingGeo.rotateX(-Math.PI / 2);
    initialClues.forEach((clue) => {
      const group = new THREE.Group();
      const ring = new THREE.Mesh(clueRingGeo, this.materialCache.focusClueGlow);
      ring.position.y = 0.15;
      group.add(ring);
      group.position.set(clue.x, clue.y, clue.z);
      this.terrain.clueGroup.add(group);
      this.clues.push({ data: clue, mesh: group });
    });
  }

  private seedInitialFootprintTrails() {
    // Seed a trail of 16 footprints leading from near Base Camp (0, 26) toward Jason T (-9, 15.5) and Raptor (-24, 42)
    for (let i = 0; i < 16; i++) {
      const t = i / 15;
      const fx = THREE.MathUtils.lerp(-1.5, -9.0, t) + Math.sin(i * 1.2) * 0.4;
      const fz = THREE.MathUtils.lerp(27.0, 16.0, t);
      const fy = this.terrain.getHeight(fx, fz);
      this.trailSystem.addFootprint(fx, fy, fz, Math.atan2(-7.5, -11.0), 'snapjaw');
    }
  }

  private initEggNestsAndAirStreams() {
    INITIAL_EGG_NESTS.forEach((nestCfg) => {
      const copy: CreatureEggNest = { ...nestCfg };
      copy.y = this.terrain.getHeight(copy.x, copy.z);
      const nestMesh = buildEggNestModel(copy.species, this.materialCache);
      nestMesh.position.set(copy.x, copy.y, copy.z);
      this.scene.add(nestMesh);
      this.eggNests.push({ data: copy, mesh: nestMesh });
    });

    // 3D Thermal Updraft Columns (>14m altitude lift)
    const thermalSpots = [
      { x: -16, z: -38, radius: 7.5 },
      { x: -42, z: -14, radius: 6.5 },
      { x: 48, z: -12, radius: 7.0 },
      { x: 0, z: 12, radius: 6.0 },
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
        new THREE.RingGeometry(spot.radius * 0.52, spot.radius * 0.68, 28),
        ringMat
      );
      ringMesh.rotation.x = Math.PI / 2;
      ringMesh.position.set(spot.x, gy + 2.5, spot.z);
      this.airStreamGroup.add(ringMesh);
      this.thermalColumns.push({ ...spot, ringMesh });
    }

    // 3D Wind Streamline Ribbons (Sculpted - Zero Primitives)
    const ribbonGeo = createSculptedOrganicGeometry(
      [
        [0.0, 0.02, 0.04],
        [0.5, 0.04, 0.08],
        [1.0, 0.02, 0.04],
      ],
      6,
      2.8,
      -1.4
    );
    ribbonGeo.rotateZ(Math.PI / 2);
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
    const geo = createSculptedOrganicGeometry(
      [
        [0.0, 0.03, 0.03],
        [0.5, 0.14, 0.14],
        [1.0, 0.03, 0.03],
      ],
      6,
      0.22,
      -0.11
    );
    for (let i = 0; i < 48; i++) {
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
    window.addEventListener('blur', this.onWindowBlur);
    this.renderer.domElement.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    this.renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  private onWindowBlur = () => {
    this.keysPressed.clear();
    this.isPointerDown = false;
  };

  private onKeyDown = (e: KeyboardEvent) => {
    this.keysPressed.add(e.code);
    if (this.gameState !== 'playing') return;

    if (e.code === 'Digit1') {
      this.switchCharacter('demon_hunter');
    } else if (e.code === 'Digit2') {
      this.switchCharacter('swat_operator');
    } else if (e.code === 'Digit3') {
      this.switchCharacter('bulky_knight');
    } else if (e.code === 'KeyN') {
      this.advanceTimeOfDay(6);
    } else if (e.code === 'Space') {
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
    } else if (e.code === 'KeyC' || e.code === 'KeyH') {
      this.drinkWaterCanteen();
    } else if (e.code === 'KeyG') {
      this.useCollectedEgg();
    } else if (e.code === 'KeyT' || e.code === 'KeyR') {
      this.placeTrap();
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
      this.performStrike('tap');
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

  /**
   * GTA V Instant Character-Wheel Swap System:
   * Triggers a sky-camera zoom transition (camera.position.y += 45 over 0.4s, panning to target character,
   * then zooming back down to third-person follow camera). Uncontrolled characters run autonomous AI.
   */
  public switchCharacter(targetId: PlayableCharacterId) {
    if (this.activeCharacterId === targetId || this.isPilotingSpaceFighter) return;
    const currentSlot = this.heroRoster.get(this.activeCharacterId);
    const nextSlot = this.heroRoster.get(targetId);
    if (!currentSlot || !nextSlot) return;

    // Save current hero position into its companion slot
    currentSlot.pos.copy(this.playerPos);
    currentSlot.rotation = this.playerRotation;

    this.gtaSkyCamFrom.copy(this.playerPos);
    this.gtaSkyCamTo.copy(nextSlot.pos);
    this.gtaSkyCamTimer = this.gtaSkyCamDuration;

    this.activeCharacterId = targetId;
    this.hunter = nextSlot.rig;
    this.playerPos.copy(nextSlot.pos);
    this.playerRotation = nextSlot.rotation;
    this.isFlying = false;

    const profile = PLAYABLE_CHARACTER_PROFILES[targetId];
    this.playerStats.activeCharacter = targetId;
    this.playerStats.defense = ARMOR_REGISTRY[this.equippedArmor].defense + profile.defenseBonus;

    sound.playFocusPulse();
    this.spawnParticles(this.playerPos.x, this.playerPos.y + 1.2, this.playerPos.z, 0x38bdf8, 14);
    this.callbacks.onNotification(
      `GTA Sky-Cam Swap → ${profile.name} (${profile.role})`,
      'info'
    );
    this.callbacks.onStatsChange(this.playerStats);
  }

  /**
   * Advances the Day-Night Cycle by `deltaHours` so players can experience
   * daytime Sun-Herb gathering vs nocturnal beast aggression & Luminous Night-Spores.
   */
  public advanceTimeOfDay(deltaHours = 6) {
    this.timeOfDayHours = (this.timeOfDayHours + deltaHours) % 24;
    this.dayNightState = computeDayNightCycle(this.timeOfDayHours);
    this.playerStats.timeOfDayHours = this.dayNightState.timeOfDayHours;
    this.playerStats.isNight = this.dayNightState.isNight;
    this.callbacks.onDayNightChange?.(this.dayNightState);
    this.callbacks.onNotification(
      `Time of Day: ${Math.floor(this.dayNightState.timeOfDayHours)}:00 (${this.dayNightState.phase.toUpperCase()}) · ${
        this.dayNightState.isNight
          ? '🌙 Night Aggression +35% · Luminous Night-Spores Active!'
          : '☀ Daylight Illumination · Sun-Herbs Active!'
      }`,
      this.dayNightState.isNight ? 'danger' : 'info'
    );
    this.callbacks.onStatsChange(this.playerStats);
  }

  /**
   * Unified Multi-Gesture Strike Handler (Tap / Swipe Up / Swipe Down)
   */
  public performStrike(gesture: StrikeGestureType = 'tap') {
    if (this.isPilotingSpaceFighter) {
      this.fireSpaceFighterPlasma();
      return;
    }

    if (this.mountedBeastActor) {
      // Mounted Armor Dinosaur Bull Charge & Stomp
      this.isAttacking = true;
      this.attackTimer = 0.42;
      this.beasts.forEach((b) => (b.hitThisSwing = false));
      this.cameraShakeIntensity = 0.28;
      sound.playBeastRoar('brontoshell');
      this.evaluateSpearHits(4.8, 1.9);
      return;
    }

    this.activeGesture = gesture;

    if (this.activeCharacterId === 'demon_hunter') {
      if (gesture === 'swipe_up') {
        // Demon Vault & Double-Jump Spectral Wing Glide
        this.isGrounded = false;
        this.playerVelY = 11.5;
        this.isFlying = true;
        this.playerStats.isFlying = true;
        this.isAttacking = true;
        this.attackTimer = 0.45;
        this.spawnParticles(this.playerPos.x, this.playerPos.y + 1, this.playerPos.z, 0xa855f7, 16);
        sound.playSpearSwing(true);
        this.evaluateSpearHits(4.2, 1.6);
        this.callbacks.onNotification('Demon Vault! 360° Aerial Spin & Spectral Wings Deployed!', 'info');
        this.callbacks.onStatsChange(this.playerStats);
        return;
      } else if (gesture === 'swipe_down') {
        // Shadow Dash: 8m forward crouch dash with purple afterimage & i-frames
        this.isDodging = true;
        this.dodgeTimer = 0.38;
        this.dodgeDirX = Math.sin(this.playerRotation);
        this.dodgeDirZ = Math.cos(this.playerRotation);
        this.spawnParticles(this.playerPos.x, this.playerPos.y + 0.8, this.playerPos.z, 0xa855f7, 18);
        sound.playDodgeRoll();
        this.evaluateSpearHits(4.5, 1.5);
        this.callbacks.onNotification('Shadow Dash! 8m Invulnerable Phase Lunge!', 'info');
        return;
      }
    } else if (this.activeCharacterId === 'swat_operator') {
      // S.W.A.T. Operator Rifle Fire + Recoil Impulse + Muzzle Flash PointLight + Brass Shell Ejection
      this.fireSwatRifle(gesture === 'swipe_up');
      return;
    } else if (this.activeCharacterId === 'bulky_knight' && gesture === 'swipe_up') {
      // Bulky Knight Earthshatter Slam: leaps 3m and stuns all beasts within 6m
      this.isGrounded = false;
      this.playerVelY = 7.8;
      this.isAttacking = true;
      this.isHeavyAttack = true;
      this.attackTimer = 0.52;
      this.shockwaveTimer = 0.55;
      this.shockwaveRingMesh.position.set(this.playerPos.x, this.playerPos.y + 0.08, this.playerPos.z);
      this.shockwaveRingMesh.scale.set(1, 1, 1);
      this.shockwaveRingMesh.visible = true;
      this.cameraShakeIntensity = 0.42;
      sound.playPartBreak();
      this.spawnParticles(this.playerPos.x, this.playerPos.y + 0.4, this.playerPos.z, 0xf59e0b, 20);

      for (const actor of this.beasts) {
        if (actor.state.hp > 0 && Math.hypot(actor.state.x - this.playerPos.x, actor.state.z - this.playerPos.z) <= 6.8) {
          actor.state.aiState = 'staggered';
          actor.state.stateTimer = 4.0;
          actor.hitThisSwing = false;
        }
      }
      this.evaluateSpearHits(6.5, 2.0);
      this.callbacks.onNotification('Earthshatter Slam! 6m Seismic Shockwave Stun!', 'loot');
      return;
    }

    this.startSpearAttack();
  }

  private fireSwatRifle(burstShot = false) {
    this.isAttacking = true;
    this.attackTimer = 0.22;
    this.muzzleFlashTimer = 0.05;
    this.recoilImpulse = 1.0;
    this.hunter.muzzleLight.intensity = 8.5;
    sound.playHitImpact(false, burstShot);

    const forwardX = Math.sin(this.playerRotation);
    const forwardZ = Math.cos(this.playerRotation);
    const rightX = -Math.cos(this.playerRotation);
    const rightZ = Math.sin(this.playerRotation);

    // 1. High-velocity rifle tracer projectile
    const tracerGeo = createSculptedOrganicGeometry(
      [
        [0.0, 0.04, 0.04],
        [0.5, 0.06, 0.06],
        [1.0, 0.01, 0.01],
      ],
      6,
      0.55,
      0
    );
    tracerGeo.rotateX(Math.PI / 2);
    const tracerMesh = new THREE.Mesh(
      tracerGeo,
      new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
    );
    tracerMesh.position.set(
      this.playerPos.x + forwardX * 0.9,
      this.playerPos.y + 1.45,
      this.playerPos.z + forwardZ * 0.9
    );
    tracerMesh.rotation.y = this.playerRotation;
    this.scene.add(tracerMesh);

    // Aim assist toward locked-on beast or flying dragon
    let vy = 0;
    for (const b of this.beasts) {
      if (b.state.hp > 0) {
        const d = Math.hypot(b.state.x - this.playerPos.x, b.state.z - this.playerPos.z);
        if (d < 36) {
          vy = ((b.state.y + 1.2 - (this.playerPos.y + 1.45)) / Math.max(1, d)) * 46;
          break;
        }
      }
    }

    this.projectiles.push({
      mesh: tracerMesh,
      vx: forwardX * 46,
      vy,
      vz: forwardZ * 46,
      age: 0,
      landed: false,
      kind: 'rifle_bullet',
      damage: WEAPON_REGISTRY[this.equippedWeapon].baseDamage * (burstShot ? 1.65 : 1.25),
    });

    // 2. Eject spinning brass shell casing from right ejection port
    const brassGeo = createSculptedOrganicGeometry(
      [
        [0.0, 0.025, 0.025],
        [1.0, 0.025, 0.025],
      ],
      6,
      0.1,
      0
    );
    const brassMesh = new THREE.Mesh(brassGeo, this.materialCache.mithrilGoldTrimMaterial);
    brassMesh.position.set(
      this.playerPos.x + rightX * 0.35,
      this.playerPos.y + 1.42,
      this.playerPos.z + rightZ * 0.35
    );
    this.scene.add(brassMesh);
    this.projectiles.push({
      mesh: brassMesh,
      vx: rightX * 2.2,
      vy: 3.5,
      vz: rightZ * 2.2,
      age: 0,
      landed: false,
      kind: 'brass_casing',
      damage: 0,
    });
  }

  private fireSpaceFighterPlasma() {
    sound.playFocusPulse();
    this.cameraShakeIntensity = 0.14;
    const forwardX = Math.sin(this.spaceFighterRotY);
    const forwardZ = Math.cos(this.spaceFighterRotY);
    const rightX = -Math.cos(this.spaceFighterRotY);
    const rightZ = Math.sin(this.spaceFighterRotY);

    const boltGeo = createSculptedOrganicGeometry(
      [
        [0.0, 0.08, 0.08],
        [0.5, 0.14, 0.14],
        [1.0, 0.02, 0.02],
      ],
      8,
      1.1,
      0
    );
    boltGeo.rotateX(Math.PI / 2);

    for (const side of [-1.6, 1.6]) {
      const boltMesh = new THREE.Mesh(
        boltGeo,
        new THREE.MeshBasicMaterial({ color: 0x22d3ee })
      );
      boltMesh.position.set(
        this.spaceFighterPos.x + rightX * side + forwardX * 2.2,
        this.spaceFighterPos.y + 1.1,
        this.spaceFighterPos.z + rightZ * side + forwardZ * 2.2
      );
      boltMesh.rotation.y = this.spaceFighterRotY;
      this.scene.add(boltMesh);

      this.projectiles.push({
        mesh: boltMesh,
        vx: forwardX * 60,
        vy: -this.spaceFighterPitch * 28,
        vz: forwardZ * 60,
        age: 0,
        landed: false,
        kind: 'plasma_bolt',
        damage: 64,
      });
    }
  }

  public startSpearAttack() {
    if (this.isAttacking || this.isDodging) return;
    this.isAttacking = true;
    this.isHeavyAttack = false;
    this.attackTimer = this.activeCharacterId === 'bulky_knight' ? 0.44 : 0.32;
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
    if (this.isDodging || this.isPilotingSpaceFighter) return;
    this.isDodging = true;
    this.isAttacking = false;
    this.dodgeTimer = 0.45;
    this.dodgeDirX = Math.sin(this.playerRotation);
    this.dodgeDirZ = Math.cos(this.playerRotation);
    sound.playDodgeRoll();
    this.callbacks.onStatsChange(this.playerStats);
  }

  public jumpPlayer() {
    if (this.isPilotingSpaceFighter) {
      this.spaceFighterPos.y = Math.min(58, this.spaceFighterPos.y + 3.2);
      this.playerPos.copy(this.spaceFighterPos);
      return;
    }
    if (this.isFlying) {
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
      this.toggleFlightMode();
    }
  }

  public toggleFlightMode() {
    if (this.isPilotingSpaceFighter) {
      this.toggleSpaceFighterBoarding();
      return;
    }
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
        'Spectral / Mithril Wings Deployed! Ride Thermal Updrafts (>14m) · [Space] Ascend · [C] Descend',
        'info'
      );
    } else {
      this.callbacks.onNotification('Flight Wings Folded · Returning to Ground', 'info');
    }
    this.callbacks.onStatsChange(this.playerStats);
  }

  public toggleSpaceFighterBoarding() {
    this.isPilotingSpaceFighter = !this.isPilotingSpaceFighter;
    this.playerStats.isPilotingSpaceFighter = this.isPilotingSpaceFighter;
    if (this.isPilotingSpaceFighter) {
      this.mountedBeastActor = null;
      this.playerStats.isMountedOnBeast = false;
      this.isFlying = true;
      this.playerStats.isFlying = true;
      this.hunter.root.visible = false;
      this.spaceFighterPos.y = Math.max(
        this.spaceFighterPos.y,
        this.terrain.getHeight(this.spaceFighterPos.x, this.spaceFighterPos.z) + 5.5
      );
      this.playerPos.copy(this.spaceFighterPos);
      sound.playFocusPulse();
      this.spawnParticles(this.spaceFighterPos.x, this.spaceFighterPos.y, this.spaceFighterPos.z, 0x22d3ee, 16);
      this.callbacks.onNotification(
        'Boarded Space Fighter (6-DOF)! Canopy Sealed & Twin Plasma Thrusters Ignited! [Strike] Dual Plasma Cannons · [E] Disembark',
        'loot'
      );
    } else {
      const gy = this.terrain.getHeight(this.spaceFighterPos.x, this.spaceFighterPos.z);
      this.spaceFighterPos.y = gy + 0.25;
      this.spaceFighter.root.position.copy(this.spaceFighterPos);
      this.spaceFighter.root.rotation.set(0, this.spaceFighterRotY, 0);
      this.hunter.root.visible = true;
      this.isFlying = false;
      this.playerStats.isFlying = false;
      this.playerPos.set(this.spaceFighterPos.x - 2.6, gy, this.spaceFighterPos.z);
      this.hunter.root.position.copy(this.playerPos);
      this.callbacks.onNotification('Disembarked Space Fighter', 'info');
    }
    this.callbacks.onStatsChange(this.playerStats);
  }

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
      new THREE.RingGeometry(0.95, 1.18, 24).rotateX(-Math.PI / 2),
      this.materialCache.boneMaterial
    );
    ring.position.y = 0.12;
    trapGroup.add(ring);
    trapGroup.position.set(this.playerPos.x, this.playerPos.y, this.playerPos.z);
    this.scene.add(trapGroup);
    this.traps.push({ mesh: trapGroup, x: this.playerPos.x, z: this.playerPos.z, active: true });
    sound.playTrapPlace();
    this.callbacks.onNotification('Placed Sinew Snare Trap / Electro-Net Mine!', 'info');
    this.callbacks.onStatsChange(this.playerStats);
  }

  public throwStone() {
    if (this.playerStats.lureStones <= 0) return;
    this.playerStats.lureStones--;
    const stoneGeo = createSculptedOrganicGeometry(
      [
        [0.0, 0.05, 0.05],
        [0.5, 0.18, 0.18],
        [1.0, 0.05, 0.05],
      ],
      8,
      0.26,
      -0.13
    );
    const stoneMesh = new THREE.Mesh(stoneGeo, this.materialCache.stoneMaterial);
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
      kind: 'lure_stone',
      damage: 0,
    });
    this.callbacks.onStatsChange(this.playerStats);
  }

  public toggleHunterFocus() {
    this.focusVisionActive = !this.focusVisionActive;
    this.focusTimer = this.focusVisionActive ? 14 : 0;
    sound.playFocusPulse();
    this.callbacks.onFocusChange(this.focusVisionActive);
    this.beasts.forEach((b) => {
      b.rig.weakPointIndicators.forEach((mesh, id) => {
        const wp = b.state.weakPoints.find((w) => w.id === id);
        mesh.visible = this.focusVisionActive && !!wp && !wp.broken && b.state.hp > 0;
      });
    });
    if (this.focusVisionActive) {
      const modeDesc =
        this.activeCharacterId === 'swat_operator'
          ? 'Aim-Down-Sights (ADS) + 3D Footprint Tracking Trail Active!'
          : this.activeCharacterId === 'bulky_knight'
          ? 'Iron Bulwark Shield Wall (-80% Dmg) + 3D Footprint Tracking Trail Active!'
          : 'Focus Vision Active: Following 3D Beast Footprint Trail & Weak Points!';
      this.callbacks.onNotification(modeDesc, 'info');
    }
  }

  public handleInteract() {
    // 0. Check if already piloting Space Fighter or mounted on Armor Dinosaur
    if (this.isPilotingSpaceFighter) {
      this.toggleSpaceFighterBoarding();
      return;
    }
    if (this.mountedBeastActor) {
      this.mountedBeastActor = null;
      this.playerStats.isMountedOnBeast = false;
      this.callbacks.onNotification('Dismounted Armor Dinosaur', 'info');
      this.callbacks.onStatsChange(this.playerStats);
      return;
    }

    // 0b. Check Space Fighter Boarding (within 4.8m of Space Fighter)
    if (
      Math.hypot(
        this.playerPos.x - this.spaceFighterPos.x,
        this.playerPos.z - this.spaceFighterPos.z
      ) < 4.8
    ) {
      this.toggleSpaceFighterBoarding();
      return;
    }

    // 0c. Check Taming & Mounting a Snared Armor Dinosaur (brontoshell)
    for (const actor of this.beasts) {
      if (
        actor.state.hp > 0 &&
        actor.state.species === 'brontoshell' &&
        (actor.state.snaredTimer > 0 || actor.state.aiState === 'staggered') &&
        Math.hypot(this.playerPos.x - actor.state.x, this.playerPos.z - actor.state.z) < 6.0
      ) {
        this.mountedBeastActor = actor;
        this.playerStats.isMountedOnBeast = true;
        actor.state.aiState = 'patrol';
        actor.state.snaredTimer = 0;
        sound.playVictoryFanfare();
        this.callbacks.onNotification(
          'Tamed & Mounted Armor Dinosaur (Spine_Mount_Socket)! Ride as a Living Tank & Smash Boulders!',
          'loot'
        );
        this.callbacks.onStatsChange(this.playerStats);
        return;
      }
    }

    // 1. Check Creature & Sky-Dragon Egg Nests (OnEggStolen event triggers Dragon CHASE!)
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
            [nest.data.species]: (this.playerStats.eggInventory?.[nest.data.species] || 0) + 1,
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

          // OnEggStolen event: immediately transition Dragon Boss & matching species to CHASE!
          for (const b of this.beasts) {
            if (b.state.hp > 0 && (b.state.species === nest.data.species || b.state.species === 'sky_dragon')) {
              b.state.aiState = 'chase';
              b.state.enraged = true;
              sound.playBeastRoar(b.state.species);
            }
          }

          this.advanceAdventureProgress(nest.data.species, 'egg');
          this.callbacks.onNotification(
            `OnEggStolen: Extracted ${nest.data.name}! Dragon Boss & Parent Enraged in CHASE!`,
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

    // 6. Check Track Clues & Diurnal / Nocturnal Flora Gathering
    for (const c of this.clues) {
      if (!c.data.discovered) {
        const dist = Math.hypot(this.playerPos.x - c.data.x, this.playerPos.z - c.data.z);
        if (dist < 4.2) {
          c.data.discovered = true;
          c.mesh.visible = false;
          sound.playGather();
          if (this.dayNightState.isNight) {
            this.inventoryMaterials.volcanic_resin = (this.inventoryMaterials.volcanic_resin || 0) + 2;
            this.inventoryMaterials.sun_herb = (this.inventoryMaterials.sun_herb || 0) + 1;
            this.callbacks.onNotification(
              `Nocturnal Track & Flora Harvested: ${c.data.description} (+2 Luminous Night-Spore Resin · +1 Herb)`,
              'loot'
            );
          } else {
            this.inventoryMaterials.sun_herb = (this.inventoryMaterials.sun_herb || 0) + 2;
            this.callbacks.onNotification(
              `Diurnal Track & Flora Harvested: ${c.data.description} (+2 Sun-Herbs · +1 Ration)`,
              'loot'
            );
          }
          this.playerStats.foodRations = Math.min(this.playerStats.maxFoodRations, this.playerStats.foodRations + 1);
          this.totalMaterialsGathered += 2;
          this.upgradeKnowledge(c.data.species, 'sighted');
          this.callbacks.onStatsChange(this.playerStats);
          return;
        }
      }
    }

    // 7. Check Freshwater River / Springs Hydration
    const biome = getTerrainBiome(this.playerPos.x, this.playerPos.z);
    if (biome === 'river' || biome === 'springs') {
      this.drinkWaterCanteen();
      return;
    }
  }

  private advanceAdventureProgress(_species: BeastSpecies, eventType: 'egg' | 'kill') {
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
      this.callbacks.onNotification('Carved Jason T (Snapjaw Leviathan): +2 Talon, +2 Coral Stone & +2 Rations!', 'loot');
    } else if (species === 'brontoshell') {
      this.inventoryMaterials.bronto_shell = (this.inventoryMaterials.bronto_shell || 0) + 2;
      this.inventoryMaterials.coral_stone = (this.inventoryMaterials.coral_stone || 0) + 2;
      this.callbacks.onNotification('Carved Armor Dinosaur: +2 Carapace, +2 Coral Stone & +2 Rations!', 'loot');
    } else if (species === 'frostfang') {
      this.inventoryMaterials.thunder_horn = (this.inventoryMaterials.thunder_horn || 0) + 2;
      this.inventoryMaterials.obsidian_shard = (this.inventoryMaterials.obsidian_shard || 0) + 2;
      this.inventoryMaterials.beast_bone = (this.inventoryMaterials.beast_bone || 0) + 3;
      this.callbacks.onNotification('Carved Glacial Behemoth: +2 Glacial Ivory, +2 Obsidian & +2 Rations!', 'loot');
    } else if (species === 'thunderhorn') {
      this.inventoryMaterials.thunder_horn = (this.inventoryMaterials.thunder_horn || 0) + 2;
      this.inventoryMaterials.obsidian_shard = (this.inventoryMaterials.obsidian_shard || 0) + 3;
      this.callbacks.onNotification('Carved Triceratops Beetle: +2 Conductive Crest-Horn, +3 Obsidian Shard!', 'loot');
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
    this.heroRoster.forEach((slot) => slot.rig.updateWeapon(id));
    this.callbacks.onWeaponChange(id);
    this.callbacks.onStatsChange(this.playerStats);
  }

  public setEquippedArmor(id: ArmorId) {
    this.equippedArmor = id;
    if (!this.ownedArmors.includes(id)) this.ownedArmors.push(id);
    const def = ARMOR_REGISTRY[id];
    const profile = PLAYABLE_CHARACTER_PROFILES[this.activeCharacterId];
    this.playerStats.defense = def.defense + profile.defenseBonus;
    this.playerStats.maxHp = 150 + def.maxHpBonus;
    this.playerStats.hp = Math.min(this.playerStats.maxHp, this.playerStats.hp + def.maxHpBonus);
    this.heroRoster.forEach((slot) => slot.rig.updateArmor(id));
    this.callbacks.onStatsChange(this.playerStats);
  }

  public setGameState(next: GameState) {
    this.gameState = next;
    document.body.dataset.state = next === 'victory' ? 'gameover' : next;
  }

  public respawnAtCampfire() {
    this.isFlying = false;
    this.isPilotingSpaceFighter = false;
    this.mountedBeastActor = null;
    this.hunter.root.visible = true;
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
      playerName: PLAYABLE_CHARACTER_PROFILES[this.activeCharacterId].name,
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
    const elapsedSec = now * 0.001;

    this.animateEnvironment(elapsedSec, dt);

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
      this.updatePlayer(dt, elapsedSec);
      this.updateAutonomousCompanions(dt, elapsedSec);
      this.updateNPCs(elapsedSec);
      this.updateBeasts(dt, elapsedSec);
      this.updateProjectilesAndParticles(dt);
      this.updateCamera(dt);
      this.checkInteractPrompts();
    }

    this.renderer.render(this.scene, this.camera);
  }

  private animateEnvironment(timeSec: number, dt: number) {
    // 0. Day-Night Cycle Progression & Dynamic Lighting Engine
    this.timeOfDayHours = (this.timeOfDayHours + dt * 0.05) % 24;
    const prevPhase = this.dayNightState.phase;
    this.dayNightState = computeDayNightCycle(this.timeOfDayHours);
    this.playerStats.timeOfDayHours = this.dayNightState.timeOfDayHours;
    this.playerStats.isNight = this.dayNightState.isNight;
    if (prevPhase !== this.dayNightState.phase) {
      this.callbacks.onDayNightChange?.(this.dayNightState);
    }

    const sunAngle = ((this.timeOfDayHours - 6) / 24) * Math.PI * 2;
    this.sunLight.position.set(
      Math.cos(sunAngle) * 65,
      Math.max(12, Math.sin(sunAngle) * 75),
      35
    );
    this.sunLight.intensity = this.dayNightState.sunIntensity;
    this.hemiLight.intensity = this.dayNightState.ambientIntensity;
    if (this.scene.background instanceof THREE.Color) {
      this.scene.background.setHex(this.dayNightState.skyColorHex);
    }
    if (this.scene.fog instanceof THREE.FogExp2) {
      this.scene.fog.color.setHex(this.dayNightState.fogColorHex);
    }

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
      r.mesh.position.x = r.baseX + wx * drift * 0.35;
      r.mesh.position.z = r.baseZ + wz * drift * 0.35;
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

    // 4b. Dynamic Instanced Grass Bending around Player
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
    const campLight = this.terrain.campGroup.getObjectByName('campfire_light') as THREE.PointLight | undefined;
    if (campFlame) {
      const flicker = 0.92 + Math.sin(timeSec * 14) * 0.12 + Math.cos(timeSec * 23) * 0.08;
      campFlame.scale.set(flicker, 0.9 + Math.sin(timeSec * 18) * 0.16, flicker);
      campFlame.rotation.y = timeSec * 1.5;
    }
    if (campLight) {
      const nightBoost = this.dayNightState.isNight ? 2.2 : 0;
      campLight.intensity = 5.2 + nightBoost + Math.sin(timeSec * 14) * 0.95 + Math.cos(timeSec * 23) * 0.55;
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

    // 7. Shockwave ring expansion
    if (this.shockwaveTimer > 0) {
      this.shockwaveTimer -= dt;
      const progress = 1 - this.shockwaveTimer / 0.55;
      const scale = 1 + progress * 5.5;
      this.shockwaveRingMesh.scale.set(scale, scale, 1);
      (this.shockwaveRingMesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, (1 - progress) * 0.85);
      if (this.shockwaveTimer <= 0) {
        this.shockwaveRingMesh.visible = false;
      }
    }
  }

  private updateAutonomousCompanions(dt: number, elapsedSec: number) {
    this.heroRoster.forEach((slot, charId) => {
      if (charId === this.activeCharacterId) return;

      // Autonomous AI patrol around Base Camp perimeter & river crossing
      slot.aiAngle += dt * 0.38;
      const anchorX = charId === 'swat_operator' ? -5.5 : 5.5;
      const anchorZ = 27.5;
      const targetX = anchorX + Math.cos(slot.aiAngle) * 3.2;
      const targetZ = anchorZ + Math.sin(slot.aiAngle) * 3.2;
      const dx = targetX - slot.pos.x;
      const dz = targetZ - slot.pos.z;
      const dist = Math.hypot(dx, dz);

      if (dist > 0.25) {
        const targetRot = Math.atan2(dx, dz);
        slot.rotation = stepAngleShortestArc(slot.rotation, targetRot, dt * 5);
        slot.pos.x += Math.sin(slot.rotation) * 2.1 * dt;
        slot.pos.z += Math.cos(slot.rotation) * 2.1 * dt;
        slot.gaitPhase += dt * 6.5;
      }
      slot.pos.y = this.terrain.getHeight(slot.pos.x, slot.pos.z);
      slot.rig.root.position.copy(slot.pos);
      slot.rig.root.rotation.y = slot.rotation;

      // Update companion skeletal shader & nodes
      slot.rig.controller.uniforms.uStridePhase.value = slot.gaitPhase;
      slot.rig.controller.uniforms.uStrideAmp.value = 0.25;
      slot.rig.controller.uniforms.uHeadYaw.value = Math.sin(elapsedSec * 1.5) * 0.3;
      slot.rig.controller.update(dt, elapsedSec);
    });
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
    if (this.isFlying || this.isPilotingSpaceFighter) return;
    const obstacles = [
      { x: 0, z: 28, r: 1.68 },
      { x: 2.8, z: 27.2, r: 1.25 },
      { x: -3.4, z: 25.5, r: 2.1 },
      { x: 0, z: 5, r: 3.75 },
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

  private updatePlayer(dt: number, elapsedSec: number) {
    if (this.muzzleFlashTimer > 0) {
      this.muzzleFlashTimer -= dt;
      if (this.muzzleFlashTimer <= 0) {
        this.hunter.muzzleLight.intensity = 0;
      }
    }
    this.recoilImpulse = THREE.MathUtils.damp(this.recoilImpulse, 0, 14, dt);

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

    let moveForward = -this.virtualMoveY;
    let moveRight = this.virtualMoveX;
    if (this.keysPressed.has('KeyW') || this.keysPressed.has('ArrowUp')) moveForward += 1;
    if (this.keysPressed.has('KeyS') || this.keysPressed.has('ArrowDown')) moveForward -= 1;
    if (this.keysPressed.has('KeyD') || this.keysPressed.has('ArrowRight')) moveRight += 1;
    if (this.keysPressed.has('KeyA') || this.keysPressed.has('ArrowLeft')) moveRight -= 1;

    // 1. Space Fighter 6-DOF Flight & Articulation Mode
    if (this.isPilotingSpaceFighter) {
      const moveResult = computeCameraRelativeMovement(
        moveForward,
        moveRight,
        this.cameraYaw,
        22.5,
        dt
      );
      if (moveResult.isMoving) {
        const prevRot = this.spaceFighterRotY;
        this.spaceFighterRotY = stepAngleShortestArc(
          this.spaceFighterRotY,
          moveResult.targetRotation,
          Math.min(1, dt * 8)
        );
        let rotDelta = this.spaceFighterRotY - prevRot;
        while (rotDelta > Math.PI) rotDelta -= Math.PI * 2;
        while (rotDelta < -Math.PI) rotDelta += Math.PI * 2;
        // Bank chassis up to +-42 deg (0.73 rad)
        this.spaceFighterRoll = THREE.MathUtils.damp(
          this.spaceFighterRoll,
          Math.max(-0.73, Math.min(0.73, -rotDelta * 8)),
          8,
          dt
        );
        this.spaceFighterPos.x = Math.max(-125, Math.min(125, this.spaceFighterPos.x + moveResult.dx));
        this.spaceFighterPos.z = Math.max(-125, Math.min(125, this.spaceFighterPos.z + moveResult.dz));
      } else {
        this.spaceFighterRoll = THREE.MathUtils.damp(this.spaceFighterRoll, 0, 8, dt);
      }

      let vSpeed = 0;
      if (this.keysPressed.has('Space')) vSpeed += 9.5;
      if (this.keysPressed.has('KeyC') || this.keysPressed.has('ControlLeft')) vSpeed -= 9.5;
      const groundAtFighter = this.terrain.getHeight(this.spaceFighterPos.x, this.spaceFighterPos.z);
      this.spaceFighterPos.y = Math.max(
        groundAtFighter + 1.2,
        Math.min(62, this.spaceFighterPos.y + vSpeed * dt)
      );
      this.spaceFighterPitch = THREE.MathUtils.damp(this.spaceFighterPitch, -vSpeed * 0.03, 8, dt);

      // Articulating Canopy_Node (-65 deg open on ground vs 0 sealed in flight)
      this.spaceFighter.canopyNode.rotation.x = THREE.MathUtils.damp(
        this.spaceFighter.canopyNode.rotation.x,
        0,
        10,
        dt
      );

      // Retractable Landing Gear above 5m altitude
      const altAboveGround = (this.spaceFighterPos.y - groundAtFighter) * 12.5;
      const gearTargetRot = altAboveGround > 5 ? Math.PI / 2 : 0;
      this.spaceFighter.gearFront.rotation.x = THREE.MathUtils.damp(
        this.spaceFighter.gearFront.rotation.x,
        gearTargetRot,
        8,
        dt
      );
      this.spaceFighter.gearLeft.rotation.z = THREE.MathUtils.damp(
        this.spaceFighter.gearLeft.rotation.z,
        gearTargetRot,
        8,
        dt
      );
      this.spaceFighter.gearRight.rotation.z = THREE.MathUtils.damp(
        this.spaceFighter.gearRight.rotation.z,
        -gearTargetRot,
        8,
        dt
      );

      // Aileron & Rudder deflection
      this.spaceFighter.aileronLeft.rotation.x = this.spaceFighterRoll * 0.5;
      this.spaceFighter.aileronRight.rotation.x = -this.spaceFighterRoll * 0.5;
      this.spaceFighter.rudder.rotation.y = -this.spaceFighterRoll * 0.4;

      // Twin Plasma Thrusters scale
      const thrustScale = moveResult.isMoving ? 1.85 : 1.05;
      this.spaceFighter.thrusterLeft.scale.z = thrustScale + Math.sin(elapsedSec * 25) * 0.2;
      this.spaceFighter.thrusterRight.scale.z = thrustScale + Math.cos(elapsedSec * 25) * 0.2;

      this.spaceFighter.root.position.copy(this.spaceFighterPos);
      this.spaceFighter.root.rotation.set(this.spaceFighterPitch, this.spaceFighterRotY, this.spaceFighterRoll);
      this.spaceFighter.controller.update(dt, elapsedSec);

      this.playerPos.copy(this.spaceFighterPos);
      this.playerRotation = this.spaceFighterRotY;
      this.playerStats.altitude = Math.round(this.spaceFighterPos.y * 12.5);
      this.playerStats.airSpeed = moveResult.isMoving ? 22.5 : 0;
      this.callbacks.onStatsChange(this.playerStats);
      return;
    } else {
      // Parked Space Fighter canopy stays open (-65 deg = -1.13 rad) when player is nearby
      const distToFighter = Math.hypot(
        this.playerPos.x - this.spaceFighterPos.x,
        this.playerPos.z - this.spaceFighterPos.z
      );
      const targetCanopy = distToFighter < 6.0 ? -1.13 : 0;
      this.spaceFighter.canopyNode.rotation.x = THREE.MathUtils.damp(
        this.spaceFighter.canopyNode.rotation.x,
        targetCanopy,
        6,
        dt
      );
    }

    let isMovingHoriz = false;
    let moveStepDist = 0;
    const charProfile = PLAYABLE_CHARACTER_PROFILES[this.activeCharacterId];

    // Dodge roll / Tactical Dive / Shadow Dash movement
    if (this.isDodging) {
      this.dodgeTimer -= dt;
      const rollSpeed =
        this.activeCharacterId === 'demon_hunter' ? 20.5 : this.isFlying ? 18.5 : 13.5;
      const step = rollSpeed * dt;
      this.playerPos.x += this.dodgeDirX * step;
      this.playerPos.z += this.dodgeDirZ * step;
      moveStepDist = step;
      if (this.activeCharacterId === 'swat_operator') {
        // S.W.A.T. 450ms full-body Tactical Dive roll
        this.hunter.torso.rotation.x = (1 - this.dodgeTimer / 0.45) * Math.PI * 2;
      } else {
        this.hunter.torso.rotation.x = 0.55;
      }
      if (this.dodgeTimer <= 0) {
        this.isDodging = false;
        this.hunter.torso.rotation.x = 0;
      }
      isMovingHoriz = true;
    } else {
      const baseSpeed = this.isFlying
        ? 14.5
        : this.mountedBeastActor
        ? 11.5
        : charProfile.moveSpeed;

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

    this.resolveObstacleCollisions();

    this.playerPos.x = Math.max(-125, Math.min(125, this.playerPos.x));
    this.playerPos.z = Math.max(-125, Math.min(125, this.playerPos.z));
    const groundY = Math.max(-0.2, this.terrain.getHeight(this.playerPos.x, this.playerPos.z));

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

    // If mounted on Tamed Armor Dinosaur, sync dinosaur position & place hunter on Spine_Mount_Socket
    if (this.mountedBeastActor) {
      this.mountedBeastActor.state.x = this.playerPos.x;
      this.mountedBeastActor.state.y = groundY;
      this.mountedBeastActor.state.z = this.playerPos.z;
      this.mountedBeastActor.state.rotation = this.playerRotation;
      this.mountedBeastActor.rig.root.position.set(this.playerPos.x, groundY, this.playerPos.z);
      this.mountedBeastActor.rig.root.rotation.y = this.playerRotation;
    }

    // Per-Character Skeletal & GPU Vertex Kinematics
    const prevSin = Math.sin(this.gaitPhase);
    if (isMovingHoriz && !this.isDodging) {
      this.gaitPhase += moveStepDist * (this.isFlying ? 1.5 : 3.2);
      const s = Math.sin(this.gaitPhase);
      const c = Math.cos(this.gaitPhase);

      // Bulky Knight Heavy-Impact Footsteps: camera shake (0.015) & dust puffs on heel strike
      if (this.activeCharacterId === 'bulky_knight' && this.isGrounded && prevSin * s <= 0) {
        this.cameraShakeIntensity = Math.max(this.cameraShakeIntensity, 0.025);
        this.spawnParticles(this.playerPos.x, groundY + 0.1, this.playerPos.z, 0x94a3b8, 3);
      }

      this.hunter.controller.uniforms.uStridePhase.value = this.gaitPhase;
      this.hunter.controller.uniforms.uStrideAmp.value = this.isFlying ? 0.2 : 0.85;
      this.hunter.controller.uniforms.uSpineLean.value =
        this.activeCharacterId === 'demon_hunter' ? 0.38 : 0.18;

      if (this.isFlying) {
        this.hunter.pelvis.position.y = 0.92 + Math.sin(this.gaitPhase * 0.6) * 0.04;
        this.hunter.torso.rotation.x = 0.36;
        this.hunter.torso.rotation.z = -this.turnLeanAngle * 0.85;
      } else {
        this.hunter.pelvis.position.y = 0.92 + Math.abs(c) * 0.055;
        this.hunter.torso.rotation.x = this.activeCharacterId === 'demon_hunter' ? 0.38 : 0.14;
        this.hunter.torso.rotation.z = -this.turnLeanAngle;

        this.hunter.leftLeg.rotation.x = s * 0.85;
        this.hunter.leftShin.rotation.x = Math.max(0.05, c * 1.1);
        this.hunter.rightLeg.rotation.x = -s * 0.85;
        this.hunter.rightShin.rotation.x = Math.max(0.05, -c * 1.1);
      }
    } else {
      this.hunter.controller.uniforms.uStrideAmp.value = THREE.MathUtils.damp(
        this.hunter.controller.uniforms.uStrideAmp.value,
        0,
        8,
        dt
      );
      this.hunter.controller.uniforms.uSpineLean.value = THREE.MathUtils.damp(
        this.hunter.controller.uniforms.uSpineLean.value,
        0,
        8,
        dt
      );
      // Demon Hunter 4-second Head scan in idle
      this.hunter.controller.uniforms.uHeadYaw.value = Math.sin(elapsedSec * 1.57) * 0.28;
    }

    // S.W.A.T. Operator Aim-Down-Sights (ADS) & Recoil Kinematics vs Bulky Knight Iron Bulwark
    if (this.activeCharacterId === 'swat_operator') {
      if (this.focusVisionActive) {
        this.hunter.rightArm.rotation.x = -1.25 + this.recoilImpulse * 0.14;
        this.hunter.leftArm.rotation.x = -1.1;
        this.hunter.leftArm.rotation.y = 0.35;
        this.hunter.head.rotation.z = 0.21; // 12 deg optic scope tilt
      } else {
        this.hunter.rightArm.rotation.x = -0.45 + this.recoilImpulse * 0.14;
        this.hunter.head.rotation.z = 0;
      }
    } else if (this.activeCharacterId === 'bulky_knight' && this.focusVisionActive) {
      // Iron Bulwark Shield Wall stance
      this.hunter.leftArm.rotation.y = 0.85;
      this.hunter.leftArm.rotation.x = -0.6;
    }

    // Smooth Dorsal Flight Wings Articulation
    if (this.hunter.wings && this.hunter.leftWing && this.hunter.rightWing) {
      const targetScale = this.isFlying ? 1.15 : 0.28;
      this.hunter.wings.scale.x = THREE.MathUtils.damp(this.hunter.wings.scale.x, targetScale, 8, dt);
      this.hunter.wings.scale.y = THREE.MathUtils.damp(this.hunter.wings.scale.y, targetScale, 8, dt);
      this.hunter.wings.scale.z = THREE.MathUtils.damp(this.hunter.wings.scale.z, targetScale, 8, dt);
      this.hunter.controller.uniforms.uWingFlap.value = this.isFlying ? 0.65 : 0;

      if (this.isFlying) {
        const wingFlap = Math.sin(elapsedSec * 9.0) * 0.38;
        this.hunter.leftWing.rotation.y = wingFlap;
        this.hunter.rightWing.rotation.y = -wingFlap;
      }
    }

    // Articulated Combat Activities (Twin Slash / Heavy Cleave / Demon Vault)
    if (this.isAttacking) {
      this.attackTimer -= dt;
      const totalDur = this.isHeavyAttack ? 0.48 : 0.32;
      const swingProgress = 1 - this.attackTimer / totalDur;

      if (this.activeCharacterId === 'demon_hunter' && this.activeGesture === 'swipe_up') {
        // 360 deg mid-air spin during Demon Vault
        this.hunter.root.rotation.y = this.playerRotation + swingProgress * Math.PI * 2;
      } else if (this.activeCharacterId === 'bulky_knight') {
        // Bulky Knight -35 deg windup -> +65 deg Heavy Cleave
        const cleaveAngle = swingProgress < 0.35 ? -0.61 * (swingProgress / 0.35) : 1.13 * ((swingProgress - 0.35) / 0.65);
        this.hunter.controller.uniforms.uSpineTwist.value = cleaveAngle;
        this.hunter.controller.uniforms.uAttackSwing.value = Math.sin(swingProgress * Math.PI);
        if (swingProgress >= 0.35 && swingProgress <= 0.78) {
          this.evaluateSpearHits(3.8, 1.5);
        }
      } else {
        // Demon Hunter Twin Slash: 45 deg (0.78 rad) left then right spine twist
        const twinTwist = Math.sin(swingProgress * Math.PI * 2) * 0.78;
        this.hunter.controller.uniforms.uSpineTwist.value = twinTwist;
        this.hunter.controller.uniforms.uAttackSwing.value = Math.sin(swingProgress * Math.PI);
        if (swingProgress >= 0.22 && swingProgress <= 0.78) {
          this.evaluateSpearHits();
        }
      }

      if (this.attackTimer <= 0) {
        this.isAttacking = false;
        this.hunter.controller.uniforms.uSpineTwist.value = 0;
        this.hunter.controller.uniforms.uAttackSwing.value = 0;
      }
    }

    this.hunter.controller.update(dt, elapsedSec);

    // Biological Survival Homeostasis
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
    this.playerStats.activeCharacter = this.activeCharacterId;
    this.playerStats.isPilotingSpaceFighter = this.isPilotingSpaceFighter;
    this.playerStats.isMountedOnBeast = Boolean(this.mountedBeastActor);
    this.playerStats.timeOfDayHours = this.dayNightState.timeOfDayHours;
    this.playerStats.isNight = this.dayNightState.isNight;
    this.playerStats.isFlying = this.isFlying;
    this.playerStats.altitude = Math.round(this.playerPos.y * 12.5);
    this.playerStats.airSpeed = isMovingHoriz ? (this.isFlying ? 14.5 : charProfile.moveSpeed) : 0;

    const yMountOffset = this.mountedBeastActor ? 2.4 : 0;
    this.hunter.root.position.set(this.playerPos.x, this.playerPos.y + yMountOffset, this.playerPos.z);
    if (!this.isAttacking || this.activeGesture !== 'swipe_up') {
      this.hunter.root.rotation.y = this.playerRotation;
    }

    // Update active hero slot in roster
    const activeSlot = this.heroRoster.get(this.activeCharacterId);
    if (activeSlot) {
      activeSlot.pos.copy(this.playerPos);
      activeSlot.rotation = this.playerRotation;
    }

    this.playerDiegeticGroup.position.set(this.playerPos.x, groundY + 0.035, this.playerPos.z);
    this.callbacks.onStatsChange(this.playerStats);
  }

  private evaluateSpearHits(customReach?: number, customMult = 1.0) {
    const weapon = WEAPON_REGISTRY[this.equippedWeapon];
    const reach = customReach ?? weapon.reach;
    const tipX = this.playerPos.x + Math.sin(this.playerRotation) * reach;
    const tipZ = this.playerPos.z + Math.cos(this.playerRotation) * reach;

    for (const actor of this.beasts) {
      if (actor.state.hp <= 0 || actor.hitThisSwing || actor === this.mountedBeastActor) continue;
      const distXZ = Math.hypot(tipX - actor.state.x, tipZ - actor.state.z);
      const distY = Math.abs(this.playerPos.y - actor.state.y);
      const hitRadius = actor.state.isFlyingBeast ? 5.8 : 4.6;
      if (distXZ > hitRadius || distY > 7.5) continue;

      actor.hitThisSwing = true;
      this.applyHitToBeast(actor, tipX, tipZ, weapon.baseDamage * customMult, this.isHeavyAttack);
    }
  }

  private applyHitToBeast(
    actor: ActiveBeastActor,
    hitX: number,
    hitZ: number,
    baseDamage: number,
    isHeavy: boolean
  ) {
    const weapon = WEAPON_REGISTRY[this.equippedWeapon];
    let wpMult = 1.0;
    let hitWpId: string | null = null;

    for (const wp of actor.state.weakPoints) {
      if (wp.broken) continue;
      const cosR = Math.cos(actor.state.rotation);
      const sinR = Math.sin(actor.state.rotation);
      const wpWorldX = actor.state.x + wp.localOffset.x * cosR + wp.localOffset.z * sinR;
      const wpWorldZ = actor.state.z - wp.localOffset.x * sinR + wp.localOffset.z * cosR;
      if (Math.hypot(hitX - wpWorldX, hitZ - wpWorldZ) <= wp.radius + 1.6) {
        wpMult = wp.damageMultiplier;
        hitWpId = wp.id;
        break;
      }
    }

    // Armor Dinosaur (brontoshell / caldera_titan) Directional Armor Deflection (0.2x frontal vs 1.8x Core flank)
    if (actor.state.species === 'brontoshell' || actor.state.species === 'caldera_titan') {
      const toAttackerAngle = Math.atan2(this.playerPos.x - actor.state.x, this.playerPos.z - actor.state.z);
      let angleDiff = Math.abs(toAttackerAngle - actor.state.rotation);
      while (angleDiff > Math.PI) angleDiff = Math.abs(angleDiff - Math.PI * 2);
      if (angleDiff < 0.85 && !isHeavy) {
        wpMult = 0.2; // Dorsal / Frontal Carapace Deflection!
        this.spawnParticles(hitX, actor.state.y + 1.5, hitZ, 0xe2e8f0, 10);
      } else if (angleDiff >= 0.85) {
        wpMult = Math.max(wpMult, 1.8); // Exposed Flank / Underbelly Core!
      }
    }

    const dmgRes = calculateDamage({
      weaponDamage: baseDamage,
      isHeavyAttack: isHeavy,
      heavyMultiplier: weapon.heavyMultiplier,
      weakPointMultiplier: wpMult,
      isEnraged: actor.state.enraged,
      isStaggered: actor.state.aiState === 'staggered',
      critRoll: Math.random(),
      critChance: weapon.critChance,
      difficulty: 'hunter',
    });

    actor.state.hp = Math.max(0, actor.state.hp - dmgRes.finalDamage);
    this.cameraShakeIntensity = Math.max(this.cameraShakeIntensity, isHeavy ? 0.24 : 0.12);
    sound.playHitImpact(dmgRes.isWeakPointHit, dmgRes.isCrit);
    this.callbacks.onHitMarker?.(dmgRes.finalDamage, dmgRes.isCrit, dmgRes.isWeakPointHit);
    this.spawnParticles(
      actor.state.x,
      actor.state.y + 1.6,
      actor.state.z,
      dmgRes.isWeakPointHit ? 0xfbbf24 : 0xef4444,
      12
    );

    // Jason T (snapjaw / raptor): Head-shot during lunge interrupts pounce and triggers STUNNED stagger!
    if (
      (actor.state.species === 'snapjaw' || actor.state.species === 'raptor') &&
      (actor.state.aiState === 'telegraph_charge' || actor.state.aiState === 'attack_charge') &&
      (hitWpId?.includes('head') || dmgRes.isWeakPointHit)
    ) {
      actor.state.aiState = 'staggered';
      actor.state.stateTimer = 4.2;
      sound.playPartBreak();
      this.callbacks.onNotification(
        `Headshot Interrupt! ${actor.state.name} Lunge Interrupted & Stunned!`,
        'loot'
      );
    }

    // Dragon Boss (sky_dragon): Dealing 80+ damage to Wing hitboxes forces GROUNDED crash-land!
    if (actor.state.species === 'sky_dragon') {
      actor.wingDamageAccumulated += dmgRes.finalDamage;
      if (actor.wingDamageAccumulated >= 80 && actor.state.aiState !== 'staggered') {
        actor.wingDamageAccumulated = 0;
        actor.state.aiState = 'staggered';
        actor.state.stateTimer = 5.5;
        sound.playPartBreak();
        this.callbacks.onNotification(
          `Dragon Wings Shredded (80+ Dmg)! ${actor.state.name} Forced to CRASH-LAND (GROUNDED)!`,
          'loot'
        );
      }
    }

    if (hitWpId) {
      const idx = actor.state.weakPoints.findIndex((w) => w.id === hitWpId);
      if (idx >= 0) {
        const res = applyWeakPointDamage(actor.state.weakPoints[idx], dmgRes.finalDamage);
        actor.state.weakPoints[idx] = res.updated;
        if (res.justBroke) {
          actor.state.aiState = 'staggered';
          actor.state.stateTimer = 4.5;
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

  private updateBeasts(dt: number, elapsedSec: number) {
    let closestBeast: BeastState | null = null;
    let closestDist = 36;
    const nightAggroMult = this.dayNightState.beastAggressionMultiplier;
    const nightRadiusMult = this.dayNightState.beastAggroRadiusMultiplier;

    for (const actor of this.beasts) {
      if (actor === this.mountedBeastActor) {
        actor.rig.controller.uniforms.uStridePhase.value = this.gaitPhase;
        actor.rig.controller.uniforms.uStrideAmp.value = 0.65;
        actor.rig.controller.update(dt, elapsedSec);
        continue;
      }

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

      // Deposit dynamic 3D footprints for Focus Vision Tracking Trail!
      actor.footprintTimer -= dt;
      if (actor.footprintTimer <= 0 && !s.isFlyingBeast) {
        actor.footprintTimer = 0.65;
        const gy = this.terrain.getHeight(s.x, s.z);
        this.trailSystem.addFootprint(s.x, gy, s.z, s.rotation, s.species);
      }

      // Check snare traps
      for (const trap of this.traps) {
        if (trap.active && Math.hypot(s.x - trap.x, s.z - trap.z) < 2.6) {
          trap.active = false;
          trap.mesh.visible = false;
          s.snaredTimer = 5.5;
          s.aiState = 'staggered';
          s.stateTimer = 5.5;
          sound.playPartBreak();
          this.callbacks.onNotification(
            `${s.name} caught in Trap! ${
              s.species === 'brontoshell' ? 'Press [E] to Tame & Mount Armor Dinosaur!' : 'Weak Points Exposed!'
            }`,
            'loot'
          );
        }
      }

      if (s.snaredTimer > 0) {
        s.snaredTimer -= dt;
      }

      s.stateTimer -= dt;
      const toPlayerX = this.playerPos.x - s.x;
      const toPlayerZ = this.playerPos.z - s.z;
      const angleToPlayer = Math.atan2(toPlayerX, toPlayerZ);

      if (s.aiState === 'staggered' || s.aiState === 'enraged_roar') {
        if (s.stateTimer <= 0) {
          s.aiState = 'chase';
        }
      } else if (s.aiState === 'patrol') {
        const orbitSpeed = (s.isFlyingBeast ? 0.55 : 0.42) * nightAggroMult;
        const orbitRadius = s.isFlyingBeast ? 14 : 6.5;
        actor.patrolAngle += dt * orbitSpeed;
        const targetX = actor.homeX + Math.cos(actor.patrolAngle) * orbitRadius;
        const targetZ = actor.homeZ + Math.sin(actor.patrolAngle) * orbitRadius;
        const dx = targetX - s.x;
        const dz = targetZ - s.z;
        s.rotation = stepAngleShortestArc(s.rotation, Math.atan2(dx, dz), dt * 4);
        const patrolSpeed = (s.isFlyingBeast ? 6.8 : 2.2) * nightAggroMult;
        s.x += Math.sin(s.rotation) * patrolSpeed * dt;
        s.z += Math.cos(s.rotation) * patrolSpeed * dt;

        const playerInCampSafeZone = Math.hypot(this.playerPos.x - 0, this.playerPos.z - 28) < 6.2;
        const aggroRadius = (s.isFlyingBeast ? 20 : 16) * nightRadiusMult;
        if (!playerInCampSafeZone && distToPlayer < aggroRadius) {
          s.aiState = 'chase';
          this.upgradeKnowledge(s.species, 'sighted');
          sound.playBeastRoar(s.species);
        }
      } else if (s.aiState === 'chase') {
        s.rotation = stepAngleShortestArc(s.rotation, angleToPlayer, dt * 6);
        const moveSpeed =
          (s.isFlyingBeast ? (s.enraged ? 9.8 : 7.8) : s.enraged ? 6.2 : 4.6) * nightAggroMult;
        if (distToPlayer > 4.4) {
          s.x += Math.sin(s.rotation) * moveSpeed * dt;
          s.z += Math.cos(s.rotation) * moveSpeed * dt;
        } else {
          s.aiState = 'telegraph_charge';
          s.stateTimer = s.enraged ? 0.65 : 0.95;
          actor.chargeDirX = Math.sin(angleToPlayer);
          actor.chargeDirZ = Math.cos(angleToPlayer);
        }
        if (distToPlayer > 38 * nightRadiusMult) {
          s.aiState = 'patrol';
        }
      } else if (s.aiState === 'telegraph_charge') {
        actor.rig.head.rotation.x = -0.35;
        actor.rig.jaw.rotation.x = 0.7; // 40 deg jaw open for fire breath / bite telegraph
        actor.rig.controller.uniforms.uJawOpen.value = 0.7;
        if (s.stateTimer <= 0) {
          actor.rig.head.rotation.x = 0;
          actor.rig.jaw.rotation.x = 0;
          actor.rig.controller.uniforms.uJawOpen.value = 0;
          s.aiState = 'attack_charge';
          s.stateTimer = 0.65;
        }
      } else if (s.aiState === 'attack_charge') {
        const dashSpeed =
          (s.species === 'snapjaw' ? 16.0 : s.species === 'brontoshell' ? 14.0 : 12.5) *
          (s.enraged ? 1.2 : 1.0) *
          nightAggroMult;
        s.x += actor.chargeDirX * dashSpeed * dt;
        s.z += actor.chargeDirZ * dashSpeed * dt;

        if (
          Math.hypot(this.playerPos.x - s.x, this.playerPos.z - s.z) < 3.2 &&
          Math.abs(this.playerPos.y - s.y) < 4.5
        ) {
          const elapsedDodge = 0.45 - this.dodgeTimer;
          if (!this.isDodging || !isDodgeInvulnerable(elapsedDodge, 0.45)) {
            const rawDmg =
              s.species === 'caldera_titan' || s.species === 'sky_dragon'
                ? 36
                : s.species === 'frostfang'
                ? 30
                : 22;
            let taken = calculatePlayerDamageTaken(rawDmg, this.playerStats.defense, 'hunter');
            // Bulky Knight Iron Bulwark reduces incoming damage by 80%!
            if (this.activeCharacterId === 'bulky_knight' && this.focusVisionActive) {
              taken = Math.max(1, Math.round(taken * 0.2));
              this.spawnParticles(this.playerPos.x, this.playerPos.y + 1.2, this.playerPos.z, 0x38bdf8, 8);
            }
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
      const animT = elapsedSec * 5.0;

      // Update Beast GPU & Node Skeletal Kinematics
      actor.rig.controller.uniforms.uStridePhase.value = animT;
      actor.rig.controller.uniforms.uStrideAmp.value = s.aiState === 'staggered' ? 0.05 : 0.55;
      actor.rig.controller.uniforms.uTailWave.value = 0.45;
      actor.rig.controller.uniforms.uSpineLean.value =
        s.species === 'snapjaw' || s.species === 'raptor' ? 0.25 : 0.08;
      actor.rig.controller.uniforms.uWingFlap.value =
        s.isFlyingBeast && s.aiState !== 'staggered'
          ? 0.75
          : (s.species === 'thunderhorn' || s.species === 'frostfang') && s.aiState === 'attack_charge'
          ? 0.95
          : 0.0;
      actor.rig.controller.update(dt, elapsedSec);

      if (s.isFlyingBeast) {
        if (s.aiState === 'staggered') {
          s.y = groundY + 0.4; // Grounded crash-land state!
        } else if (s.aiState === 'chase' || s.aiState === 'attack_charge' || s.aiState === 'telegraph_charge') {
          const targetY = Math.max(groundY + 2.2, this.playerPos.y + 1.2);
          s.y += (targetY - s.y) * Math.min(1, dt * 3.5);
        } else {
          const cruiseY = groundY + (s.flightAltitude ?? 8.5) + Math.sin(animT * 0.4) * 1.4;
          s.y += (cruiseY - s.y) * Math.min(1, dt * 2.5);
        }

        if (actor.rig.legs.length >= 2) {
          const flap = Math.sin(animT * 1.2) * 0.55;
          actor.rig.legs[0].rotation.z = flap;
          actor.rig.legs[1].rotation.z = -flap;
        }
      } else {
        // Jason T Ambush Pounce vertical arc
        if ((s.species === 'snapjaw' || s.species === 'raptor') && s.aiState === 'attack_charge') {
          s.y = groundY + Math.sin((s.stateTimer / 0.65) * Math.PI) * 1.8;
        } else {
          s.y = groundY;
        }

        // Triceratops Beetle 6-legged tripod gait vs Quadruped gait
        actor.rig.legs.forEach((leg, idx) => {
          const tripodPhase = idx % 2 === 0 ? 0 : Math.PI;
          leg.rotation.x = Math.sin(animT * 1.5 + tripodPhase) * 0.35;
        });
      }

      actor.rig.root.position.set(s.x, s.y, s.z);
      actor.rig.root.rotation.y = s.rotation;
      actor.rig.tail.rotation.y = Math.sin(animT) * 0.25;
    }

    // Update Focus Vision 3D Tracking Trail Effect!
    let trailTargetVec: THREE.Vector3 | null = null;
    if (closestBeast && closestBeast.hp > 0) {
      this.scratchTargetVec.set(closestBeast.x, closestBeast.y, closestBeast.z);
      trailTargetVec = this.scratchTargetVec;
    } else {
      const alive = this.beasts.find((b) => b.state.hp > 0);
      if (alive) {
        this.scratchTargetVec.set(alive.state.x, alive.state.y, alive.state.z);
        trailTargetVec = this.scratchTargetVec;
      }
    }
    this.trailSystem.update(dt, this.focusVisionActive, trailTargetVec, this.playerPos, 1.0);

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
        if (p.kind === 'lure_stone' || p.kind === 'brass_casing') {
          p.vy -= 18 * dt;
        }
        p.mesh.position.x += p.vx * dt;
        p.mesh.position.y += p.vy * dt;
        p.mesh.position.z += p.vz * dt;
        if (p.kind === 'brass_casing') {
          p.mesh.rotation.x += dt * 18;
          p.mesh.rotation.z += dt * 14;
        }

        // Check Rifle Bullet / Space Fighter Plasma Bolt impact on Beasts
        if (p.kind === 'rifle_bullet' || p.kind === 'plasma_bolt') {
          for (const actor of this.beasts) {
            if (actor.state.hp <= 0) continue;
            const dXZ = Math.hypot(p.mesh.position.x - actor.state.x, p.mesh.position.z - actor.state.z);
            const dY = Math.abs(p.mesh.position.y - (actor.state.y + 1.5));
            if (dXZ < 3.6 && dY < 4.5) {
              this.applyHitToBeast(
                actor,
                p.mesh.position.x,
                p.mesh.position.z,
                p.damage,
                p.kind === 'plasma_bolt'
              );
              this.scene.remove(p.mesh);
              this.projectiles.splice(i, 1);
              p.landed = true;
              break;
            }
          }
          if (p.landed) continue;
        }

        const gy = this.terrain.getHeight(p.mesh.position.x, p.mesh.position.z);
        if (p.mesh.position.y <= gy + 0.15) {
          p.mesh.position.y = gy + 0.15;
          p.landed = true;
          if (p.kind === 'lure_stone') {
            for (const b of this.beasts) {
              if (b.state.hp > 0 && Math.hypot(b.state.x - p.mesh.position.x, b.state.z - p.mesh.position.z) < 22) {
                b.homeX = p.mesh.position.x;
                b.homeZ = p.mesh.position.z;
              }
            }
          }
        }
      }

      const maxAge = p.kind === 'lure_stone' ? 4.0 : 0.85;
      if (p.age > maxAge) {
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
    // GTA V Sky-Camera Zoom Transition when swapping characters
    if (this.gtaSkyCamTimer > 0) {
      this.gtaSkyCamTimer = Math.max(0, this.gtaSkyCamTimer - dt);
      const progress = 1 - this.gtaSkyCamTimer / this.gtaSkyCamDuration;
      const panX = THREE.MathUtils.lerp(this.gtaSkyCamFrom.x, this.gtaSkyCamTo.x, progress);
      const panZ = THREE.MathUtils.lerp(this.gtaSkyCamFrom.z, this.gtaSkyCamTo.z, progress);
      const skyArcY = Math.sin(progress * Math.PI) * 45;
      const baseCamY = this.playerPos.y + 4.5 + skyArcY;
      this.camera.position.set(panX, baseCamY, panZ - 6.5);
      this.camera.lookAt(panX, this.playerPos.y + 1.2, panZ);
      return;
    }

    const dist = this.isPilotingSpaceFighter ? 11.5 : this.isFlying ? 9.4 : this.cameraDistance;
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
    if (this.isPilotingSpaceFighter) {
      this.callbacks.onInteractPrompt('Piloting Space Fighter · Press [E] to Land & Disembark');
      return;
    }
    if (this.mountedBeastActor) {
      this.callbacks.onInteractPrompt('Riding Tamed Armor Dinosaur · Press [E] to Dismount');
      return;
    }
    if (
      Math.hypot(
        this.playerPos.x - this.spaceFighterPos.x,
        this.playerPos.z - this.spaceFighterPos.z
      ) < 4.8
    ) {
      this.callbacks.onInteractPrompt('Press [E] or Tap to Board 6-DOF Space Fighter');
      return;
    }
    for (const actor of this.beasts) {
      if (
        actor.state.hp > 0 &&
        actor.state.species === 'brontoshell' &&
        (actor.state.snaredTimer > 0 || actor.state.aiState === 'staggered') &&
        Math.hypot(this.playerPos.x - actor.state.x, this.playerPos.z - actor.state.z) < 6.0
      ) {
        this.callbacks.onInteractPrompt('Press [E] or Tap to Tame & Mount Armor Dinosaur!');
        return;
      }
    }
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
        this.callbacks.onInteractPrompt(
          `Press [E] or Tap to Harvest ${
            this.dayNightState.isNight ? 'Luminous Night-Spores' : 'Sun-Herbs'
          } & Inspect Tracks`
        );
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
    window.removeEventListener('blur', this.onWindowBlur);
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
