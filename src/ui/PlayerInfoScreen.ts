// The Player Info panel — a full-screen overlay on top of the planet menu.
//
// Faithful to the reference's InfoPanel (endless-sky/source/ShipInfoPanel.cpp
// + the "info panel" interface): two tabs (Player Info / Ship Info), a left
// column of stats, the right column of installed outfits grouped by category,
// and a bottom bar with Done. The Ship Info tab shows the reference's stat
// table — model, cost, shields/hull, mass, movement, free capacities, and the
// energy/heat table — computed from the milestone-1 ship model and its
// installed outfits (src/game/ShipInfo.ts). Unmodeled stats (cargo is not
// tracked, combat/fleet ratings do not exist) are omitted with a note, never
// fabricated.

import { createScreen } from './Panel';
import type { Audio } from '../audio/Audio';
import type { PlayerInfo } from '../game/PlayerInfo';
import type { Outfit } from '../game/Outfit';
import {
  computeShipInfo,
  resolveInstalledOutfits,
  type InstalledOutfit,
} from '../game/ShipInfo';

export interface PlayerInfoScreenOptions {
  audio: Audio;
  player: PlayerInfo;
  // The outfit catalog (all four outfit files) — the ship's installed outfits
  // are resolved against it. Memoized; resolves once per page load.
  loadCatalog: () => Promise<Map<string, Outfit>>;
  onDone: () => void;
}

export class PlayerInfoScreen {
  readonly element: HTMLElement;
  private audio: Audio;
  private player: PlayerInfo;
  private loadCatalog: () => Promise<Map<string, Outfit>>;
  private onDone: () => void;

  private tab: 'player' | 'ship' = 'player';
  private shipIndex = 0;
  private destroyed = false;

  private catalog: Map<string, Outfit> | null = null;
  private catalogLoading = true;
  private catalogFailure: string | null = null;

  private tabPlayer: HTMLButtonElement;
  private tabShip: HTMLButtonElement;
  private contentEl: HTMLElement;

  constructor(options: PlayerInfoScreenOptions) {
    this.audio = options.audio;
    this.player = options.player;
    this.loadCatalog = options.loadCatalog;
    this.onDone = options.onDone;

    this.element = createScreen('playerinfo-screen');
    const panel = document.createElement('div');
    panel.className = 'playerinfo-panel';

    // Tabs — Player Info (default) / Ship Info.
    const tabs = document.createElement('div');
    tabs.className = 'playerinfo-tabs';
    this.tabPlayer = document.createElement('button');
    this.tabPlayer.type = 'button';
    this.tabPlayer.className = 'playerinfo-tab playerinfo-tab--player';
    this.tabPlayer.textContent = 'Player Info';
    this.tabPlayer.addEventListener('mouseenter', () => this.audio.play('soft'));
    this.tabPlayer.addEventListener('click', () => this.setTab('player'));
    this.tabShip = document.createElement('button');
    this.tabShip.type = 'button';
    this.tabShip.className = 'playerinfo-tab playerinfo-tab--ship';
    this.tabShip.textContent = 'Ship Info';
    this.tabShip.addEventListener('mouseenter', () => this.audio.play('soft'));
    this.tabShip.addEventListener('click', () => this.setTab('ship'));
    tabs.append(this.tabPlayer, this.tabShip);

    this.contentEl = document.createElement('div');
    this.contentEl.className = 'playerinfo-content';

    const footer = document.createElement('div');
    footer.className = 'playerinfo-footer';
    const done = document.createElement('button');
    done.type = 'button';
    done.className = 'playerinfo-done';
    done.innerHTML = '<span class="menu-key">Esc</span> Done';
    done.addEventListener('mouseenter', () => this.audio.play('soft'));
    done.addEventListener('click', () => { this.audio.play('normal'); this.finish(); });
    footer.append(done);

    panel.append(tabs, this.contentEl, footer);
    this.element.appendChild(panel);

    this.loadCatalog()
      .then((catalog) => {
        if (this.destroyed) return;
        this.catalog = catalog;
        this.catalogLoading = false;
        this.render();
      })
      .catch((err) => {
        if (this.destroyed) return;
        console.warn('player info: catalog failed to load', err);
        this.catalogFailure = `Could not load the outfit catalog — ${err instanceof Error ? err.message : 'try again'}`;
        this.catalogLoading = false;
        this.render();
      });

    this.render();
  }

  private setTab(tab: 'player' | 'ship'): void {
    this.tab = tab;
    this.audio.play('soft');
    this.render();
  }

