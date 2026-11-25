// The outfitter — the milestone-1 outfit shop (New Boston's "Basic Outfits"
// and "Ammo South"). A read-only preview of the reference's OutfitterPanel:
// the category-organized grid (Guns / Turrets / Ammunition / Systems / Power ...)
// with thumbnails, the selected outfit's details, and the "your ships" panel.
//
// Honest scope: outfits are not installed yet (Milestone 3), so there is no
// working Buy/Install button — a note says so instead of a fake button.

import { createScreen } from './Panel';
import type { Audio } from '../audio/Audio';
import type { PlayerInfo } from '../game/PlayerInfo';
import type { Outfit } from '../game/Outfit';
import type { Planet } from '../game/Planet';

export interface OutfitterScreenOptions {
  audio: Audio;
  player: PlayerInfo;
  // The landing planet — the shop's stock comes from this planet's own
  // outfitters, never from a hardcoded list.
  planet: Planet;
  // A fresh load each call, like the other lazily-loaded screens.
  loadStock: () => Promise<Map<string, Outfit[]>>;
  onBack: () => void;
}

export class OutfitterScreen {
  readonly element: HTMLElement;
  private audio: Audio;
  private player: PlayerInfo;
  private planet: Planet;
  private loadStock: () => Promise<Map<string, Outfit[]>>;
  private onBack: () => void;

  private stock: Map<string, Outfit[]> | null = null;
  private loading = true;
  private failure: string | null = null;
  private destroyed = false;
  private selectedIndex = 0;

  private listEl: HTMLElement;
  private detailEl: HTMLElement;
  private shipsEl: HTMLElement;

  constructor(options: OutfitterScreenOptions) {
    this.audio = options.audio;
    this.player = options.player;
    this.planet = options.planet;
    this.loadStock = options.loadStock;
    this.onBack = options.onBack;

    this.element = createScreen('outfitter-screen');
    const inner = document.createElement('div');
    inner.className = 'outfitter-inner';

    const header = document.createElement('div');
    header.className = 'outfitter-header';
    const kicker = document.createElement('div');
    kicker.className = 'outfitter-kicker';
    kicker.textContent = `${this.planet.name} — Outfitter`;
    const title = document.createElement('h1');
    title.className = 'outfitter-title';
    title.textContent = 'Install outfits';
    this.listEl = document.createElement('div');
    this.listEl.className = 'outfitter-list';
    this.detailEl = document.createElement('div');
    this.detailEl.className = 'outfitter-detail';
    this.shipsEl = document.createElement('div');
    this.shipsEl.className = 'outfitter-ships';

    const back = document.createElement('button');
    back.type = 'button';
    back.className = 'outfitter-back';
    back.innerHTML = '<span class="menu-key">Esc</span> Back';
    back.addEventListener('mouseenter', () => this.audio.play('soft'));
    back.addEventListener('click', () => { this.audio.play('normal'); this.onBack(); });

    const headerRow = document.createElement('div');
    headerRow.className = 'outfitter-header-row';
    headerRow.append(header, back);

    const body = document.createElement('div');
    body.className = 'outfitter-body';
    body.append(this.listEl, this.detailEl, this.shipsEl);

    inner.append(headerRow, body);
    this.element.appendChild(inner);

    this.load();
  }

  // (Re)load the stock from scratch.
  private load(): void {
    if (this.destroyed) return;
    this.loading = true;
    this.failure = null;
    this.stock = null;
    this.render();
    this.loadStock()
      .then((stock) => {
        if (this.destroyed) return;
        this.stock = stock;
        this.loading = false;
        this.render();
      })
      .catch((err) => {
        if (this.destroyed) return;
        console.warn('outfitter stock failed to load', err);
        this.failure = `Could not load the outfitter stock — ${err instanceof Error ? err.message : 'try again'}`;
        this.loading = false;
        this.render();
      });
  }

  private flatList(): Outfit[] {
    if (!this.stock) return [];
    const outfits: Outfit[] = [];
    for (const list of this.stock.values()) outfits.push(...list);
    return outfits;
  }

  private selectedOutfit(): Outfit | null {
    const list = this.flatList();
    if (list.length === 0) return null;
    if (this.selectedIndex >= list.length) this.selectedIndex = 0;
    return list[this.selectedIndex];
  }

