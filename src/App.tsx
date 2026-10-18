/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import type {
  GameState,
  PlayerStats,
  BeastState,
  WeaponId,
  ArmorId,
  GameSettings,
  CraftingRecipe,
  SaveData,
  WeatherType,
  BeastSpecies,
  BeastKnowledgeLevel,
} from './types/game.ts';
import { GameEngine } from './game/engine/gameEngine.ts';
import { loadSavedGame, saveGame, loadSettings, saveSettings } from './game/storage/saveSystem.ts';
import { HUD } from './components/HUD.tsx';
import { TitleScreen } from './components/TitleScreen.tsx';
import { CraftingModal } from './components/CraftingModal.tsx';
import { BeastopediaModal } from './components/BeastopediaModal.tsx';
import { PauseSettingsModal } from './components/PauseSettingsModal.tsx';
import { VictoryDefeatModal } from './components/VictoryDefeatModal.tsx';
import { sound } from './game/audio/soundEngine.ts';

export default function App() {
  const mountRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GameEngine | null>(null);

  const [gameState, setGameState] = useState<GameState>('title');
  const [saveData, setSaveData] = useState(() => loadSavedGame());
  const [settings, setSettings] = useState<GameSettings>(() => loadSettings());

  const [playerStats, setPlayerStats] = useState<PlayerStats>(saveData.playerStats);
  const [targetBeast, setTargetBeast] = useState<BeastState | null>(null);
  const [currentQuestIndex, setCurrentQuestIndex] = useState(saveData.currentQuestIndex);
  const [equippedWeapon, setEquippedWeapon] = useState<WeaponId>(saveData.inventory.equippedWeapon);
  const [equippedArmor, setEquippedArmor] = useState<ArmorId>(saveData.inventory.equippedArmor);
  const [currentWeather, setCurrentWeather] = useState<WeatherType>(saveData.currentWeather || 'clear');
  const [beastKnowledge, setBeastKnowledge] = useState<Record<BeastSpecies, BeastKnowledgeLevel>>(
    saveData.beastKnowledge || {
      raptor: 'tracked',
      brontoshell: 'tracked',
      thunderhorn: 'tracked',
      caldera_titan: 'tracked',
    }
  );
  const [interactPrompt, setInteractPrompt] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: 'info' | 'loot' | 'danger' } | null>(null);
  const [focusVisionActive, setFocusVisionActive] = useState(false);
  const [isCraftingOpen, setIsCraftingOpen] = useState(false);
  const [isBeastopediaOpen, setIsBeastopediaOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [victoryStats, setVictoryStats] = useState<{ time?: number; beastsSlain: number; materialsGathered?: number }>({
    beastsSlain: 0,
  });

  const showNotification = useCallback((message: string, type: 'info' | 'loot' | 'danger' = 'info') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification((curr) => (curr?.message === message ? null : curr));
    }, 2800);
  }, []);

  // Initialize Game Engine
  useEffect(() => {
    if (!mountRef.current) return;

    const initialSave = loadSavedGame();

    const engine = new GameEngine(mountRef.current, initialSave, {
      onStatsChange: (stats) => {
        setPlayerStats({ ...stats });
      },
      onTargetChange: (target) => {
        setTargetBeast(target ? { ...target } : null);
      },
      onNotification: (msg, type) => {
        showNotification(msg, type);
      },
      onInteractPrompt: (prompt) => {
        setInteractPrompt(prompt);
      },
      onOpenCrafting: () => {
        setIsCraftingOpen(true);
      },
      onQuestUpdate: (questIdx) => {
        setCurrentQuestIndex(questIdx);
      },
      onVictory: (stats) => {
        setVictoryStats(stats);
        setGameState('victory');
        engine.setGameState('victory');
      },
      onDefeat: () => {
        setGameState('gameover');
        engine.setGameState('gameover');
      },
      onFocusChange: (active) => {
        setFocusVisionActive(active);
      },
      onWeaponChange: (w) => {
        setEquippedWeapon(w);
      },
      onWeatherChange: (w) => {
        setCurrentWeather(w);
      },
      onKnowledgeUpdate: (k) => {
        setBeastKnowledge({ ...k });
      },
    });

    engineRef.current = engine;

    // Check for ?autostart=1
    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') {
      sound.triggerUserInteraction();
      engine.setGameState('playing');
      setGameState('playing');
    }

    const onResize = () => engine.handleResize();
    window.addEventListener('resize', onResize);

    // Global Key Listener for Pause, Crafting, and Beastopedia
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Escape' || e.code === 'KeyP') {
        if (isBeastopediaOpen) {
          setIsBeastopediaOpen(false);
          return;
        }
        if (isCraftingOpen) {
          setIsCraftingOpen(false);
          return;
        }
        if (isSettingsOpen) {
          setIsSettingsOpen(false);
          return;
        }
        setGameState((curr) => {
          if (curr === 'playing') {
            engine.setGameState('paused');
            return 'paused';
          }
          if (curr === 'paused') {
            engine.setGameState('playing');
            return 'playing';
          }
          return curr;
        });
      } else if (e.code === 'Tab') {
        e.preventDefault();
        if (engine.gameState === 'playing') {
          setIsCraftingOpen((prev) => !prev);
        }
      } else if (e.code === 'KeyB') {
        if (engine.gameState === 'playing') {
          setIsBeastopediaOpen((prev) => !prev);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('keydown', onKeyDown);
      engine.dispose();
    };
  }, [showNotification]);

  // Start Game handler
  const handleStartGame = () => {
    if (!engineRef.current) return;
    sound.triggerUserInteraction();
    engineRef.current.setGameState('playing');
    setGameState('playing');
    showNotification('Welcome to Primal Caldera! Follow the tracks to stalk the Raptor pack.', 'loot');
  };

  // Resume Game handler
  const handleResumeGame = () => {
    if (!engineRef.current) return;
    engineRef.current.setGameState('playing');
    setGameState('playing');
  };

  // Restart Run handler
  const handleRestartRun = () => {
    if (!engineRef.current) return;
    engineRef.current.playerPos.set(0, 1.0, 28);
    engineRef.current.playerStats.hp = engineRef.current.playerStats.maxHp;
    engineRef.current.playerStats.stamina = engineRef.current.playerStats.maxStamina;
    engineRef.current.playerStats.healingFlasks = engineRef.current.playerStats.maxHealingFlasks;
    engineRef.current.setGameState('playing');
    setGameState('playing');
    showNotification('Rested at Campfire Haven. Hunt resumed.', 'info');
  };

  // Save Settings handler
  const handleUpdateSettings = (newSettings: GameSettings) => {
    setSettings(newSettings);
    saveSettings(newSettings);
  };

  // Import Save handler
  const handleImportSave = (newSave: SaveData) => {
    setSaveData(newSave);
    setPlayerStats(newSave.playerStats);
    setEquippedWeapon(newSave.inventory.equippedWeapon);
    setEquippedArmor(newSave.inventory.equippedArmor);
    setCurrentQuestIndex(newSave.currentQuestIndex);
    if (engineRef.current) {
      engineRef.current.playerPos.set(newSave.playerPos.x, newSave.playerPos.y, newSave.playerPos.z);
      engineRef.current.playerStats = { ...newSave.playerStats };
      engineRef.current.inventoryMaterials = { ...newSave.inventory.materials };
      engineRef.current.setEquippedWeapon(newSave.inventory.equippedWeapon);
      engineRef.current.setEquippedArmor(newSave.inventory.equippedArmor);
    }
    showNotification('Save data successfully restored!', 'loot');
  };

  // Crafting handlers
  const handleCraftSuccess = (updatedMaterials: Record<string, number>, recipe: CraftingRecipe) => {
    if (!engineRef.current) return;
    engineRef.current.inventoryMaterials = updatedMaterials;
    if (recipe.category === 'supplies') {
      if (recipe.id === 'craft_trap_satchel') {
        engineRef.current.playerStats.traps = Math.min(
          engineRef.current.playerStats.maxTraps,
          engineRef.current.playerStats.traps + 2
        );
      } else if (recipe.id === 'craft_healing_brew') {
        engineRef.current.playerStats.healingFlasks = Math.min(
          engineRef.current.playerStats.maxHealingFlasks,
          engineRef.current.playerStats.healingFlasks + 2
        );
      }
    }
    setPlayerStats({ ...engineRef.current.playerStats });
    showNotification(`Crafted: ${recipe.name}!`, 'loot');

    // Auto save
    const snapshot = engineRef.current.getSaveSnapshot();
    saveGame(snapshot);
  };

  const handleEquipWeapon = (id: WeaponId) => {
    if (!engineRef.current) return;
    engineRef.current.setEquippedWeapon(id);
    setEquippedWeapon(id);
  };

  const handleEquipArmor = (id: ArmorId) => {
    if (!engineRef.current) return;
    engineRef.current.setEquippedArmor(id);
    setEquippedArmor(id);
  };

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-[#0a0a0c]" data-testid="game-main">
      {/* 3D WebGL Canvas Isolated Mount */}
      <div
        ref={mountRef}
        data-testid="canvas-mount"
        className="absolute inset-0 w-full h-full cursor-crosshair"
      />

      {/* Title Screen Overlay */}
      {gameState === 'title' && (
        <TitleScreen
          onStart={handleStartGame}
          onOpenSettings={() => setIsSettingsOpen(true)}
        />
      )}

      {/* Playing HUD Overlay */}
      {gameState === 'playing' && (
        <HUD
          stats={playerStats}
          targetBeast={targetBeast}
          currentQuestIndex={currentQuestIndex}
          equippedWeapon={equippedWeapon}
          equippedArmor={equippedArmor}
          currentWeather={currentWeather}
          interactPrompt={interactPrompt}
          notification={notification}
          focusVisionActive={focusVisionActive}
          onAttack={() => engineRef.current?.startSpearAttack()}
          onChargeRelease={() => engineRef.current?.releaseHeavyThrust()}
          onDodge={() => engineRef.current?.startDodgeRoll()}
          onHeal={() => engineRef.current?.useHealFlask()}
          onPlaceTrap={() => engineRef.current?.placeTrap()}
          onThrowStone={() => engineRef.current?.throwStone()}
          onToggleFocus={() => engineRef.current?.toggleHunterFocus()}
          onInteract={() => engineRef.current?.handleInteract()}
          onOpenCrafting={() => setIsCraftingOpen(true)}
          onOpenBeastopedia={() => setIsBeastopediaOpen(true)}
          onPause={() => {
            engineRef.current?.setGameState('paused');
            setGameState('paused');
          }}
          onVirtualMove={(x, y) => {
            if (engineRef.current) {
              engineRef.current.virtualMoveX = x;
              engineRef.current.virtualMoveY = y;
            }
          }}
          onLookDelta={(dx, dy) => {
            if (engineRef.current) {
              engineRef.current.cameraYaw -= dx * 0.0035 * settings.touchSensitivity;
              engineRef.current.cameraPitch = Math.max(
                0.05,
                Math.min(1.2, engineRef.current.cameraPitch + dy * 0.0035 * settings.touchSensitivity)
              );
            }
          }}
        />
      )}

      {/* Pause Modal */}
      {gameState === 'paused' && (
        <PauseSettingsModal
          settings={settings}
          currentSave={engineRef.current ? engineRef.current.getSaveSnapshot() : saveData}
          onResume={handleResumeGame}
          onRestart={handleRestartRun}
          onTitle={() => {
            engineRef.current?.setGameState('title');
            setGameState('title');
          }}
          onUpdateSettings={handleUpdateSettings}
          onImportSave={handleImportSave}
        />
      )}

      {/* Victory / Defeat Modal */}
      {(gameState === 'victory' || gameState === 'gameover') && (
        <VictoryDefeatModal
          type={gameState === 'victory' ? 'victory' : 'defeat'}
          stats={victoryStats}
          onAction={handleRestartRun}
        />
      )}

      {/* Standalone Settings Modal (from Title Screen) */}
      {isSettingsOpen && (
        <PauseSettingsModal
          settings={settings}
          currentSave={saveData}
          onResume={() => setIsSettingsOpen(false)}
          onRestart={() => setIsSettingsOpen(false)}
          onTitle={() => setIsSettingsOpen(false)}
          onUpdateSettings={handleUpdateSettings}
          onImportSave={handleImportSave}
        />
      )}

      {/* Crafting / Workbench Modal */}
      {isCraftingOpen && (
        <CraftingModal
          materials={engineRef.current?.inventoryMaterials || {}}
          equippedWeapon={equippedWeapon}
          equippedArmor={equippedArmor}
          onCraftSuccess={handleCraftSuccess}
          onEquipWeapon={handleEquipWeapon}
          onEquipArmor={handleEquipArmor}
          onClose={() => setIsCraftingOpen(false)}
        />
      )}

      {/* Island Beastopedia Modal */}
      {isBeastopediaOpen && (
        <BeastopediaModal
          knowledge={beastKnowledge}
          onClose={() => setIsBeastopediaOpen(false)}
        />
      )}
    </main>
  );
}
