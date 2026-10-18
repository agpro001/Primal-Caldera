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

    if (recipe.category === 'weapon') {
      onEquipWeapon(recipe.targetId as WeaponId);
    } else if (recipe.category === 'armor') {
      onEquipArmor(recipe.targetId as ArmorId);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md pointer-events-auto">
      <div className="bg-zinc-950/85 backdrop-blur-2xl border border-white/15 rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl text-left overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <span className="text-xl">🔥</span>
            <div>
              <h2 className="text-lg font-bold text-sky-300 tracking-wide font-serif">
                Mithril Forge, Survival Rations & Dragon Bestiary
              </h2>
              <p className="text-xs text-zinc-400">
                Forge Mastercraft Mithril armor, cook caloric rations, purify glacial water, and study dragon anatomy.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/15 text-zinc-400 hover:text-white flex items-center justify-center text-sm font-bold transition-all cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Material Inventory Bar */}
        <div className="px-6 py-2.5 bg-black/40 border-b border-white/10 flex flex-wrap gap-2 text-xs">
          <span className="text-zinc-500 font-semibold self-center mr-1">Materials:</span>
          {Object.entries(materials).map(([item, count]) => (
            <div
              key={item}
              className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-zinc-300 font-mono flex items-center gap-1.5"
            >
              <span className="capitalize">{item.replace('_', ' ')}</span>
              <span className="text-sky-400 font-bold">{count}</span>
            </div>
          ))}
          {Object.keys(materials).length === 0 && (
            <span className="text-zinc-500 italic">No harvested materials yet. Hunt beasts or forage clues!</span>
          )}
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-white/10 px-6 gap-2 text-xs font-bold overflow-x-auto">
          {(['weapon', 'armor', 'tool', 'tower', 'bestiary'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`py-3 px-4 uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
                activeTab === tab
                  ? 'border-sky-400 text-sky-300 bg-white/5'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {tab === 'weapon'
                ? '⚔ Weapons'
                : tab === 'armor'
                ? '🛡 Mithril Armor'
                : tab === 'tool'
                ? '🍖 Food & Water'
                : tab === 'tower'
                ? '🗼 Tower Beacon'
                : '🐉 Dragon Bestiary'}
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
                    className="p-4 rounded-xl bg-white/5 border border-white/10 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h3 className="font-bold text-zinc-100 text-sm">{recipe.name}</h3>
                        <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-sky-950 text-sky-300 border border-sky-800">
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
                                    ? 'bg-emerald-950/60 border-emerald-700/70 text-emerald-300'
                                    : 'bg-red-950/60 border-red-800/70 text-red-400'
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
                      className={`w-full py-2 px-4 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                        alreadyOwned
                          ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-700/50 cursor-default'
                          : canAfford
                          ? 'bg-sky-500 hover:bg-sky-400 text-black active:scale-95 shadow cursor-pointer'
                          : 'bg-white/5 text-zinc-600 cursor-not-allowed border border-white/10'
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
            <div className="space-y-4">
              <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
                <h3 className="font-bold text-sky-300 text-sm mb-1">
                  Aurelius, The Aetherial Sky-Wyvern (Flying Dragon)
                </h3>
                <span className="text-[11px] text-zinc-400 block mb-2">
                  Habitat: Stratospheric Thermal Airways & Caldera Crags
                </span>
                <p className="text-xs text-zinc-300 leading-relaxed mb-3">
                  Winged dragon that rides convective thermal updrafts across the island and guards high-altitude wyvern egg clutches. Deploy Mithril Flight Wings (V) to intercept it mid-air or strike its patagium wings when it dive-bombs.
                </p>
                <div className="text-xs font-mono text-sky-300">
                  <span className="font-bold text-zinc-400">Weak Points:</span> Draconic Flame-Gland Maw (1.75x), Wing Patagium Joint (1.5x)
                </div>
              </div>

              <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
                <h3 className="font-bold text-amber-300 text-sm mb-1">
                  Razor-Crest Raptor, Brontoshell & Thunderhorn
                </h3>
                <span className="text-[11px] text-zinc-400 block mb-2">
                  Habitat: Jungle Ravines, Black-Sand Coast & Geothermal Springs
                </span>
                <p className="text-xs text-zinc-300 leading-relaxed mb-3">
                  Terrestrial predators and armored herbivores guarding fertilized creature egg nests. Raid their nests (Press E) to harvest high-protein eggs or use snare traps to expose their weak points.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-white/10 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-white/10 hover:bg-white/20 text-zinc-200 text-xs font-bold rounded-lg transition-all cursor-pointer"
          >
            Close Forge
          </button>
        </div>
      </div>
    </div>
  );
};
