/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';

export interface SafeRendererOptions {
  antialias?: boolean;
  isHeadless?: boolean;
  reuseMainSingleton?: boolean;
  reusePreviewSingleton?: boolean;
}

let sharedMainRenderer: THREE.WebGLRenderer | null = null;
let sharedMainContextLost = false;
let sharedPreviewRenderer: THREE.WebGLRenderer | null = null;
let sharedPreviewContextLost = false;

/**
 * Projects a 3D world point into 2D canvas coordinates for the Canvas2D fallback renderer
 * when the browser tab has temporarily blocked WebGL contexts.
 */
function projectPoint3D(
  worldPos: THREE.Vector3,
  viewProjMatrix: THREE.Matrix4,
  width: number,
  height: number,
  out: { x: number; y: number; z: number; visible: boolean }
) {
  const v = worldPos.clone().applyMatrix4(viewProjMatrix);
  if (v.z < -1 || v.z > 1) {
    out.visible = false;
    return;
  }
  out.x = (v.x * 0.5 + 0.5) * width;
  out.y = (-v.y * 0.5 + 0.5) * height;
  out.z = v.z;
  out.visible = out.x >= -100 && out.x <= width + 100 && out.y >= -100 && out.y <= height + 100;
}

/**
 * Creates a zero-crash Canvas2D 3D projection fallback renderer that implements the
 * THREE.WebGLRenderer interface used by GameEngine and BeastopediaModal if the browser
 * has blocked WebGL context creation (`Web page caused context loss and was blocked`).
 */
function createCanvas2DFallbackRenderer(width = 800, height = 600): THREE.WebGLRenderer {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  let currentWidth = width;
  let currentHeight = height;
  let pixelRatio = 1;

  const viewProjMatrix = new THREE.Matrix4();
  const tempPos = new THREE.Vector3();
  const tempBox = new THREE.Box3();
  const tempSize = new THREE.Vector3();
  const projOut = { x: 0, y: 0, z: 0, visible: false };

  const fallbackRenderer = {
    domElement: canvas,
    isFallbackRenderer: true,
    outputColorSpace: THREE.SRGBColorSpace,
    toneMapping: THREE.ACESFilmicToneMapping,
    toneMappingExposure: 1.1,
    shadowMap: {
      enabled: false,
      type: THREE.PCFShadowMap,
      autoUpdate: false,
      needsUpdate: false,
    },
    capabilities: {
      isWebGL2: false,
      getMaxAnisotropy: () => 1,
      maxTextures: 16,
      maxVertexTextures: 4,
      maxTextureSize: 2048,
      maxCubemapSize: 1024,
      precision: 'highp',
    },
    info: {
      memory: { geometries: 0, textures: 0 },
      render: { frame: 0, calls: 0, triangles: 0, points: 0, lines: 0 },
      programs: [],
      autoReset: true,
      reset: () => {},
    },
    setSize(w: number, h: number, updateStyle = true) {
      currentWidth = Math.max(1, Math.floor(w));
      currentHeight = Math.max(1, Math.floor(h));
      canvas.width = Math.floor(currentWidth * pixelRatio);
      canvas.height = Math.floor(currentHeight * pixelRatio);
      if (updateStyle) {
        canvas.style.width = `${currentWidth}px`;
        canvas.style.height = `${currentHeight}px`;
      }
    },
    setPixelRatio(r: number) {
      pixelRatio = Math.max(1, Math.min(2, r || 1));
      canvas.width = Math.floor(currentWidth * pixelRatio);
      canvas.height = Math.floor(currentHeight * pixelRatio);
    },
    getPixelRatio() {
      return pixelRatio;
    },
    getSize(target: THREE.Vector2) {
      return target.set(currentWidth, currentHeight);
    },
    compile(_scene: THREE.Object3D, _camera: THREE.Camera) {
      // No-op in Canvas2D software fallback mode
    },
    setClearColor() {},
    clear() {},
    render(scene: THREE.Scene, camera: THREE.Camera) {
      if (!ctx) return;
      const w = canvas.width;
      const h = canvas.height;
      ctx.save();

      // Background sky gradient synced with scene.background
      const bgHex =
        scene.background instanceof THREE.Color ? `#${scene.background.getHexString()}` : '#1a2636';
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, bgHex);
      grad.addColorStop(0.55, '#2b4257');
      grad.addColorStop(0.56, '#284b2a');
      grad.addColorStop(1, '#182e1b');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      camera.updateMatrixWorld();
      if ((camera as THREE.PerspectiveCamera).isPerspectiveCamera) {
        (camera as THREE.PerspectiveCamera).updateProjectionMatrix();
      }
      viewProjMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);

      // Collect visible top-level actors & props for painter's algorithm depth sort
      const drawables: Array<{
        x: number;
        y: number;
        z: number;
        radiusPx: number;
        color: string;
        label?: string;
      }> = [];

      scene.children.forEach((child) => {
        if (!child.visible) return;
        child.getWorldPosition(tempPos);
        const dist = camera.position.distanceTo(tempPos);
        if (dist < 0.5 || dist > 260) return;

        projectPoint3D(tempPos, viewProjMatrix, w, h, projOut);
        if (!projOut.visible) return;

        tempBox.setFromObject(child);
        tempBox.getSize(tempSize);
        const worldRadius = Math.max(0.6, Math.min(8, Math.max(tempSize.x, tempSize.y) * 0.35));
        const radiusPx = Math.max(4, Math.min(90, (worldRadius / Math.max(1, dist)) * (h * 0.75)));

        let color = '#64748b';
        if (child.name.includes('Pelvis') || child.children.some((c) => c.name === 'Pelvis_Root')) {
          color = '#38bdf8';
        } else if (tempSize.y > 2.2) {
          color = '#f59e0b';
        }
        drawables.push({
          x: projOut.x,
          y: projOut.y,
          z: dist,
          radiusPx,
          color,
        });
      });

      drawables.sort((a, b) => b.z - a.z);
      for (const item of drawables) {
        ctx.beginPath();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.32)';
        ctx.ellipse(
          item.x,
          item.y + item.radiusPx * 0.45,
          item.radiusPx * 0.85,
          item.radiusPx * 0.3,
          0,
          0,
          Math.PI * 2
        );
        ctx.fill();

        ctx.beginPath();
        ctx.fillStyle = item.color;
        ctx.arc(item.x, item.y - item.radiusPx * 0.25, item.radiusPx * 0.65, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.45)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      ctx.restore();
    },
    dispose() {
      // Nothing to release in Canvas2D fallback
    },
  };

  return fallbackRenderer as unknown as THREE.WebGLRenderer;
}

