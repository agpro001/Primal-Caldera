/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState, useEffect } from 'react';
import type { PlayerStats, BeastState, WeaponId, ArmorId, WeatherType } from '../types/game.ts';
import { WEAPON_REGISTRY, ARMOR_REGISTRY, QUEST_CHAIN } from '../game/logic/rules.ts';
import { WEATHER_CONDITIONS } from '../game/engine/weatherSystem.ts';
import { sound } from '../game/audio/soundEngine.ts';

interface HUDProps {
  stats: PlayerStats;
  targetBeast: BeastState | null;
  currentQuestIndex: number;
  equippedWeapon: WeaponId;
  equippedArmor: ArmorId;
  currentWeather: WeatherType;
  interactPrompt: string | null;
  notification: { message: string; type: 'info' | 'loot' | 'danger' } | null;
  focusVisionActive: boolean;
  onAttack: () => void;
  onChargeRelease: () => void;
  onDodge: () => void;
  onHeal: () => void;
  onPlaceTrap: () => void;
  onThrowStone: () => void;
  onToggleFocus: () => void;
  onInteract: () => void;
  onOpenCrafting: () => void;
  onOpenBeastopedia: () => void;
  onPause: () => void;
  onVirtualMove: (x: number, y: number) => void;
  onLookDelta: (dx: number, dy: number) => void;
}

