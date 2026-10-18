/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { BeastSpecies, BeastKnowledgeLevel } from '../types/game.ts';
import { BEASTOPEDIA_ENTRIES } from '../game/logic/beastopediaData.ts';
import { MaterialCache } from '../game/graphics/materials.ts';
import { buildBeastModel, BeastRig } from '../game/graphics/proceduralModels.ts';

interface BeastopediaModalProps {
  knowledge: Record<BeastSpecies, BeastKnowledgeLevel>;
  onClose: () => void;
}

export const BeastopediaModal: React.FC<BeastopediaModalProps> = ({ knowledge, onClose }) => {
  const [selectedSpecies, setSelectedSpecies] = useState<BeastSpecies>('raptor');
  const [activeTab, setActiveTab] = useState<'lore' | 'tells' | 'weaknesses' | 'drops' | 'strategy'>('lore');
  const [showWeakPoints, setShowWeakPoints] = useState(true);
  const [previewEnraged, setPreviewEnraged] = useState(false);

  const viewerMountRef = useRef<HTMLDivElement>(null);
  const viewerSceneRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    rig: BeastRig;
    matCache: MaterialCache;
    turntableAngle: number;
    isDragging: boolean;
    lastMouseX: number;
    animId: number;
  } | null>(null);

  const entry = BEASTOPEDIA_ENTRIES[selectedSpecies];
  const level = knowledge[selectedSpecies] || 'tracked';

  // Initialize and update 3D Turntable Preview
  useEffect(() => {
    if (!viewerMountRef.current) return;

    const width = viewerMountRef.current.clientWidth || 360;
    const height = viewerMountRef.current.clientHeight || 280;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    viewerMountRef.current.replaceChildren(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x131114);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 50);
    camera.position.set(0, 2.5, selectedSpecies === 'caldera_titan' ? 12 : selectedSpecies === 'brontoshell' ? 9 : 6.5);
    camera.lookAt(0, 1.2, 0);

    // Studio 3-point lighting
    const keyLight = new THREE.DirectionalLight(0xffedd5, 2.0);
    keyLight.position.set(5, 8, 5);
    scene.add(keyLight);

    const fillLight = new THREE.HemisphereLight(0x93c5fd, 0x1f2937, 1.0);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xf59e0b, 1.5);
    rimLight.position.set(-5, 4, -5);
    scene.add(rimLight);

    // Pedestal
    const pedGeo = new THREE.CylinderGeometry(4.0, 4.2, 0.4, 16);
    const pedMat = new THREE.MeshStandardMaterial({ color: 0x221d1b, roughness: 0.8 });
    const ped = new THREE.Mesh(pedGeo, pedMat);
    ped.position.y = -0.2;
    scene.add(ped);

    const matCache = new MaterialCache();
    const rig = buildBeastModel(selectedSpecies, matCache);
    scene.add(rig.root);

    let turntableAngle = 0.5;
    let isDragging = false;
    let lastMouseX = 0;

    const onMouseDown = (e: MouseEvent) => {
      isDragging = true;
      lastMouseX = e.clientX;
    };
    const onMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const dx = e.clientX - lastMouseX;
        lastMouseX = e.clientX;
        turntableAngle += dx * 0.015;
      }
    };
    const onMouseUp = () => {
      isDragging = false;
    };

    const dom = renderer.domElement;
    dom.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    // Touch support for mobile 3D model inspection
    const onTouchStart = (e: TouchEvent) => {
      isDragging = true;
      lastMouseX = e.touches[0].clientX;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (isDragging) {
        const dx = e.touches[0].clientX - lastMouseX;
        lastMouseX = e.touches[0].clientX;
        turntableAngle += dx * 0.02;
      }
    };
    const onTouchEnd = () => {
      isDragging = false;
    };
    dom.addEventListener('touchstart', onTouchStart);
    dom.addEventListener('touchmove', onTouchMove);
    dom.addEventListener('touchend', onTouchEnd);

    let animId = 0;
    const renderLoop = () => {
      animId = requestAnimationFrame(renderLoop);
      if (!isDragging) {
        turntableAngle += 0.006; // gentle idle turntable spin
      }
      rig.root.rotation.y = turntableAngle;

      // Subtle breathing motion
      rig.torso.position.y += Math.sin(performance.now() * 0.003) * 0.001;

      renderer.render(scene, camera);
    };
    animId = requestAnimationFrame(renderLoop);

    viewerSceneRef.current = {
      renderer,
      scene,
      camera,
      rig,
      matCache,
      turntableAngle,
      isDragging,
      lastMouseX,
      animId,
    };

    return () => {
      cancelAnimationFrame(animId);
      dom.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      dom.removeEventListener('touchstart', onTouchStart);
      dom.removeEventListener('touchmove', onTouchMove);
      dom.removeEventListener('touchend', onTouchEnd);
      renderer.dispose();
    };
  }, [selectedSpecies]);

  // Handle weak point and enrage preview toggles
  useEffect(() => {
    if (viewerSceneRef.current) {
      viewerSceneRef.current.rig.setEnraged(previewEnraged);
    }
  }, [previewEnraged]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 pointer-events-auto">
      <div className="bg-[#141110] border border-[#443831] rounded-lg max-w-5xl w-full max-h-[92vh] flex flex-col shadow-2xl text-left overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3.5 border-b border-[#2e2621] bg-[#1a1513]">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📖</span>
            <div>
              <h2 className="text-lg font-black text-amber-300 font-serif tracking-wider">
                ISLAND BEASTOPEDIA
              </h2>
              <p className="text-xs text-zinc-400">
                Ecosystem observations, anatomical tells, weak point analysis, and hunting lore.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded bg-[#27211d] hover:bg-[#3a322c] text-zinc-400 hover:text-white flex items-center justify-center text-sm font-bold transition-all"
          >
            ✕
          </button>
        </div>

        {/* Species Select Bar */}
        <div className="flex border-b border-[#2e2621] bg-[#120f0e] px-6 gap-2 overflow-x-auto py-2">
          {(['raptor', 'brontoshell', 'thunderhorn', 'caldera_titan'] as const).map((sp) => {
            const ent = BEASTOPEDIA_ENTRIES[sp];
            const isSelected = selectedSpecies === sp;
            const kLevel = knowledge[sp] || 'tracked';
            return (
              <button
                key={sp}
                type="button"
                onClick={() => setSelectedSpecies(sp)}
                className={`py-2 px-3.5 rounded text-xs font-bold whitespace-nowrap transition-all flex items-center gap-2 border ${
                  isSelected
                    ? 'bg-amber-600 text-black border-amber-400 shadow'
                    : 'bg-[#1b1715] text-zinc-300 border-[#382f28] hover:border-amber-600/50'
                }`}
              >
                <span>{ent.name.split(' ')[0]}</span>
                <span
                  className={`text-[9px] px-1.5 py-0.2 rounded font-mono uppercase ${
                    kLevel === 'mastered'
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                      : kLevel === 'observed'
                      ? 'bg-amber-950 text-amber-300 border border-amber-800'
                      : 'bg-zinc-800 text-zinc-400'
                  }`}
                >
                  {kLevel}
                </span>
              </button>
            );
          })}
        </div>

        {/* Modal Main Body: 3D Turntable Left + Knowledge Tabs Right */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* Left: 3D Model Turntable Viewer */}
          <div className="w-full md:w-5/12 bg-[#0e0d0f] border-b md:border-b-0 md:border-r border-[#2e2621] flex flex-col relative p-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">
                Interactive 3D Anatomy (Drag to Rotate)
              </span>
              <span className="text-[10px] font-mono font-bold text-amber-400 uppercase px-2 py-0.5 rounded bg-amber-950/80 border border-amber-800">
                {entry.threatLevel}
              </span>
            </div>

            {/* 3D Canvas Container */}
            <div
              ref={viewerMountRef}
              className="w-full h-56 sm:h-64 flex-1 rounded border border-[#2b2522] overflow-hidden cursor-grab active:cursor-grabbing bg-radial from-[#221c21] to-[#0d0c0e]"
            />

            {/* Turntable Control Bar */}
            <div className="mt-3 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setPreviewEnraged(!previewEnraged)}
                className={`flex-1 py-1.5 rounded text-[11px] font-bold uppercase tracking-wider border transition-all ${
                  previewEnraged
                    ? 'bg-red-600 text-white border-red-400 shadow'
                    : 'bg-[#1e1917] text-zinc-300 border-[#3b312a] hover:bg-[#2b2420]'
                }`}
              >
                {previewEnraged ? '🔥 Enraged Phase' : 'Normal State'}
              </button>

              <button
                type="button"
                onClick={() => setShowWeakPoints(!showWeakPoints)}
                className={`flex-1 py-1.5 rounded text-[11px] font-bold uppercase tracking-wider border transition-all ${
                  showWeakPoints
                    ? 'bg-amber-600 text-black border-amber-400'
                    : 'bg-[#1e1917] text-zinc-400 border-[#3b312a]'
                }`}
              >
                {showWeakPoints ? 'Weak Points: Shown' : 'Weak Points: Hidden'}
              </button>
            </div>
          </div>

          {/* Right: Knowledge Encyclopedia Tabs */}
          <div className="flex-1 flex flex-col overflow-hidden bg-[#141110]">
            {/* Tabs Header */}
            <div className="flex border-b border-[#2e2621] bg-[#181412] px-4 gap-1 text-xs font-bold overflow-x-auto">
              {(['lore', 'tells', 'weaknesses', 'drops', 'strategy'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`py-3 px-3 uppercase tracking-wider border-b-2 whitespace-nowrap transition-all ${
                    activeTab === tab
                      ? 'border-amber-500 text-amber-300 bg-[#221b18]'
                      : 'border-transparent text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {tab === 'lore'
                    ? 'Lore & Habitat'
                    : tab === 'tells'
                    ? 'Tells & Attacks'
                    : tab === 'weaknesses'
                    ? 'Weak Points'
                    : tab === 'drops'
                    ? 'Carve Drops'
                    : 'Tactics & Gear'}
                </button>
              ))}
            </div>

            {/* Tab Content Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-4 text-xs">
              {/* TAB 1: Lore */}
              {activeTab === 'lore' && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-base font-bold text-amber-300 font-serif mb-1">{entry.name}</h3>
                    <p className="text-zinc-400 italic mb-3">"{entry.title}"</p>
                    <p className="text-zinc-300 leading-relaxed">{entry.lore}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div className="p-3 bg-[#1d1815] border border-[#3b3028] rounded">
                      <span className="text-[10px] uppercase font-bold text-zinc-500 block mb-1">Habitat</span>
                      <span className="text-zinc-200 font-medium">{entry.habitat}</span>
                    </div>
                    <div className="p-3 bg-[#1d1815] border border-[#3b3028] rounded">
                      <span className="text-[10px] uppercase font-bold text-zinc-500 block mb-1">Ecological Diet</span>
                      <span className="text-zinc-200 font-medium">{entry.diet}</span>
                    </div>
                  </div>

                  <div className="p-3 bg-[#241a18] border border-red-950/80 rounded">
                    <span className="text-[10px] uppercase font-bold text-red-400 block mb-1">
                      Enraged State Mechanics
                    </span>
                    <p className="text-zinc-300 leading-relaxed">{entry.enragedBehavior}</p>
                  </div>
                </div>
              )}

              {/* TAB 2: Tells & Attacks */}
              {activeTab === 'tells' && (
                <div className="space-y-4">
                  <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider block">
                    Observed Windup Tells & Counterplay:
                  </span>
                  {entry.tells.map((t, idx) => (
                    <div key={idx} className="p-3.5 bg-[#1c1715] border border-[#382e27] rounded space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-amber-300">{t.name}</span>
                        <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-amber-950 text-amber-400">
                          Telegraph Window
                        </span>
                      </div>
                      <p className="text-zinc-300 leading-relaxed">{t.description}</p>
                      <div className="pt-1.5 border-t border-[#2e2621] text-emerald-300 font-medium">
                        <span className="font-bold text-zinc-400">Hunter Counterplay: </span>
                        {t.counterplay}
                      </div>
                    </div>
                  ))}

                  <span className="text-[11px] font-bold text-red-400 uppercase tracking-wider block pt-2">
                    Lethal Attack Modes:
                  </span>
                  {entry.attackModes.map((atk, idx) => (
                    <div key={idx} className="p-3 bg-[#1d1815] border border-[#3b3028] rounded flex justify-between items-center">
                      <div>
                        <span className="font-bold text-zinc-200 block">{atk.name}</span>
                        <span className="text-zinc-400 text-[11px]">{atk.danger}</span>
                      </div>
                      <span className="text-[10px] font-mono uppercase px-2 py-1 rounded bg-[#2e241f] text-zinc-300 border border-[#443831]">
                        {atk.damageType}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* TAB 3: Weaknesses */}
              {activeTab === 'weaknesses' && (
                <div className="space-y-4">
                  <p className="text-zinc-400 leading-relaxed">
                    Colossal beasts have fortified armor plates that deflect careless blows. Striking the anatomical weak points deals amplified damage and can permanently sever dangerous abilities.
                  </p>

                  {entry.weaknesses.map((w, idx) => (
                    <div key={idx} className="p-4 bg-[#1c1715] border border-[#382e27] rounded space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-amber-300 text-sm">{w.part}</span>
                        <span className="text-xs font-mono font-black text-amber-400 px-2 py-0.5 rounded bg-amber-950 border border-amber-800">
                          {w.multiplier}
                        </span>
                      </div>
                      <div className="text-zinc-300">
                        <span className="font-bold text-zinc-400">Break Consequence: </span>
                        {w.breakEffect}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* TAB 4: Carve Drops */}
              {activeTab === 'drops' && (
                <div className="space-y-3">
                  <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider block mb-2">
                    Harvestable Materials Table:
                  </span>
                  {entry.harvestableDrops.map((d, idx) => (
                    <div key={idx} className="p-3 bg-[#1c1715] border border-[#382e27] rounded flex items-center justify-between gap-4">
                      <div>
                        <span className="font-bold text-zinc-200 capitalize block">{d.item.replace('_', ' ')}</span>
                        <span className="text-zinc-400 text-[11px]">{d.description}</span>
                      </div>
                      <span
                        className={`text-[10px] font-mono uppercase font-bold px-2 py-1 rounded border whitespace-nowrap ${
                          d.rarity === 'Legendary'
                            ? 'bg-amber-950 border-amber-600 text-amber-300'
                            : d.rarity === 'Rare'
                            ? 'bg-purple-950 border-purple-700 text-purple-300'
                            : d.rarity === 'Uncommon'
                            ? 'bg-blue-950 border-blue-700 text-blue-300'
                            : 'bg-zinc-800 border-zinc-700 text-zinc-300'
                        }`}
                      >
                        {d.rarity}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* TAB 5: Tactics & Gear */}
              {activeTab === 'strategy' && (
                <div className="space-y-4">
                  <div>
                    <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider block mb-2">
                      Master Hunter Strategy Tips:
                    </span>
                    <ul className="space-y-2">
                      {entry.huntingTips.map((tip, idx) => (
                        <li key={idx} className="p-3 bg-[#1c1715] border border-[#382e27] rounded text-zinc-300 flex items-start gap-2 leading-relaxed">
                          <span className="text-amber-500 font-bold">▸</span>
                          <span>{tip}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block mb-2">
                      Forged Weapons & Armors:
                    </span>
                    <div className="space-y-1.5">
                      {entry.associatedRecipes.map((r, idx) => (
                        <div key={idx} className="p-2.5 bg-[#171311] border border-[#2d2520] rounded text-zinc-200 font-mono text-[11px] flex items-center gap-2">
                          <span className="text-amber-400">⚔</span>
                          <span>{r}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-[#171311] border-t border-[#2e2621] flex justify-between items-center text-xs">
          <span className="text-zinc-500">
            Observation Level: <span className="text-amber-400 font-bold uppercase">{level}</span>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-[#2d2520] hover:bg-[#3d322b] text-zinc-200 font-bold rounded transition-all"
          >
            Close Beastopedia [B]
          </button>
        </div>
      </div>
    </div>
  );
};