/**
 * Acquires a resilient WebGLRenderer with multi-stage context fallback and automatic
 * singleton reuse so WebGL context limits or prior context loss never crash the app.
 */
export function createSafeWebGLRenderer(
  width: number,
  height: number,
  options: SafeRendererOptions = {}
): { renderer: THREE.WebGLRenderer; isWebGLAvailable: boolean } {
  const {
    antialias = true,
    isHeadless = false,
    reuseMainSingleton = false,
    reusePreviewSingleton = false,
  } = options;

  if (reuseMainSingleton && sharedMainRenderer && !sharedMainContextLost) {
    try {
      const gl = sharedMainRenderer.getContext();
      if (gl && !gl.isContextLost()) {
        sharedMainRenderer.setSize(width, height);
        return { renderer: sharedMainRenderer, isWebGLAvailable: true };
      }
    } catch {
      sharedMainRenderer = null;
    }
  }

  if (reusePreviewSingleton && sharedPreviewRenderer && !sharedPreviewContextLost) {
    try {
      const gl = sharedPreviewRenderer.getContext();
      if (gl && !gl.isContextLost()) {
        sharedPreviewRenderer.setSize(width, height);
        return { renderer: sharedPreviewRenderer, isWebGLAvailable: true };
      }
    } catch {
      sharedPreviewRenderer = null;
    }
  }

  const attempts: THREE.WebGLRendererParameters[] = [
    {
      powerPreference: 'default',
      antialias: antialias && !isHeadless,
      stencil: false,
      depth: true,
      preserveDrawingBuffer: false,
      failIfMajorPerformanceCaveat: false,
    },
    {
      powerPreference: 'low-power',
      antialias: false,
      stencil: false,
      depth: true,
      preserveDrawingBuffer: false,
      failIfMajorPerformanceCaveat: false,
    },
  ];

  for (const params of attempts) {
    try {
      const testCanvas = document.createElement('canvas');
      const gl =
        (testCanvas.getContext('webgl2', {
          antialias: Boolean(params.antialias),
          stencil: false,
          depth: true,
          powerPreference: params.powerPreference,
          failIfMajorPerformanceCaveat: false,
        }) as WebGLRenderingContext | null) ||
        (testCanvas.getContext('webgl', {
          antialias: false,
          stencil: false,
          depth: true,
          failIfMajorPerformanceCaveat: false,
        }) as WebGLRenderingContext | null) ||
        (testCanvas.getContext('experimental-webgl') as WebGLRenderingContext | null);

      if (!gl || gl.isContextLost()) {
        continue;
      }

      const renderer = new THREE.WebGLRenderer({
        canvas: testCanvas,
        context: gl,
        ...params,
      });

      testCanvas.addEventListener(
        'webglcontextlost',
        (event) => {
          event.preventDefault();
          if (renderer === sharedMainRenderer) {
            sharedMainContextLost = true;
          }
          if (renderer === sharedPreviewRenderer) {
            sharedPreviewContextLost = true;
          }
        },
        false
      );

      testCanvas.addEventListener(
        'webglcontextrestored',
        () => {
          if (renderer === sharedMainRenderer) {
            sharedMainContextLost = false;
          }
          if (renderer === sharedPreviewRenderer) {
            sharedPreviewContextLost = false;
          }
        },
        false
      );

      renderer.setSize(width, height);
      if (reuseMainSingleton) {
        sharedMainRenderer = renderer;
        sharedMainContextLost = false;
      }
      if (reusePreviewSingleton) {
        sharedPreviewRenderer = renderer;
        sharedPreviewContextLost = false;
      }
      return { renderer, isWebGLAvailable: true };
    } catch {
      // Continue to next fallback attempt
    }
  }

  // All WebGL context creation attempts were blocked by the browser; use Canvas2D fallback so the app never crashes
  const fallback = createCanvas2DFallbackRenderer(width, height);
  return { renderer: fallback, isWebGLAvailable: false };
}
