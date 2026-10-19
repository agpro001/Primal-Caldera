/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import type {
  BeastSpecies,
  BeastKnowledgeLevel,
  NPCId,
} from '../types/game.ts';
import {
  BEASTOPEDIA_ENTRIES,
  CHARACTER_ATLAS_ENTRIES,
  ENVIRONMENT_ATLAS_ENTRIES,
  SKETCHFAB_ASSET_REGISTRY,
  type EnvironmentModelId,
} from '../game/logic/beastopediaData.ts';
import { MaterialCache } from '../game/graphics/materials.ts';
import {
  buildBeastModel,
  buildHunterModel,
  buildTribalNPCModel,
  buildEnvironmentShowcaseModel,
  createSculptedOrganicGeometry,
} from '../game/engine/assetLoaderAndRigging.ts';
import {
  generateReferenceImageDataUrl,
  REFERENCE_ART_SPECS,
} from '../game/graphics/referenceArt.ts';
import type { PlayableCharacterId } from '../types/game.ts';

interface BeastopediaModalProps {
  knowledge: Record<BeastSpecies, BeastKnowledgeLevel>;
  beastsHunted: BeastSpecies[];
  onClose: () => void;
}

type AtlasCategory = 'beasts' | 'characters' | 'environment';
type ViewMode = 'split' | '3d' | '2d' | 'sketchfab';