  private render(): void {
    if (this.loading || !this.stock) {
      this.listEl.innerHTML = '';
      const status = document.createElement('div');
      status.className = this.failure ? 'outfitter-error' : 'outfitter-loading';
      status.textContent = this.failure ?? 'Loading the outfitter…';
      this.listEl.appendChild(status);
      if (this.failure) {
        const retry = document.createElement('button');
        retry.type = 'button';
        retry.className = 'outfitter-retry';
        retry.innerHTML = '<span class="menu-key">R</span> Retry';
        retry.addEventListener('mouseenter', () => this.audio.play('soft'));
        retry.addEventListener('click', () => { this.audio.play('normal'); this.load(); });
        this.listEl.appendChild(retry);
      }
      this.detailEl.innerHTML = '';
      this.shipsEl.innerHTML = '';
      return;
    }

    const flat = this.flatList();
    // Left: the category-organized grid.
    this.listEl.innerHTML = '';
    for (const [category, outfits] of this.stock) {
      const section = document.createElement('div');
      section.className = 'outfitter-section';
      const heading = document.createElement('div');
      heading.className = 'outfitter-section-header';
      heading.textContent = category;
      section.appendChild(heading);
      const grid = document.createElement('div');
      grid.className = 'outfitter-section-grid';
      for (const outfit of outfits) {
        const index = flat.findIndex(o => o.name === outfit.name);
        const cell = document.createElement('button');
        cell.type = 'button';
        cell.className = 'outfitter-cell';
        if (index === this.selectedIndex) cell.classList.add('is-selected');
        cell.addEventListener('mouseenter', () => { this.audio.play('soft'); });
        cell.addEventListener('click', () => {
          this.selectedIndex = index;
          this.audio.play('soft');
          this.render();
        });
        if (outfit.thumbnail) {
          const img = document.createElement('img');
          img.className = 'outfitter-cell-image';
          img.src = `/content/images/${outfit.thumbnail}.png`;
          img.alt = '';
          img.addEventListener('error', () => { img.style.display = 'none'; });
          cell.appendChild(img);
        }
        const name = document.createElement('div');
        name.className = 'outfitter-cell-name';
        name.textContent = outfit.name;
        cell.appendChild(name);
        grid.appendChild(cell);
      }
      section.appendChild(grid);
      this.listEl.appendChild(section);
    }

    // Right: the selected outfit's details.
    this.detailEl.innerHTML = '';
    const outfit = this.selectedOutfit();
    if (outfit) {
      const detail = document.createElement('div');
      detail.className = 'outfitter-detail-inner';
      const detailImg = document.createElement('img');
      detailImg.className = 'outfitter-detail-image';
      if (outfit.thumbnail) {
        detailImg.src = `/content/images/${outfit.thumbnail}.png`;
        detailImg.alt = outfit.name;
        detailImg.addEventListener('error', () => { detailImg.style.display = 'none'; });
      }
      const detailName = document.createElement('h2');
      detailName.className = 'outfitter-detail-name';
      detailName.textContent = outfit.name;
      const detailCategory = document.createElement('div');
      detailCategory.className = 'outfitter-detail-category';
      detailCategory.textContent = outfit.category;
      const desc = document.createElement('div');
      desc.className = 'outfitter-detail-description';
      desc.textContent = outfit.description;

      const stats = document.createElement('div');
      stats.className = 'outfitter-detail-stats';
      const statRows = buildStatRows(outfit);
      for (const [label, value] of statRows) {
        const row = document.createElement('div');
        row.className = 'outfitter-detail-stat';
        const l = document.createElement('div');
        l.className = 'outfitter-detail-stat-label';
        l.textContent = label;
        const v = document.createElement('div');
        v.className = 'outfitter-detail-stat-value';
        v.textContent = value;
        row.append(l, v);
        stats.appendChild(row);
      }

      const note = document.createElement('div');
      note.className = 'outfitter-detail-note';
      note.textContent = 'Outfits are not installed yet — installation lands in Milestone 3. Browsing only.';

      detail.append(detailImg, detailName, detailCategory, desc, stats, note);
      this.detailEl.appendChild(detail);
    }

    // Right column: your ships + credits.
    this.shipsEl.innerHTML = '';
    const fleet = document.createElement('div');
    fleet.className = 'outfitter-fleet';
    const fleetHeader = document.createElement('div');
    fleetHeader.className = 'outfitter-fleet-header';
    fleetHeader.textContent = 'Your ships';
    fleet.appendChild(fleetHeader);
    if (this.player.ships.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'outfitter-fleet-empty';
      empty.textContent = 'No ships yet — buy one from the shipyard.';
      fleet.appendChild(empty);
    }
    for (const ship of this.player.ships) {
      const row = document.createElement('div');
      row.className = 'outfitter-ship-row';
      const img = document.createElement('img');
      img.className = 'outfitter-ship-image';
      if (ship.model.thumbnail) img.src = `/content/images/${ship.model.thumbnail}.png`;
      img.alt = '';
      img.addEventListener('error', () => { img.style.display = 'none'; });
      const label = document.createElement('div');
      label.className = 'outfitter-ship-label';
      const name = document.createElement('div');
      name.className = 'outfitter-ship-name';
      name.textContent = ship.givenName;
      const model = document.createElement('div');
      model.className = 'outfitter-ship-model';
      model.textContent = `${ship.model.name} — ${ship.model.category}`;
      label.append(name, model);
      row.append(img, label);
      fleet.appendChild(row);
    }
    const credits = document.createElement('div');
    credits.className = 'outfitter-credits';
    credits.textContent = `You have: ${this.player.account.credits.toLocaleString('en-US')} credits`;
    fleet.appendChild(credits);
    this.shipsEl.appendChild(fleet);
  }