  private finish(): void {
    if (this.destroyed) return;
    this.onDone();
  }

  // --- rendering ──────────────────────────────────────────────────────────

  private render(): void {
    if (this.destroyed) return;
    this.tabPlayer.classList.toggle('is-active', this.tab === 'player');
    this.tabShip.classList.toggle('is-active', this.tab === 'ship');
    this.contentEl.innerHTML = '';

    if (this.tab === 'player') {
      this.contentEl.append(this.buildPlayerColumn(), this.buildFleetTable());
    } else {
      this.contentEl.append(this.buildShipDetail());
    }
  }

  // Player statistics — only stats we actually model (net worth, credits,
  // debt, licenses, fleet, crew). Unmodeled stats are listed once, as a note.
  private buildPlayerColumn(): HTMLElement {
    const column = document.createElement('div');
    column.className = 'playerinfo-column playerinfo-column--player';

    const name = this.player.pilot
      ? this.player.pilot.fullName()
      : `${this.player.firstName} ${this.player.lastName}`.trim() || '—';
    const debt = this.player.account.totalDebt();
    const netWorth = this.player.account.credits - debt;
    const licenses: string[] = [];
    if (this.player.conditions.has('license: Pilot\'s')) licenses.push("Pilot's");
    const totalCrew = this.player.ships.reduce((sum, s) => sum + s.model.requiredCrew, 0);

    const rows: [string, string][] = [
      ['player', name],
      ['net worth', `${netWorth.toLocaleString('en-US')} credits`],
      ['credits', `${this.player.account.credits.toLocaleString('en-US')} credits`],
      ['debt', `${debt.toLocaleString('en-US')} credits`],
      ['licenses', licenses.length ? `${licenses.join(', ')} (${licenses.length})` : '—'],
      ['fleet', `${this.player.ships.length} ship${this.player.ships.length === 1 ? '' : 's'}`],
      ['crew', totalCrew ? `${totalCrew} required` : '—'],
    ];

    const table = document.createElement('div');
    table.className = 'playerinfo-stats';
    for (const [label, value] of rows) {
      const row = document.createElement('div');
      row.className = 'playerinfo-stat';
      const l = document.createElement('div');
      l.className = 'playerinfo-stat-label';
      l.textContent = label;
      const v = document.createElement('div');
      v.className = 'playerinfo-stat-value';
      v.textContent = value;
      row.append(l, v);
      table.appendChild(row);
    }

    const note = document.createElement('div');
    note.className = 'playerinfo-note';
    note.textContent = 'Not yet tracked: time played, combat rating, piracy threat, cargo, fleet ratings — Milestones 3–4.';

    column.append(table, note);
    return column;
  }

  // The fleet table — one row per ship we own (ships are mint: 100% shields/hull).
  private buildFleetTable(): HTMLElement {
    const column = document.createElement('div');
    column.className = 'playerinfo-column playerinfo-column--fleet';

    const header = document.createElement('div');
    header.className = 'playerinfo-fleet-header';
    header.textContent = 'Your fleet';
    column.appendChild(header);

    const table = document.createElement('div');
    table.className = 'playerinfo-ship-table';
    const head = document.createElement('div');
    head.className = 'playerinfo-ship-row playerinfo-ship-row--head';
    for (const cell of ['ship', 'model', 'system', 'shields', 'hull', 'crew']) {
      const el = document.createElement('div');
      el.className = 'playerinfo-ship-cell';
      el.textContent = cell;
      head.appendChild(el);
    }
    table.appendChild(head);

    for (const ship of this.player.ships) {
      const row = document.createElement('div');
      row.className = 'playerinfo-ship-row';
      const values = [
        ship.givenName,
        ship.model.name,
        this.player.getSystem() || '—',
        '100%',
        '100%',
        String(ship.model.requiredCrew),
      ];
      for (const value of values) {
        const cell = document.createElement('div');
        cell.className = 'playerinfo-ship-cell';
        cell.textContent = value;
        row.appendChild(cell);
      }
      table.appendChild(row);
    }
    column.appendChild(table);

    return column;
  }

  // --- the Ship Info tab ─────────────────────────────────────────────────

