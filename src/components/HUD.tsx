/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState } from 'react';
import type {
  PlayerStats,
  BeastState,
  WeaponId,
  ArmorId,
  WeatherType,
  AtmosphericScienceState,
  AdventureMission,
} from '../types/game.ts';
import {
  QUEST_CHAIN,
  WEAPON_REGISTRY,
  ARMOR_REGISTRY,
} from '../game/logic/rules.ts';

interface HUDProps {
  stats: PlayerStats;
  targetBeast: BeastState | null;
  currentQuestIndex: number;
  equippedWeapon: WeaponId;
  equippedArmor: ArmorId;
  currentWeather: WeatherType;
  atmosphericScience: AtmosphericScienceState;
  adventureMissions: AdventureMission[];
  activeAdventureId: string;
  isFlying: boolean;
  isAirborne: boolean;
  interactPrompt: string | null;
  notification: { message: string; type: 'info' | 'loot' | 'danger' } | null;
  focusVisionActive: boolean;
  hitMarker?: { damage: number; isCrit: boolean; isWeakPoint: boolean; id: number } | null;
  onAttack: () => void;
  onChargeRelease: () => void;
  onJump: () => void;
  onToggleFlight: () => void;
  onDodge: () => void;
  onEatFood: () => void;
  onDrinkWater: () => void;
  onConsumeEgg: () => void;
  onSelectAdventure: (advId: string) => void;
  onPlaceTrap: () => void;
  onThrowStone: () => void;
  onToggleFocus: () => void;
  onInteract: () => void;
  onOpenCrafting: () => void;
  onOpenBeastopedia: () => void;
  onPause: () => void;
  onVirtualMove: (vx: number, vy: number) => void;
  onLookDelta: (dx: number, dy: number) => void;
}

