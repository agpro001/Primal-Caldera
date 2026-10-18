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
        <div className="flex items-center gap-2 px-3 py-1 bg-[#1a1412]/80 border border-[#443831] rounded text-[11px] font-bold text-amber-400 uppercase tracking-widest">
          <span>Prehistoric Volcanic Action RPG</span>
          <span className="text-zinc-600">·</span>
          <span>Version 1.0</span>
        </div>

        <button
          type="button"
          onClick={onOpenSettings}
          className="px-4 py-1.5 bg-[#1a1716]/90 hover:bg-[#2c2623] text-zinc-300 hover:text-white border border-[#443831] text-xs font-semibold rounded transition-all"
        >
          Settings & Saves
        </button>
      </div>

      {/* Hero Centerpiece: Inline SVG Title Lockup */}
      <div className="max-w-2xl my-auto text-left">
        {/* Bespoke Prehistoric Crest / Title Lockup */}
        <div className="mb-4">
          <svg className="w-full max-w-lg h-24 sm:h-28" viewBox="0 0 520 110" fill="none">
            {/* Primal Bone & Fang Emblems */}
            <path
              d="M15 65 L45 25 L55 35 L30 85 Z"
              fill="#d97706"
              opacity="0.9"
            />
            <path
              d="M505 65 L475 25 L465 35 L490 85 Z"
              fill="#d97706"
              opacity="0.9"
            />
            {/* Title Text with Prehistoric Styling */}
            <text
              x="260"
              y="58"
              textAnchor="middle"
              className="font-black text-4xl sm:text-5xl tracking-widest fill-white"
              style={{
                fontFamily: 'Cinzel, serif',
                paintOrder: 'stroke fill',
                stroke: '#18120e',
                strokeWidth: '8px',
              }}
            >
              PRIMAL CALDERA
            </text>
            <text
              x="260"
              y="94"
              textAnchor="middle"
              className="text-xs sm:text-sm font-bold tracking-[0.45em] fill-amber-400 uppercase"
              style={{ fontFamily: 'Cinzel, serif' }}
            >
              Colossal Beast Hunter
            </text>
          </svg>
        </div>

        <p className="text-sm sm:text-base text-zinc-300 max-w-xl leading-relaxed mb-8">
          Stalk colossal beasts across an untamed volcanic island. Read every twitch, roar, and telegraphed charge.
          Dodge at the last instant, harvest obsidian and bone at your campfire workbench, and climb to the island’s ancient signal tower.
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
            className="px-8 py-4 bg-gradient-to-r from-amber-500 via-amber-600 to-red-600 hover:from-amber-400 hover:to-red-500 active:scale-95 text-black font-black text-base sm:text-lg tracking-wider uppercase rounded shadow-[0_0_35px_rgba(245,158,11,0.4)] border border-amber-300 transition-all flex items-center gap-3 cursor-pointer"
          >
            <svg className="w-5 h-5 fill-black" viewBox="0 0 24 24">
              <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
            <span>Begin Hunt (Space / Enter)</span>
          </button>
        </div>
      </div>

      {/* Bottom Safe Margin Control Hint Line */}
      <footer className="text-center pt-4 border-t border-white/10">
        <p className="text-xs text-zinc-400 font-medium tracking-wider">
          WASD Move · Left Click Spear Strike · Right Click Hold Charge · Space Dodge · F Hunter Focus · E Interact · Q Heal · Esc Pause
        </p>
      </footer>
    </div>
  );
};
