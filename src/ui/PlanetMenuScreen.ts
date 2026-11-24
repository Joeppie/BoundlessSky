// The planet menu — the milestone-1 tail of the start flow: after the landing
// splash, the player arrives at the start planet and the planet panel opens.
//
// Faithful-enough subset of the reference's PlanetPanel (endless-sky/source/
// PlanetPanel.cpp + the "planet" interface): landscape image, description
// paragraphs (with "to display" conditions evaluated against the live player
// conditions), the planet's named shops (Shipyard) and Depart (back to the menu —
// the map and takeoff are Milestone 2+).

import { createScreen } from './Panel';
import type { Audio } from '../audio/Audio';
import type { PlayerInfo } from '../game/PlayerInfo';
import type { Planet } from '../game/Planet';

export interface PlanetMenuScreenOptions {
  audio: Audio;
  player: PlayerInfo;
  // A fresh promise each call — the screen loads lazily, like the shipyard.
  loadPlanet: () => Promise<Planet>;
  onShipyard: () => void;
  onDepart: () => void;
}

export class PlanetMenuScreen {
  readonly element: HTMLElement;
  private audio: Audio;
  private player: PlayerInfo;
  private loadPlanet: () => Promise<Planet>;
  private onShipyard: () => void;
  private onDepart: () => void;

  private planet: Planet | null = null;
  private loading = true;
  private failure: string | null = null;
  private destroyed = false;

  // DOM
  private headerEl: HTMLElement;
  private landscapeEl: HTMLImageElement;
  private descriptionEl: HTMLElement;
  private shipyardButton: HTMLButtonElement;
  private departButton: HTMLButtonElement;

  constructor(options: PlanetMenuScreenOptions) {
    this.audio = options.audio;
    this.player = options.player;
    this.loadPlanet = options.loadPlanet;
    this.onShipyard = options.onShipyard;
    this.onDepart = options.onDepart;

    this.element = createScreen('planet-menu-screen');

    const inner = document.createElement('div');
    inner.className = 'planet-menu-inner';

    this.headerEl = document.createElement('div');
    this.headerEl.className = 'planet-menu-header';
    this.landscapeEl = document.createElement('img');
    this.landscapeEl.className = 'planet-menu-landscape';
    this.landscapeEl.alt = '';
    this.landscapeEl.addEventListener('error', () => { this.landscapeEl.style.display = 'none'; });
    this.descriptionEl = document.createElement('div');
    this.descriptionEl.className = 'planet-menu-description';

    const buttons = document.createElement('div');
    buttons.className = 'planet-menu-buttons';

    this.shipyardButton = document.createElement('button');
    this.shipyardButton.type = 'button';
    this.shipyardButton.className = 'planet-menu-shipyard';
    this.shipyardButton.innerHTML = 'Shipyard';
    this.shipyardButton.addEventListener('mouseenter', () => this.audio.play('soft'));
    this.shipyardButton.addEventListener('click', () => {
      this.audio.play('normal');
      this.onShipyard();
    });

    this.departButton = document.createElement('button');
    this.departButton.type = 'button';
    this.departButton.className = 'planet-menu-depart';
    this.departButton.innerHTML = '<span class="menu-key">Esc</span> Depart';
    this.departButton.addEventListener('mouseenter', () => this.audio.play('soft'));
    this.departButton.addEventListener('click', () => {
      this.audio.play('normal');
      this.onDepart();
    });

    buttons.append(this.shipyardButton, this.departButton);

    inner.append(this.landscapeEl, this.headerEl, this.descriptionEl, buttons);
    this.element.appendChild(inner);

    this.load();
  }

  // (Re)load the planet from scratch. A failure renders an error state with a
  // Retry button — never a silent "Loading…" that never resolves.
  private load(): void {
    if (this.destroyed) return;
    this.loading = true;
    this.failure = null;
    this.planet = null;
    this.render();
    this.loadPlanet()
      .then((planet) => {
        if (this.destroyed) return;
        this.planet = planet;
        this.loading = false;
        this.render();
      })
      .catch((err) => {
        if (this.destroyed) return;
        console.warn('planet menu failed to load', err);
        this.failure = `Could not load ${this.player.planetName || 'the planet'} — ${err instanceof Error ? err.message : 'try again'}`;
        this.loading = false;
        this.render();
      });
  }