export const HUD: React.FC<HUDProps> = ({
  stats,
  targetBeast,
  currentQuestIndex,
  equippedWeapon,
  equippedArmor,
  currentWeather,
  interactPrompt,
  notification,
  focusVisionActive,
  onAttack,
  onChargeRelease,
  onDodge,
  onHeal,
  onPlaceTrap,
  onThrowStone,
  onToggleFocus,
  onInteract,
  onOpenCrafting,
  onOpenBeastopedia,
  onPause,
  onVirtualMove,
  onLookDelta,
}) => {
  const [isMuted, setIsMuted] = useState(sound.getMuted());
  const [touchActive, setTouchActive] = useState(false);

  // Virtual joystick touch tracking
  const joystickBaseRef = useRef<HTMLDivElement>(null);
  const joystickKnobRef = useRef<HTMLDivElement>(null);
  const joystickTouchIdRef = useRef<number | null>(null);
  const joystickCenterRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Camera swipe touch tracking
  const lookTouchIdRef = useRef<number | null>(null);
  const lastLookPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const currentQuest = QUEST_CHAIN[Math.min(currentQuestIndex, QUEST_CHAIN.length - 1)];
  const weapon = WEAPON_REGISTRY[equippedWeapon] || WEAPON_REGISTRY.flint_spear;
  const armor = ARMOR_REGISTRY[equippedArmor] || ARMOR_REGISTRY.scavenger_rags;

  const hpPercent = Math.max(0, Math.min(100, (stats.hp / stats.maxHp) * 100));
  const staminaPercent = Math.max(0, Math.min(100, (stats.stamina / stats.maxStamina) * 100));

  // Detect touch device
  useEffect(() => {
    const checkTouch = () => {
      setTouchActive('ontouchstart' in window || navigator.maxTouchPoints > 0);
    };
    checkTouch();
  }, []);

  // Left joystick touch handlers
  const handleTouchStartLeft = (e: React.TouchEvent) => {
    if (joystickTouchIdRef.current !== null) return;
    const touch = e.changedTouches[0];
    joystickTouchIdRef.current = touch.identifier;
    const rect = e.currentTarget.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    joystickCenterRef.current = { x: cx, y: cy };
  };

  const handleTouchMoveLeft = (e: React.TouchEvent) => {
    if (joystickTouchIdRef.current === null) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === joystickTouchIdRef.current) {
        const dx = touch.clientX - joystickCenterRef.current.x;
        const dy = touch.clientY - joystickCenterRef.current.y;
        const dist = Math.hypot(dx, dy);
        const maxDist = 45;
        const clampedDist = Math.min(dist, maxDist);
        const angle = Math.atan2(dy, dx);
        const knobX = Math.cos(angle) * clampedDist;
        const knobY = Math.sin(angle) * clampedDist;

        if (joystickKnobRef.current) {
          joystickKnobRef.current.style.transform = `translate(${knobX}px, ${knobY}px)`;
        }

        const normX = knobX / maxDist;
        const normY = knobY / maxDist;
        onVirtualMove(normX, normY);
        break;
      }
    }
  };

  const handleTouchEndLeft = (e: React.TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === joystickTouchIdRef.current) {
        joystickTouchIdRef.current = null;
        if (joystickKnobRef.current) {
          joystickKnobRef.current.style.transform = `translate(0px, 0px)`;
        }
        onVirtualMove(0, 0);
        break;
      }
    }
  };

  // Right touch pad for camera look-around
  const handleTouchStartRight = (e: React.TouchEvent) => {
    if (lookTouchIdRef.current !== null) return;
    const touch = e.changedTouches[0];
    lookTouchIdRef.current = touch.identifier;
    lastLookPosRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchMoveRight = (e: React.TouchEvent) => {
    if (lookTouchIdRef.current === null) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === lookTouchIdRef.current) {
        const dx = touch.clientX - lastLookPosRef.current.x;
        const dy = touch.clientY - lastLookPosRef.current.y;
        lastLookPosRef.current = { x: touch.clientX, y: touch.clientY };
        onLookDelta(dx, dy);
        break;
      }
    }
  };

  const handleTouchEndRight = (e: React.TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === lookTouchIdRef.current) {
        lookTouchIdRef.current = null;
        break;
      }
    }
  };

  return (
    <div className="fixed inset-0 pointer-events-none select-none overflow-hidden z-20 font-sans">
      {/* Hunter Focus Vision Screen Border Effect */}
      {focusVisionActive && (
        <div className="absolute inset-0 border-4 border-amber-500/40 pointer-events-none shadow-[inset_0_0_80px_rgba(245,158,11,0.25)] transition-all duration-300">
          <div className="absolute top-16 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-amber-950/90 border border-amber-500/80 text-amber-300 text-xs font-bold tracking-widest uppercase rounded shadow-2xl">
            Hunter's Focus Active · Weak Points & Tracks Exposed
          </div>
        </div>
      )}

      {/* TOP BAR: Objective & Utility Controls */}
      <header className="absolute top-3 inset-x-3 flex items-start justify-between pointer-events-none">
        {/* Top-Left Cluster: Quest Tracker + Weather System Badge */}
        <div className="flex flex-col gap-2 max-w-sm">
          {/* Quest Tracker */}
          <div className="pointer-events-auto bg-[#181513]/90 border border-[#443831] px-4 py-2.5 rounded text-left shadow-lg">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              <span className="text-[10px] uppercase font-bold tracking-wider text-amber-400">
                Quest: {currentQuest.title}
              </span>
            </div>
            <p className="text-xs text-[#d1d5db] leading-relaxed line-clamp-2">
              {currentQuest.description}
            </p>
          </div>

          {/* Dynamic Weather Condition Badge */}
          <div className="pointer-events-auto bg-[#181513]/90 border border-[#443831] px-3 py-1.5 rounded text-left shadow-md flex items-center gap-2.5">
            <span className="text-base">
              {currentWeather === 'clear' ? '☀️' : currentWeather === 'heavy_rain' ? '🌧️' : currentWeather === 'dense_fog' ? '🌫️' : '🌋'}
            </span>
            <div>
              <span className="text-[10px] uppercase font-bold text-amber-400 block leading-tight">
                Weather: {WEATHER_CONDITIONS[currentWeather].name}
              </span>
              <span className="text-[9px] text-zinc-400 block leading-tight">
                {currentWeather === 'heavy_rain'
                  ? 'Rain muffles footsteps (-30% alert) · Scent decays fast'
                  : currentWeather === 'dense_fog'
                  ? 'Sulfur mist halves beast eyesight · Focus recommended'
                  : currentWeather === 'ash_storm'
                  ? 'Ember fallout agitates beasts (+20% speed & rage)'
                  : 'Clear island skies · Standard creature tracking'}
              </span>
            </div>
          </div>
        </div>

        {/* Boss Health Bar (Centered when beast in combat) */}
        {targetBeast && targetBeast.hp > 0 && (
          <div className="absolute left-1/2 -translate-x-1/2 top-12 w-full max-w-xs sm:max-w-sm px-2 pointer-events-none">
            <div className="bg-[#121115]/95 border border-[#3e3430] p-2.5 rounded shadow-2xl text-center">
              <div className="flex items-center justify-between mb-1 text-xs">
                <span className="font-bold text-[#f3f4f6] tracking-wide flex items-center gap-1.5">
                  {targetBeast.name}
                  {targetBeast.enraged && (
                    <span className="px-1.5 py-0.5 text-[9px] font-black uppercase bg-red-600 text-white rounded">
                      Enraged
                    </span>
                  )}
                  {targetBeast.staggered && (
                    <span className="px-1.5 py-0.5 text-[9px] font-black uppercase bg-amber-500 text-black rounded animate-pulse">
                      Staggered!
                    </span>
                  )}
                </span>
                <span className="text-[11px] font-mono text-[#9ca3af] tabular-nums">
                  {Math.round(targetBeast.hp)} / {targetBeast.maxHp} HP
                </span>
              </div>

              {/* Boss HP Bar */}
              <div className="w-full h-3 bg-[#26211f] rounded overflow-hidden p-0.5 border border-[#473c38]">
                <div
                  className={`h-full transition-all duration-150 rounded-sm ${
                    targetBeast.enraged ? 'bg-gradient-to-r from-red-600 to-amber-500' : 'bg-red-600'
                  }`}
                  style={{ width: `${Math.max(0, (targetBeast.hp / targetBeast.maxHp) * 100)}%` }}
                />
              </div>

              {/* Telegraph Windup Danger Bar */}
              {targetBeast.aiState.startsWith('telegraph') && (
                <div className="mt-1 flex items-center gap-1.5">
                  <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest">
                    Incoming Strike!
                  </span>
                  <div className="flex-1 h-1.5 bg-[#372722] rounded overflow-hidden">
                    <div
                      className="h-full bg-amber-400 transition-all duration-75"
                      style={{ width: `${Math.min(100, (1 - targetBeast.stateTimer) * 100)}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Top-Right Utility Cluster */}
        <div className="pointer-events-auto flex items-center gap-2">
          {/* Beastopedia Button */}
          <button
            type="button"
            onClick={onOpenBeastopedia}
            title="Open Beastopedia [B]"
            className="px-3 h-9 bg-[#1a1716]/90 border border-[#423730] text-emerald-300 text-xs font-bold rounded flex items-center gap-1.5 hover:bg-[#2c2623] active:scale-95 transition-all"
          >
            <span className="text-sm">📖</span>
            <span className="hidden sm:inline">Beastopedia [B]</span>
          </button>

          {/* Audio Mute Button */}
          <button
            type="button"
            onClick={() => {
              const muted = sound.toggleMute();
              setIsMuted(muted);
            }}
            title="Mute Audio [M]"
            className="w-9 h-9 bg-[#1a1716]/90 border border-[#423730] text-[#e5e7eb] rounded flex items-center justify-center hover:bg-[#2c2623] active:scale-95 transition-all"
          >
            {isMuted ? (
              <svg className="w-4 h-4 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="1" y1="1" x2="23" y2="23"></line>
                <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"></path>
              </svg>
            ) : (
              <svg className="w-4 h-4 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
              </svg>
            )}
          </button>

          {/* Workbench / Crafting Button */}
          <button
            type="button"
            onClick={onOpenCrafting}
            title="Workbench & Catalog [Tab]"
            className="px-3 h-9 bg-[#1a1716]/90 border border-[#423730] text-amber-300 text-xs font-bold rounded flex items-center gap-1.5 hover:bg-[#2c2623] active:scale-95 transition-all"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
            </svg>
            <span className="hidden sm:inline">Craft [Tab]</span>
          </button>

          {/* Touch Controls Overlay Toggle */}
          <button
            type="button"
            onClick={() => setTouchActive((prev) => !prev)}
            title="Toggle On-Screen Touch Controls"
            className={`px-2.5 h-9 border text-xs font-bold rounded flex items-center gap-1 transition-all ${
              touchActive
                ? 'bg-amber-600/90 text-black border-amber-400'
                : 'bg-[#1a1716]/90 border-[#423730] text-zinc-400 hover:text-white'
            }`}
          >
            <span>📱</span>
            <span className="hidden md:inline">{touchActive ? 'Touch Controls' : 'Touch Mode'}</span>
          </button>

          {/* Pause Button */}
          <button
            type="button"
            onClick={onPause}
            title="Pause Game [Esc / P]"
            className="w-9 h-9 bg-[#1a1716]/90 border border-[#423730] text-[#e5e7eb] rounded flex items-center justify-center hover:bg-[#2c2623] active:scale-95 transition-all"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="6" y="4" width="4" height="16"></rect>
              <rect x="14" y="4" width="4" height="16"></rect>
            </svg>
          </button>
        </div>
      </header>

      {/* NOTIFICATION TOAST (Center-Top) */}
      {notification && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 pointer-events-none transition-all duration-200">
          <div
            className={`px-4 py-2 rounded shadow-2xl border text-xs font-bold tracking-wide flex items-center gap-2 ${
              notification.type === 'danger'
                ? 'bg-red-950/90 border-red-500/80 text-red-200'
                : notification.type === 'loot'
                ? 'bg-emerald-950/90 border-emerald-500/80 text-emerald-200'
                : 'bg-[#1e1b19]/90 border-amber-600/70 text-amber-200'
            }`}
          >
            <span>{notification.message}</span>
          </div>
        </div>
      )}

      {/* INTERACT PROMPT (Center) */}
      {interactPrompt && (
        <div className="absolute bottom-28 left-1/2 -translate-x-1/2 pointer-events-auto">
          <button
            type="button"
            onClick={onInteract}
            className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 active:scale-95 text-black font-extrabold text-sm rounded shadow-2xl border border-amber-300 flex items-center gap-2 animate-bounce transition-all"
          >
            <span className="w-5 h-5 rounded bg-black/20 flex items-center justify-center text-xs">E</span>
            <span>{interactPrompt}</span>
          </button>
        </div>
      )}

      {/* BOTTOM-LEFT: Vitality, Stamina & Gear Cluster */}
      <footer
        className={`absolute pointer-events-auto flex flex-col gap-2 max-w-xs transition-all duration-150 ${
          touchActive ? 'bottom-40 left-3' : 'bottom-3 left-3'
        }`}
      >
        <div className="bg-[#141211]/90 border border-[#3e342f] p-3 rounded shadow-xl text-left">
          {/* Health Bar */}
          <div className="mb-2">
            <div className="flex justify-between items-center text-[11px] mb-0.5">
              <span className="font-bold text-red-400 tracking-wider">VITALITY</span>
              <span className="font-mono text-[#d1d5db] tabular-nums">
                {Math.round(stats.hp)} / {stats.maxHp}
              </span>
            </div>
            <div className="w-48 h-3 bg-[#241e1c] rounded overflow-hidden p-0.5 border border-[#4a3d37]">
              <div
                className="h-full bg-gradient-to-r from-red-600 to-rose-400 rounded-sm transition-all duration-100"
                style={{ width: `${hpPercent}%` }}
              />
            </div>
          </div>

          {/* Stamina Bar */}
          <div className="mb-3">
            <div className="flex justify-between items-center text-[11px] mb-0.5">
              <span className="font-bold text-emerald-400 tracking-wider">STAMINA</span>
              <span className="font-mono text-[#d1d5db] tabular-nums">
                {Math.round(stats.stamina)} / {stats.maxStamina}
              </span>
            </div>
            <div className="w-48 h-2 bg-[#1b261d] rounded overflow-hidden p-0.5 border border-[#2d4231]">
              <div
                className="h-full bg-emerald-500 rounded-sm transition-all duration-75"
                style={{ width: `${staminaPercent}%` }}
              />
            </div>
          </div>

          {/* Equipped Gear Row */}
          <div className="flex items-center gap-3 pt-2 border-t border-[#2e2622] text-xs">
            <div className="flex items-center gap-1.5 text-amber-300 font-semibold">
              <span className="w-4 h-4 rounded bg-amber-950 flex items-center justify-center text-[10px]">⚔</span>
              <span className="truncate max-w-[110px]">{weapon.name}</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-300 font-semibold">
              <span className="w-4 h-4 rounded bg-slate-900 flex items-center justify-center text-[10px]">🛡</span>
              <span className="truncate max-w-[110px]">{armor.name}</span>
            </div>
          </div>
        </div>

        {/* Quick Belt (Supplies) */}
        <div className="flex items-center gap-2">
          {/* Healing Salve Flask */}
          <button
            type="button"
            onClick={onHeal}
            title="Drink Healing Salve [Q]"
            className="px-3 py-1.5 bg-[#171412]/90 hover:bg-[#28221f] active:scale-95 border border-[#443831] text-emerald-300 rounded text-xs font-bold flex items-center gap-2 shadow"
          >
            <span className="w-4 h-4 rounded-full bg-emerald-950 flex items-center justify-center text-[10px]">Q</span>
            <span>Salve x{stats.healingFlasks}</span>
          </button>

          {/* Traps */}
          <button
            type="button"
            onClick={onPlaceTrap}
            title="Place Pitfall Trap [T]"
            className="px-3 py-1.5 bg-[#171412]/90 hover:bg-[#28221f] active:scale-95 border border-[#443831] text-amber-400 rounded text-xs font-bold flex items-center gap-2 shadow"
          >
            <span className="w-4 h-4 rounded-full bg-amber-950 flex items-center justify-center text-[10px]">T</span>
            <span>Trap x{stats.traps}</span>
          </button>

          {/* Throwing Stone */}
          <button
            type="button"
            onClick={onThrowStone}
            title="Throw Stone / Lure [R]"
            className="px-3 py-1.5 bg-[#171412]/90 hover:bg-[#28221f] active:scale-95 border border-[#443831] text-slate-300 rounded text-xs font-bold flex items-center gap-2 shadow"
          >
            <span className="w-4 h-4 rounded-full bg-slate-800 flex items-center justify-center text-[10px]">R</span>
            <span>Stone x{stats.lureStones}</span>
          </button>
        </div>
      </footer>

      {/* MOBILE TOUCH CONTROLS (Only visible on touch devices or togglable) */}
      {touchActive && (
        <>
          {/* Left Virtual Joystick Area */}
          <div
            className="absolute bottom-6 left-6 w-36 h-36 rounded-full bg-black/35 border-2 border-white/20 flex items-center justify-center pointer-events-auto touch-none"
            ref={joystickBaseRef}
            onTouchStart={handleTouchStartLeft}
            onTouchMove={handleTouchMoveLeft}
            onTouchEnd={handleTouchEndLeft}
          >
            <div
              className="w-14 h-14 rounded-full bg-amber-500/80 border border-amber-300 shadow pointer-events-none"
              ref={joystickKnobRef}
            />
          </div>

          {/* Right Camera Look Swipe Pad */}
          <div
            className="absolute top-24 bottom-36 right-0 w-1/2 pointer-events-auto touch-none opacity-0"
            onTouchStart={handleTouchStartRight}
            onTouchMove={handleTouchMoveRight}
            onTouchEnd={handleTouchEndRight}
          />

          {/* Right Mobile Action Buttons Cluster */}
          <div className="absolute bottom-5 right-4 pointer-events-auto flex flex-col gap-2 items-end">
            {/* Top row: Utilities & Hunting gear */}
            <div className="flex items-center gap-2">
              {/* Beastopedia Mobile Button */}
              <button
                type="button"
                onClick={onOpenBeastopedia}
                className="w-10 h-10 rounded-full bg-emerald-950/90 border border-emerald-500/70 text-emerald-300 font-bold text-xs shadow-lg flex items-center justify-center active:scale-90"
                title="Beastopedia"
              >
                📖
              </button>

              {/* Trap placement */}
              <button
                type="button"
                onClick={onPlaceTrap}
                className="w-10 h-10 rounded-full bg-amber-950/90 border border-amber-500/70 text-amber-300 font-bold text-xs shadow-lg flex items-center justify-center active:scale-90"
                title="Trap"
              >
                🕸️
              </button>

              {/* Throw Stone */}
              <button
                type="button"
                onClick={onThrowStone}
                className="w-10 h-10 rounded-full bg-slate-900/90 border border-slate-500/70 text-slate-200 font-bold text-xs shadow-lg flex items-center justify-center active:scale-90"
                title="Throw Stone"
              >
                🪨
              </button>

              {/* Hunter Focus Vision Toggle */}
              <button
                type="button"
                onClick={onToggleFocus}
                className={`w-11 h-11 rounded-full border flex items-center justify-center font-bold text-[10px] shadow-lg active:scale-90 ${
                  focusVisionActive
                    ? 'bg-amber-500 text-black border-amber-300 font-black'
                    : 'bg-black/60 text-amber-300 border-amber-500/40'
                }`}
              >
                Focus
              </button>
            </div>

            {/* Mid row: Dodge & Quick Heal */}
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onHeal}
                className="w-12 h-12 rounded-full bg-emerald-800/90 border border-emerald-400 text-white font-bold text-xs shadow flex items-center justify-center active:scale-90"
                title="Heal"
              >
                Heal
              </button>

              <button
                type="button"
                onClick={onDodge}
                className="w-13 h-13 rounded-full bg-sky-600/90 border-2 border-sky-300 text-white font-extrabold text-xs shadow-xl flex items-center justify-center active:scale-90"
                title="Dodge Roll"
              >
                Dodge
              </button>
            </div>

            {/* Bottom row: Heavy Thrust & Light Strike */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onChargeRelease}
                className="w-13 h-13 rounded-full bg-purple-900/90 border-2 border-purple-400 text-white font-extrabold text-xs shadow-xl flex items-center justify-center active:scale-90"
                title="Heavy Thrust"
              >
                Heavy
              </button>

              {/* Spear Strike Primary Button */}
              <button
                type="button"
                onClick={onAttack}
                className="w-18 h-18 rounded-full bg-gradient-to-tr from-amber-600 to-red-600 border-2 border-amber-300 text-white font-black text-base shadow-2xl flex items-center justify-center active:scale-90"
                title="Strike"
              >
                Strike
              </button>
            </div>
          </div>
        </>
      )}

      {/* Control Hint Line in Safe Margin (Desktop) */}
      {!touchActive && (
        <div className="absolute bottom-2 inset-x-0 text-center pointer-events-none">
          <p className="text-[11px] text-[#9ca3af] tracking-wider font-medium">
            WASD Move · Left Click Spear Strike · Right Click Hold Charge · Space Dodge · F Hunter Focus · B Beastopedia · E Interact · Q Heal · Tab Craft · Esc Pause
          </p>
        </div>
      )}
    </div>
  );
};
