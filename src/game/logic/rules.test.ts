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
  computeCameraRelativeMovement,
  stepAngleShortestArc,
  WEAPON_REGISTRY,
  ARMOR_REGISTRY,
  CRAFTING_RECIPES,
} from './rules.ts';

test('computeCameraRelativeMovement moves FRONT (+Z) when joystick pushed UP and BACK (-Z) when pushed DOWN at cameraYaw = 0', () => {
  // At cameraYaw = 0, camera is at (x, z - dist) looking toward +Z.
  // Pushing joystick UP (moveForward = +1) MUST move the player in +Z (away from camera / front).
  const front = computeCameraRelativeMovement(1, 0, 0, 8, 1);
  assert.equal(front.isMoving, true);
  assert.ok(front.dz > 7.9, `Expected front dz > 7.9, got ${front.dz}`);
  assert.ok(Math.abs(front.dx) < 1e-6);

  // Pushing joystick DOWN (moveForward = -1) MUST move the player in -Z (toward camera / back).
  const back = computeCameraRelativeMovement(-1, 0, 0, 8, 1);
  assert.equal(back.isMoving, true);
  assert.ok(back.dz < -7.9, `Expected back dz < -7.9, got ${back.dz}`);
  assert.ok(Math.abs(back.dx) < 1e-6);
});

test('computeCameraRelativeMovement moves RIGHT (-X) when joystick pushed RIGHT and LEFT (+X) when pushed LEFT at cameraYaw = 0', () => {
  // At cameraYaw = 0, camera looks from -Z toward +Z.
  // In a right-handed coordinate system (Y up), +X is to the camera's LEFT and -X is to the camera's RIGHT.
  // Therefore, pushing joystick RIGHT (moveRight = +1) MUST move the player toward -X (screen right),
  // and pushing joystick LEFT (moveRight = -1) MUST move the player toward +X (screen left).
  const right = computeCameraRelativeMovement(0, 1, 0, 8, 1);
  assert.equal(right.isMoving, true);
  assert.ok(right.dx < -7.9, `Expected screen-right dx < -7.9, got ${right.dx}`);
  assert.ok(Math.abs(right.dz) < 1e-6);

  const left = computeCameraRelativeMovement(0, -1, 0, 8, 1);
  assert.equal(left.isMoving, true);
  assert.ok(left.dx > 7.9, `Expected screen-left dx > 7.9, got ${left.dx}`);
  assert.ok(Math.abs(left.dz) < 1e-6);
});

test('computeCameraRelativeMovement respects arbitrary cameraYaw rotations', () => {
  // When cameraYaw = Math.PI / 2, camera looks toward +X.
  // Moving forward (+1, 0) should move toward +X (dx > 0, dz ~ 0).
  const forwardAt90 = computeCameraRelativeMovement(1, 0, Math.PI / 2, 10, 0.5);
  assert.ok(forwardAt90.dx > 4.9);
  assert.ok(Math.abs(forwardAt90.dz) < 1e-5);

  // Idle input returns zero movement
  const idle = computeCameraRelativeMovement(0, 0, 1.2, 10, 0.5);
  assert.equal(idle.isMoving, false);
  assert.equal(idle.dx, 0);
  assert.equal(idle.dz, 0);
});

test('stepAngleShortestArc interpolates across the -PI/+PI boundary without spinning 360 degrees', () => {
  const from = Math.PI - 0.1;
  const to = -Math.PI + 0.1;
  const stepped = stepAngleShortestArc(from, to, 0.5);
  // Shortest arc between PI - 0.1 and -PI + 0.1 is +0.2 radians across PI
  assert.ok(Math.abs(Math.abs(stepped) - Math.PI) < 0.05);
});

test('calculateDamage handles light attack vs weak point and crit correctly', () => {
  const normalHit = calculateDamage({
    weaponDamage: 30,
    isHeavyAttack: false,
    heavyMultiplier: 1.8,
    weakPointMultiplier: 1.0,
    isEnraged: false,
    isStaggered: false,
    critRoll: 0.5,
    critChance: 0.2,
    difficulty: 'hunter',
  });
  assert.equal(normalHit.finalDamage, 30);
  assert.equal(normalHit.isCrit, false);
  assert.equal(normalHit.isWeakPointHit, false);

  const weakCritHeavyHit = calculateDamage({
    weaponDamage: 30,
    isHeavyAttack: true,
    heavyMultiplier: 2.0,
    weakPointMultiplier: 1.5,
    isEnraged: false,
    isStaggered: true,
    critRoll: 0.05,
    critChance: 0.2,
    difficulty: 'hunter',
  });
  assert.equal(weakCritHeavyHit.finalDamage, 182);
  assert.equal(weakCritHeavyHit.isCrit, true);
  assert.equal(weakCritHeavyHit.isWeakPointHit, true);
});

