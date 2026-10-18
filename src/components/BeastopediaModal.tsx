/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import {
  X,
  BookOpen,
  ShieldAlert,
  Crosshair,
  Sparkles,
  Award,
  Users,
  Mountain,
  RotateCcw,
  Image as ImageIcon,
} from 'lucide-react';
import type { BeastSpecies, BeastKnowledgeLevel, NPCId } from '../types/game.ts';
import {
  BEASTOPEDIA_ENTRIES,
  CHARACTER_ATLAS_ENTRIES,
  ENVIRONMENT_ATLAS_ENTRIES,
  EnvironmentModelId,
} from '../game/logic/beastopediaData.ts';
import { MaterialCache } from '../game/graphics/materials.ts';
import {
  buildBeastModel,
  buildHunterModel,
  buildTribalNPCModel,
  buildEnvironmentShowcaseModel,
} from '../game/graphics/proceduralModels.ts';
import { render2DReferenceCardDataURL } from '../game/graphics/referenceArt.ts';

interface BeastopediaModalProps {
  knowledge: Record<BeastSpecies, BeastKnowledgeLevel>;
  beastsHunted: BeastSpecies[];
  onClose: () => void;
}

type AtlasCategory = 'beasts' | 'characters' | 'environment';

const SPECIES_LIST: BeastSpecies[] = [
  'raptor',
  'snapjaw',
  'brontoshell',
  'frostfang',
  'thunderhorn',
  'caldera_titan',
];

