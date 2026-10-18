/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import type { WeatherType, WeatherCondition } from '../../types/game.ts';
import { sound } from '../audio/soundEngine.ts';

export const WEATHER_CONDITIONS: Record<WeatherType, WeatherCondition> = {
  clear: {
    type: 'clear',
    name: 'Clear Volcanic Dawn',
    description: 'Crisp sunlight over the island. Normal tracking conditions and standard creature alertness.',
    fogDensity: 0.009,
    sunIntensity: 1.4,
    skyColor: 0x1f1d24,
    fogColor: 0x2e2729,
    beastAwarenessMod: 1.0,
    beastSpeedMod: 1.0,
    scentDecayRate: 1.0,
  },
  heavy_rain: {
    type: 'heavy_rain',
    name: 'Torrential Monsoonal Rain',
    description: 'Heavy rainfall and wet foliage. Muffles hunter footsteps allowing stealthy approaches, but washes away scent trails quickly.',
    fogDensity: 0.018,
    sunIntensity: 0.65,
    skyColor: 0x141822,
    fogColor: 0x1e2330,
    beastAwarenessMod: 0.7,
    beastSpeedMod: 0.95,
    scentDecayRate: 2.2,
  },
  dense_fog: {
    type: 'dense_fog',
    name: 'Geothermal Sulfur Mist',
    description: 'Thick sulfur fumes blanket the ravines. Severely impairs creature vision, making Hunter’s Focus essential to track beasts.',
    fogDensity: 0.032,
    sunIntensity: 0.5,
    skyColor: 0x24221b,
    fogColor: 0x3d3725,
    beastAwarenessMod: 0.55,
    beastSpeedMod: 0.9,
    scentDecayRate: 0.8,
  },
  ash_storm: {
    type: 'ash_storm',
    name: 'Caldera Ash & Ember Storm',
    description: 'Volcanic eruption fallout fills the air with swirling burning cinders. Agitates colossal beasts, making them hyper-aggressive!',
    fogDensity: 0.022,
    sunIntensity: 0.8,
    skyColor: 0x2c1410,
    fogColor: 0x3d1a14,
    beastAwarenessMod: 1.25,
    beastSpeedMod: 1.2,
    scentDecayRate: 1.4,
  },
};

export class WeatherSystem {
  public currentWeather: WeatherType = 'clear';
  private targetWeather: WeatherType = 'clear';
  private transitionProgress: number = 1.0;
  private weatherTimer: number = 0;
  private weatherDuration: number = 180; // 3 minutes per cycle

  // Particle System
  public weatherParticleGroup: THREE.Group = new THREE.Group();
  private particles: Array<{
    mesh: THREE.Mesh;
    vel: THREE.Vector3;
    baseOffset: THREE.Vector3;
    active: boolean;
  }> = [];

  private rainMaterial: THREE.MeshBasicMaterial;
  private ashMaterial: THREE.MeshBasicMaterial;

  constructor() {
    this.rainMaterial = new THREE.MeshBasicMaterial({
      color: 0x93c5fd,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
    });

    this.ashMaterial = new THREE.MeshBasicMaterial({
      color: 0xf97316,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
    });

    // Create pooled weather particles
    const rainGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.8, 4);
    const ashGeo = new THREE.DodecahedronGeometry(0.06);

    for (let i = 0; i < 90; i++) {
      const isRain = i % 2 === 0;
      const mesh = new THREE.Mesh(isRain ? rainGeo : ashGeo, isRain ? this.rainMaterial : this.ashMaterial);
      mesh.visible = false;
      this.weatherParticleGroup.add(mesh);

      this.particles.push({
        mesh,
        vel: new THREE.Vector3(),
        baseOffset: new THREE.Vector3(
          (Math.random() - 0.5) * 35,
          Math.random() * 20 + 2,
          (Math.random() - 0.5) * 35
        ),
        active: false,
      });
    }
  }

  public setWeather(newWeather: WeatherType) {
    if (this.currentWeather === newWeather) return;
    this.targetWeather = newWeather;
    this.transitionProgress = 0;
    this.currentWeather = newWeather;
    sound.playWeatherShift(newWeather);
  }

  public update(
    dt: number,
    playerPos: THREE.Vector3,
    sunLight: THREE.DirectionalLight,
    scene: THREE.Scene
  ): WeatherCondition {
    this.weatherTimer += dt;
    if (this.weatherTimer > this.weatherDuration) {
      this.weatherTimer = 0;
      // Cycle to next weather
      const list: WeatherType[] = ['clear', 'heavy_rain', 'dense_fog', 'ash_storm'];
      const nextIdx = (list.indexOf(this.currentWeather) + 1) % list.length;
      this.setWeather(list[nextIdx]);
    }

    const currentConfig = WEATHER_CONDITIONS[this.currentWeather];

    // Smoothly interpolate scene fog and sky
    if (scene.fog instanceof THREE.FogExp2) {
      scene.fog.density = THREE.MathUtils.damp(scene.fog.density, currentConfig.fogDensity, 1.5, dt);
      scene.fog.color.lerp(new THREE.Color(currentConfig.fogColor), dt * 1.5);
    }
    if (scene.background instanceof THREE.Color) {
      scene.background.lerp(new THREE.Color(currentConfig.skyColor), dt * 1.5);
    }
    sunLight.intensity = THREE.MathUtils.damp(sunLight.intensity, currentConfig.sunIntensity, 2.0, dt);

    // Update Weather Particles around the player
    const showRain = this.currentWeather === 'heavy_rain';
    const showAsh = this.currentWeather === 'ash_storm';
    const showFog = this.currentWeather === 'dense_fog';

    this.weatherParticleGroup.position.copy(playerPos);

    this.particles.forEach((p, idx) => {
      const isRainParticle = idx % 2 === 0;

      if ((showRain && isRainParticle) || (showAsh && !isRainParticle) || (showFog && idx % 3 === 0)) {
        p.mesh.visible = true;

        if (showRain) {
          // Downward fast rain trajectory
          p.baseOffset.y -= dt * 28;
          if (p.baseOffset.y < -1) {
            p.baseOffset.y = 18 + Math.random() * 4;
            p.baseOffset.x = (Math.random() - 0.5) * 35;
            p.baseOffset.z = (Math.random() - 0.5) * 35;
          }
          p.mesh.position.copy(p.baseOffset);
        } else if (showAsh) {
          // Swirling floating burning ash and embers
          p.baseOffset.y -= dt * 3.5;
          p.baseOffset.x += Math.sin(performance.now() * 0.002 + idx) * dt * 4.5;
          p.baseOffset.z += Math.cos(performance.now() * 0.0018 + idx) * dt * 4.5;
          if (p.baseOffset.y < -1) {
            p.baseOffset.y = 14 + Math.random() * 4;
            p.baseOffset.x = (Math.random() - 0.5) * 35;
            p.baseOffset.z = (Math.random() - 0.5) * 35;
          }
          p.mesh.position.copy(p.baseOffset);
        } else if (showFog) {
          // Low-altitude sulfur geothermal mist drifting across ground
          p.baseOffset.y = 0.5 + Math.sin(performance.now() * 0.001 + idx) * 0.8;
          p.baseOffset.x += Math.sin(performance.now() * 0.0008 + idx) * dt * 2.0;
          p.baseOffset.z += Math.cos(performance.now() * 0.0006 + idx) * dt * 2.0;
          p.mesh.position.copy(p.baseOffset);
        }
      } else {
        p.mesh.visible = false;
      }
    });

    return currentConfig;
  }
}
