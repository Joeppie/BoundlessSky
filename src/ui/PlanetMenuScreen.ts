// The planet menu — the milestone-1 tail of the start flow: after the landing
// splash, the player arrives at the start planet and the planet panel opens.
//
// Faithful to the reference's PlanetPanel (endless-sky/source/PlanetPanel.cpp +
// the "planet" interface): landscape image on top, the description in the
// center, a left column of service buttons and a right column of buttons —
// Player Info, Shipyard, Outfitter and Depart — with the same visibility rules
// (Depart active only when the player has a ship; Shipyard/Outfitter shown for
// the planet's named shops). Tabs, the outfit details and the shipyard remain
// honest: unimplemented panels (Spaceport, Bank, Trading, Job Board, Hire
// Crew) are omitted rather than faked.

import { createScreen } from './Panel';
import type { Audio } from '../audio/Audio';
import type { PlayerInfo } from '../game/PlayerInfo';
import type { Planet } from '../game/Planet';

export interface PlanetMenuScreenOptions {
  audio: Audio;
  player: PlayerInfo;
  // A fresh promise each call — the screen loads lazily, like the shipyard.
  loadPlanet: () => Promise<Planet>;
  // The shops of the planet that opened the button — never a hardcoded list.
  onShipyard: (planet: Planet) => void;
  onOutfitter: (planet: Planet) => void;
  onPlayerInfo: () => void;
  onDepart: () => void;
}

export class PlanetMenuScreen {
  readonly element: HTMLElement;
  private audio: Audio;
  private player: PlayerInfo;
  private loadPlanet: () => Promise<Planet>;
  private onShipyard: (planet: Planet) => void;
  private onOutfitter: (planet: Planet) => void;
  private onPlayerInfo: () => void;
  private onDepart: () => void;

  private planet: Planet | null = null;
  private loading = true;
  private failure: string | null = null;
  private destroyed = false;

  // DOM
  private headerEl: HTMLElement;
  private landscapeEl: HTMLImageElement;
  private descriptionEl: HTMLElement;
  private playerInfoButton: HTMLButtonElement;
  private shipyardButton: HTMLButtonElement;
  private outfitterButton: HTMLButtonElement;
  private departButton: HTMLButtonElement;

  constructor(options: PlanetMenuScreenOptions) {
    this.audio = options.audio;
    this.player = options.player;
    this.loadPlanet = options.loadPlanet;
    this.onShipyard = options.onShipyard;
    this.onOutfitter = options.onOutfitter;
    this.onPlayerInfo = options.onPlayerInfo;
    this.onDepart = options.onDepart;

    this.element = createScreen('planet-menu-screen');

    const inner = document.createElement('div');
    inner.className = 'planet-menu-inner';

    this.landscapeEl = document.createElement('img');
    this.landscapeEl.className = 'planet-menu-landscape';
    this.landscapeEl.alt = '';
    this.landscapeEl.addEventListener('error', () => { this.landscapeEl.style.display = 'none'; });

    this.headerEl = document.createElement('div');
    this.headerEl.className = 'planet-menu-header';

    this.playerInfoButton = document.createElement('button');
    this.playerInfoButton.type = 'button';
    this.playerInfoButton.className = 'planet-menu-button planet-menu-button--left planet-menu-playerinfo';
    this.playerInfoButton.innerHTML = 'Player Info';
    this.playerInfoButton.addEventListener('mouseenter', () => this.audio.play('soft'));
    this.playerInfoButton.addEventListener('click', () => { this.audio.play('normal'); this.onPlayerInfo(); });

    this.shipyardButton = document.createElement('button');
    this.shipyardButton.type = 'button';
    this.shipyardButton.className = 'planet-menu-button planet-menu-button--primary planet-menu-shipyard';
    this.shipyardButton.innerHTML = 'Shipyard';
    this.shipyardButton.addEventListener('mouseenter', () => this.audio.play('soft'));
    this.shipyardButton.addEventListener('click', () => {
      const planet = this.planet;
      if (!planet) return;
      this.audio.play('normal');
      this.onShipyard(planet);
    });

    this.outfitterButton = document.createElement('button');
    this.outfitterButton.type = 'button';
    this.outfitterButton.className = 'planet-menu-button planet-menu-button--primary planet-menu-outfitter';
    this.outfitterButton.innerHTML = 'Outfitter';
    this.outfitterButton.addEventListener('mouseenter', () => this.audio.play('soft'));
    this.outfitterButton.addEventListener('click', () => {
      const planet = this.planet;
      if (!planet) return;
      this.audio.play('normal');
      this.onOutfitter(planet);
    });

    this.departButton = document.createElement('button');
    this.departButton.type = 'button';
    this.departButton.className = 'planet-menu-button planet-menu-button--depart planet-menu-depart';
    this.departButton.innerHTML = '<span class="menu-key">Esc</span> Depart';
    this.departButton.addEventListener('mouseenter', () => this.audio.play('soft'));
    this.departButton.addEventListener('click', () => {
      this.audio.play('normal');
      this.onDepart();
    });

    const leftCol = document.createElement('div');
    leftCol.className = 'planet-menu-col planet-menu-col--left';
    leftCol.appendChild(this.playerInfoButton);

    this.descriptionEl = document.createElement('div');
    this.descriptionEl.className = 'planet-menu-center';

    const rightCol = document.createElement('div');
    rightCol.className = 'planet-menu-col planet-menu-col--right';
    rightCol.append(this.shipyardButton, this.outfitterButton, this.departButton);

    const grid = document.createElement('div');
    grid.className = 'planet-menu-grid';
    grid.append(leftCol, this.descriptionEl, rightCol);

    inner.append(this.landscapeEl, this.headerEl, grid);
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
    const hasShip = this.player.ships.length > 0;

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
      this.playerInfoButton.style.display = 'none';
      this.shipyardButton.style.display = 'none';
      this.outfitterButton.style.display = 'none';
      this.departButton.style.display = 'none';
      return;
    }

    const planet = this.planet;

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
    meta.textContent = planet.attributes.join(' · ') || '—';
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
    this.playerInfoButton.style.display = '';
    this.playerInfoButton.innerHTML = 'Player Info';
    this.shipyardButton.style.display = planet.shipyards.length > 0 ? '' : 'none';
    this.shipyardButton.disabled = false;
    this.outfitterButton.style.display = planet.outfitters.length > 0 ? '' : 'none';
    this.outfitterButton.disabled = false;
    this.departButton.style.display = '';
    this.departButton.disabled = !hasShip;
    this.departButton.classList.toggle('is-disabled', !hasShip);
  }

  // --- keyboard + lifecycle ──────────────────────────────────────────────

  handleKey(event: KeyboardEvent): boolean {
    if (event.key === 'Escape') {
      if (this.player.ships.length > 0) {
        this.audio.play('normal');
        this.onDepart();
        return true;
      }
      return false;
    }
    if ((event.key === 'r' || event.key === 'R') && this.failure) {
      this.audio.play('normal');
      this.load();
      return true;
    }
    return false;
  }

  mount(): void {
    requestAnimationFrame(() => this.element.classList.add('is-visible'));
  }

  unmount(): void {
    this.destroyed = true;
    this.element.classList.remove('is-visible');
  }
}