export const BeastopediaModal: React.FC<BeastopediaModalProps> = ({
  knowledge,
  beastsHunted,
  onClose,
}) => {
  const [category, setCategory] = useState<AtlasCategory>('beasts');
  const [viewMode, setViewMode] = useState<ViewMode>('split');
  const [selectedSpecies, setSelectedSpecies] = useState<BeastSpecies>('sky_dragon');
  const [selectedCharId, setSelectedCharId] = useState<NPCId | 'hunter_koa' | PlayableCharacterId>('demon_hunter');
  const [selectedEnvId, setSelectedEnvId] = useState<EnvironmentModelId>('trees_canopy');

  const mountRef = useRef<HTMLDivElement>(null);

  const beastList: BeastSpecies[] = [
    'sky_dragon',
    'raptor',
    'snapjaw',
    'brontoshell',
    'thunderhorn',
    'frostfang',
    'caldera_titan',
  ];

  const activeSubjectId =
    category === 'beasts'
      ? selectedSpecies
      : category === 'characters'
      ? selectedCharId === 'demon_hunter' || selectedCharId === 'swat_operator' || selectedCharId === 'bulky_knight'
        ? 'hunter_koa'
        : selectedCharId
      : selectedEnvId;

  const referenceImageUrl = React.useMemo(
    () => generateReferenceImageDataUrl(activeSubjectId),
    [activeSubjectId]
  );
  const referenceSpec = REFERENCE_ART_SPECS[activeSubjectId];

  useEffect(() => {
    if (viewMode === '2d' || viewMode === 'sketchfab') return;
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 440;
    const height = container.clientHeight || 340;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x090b10);
    scene.fog = new THREE.FogExp2(0x090b10, 0.025);

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
    camera.position.set(0, 3.4, 9.2);
    camera.lookAt(0, 1.8, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const ambient = new THREE.HemisphereLight(0xe0f2fe, 0x090d16, 1.35);
    scene.add(ambient);

    const keyLight = new THREE.DirectionalLight(0xfff7ed, 2.5);
    keyLight.position.set(6, 11, 7);
    keyLight.castShadow = true;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 1.6);
    rimLight.position.set(-7, 5, -6);
    scene.add(rimLight);

    const matCache = new MaterialCache();

    // Minimalist Pedestal (Sculpted Organic Geometry - Zero Primitives)
    const pedGeo = createSculptedOrganicGeometry(
      [
        [0.0, 3.5, 3.5],
        [1.0, 3.2, 3.2],
      ],
      36,
      0.28,
      -0.28
    );
    const pedMat = new THREE.MeshStandardMaterial({
      color: 0x111827,
      roughness: 0.4,
      metalness: 0.6,
    });
    const pedestal = new THREE.Mesh(pedGeo, pedMat);
    pedestal.receiveShadow = true;
    scene.add(pedestal);

    const ringGeo = new THREE.RingGeometry(3.05, 3.16, 48);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.45,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.y = 0.01;
    scene.add(ring);

    const turntable = new THREE.Group();
    scene.add(turntable);

    let beastRig: ReturnType<typeof buildBeastModel> | null = null;
    let hunterRig: ReturnType<typeof buildHunterModel> | null = null;

    if (category === 'beasts') {
      beastRig = buildBeastModel(selectedSpecies, matCache);
      const scaleMap: Record<BeastSpecies, number> = {
        raptor: 0.85,
        snapjaw: 0.68,
        brontoshell: 0.62,
        thunderhorn: 0.68,
        frostfang: 0.58,
        sky_dragon: 0.48,
        caldera_titan: 0.52,
      };
      beastRig.root.scale.setScalar(scaleMap[selectedSpecies]);
      if (selectedSpecies === 'sky_dragon') {
        beastRig.root.position.y = 0.4;
      }
      turntable.add(beastRig.root);
    } else if (category === 'characters') {
      if (
        selectedCharId === 'demon_hunter' ||
        selectedCharId === 'swat_operator' ||
        selectedCharId === 'bulky_knight' ||
        selectedCharId === 'hunter_koa'
      ) {
        const charHero: PlayableCharacterId =
          selectedCharId === 'hunter_koa' ? 'demon_hunter' : selectedCharId;
        hunterRig = buildHunterModel(matCache, 'thunder_warden_aegis', charHero);
        hunterRig.root.scale.setScalar(1.25);
        if (hunterRig.wingsGroup) {
          hunterRig.wingsGroup.visible = true;
        }
        turntable.add(hunterRig.root);
      } else {
        const npcGroup = buildTribalNPCModel(selectedCharId, matCache);
        npcGroup.scale.setScalar(1.25);
        turntable.add(npcGroup);
      }
    } else {
      const envGroup = buildEnvironmentShowcaseModel(selectedEnvId, matCache);
      turntable.add(envGroup);
    }

    let isDragging = false;
    let prevX = 0;
    let manualYaw = 0.55;

    const onDown = (e: MouseEvent) => {
      isDragging = true;
      prevX = e.clientX;
    };
    const onMove = (e: MouseEvent) => {
      if (!isDragging) return;
      manualYaw += (e.clientX - prevX) * 0.012;
      prevX = e.clientX;
    };
    const onUp = () => {
      isDragging = false;
    };

    const domEl = renderer.domElement;
    domEl.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);

    let animId = 0;
    const clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const dt = clock.getDelta();
      const elapsed = clock.getElapsedTime();
      if (!isDragging) {
        manualYaw += 0.0065;
      }
      turntable.rotation.y = manualYaw;

      if (beastRig) {
        beastRig.controller.uniforms.uStridePhase.value = elapsed * 5.0;
        beastRig.controller.uniforms.uStrideAmp.value = 0.35;
        beastRig.controller.uniforms.uTailWave.value = 0.4;
        beastRig.controller.uniforms.uWingFlap.value = selectedSpecies === 'sky_dragon' ? 0.55 : 0.0;
        beastRig.controller.update(dt, elapsed);
        beastRig.head.rotation.x = Math.sin(elapsed * 2.2) * 0.08;
        beastRig.tail.rotation.y = Math.cos(elapsed * 2.8) * 0.18;
        if (beastRig.leftWing && beastRig.rightWing) {
          const flap = Math.sin(elapsed * 4.2) * 0.45;
          beastRig.leftWing.rotation.z = flap;
          beastRig.rightWing.rotation.z = -flap;
        }
      }
      if (hunterRig) {
        hunterRig.controller.uniforms.uStridePhase.value = elapsed * 4.5;
        hunterRig.controller.uniforms.uStrideAmp.value = 0.28;
        hunterRig.controller.uniforms.uHeadYaw.value = Math.sin(elapsed * 1.5) * 0.25;
        hunterRig.controller.update(dt, elapsed);
        if (hunterRig.leftWing && hunterRig.rightWing) {
          const wFlap = Math.sin(elapsed * 3.2) * 0.25;
          hunterRig.leftWing.rotation.y = wFlap;
          hunterRig.rightWing.rotation.y = -wFlap;
        }
      }

      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(animId);
      domEl.removeEventListener('mousedown', onDown);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      renderer.dispose();
      matCache.dispose();
    };
  }, [category, selectedSpecies, selectedCharId, selectedEnvId, viewMode]);

  const currentBeastEntry = BEASTOPEDIA_ENTRIES[selectedSpecies];
  const currentCharEntry =
    CHARACTER_ATLAS_ENTRIES.find((c) => c.id === selectedCharId) || CHARACTER_ATLAS_ENTRIES[0];
  const currentEnvEntry =
    ENVIRONMENT_ATLAS_ENTRIES.find((e) => e.id === selectedEnvId) || ENVIRONMENT_ATLAS_ENTRIES[0];

  const isHunted = beastsHunted.includes(selectedSpecies);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-md pointer-events-auto">
      {/* Minimalist Glassmorphic Studio Container */}
      <div className="bg-zinc-950/80 backdrop-blur-2xl border border-white/15 rounded-2xl max-w-6xl w-full max-h-[92vh] flex flex-col shadow-[0_25px_70px_rgba(0,0,0,0.85)] text-left overflow-hidden">
        {/* Minimalist Header Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 border-b border-white/10">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-[0.28em] text-sky-400 block">
              BEASTOPEDIA · 2D CONCEPT & 3D ASSET CODEX
            </span>
            <h2 className="text-lg sm:text-xl font-light text-white tracking-wide mt-0.5">
              Aetherial Archipelago · Scientific Anatomy & Mithril Armor Studio
            </h2>
          </div>

          {/* Minimalist Category Switcher */}
          <div className="flex items-center gap-6 text-xs">
            <button
              type="button"
              onClick={() => setCategory('beasts')}
              className={`pb-1 font-medium tracking-wider uppercase transition-all cursor-pointer border-b-2 ${
                category === 'beasts'
                  ? 'border-sky-400 text-white'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Beasts & Dragons ({beastList.length})
            </button>
            <button
              type="button"
              onClick={() => setCategory('characters')}
              className={`pb-1 font-medium tracking-wider uppercase transition-all cursor-pointer border-b-2 ${
                category === 'characters'
                  ? 'border-sky-400 text-white'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Mithril & Characters ({CHARACTER_ATLAS_ENTRIES.length})
            </button>
            <button
              type="button"
              onClick={() => setCategory('environment')}
              className={`pb-1 font-medium tracking-wider uppercase transition-all cursor-pointer border-b-2 ${
                category === 'environment'
                  ? 'border-sky-400 text-white'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
            >
              3D Biome Flora ({ENVIRONMENT_ATLAS_ENTRIES.length})
            </button>

            <button
              type="button"
              onClick={onClose}
              className="ml-2 w-8 h-8 rounded-full bg-white/5 hover:bg-white/15 border border-white/10 text-zinc-300 hover:text-white flex items-center justify-center text-xs transition-all cursor-pointer"
              title="Close Codex"
            >
              <svg className="w-3.5 h-3.5 stroke-current" viewBox="0 0 24 24" fill="none" strokeWidth="2.5">
                <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>

        {/* Body Layout */}
        <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
          {/* Left Minimalist Navigation List */}
          <div className="w-full lg:w-64 border-b lg:border-b-0 lg:border-r border-white/10 overflow-y-auto p-3 space-y-1">
            {category === 'beasts' &&
              beastList.map((sp) => {
                const entry = BEASTOPEDIA_ENTRIES[sp];
                const active = selectedSpecies === sp;
                return (
                  <button
                    key={sp}
                    type="button"
                    onClick={() => setSelectedSpecies(sp)}
                    className={`w-full text-left px-3.5 py-2.5 rounded-xl transition-all flex items-center justify-between cursor-pointer ${
                      active
                        ? 'bg-white/10 text-white border border-white/20 shadow-sm'
                        : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200 border border-transparent'
                    }`}
                  >
                    <div className="truncate pr-2">
                      <div className="text-xs font-medium truncate">{entry.name}</div>
                      <div className="text-[10px] text-zinc-500 font-mono truncate">
                        {entry.biomeName}
                      </div>
                    </div>
                    <span className="text-[10px] font-mono text-sky-400 shrink-0 px-1.5 py-0.5 rounded bg-sky-500/10 border border-sky-400/20">
                      T{entry.threatLevel}
                    </span>
                  </button>
                );
              })}

            {category === 'characters' &&
              CHARACTER_ATLAS_ENTRIES.map((ch) => {
                const active = selectedCharId === ch.id;
                return (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => setSelectedCharId(ch.id)}
                    className={`w-full text-left px-3.5 py-2.5 rounded-xl transition-all cursor-pointer ${
                      active
                        ? 'bg-white/10 text-white border border-white/20 shadow-sm'
                        : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200 border border-transparent'
                    }`}
                  >
                    <div className="text-xs font-medium truncate">{ch.name}</div>
                    <div className="text-[10px] text-sky-400/80 font-mono truncate">{ch.role}</div>
                  </button>
                );
              })}

            {category === 'environment' &&
              ENVIRONMENT_ATLAS_ENTRIES.map((env) => {
                const active = selectedEnvId === env.id;
                return (
                  <button
                    key={env.id}
                    type="button"
                    onClick={() => setSelectedEnvId(env.id)}
                    className={`w-full text-left px-3.5 py-2.5 rounded-xl transition-all cursor-pointer ${
                      active
                        ? 'bg-white/10 text-white border border-white/20 shadow-sm'
                        : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200 border border-transparent'
                    }`}
                  >
                    <div className="text-xs font-medium truncate">{env.name}</div>
                    <div className="text-[10px] text-emerald-400/80 font-mono truncate">
                      {env.biomeName}
                    </div>
                  </button>
                );
              })}
          </div>

          {/* Center & Right Minimalist Inspection Canvas + Scientific Lore */}
          <div className="flex-1 flex flex-col overflow-y-auto p-5 sm:p-6 space-y-6">
            {/* Viewport Mode Controls */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
              <div className="flex items-center gap-2 text-xs text-zinc-400 font-mono">
                <span className="w-2 h-2 rounded-full bg-sky-400" />
                <span>STEP 1: 2D REFERENCE BLUEPRINT</span>
                <span className="text-zinc-600">→</span>
                <span>STEP 2: ACCURATE 3D MODEL</span>
              </div>

              <div className="flex items-center gap-1.5">
                {(['split', '3d', '2d', 'sketchfab'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setViewMode(mode)}
                    className={`px-3 py-1 rounded-lg text-[11px] font-mono uppercase transition-all cursor-pointer ${
                      viewMode === mode
                        ? 'bg-sky-500/20 text-sky-300 border border-sky-400/40'
                        : 'bg-white/5 text-zinc-400 hover:text-white border border-white/5'
                    }`}
                  >
                    {mode === 'split'
                      ? '2D + 3D Split'
                      : mode === '3d'
                      ? '3D Turntable'
                      : mode === '2d'
                      ? '2D Blueprint'
                      : 'Sketchfab 3D Embed'}
                  </button>
                ))}
              </div>
            </div>

            {/* Visual Stage: 2D Concept Art + 3D Turntable OR Sketchfab 3D Embed */}
            {viewMode === 'sketchfab' ? (
              (() => {
                const sfAsset =
                  category === 'beasts'
                    ? SKETCHFAB_ASSET_REGISTRY.find((a) =>
                        selectedSpecies === 'sky_dragon'
                          ? a.id === 'dragon_boss'
                          : selectedSpecies === 'brontoshell' || selectedSpecies === 'caldera_titan'
                          ? a.id === 'armor_dinosaur'
                          : selectedSpecies === 'snapjaw' || selectedSpecies === 'raptor'
                          ? a.id === 'jason_t'
                          : a.id === 'triceratops_beetle'
                      ) || SKETCHFAB_ASSET_REGISTRY[3]
                    : category === 'characters'
                    ? SKETCHFAB_ASSET_REGISTRY.find((a) => a.id === selectedCharId) || SKETCHFAB_ASSET_REGISTRY[0]
                    : SKETCHFAB_ASSET_REGISTRY.find((a) =>
                        selectedEnvId === 'trees_canopy'
                          ? a.id === 'mystic_forest'
                          : selectedEnvId === 'grass_shrubs'
                          ? a.id === 'fern_forest'
                          : selectedEnvId === 'stones_boulders'
                          ? a.id === 'space_fighter'
                          : a.id === 'diorama_forest'
                      ) || SKETCHFAB_ASSET_REGISTRY[8];

                return (
                  <div className="rounded-2xl overflow-hidden border border-white/15 bg-black/70 p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-medium text-white">
                          {sfAsset.title} · Interactive Sketchfab 3D Viewer
                        </h3>
                        <p className="text-xs text-zinc-400">
                          {sfAsset.roleOrBiome} · Local Runtime: <span className="text-sky-300 font-mono">{sfAsset.localModelPath}</span>
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setViewMode('split')}
                        className="px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-xs text-sky-300 font-mono cursor-pointer"
                      >
                        Back to Split 2D+3D
                      </button>
                    </div>

                    <div className="sketchfab-embed-wrapper w-full h-[360px] rounded-xl overflow-hidden border border-white/10">
                      <iframe
                        key={sfAsset.embedUrl}
                        title={sfAsset.title}
                        className="w-full h-full"
                        frameBorder="0"
                        allowFullScreen
                        allow="autoplay; fullscreen; xr-spatial-tracking"
                        src={sfAsset.embedUrl}
                      />
                    </div>
                  </div>
                );
              })()
            ) : (
              <div
                className={`grid gap-4 ${
                  viewMode === 'split' ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'
                }`}
              >
                {/* Step 1: 2D Reference Blueprint */}
                {(viewMode === 'split' || viewMode === '2d') && (
                  <div className="relative rounded-2xl overflow-hidden border border-white/10 bg-zinc-900/50 flex flex-col">
                    <div className="px-4 py-2 border-b border-white/10 flex items-center justify-between text-[11px] font-mono text-zinc-400">
                      <span>STEP 1 · 2D CONCEPT PICTURE</span>
                      <span className="text-sky-400">{referenceSpec?.dimensions}</span>
                    </div>
                    <div className="relative flex-1 min-h-[260px] flex items-center justify-center p-2">
                      <img
                        src={referenceImageUrl}
                        alt={referenceSpec?.title || activeSubjectId}
                        className="w-full h-full max-h-[290px] object-contain rounded-lg"
                      />
                    </div>
                  </div>
                )}

                {/* Step 2: Live Interactive 3D Model */}
                {(viewMode === 'split' || viewMode === '3d') && (
                  <div className="relative rounded-2xl overflow-hidden border border-white/10 bg-zinc-900/50 flex flex-col">
                    <div className="px-4 py-2 border-b border-white/10 flex items-center justify-between text-[11px] font-mono text-zinc-400">
                      <span>STEP 2 · INTERACTIVE 3D RIG</span>
                      <span className="text-emerald-400">Drag to Rotate 360°</span>
                    </div>
                    <div
                      ref={mountRef}
                      className="w-full flex-1 min-h-[260px] cursor-grab active:cursor-grabbing"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Minimalist Unboxed Metadata & Scientific Analysis */}
            {category === 'beasts' && currentBeastEntry && (
              <div className="space-y-4 pt-2">
                <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-white/10 pb-3">
                  <div>
                    <h3 className="text-xl font-light text-white tracking-wide">
                      {currentBeastEntry.name}
                    </h3>
                    <p className="text-xs text-sky-400 font-mono mt-0.5">
                      {currentBeastEntry.title} · {currentBeastEntry.biomeName}
                    </p>
                  </div>
                  <div className="flex items-center gap-4 text-xs font-mono text-zinc-400">
                    <span>Diet: {currentBeastEntry.diet}</span>
                    <span>Status: {isHunted ? 'SLAYED' : knowledge[selectedSpecies]?.toUpperCase()}</span>
                  </div>
                </div>

                <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
                  {currentBeastEntry.lore}
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2 border-t border-white/10">
                  <div>
                    <h4 className="text-[11px] font-mono uppercase tracking-widest text-zinc-400 mb-2">
                      Anatomical Weak Points
                    </h4>
                    <div className="space-y-2">
                      {currentBeastEntry.weaknesses.map((wp) => (
                        <div
                          key={wp.part}
                          className="flex items-center justify-between text-xs border-b border-white/5 pb-1.5"
                        >
                          <span className="text-zinc-200 font-medium">{wp.part}</span>
                          <span className="text-sky-400 font-mono">{wp.multiplier}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-[11px] font-mono uppercase tracking-widest text-zinc-400 mb-2">
                      Combat & Survival Strategy
                    </h4>
                    <p className="text-xs text-zinc-300 leading-relaxed mb-2">
                      {currentBeastEntry.huntingTips.join(' ')}
                    </p>
                    <div className="text-[11px] font-mono text-amber-300/90">
                      Drops: {currentBeastEntry.drops.join(' · ')}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {category === 'characters' && currentCharEntry && (
              <div className="space-y-4 pt-2">
                <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-white/10 pb-3">
                  <div>
                    <h3 className="text-xl font-light text-white tracking-wide">
                      {currentCharEntry.name}
                    </h3>
                    <p className="text-xs text-sky-400 font-mono mt-0.5">
                      {currentCharEntry.role} · {currentCharEntry.biomeName}
                    </p>
                  </div>
                  {currentCharEntry.sketchfabEmbedUrl && (
                    <button
                      type="button"
                      onClick={() => setViewMode('sketchfab')}
                      className="px-3 py-1.5 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/40 text-xs font-mono text-sky-300 cursor-pointer"
                    >
                      Open Sketchfab 3D Embed
                    </button>
                  )}
                </div>

                <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
                  {currentCharEntry.lore}
                </p>

                <div className="flex flex-wrap gap-4 pt-2 border-t border-white/10 text-xs font-mono text-zinc-400">
                  <span>Armament: {currentCharEntry.weaponOrTool}</span>
                  <span>·</span>
                  <span className="text-sky-300">{currentCharEntry.traits.join(' · ')}</span>
                </div>
              </div>
            )}

            {category === 'environment' && currentEnvEntry && (
              <div className="space-y-4 pt-2">
                <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-white/10 pb-3">
                  <div>
                    <h3 className="text-xl font-light text-white tracking-wide">
                      {currentEnvEntry.name}
                    </h3>
                    <p className="text-xs text-emerald-400 font-mono mt-0.5">
                      {currentEnvEntry.biomeName}
                    </p>
                  </div>
                </div>
                <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
                  {currentEnvEntry.description}
                </p>
                <div className="text-xs font-mono text-emerald-300/90 pt-2 border-t border-white/10">
                  Features: {currentEnvEntry.features.join(' · ')}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
