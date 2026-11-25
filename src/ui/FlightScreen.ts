// The flight view — the ship flies through the system: momentum remains, max
// speed is capped (from the ship's real data), and landing on a planet
// requires being over that planet and slow. Warp requires the ship to be
// nearly stopped AND it to have a hyperdrive. The reference does not have a
// continuous in-system flight mode — this milestone adds a simplified flight
// model on top of the same real data (map systems.txt / map planets.txt / the
// ship and its installed outfits). Physics are documented in
// src/game/FlightSim.ts. Not modeled: jump ranges, fuel costs, cloaking.

import { createScreen } from './Panel';
import type { Audio } from '../audio/Audio';
import type { PlayerInfo } from '../game/PlayerInfo';
import type { Planet } from '../game/Planet';
import type { System, SystemPlanet } from '../game/System';
import type { ShipPhysics } from '../game/FlightSim';
import {
  createFlightState,
  stepFlight,
  canWarp,
  canLand,
  NO_INPUT,
  type FlightState,
  type FlightInput,
} from '../game/FlightSim';

// A landable planet — a named world in the current system, with its spec.
export interface LandableTarget {
  planet: SystemPlanet;
  spec: Planet;
}

// A jump-neighbor system — either a warp destination (named planet with a
// spec) or a disabled row (no landable named planet in this milestone).
export interface WarpRow {
  system: System;
  planet: SystemPlanet | null;
  spec: Planet | null;
  disabledReason: string | null;
}

export interface FlightScreenOptions {
  audio: Audio;
  player: PlayerInfo;
  // Synchronous strings for the header — the system and the planet the ship
  // is departing from.
  systemName: string;
  planetName: string;
  // Resolve the whole flight scene (system, spawn planet, physics).
  loadFlight: () => Promise<{
    system: System;
    spawnPlanet: LandableTarget;
    landable: LandableTarget[];
    physics: ShipPhysics;
    hasHyperdrive: boolean;
  }>;
  // Lazy warp options — only loaded when the warp picker opens.
  loadDestinations: (system: System) => Promise<WarpRow[]>;
  onLand: (spec: Planet, system: System) => void;
  onWarp: (system: System, planetName: string) => void;
  onAbort: () => void;
  onMenu: () => void;
}

const SVG_NS = 'http://www.w3.org/2000/svg';
const VIEW = 800;
const CENTER = VIEW / 2;

// The flight view runs the simulation at a reduced rate — the reference's
// ship speeds cross the drawn system in under a second, which is no fun to
// watch. The physics (thrust, max speed, turn, drag) are unchanged — only
// the time the view runs at is reduced — a documented, honest view choice.
const TIME_SCALE = 0.25;

export class FlightScreen {
  readonly element: HTMLElement;
  private audio: Audio;
  private player: PlayerInfo;
  private systemName: string;
  private planetName: string;
  private loadFlight: () => Promise<{
    system: System;
    spawnPlanet: LandableTarget;
    landable: LandableTarget[];
    physics: ShipPhysics;
    hasHyperdrive: boolean;
  }>;
  private loadDestinations: (system: System) => Promise<WarpRow[]>;
  private onLand: (spec: Planet, system: System) => void;
  private onWarp: (system: System, planetName: string) => void;
  private onAbort: () => void;
  private onMenu: () => void;

  private destroyed = false;
  private system: System | null = null;
  private spawnPlanet: LandableTarget | null = null;
  private landable: LandableTarget[] = [];
  private physics: ShipPhysics | null = null;
  private hasHyperdrive = false;
  private destinationsLoaded = false;
  private destinations: WarpRow[] = [];
  private warpPickerOpen = false;
  private warpAnimation = false;
  private state: FlightState = createFlightState(0, 0, 0);
  private input: FlightInput = { ...NO_INPUT };
  private keyupHandler: (event: KeyboardEvent) => void;
  private animationFrame: number | null = null;
  private lastTimestamp = 0;