test('calculateDamage handles zero or negative weapon damage gracefully', () => {
  const zeroHit = calculateDamage({
    weaponDamage: 0,
    isHeavyAttack: true,
    heavyMultiplier: 2.0,
    weakPointMultiplier: 1.5,
    isEnraged: true,
    isStaggered: true,
    critRoll: 0.0,
    critChance: 1.0,
    difficulty: 'story',
  });
  assert.equal(zeroHit.finalDamage, 0);
  assert.equal(zeroHit.isCrit, false);
});

test('calculatePlayerDamageTaken reduces damage with higher armor defense', () => {
  const lowArmorDmg = calculatePlayerDamageTaken(50, 6, 'hunter');
  const highArmorDmg = calculatePlayerDamageTaken(50, 48, 'hunter');
  assert.ok(highArmorDmg < lowArmorDmg, 'High armor should reduce incoming beast damage');
  assert.equal(calculatePlayerDamageTaken(0, 20, 'hunter'), 0);
});

test('isDodgeInvulnerable grants i-frames only within active roll window', () => {
  assert.equal(isDodgeInvulnerable(-0.1), false);
  assert.equal(isDodgeInvulnerable(0.01), false);
  assert.equal(isDodgeInvulnerable(0.18), true);
  assert.equal(isDodgeInvulnerable(0.45), false);
  assert.equal(isDodgeInvulnerable(0.8), false);
});

test('canCraftRecipe and deductCraftingMaterials validate and consume ingredients', () => {
  const harpoonRecipe = CRAFTING_RECIPES.find((r) => r.id === 'craft_raptor_harpoon')!;
  const emptyInventory = { raptor_claw: 1, beast_bone: 1 };
  const fullInventory = { raptor_claw: 3, beast_bone: 4 };

  assert.equal(canCraftRecipe(harpoonRecipe, emptyInventory, ['flint_spear'], ['scavenger_rags']), false);
  assert.equal(canCraftRecipe(harpoonRecipe, fullInventory, ['flint_spear'], ['scavenger_rags']), true);
  assert.equal(
    canCraftRecipe(harpoonRecipe, fullInventory, ['flint_spear', 'raptor_harpoon'], ['scavenger_rags']),
    false
  );

  const afterCraft = deductCraftingMaterials(harpoonRecipe, fullInventory);
  assert.equal(afterCraft.raptor_claw, 1);
  assert.equal(afterCraft.beast_bone, 2);
});

test('applyWeakPointDamage and createBeastWeakPoints support all 6 species', () => {
  const speciesList = ['raptor', 'brontoshell', 'thunderhorn', 'frostfang', 'snapjaw', 'caldera_titan'] as const;
  for (const sp of speciesList) {
    const wps = createBeastWeakPoints(sp);
    assert.ok(wps.length >= 2, `Expected weak points for ${sp}`);
  }

  const wps = createBeastWeakPoints('raptor');
  const head = wps[0];
  const step1 = applyWeakPointDamage(head, 40);
  assert.equal(step1.justBroke, false);
  assert.equal(step1.updated.broken, false);
  assert.equal(step1.updated.partHp, 50);

  const step2 = applyWeakPointDamage(step1.updated, 60);
  assert.equal(step2.justBroke, true);
  assert.equal(step2.updated.broken, true);
  assert.equal(step2.updated.partHp, 0);
});

test('calculateStaminaCost respects armor dodge reduction', () => {
  const weapon = WEAPON_REGISTRY.flint_spear;
  const baseArmor = ARMOR_REGISTRY.scavenger_rags;
  const endgameArmor = ARMOR_REGISTRY.thunder_warden_aegis;

  const baseDodge = calculateStaminaCost('dodge', weapon, baseArmor);
  const endgameDodge = calculateStaminaCost('dodge', weapon, endgameArmor);
  assert.ok(endgameDodge < baseDodge);
});
