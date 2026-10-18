/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  SaveData,
  GameSettings,
} from '../../types/game.ts';
import {
  DEFAULT_PLAYER_STATS,
  DEFAULT_SETTINGS,
} from '../logic/rules.ts';

const SAVE_STORAGE_KEY = 'primal_caldera_save_data_v1';
const SETTINGS_STORAGE_KEY = 'primal_caldera_settings_v1';

export function getInitialSaveData(): SaveData {
  return {
    version: 1,
    timestamp: Date.now(),
    playerName: 'Koa',
    biome: 'jungle',
    playerPos: { x: 0, y: 1.0, z: 28 }, // Campfire haven
    playerStats: { ...DEFAULT_PLAYER_STATS },
    inventory: {
      materials: {
        beast_bone: 3,
        raptor_claw: 1,
        sun_herb: 4,
        volcanic_resin: 2,
        obsidian_shard: 1,
      },
      weapons: ['flint_spear'],
      equippedWeapon: 'flint_spear',
      armors: ['scavenger_rags'],
      equippedArmor: 'scavenger_rags',
      tools: ['bone_knife'],
    },
    beastsHunted: [],
    currentQuestIndex: 0,
    signalTowerProgress: 0,
    beaconLit: false,
    beastKnowledge: {
      raptor: 'tracked',
      brontoshell: 'tracked',
      thunderhorn: 'tracked',
      frostfang: 'tracked',
      snapjaw: 'tracked',
      sky_dragon: 'tracked',
      caldera_titan: 'tracked',
    },
    settings: { ...DEFAULT_SETTINGS },
  };
}

export function loadSavedGame(): SaveData {
  const defaults = getInitialSaveData();
  try {
    const raw = localStorage.getItem(SAVE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.version === 1) {
        return {
          ...defaults,
          ...parsed,
          playerStats: {
            ...defaults.playerStats,
            ...(parsed.playerStats ?? {}),
          },
          beastKnowledge: {
            ...defaults.beastKnowledge,
            ...(parsed.beastKnowledge ?? {}),
          },
        };
      }
    }
  } catch {
    // Fall back to new game
  }
  return defaults;
}

export function saveGame(data: SaveData): boolean {
  try {
    data.timestamp = Date.now();
    localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadSettings(): GameSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (raw) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    }
  } catch {
    // Fall back
  }
  return { ...DEFAULT_SETTINGS };
}

export function saveSettings(settings: GameSettings): void {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // ignore
  }
}

export function exportSaveToJSON(data: SaveData): string {
  return JSON.stringify(data, null, 2);
}

export function importSaveFromJSON(jsonString: string): SaveData | null {
  try {
    const parsed = JSON.parse(jsonString);
    if (parsed && typeof parsed.playerName === 'string' && parsed.inventory) {
      parsed.timestamp = Date.now();
      saveGame(parsed);
      return parsed;
    }
  } catch {
    return null;
  }
  return null;
}
