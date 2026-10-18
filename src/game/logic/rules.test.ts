/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateDamage,
  calculatePlayerDamageTaken,
  isDodgeInvulnerable,
  canCraftRecipe,
  deductCraftingMaterials,
  applyWeakPointDamage,
  createBeastWeakPoints,
  computeCameraRelativeMovement,
  stepAngleShortestArc,
  computeAtmosphericPhysics,
  computeSurvivalMetabolism,
  ARMOR_REGISTRY,
  CRAFTING_RECIPES,
  ADVENTURE_MISSIONS,
  INITIAL_EGG_NESTS,
} from './rules.ts';

test('computeCameraRelativeMovement moves FRONT (+Z) when joystick pushed UP and BACK (-Z) when pushed DOWN at cameraYaw = 0', () => {
  const front = computeCameraRelativeMovement(1, 0, 0, 8, 1);
  assert.equal(front.isMoving, true);
  assert.ok(front.dz > 7.9, `Expected front dz > 7.9, got ${front.dz}`);
  assert.ok(Math.abs(front.dx) < 1e-6);

  const back = computeCameraRelativeMovement(-1, 0, 0, 8, 1);
  assert.equal(back.isMoving, true);
  assert.ok(back.dz < -7.9, `Expected back dz < -7.9, got ${back.dz}`);
  assert.ok(Math.abs(back.dx) < 1e-6);
});

test('computeCameraRelativeMovement moves RIGHT (-X) when joystick pushed RIGHT and LEFT (+X) when pushed LEFT at cameraYaw = 0', () => {
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
  const forwardAt90 = computeCameraRelativeMovement(1, 0, Math.PI / 2, 10, 0.5);
  assert.ok(forwardAt90.dx > 4.9);
  assert.ok(Math.abs(forwardAt90.dz) < 1e-5);

  const idle = computeCameraRelativeMovement(0, 0, 1.2, 10, 0.5);
  assert.equal(idle.isMoving, false);
  assert.equal(idle.dx, 0);
  assert.equal(idle.dz, 0);
});

test('stepAngleShortestArc interpolates across the -PI/+PI boundary without spinning 360 degrees', () => {
  const from = Math.PI - 0.1;
  const to = -Math.PI + 0.1;
  const stepped = stepAngleShortestArc(from, to, 0.5);
  assert.ok(Math.abs(Math.abs(stepped) - Math.PI) < 0.05);
});

test('computeAtmosphericPhysics computes real barometric pressure, air density, temperature, and thermal updraft lift', () => {
  const seaLevelJungle = computeAtmosphericPhysics(0, 0.2, 20, 'jungle', 'clear', 10);
  const highAltitudeSnow = computeAtmosphericPhysics(80, 12.0, -50, 'snow', 'ash_storm', 10);
  const calderaVolcano = computeAtmosphericPhysics(0, 3.0, -64, 'caldera', 'clear', 10);

  // Higher altitude must have lower barometric pressure
  assert.ok(
    highAltitudeSnow.pressureHpa < seaLevelJungle.pressureHpa,
    'High altitude pressure should be lower than sea level'
  );
  // Snow peaks must be colder than caldera
  assert.ok(
    highAltitudeSnow.temperatureC < calderaVolcano.temperatureC,
    'Snow peaks must be colder than volcanic caldera'
  );
  // Caldera must have stronger convective thermal updraft than snow peaks
  assert.ok(
    calderaVolcano.thermalLiftMs > highAltitudeSnow.thermalLiftMs,
    'Caldera should generate strong thermal updrafts'
  );
  assert.ok(seaLevelJungle.airDensityKgM3 > 0.9 && seaLevelJungle.airDensityKgM3 < 1.4);
});

