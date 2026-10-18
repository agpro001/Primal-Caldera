/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

interface VictoryDefeatModalProps {
  type: 'victory' | 'defeat';
  stats: {
    time?: number;
    beastsSlain: number;
    materialsGathered?: number;
  };
  onAction: () => void;
}

export const VictoryDefeatModal: React.FC<VictoryDefeatModalProps> = ({
  type,
  stats,
  onAction,
}) => {
  const isVictory = type === 'victory';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 pointer-events-auto">
      <div className="bg-[#141110] border border-[#443831] rounded-lg max-w-md w-full p-6 text-center shadow-2xl">
        {/* Emblem */}
        <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center border-2 border-amber-500/60 bg-[#241c18]">
          <span className="text-3xl">{isVictory ? '🔥' : '💀'}</span>
        </div>

        {/* Title */}
        <h2
          className={`text-2xl font-black uppercase tracking-widest font-serif mb-2 ${
            isVictory ? 'text-amber-400' : 'text-red-500'
          }`}
        >
          {isVictory ? 'Signal Beacon Ignited!' : 'The Island Claimed You'}
        </h2>

        <p className="text-xs text-zinc-300 leading-relaxed mb-6">
          {isVictory
            ? 'The Caldera Titan has collapsed into the molten crags. The ancient mirrors align, and the great signal fire erupts toward the stars. Your tribe sees the light—survival is won!'
            : 'A colossal strike crushed your bones against the volcanic basalt. Gather your wits, study the beast’s telegraphs, and strike when its guard drops.'}
        </p>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="p-3 bg-[#1e1916] border border-[#3b3028] rounded">
            <span className="text-[10px] uppercase font-bold text-zinc-500 block">Colossal Beasts Slain</span>
            <span className="text-xl font-mono font-bold text-amber-300 tabular-nums">
              {stats.beastsSlain} / 4
            </span>
          </div>

          <div className="p-3 bg-[#1e1916] border border-[#3b3028] rounded">
            <span className="text-[10px] uppercase font-bold text-zinc-500 block">
              {isVictory ? 'Expedition Time' : 'Materials Harvested'}
            </span>
            <span className="text-xl font-mono font-bold text-zinc-200 tabular-nums">
              {isVictory ? `${stats.time || 0}s` : stats.materialsGathered || 0}
            </span>
          </div>
        </div>

        {/* Primary CTA */}
        <button
          type="button"
          data-start="true"
          onClick={onAction}
          className={`w-full py-3.5 font-black uppercase tracking-wider rounded shadow-xl active:scale-95 transition-all text-sm cursor-pointer ${
            isVictory
              ? 'bg-gradient-to-r from-amber-500 to-red-600 text-black hover:from-amber-400 hover:to-red-500'
              : 'bg-red-600 hover:bg-red-500 text-white'
          }`}
        >
          {isVictory ? 'Continue Hunting & Free Roam' : 'Rise at Campfire Workbench'}
        </button>
      </div>
    </div>
  );
};