export const HUD: React.FC<HUDProps> = ({
  stats,
  targetBeast,
  currentQuestIndex,
  equippedWeapon,
  equippedArmor,
  currentWeather,
  atmosphericScience,
  adventureMissions,
  activeAdventureId,
  isFlying,
  isAirborne,
  interactPrompt,
  notification,
  focusVisionActive,
  hitMarker,
  onAttack,
  onChargeRelease,
  onJump,
  onToggleFlight,
  onDodge,
  onEatFood,
  onDrinkWater,
  onConsumeEgg,
  onSelectAdventure,
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
  const currentQuest = QUEST_CHAIN[Math.min(currentQuestIndex, QUEST_CHAIN.length - 1)];
  const weapon = WEAPON_REGISTRY[equippedWeapon];
  const armor = ARMOR_REGISTRY[equippedArmor];

  const activeAdventure =
    adventureMissions.find((m) => m.id === activeAdventureId) || adventureMissions[0];

  const hpPct = Math.max(0, Math.min(100, (stats.hp / stats.maxHp) * 100));
  const foodPct = Math.max(0, Math.min(100, (stats.food / stats.maxFood) * 100));
  const waterPct = Math.max(0, Math.min(100, (stats.water / stats.maxWater) * 100));

  // Virtual Joystick State
  const joyRef = useRef<HTMLDivElement>(null);
  const [joyKnob, setJoyKnob] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const joyTouchId = useRef<number | null>(null);

  // Touch Camera Drag State
  const lookTouchId = useRef<number | null>(null);
  const lastLookPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const handleJoystickUpdate = (clientX: number, clientY: number) => {
    if (!joyRef.current) return;
    const rect = joyRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const maxRadius = rect.width / 2 - 12;

    let dx = clientX - centerX;
    let dy = clientY - centerY;
    const dist = Math.hypot(dx, dy);
    if (dist > maxRadius) {
      dx = (dx / dist) * maxRadius;
      dy = (dy / dist) * maxRadius;
    }

    setJoyKnob({ x: dx, y: dy });
    // Pushing joystick UP yields negative dy -> forward (-Z)
    // Pushing joystick RIGHT yields positive dx -> right (+X)
    onVirtualMove(dx / maxRadius, dy / maxRadius);
  };

  const resetJoystick = () => {
    joyTouchId.current = null;
    setJoyKnob({ x: 0, y: 0 });
    onVirtualMove(0, 0);
  };

  return (
    <div
      className="fixed inset-0 z-20 pointer-events-none flex flex-col justify-between p-3 sm:p-5 select-none"
      onTouchStart={(e) => {
        for (let i = 0; i < e.changedTouches.length; i++) {
          const t = e.changedTouches[i];
          if (t.clientX > window.innerWidth * 0.45 && lookTouchId.current === null) {
            lookTouchId.current = t.identifier;
            lastLookPos.current = { x: t.clientX, y: t.clientY };
          }
        }
      }}
      onTouchMove={(e) => {
        for (let i = 0; i < e.changedTouches.length; i++) {
          const t = e.changedTouches[i];
          if (t.identifier === lookTouchId.current) {
            const dx = t.clientX - lastLookPos.current.x;
            const dy = t.clientY - lastLookPos.current.y;
            lastLookPos.current = { x: t.clientX, y: t.clientY };
            onLookDelta(dx, dy);
          }
        }
      }}
      onTouchEnd={(e) => {
        for (let i = 0; i < e.changedTouches.length; i++) {
          if (e.changedTouches[i].identifier === lookTouchId.current) {
            lookTouchId.current = null;
          }
        }
      }}
    >
      {/* TOP BAR: Glassmorphic Survival Telemetry (HP, Food, Water, Eggs) & Adventure Operations */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        {/* Top-Left: Survival Metabolism & Multi-Stage Adventure Operations */}
        <div className="flex flex-col gap-2 max-w-sm w-full sm:w-auto">
          {/* Glassmorphic Vitality + Food + Water + Eggs Panel */}
          <div className="bg-zinc-950/75 border border-white/15 rounded-xl p-3 shadow-2xl pointer-events-auto">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-sky-300 truncate">
                  Mithril Vitality
                </span>
                {isFlying && (
                  <span className="px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider bg-sky-500/25 text-sky-200 border border-sky-400/50 rounded shrink-0">
                    FLIGHT
                  </span>
                )}
              </div>
              <span className="text-xs font-mono font-bold text-white tabular-nums shrink-0">
                {Math.ceil(stats.hp)} / {stats.maxHp} HP
              </span>
            </div>

            {/* HP Bar */}
            <div className="w-full sm:w-64 h-2.5 bg-black/70 rounded-full overflow-hidden border border-white/10 mb-2.5">
              <div
                className="h-full bg-gradient-to-r from-rose-600 via-red-500 to-amber-400 transition-all duration-150"
                style={{ width: `${hpPct}%` }}
              />
            </div>

            {/* Food (Caloric Energy) Bar */}
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-300/90">
                Caloric Nutrition (Food)
              </span>
              <span className="text-[10px] font-mono text-amber-200 tabular-nums">
                {Math.round(stats.food)} / {stats.maxFood} kcal
              </span>
            </div>
            <div className="w-full sm:w-64 h-1.5 bg-black/70 rounded-full overflow-hidden border border-white/10 mb-2">
              <div
                className="h-full bg-gradient-to-r from-amber-600 to-yellow-400 transition-all duration-150"
                style={{ width: `${foodPct}%` }}
              />
            </div>

            {/* Water (Cellular Hydration) Bar */}
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-cyan-300/90">
                Cellular Hydration (Water)
              </span>
              <span className="text-[10px] font-mono text-cyan-200 tabular-nums">
                {Math.round(stats.water)} / {stats.maxWater} mL
              </span>
            </div>
            <div className="w-full sm:w-64 h-1.5 bg-black/70 rounded-full overflow-hidden border border-white/10 mb-2.5">
              <div
                className="h-full bg-gradient-to-r from-sky-600 to-cyan-300 transition-all duration-150"
                style={{ width: `${waterPct}%` }}
              />
            </div>

            {/* Equipped Gear & Egg Count Summary Line */}
            <div className="pt-2 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-[11px] text-zinc-300">
              <span className="truncate font-medium text-sky-200">{weapon.name}</span>
              <div className="flex items-center gap-2 font-mono text-[10px]">
                <span className="text-amber-300">🥚 Eggs: {stats.eggsCollected}</span>
                <span className="text-zinc-500">|</span>
                <span className="text-emerald-300">{armor.defense} DEF</span>
              </div>
            </div>
          </div>
        </div>

        {/* Top-Center: Lock-On Colossal Beast or Flying Dragon Vital Bar */}
        {targetBeast && targetBeast.aiState !== 'dead' && (
          <div className="bg-zinc-950/80 border border-white/15 rounded-xl px-4 py-3 shadow-2xl max-w-md w-full mx-auto">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                <h2 className="text-xs sm:text-sm font-black uppercase tracking-wider text-white font-serif">
                  {targetBeast.name}
                </h2>
              </div>
              <div className="flex items-center gap-1.5">
                {targetBeast.isFlyingBeast && (
                  <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-sky-950/90 text-sky-300 border border-sky-500/40">
                    ALT {Math.round((targetBeast.flightAltitude || targetBeast.y) * 12.5)}m
                  </span>
                )}
                <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-red-950/80 text-red-300 border border-red-800/60">
                  {targetBeast.aiState.startsWith('telegraph')
                    ? '⚠ TELEGRAPHING'
                    : targetBeast.enraged
                    ? '🔥 ENRAGED'
                    : targetBeast.aiState.toUpperCase()}
                </span>
              </div>
            </div>

            <div className="w-full h-2.5 bg-black/80 rounded-full overflow-hidden border border-white/15">
              <div
                className="h-full bg-gradient-to-r from-red-700 via-orange-500 to-amber-400 transition-all duration-150"
                style={{
                  width: `${Math.max(0, Math.min(100, (targetBeast.hp / targetBeast.maxHp) * 100))}%`,
                }}
              />
            </div>

            <div className="flex items-center justify-between mt-1 text-[10px] text-zinc-400 font-mono">
              <span>Weak Points: Head / Wing / Core</span>
              <span className="tabular-nums">
                {Math.ceil(targetBeast.hp)} / {targetBeast.maxHp}
              </span>
            </div>
          </div>
        )}

        {/* Top-Right: Glassmorphic Utility Buttons (Beastopedia, Forge, Pause) */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            type="button"
            onClick={onOpenBeastopedia}
            className="px-3 py-1.5 bg-zinc-950/75 hover:bg-zinc-900/90 border border-white/15 rounded-lg text-xs font-bold text-sky-300 transition-all cursor-pointer shadow-lg"
          >
            3D Atlas & Mithril (B)
          </button>

          <button
            type="button"
            onClick={onOpenCrafting}
            className="px-3 py-1.5 bg-zinc-950/75 hover:bg-zinc-900/90 border border-white/15 rounded-lg text-xs font-bold text-amber-300 transition-all cursor-pointer shadow-lg"
          >
            Forge (Tab)
          </button>

          <button
            type="button"
            onClick={onPause}
            className="px-3 py-1.5 bg-zinc-950/75 hover:bg-zinc-900/90 border border-white/15 rounded-lg text-xs font-semibold text-zinc-200 transition-all cursor-pointer shadow-lg"
          >
            Menu (Esc)
          </button>
        </div>
      </div>

      {/* CENTER Reticle, Screen-Space Hit Markers & Contextual Prompts */}
      <div className="my-auto flex flex-col items-center justify-center pointer-events-none">
        <div className="relative w-7 h-7 flex items-center justify-center">
          <div className="w-1.5 h-1.5 rounded-full bg-sky-300 shadow-[0_0_8px_#38bdf8] opacity-85" />
          {hitMarker && (
            <>
              <span className="absolute w-5 h-0.5 bg-amber-300 rotate-45 shadow-[0_0_8px_#fbbf24]" />
              <span className="absolute w-5 h-0.5 bg-amber-300 -rotate-45 shadow-[0_0_8px_#fbbf24]" />
              <span
                className={`absolute -top-6 text-xs font-black font-mono tracking-wider drop-shadow ${
                  hitMarker.isWeakPoint || hitMarker.isCrit ? 'text-amber-300 scale-110' : 'text-red-400'
                }`}
              >
                -{Math.round(hitMarker.damage)}
                {hitMarker.isWeakPoint ? ' WEAK!' : hitMarker.isCrit ? ' CRIT!' : ''}
              </span>
            </>
          )}
        </div>

        {interactPrompt && (
          <button
            type="button"
            onClick={onInteract}
            className="mt-4 px-4 py-2 bg-zinc-950/85 hover:bg-zinc-900 border border-sky-400/50 rounded-xl text-xs font-bold text-sky-200 tracking-wide shadow-2xl pointer-events-auto animate-bounce cursor-pointer"
          >
            {interactPrompt}
          </button>
        )}

        {notification && (
          <div
            className={`mt-3 px-4 py-2 rounded-xl border text-xs font-bold tracking-wide shadow-2xl transition-all max-w-md text-center ${
              notification.type === 'loot'
                ? 'bg-emerald-950/85 border-emerald-500/50 text-emerald-200'
                : notification.type === 'danger'
                ? 'bg-red-950/85 border-red-500/50 text-red-200'
                : 'bg-zinc-950/85 border-white/20 text-amber-200'
            }`}
          >
            {notification.message}
          </div>
        )}
      </div>

      {/* BOTTOM BAR: Calibrated Joystick (Left) & Survival / Flight / Combat Controls (Right) */}
      <div className="flex items-end justify-between gap-4">
        {/* Bottom-Left: Touch Virtual Joystick */}
        <div className="flex items-center gap-3">
          <div
            ref={joyRef}
            onTouchStart={(e) => {
              e.stopPropagation();
              const t = e.changedTouches[0];
              joyTouchId.current = t.identifier;
              handleJoystickUpdate(t.clientX, t.clientY);
            }}
            onTouchMove={(e) => {
              e.stopPropagation();
              for (let i = 0; i < e.changedTouches.length; i++) {
                if (e.changedTouches[i].identifier === joyTouchId.current) {
                  handleJoystickUpdate(e.changedTouches[i].clientX, e.changedTouches[i].clientY);
                }
              }
            }}
            onTouchEnd={(e) => {
              e.stopPropagation();
              resetJoystick();
            }}
            onMouseDown={(e) => {
              handleJoystickUpdate(e.clientX, e.clientY);
              const onMove = (me: MouseEvent) => handleJoystickUpdate(me.clientX, me.clientY);
              const onUp = () => {
                resetJoystick();
                window.removeEventListener('mousemove', onMove);
                window.removeEventListener('mouseup', onUp);
              };
              window.addEventListener('mousemove', onMove);
              window.addEventListener('mouseup', onUp);
            }}
            className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-zinc-950/70 border border-white/20 flex items-center justify-center relative pointer-events-auto touch-none cursor-pointer shadow-2xl"
            title="Push Up = Move Forward, Push Down = Move Back, Left = Move Left, Right = Move Right"
          >
            <span className="absolute top-1.5 text-[8px] font-mono text-zinc-400 uppercase">FWD</span>
            <span className="absolute bottom-1.5 text-[8px] font-mono text-zinc-400 uppercase">BACK</span>
            <span className="absolute left-1.5 text-[8px] font-mono text-zinc-400 uppercase">L</span>
            <span className="absolute right-1.5 text-[8px] font-mono text-zinc-400 uppercase">R</span>
            <div
              className="w-10 h-10 rounded-full bg-sky-400/80 border border-white shadow-lg transition-transform duration-75"
              style={{
                transform: `translate(${joyKnob.x}px, ${joyKnob.y}px)`,
              }}
            />
          </div>

          <div className="hidden md:flex flex-col text-[11px] text-zinc-300 bg-zinc-950/75 border border-white/15 px-3 py-2 rounded-xl">
            <span className="text-sky-300 font-bold">Mithril Controls</span>
            <span>WASD Move · Space Jump / Fly Up</span>
            <span>V Flight Wings · Ctrl Descend · Shift Dodge</span>
            <span>Q Eat Food · C Drink Water · H Hatch Egg</span>
          </div>
        </div>

        {/* Bottom-Right: Survival Pouches, Jump/Fly, and Spear Combat Buttons */}
        <div className="flex flex-wrap items-center justify-end gap-2 pointer-events-auto max-w-xl">
          {/* Eat Ration (Q) */}
          <button
            type="button"
            onClick={onEatFood}
            className="px-3 py-2 rounded-xl bg-zinc-950/80 hover:bg-zinc-900 border border-amber-500/40 text-amber-200 text-xs font-bold flex flex-col items-center min-w-[66px] active:scale-95 transition-all cursor-pointer shadow-lg"
          >
            <span>🍖 Ration</span>
            <span className="text-[10px] font-mono text-amber-300">
              Q ({stats.foodRations}/{stats.maxFoodRations})
            </span>
          </button>

          {/* Drink Water (C) */}
          <button
            type="button"
            onClick={onDrinkWater}
            className="px-3 py-2 rounded-xl bg-zinc-950/80 hover:bg-zinc-900 border border-cyan-500/40 text-cyan-200 text-xs font-bold flex flex-col items-center min-w-[66px] active:scale-95 transition-all cursor-pointer shadow-lg"
          >
            <span>💧 Water</span>
            <span className="text-[10px] font-mono text-cyan-300">
              C ({stats.waterCanteens}/{stats.maxWaterCanteens})
            </span>
          </button>

          {/* Creature Egg (H) */}
          <button
            type="button"
            onClick={onConsumeEgg}
            className="px-3 py-2 rounded-xl bg-zinc-950/80 hover:bg-zinc-900 border border-purple-500/40 text-purple-200 text-xs font-bold flex flex-col items-center min-w-[66px] active:scale-95 transition-all cursor-pointer shadow-lg"
          >
            <span>🥚 Egg</span>
            <span className="text-[10px] font-mono text-purple-300">
              H ({stats.eggsCollected})
            </span>
          </button>

          {/* Snare Trap (R) */}
          <button
            type="button"
            onClick={onPlaceTrap}
            className="px-3 py-2 rounded-xl bg-zinc-950/80 hover:bg-zinc-900 border border-white/15 text-zinc-200 text-xs font-bold flex flex-col items-center min-w-[60px] active:scale-95 transition-all cursor-pointer shadow-lg"
          >
            <span>🪤 Trap</span>
            <span className="text-[10px] font-mono text-zinc-400">
              R ({stats.traps})
            </span>
          </button>

          {/* Hunter Focus (F) */}
          <button
            type="button"
            onClick={onToggleFocus}
            className={`px-3 py-2 rounded-xl border text-xs font-bold flex flex-col items-center min-w-[64px] active:scale-95 transition-all cursor-pointer shadow-lg ${
              focusVisionActive
                ? 'bg-sky-900/80 border-sky-400 text-sky-200'
                : 'bg-zinc-950/80 border-white/15 text-zinc-300'
            }`}
          >
            <span>👁 Focus</span>
            <span className="text-[10px] font-mono">F</span>
          </button>

          {/* Jump (Space) */}
          <button
            type="button"
            onClick={onJump}
            className={`px-3.5 py-2.5 rounded-xl border text-xs font-bold uppercase tracking-wider active:scale-95 transition-all cursor-pointer shadow-lg ${
              isAirborne
                ? 'bg-sky-800/80 border-sky-400 text-white'
                : 'bg-zinc-900/85 hover:bg-zinc-800 border-white/20 text-zinc-100'
            }`}
          >
            Jump (Space)
          </button>

          {/* Fly Wings Toggle (V) */}
          <button
            type="button"
            onClick={onToggleFlight}
            className={`px-3.5 py-2.5 rounded-xl border text-xs font-black uppercase tracking-wider active:scale-95 transition-all cursor-pointer shadow-lg ${
              isFlying
                ? 'bg-gradient-to-r from-sky-500 to-indigo-600 border-sky-300 text-white shadow-[0_0_20px_rgba(56,189,248,0.5)]'
                : 'bg-zinc-900/85 hover:bg-zinc-800 border-sky-500/40 text-sky-300'
            }`}
          >
            {isFlying ? '🦅 Land (V)' : '🦅 Fly (V)'}
          </button>

          {/* Dodge (Shift) */}
          <button
            type="button"
            onClick={onDodge}
            className="px-3.5 py-2.5 rounded-xl bg-zinc-900/85 hover:bg-zinc-800 border border-white/20 text-zinc-100 text-xs font-bold uppercase tracking-wider active:scale-95 transition-all cursor-pointer shadow-lg"
          >
            Dodge
          </button>

          {/* Spear Attack / Heavy Charge */}
          <button
            type="button"
            onMouseDown={onAttack}
            onMouseUp={onChargeRelease}
            onTouchStart={(e) => {
              e.stopPropagation();
              onAttack();
            }}
            onTouchEnd={(e) => {
              e.stopPropagation();
              onChargeRelease();
            }}
            className="px-5 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-red-600 hover:from-amber-400 hover:to-red-500 text-black font-black text-xs sm:text-sm uppercase tracking-wider shadow-xl border border-amber-300 active:scale-95 transition-all cursor-pointer"
          >
            ⚔ Strike
          </button>
        </div>
      </div>
    </div>
  );
};