test('computeSurvivalMetabolism burns calories and hydration and regenerates HP accurately', () => {
  const atmHot = computeAtmosphericPhysics(0, 2.0, -60, 'caldera', 'clear', 0);

  const baseStats = {
    hp: 100,
    maxHp: 150,
    food: 2200,
    maxFood: 2400,
    water: 1800,
    maxWater: 2000,
    foodRations: 4,
    maxFoodRations: 8,
    waterCanteens: 4,
    maxWaterCanteens: 6,
    eggsCollected: 0,
    attackPower: 28,
    defense: 12,
    critChance: 0.14,
    traps: 3,
    maxTraps: 5,
    lureStones: 6,
    maxLureStones: 8,
    stamina: 110,
    maxStamina: 110,
    staminaRegenRate: 100,
    healingFlasks: 0,
    maxHealingFlasks: 0,
  };

  // Well-fed & hydrated player burns calories/hydration when moving and regenerates HP
  const fedStep = computeSurvivalMetabolism(baseStats, atmHot, true, false, false, 1.0);
  assert.ok(fedStep.food < 2200, 'Moving should burn calories');
  assert.ok(fedStep.water < 1800, 'Hot caldera should consume hydration');
  assert.ok(fedStep.hp > 100, 'Well-fed (>70%) and hydrated (>70%) should regenerate HP');

  // Standing in freshwater rehydrates automatically
  const riverStep = computeSurvivalMetabolism(
    { ...baseStats, water: 800 },
    atmHot,
    false,
    false,
    true,
    1.0
  );
  assert.ok(riverStep.water > 800, 'Freshwater river should restore hydration');
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

test('calculatePlayerDamageTaken reduces damage with Mastercraft Mithril Armor defense', () => {
  const lowArmorDmg = calculatePlayerDamageTaken(50, ARMOR_REGISTRY.scavenger_rags.defense, 'hunter');
  const mithrilMastercraftDmg = calculatePlayerDamageTaken(
    50,
    ARMOR_REGISTRY.thunder_warden_aegis.defense,
    'hunter'
  );
  assert.ok(
    mithrilMastercraftDmg < lowArmorDmg,
    'Mastercraft Mithril Armor Set should significantly reduce incoming beast damage'
  );
  assert.ok(ARMOR_REGISTRY.thunder_warden_aegis.name.includes('Mastercraft Mithril Armor'));
});

test('isDodgeInvulnerable grants i-frames only within active roll window', () => {
  assert.equal(isDodgeInvulnerable(-0.1), false);
  assert.equal(isDodgeInvulnerable(0.01), false);
  assert.equal(isDodgeInvulnerable(0.18), true);
  assert.equal(isDodgeInvulnerable(0.45), false);
});

test('canCraftRecipe and deductCraftingMaterials validate and consume ingredients including Food & Water recipes', () => {
  const rationRecipe = CRAFTING_RECIPES.find((r) => r.id === 'craft_roasted_ration')!;
  assert.ok(rationRecipe, 'Expected Roasted Beast Ration recipe');
  const inv = { beast_bone: 2, sun_herb: 2 };
  assert.equal(canCraftRecipe(rationRecipe, inv, ['flint_spear'], ['scavenger_rags']), true);
  const after = deductCraftingMaterials(rationRecipe, inv);
  assert.equal(after.beast_bone, 1);
  assert.equal(after.sun_herb, 1);
});

test('applyWeakPointDamage and createBeastWeakPoints support all 7 species including sky_dragon', () => {
  const speciesList = [
    'raptor',
    'brontoshell',
    'thunderhorn',
    'frostfang',
    'snapjaw',
    'sky_dragon',
    'caldera_titan',
  ] as const;
  for (const sp of speciesList) {
    const wps = createBeastWeakPoints(sp);
    assert.ok(wps.length >= 2, `Expected weak points for ${sp}`);
  }

  const dragonWps = createBeastWeakPoints('sky_dragon');
  const wing = dragonWps[1];
  const step = applyWeakPointDamage(wing, 400);
  assert.equal(step.justBroke, true);
  assert.equal(step.updated.broken, true);
});

test('INITIAL_EGG_NESTS and ADVENTURE_MISSIONS are populated with multi-stage objectives', () => {
  assert.ok(INITIAL_EGG_NESTS.length >= 6, 'Expected at least 6 creature & dragon egg nests');
  assert.ok(
    INITIAL_EGG_NESTS.some((n) => n.species === 'sky_dragon'),
    'Expected sky_dragon egg nests'
  );
  assert.ok(ADVENTURE_MISSIONS.length >= 4, 'Expected at least 4 open-world adventure operations');
  for (const adv of ADVENTURE_MISSIONS) {
    assert.equal(adv.stages.length, 3, `Expected 3 stages for adventure ${adv.id}`);
  }
});
