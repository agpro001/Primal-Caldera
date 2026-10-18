/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateDamage,
  calculatePlayerDamageTaken,
  calculateStaminaCost,
  isDodgeInvulnerable,
  canCraftRecipe,
  deductCraftingMaterials,
  applyWeakPointDamage,
  createBeastWeakPoints,
  WEAPON_REGISTRY,
} from './rules.ts';

test('calculateDamage handles light attack vs weak point and crit correctly', () => {
  // Deterministic random mock returning 0.0 (triggers crit if critChance > 0)
  const mockRandomCrit = () => 0.0;
  const result = calculateDamage(10, 20, false, true, 2.0, 0, 0.5, 'hunter', mockRandomCrit);

  // base = (10 + 20) * 1.0 = 30
  // crit = 1.6
  // weakPoint = 2.0
  // net = 30 * 1.6 * 2.0 = 96
  assert.equal(result.damage, 96);
  assert.equal(result.isCrit, true);
  assert.equal(result.isWeakPoint, true);
});

test('calculateDamage handles heavy attack without crit and applies defense', () => {
  const mockRandomNoCrit = () => 0.99;
  const result = calculateDamage(10, 20, true, false, 1.0, 10, 0.1, 'hunter', mockRandomNoCrit);

  // base = (10 + 20) * 1.85 = 55.5
  // crit = 1.0
  // weak = 1.0
  // def = 10 * 0.45 = 4.5
  // net = 55.5 - 4.5 = 51
  assert.equal(result.damage, 51);
  assert.equal(result.isCrit, false);
  assert.equal(result.isWeakPoint, false);
});

test('calculatePlayerDamageTaken respects player defense and difficulty settings', () => {
  const normalDmg = calculatePlayerDamageTaken(40, 20, 'hunter');
  // 40 - 20 * 0.55 = 40 - 11 = 29
  assert.equal(normalDmg, 29);

  const storyDmg = calculatePlayerDamageTaken(40, 20, 'story');
  // 29 * 0.65 = 18.85 -> 19
  assert.equal(storyDmg, 19);

  const savageDmg = calculatePlayerDamageTaken(40, 20, 'savage');
  // 29 * 1.4 = 40.6 -> 41
  assert.equal(savageDmg, 41);
});

test('isDodgeInvulnerable grants safe i-frames during middle phase of roll', () => {
  assert.equal(isDodgeInvulnerable(0.0), false, 'Start of roll should not be invulnerable');
  assert.equal(isDodgeInvulnerable(0.25), true, 'Mid roll should have active i-frames');
  assert.equal(isDodgeInvulnerable(0.50), true, 'Mid roll should have active i-frames');
  assert.equal(isDodgeInvulnerable(0.75), false, 'Late recovery should be vulnerable');
});

test('canCraftRecipe checks recipe costs accurately', () => {
  const cost = { beast_bone: 4, raptor_claw: 3 };
  assert.equal(canCraftRecipe(cost, { beast_bone: 4, raptor_claw: 3 }), true);
  assert.equal(canCraftRecipe(cost, { beast_bone: 3, raptor_claw: 3 }), false);
  assert.equal(canCraftRecipe(cost, { beast_bone: 5, raptor_claw: 2 }), false);
  assert.equal(canCraftRecipe(cost, {}), false);
});

test('deductCraftingMaterials deducts items without going negative', () => {
  const cost = { beast_bone: 3, obsidian_shard: 2 };
  const inventory = { beast_bone: 5, obsidian_shard: 2, other_item: 10 };
  const updated = deductCraftingMaterials(cost, inventory);

  assert.equal(updated.beast_bone, 2);
  assert.equal(updated.obsidian_shard, 0);
  assert.equal(updated.other_item, 10);
});

test('applyWeakPointDamage breaks when accumulated threshold is exceeded', () => {
  const wp = createBeastWeakPoints('raptor')[0]; // breakThreshold is 60
  const hit1 = applyWeakPointDamage(wp, 35);
  assert.equal(hit1.brokenNow, false);
  assert.equal(hit1.weakPoint.accumulatedDamage, 35);

  const hit2 = applyWeakPointDamage(hit1.weakPoint, 30);
  assert.equal(hit2.brokenNow, true);
  assert.equal(hit2.weakPoint.broken, true);
  assert.equal(hit2.weakPoint.accumulatedDamage, 65);
});

test('calculateStaminaCost returns correct stamina for actions', () => {
  const spearLightCost = calculateStaminaCost('light', 'flint_spear', 'hunter');
  assert.equal(spearLightCost, WEAPON_REGISTRY.flint_spear.staminaCost);

  const dodgeCost = calculateStaminaCost('dodge', 'flint_spear', 'hunter');
  assert.equal(dodgeCost, 22);
});