  // --- keyboard + lifecycle ──────────────────────────────────────────────

  handleKey(event: KeyboardEvent): boolean {
    if (event.key === 'Escape') {
      this.audio.play('normal');
      this.onBack();
      return true;
    }
    if (this.failure && (event.key === 'r' || event.key === 'R')) {
      this.audio.play('normal');
      this.load();
      return true;
    }
    if (this.stock && !this.failure) {
      const flat = this.flatList();
      if (flat.length === 0) return false;
      if (event.key === 'ArrowDown' || event.key === 'ArrowRight' || event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
        event.preventDefault();
        const delta = (event.key === 'ArrowDown' || event.key === 'ArrowRight') ? 1 : -1;
        this.selectedIndex = (this.selectedIndex + delta + flat.length) % flat.length;
        this.audio.play('soft');
        this.render();
        return true;
      }
      if (event.key === 'Enter' || event.key === ' ') {
        // The grid item is already a real button; Enter on the detail pane
        // does nothing. Keep the key handled so the menu doesn't react.
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

// Friendly stat rows for the selected outfit — only the attributes the file
// actually defines.
function buildStatRows(outfit: Outfit): [string, string][] {
  const rows: [string, string][] = [['cost', `${outfit.cost.toLocaleString('en-US')} credits`]];
  const attrLabels: Record<string, string> = {
    'mass': 'mass',
    'outfit space': 'outfit space',
    'weapon capacity': 'weapon capacity',
    'engine capacity': 'engine capacity',
    'cargo space': 'cargo space',
    'fuel capacity': 'fuel capacity',
    'gun ports': 'gun ports',
    'turret mounts': 'turret mounts',
    'cooling': 'cooling',
    'heat dissipation': 'heat dissipation',
    'shield generation': 'shield generation',
    'shield energy': 'shield energy',
    'energy': 'energy',
    'heat': 'heat',
    'escape velocity': 'escape velocity',
    'thrust': 'thrust',
  };
  for (const [key, value] of Object.entries(outfit.attributes)) {
    rows.push([attrLabels[key] ?? key, String(value)]);
  }
  const weaponLabels: Record<string, string> = {
    'velocity': 'velocity',
    'inaccuracy': 'inaccuracy',
    'range': 'range',
    'reload': 'reload',
    'shield damage': 'shield damage / shot',
    'hull damage': 'hull damage / shot',
    'firing energy': 'firing energy / shot',
    'firing heat': 'firing heat / shot',
    'ammo': 'ammunition',
  };
  for (const [key, value] of Object.entries(outfit.weapon)) {
    rows.push([weaponLabels[key] ?? `weapon: ${key}`, String(value)]);
  }
  // Deduplicate labels (a weapon key colliding with an attribute key).
  const seen = new Set<string>();
  return rows.filter(([label]) => {
    if (seen.has(label)) return false;
    seen.add(label);
    return true;
  });
}
