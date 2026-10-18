/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import type { WeaponId, ArmorId, CraftingRecipe } from '../types/game.ts';
import {
  CRAFTING_RECIPES,
  canCraftRecipe,
  deductCraftingMaterials,
} from '../game/logic/rules.ts';
import { sound } from '../game/audio/soundEngine.ts';

interface CraftingModalProps {
  materials: Record<string, number>;
  equippedWeapon: WeaponId;
  equippedArmor: ArmorId;
  ownedWeapons?: WeaponId[];
  ownedArmors?: ArmorId[];
  onCraftSuccess: (updatedMaterials: Record<string, number>, recipe: CraftingRecipe) => void;
  onEquipWeapon: (id: WeaponId) => void;
  onEquipArmor: (id: ArmorId) => void;
  onClose: () => void;
}

export const CraftingModal: React.FC<CraftingModalProps> = ({
  materials,
  equippedWeapon,
  equippedArmor,
  ownedWeapons = [],
  ownedArmors = [],
  onCraftSuccess,
  onEquipWeapon,
  onEquipArmor,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'weapon' | 'armor' | 'tool' | 'tower' | 'bestiary'>('weapon');

  const filteredRecipes = CRAFTING_RECIPES.filter((r) => r.category === activeTab);

  const handleCraft = (recipe: CraftingRecipe) => {
    if (!canCraftRecipe(recipe, materials, ownedWeapons, ownedArmors)) {
      return;
    }
    const updated = deductCraftingMaterials(recipe, materials);
    sound.playCarve();
    onCraftSuccess(updated, recipe);

    // Auto-equip if weapon or armor
    if (recipe.category === 'weapon') {
      onEquipWeapon(recipe.targetId as WeaponId);
    } else if (recipe.category === 'armor') {
      onEquipArmor(recipe.targetId as ArmorId);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/80 pointer-events-auto">
      <div className="bg-[#151211] border border-[#443831] rounded-lg max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl text-left overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2e2621] bg-[#1a1614]">
          <div className="flex items-center gap-3">
            <span className="text-xl">🔥</span>
            <div>
              <h2 className="text-lg font-bold text-amber-300 tracking-wide font-serif">
                Campfire Workbench & Bestiary
              </h2>
              <p className="text-xs text-zinc-400">
                Forge prehistoric gear, replenish hunting supplies, and study colossal beast anatomy.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded bg-[#27211d] hover:bg-[#3a322c] text-zinc-400 hover:text-white flex items-center justify-center text-sm font-bold transition-all cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Material Inventory Pill Bar */}
        <div className="px-6 py-2.5 bg-[#120f0e] border-b border-[#241e1a] flex flex-wrap gap-2 text-xs">
          <span className="text-zinc-500 font-semibold self-center mr-1">Pouches:</span>
          {Object.entries(materials).map(([item, count]) => (
            <div
              key={item}
              className="px-2.5 py-1 rounded bg-[#1e1916] border border-[#3b3028] text-zinc-300 font-mono flex items-center gap-1.5"
            >
              <span className="capitalize">{item.replace('_', ' ')}</span>
              <span className="text-amber-400 font-bold">{count}</span>
            </div>
          ))}
          {Object.keys(materials).length === 0 && (
            <span className="text-zinc-500 italic">No harvested materials yet. Hunt beasts or forage clues!</span>
          )}
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-[#2e2621] bg-[#171311] px-6 gap-2 text-xs font-bold overflow-x-auto">
          {(['weapon', 'armor', 'tool', 'tower', 'bestiary'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`py-3 px-4 uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
                activeTab === tab
                  ? 'border-amber-500 text-amber-300 bg-[#221b18]'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {tab === 'weapon'
                ? '⚔ Weapons'
                : tab === 'armor'
                ? '🛡 Armor'
                : tab === 'tool'
                ? '🎒 Supplies'
                : tab === 'tower'
                ? '🗼 Tower Beacon'
                : '📖 Beast Bestiary'}
            </button>
          ))}
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {activeTab !== 'bestiary' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredRecipes.map((recipe) => {
                const canAfford = canCraftRecipe(recipe, materials, ownedWeapons, ownedArmors);
                const alreadyOwned =
                  (recipe.category === 'weapon' &&
                    (ownedWeapons.includes(recipe.targetId as WeaponId) ||
                      equippedWeapon === recipe.targetId)) ||
                  (recipe.category === 'armor' &&
                    (ownedArmors.includes(recipe.targetId as ArmorId) ||
                      equippedArmor === recipe.targetId));

                return (
                  <div
                    key={recipe.id}
                    className="p-4 rounded bg-[#1b1715] border border-[#372d26] flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h3 className="font-bold text-zinc-100 text-sm">{recipe.name}</h3>
                        <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-amber-950 text-amber-400 border border-amber-800">
                          Tier {recipe.tier}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-400 mb-3">{recipe.description}</p>

                      {/* Required materials */}
                      <div className="mb-4">
                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-1">
                          Required Materials:
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {recipe.ingredients.map((req) => {
                            const available = materials[req.materialId] || 0;
                            const hasEnough = available >= req.count;
                            return (
                              <span
                                key={req.materialId}
                                className={`text-[11px] font-mono px-2 py-0.5 rounded border ${
                                  hasEnough
                                    ? 'bg-[#182319] border-emerald-800/80 text-emerald-300'
                                    : 'bg-[#291717] border-red-900/80 text-red-400'
                                }`}
                              >
                                {req.materialId.replace('_', ' ')}: {available}/{req.count}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={!canAfford || alreadyOwned}
                      onClick={() => handleCraft(recipe)}
                      className={`w-full py-2 px-4 rounded text-xs font-bold uppercase tracking-wider transition-all ${
                        alreadyOwned
                          ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-700/50 cursor-default'
                          : canAfford
                          ? 'bg-amber-600 hover:bg-amber-500 text-black active:scale-95 shadow cursor-pointer'
                          : 'bg-[#26201c] text-zinc-600 cursor-not-allowed border border-[#382f2a]'
                      }`}
                    >
                      {alreadyOwned
                        ? 'Forged & Owned'
                        : canAfford
                        ? 'Craft & Equip'
                        : 'Missing Materials'}
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            /* BESTIARY TAB */
            <div className="space-y-4">
              <div className="p-4 bg-[#1b1715] border border-[#372d26] rounded">
                <h3 className="font-bold text-amber-300 text-sm mb-1">Razor-Crest Raptor Alpha</h3>
                <span className="text-[11px] text-zinc-400 block mb-2">Habitat: Jungle Ravines · Pack Stalker</span>
                <p className="text-xs text-zinc-300 leading-relaxed mb-3">
                  Swift pack predator that relies on lightning flank lunges and vertical pounces.
                  Watch for its arched crouch and feather flare before the leap strike.
                </p>
                <div className="text-xs font-mono text-amber-400">
                  <span className="font-bold text-zinc-400">Weak Points:</span> Feathered Skull Crest (1.55x), Counterbalance Tail (1.35x)
                </div>
              </div>

              <div className="p-4 bg-[#1b1715] border border-[#372d26] rounded">
                <h3 className="font-bold text-cyan-300 text-sm mb-1">River Snapjaw Leviathan & Glacial Frostfang</h3>
                <span className="text-[11px] text-zinc-400 block mb-2">Habitat: Crystal River & Cold Snow Mountains</span>
                <p className="text-xs text-zinc-300 leading-relaxed mb-3">
                  The River Snapjaw patrols the winding turquoise river with crushing jaws, while the towering Frostfang Mammoth guards the frozen northwest snow peaks.
                </p>
                <div className="text-xs font-mono text-cyan-300">
                  <span className="font-bold text-zinc-400">Weak Points:</span> Bioluminescent Maw (1.6x), Glacial Ivory Tusks (1.65x)
                </div>
              </div>

              <div className="p-4 bg-[#1b1715] border border-[#372d26] rounded">
                <h3 className="font-bold text-amber-300 text-sm mb-1">Brontoshell Behemoth & Thunderhorn Charger</h3>
                <span className="text-[11px] text-zinc-400 block mb-2">Habitat: Black-Sand Coast & Geothermal Springs</span>
                <p className="text-xs text-zinc-300 leading-relaxed mb-3">
                  Armored colossi with heavy shell plates and conductive nasal horns. Use snare traps or heavy spear thrusts to shatter their weak points.
                </p>
                <div className="text-xs font-mono text-amber-400">
                  <span className="font-bold text-zinc-400">Weak Points:</span> Beaked Head (1.6x), Conductive Nasal Horn (1.65x)
                </div>
              </div>

              <div className="p-4 bg-[#1b1715] border border-[#372d26] rounded">
                <h3 className="font-bold text-red-400 text-sm mb-1">Ignis-Rex, The Caldera Titan</h3>
                <span className="text-[11px] text-zinc-400 block mb-2">Habitat: High Caldera Summit · Apex Colossus</span>
                <p className="text-xs text-zinc-300 leading-relaxed mb-3">
                  The ancient volcanic apex lord. Defeat it and carry its Titan Fang to the central Signal Tower to ignite the rescue beacon!
                </p>
                <div className="text-xs font-mono text-red-400">
                  <span className="font-bold text-zinc-400">Weak Points:</span> Molten Maw & Crown (1.75x), Volcanic Heart Core (1.6x)
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-[#171311] border-t border-[#2e2621] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-[#2d2520] hover:bg-[#3d322b] text-zinc-200 text-xs font-bold rounded transition-all cursor-pointer"
          >
            Close Workbench
          </button>
        </div>
      </div>
    </div>
  );
};
