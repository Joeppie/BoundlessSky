// The loading screen — the game's first state. Fetches the data files, decodes
// the sounds and preloads the sprites, then hands off to the main menu.

import { createScreen } from './Panel';
import { loadGameData, type LoadedGameData } from '../data/GameData';
import { Audio } from '../audio/Audio';

const MENU_SPRITES = [
  'images/_menu/title@1x.png',
  'images/_menu/side panel@1x.png',
  'images/_menu/buttonless side panel@1x.png',
  'images/_menu/scenario panel@1x.png',
  'images/_menu/compass@1x.png',
  'images/_menu/g5.png',
  'images/_menu/forest2.png',
  'images/_menu/oberon.png',
];

const SCENE_SPRITES = [
  'images/scene/lobby.jpg',
  'images/scene/train.jpg',
  'images/scene/reception.jpg',
  'images/scene/icy opening.jpg',
  'images/scene/hai shipyard.jpg',
  'images/scene/new boston.jpg',
  'images/scene/midgard.jpg',
  'images/scene/mainsail.jpg',
  'images/scene/earth.jpg',
  'images/scene/greenwater.jpg',
];

const CONTENT_BASE = '/content';
// Hold the boot screen for at least this long so the transition feels deliberate.
const MIN_BOOT_MS = 1600;

export class LoadingScreen {
  readonly element: HTMLElement;
  private titleEl: HTMLElement;
  private statusEl: HTMLElement;
  private barEl: HTMLElement;
  private percentEl: HTMLElement;
  private audio: Audio;
  private data: LoadedGameData | null = null;
  private onDone: () => void;

  constructor(audio: Audio, onDone: () => void) {
    this.audio = audio;
    this.onDone = onDone;
    this.element = createScreen('loading-screen');

    const inner = document.createElement('div');
    inner.className = 'loading-inner';

    const kicker = document.createElement('div');
    kicker.className = 'loading-kicker';
    kicker.textContent = 'Endless Sky Engine';

    this.titleEl = document.createElement('h1');
    this.titleEl.className = 'loading-title';
    this.titleEl.textContent = 'BOUNDLESS SKY';

    this.statusEl = document.createElement('p');
    this.statusEl.className = 'loading-status';
    this.statusEl.textContent = 'Booting…';

    const barOuter = document.createElement('div');
    barOuter.className = 'loading-bar';
    this.barEl = document.createElement('div');
    this.barEl.className = 'loading-bar-fill';
    barOuter.appendChild(this.barEl);

    this.percentEl = document.createElement('div');
    this.percentEl.className = 'loading-percent';
    this.percentEl.textContent = '0%';

    const hint = document.createElement('div');
    hint.className = 'loading-hint';
    hint.textContent = 'Loading the game  ·  minimal endless sky';

    const scanlines = document.createElement('div');
    scanlines.className = 'loading-scanlines';

    inner.append(kicker, this.titleEl, this.statusEl, barOuter, this.percentEl, hint);
    this.element.append(inner, scanlines);
  }

  mount(): void {
    requestAnimationFrame(() => this.element.classList.add('is-visible'));
    this.run().catch((error) => {
      this.statusEl.textContent = `Failed: ${error?.message ?? error}`;
      console.error(error);
    });
  }

  unmount(): void {
    this.element.classList.remove('is-visible');
  }

  handleKey(event: KeyboardEvent): boolean {
    // Any key during boot just resumes the audio context; it does not skip loading.
    this.audio.resume().catch(() => {});
    return event.key === 'Enter' || event.key === ' ';
  }

  private setProgress(fraction: number, message: string): void {
    const pct = Math.max(0, Math.min(1, fraction));
    this.barEl.style.width = `${Math.round(pct * 100)}%`;
    this.percentEl.textContent = `${Math.round(pct * 100)}%`;
    if (message) this.statusEl.textContent = message;
  }

  private loadImage(src: string): Promise<boolean> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      img.src = src;
    });
  }

  private async run(): Promise<void> {
    const startedAt = performance.now();
    // Phase 1: data (starts.txt + parse + scenario build).
    this.setProgress(0.05, 'Fetching start scenarios…');
    const data = await loadGameData((fraction, message) => {
      this.setProgress(fraction * 0.55, message);
    });
    this.data = data;

    // Phase 2: images (menu sprites + scenes + scenario thumbnails).
    const thumbs = data.starts.map(s => s.getThumbnail()).filter((name): name is string => !!name);
    const imageSet = new Set([...MENU_SPRITES, ...SCENE_SPRITES]);
    for (const thumb of thumbs) imageSet.add(`images/${thumb}.jpg`);
    const images = [...imageSet].map(name => `${CONTENT_BASE}/${name}`);

    let imagesDone = 0;
    const imageWeight = 0.35;
    const totalImages = images.length;
    const imageResults = await Promise.allSettled(
      images.map(async (url) => {
        const ok = await this.loadImage(url);
        imagesDone += 1;
        const done = imagesDone / totalImages;
        this.setProgress(0.55 + done * imageWeight, `Preloading sprites (${imagesDone}/${totalImages})…`);
        return ok;
      }),
    );
    void imageResults;

    // Phase 3: sounds (decode the UI wavs).
    this.setProgress(0.92, 'Loading sounds…');
    await this.audio.init((fraction, message) => {
      this.setProgress(0.92 + fraction * 0.08, message);
    });

    // Phase 4: done — hold the "Ready" frame for at least MIN_BOOT_MS total.
    this.setProgress(1, 'Ready');
    const elapsed = performance.now() - startedAt;
    const holdMs = Math.max(0, MIN_BOOT_MS - elapsed) + 250;
    window.setTimeout(() => this.onDone(), holdMs);
  }
}