export const BeastopediaModal: React.FC<BeastopediaModalProps> = ({
  knowledge,
  beastsHunted,
  onClose,
}) => {
  const [category, setCategory] = useState<AtlasCategory>('beasts');
  const [selectedSpecies, setSelectedSpecies] = useState<BeastSpecies>('raptor');
  const [selectedCharacterId, setSelectedCharacterId] = useState<NPCId | 'hunter_koa'>('hunter_koa');
  const [selectedEnvId, setSelectedEnvId] = useState<EnvironmentModelId>('snow_mountain');
  const [showConceptSheet, setShowConceptSheet] = useState<boolean>(true);

  const previewContainerRef = useRef<HTMLDivElement>(null);
  const rotationOffsetRef = useRef<number>(0.45);
  const isDraggingRef = useRef<boolean>(false);
  const lastXRef = useRef<number>(0);

  // Interactive 3D Turntable Preview for Creatures, Characters, and 3D Environment Models
  useEffect(() => {
    const container = previewContainerRef.current;
    if (!container) return;

    const width = container.clientWidth || 320;
    const height = container.clientHeight || 240;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(44, width / height, 0.1, 100);
    camera.position.set(0, 2.4, 7.2);
    camera.lookAt(0, 1.0, 0);

    const hemi = new THREE.HemisphereLight(0xffedd5, 0x1e293b, 1.05);
    scene.add(hemi);

    const dir = new THREE.DirectionalLight(0xfff7ed, 1.65);
    dir.position.set(5, 8, 6);
    scene.add(dir);

    const rim = new THREE.DirectionalLight(0x38bdf8, 0.85);
    rim.position.set(-5, 4, -5);
    scene.add(rim);

    const matCache = new MaterialCache();
    const rootHolder = new THREE.Group();
    scene.add(rootHolder);

    if (category === 'beasts') {
      const rig = buildBeastModel(selectedSpecies, matCache);
      const scale =
        selectedSpecies === 'caldera_titan'
          ? 0.56
          : selectedSpecies === 'frostfang' || selectedSpecies === 'thunderhorn'
          ? 0.66
          : selectedSpecies === 'snapjaw' || selectedSpecies === 'brontoshell'
          ? 0.72
          : 0.92;
      rig.root.scale.setScalar(scale);
      rig.root.position.y = -0.35;
      rootHolder.add(rig.root);
    } else if (category === 'characters') {
      if (selectedCharacterId === 'hunter_koa') {
        const hunter = buildHunterModel(matCache);
        hunter.updateWeapon('caldera_fang_glaive');
        hunter.updateArmor('thunder_warden_aegis');
        hunter.root.scale.setScalar(1.38);
        hunter.root.position.y = -0.35;
        rootHolder.add(hunter.root);
      } else {
        const npcGroup = buildTribalNPCModel(selectedCharacterId, matCache);
        npcGroup.scale.setScalar(1.38);
        npcGroup.position.y = -0.35;
        rootHolder.add(npcGroup);
      }
    } else {
      const envGroup = buildEnvironmentShowcaseModel(selectedEnvId, matCache);
      envGroup.scale.setScalar(1.15);
      envGroup.position.y = 0.75;
      rootHolder.add(envGroup);
    }

    // Turntable pedestal ring
    const ringGeo = new THREE.TorusGeometry(2.15, 0.04, 8, 36);
    ringGeo.rotateX(Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.position.y = -0.35;
    scene.add(ringMesh);

    let frameId = 0;
    const animate = () => {
      frameId = requestAnimationFrame(animate);
      if (!isDraggingRef.current) {
        rotationOffsetRef.current += 0.0085;
      }
      rootHolder.rotation.y = rotationOffsetRef.current;
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(frameId);
      matCache.dispose();
      renderer.dispose();
    };
  }, [category, selectedSpecies, selectedCharacterId, selectedEnvId]);

  const handlePointerDown = (e: React.PointerEvent) => {
    isDraggingRef.current = true;
    lastXRef.current = e.clientX;
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - lastXRef.current;
    lastXRef.current = e.clientX;
    rotationOffsetRef.current += dx * 0.012;
  };

  const handlePointerUp = () => {
    isDraggingRef.current = false;
  };

  const beastEntry = BEASTOPEDIA_ENTRIES[selectedSpecies];
  const beastLevel = knowledge[selectedSpecies] || 'tracked';
  const isSlain = beastsHunted.includes(selectedSpecies);

  const selectedChar =
    CHARACTER_ATLAS_ENTRIES.find((c) => c.id === selectedCharacterId) || CHARACTER_ATLAS_ENTRIES[0];
  const selectedEnv =
    ENVIRONMENT_ATLAS_ENTRIES.find((e) => e.id === selectedEnvId) || ENVIRONMENT_ATLAS_ENTRIES[0];

  const activeItemId =
    category === 'beasts'
      ? selectedSpecies
      : category === 'characters'
      ? selectedCharacterId
      : selectedEnvId;
  const conceptRef = {
    url: render2DReferenceCardDataURL(activeItemId),
    caption:
      category === 'beasts'
        ? `2D Anatomical Reference Blueprint: ${beastEntry.name}`
        : category === 'characters'
        ? `2D Character Reference Blueprint: ${selectedChar.name}`
        : `2D Environment & Asset Blueprint: ${selectedEnv.name}`,
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="w-full max-w-5xl bg-stone-950/95 border border-amber-500/30 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header + Category Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-stone-800 bg-stone-900/70">
          <div className="flex items-center gap-3">
            <BookOpen className="w-6 h-6 text-amber-400" />
            <div>
              <h2 className="text-lg font-bold tracking-wider uppercase text-amber-100">
                3D Island Atlas & Hunter&apos;s Beastopedia
              </h2>
              <p className="text-xs text-stone-400">
                Interactive 3D Models + Concept Pictures of Creatures, Characters, Mountains, Rivers & Flora
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCategory('beasts')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 border transition-colors cursor-pointer ${
                category === 'beasts'
                  ? 'bg-amber-500/20 border-amber-500/50 text-amber-200'
                  : 'bg-stone-900 border-stone-800 text-stone-400 hover:text-stone-200'
              }`}
            >
              <Crosshair className="w-3.5 h-3.5" />
              Beasts (6)
            </button>
            <button
              onClick={() => setCategory('characters')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 border transition-colors cursor-pointer ${
                category === 'characters'
                  ? 'bg-amber-500/20 border-amber-500/50 text-amber-200'
                  : 'bg-stone-900 border-stone-800 text-stone-400 hover:text-stone-200'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              Characters (4)
            </button>
            <button
              onClick={() => setCategory('environment')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 border transition-colors cursor-pointer ${
                category === 'environment'
                  ? 'bg-amber-500/20 border-amber-500/50 text-amber-200'
                  : 'bg-stone-900 border-stone-800 text-stone-400 hover:text-stone-200'
              }`}
            >
              <Mountain className="w-3.5 h-3.5" />
              3D World & Flora (6)
            </button>

            <button
              onClick={() => setShowConceptSheet((v) => !v)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 border transition-colors cursor-pointer ${
                showConceptSheet
                  ? 'bg-cyan-500/20 border-cyan-400/50 text-cyan-200'
                  : 'bg-stone-900 border-stone-700 text-stone-300 hover:text-white'
              }`}
              title="Toggle 2D Concept Art Reference Sheet"
            >
              <ImageIcon className="w-3.5 h-3.5" />
              {showConceptSheet ? 'Hide 2D Pic' : 'View 2D Pic'}
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-stone-800/80 hover:bg-stone-700 text-stone-300 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
          {/* Left Sidebar Selector */}
          <div className="w-full md:w-64 border-b md:border-b-0 md:border-r border-stone-800 bg-stone-900/40 p-3 flex md:flex-col gap-2 overflow-x-auto md:overflow-y-auto">
            {category === 'beasts' &&
              SPECIES_LIST.map((sp) => {
                const e = BEASTOPEDIA_ENTRIES[sp];
                const active = selectedSpecies === sp;
                const slain = beastsHunted.includes(sp);
                return (
                  <button
                    key={sp}
                    onClick={() => setSelectedSpecies(sp)}
                    className={`flex-shrink-0 md:w-full text-left p-3 rounded-lg border transition-all cursor-pointer ${
                      active
                        ? 'bg-amber-950/50 border-amber-500/60 text-amber-100'
                        : 'bg-stone-900/60 border-stone-800/80 text-stone-400 hover:bg-stone-800/60'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm">{e.name}</span>
                      {slain && <Award className="w-4 h-4 text-amber-400 shrink-0" />}
                    </div>
                    <div className="text-[11px] text-stone-400 mt-0.5">{e.biomeName}</div>
                    <div className="flex items-center gap-1 mt-1.5">
                      {Array.from({ length: e.threatLevel }).map((_, i) => (
                        <span key={i} className="w-2 h-2 rounded-full bg-amber-500" />
                      ))}
                    </div>
                  </button>
                );
              })}

            {category === 'characters' &&
              CHARACTER_ATLAS_ENTRIES.map((ch) => {
                const active = selectedCharacterId === ch.id;
                return (
                  <button
                    key={ch.id}
                    onClick={() => setSelectedCharacterId(ch.id)}
                    className={`flex-shrink-0 md:w-full text-left p-3 rounded-lg border transition-all cursor-pointer ${
                      active
                        ? 'bg-amber-950/50 border-amber-500/60 text-amber-100'
                        : 'bg-stone-900/60 border-stone-800/80 text-stone-400 hover:bg-stone-800/60'
                    }`}
                  >
                    <div className="font-bold text-sm">{ch.name}</div>
                    <div className="text-[11px] text-amber-400/90 mt-0.5">{ch.role}</div>
                    <div className="text-[10px] text-stone-500 mt-0.5">{ch.biomeName}</div>
                  </button>
                );
              })}

            {category === 'environment' &&
              ENVIRONMENT_ATLAS_ENTRIES.map((env) => {
                const active = selectedEnvId === env.id;
                return (
                  <button
                    key={env.id}
                    onClick={() => setSelectedEnvId(env.id)}
                    className={`flex-shrink-0 md:w-full text-left p-3 rounded-lg border transition-all cursor-pointer ${
                      active
                        ? 'bg-amber-950/50 border-amber-500/60 text-amber-100'
                        : 'bg-stone-900/60 border-stone-800/80 text-stone-400 hover:bg-stone-800/60'
                    }`}
                  >
                    <div className="font-bold text-sm">{env.name}</div>
                    <div className="text-[11px] text-emerald-400/90 mt-0.5">{env.category}</div>
                    <div className="text-[10px] text-stone-500 mt-0.5">{env.biomeName}</div>
                  </button>
                );
              })}
          </div>

          {/* Right Detail & 3D Turntable Content */}
          <div className="flex-1 p-6 overflow-y-auto space-y-5">
            {showConceptSheet && (
              <div className="bg-stone-900/90 border border-cyan-500/40 rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-cyan-300 flex items-center gap-1.5">
                    <ImageIcon className="w-4 h-4" />
                    {conceptRef.caption}
                  </span>
                  <span className="text-[11px] text-stone-400">
                    Generated Reference Picture → Matched to Live 3D Models Below
                  </span>
                </div>
                <img
                  src={conceptRef.url}
                  alt={conceptRef.caption}
                  className="w-full max-h-60 object-contain rounded-lg border border-stone-800 bg-stone-950"
                />
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
              {/* Interactive 3D Turntable */}
              <div
                className="lg:col-span-5 relative h-60 rounded-xl bg-gradient-to-b from-stone-900/90 to-stone-950 border border-stone-800 overflow-hidden flex items-center justify-center select-none cursor-grab active:cursor-grabbing"
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
              >
                <div ref={previewContainerRef} className="w-full h-full" />
                <div className="absolute top-2.5 left-3 flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-amber-300/90 bg-black/60 px-2 py-0.5 rounded">
                  <RotateCcw className="w-3 h-3" />
                  Drag to Rotate 3D Model
                </div>
                {category === 'beasts' && (
                  <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between text-[11px] text-stone-400 bg-black/50 px-2.5 py-1 rounded">
                    <span>{beastEntry.sizeLabel}</span>
                    <span className="text-amber-400 font-semibold uppercase">
                      {isSlain ? 'Mastered' : beastLevel}
                    </span>
                  </div>
                )}
              </div>

              {/* Primary Lore & Summary */}
              <div className="lg:col-span-7 space-y-3">
                {category === 'beasts' && (
                  <>
                    <div>
                      <div className="text-xs font-bold uppercase tracking-widest text-amber-400">
                        {beastEntry.biomeName} · {beastEntry.diet}
                      </div>
                      <h3 className="text-2xl font-black text-stone-100 mt-0.5">{beastEntry.name}</h3>
                      <div className="text-sm italic text-stone-400">{beastEntry.title}</div>
                    </div>
                    <p className="text-sm text-stone-300 leading-relaxed">{beastEntry.lore}</p>
                    <div className="p-3 rounded-lg bg-red-950/30 border border-red-500/30 text-xs text-red-200">
                      <span className="font-bold uppercase tracking-wider text-red-400 block mb-0.5">
                        Enrage Behavior
                      </span>
                      {beastEntry.enrageTrigger}
                    </div>
                  </>
                )}

                {category === 'characters' && (
                  <>
                    <div>
                      <div className="text-xs font-bold uppercase tracking-widest text-amber-400">
                        {selectedChar.biomeName} · {selectedChar.role}
                      </div>
                      <h3 className="text-2xl font-black text-stone-100 mt-0.5">{selectedChar.name}</h3>
                      <div className="text-sm italic text-amber-200/80 mt-0.5">
                        Signature Gear: {selectedChar.weaponOrTool}
                      </div>
                    </div>
                    <p className="text-sm text-stone-300 leading-relaxed">{selectedChar.lore}</p>
                    <div className="space-y-1.5 pt-1">
                      {selectedChar.traits.map((tr, i) => (
                        <div
                          key={i}
                          className="text-xs text-stone-300 bg-stone-900/70 border border-stone-800 rounded-lg px-3 py-2"
                        >
                          • {tr}
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {category === 'environment' && (
                  <>
                    <div>
                      <div className="text-xs font-bold uppercase tracking-widest text-emerald-400">
                        {selectedEnv.biomeName} · {selectedEnv.category}
                      </div>
                      <h3 className="text-2xl font-black text-stone-100 mt-0.5">{selectedEnv.name}</h3>
                    </div>
                    <p className="text-sm text-stone-300 leading-relaxed">{selectedEnv.description}</p>
                    <div className="space-y-1.5 pt-1">
                      {selectedEnv.features.map((feat, i) => (
                        <div
                          key={i}
                          className="text-xs text-stone-300 bg-stone-900/70 border border-stone-800 rounded-lg px-3 py-2"
                        >
                          • {feat}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Extra Tactical Breakdown for Beasts */}
            {category === 'beasts' && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-stone-900/60 border border-stone-800 rounded-xl p-4 space-y-3">
                    <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wider">
                      <ShieldAlert className="w-4 h-4" />
                      Telegraphed Attack Tells & Counters
                    </div>
                    {beastEntry.tells.map((t, idx) => (
                      <div
                        key={idx}
                        className="border-t border-stone-800/80 pt-2.5 first:border-0 first:pt-0"
                      >
                        <div className="font-bold text-sm text-stone-200">{t.name}</div>
                        <div className="text-xs text-stone-400 mt-0.5">
                          <span className="text-amber-300 font-semibold">Visual Tell:</span> {t.cue}
                        </div>
                        <div className="text-xs text-emerald-300 mt-0.5">
                          <span className="font-semibold">Counter:</span> {t.counter}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="bg-stone-900/60 border border-stone-800 rounded-xl p-4 space-y-3">
                    <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wider">
                      <Crosshair className="w-4 h-4" />
                      Breakable Weak Points
                    </div>
                    {beastEntry.weaknesses.map((w, idx) => (
                      <div
                        key={idx}
                        className="border-t border-stone-800/80 pt-2.5 first:border-0 first:pt-0"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-sm text-stone-200">{w.part}</span>
                          <span className="text-xs font-bold text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded">
                            {w.multiplier}
                          </span>
                        </div>
                        <div className="text-xs text-stone-400 mt-1">{w.breakBonus}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-stone-900/40 border border-stone-800 rounded-xl p-4 flex flex-col md:flex-row gap-4 justify-between">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-300">
                      <Sparkles className="w-3.5 h-3.5" />
                      Veteran Hunting Tips
                    </div>
                    <ul className="list-disc list-inside text-xs text-stone-300 space-y-1">
                      {beastEntry.huntingTips.map((tip, i) => (
                        <li key={i}>{tip}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="shrink-0">
                    <div className="text-xs font-bold uppercase tracking-wider text-stone-400 mb-1.5">
                      Carve & Break Drops
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {beastEntry.drops.map((d, i) => (
                        <span
                          key={i}
                          className="text-xs bg-stone-800 border border-stone-700 text-amber-200 px-2.5 py-1 rounded-md"
                        >
                          {d}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