  private shipGroup: SVGGElement | null = null;
  private speedText: HTMLElement | null = null;
  private maxSpeedText: HTMLElement | null = null;
  private warpButton: HTMLButtonElement | null = null;
  private landButton: HTMLButtonElement | null = null;
  private statusText: HTMLElement | null = null;
  private mapSvg: SVGSVGElement | null = null;
  private loadingEl: HTMLElement | null = null;
  private overlayEl: HTMLElement | null = null;
  private planetOrbitScale = 1;

  constructor(options: FlightScreenOptions) {
    this.audio = options.audio;
    this.player = options.player;
    this.systemName = options.systemName;
    this.planetName = options.planetName;
    this.loadFlight = options.loadFlight;
    this.loadDestinations = options.loadDestinations;
    this.onLand = options.onLand;
    this.onWarp = options.onWarp;
    this.onAbort = options.onAbort;
    this.onMenu = options.onMenu;

    // Hold-style keys need a keyup to release — the global route only fires
    // keydown, so the flight view routes keyup itself.
    this.keyupHandler = (event) => this.handleKeyUp(event);
    window.addEventListener('keyup', this.keyupHandler);

    this.element = createScreen('flight-screen');

    const inner = document.createElement('div');
    inner.className = 'flight-inner';

    const header = document.createElement('div');
    header.className = 'flight-header';
    const headerRow = document.createElement('div');
    headerRow.className = 'flight-header-row';
    const kicker = document.createElement('div');
    kicker.className = 'flight-kicker';
    kicker.textContent = `${this.systemName} — flight`;
    headerRow.appendChild(kicker);
    const menuBtn = document.createElement('button');
    menuBtn.type = 'button';
    menuBtn.className = 'flight-menu-button';
    menuBtn.textContent = 'Menu';
    menuBtn.addEventListener('mouseenter', () => this.audio.play('soft'));
    menuBtn.addEventListener('click', () => { this.audio.play('normal'); this.onMenu(); });
    headerRow.appendChild(menuBtn);
    const title = document.createElement('h1');
    title.className = 'flight-title';
    title.textContent = 'Fly to another planet';
    const sub = document.createElement('div');
    sub.className = 'flight-sub';
    sub.textContent = 'Momentum remains. Brake to a stop to warp. Land by being over a planet and slow.';
    header.append(headerRow, title, sub);

    this.mapSvg = document.createElementNS(SVG_NS, 'svg');
    this.mapSvg.setAttribute('viewBox', `0 0 ${VIEW} ${VIEW}`);
    this.mapSvg.setAttribute('class', 'flight-map');
    this.loadingEl = document.createElement('div');
    this.loadingEl.className = 'flight-loading';
    this.loadingEl.textContent = 'Loading the system…';
    const mapWrap = document.createElement('div');
    mapWrap.className = 'flight-map-wrap';
    mapWrap.append(this.loadingEl, this.mapSvg);

    const panel = document.createElement('div');
    panel.className = 'flight-panel';

    const statusRow = document.createElement('div');
    statusRow.className = 'flight-status-row';
    const status = document.createElement('div');
    status.className = 'flight-status is-loading';
    status.textContent = 'Loading ship…';
    this.statusText = status;
    statusRow.appendChild(status);

    const planetLine = document.createElement('div');
    planetLine.className = 'flight-planet-line';
    const planetName = document.createElement('div');
    planetName.className = 'flight-planet-name';
    planetName.textContent = this.planetName;
    const planetHint = document.createElement('div');
    planetHint.className = 'flight-planet-hint';
    planetHint.textContent = 'The current planet — fly to where you want to land.';
    planetLine.append(planetName, planetHint);

    const speedRow = document.createElement('div');
    speedRow.className = 'flight-speed-row';
    const speedBox = document.createElement('div');
    speedBox.className = 'flight-speed-box';
    const speedLabel = document.createElement('div');
    speedLabel.className = 'flight-speed-label';
    speedLabel.textContent = 'speed';
    const speedValue = document.createElement('div');
    speedValue.className = 'flight-speed-value';
    speedValue.textContent = '—';
    this.speedText = speedValue;
    speedBox.append(speedLabel, speedValue);
    const maxBox = document.createElement('div');
    maxBox.className = 'flight-speed-box';
    const maxLabel = document.createElement('div');
    maxLabel.className = 'flight-speed-label';
    maxLabel.textContent = 'max speed';
    const maxValue = document.createElement('div');
    maxValue.className = 'flight-speed-value';
    maxValue.textContent = '—';
    this.maxSpeedText = maxValue;
    maxBox.append(maxLabel, maxValue);
    speedRow.append(speedBox, maxBox);

    const controls = document.createElement('div');
    controls.className = 'flight-controls';
    this.buildControls(controls);

    const hint = document.createElement('div');
    hint.className = 'flight-hint';
    hint.textContent = 'Hold Thrust to accelerate. Coast to keep momentum. Brake to stop. Warp requires a near-stop and a hyperdrive.';

    panel.append(statusRow, planetLine, speedRow, controls, hint);
    inner.append(header, mapWrap, panel);
    this.element.appendChild(inner);

    this.loadFlight()
      .then(({ system, spawnPlanet, landable, physics, hasHyperdrive }) => {
        if (this.destroyed) return;
        this.system = system;
        this.spawnPlanet = spawnPlanet;
        this.landable = landable;
        this.physics = physics;
        this.hasHyperdrive = hasHyperdrive;
        const start = this.planetSystemPosition(spawnPlanet.planet);
        this.state = createFlightState(start.x, start.y, Math.atan2(start.y, start.x));
        this.state.speed = 0;
        this.buildView();
        this.updateMaxSpeed();
        this.refreshControls();
        this.startLoop();
      })
      .catch((err) => {
        if (this.destroyed) return;
        console.warn('flight: scene failed to load', err);
        const message = `Could not load the flight scene — ${err instanceof Error ? err.message : 'try again'}`;
        this.loadingEl!.textContent = message;
        this.loadingEl!.style.color = 'var(--danger)';
        this.statusText!.textContent = message;
      });
  }

