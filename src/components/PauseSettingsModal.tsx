/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import type { GameSettings, SaveData } from '../types/game.ts';
import { exportSaveToJSON, importSaveFromJSON } from '../game/storage/saveSystem.ts';
import { sound } from '../game/audio/soundEngine.ts';

interface PauseSettingsModalProps {
  settings: GameSettings;
  currentSave: SaveData;
  onResume: () => void;
  onRestart: () => void;
  onTitle: () => void;
  onUpdateSettings: (newSettings: GameSettings) => void;
  onImportSave: (save: SaveData) => void;
}

export const PauseSettingsModal: React.FC<PauseSettingsModalProps> = ({
  settings,
  currentSave,
  onResume,
  onRestart,
  onTitle,
  onUpdateSettings,
  onImportSave,
}) => {
  const [tab, setTab] = useState<'pause' | 'settings' | 'save'>('pause');
  const [copied, setCopied] = useState(false);
  const [importJson, setImportJson] = useState('');
  const [importError, setImportError] = useState<string | null>(null);

  const handleSensitivityChange = (val: number, isTouch: boolean) => {
    const updated = {
      ...settings,
      [isTouch ? 'touchSensitivity' : 'mouseSensitivity']: val,
    };
    onUpdateSettings(updated);
  };

  const handleVolumeChange = (val: number, type: 'master' | 'sfx' | 'music') => {
    const updated = {
      ...settings,
      [`${type}Volume`]: val,
    };
    onUpdateSettings(updated);
    sound.setVolumes(updated.masterVolume, updated.sfxVolume, updated.musicVolume);
  };

  const handleDifficulty = (diff: 'story' | 'hunter' | 'savage') => {
    onUpdateSettings({ ...settings, difficulty: diff });
  };

  const handleCopySave = () => {
    const json = exportSaveToJSON(currentSave);
    navigator.clipboard?.writeText(json);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDoImport = () => {
    const parsed = importSaveFromJSON(importJson);
    if (parsed) {
      onImportSave(parsed);
      setImportError(null);
    } else {
      setImportError('Invalid save JSON structure.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 pointer-events-auto">
      <div className="bg-[#151211] border border-[#443831] rounded-lg max-w-lg w-full p-6 shadow-2xl text-left">
        {/* Navigation / Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#2e2621] mb-5">
          <h2 className="text-lg font-bold text-amber-300 font-serif">
            {tab === 'pause' ? 'Hunt Paused' : tab === 'settings' ? 'Settings & Controls' : 'Cross-Platform Cloud Save'}
          </h2>
          <div className="flex gap-1 text-xs">
            <button
              type="button"
              onClick={() => setTab('pause')}
              className={`px-3 py-1 rounded font-bold ${
                tab === 'pause' ? 'bg-[#2b221d] text-amber-300' : 'text-zinc-400 hover:text-white'
              }`}
            >
              Menu
            </button>
            <button
              type="button"
              onClick={() => setTab('settings')}
              className={`px-3 py-1 rounded font-bold ${
                tab === 'settings' ? 'bg-[#2b221d] text-amber-300' : 'text-zinc-400 hover:text-white'
              }`}
            >
              Settings
            </button>
            <button
              type="button"
              onClick={() => setTab('save')}
              className={`px-3 py-1 rounded font-bold ${
                tab === 'save' ? 'bg-[#2b221d] text-amber-300' : 'text-zinc-400 hover:text-white'
              }`}
            >
              Saves
            </button>
          </div>
        </div>

        {/* Tab 1: Pause Action CTAs */}
        {tab === 'pause' && (
          <div className="space-y-3">
            <button
              type="button"
              onClick={onResume}
              className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-black font-extrabold uppercase tracking-wider rounded shadow transition-all active:scale-95 cursor-pointer text-sm"
            >
              Resume Hunt (Esc)
            </button>

            <button
              type="button"
              onClick={() => setTab('settings')}
              className="w-full py-2.5 bg-[#231c19] hover:bg-[#332a25] text-zinc-200 font-bold rounded border border-[#3b3028] transition-all text-sm"
            >
              Adjust Sensitivity & Audio
            </button>

            <button
              type="button"
              onClick={onRestart}
              className="w-full py-2.5 bg-[#231c19] hover:bg-[#332a25] text-amber-400 font-bold rounded border border-[#3b3028] transition-all text-sm"
            >
              Restart Hunt at Camp
            </button>

            <button
              type="button"
              onClick={onTitle}
              className="w-full py-2.5 bg-[#201514] hover:bg-[#2d1b1a] text-red-300 font-bold rounded border border-red-950 transition-all text-sm"
            >
              Exit to Title Screen
            </button>
          </div>
        )}

        {/* Tab 2: Settings */}
        {tab === 'settings' && (
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
            {/* Sensitivity */}
            <div>
              <div className="flex justify-between text-xs font-bold text-zinc-300 mb-1">
                <span>Mouse Camera Sensitivity</span>
                <span className="font-mono text-amber-400">{settings.mouseSensitivity.toFixed(1)}x</span>
              </div>
              <input
                type="range"
                min="0.4"
                max="3.0"
                step="0.1"
                value={settings.mouseSensitivity}
                onChange={(e) => handleSensitivityChange(parseFloat(e.target.value), false)}
                className="w-full accent-amber-500"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs font-bold text-zinc-300 mb-1">
                <span>Touch Camera Sensitivity</span>
                <span className="font-mono text-amber-400">{settings.touchSensitivity.toFixed(1)}x</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="3.5"
                step="0.1"
                value={settings.touchSensitivity}
                onChange={(e) => handleSensitivityChange(parseFloat(e.target.value), true)}
                className="w-full accent-amber-500"
              />
            </div>

            {/* Audio Sliders */}
            <div>
              <div className="flex justify-between text-xs font-bold text-zinc-300 mb-1">
                <span>SFX Volume</span>
                <span className="font-mono text-amber-400">{Math.round(settings.sfxVolume * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={settings.sfxVolume}
                onChange={(e) => handleVolumeChange(parseFloat(e.target.value), 'sfx')}
                className="w-full accent-amber-500"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs font-bold text-zinc-300 mb-1">
                <span>Music & Atmosphere Volume</span>
                <span className="font-mono text-amber-400">{Math.round(settings.musicVolume * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={settings.musicVolume}
                onChange={(e) => handleVolumeChange(parseFloat(e.target.value), 'music')}
                className="w-full accent-amber-500"
              />
            </div>

            {/* Difficulty Knob */}
            <div>
              <span className="text-xs font-bold text-zinc-300 block mb-1.5">Hunt Difficulty:</span>
              <div className="grid grid-cols-3 gap-2">
                {(['story', 'hunter', 'savage'] as const).map((diff) => (
                  <button
                    key={diff}
                    type="button"
                    onClick={() => handleDifficulty(diff)}
                    className={`py-1.5 rounded text-xs font-bold uppercase transition-all ${
                      settings.difficulty === diff
                        ? 'bg-amber-600 text-black'
                        : 'bg-[#211b18] text-zinc-400 hover:text-zinc-200 border border-[#3b3028]'
                    }`}
                  >
                    {diff}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setTab('pause')}
              className="w-full mt-4 py-2 bg-[#2d2420] text-zinc-200 text-xs font-bold rounded"
            >
              Back to Menu
            </button>
          </div>
        )}

        {/* Tab 3: Cloud & Local Saves */}
        {tab === 'save' && (
          <div className="space-y-4 text-xs">
            <p className="text-zinc-400 leading-relaxed">
              Export your save JSON to transfer progress between desktop and mobile devices, or paste a backup below.
            </p>

            <button
              type="button"
              onClick={handleCopySave}
              className="w-full py-2.5 bg-amber-600 hover:bg-amber-500 text-black font-bold uppercase tracking-wider rounded transition-all"
            >
              {copied ? '✓ Save JSON Copied!' : 'Copy Current Save Data JSON'}
            </button>

            <div>
              <label className="font-bold text-zinc-300 block mb-1">Import Save JSON:</label>
              <textarea
                value={importJson}
                onChange={(e) => setImportJson(e.target.value)}
                placeholder="Paste save JSON here..."
                rows={3}
                className="w-full p-2 bg-[#120f0e] border border-[#3a3028] text-zinc-200 rounded font-mono text-[11px] outline-none"
              />
              {importError && <p className="text-red-400 text-[11px] mt-1">{importError}</p>}
              <button
                type="button"
                onClick={handleDoImport}
                disabled={!importJson.trim()}
                className="mt-2 px-4 py-1.5 bg-[#2d2420] hover:bg-[#3d322b] text-amber-300 font-bold rounded disabled:opacity-50"
              >
                Restore Save Progress
              </button>
            </div>

            <button
              type="button"
              onClick={() => setTab('pause')}
              className="w-full mt-3 py-2 bg-[#2d2420] text-zinc-200 text-xs font-bold rounded"
            >
              Back to Menu
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