  private buildShipDetail(): HTMLElement {
    const ships = this.player.ships;

    if (ships.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'playerinfo-note';
      empty.textContent = 'No ships yet — buy one from the shipyard.';
      return empty;
    }
    if (this.shipIndex >= ships.length) this.shipIndex = 0;
    const ship = ships[this.shipIndex];
    const model = ship.model;

    const outer = document.createElement('div');
    outer.className = 'playerinfo-ship-layout';

    // --- ship selector (when >1 ship) ---
    if (ships.length > 1) {
      const selector = document.createElement('div');
      selector.className = 'playerinfo-ship-selector';
      ships.forEach((s, i) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'playerinfo-ship-select';
        if (i === this.shipIndex) btn.classList.add('is-selected');
        btn.textContent = s.givenName;
        btn.addEventListener('mouseenter', () => this.audio.play('soft'));
        btn.addEventListener('click', () => {
          this.shipIndex = i;
          this.audio.play('soft');
          this.render();
        });
        selector.appendChild(btn);
      });
      outer.appendChild(selector);
    }

    // --- loading / failure state ---
    if (this.catalogLoading) {
      const loading = document.createElement('div');
      loading.className = 'playerinfo-note';
      loading.textContent = 'Loading ship details…';
      outer.appendChild(loading);
      return outer;
    }
    if (this.catalogFailure) {
      const failure = document.createElement('div');
      failure.className = 'playerinfo-error';
      failure.textContent = this.catalogFailure;
      outer.appendChild(failure);
      return outer;
    }

    // --- compute the reference's stat table ---
    const installed = resolveInstalledOutfits(model, this.catalog!, (m) => console.warn(m));
    const stats = computeShipInfo(model, installed);
    stats.name = ship.givenName;

    // --- left column: the stat table ---
    const left = document.createElement('div');
    left.className = 'playerinfo-ship-stats';

    const nameHeader = document.createElement('div');
    nameHeader.className = 'playerinfo-ship-name';
    nameHeader.textContent = ship.givenName;
    const modelLine = document.createElement('div');
    modelLine.className = 'playerinfo-ship-meta';
    modelLine.textContent = `${model.name}${model.category ? ` — ${model.category}` : ''}`;
    left.append(nameHeader, modelLine);

    const headerRows: [string, string][] = [
      ['model:', model.name],
      ['cost:', model.cost.toLocaleString('en-US')],
    ];
    const statsLines: [string, string][] = [];

    const shieldsLabel = stats.shieldsPerSecond > 0 ? 'shields (charge):' : 'shields:';
    statsLines.push([shieldsLabel, stats.shieldsChargeLabel]);
    statsLines.push(['hull:', model.hull.toLocaleString('en-US')]);
    statsLines.push(['mass with no cargo:', `${Math.round(stats.emptyMass)} tons`]);
    statsLines.push(['cargo space:', `${model.cargoSpace} tons`]);
    statsLines.push(['required crew / bunks:', `${model.requiredCrew} / ${model.bunks}`]);
    statsLines.push(['fuel capacity:', model.fuelCapacity.toLocaleString('en-US')]);

    // Movement block.
    const movementHeading = document.createElement('div');
    movementHeading.className = 'playerinfo-ship-section-heading';
    movementHeading.textContent = 'movement (full - no cargo):';
    left.appendChild(movementHeading);

    const movementLines: [string, string][] = [['max speed:', stats.maxSpeed.toFixed(1)]];
    if (stats.thrust > 0) {
      movementLines.push([
        'acceleration:',
        `${stats.accelerationFull.toFixed(2)} - ${stats.accelerationEmpty.toFixed(2)}`,
      ]);
    }
    if (stats.turn > 0) {
      movementLines.push(['turning:', `${stats.turnFull.toFixed(1)} - ${stats.turnEmpty.toFixed(1)}`]);
    }
    left.append(...buildStatRows(movementLines));

    // Capacity free.
    const capacityHeading = document.createElement('div');
    capacityHeading.className = 'playerinfo-ship-section-heading';
    capacityHeading.textContent = 'capacity:';
    left.appendChild(capacityHeading);
    left.append(...buildStatRows([
      ['outfit space free:', `${Math.round(stats.outfitSpace)} / ${model.outfitSpace}`],
      ['weapon capacity:', `${Math.round(stats.weaponCapacity)} / ${model.weaponCapacity}`],
      ['engine capacity:', `${Math.round(stats.engineCapacity)} / ${model.engineCapacity}`],
      ['gun ports free:', `${Math.round(stats.gunPortsFree)} / ${model.gunPorts}`],
      ['turret mounts free:', `${Math.round(stats.turretMountsFree)} / ${model.turretMounts}`],
    ]));