  // --- geometry ──────────────────────────────────────────────────────────

  private scale(): number {
    const maxDistance = this.landable.length > 0
      ? Math.max(...this.landable.map(l => l.planet.distance))
      : this.spawnPlanet?.planet.distance ?? 1;
    return 330 / maxDistance;
  }

  private planetAngle(planet: SystemPlanet): number {
    const index = this.landable.findIndex(l => l.planet === planet);
    const count = this.landable.length;
    return ((index + 1) * (2 * Math.PI)) / (count + 1);
  }

  private planetSystemPosition(planet: SystemPlanet): { x: number; y: number } {
    const angle = this.planetAngle(planet);
    return {
      x: Math.cos(angle) * planet.distance,
      y: Math.sin(angle) * planet.distance,
    };
  }

  private systemToView(x: number, y: number): { x: number; y: number } {
    const scale = this.scale();
    return { x: CENTER + x * scale, y: CENTER + y * scale };
  }

  private glyphRadius(planet: SystemPlanet): number {
    return planet.name ? 11 : 7;
  }

  private landRadiusSystem(planet: SystemPlanet): number {
    return (3 * this.glyphRadius(planet)) / this.scale();
  }

  // --- controls ──────────────────────────────────────────────────────────

  private buildControls(controls: HTMLElement): void {
    const thrustBtn = this.makeHoldButton('Thrust', 'thrust');
    const brakeBtn = this.makeHoldButton('Brake', 'brake');
    const turnLeft = this.makeHoldButton('◀', 'turnLeft');
    const turnRight = this.makeHoldButton('▶', 'turnRight');

    this.warpButton = document.createElement('button');
    this.warpButton.type = 'button';
    this.warpButton.className = 'flight-button flight-button--warp';
    this.warpButton.textContent = 'Warp';
    this.warpButton.disabled = true;
    this.warpButton.addEventListener('mouseenter', () => this.audio.play('soft'));
    this.warpButton.addEventListener('click', () => {
      if (!this.physics || !this.hasHyperdrive || !canWarp(this.state, this.physics)) return;
      this.audio.play('normal');
      this.openWarpPicker();
    });

    this.landButton = document.createElement('button');
    this.landButton.type = 'button';
    this.landButton.className = 'flight-button flight-button--land';
    this.landButton.textContent = 'Land';
    this.landButton.disabled = true;
    this.landButton.addEventListener('mouseenter', () => this.audio.play('soft'));
    this.landButton.addEventListener('click', () => {
      const target = this.landingTarget();
      if (!target || !this.physics) return;
      const pos = this.planetSystemPosition(target.planet);
      if (!canLand(this.state, this.physics, pos.x, pos.y, this.landRadiusSystem(target.planet))) return;
      this.audio.play('normal');
      this.landOn(target);
    });

    const abort = document.createElement('button');
    abort.type = 'button';
    abort.className = 'flight-button flight-button--abort';
    abort.innerHTML = '<span class="menu-key">Esc</span> Abort';
    abort.addEventListener('mouseenter', () => this.audio.play('soft'));
    abort.addEventListener('click', () => { this.audio.play('normal'); this.onAbort(); });

    const turnRow = document.createElement('div');
    turnRow.className = 'flight-turn-row';
    turnRow.append(turnLeft, turnRight);

    controls.append(thrustBtn, brakeBtn, turnRow, this.warpButton, this.landButton, abort);
  }

