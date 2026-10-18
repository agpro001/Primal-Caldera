/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import type {
  GameState,
  PlayerStats,
  BeastState,
  WeaponId,
  ArmorId,
  WeatherType,
  BeastSpecies,
  BeastKnowledgeLevel,
  CraftingRecipe,
  GameSettings,
  SaveData,
  AtmosphericScienceState,
  AdventureMission,
} from './types/game.ts';
import { GameEngine } from './game/engine/gameEngine.ts';
import {
  ADVENTURE_MISSIONS,
  computeAtmosphericPhysics,
} from './game/logic/rules.ts';
import { TitleScreen } from './components/TitleScreen.tsx';
import { HUD } from './components/HUD.tsx';
import { CraftingModal } from './components/CraftingModal.tsx';
import { BeastopediaModal } from './components/BeastopediaModal.tsx';
import { PauseSettingsModal } from './components/PauseSettingsModal.tsx';
import { VictoryDefeatModal } from './components/VictoryDefeatModal.tsx';
import {
  getInitialSaveData,
  loadSavedGame,
  saveGame,
  loadSettings,
  saveSettings,
} from './game/storage/saveSystem.ts';
import { sound } from './game/audio/soundEngine.ts';

export function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GameEngine | null>(null);

  const [saveData, setSaveData] = useState<SaveData>(() => loadSavedGame());
  const [settings, setSettings] = useState<GameSettings>(() => loadSettings());

  const [gameState, setGameState] = useState<GameState>('title');
  const [stats, setStats] = useState<PlayerStats>(saveData.playerStats);
  const [targetBeast, setTargetBeast] = useState<BeastState | null>(null);
  const [currentQuestIndex, setCurrentQuestIndex] = useState<number>(saveData.currentQuestIndex);
  const [equippedWeapon, setEquippedWeapon] = useState<WeaponId>(saveData.inventory.equippedWeapon);
  const [equippedArmor, setEquippedArmor] = useState<ArmorId>(saveData.inventory.equippedArmor);
  const [currentWeather, setCurrentWeather] = useState<WeatherType>('clear');
  const [atmosphericScience, setAtmosphericScience] = useState<AtmosphericScienceState>(() =>
    computeAtmosphericPhysics(0, 2.5, 28, 'jungle', 'clear', 0)
  );
  const [adventureMissions, setAdventureMissions] = useState<AdventureMission[]>(() =>
    ADVENTURE_MISSIONS.map((m) => ({
      ...m,
      stages: [...m.stages],
    }))
  );
  const [activeAdventureId, setActiveAdventureId] = useState<string>('adv_wyvern_egg_heist');

  const [interactPrompt, setInteractPrompt] = useState<string | null>(null);
  const [notification, setNotification] = useState<{
    message: string;
    type: 'info' | 'loot' | 'danger';
  } | null>(null);
  const [focusVisionActive, setFocusVisionActive] = useState<boolean>(false);

  const [craftingOpen, setCraftingOpen] = useState<boolean>(false);
  const [beastopediaOpen, setBeastopediaOpen] = useState<boolean>(false);
  const [settingsOpenOnTitle, setSettingsOpenOnTitle] = useState<boolean>(false);

  const [beastKnowledge, setBeastKnowledge] = useState<Record<BeastSpecies, BeastKnowledgeLevel>>(
    saveData.beastKnowledge || {
      raptor: 'tracked',
      brontoshell: 'tracked',
      thunderhorn: 'tracked',
      frostfang: 'tracked',
      snapjaw: 'tracked',
      sky_dragon: 'tracked',
      caldera_titan: 'tracked',
    }
  );

  const [endStats, setEndStats] = useState<{
    time?: number;
    beastsSlain: number;
    materialsGathered?: number;
  }>({ beastsSlain: 0 });

  useEffect(() => {
    if (!containerRef.current) return;

    const initialSave = loadSavedGame();
    const engine = new GameEngine(containerRef.current, initialSave, {
      onStatsChange: (newStats) => setStats({ ...newStats }),
      onTargetChange: (beast) => setTargetBeast(beast ? { ...beast } : null),
      onNotification: (message, type) => {
        setNotification({ message, type });
        window.clearTimeout((window as unknown as { __notifTimer?: number }).__notifTimer);
        (window as unknown as { __notifTimer?: number }).__notifTimer = window.setTimeout(
          () => setNotification(null),
          3800
        );
      },
      onInteractPrompt: (prompt) => setInteractPrompt(prompt),
      onOpenCrafting: () => setCraftingOpen(true),
      onQuestUpdate: (questIdx) => {
        setCurrentQuestIndex(questIdx);
        if (engineRef.current) {
          const snap = engineRef.current.getSaveSnapshot();
          setSaveData(snap);
          saveGame(snap);
        }
      },
      onVictory: (vStats) => {
        setEndStats(vStats);
        setGameState('victory');
        if (engineRef.current) {
          engineRef.current.setGameState('victory');
          const snap = engineRef.current.getSaveSnapshot();
          setSaveData(snap);
          saveGame(snap);
        }
      },
      onDefeat: () => {
        if (engineRef.current) {
          setEndStats({
            beastsSlain: engineRef.current.beastsHunted.length,
          });
          engineRef.current.setGameState('gameover');
        }
        setGameState('gameover');
      },
      onFocusChange: (active) => setFocusVisionActive(active),
      onWeaponChange: (weapon) => setEquippedWeapon(weapon),
      onWeatherChange: (weather) => setCurrentWeather(weather),
      onKnowledgeUpdate: (k) => setBeastKnowledge({ ...k }),
      onAtmosphereChange: (atm) => setAtmosphericScience({ ...atm }),
      onAdventuresChange: (missions, activeIdx) => {
        setAdventureMissions([...missions]);
        if (missions[activeIdx]) {
          setActiveAdventureId(missions[activeIdx].id);
        }
      },
    });

    engineRef.current = engine;

    // Support ?autostart=1 for automated testing and instant jump-in
    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') {
      engine.setGameState('playing');
      setGameState('playing');
    }

    const handleResize = () => engine.handleResize();
    window.addEventListener('resize', handleResize);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Tab' && engine.gameState === 'playing') {
        e.preventDefault();
        setCraftingOpen((prev) => !prev);
      } else if (e.code === 'KeyB' && engine.gameState === 'playing') {
        e.preventDefault();
        setBeastopediaOpen((prev) => !prev);
      } else if (e.code === 'Escape') {
        if (craftingOpen) {
          setCraftingOpen(false);
        } else if (beastopediaOpen) {
          setBeastopediaOpen(false);
        } else if (engine.gameState === 'playing') {
          engine.setGameState('paused');
          setGameState('paused');
        } else if (engine.gameState === 'paused') {
          engine.setGameState('playing');
          setGameState('playing');
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', handleKeyDown);
      engine.dispose();
    };
  }, []);

  const handleStartHunt = () => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.setGameState('playing');
    setGameState('playing');
  };

  const handleCraftSuccess = (updatedMaterials: Record<string, number>, recipe: CraftingRecipe) => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.inventoryMaterials = updatedMaterials;

    if (recipe.category === 'weapon') {
      const wId = recipe.targetId as WeaponId;
      if (!engine.ownedWeapons.includes(wId)) engine.ownedWeapons.push(wId);
      engine.setEquippedWeapon(wId);
      setEquippedWeapon(wId);
    } else if (recipe.category === 'armor') {
      const aId = recipe.targetId as ArmorId;
      if (!engine.ownedArmors.includes(aId)) engine.ownedArmors.push(aId);
      engine.setEquippedArmor(aId);
      setEquippedArmor(aId);
    } else if (recipe.category === 'tool') {
      if (recipe.id === 'craft_roasted_ration') {
        engine.playerStats.foodRations = Math.min(
          engine.playerStats.maxFoodRations,
          engine.playerStats.foodRations + 2
        );
      } else if (recipe.id === 'craft_glacial_canteen') {
        engine.playerStats.waterCanteens = Math.min(
          engine.playerStats.maxWaterCanteens,
          engine.playerStats.waterCanteens + 2
        );
      } else if (recipe.id === 'craft_snare_trap') {
        engine.playerStats.traps = Math.min(
          engine.playerStats.maxTraps,
          engine.playerStats.traps + 2
        );
      }
      setStats({ ...engine.playerStats });
    } else if (recipe.category === 'tower') {
      engine.beaconLit = true;
      engine.signalTowerProgress = 3;
      sound.playVictory();
      setEndStats({
        time: 360,
        beastsSlain: engine.beastsHunted.length,
        materialsGathered: Object.values(updatedMaterials).reduce((a, b) => a + b, 0),
      });
      engine.setGameState('victory');
      setGameState('victory');
    }

    const snap = engine.getSaveSnapshot();
    setSaveData(snap);
    saveGame(snap);
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black select-none">
      {/* 3D WebGL Viewport */}
      <div ref={containerRef} className="w-full h-full" />

      {/* Title Screen */}
      {gameState === 'title' && (
        <TitleScreen
          onStart={handleStartHunt}
          onOpenSettings={() => setSettingsOpenOnTitle(true)}
        />
      )}

      {/* Active Gameplay HUD */}
      {gameState === 'playing' && engineRef.current && (
        <HUD
          stats={stats}
          targetBeast={targetBeast}
          currentQuestIndex={currentQuestIndex}
          equippedWeapon={equippedWeapon}
          equippedArmor={equippedArmor}
          currentWeather={currentWeather}
          atmosphericScience={atmosphericScience}
          adventureMissions={adventureMissions}
          activeAdventureId={activeAdventureId}
          isFlying={Boolean(stats.isFlying)}
          isAirborne={Boolean(stats.isJumping || stats.isFlying)}
          interactPrompt={interactPrompt}
          notification={notification}
          focusVisionActive={focusVisionActive}
          onAttack={() => engineRef.current?.startSpearAttack()}
          onChargeRelease={() => engineRef.current?.releaseHeavyThrust()}
          onJump={() => engineRef.current?.jumpPlayer()}
          onToggleFlight={() => engineRef.current?.toggleFlightMode()}
          onDodge={() => engineRef.current?.startDodgeRoll()}
          onEatFood={() => engineRef.current?.eatFoodRation()}
          onDrinkWater={() => engineRef.current?.drinkWaterCanteen()}
          onConsumeEgg={() => engineRef.current?.useCollectedEgg()}
          onSelectAdventure={(advId) => {
            const idx = adventureMissions.findIndex((m) => m.id === advId);
            if (idx >= 0) {
              engineRef.current?.selectAdventureMission(idx);
            }
          }}
          onPlaceTrap={() => engineRef.current?.placeTrap()}
          onThrowStone={() => engineRef.current?.throwStone()}
          onToggleFocus={() => engineRef.current?.toggleHunterFocus()}
          onInteract={() => engineRef.current?.handleInteract()}
          onOpenCrafting={() => setCraftingOpen(true)}
          onOpenBeastopedia={() => setBeastopediaOpen(true)}
          onPause={() => {
            engineRef.current?.setGameState('paused');
            setGameState('paused');
          }}
          onVirtualMove={(vx, vy) => {
            if (engineRef.current) {
              engineRef.current.virtualMoveX = vx;
              engineRef.current.virtualMoveY = vy;
            }
          }}
          onLookDelta={(dx, dy) => {
            if (engineRef.current) {
              engineRef.current.cameraYaw -= dx * 0.0045;
              engineRef.current.cameraPitch = Math.max(
                0.08,
                Math.min(1.15, engineRef.current.cameraPitch + dy * 0.0035)
              );
            }
          }}
        />
      )}

      {/* Campfire Crafting Modal */}
      {craftingOpen && engineRef.current && (
        <CraftingModal
          materials={engineRef.current.inventoryMaterials}
          equippedWeapon={equippedWeapon}
          equippedArmor={equippedArmor}
          ownedWeapons={engineRef.current.ownedWeapons}
          ownedArmors={engineRef.current.ownedArmors}
          onCraftSuccess={handleCraftSuccess}
          onEquipWeapon={(wId) => {
            engineRef.current?.setEquippedWeapon(wId);
            setEquippedWeapon(wId);
          }}
          onEquipArmor={(aId) => {
            engineRef.current?.setEquippedArmor(aId);
            setEquippedArmor(aId);
          }}
          onClose={() => setCraftingOpen(false)}
        />
      )}

      {/* Minimalist Glassmorphic 2D Reference Pictures & 3D Atlas Modal */}
      {beastopediaOpen && (
        <BeastopediaModal
          knowledge={beastKnowledge}
          beastsHunted={engineRef.current?.beastsHunted || saveData.beastsHunted}
          onClose={() => setBeastopediaOpen(false)}
        />
      )}

      {/* Pause & Settings Modal */}
      {(gameState === 'paused' || settingsOpenOnTitle) && (
        <PauseSettingsModal
          settings={settings}
          currentSave={engineRef.current ? engineRef.current.getSaveSnapshot() : saveData}
          onResume={() => {
            if (settingsOpenOnTitle) {
              setSettingsOpenOnTitle(false);
            } else {
              engineRef.current?.setGameState('playing');
              setGameState('playing');
            }
          }}
          onRestart={() => {
            const fresh = getInitialSaveData();
            saveGame(fresh);
            setSaveData(fresh);
            if (engineRef.current) {
              engineRef.current.respawnAtCampfire();
              engineRef.current.setGameState('playing');
            }
            setSettingsOpenOnTitle(false);
            setGameState('playing');
          }}
          onTitle={() => {
            setSettingsOpenOnTitle(false);
            engineRef.current?.setGameState('title');
            setGameState('title');
          }}
          onUpdateSettings={(newSettings) => {
            setSettings(newSettings);
            saveSettings(newSettings);
          }}
          onImportSave={(imported) => {
            setSaveData(imported);
            saveGame(imported);
          }}
        />
      )}

      {/* Victory / Defeat Modal */}
      {(gameState === 'victory' || gameState === 'gameover') && (
        <VictoryDefeatModal
          type={gameState === 'victory' ? 'victory' : 'defeat'}
          stats={endStats}
          onAction={() => {
            if (engineRef.current) {
              if (gameState === 'gameover') {
                engineRef.current.respawnAtCampfire();
              } else {
                engineRef.current.setGameState('playing');
              }
            }
            setGameState('playing');
          }}
        />
      )}
    </div>
  );
}

export default App;
