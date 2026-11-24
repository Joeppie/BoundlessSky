// The animated space backdrop — a Three.js starfield behind the UI.
//
// Faithful to the reference's use of Three.js/sprites (the engine renders the
// starfield/world through sprites), this is the Phase-1 background only:
// 3 parallax layers of twinkling stars plus a slow drift. No shaders beyond a
// simple star sprite, no world geometry (that's Milestone 2).

import * as THREE from 'three';

const STAR_COUNT = 900;
const layers = [
  { zMin: -40, zMax: -30, size: 1.6, speed: 0.06, opacity: 0.9 },   // far
  { zMin: -30, zMax: -18, size: 2.6, speed: 0.14, opacity: 0.85 },   // mid
  { zMin: -18, zMax: -6,  size: 4.2, speed: 0.30, opacity: 0.95 },   // near
];

const STAR_VS = `
attribute float aPhase;
attribute float aSize;
attribute float aLayer;
uniform float uTime;
uniform float uScale;
varying float vAlpha;

void main() {
  vAlpha = 0.55 + 0.45 * sin(uTime * (0.6 + aLayer * 1.2) + aPhase);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = aSize * uScale * (aLayer > 1.5 ? 1.0 : 0.85);
}`;

const STAR_FS = `
varying float vAlpha;
uniform vec3 uColor;

void main() {
  vec2 uv = gl_PointCoord - 0.5;
  float d = length(uv);
  if (d > 0.5) discard;
  float alpha = (1.0 - d * 2.0) * vAlpha;
  gl_FragColor = vec4(uColor, alpha);
}`;

interface Scene {
  container: HTMLElement;
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  stars: THREE.Points[];
  frameId: number;
  // Handle cleanup / visibility work.
  dispose: () => void;
}

export class Background {
  private scene: Scene | null = null;
  private mouse = { x: 0.5, y: 0.5 };
  private time = 0;
  private running = false;

  start(container: HTMLElement): void {
    if (this.scene) return;

    this.build(container);

    // Respect reduced-motion — render one static frame, never loop.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.staticRender();
      return;
    }

    this.running = true;
    this.animate();
    window.addEventListener('pointermove', this.onPointerMove);
    // Pause the loop while the tab is hidden — the phone keeps the JS clock
    // running otherwise and battery/GPU drain with nothing on screen.
    document.addEventListener('visibilitychange', this.onVisibilityChange);
  }

  // Shared construction path — the animated loop and the static frame both
  // start from the same scene.
  private build(container: HTMLElement): void {
    const containerEl = container;
    const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, powerPreference: 'low-power' });
    renderer.setSize(containerEl.clientWidth, containerEl.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    containerEl.appendChild(renderer.domElement);
    renderer.domElement.id = 'backdrop-canvas';

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, containerEl.clientWidth / containerEl.clientHeight, 0.1, 100);
    camera.position.set(0, 0, 8);

    for (let i = 0; i < layers.length; ++i) {
      scene.add(this.makeLayer(layers[i], i));
    }

    // A soft, glowing nebula gradient is handled by CSS; here we just add a
    // vignette of darkness toward the edges.
    scene.fog = new THREE.Fog(0x05070d, 16, 40);

    this.scene = { container: containerEl, renderer, scene, camera, stars: [], frameId: 0, dispose: () => {} };
    this.resize();
    window.addEventListener('resize', this.resize);
  }

  // Render one static frame — for users who prefer reduced motion.
  private staticRender(): void {
    if (!this.scene || !this.scene.renderer) return;
    this.time = 1;
    for (const child of this.scene.scene.children) {
      if (child instanceof THREE.Points) {
        (child.material as THREE.ShaderMaterial).uniforms.uTime.value = this.time;
      }
    }
    this.scene.renderer.render(this.scene.scene, this.scene.camera);
  }

  private onVisibilityChange = (): void => {
    if (!this.scene) return;
    if (document.hidden) {
      this.running = false;
      cancelAnimationFrame(this.scene.frameId);
    } else if (!this.running) {
      this.running = true;
      this.animate();
    }
  };

  private makeLayer(layer: typeof layers[number], index: number): THREE.Points {
    const perLayer = Math.ceil(STAR_COUNT / layers.length);
    const positions = new Float32Array(perLayer * 3);
    const phases = new Float32Array(perLayer);
    const sizes = new Float32Array(perLayer);
    const layersAttr = new Float32Array(perLayer);

    const layerIndex = index;
    for (let i = 0; i < perLayer; ++i) {
      positions[i * 3 + 0] = (Math.random() - 0.5) * 60;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 24;
      positions[i * 3 + 2] = layer.zMin + Math.random() * (layer.zMax - layer.zMin);
      phases[i] = Math.random() * Math.PI * 2;
      sizes[i] = layer.size * (0.6 + Math.random() * 0.8);
      layersAttr[i] = layerIndex;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute('aLayer', new THREE.BufferAttribute(layersAttr, 1));

    const material = new THREE.ShaderMaterial({
      vertexShader: STAR_VS,
      fragmentShader: STAR_FS,
      transparent: true,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uScale: { value: 1 },
        uColor: { value: new THREE.Color(0xc8d6e8) },
      },
    });

    const points = new THREE.Points(geometry, material);
    points.userData = { ...layer };
    return points;
  }

  private resize = (): void => {
    if (!this.scene) return;
    const w = this.scene.container.clientWidth;
    const h = this.scene.container.clientHeight;
    this.scene.renderer.setSize(w, h);
    this.scene.camera.aspect = w / h;
    this.scene.camera.updateProjectionMatrix();
    for (const child of this.scene.scene.children) {
      const mat = child as THREE.Points;
      if (mat instanceof THREE.Points) {
        (mat.material as THREE.ShaderMaterial).uniforms.uScale.value = Math.min(window.devicePixelRatio, 2);
      }
    }
  };

  private onPointerMove = (event: PointerEvent): void => {
    this.mouse.x = event.clientX / window.innerWidth;
    this.mouse.y = event.clientY / window.innerHeight;
  };

  private animate = (): void => {
    if (!this.scene || !this.running) return;
    const scene = this.scene;
    this.time += 1 / 60;

    // Parallax: drift stars toward the cursor slightly.
    const targetX = (this.mouse.x - 0.5) * 2;
    const targetY = (this.mouse.y - 0.5) * 1.2;
    scene.camera.position.x += (targetX * 1.2 - scene.camera.position.x) * 0.04;
    scene.camera.position.y += (-targetY * 0.8 - scene.camera.position.y) * 0.04;
    scene.camera.lookAt(0, 0, 0);

    scene.scene.children.forEach((child, i) => {
      if (!(child instanceof THREE.Points)) return;
      const data = child.userData as { speed?: number; zMin: number; zMax: number };
      const material = child.material as THREE.ShaderMaterial;
      material.uniforms.uTime.value = this.time;
      const speed = data.speed ?? 0.1;
      child.position.x = (child.position.x + speed * 0.016) % 60;
      if (child.position.x > 30) child.position.x -= 60;
      // Slight rotation for organic feel.
      child.rotation.z += 0.00008 * (i + 1);
    });

    scene.renderer.render(scene.scene, scene.camera);
    scene.frameId = requestAnimationFrame(this.animate);
  }

  stop(): void {
    if (!this.scene) return;
    this.running = false;
    cancelAnimationFrame(this.scene.frameId);
    window.removeEventListener('resize', this.resize);
    window.removeEventListener('pointermove', this.onPointerMove);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.scene.renderer.dispose();
    this.scene.container.removeChild(this.scene.renderer.domElement);
    this.scene = null;
  }
}