  private makeHoldButton(label: string, role: keyof FlightInput): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'flight-button flight-button--hold';
    btn.textContent = label;
    btn.addEventListener('mouseenter', () => this.audio.play('soft'));
    btn.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      this.input[role] = true;
      btn.classList.add('is-held');
    });
    const release = () => {
      this.input[role] = false;
      btn.classList.remove('is-held');
    };
    btn.addEventListener('pointerup', release);
    btn.addEventListener('pointerleave', release);
    btn.addEventListener('pointercancel', release);
    return btn;
  }

  // --- the map ────────────────────────────────────────────────────────────

  private buildView(): void {
    if (!this.mapSvg || !this.spawnPlanet || !this.system) return;
    const svg = this.mapSvg;
    const scale = this.scale();
    svg.innerHTML = '';

    for (const target of this.landable) {
      const orbitRing = document.createElementNS(SVG_NS, 'circle');
      orbitRing.setAttribute('cx', String(CENTER));
      orbitRing.setAttribute('cy', String(CENTER));
      orbitRing.setAttribute('r', String(target.planet.distance * scale));
      orbitRing.setAttribute('class', 'flight-orbit');
      svg.appendChild(orbitRing);
    }

    const star = document.createElementNS(SVG_NS, 'circle');
    star.setAttribute('cx', String(CENTER));
    star.setAttribute('cy', String(CENTER));
    star.setAttribute('r', '24');
    star.setAttribute('class', 'flight-star');
    svg.appendChild(star);

    for (const target of this.landable) {
      const planet = target.planet;
      const pos = this.planetSystemPosition(planet);
      const view = this.systemToView(pos.x, pos.y);
      const glyphR = this.glyphRadius(planet);

      const zone = document.createElementNS(SVG_NS, 'circle');
      zone.setAttribute('cx', String(view.x));
      zone.setAttribute('cy', String(view.y));
      zone.setAttribute('r', String(3 * glyphR));
      zone.setAttribute('class', 'flight-land-zone');
      svg.appendChild(zone);

      const glyph = document.createElementNS(SVG_NS, 'circle');
      glyph.setAttribute('cx', String(view.x));
      glyph.setAttribute('cy', String(view.y));
      glyph.setAttribute('r', String(glyphR));
      glyph.setAttribute('class', 'flight-planet flight-planet--named');
      glyph.setAttribute('fill', '#d9a75c');
      svg.appendChild(glyph);

      const label = document.createElementNS(SVG_NS, 'text');
      label.setAttribute('x', String(view.x));
      label.setAttribute('y', String(view.y - glyphR - 8));
      label.setAttribute('class', 'flight-planet-label');
      label.setAttribute('text-anchor', 'middle');
      label.textContent = planet.name ?? '';
      svg.appendChild(label);
    }

    this.shipGroup = document.createElementNS(SVG_NS, 'g');
    this.shipGroup.setAttribute('class', 'flight-ship');
    const img = document.createElementNS(SVG_NS, 'image');
    img.setAttribute('href', this.shipThumbnailUrl());
    img.setAttribute('x', '-16');
    img.setAttribute('y', '-16');
    img.setAttribute('width', '32');
    img.setAttribute('height', '32');
    this.shipGroup.appendChild(img);
    svg.appendChild(this.shipGroup);

    this.loadingEl!.style.display = 'none';
    this.refreshShipTransform();
  }

  private shipThumbnailUrl(): string {
    const flagship = this.player.flagship();
    if (flagship?.model.thumbnail) return `/content/images/${flagship.model.thumbnail}.png`;
    return '';
  }

  private updateMaxSpeed(): void {
    if (this.maxSpeedText && this.physics) {
      this.maxSpeedText.textContent = `${Math.round(this.physics.maxSpeed)} u/s`;
    }
  }

  // --- the flight loop ────────────────────────────────────────────────────

  private startLoop(): void {
    if (this.animationFrame !== null) return;
    this.lastTimestamp = performance.now();
    const tick = (timestamp: number) => {
      if (this.destroyed) return;
      const dt = Math.min(0.05, Math.max(0.001, (timestamp - this.lastTimestamp) / 1000));
      this.lastTimestamp = timestamp;
      if (this.physics && !this.warpAnimation) {
        stepFlight(this.state, this.input, this.physics, dt * TIME_SCALE);
        this.refreshShipTransform();
        this.refreshHud();
        this.refreshControls();
      }
      this.animationFrame = requestAnimationFrame(tick);
    };
    this.animationFrame = requestAnimationFrame(tick);
  }

  private refreshShipTransform(): void {
    if (!this.shipGroup) return;
    const view = this.systemToView(this.state.x, this.state.y);
    this.shipGroup.setAttribute('transform', `translate(${view.x}, ${view.y}) rotate(${(this.state.facing * 180) / Math.PI})`);
  }

  private refreshHud(): void {
    if (this.speedText && this.physics) {
      this.speedText.textContent = `${Math.round(this.state.speed)} u/s`;
    }
  }

  private refreshControls(): void {
    if (!this.physics || !this.system) return;
    const speed = this.state.speed;

    if (this.warpButton) {
      const stopped = canWarp(this.state, this.physics);
      const ready = stopped && this.hasHyperdrive;
      this.warpButton.disabled = !ready;
      this.warpButton.title = !this.hasHyperdrive
        ? 'No hyperdrive installed'
        : !stopped
          ? 'Brake to a near-stop to warp'
          : 'Warp to another system';
    }

    const target = this.landingTarget();
    if (this.landButton) {
      let ready = false;
      if (target) {
        const pos = this.planetSystemPosition(target.planet);
        ready = canLand(this.state, this.physics, pos.x, pos.y, this.landRadiusSystem(target.planet));
      }
      this.landButton.disabled = !ready;
      if (!target) {
        this.landButton.title = 'This system has no landable world';
      } else {
        const pos = this.planetSystemPosition(target.planet);
        const dist = Math.hypot(this.state.x - pos.x, this.state.y - pos.y);
        if (dist > this.landRadiusSystem(target.planet)) this.landButton.title = 'Not over the planet';
        else if (speed >= 0.1 * this.physics.maxSpeed) this.landButton.title = 'Too fast — brake to land';
        else this.landButton.title = 'Land';
      }
    }

    if (this.statusText) {
      let text = 'flying';
      if (this.warpAnimation) text = 'jumping…';
      else if (speed < 0.05 * this.physics.maxSpeed) text = 'stopped';
      else if (speed < 0.3 * this.physics.maxSpeed) text = 'slow';
      else text = 'fast';
      this.statusText.textContent = text;
      this.statusText.className = 'flight-status';
      if (text === 'stopped' || text === 'slow') this.statusText.classList.add('is-loading');
    }
  }

  private landingTarget(): LandableTarget | null {
    return this.landable.length > 0 ? this.landable[0] : null;
  }

  // --- warp picker ────────────────────────────────────────────────────────

  private openWarpPicker(): void {
    if (this.warpPickerOpen || !this.system) return;
    this.warpPickerOpen = true;
    this.audio.play('soft');
    const system = this.system;
    this.loadDestinations(system)
      .then((rows) => {
        if (this.destroyed) return;
        this.destinations = rows;
        this.destinationsLoaded = true;
        this.renderWarpPicker();
      })
      .catch((err) => {
        console.warn('flight: destinations failed to load', err);
        this.destinations = [];
        this.destinationsLoaded = true;
        this.renderWarpPicker();
      });
    this.renderWarpPicker();
  }

  private renderWarpPicker(): void {
    if (!this.overlayEl) {
      this.overlayEl = document.createElement('div');
      this.overlayEl.className = 'flight-overlay';
      this.element.appendChild(this.overlayEl);
    }
    const overlay = this.overlayEl!;
    overlay.innerHTML = '';
    overlay.style.display = 'grid';

    const card = document.createElement('div');
    card.className = 'flight-warp-card';

    const title = document.createElement('h2');
    title.className = 'flight-warp-title';
    title.textContent = 'Warp to…';
    const sub = document.createElement('div');
    sub.className = 'flight-warp-sub';
    sub.textContent = `Real jump neighbors of ${this.systemName} — jump-range and fuel costs are not modeled (Milestone 3).`;
    card.append(title, sub);

    if (!this.destinationsLoaded) {
      const loading = document.createElement('div');
      loading.className = 'flight-warp-loading';
      loading.textContent = 'Loading jump destinations…';
      card.appendChild(loading);
      overlay.appendChild(card);
      return;
    }

    if (this.destinations.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'flight-warp-sub';
      empty.textContent = 'No jump destination here has a landable named planet in this milestone.';
      card.appendChild(empty);
      overlay.appendChild(card);
      return;
    }

    const list = document.createElement('div');
    list.className = 'flight-warp-list';
    for (const row of this.destinations) {
      const rowEl = document.createElement('div');
      rowEl.className = 'flight-warp-row';
      if (row.planet && row.spec) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'flight-warp-button';
        const planetLabel = document.createElement('span');
        planetLabel.className = 'flight-warp-planet';
        planetLabel.textContent = row.planet.name ?? '';
        const systemLabel = document.createElement('span');
        systemLabel.className = 'flight-warp-system';
        systemLabel.textContent = `${row.system.name} — jump neighbor`;
        btn.append(planetLabel, systemLabel);
        btn.addEventListener('mouseenter', () => this.audio.play('soft'));
        btn.addEventListener('click', () => {
          this.audio.play('normal');
          this.confirmWarp(row);
        });
        rowEl.appendChild(btn);
      } else {
        const disabled = document.createElement('div');
        disabled.className = 'flight-warp-disabled';
        const planetLabel = document.createElement('span');
        planetLabel.className = 'flight-warp-planet';
        planetLabel.textContent = row.system.name;
        const systemLabel = document.createElement('span');
        systemLabel.className = 'flight-warp-system';
        systemLabel.textContent = row.disabledReason ?? 'no landable named planet here';
        disabled.append(planetLabel, systemLabel);
        rowEl.appendChild(disabled);
      }
      list.appendChild(rowEl);
    }
    card.appendChild(list);

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'flight-warp-close';
    close.textContent = 'Cancel';
    close.addEventListener('mouseenter', () => this.audio.play('soft'));
    close.addEventListener('click', () => { this.audio.play('soft'); this.closeWarpPicker(); });
    card.appendChild(close);

    overlay.appendChild(card);
  }

  private closeWarpPicker(): void {
    this.warpPickerOpen = false;
    if (this.overlayEl) this.overlayEl.style.display = 'none';
  }

  private confirmWarp(row: WarpRow): void {
    if (!this.physics || !row.planet || !row.spec) return;
    if (!canWarp(this.state, this.physics)) return;
    if (!this.hasHyperdrive) return;
    this.closeWarpPicker();
    this.warpAnimation = true;
    this.input = { ...NO_INPUT };
    const overlay = this.overlayEl;
    if (overlay) {
      overlay.innerHTML = '';
      overlay.style.display = 'grid';
      overlay.className = 'flight-overlay flight-overlay--jump';
      const card = document.createElement('div');
      card.className = 'flight-warp-card';
      const jump = document.createElement('div');
      jump.className = 'flight-jump-title';
      jump.textContent = `Jumping to ${row.system.name}…`;
      const note = document.createElement('div');
      note.className = 'flight-warp-sub';
      note.textContent = row.planet.name ?? '';
      card.append(jump, note);
      overlay.appendChild(card);
    }
    window.setTimeout(() => {
      if (this.destroyed) return;
      this.onWarp(row.system, row.planet!.name!);
    }, 1000);
  }

  private landOn(target: LandableTarget): void {
    this.audio.play('normal');
    this.onLand(target.spec, this.system!);
  }

  // --- keyboard + lifecycle ───────────────────────────────────────────────

  private handleKeyUp(event: KeyboardEvent): void {
    const canonical = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    const holdKeys: Record<string, keyof FlightInput> = {
      w: 'thrust', ArrowUp: 'thrust',
      s: 'brake', ArrowDown: 'brake',
      a: 'turnLeft', ArrowLeft: 'turnLeft',
      d: 'turnRight', ArrowRight: 'turnRight',
    };
    const role = holdKeys[canonical];
    if (role) this.input[role] = false;
  }

  handleKey(event: KeyboardEvent): boolean {
    const canonical = event.key.length === 1 ? event.key.toLowerCase() : event.key;

    if (event.key === 'Escape') {
      event.preventDefault();
      if (this.warpPickerOpen) {
        this.closeWarpPicker();
        return true;
      }
      this.audio.play('normal');
      this.onAbort();
      return true;
    }
    if (event.key === ' ' || event.key === 'r' || event.key === 'R') {
      if (this.physics && this.hasHyperdrive && canWarp(this.state, this.physics) && !this.warpPickerOpen) {
        event.preventDefault();
        this.audio.play('normal');
        this.openWarpPicker();
        return true;
      }
      return false;
    }
    if (event.key === 'l' || event.key === 'L') {
      const target = this.landingTarget();
      if (target && this.physics) {
        const pos = this.planetSystemPosition(target.planet);
        if (canLand(this.state, this.physics, pos.x, pos.y, this.landRadiusSystem(target.planet))) {
          event.preventDefault();
          this.audio.play('normal');
          this.landOn(target);
          return true;
        }
      }
      return false;
    }
    const holdKeys: Record<string, keyof FlightInput> = {
      w: 'thrust', ArrowUp: 'thrust',
      s: 'brake', ArrowDown: 'brake',
      a: 'turnLeft', ArrowLeft: 'turnLeft',
      d: 'turnRight', ArrowRight: 'turnRight',
    };
    const role = holdKeys[canonical];
    if (role) {
      this.input[role] = true;
      return true;
    }
    return false;
  }

  mount(): void {
    requestAnimationFrame(() => this.element.classList.add('is-visible'));
  }

  unmount(): void {
    this.destroyed = true;
    window.removeEventListener('keyup', this.keyupHandler);
    if (this.animationFrame !== null) cancelAnimationFrame(this.animationFrame);
    this.animationFrame = null;
    this.element.classList.remove('is-visible');
  }
}
