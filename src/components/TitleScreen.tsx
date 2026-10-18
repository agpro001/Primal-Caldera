/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from 'react';
import { sound } from '../game/audio/soundEngine.ts';

interface TitleScreenProps {
  onStart: () => void;
  onOpenSettings: () => void;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({ onStart, onOpenSettings }) => {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.code === 'Enter' || e.code === 'Space') {
        sound.triggerUserInteraction();
        onStart();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onStart]);

  return (
    <div className="fixed inset-0 z-30 flex flex-col justify-between p-6 sm:p-12 pointer-events-auto bg-gradient-to-t from-black/85 via-black/40 to-transparent">
      {/* Top Header / Spec Badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 px-3.5 py-1.5 bg-zinc-950/75 border border-white/15 rounded-full text-[11px] font-bold text-sky-300 uppercase tracking-widest shadow-xl">
          <span>Mithril Knight · Flying Dragons · Real Atmospheric Science</span>
        </div>

        <button
          type="button"
          onClick={onOpenSettings}
          className="px-4 py-1.5 bg-zinc-950/80 hover:bg-zinc-900 text-zinc-200 hover:text-white border border-white/15 text-xs font-semibold rounded-lg transition-all cursor-pointer shadow-lg"
        >
          Settings & Saves
        </button>
      </div>

      {/* Hero Centerpiece: Inline SVG Title Lockup */}
      <div className="max-w-2xl my-auto text-left">
        <div className="mb-4">
          <svg className="w-full max-w-lg h-24 sm:h-28" viewBox="0 0 520 110" fill="none">
            <path d="M15 65 L45 25 L55 35 L30 85 Z" fill="#38bdf8" opacity="0.9" />
            <path d="M505 65 L475 25 L465 35 L490 85 Z" fill="#38bdf8" opacity="0.9" />
            <text
              x="260"
              y="58"
              textAnchor="middle"
              className="font-black text-4xl sm:text-5xl tracking-widest fill-white"
              style={{
                fontFamily: 'Cinzel, serif',
                paintOrder: 'stroke fill',
                stroke: '#090d16',
                strokeWidth: '8px',
              }}
            >
              PRIMAL CALDERA
            </text>
            <text
              x="260"
              y="94"
              textAnchor="middle"
              className="text-xs sm:text-sm font-bold tracking-[0.38em] fill-sky-300 uppercase"
              style={{ fontFamily: 'Cinzel, serif' }}
            >
              Mithril Vanguard & Sky-Wyvern Odyssey
            </text>
          </svg>
        </div>

        <p className="text-sm sm:text-base text-zinc-200 max-w-xl leading-relaxed mb-8">
          Don the Mastercraft Mithril Armor, deploy Aetherial Flight Wings across thermal updrafts, raid wyvern & creature egg nests, manage caloric food & glacial hydration under real atmospheric physics, and conquer multi-stage island operations.
        </p>

        {/* Primary Start CTAs */}
        <div className="flex flex-wrap items-center gap-4">
          <button
            type="button"
            data-start="true"
            onClick={() => {
              sound.triggerUserInteraction();
              onStart();
            }}
            className="px-8 py-4 bg-gradient-to-r from-sky-500 via-indigo-500 to-amber-500 hover:from-sky-400 hover:to-amber-400 active:scale-95 text-black font-black text-base sm:text-lg tracking-wider uppercase rounded-xl shadow-[0_0_35px_rgba(56,189,248,0.45)] border border-sky-200 transition-all flex items-center gap-3 cursor-pointer"
          >
            <svg className="w-5 h-5 fill-black" viewBox="0 0 24 24">
              <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
            <span>Launch Odyssey (Space / Enter)</span>
          </button>
        </div>
      </div>

      {/* Bottom Safe Margin Control Hint Line */}
      <footer className="text-center pt-4 border-t border-white/10">
        <p className="text-xs text-zinc-300 font-medium tracking-wider">
          WASD Move · Space Jump / Ascend · V Toggle Flight Wings · Left Click Spear Strike · Q Eat Ration · C Drink Water · H Hatch Egg · B 3D Mithril & Dragon Atlas
        </p>
      </footer>
    </div>
  );
};