  private render(): void {
    if (this.loading || !this.planet) {
      this.landscapeEl.removeAttribute('src');
      this.landscapeEl.style.display = 'none';
      this.headerEl.innerHTML = '';
      const kicker = document.createElement('div');
      kicker.className = 'planet-menu-kicker';
      kicker.textContent = 'Landing';
      this.headerEl.appendChild(kicker);
      const status = document.createElement('div');
      status.className = this.failure ? 'planet-menu-error' : 'planet-menu-loading';
      status.textContent = this.failure ?? 'Loading the planet…';
      this.headerEl.appendChild(status);
      if (this.failure) {
        const retry = document.createElement('button');
        retry.type = 'button';
        retry.className = 'planet-menu-retry';
        retry.innerHTML = '<span class="menu-key">R</span> Retry';
        retry.addEventListener('mouseenter', () => this.audio.play('soft'));
        retry.addEventListener('click', () => { this.audio.play('normal'); this.load(); });
        this.headerEl.appendChild(retry);
      }
      this.descriptionEl.innerHTML = '';
      this.shipyardButton.style.display = 'none';
      this.departButton.style.display = 'none';
      this.departButton.disabled = true;
      return;
    }

    const planet = this.planet;
    const hasShip = this.player.ships.length > 0;

    // Landscape.
    if (planet.landscape) {
      this.landscapeEl.src = `/content/images/${planet.landscape}.jpg`;
      this.landscapeEl.alt = `${planet.name} landscape`;
      this.landscapeEl.style.display = '';
    } else {
      this.landscapeEl.removeAttribute('src');
      this.landscapeEl.style.display = 'none';
    }

    // Header.
    this.headerEl.innerHTML = '';
    const kicker = document.createElement('div');
    kicker.className = 'planet-menu-kicker';
    kicker.textContent = `Landed in ${this.player.systemName || planet.name}`;
    const title = document.createElement('h1');
    title.className = 'planet-menu-title';
    title.textContent = planet.name;
    const meta = document.createElement('div');
    meta.className = 'planet-menu-meta';
    const attributeLine = planet.attributes.join(' · ');
    meta.textContent = attributeLine || '—';
    this.headerEl.append(kicker, title, meta);

    // Description — only the paragraphs whose conditions match the live store.
    this.descriptionEl.innerHTML = '';
    const visible = planet.description.filter(p => p.conditions.test());
    if (visible.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'planet-menu-description-empty';
      empty.textContent = 'No description available for this planet.';
      this.descriptionEl.appendChild(empty);
    } else {
      for (const paragraph of visible) {
        const p = document.createElement('p');
        p.className = 'planet-menu-description-text';
        p.textContent = paragraph.text;
        this.descriptionEl.appendChild(p);
      }
    }

    // Buttons.
    this.shipyardButton.style.display = planet.shipyards.length > 0 ? '' : 'none';
    this.shipyardButton.disabled = false;
    this.shipyardButton.innerHTML = 'Shipyard';
    this.departButton.style.display = '';
    this.departButton.disabled = !hasShip;
    this.departButton.classList.toggle('is-disabled', !hasShip);
  }

  // --- lifecycle ──────────────────────────────────────────────────────────

  mount(): void {
    requestAnimationFrame(() => this.element.classList.add('is-visible'));
  }

  unmount(): void {
    this.destroyed = true;
    this.element.classList.remove('is-visible');
  }

  handleKey(event: KeyboardEvent): boolean {
    if (event.key === 'Escape' || event.key === 'd' || event.key === 'D') {
      if (this.player.ships.length > 0) {
        this.audio.play('normal');
        this.onDepart();
        return true;
      }
      return false; // no ship — Depart is not available, stay politely
    }
    if ((event.key === 'r' || event.key === 'R') && this.failure) {
      this.audio.play('normal');
      this.load();
      return true;
    }
    return false;
  }
}
