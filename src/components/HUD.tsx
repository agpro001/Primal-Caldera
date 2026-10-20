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
  PlayableCharacterId,
} from '../types/game.ts';
import {
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
  activeCharacterId?: PlayableCharacterId;
  timeOfDayHours?: number;
  dayPhase?: 'dawn' | 'day' | 'dusk' | 'night';
  onSwapCharacter?: (charId: PlayableCharacterId) => void;
  onToggleDayNight?: () => void;
  onStrikeGesture?: (gesture: 'tap' | 'swipe_up' | 'swipe_down') => void;
  onTriggerSkill?: () => void;
  onToggleSpacecraft?: () => void;
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

const HERO_ROSTER_META: {
  id: PlayableCharacterId;
  key: string;
  shortName: string;
  role: string;
  accent: string;
}[] = [
  {
    id: 'demon_hunter',
    key: '1',
    shortName: 'Demon Hunter',
    role: 'Glaive & Vault',
    accent: 'border-purple-400/70 bg-purple-950/80 text-purple-200',
  },
  {
    id: 'swat_operator',
    key: '2',
    shortName: 'S.W.A.T. Op',
    role: 'Rocket Gunner',
    accent: 'border-sky-400/70 bg-sky-950/80 text-sky-200',
  },
  {
    id: 'bulky_knight',
    key: '3',
    shortName: 'Bulky Knight',
    role: 'Magnet Weapon',
    accent: 'border-amber-400/70 bg-amber-950/80 text-amber-200',
  },
];

export const HUD: React.FC<HUDProps> = ({
  stats,
  targetBeast,
  equippedWeapon,
  equippedArmor,
  isFlying,
  isAirborne,
  interactPrompt,
  notification,
  focusVisionActive,
  hitMarker,
  activeCharacterId = 'demon_hunter',
  timeOfDayHours = 10.5,
  dayPhase = 'day',
  onSwapCharacter,
  onToggleDayNight,
  onStrikeGesture,
  onTriggerSkill,
  onToggleSpacecraft,
  onAttack,
  onChargeRelease,
  onJump,
  onToggleFlight,
  onDodge,
  onEatFood,
  onDrinkWater,
  onConsumeEgg,
  onPlaceTrap,
  onToggleFocus,
  onInteract,
  onOpenCrafting,
  onOpenBeastopedia,
  onPause,
  onVirtualMove,
  onLookDelta,
}) => {
  const weapon = WEAPON_REGISTRY[equippedWeapon];
  const armor = ARMOR_REGISTRY[equippedArmor];

  const hpPct = Math.max(0, Math.min(100, (stats.hp / stats.maxHp) * 100));
  const foodPct = Math.max(0, Math.min(100, (stats.food / stats.maxFood) * 100));
  const waterPct = Math.max(0, Math.min(100, (stats.water / stats.maxWater) * 100));

  const isNight = dayPhase === 'night' || dayPhase === 'dusk';
  const hoursInt = Math.floor(timeOfDayHours) % 24;
  const minsInt = Math.floor((timeOfDayHours - Math.floor(timeOfDayHours)) * 60);
  const formattedClock = `${String(hoursInt).padStart(2, '0')}:${String(minsInt).padStart(2, '0')}`;

  // Virtual Joystick State
  const joyRef = useRef<HTMLDivElement>(null);
  const [joyKnob, setJoyKnob] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const joyTouchId = useRef<number | null>(null);

  // Touch Camera Drag State
  const lookTouchId = useRef<number | null>(null);
  const lastLookPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Multi-Gesture STRIKE Button State (Tap = Quick Strike, Hold = Heavy, Swipe Up = Vault/Glide, Swipe Down = Dash/Roll)
  const strikeGestureStart = useRef<{ x: number; y: number; time: number } | null>(null);

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
      {/* TOP BAR: Compact Survival Telemetry, GTA V Character Wheel & Day-Night Cycle */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        {/* Top-Left: Survival Metabolism + Character Roster Wheel */}
        <div className="flex flex-col gap-2 max-w-sm w-full sm:w-auto">
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
                {stats.isPilotingSpaceFighter && (
                  <span className="px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider bg-cyan-500/25 text-cyan-200 border border-cyan-400/50 rounded shrink-0">
                    6-DOF JET
                  </span>
                )}
                {stats.isMountedOnBeast && (
                  <span className="px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider bg-emerald-500/25 text-emerald-200 border border-emerald-400/50 rounded shrink-0">
                    DINO MOUNT
                  </span>
                )}
              </div>
              <span className="text-xs font-mono font-bold text-white tabular-nums shrink-0">
                {Math.ceil(stats.hp)} / {stats.maxHp} HP
              </span>
            </div>

            {/* HP Bar */}
            <div className="w-full sm:w-64 h-2.5 bg-black/70 rounded-full overflow-hidden border border-white/10 mb-2">
              <div
                className="h-full bg-gradient-to-r from-rose-600 via-red-500 to-amber-400 transition-all duration-150"
                style={{ width: `${hpPct}%` }}
              />
            </div>

            {/* Food & Water Compact Bars */}
            <div className="grid grid-cols-2 gap-2 mb-2">
              <div>
                <div className="flex items-center justify-between text-[9px] font-mono text-amber-200 mb-0.5">
                  <span>FOOD</span>
                  <span>{Math.round(stats.food)} kcal</span>
                </div>
                <div className="w-full h-1.5 bg-black/70 rounded-full overflow-hidden border border-white/10">
                  <div
                    className="h-full bg-gradient-to-r from-amber-600 to-yellow-400 transition-all duration-150"
                    style={{ width: `${foodPct}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between text-[9px] font-mono text-cyan-200 mb-0.5">
                  <span>WATER</span>
                  <span>{Math.round(stats.water)} mL</span>
                </div>
                <div className="w-full h-1.5 bg-black/70 rounded-full overflow-hidden border border-white/10">
                  <div
                    className="h-full bg-gradient-to-r from-sky-600 to-cyan-300 transition-all duration-150"
                    style={{ width: `${waterPct}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Equipped Gear & Day-Night Status Line */}
            <div className="pt-1.5 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-[10px] text-zinc-300">
              <span className="truncate font-medium text-sky-200">{weapon.name}</span>
              <div className="flex items-center gap-1.5 font-mono">
                <span className="text-amber-300">🥚 {stats.eggsCollected}</span>
                <span className="text-zinc-600">|</span>
                <span className="text-emerald-300">{armor.defense} DEF</span>
              </div>
            </div>

            {/* GTA V Playable Character Swap Bar ([1] Demon Hunter, [2] S.W.A.T., [3] Knight) */}
            <div className="mt-2 pt-2 border-t border-white/10 flex items-center gap-1.5">
              {HERO_ROSTER_META.map((hero) => {
                const active = activeCharacterId === hero.id;
                return (
                  <button
                    key={hero.id}
                    type="button"
                    onClick={() => onSwapCharacter?.(hero.id)}
                    className={`flex-1 px-2 py-1 rounded-lg border text-[10px] font-bold transition-all cursor-pointer flex flex-col items-start ${
                      active
                        ? `${hero.accent} shadow-md scale-[1.02]`
                        : 'bg-black/50 border-white/10 text-zinc-400 hover:text-zinc-200'
                    }`}
                    title={`Press [${hero.key}] for GTA V Sky-Camera Swap to ${hero.shortName}`}
                  >
                    <span className="font-mono text-[9px] opacity-80">[{hero.key}] {hero.role}</span>
                    <span className="truncate w-full text-left">{hero.shortName}</span>
                  </button>
                );
              })}
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

        {/* Top-Right: Day-Night Cycle Indicator & Utility Buttons (3D Atlas, Forge, Menu) */}
        <div className="flex flex-wrap items-center gap-2 pointer-events-auto">
          <button
            type="button"
            onClick={onToggleDayNight}
            className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer shadow-lg flex items-center gap-1.5 ${
              isNight
                ? 'bg-indigo-950/85 border-indigo-400/60 text-indigo-200'
                : 'bg-amber-950/80 border-amber-400/50 text-amber-200'
            }`}
            title="Press [N] to shift Day/Night cycle (Night increases beast aggression & unlocks nocturnal Glow-Moss / Magma Cores)"
          >
            <span>{isNight ? '🌙 Night' : '☀ Day'}</span>
            <span className="font-mono text-[10px] opacity-90">{formattedClock} (N)</span>
          </button>

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

      {/* CENTER Reticle, Screen-Space Hit Markers, Focus Trail Badge & Contextual Prompts */}
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

        {focusVisionActive && (
          <div className="mt-2 px-3 py-1 rounded-full bg-sky-950/85 border border-sky-400/60 text-[10px] font-mono font-bold text-sky-200 tracking-wider uppercase shadow-lg">
            👁 Focus Vision Active · 3D Beast Footprint Trail Illuminated
          </div>
        )}

        {interactPrompt && (
          <button
            type="button"
            onClick={onInteract}
            className="mt-3 px-4 py-2 bg-zinc-950/85 hover:bg-zinc-900 border border-sky-400/50 rounded-xl text-xs font-bold text-sky-200 tracking-wide shadow-2xl pointer-events-auto animate-bounce cursor-pointer"
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

      {/* BOTTOM BAR: Calibrated Joystick (Left) & Survival / Flight / Multi-Gesture Combat Controls (Right) */}
      <div className="flex items-end justify-between gap-4">
        {/* Bottom-Left: Touch Virtual Joystick */}
        <div className="flex items-center gap-3">
          <div
            ref={joyRef}
            onPointerDown={(e) => {
              e.stopPropagation();
              joyTouchId.current = e.pointerId;
              e.currentTarget.setPointerCapture(e.pointerId);
              handleJoystickUpdate(e.clientX, e.clientY);
            }}
            onPointerMove={(e) => {
              e.stopPropagation();
              if (e.pointerId === joyTouchId.current) {
                handleJoystickUpdate(e.clientX, e.clientY);
              }
            }}
            onPointerUp={(e) => {
              e.stopPropagation();
              if (e.pointerId === joyTouchId.current) {
                resetJoystick();
              }
            }}
            onPointerCancel={(e) => {
              e.stopPropagation();
              if (e.pointerId === joyTouchId.current) {
                resetJoystick();
              }
            }}
            className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-zinc-950/70 border border-white/20 flex items-center justify-center relative pointer-events-auto touch-none cursor-pointer shadow-2xl"
            title="Push Up = Move / Accelerate, Push Down = Back / Brake, Left = Turn Left, Right = Turn Right"
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
            <span className="text-sky-300 font-bold">Mithril & Roster Controls</span>
            <span>WASD Move/Throttle · 1/2/3 Swap Hero · X Special Skill</span>
            <span>G Spacecraft · V Flight · F Focus Trail · T Mount Dino</span>
            <span>Q Ration · C Water · H Egg · Shift Dodge/Nitro Boost</span>
          </div>
        </div>

        {/* Bottom-Right: Survival Pouches, Jump/Fly, Spacecraft, Special Skill, and Multi-Gesture Strike Button */}
        <div className="flex flex-wrap items-center justify-end gap-2 pointer-events-auto max-w-2xl">
          {/* Eat Ration (Q) */}
          <button
            type="button"
            onClick={onEatFood}
            className="px-3 py-2 rounded-xl bg-zinc-950/80 hover:bg-zinc-900 border border-amber-500/40 text-amber-200 text-xs font-bold flex flex-col items-center min-w-[64px] active:scale-95 transition-all cursor-pointer shadow-lg"
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
            className="px-3 py-2 rounded-xl bg-zinc-950/80 hover:bg-zinc-900 border border-cyan-500/40 text-cyan-200 text-xs font-bold flex flex-col items-center min-w-[64px] active:scale-95 transition-all cursor-pointer shadow-lg"
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
            className="px-3 py-2 rounded-xl bg-zinc-950/80 hover:bg-zinc-900 border border-purple-500/40 text-purple-200 text-xs font-bold flex flex-col items-center min-w-[64px] active:scale-95 transition-all cursor-pointer shadow-lg"
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
            className="px-3 py-2 rounded-xl bg-zinc-950/80 hover:bg-zinc-900 border border-white/15 text-zinc-200 text-xs font-bold flex flex-col items-center min-w-[58px] active:scale-95 transition-all cursor-pointer shadow-lg"
          >
            <span>🪤 Trap</span>
            <span className="text-[10px] font-mono text-zinc-400">
              R ({stats.traps})
            </span>
          </button>

          {/* Hunter Focus & 3D Footprint Tracking Trail (F) */}
          <button
            type="button"
            onClick={onToggleFocus}
            className={`px-3 py-2 rounded-xl border text-xs font-bold flex flex-col items-center min-w-[60px] active:scale-95 transition-all cursor-pointer shadow-lg ${
              focusVisionActive
                ? 'bg-sky-900/85 border-sky-400 text-sky-200 shadow-[0_0_16px_rgba(56,189,248,0.45)]'
                : 'bg-zinc-950/80 border-white/15 text-zinc-300'
            }`}
          >
            <span>👁 Focus</span>
            <span className="text-[10px] font-mono">F</span>
          </button>

          {/* Spacecraft Board / Disembark (G) */}
          {onToggleSpacecraft && (
            <button
              type="button"
              onClick={onToggleSpacecraft}
              className={`px-3 py-2 rounded-xl border text-xs font-bold flex flex-col items-center min-w-[68px] active:scale-95 transition-all cursor-pointer shadow-lg ${
                stats.isPilotingSpaceFighter
                  ? 'bg-cyan-900/90 border-cyan-300 text-cyan-100 shadow-[0_0_18px_rgba(34,211,238,0.55)]'
                  : 'bg-zinc-950/80 border-cyan-500/40 text-cyan-300'
              }`}
              title="Summon & Pilot High-Speed Racing Spacecraft (WASD Throttle, Shift Nitro Boost, Space/C Climb/Dive)"
            >
              <span>{stats.isPilotingSpaceFighter ? '🛸 Land Jet' : '🚀 Spacecraft'}</span>
              <span className="text-[10px] font-mono">G ({stats.airSpeed || 0}m/s)</span>
            </button>
          )}

          {/* Jump (Space) */}
          <button
            type="button"
            onClick={onJump}
            className={`px-3 py-2.5 rounded-xl border text-xs font-bold uppercase tracking-wider active:scale-95 transition-all cursor-pointer shadow-lg ${
              isAirborne
                ? 'bg-sky-800/80 border-sky-400 text-white'
                : 'bg-zinc-900/85 hover:bg-zinc-800 border-white/20 text-zinc-100'
            }`}
          >
            Jump
          </button>

          {/* Fly Wings Toggle (V) */}
          <button
            type="button"
            onClick={onToggleFlight}
            className={`px-3 py-2.5 rounded-xl border text-xs font-black uppercase tracking-wider active:scale-95 transition-all cursor-pointer shadow-lg ${
              isFlying
                ? 'bg-gradient-to-r from-sky-500 to-indigo-600 border-sky-300 text-white shadow-[0_0_20px_rgba(56,189,248,0.5)]'
                : 'bg-zinc-900/85 hover:bg-zinc-800 border-sky-500/40 text-sky-300'
            }`}
          >
            {isFlying ? '🦅 Land' : '🦅 Fly'}
          </button>

          {/* Dodge / Nitro Boost (Shift) */}
          <button
            type="button"
            onClick={onDodge}
            className="px-3 py-2.5 rounded-xl bg-zinc-900/85 hover:bg-zinc-800 border border-white/20 text-zinc-100 text-xs font-bold uppercase tracking-wider active:scale-95 transition-all cursor-pointer shadow-lg"
          >
            {stats.isPilotingSpaceFighter ? '🔥 Boost' : 'Dodge'}
          </button>

          {/* Character Unique Special Skill Button (X) */}
          {onTriggerSkill && (
            <button
              type="button"
              onClick={onTriggerSkill}
              className="px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 text-white font-black text-xs uppercase tracking-wider shadow-xl border border-cyan-300/70 active:scale-95 transition-all cursor-pointer"
              title="Character Special Power (X): S.W.A.T. Homing Rocket Salvo | Bulky Knight Magnetic Weapon Pull | Demon Hunter Glaive Vortex"
            >
              {activeCharacterId === 'swat_operator'
                ? '🚀 Rockets (X)'
                : activeCharacterId === 'bulky_knight'
                ? '🧲 Magnet Pull (X)'
                : '✨ Vortex (X)'}
            </button>
          )}

          {/* Multi-Gesture STRIKE Button */}
          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              strikeGestureStart.current = { x: e.clientX, y: e.clientY, time: performance.now() };
              onAttack();
            }}
            onPointerUp={(e) => {
              e.stopPropagation();
              const start = strikeGestureStart.current;
              strikeGestureStart.current = null;
              if (start) {
                const dy = e.clientY - start.y;
                if (dy < -24) {
                  if (onStrikeGesture) onStrikeGesture('swipe_up');
                  else onJump();
                  return;
                }
                if (dy > 24) {
                  if (onStrikeGesture) onStrikeGesture('swipe_down');
                  else onDodge();
                  return;
                }
              }
              onChargeRelease();
            }}
            className="px-4 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-red-600 hover:from-amber-400 hover:to-red-500 text-black font-black text-xs sm:text-sm uppercase tracking-wider shadow-xl border border-amber-300 active:scale-95 transition-all cursor-pointer touch-none"
            title="Tap: Shoot Gun / Attract & Strike | Hold: Heavy Cleave | Swipe Up: Vault / Salvo | Swipe Down: Dash"
          >
            {stats.isPilotingSpaceFighter
              ? '🔥 Plasma'
              : activeCharacterId === 'swat_operator'
              ? '🔫 Shoot Gun'
              : activeCharacterId === 'bulky_knight'
              ? '⚔ Attract & Cleave'
              : '⚔ Strike'}
          </button>
        </div>
      </div>
    </div>
  );
};