    // Energy/heat table.
    const energyHeading = document.createElement('div');
    energyHeading.className = 'playerinfo-ship-section-heading';
    energyHeading.textContent = 'energy / heat';
    left.appendChild(energyHeading);
    const energyTable = document.createElement('table');
    energyTable.className = 'playerinfo-energy-table';
    energyTable.innerHTML = `
      <thead><tr><th></th><th>energy</th><th>heat</th></tr></thead>
      <tbody>
        <tr><td>idle:</td><td>${formatNum(stats.energyIdle)}</td><td>${formatNum(stats.heatIdle)}</td></tr>
        <tr><td>moving:</td><td>${formatNum(-stats.energyMoving)}</td><td>${formatNum(stats.heatMoving)}</td></tr>
        <tr><td>firing:</td><td>${formatNum(-stats.energyFiring)}</td><td>${formatNum(stats.heatFiring)}</td></tr>
        <tr><td>${stats.energyCharging > 0 ? 'charging shields:' : 'shields:'}</td><td>${formatNum(-stats.energyCharging)}</td><td>${formatNum(stats.heatCharging)}</td></tr>
        <tr><td>capacity:</td><td>${formatNum(stats.energyCapacity)}</td><td>${formatNum(stats.heatCapacity)}</td></tr>
      </tbody>`;
    left.appendChild(energyTable);

    // --- right column: outfits grouped by category ---
    const right = document.createElement('div');
    right.className = 'playerinfo-ship-outfits';

    if (model.thumbnail) {
      const img = document.createElement('img');
      img.className = 'playerinfo-ship-image';
      img.src = `/content/images/${model.thumbnail}.png`;
      img.alt = model.name;
      img.addEventListener('error', () => { img.style.display = 'none'; });
      right.appendChild(img);
    }

    const outfitHeader = document.createElement('div');
    outfitHeader.className = 'playerinfo-outfits-header';
    outfitHeader.textContent = 'Installed outfits';
    right.appendChild(outfitHeader);

    if (installed.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'playerinfo-note';
      empty.textContent = 'No outfits installed.';
      right.appendChild(empty);
    } else {
      for (const group of stats.outfitGroups) {
        const section = document.createElement('div');
        section.className = 'playerinfo-outfit-group';
        const heading = document.createElement('div');
        heading.className = 'playerinfo-outfit-group-heading';
        heading.textContent = group.category;
        section.appendChild(heading);
        for (const { outfit, count } of group.entries) {
          const row = document.createElement('div');
          row.className = 'playerinfo-outfit-row';
          const img = document.createElement('img');
          img.className = 'playerinfo-outfit-image';
          if (outfit.thumbnail) {
            img.src = `/content/images/${outfit.thumbnail}.png`;
            img.alt = '';
            img.addEventListener('error', () => { img.style.display = 'none'; });
          }
          const name = document.createElement('div');
          name.className = 'playerinfo-outfit-name';
          name.textContent = outfit.name;
          const countLabel = document.createElement('div');
          countLabel.className = 'playerinfo-outfit-count';
          countLabel.textContent = `${count}`;
          row.append(img, name, countLabel);
          section.appendChild(row);
        }
        right.appendChild(section);
      }
    }

    outer.append(left, right);
    return outer;
  }

  // --- keyboard + lifecycle ──────────────────────────────────────────────

  handleKey(event: KeyboardEvent): boolean {
    if (event.key === 'Escape') {
      this.audio.play('normal');
      this.finish();
      return true;
    }
    if (this.tab === 'ship' && this.player.ships.length > 1) {
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        event.preventDefault();
        this.shipIndex = (this.shipIndex + 1) % this.player.ships.length;
        this.audio.play('soft');
        this.render();
        return true;
      }
      if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        event.preventDefault();
        this.shipIndex = (this.shipIndex - 1 + this.player.ships.length) % this.player.ships.length;
        this.audio.play('soft');
        this.render();
        return true;
      }
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

function buildStatRows(rows: [string, string][]): HTMLElement[] {
  const out: HTMLElement[] = [];
  for (const [label, value] of rows) {
    const row = document.createElement('div');
    row.className = 'playerinfo-stat';
    const l = document.createElement('div');
    l.className = 'playerinfo-stat-label';
    l.textContent = label;
    const v = document.createElement('div');
    v.className = 'playerinfo-stat-value';
    v.textContent = value;
    row.append(l, v);
    out.push(row);
  }
  return out;
}

function formatNum(n: number): string {
  if (n === 0) return '0';
  return n.toLocaleString('en-US', { maximumFractionDigits: 1 });
}
