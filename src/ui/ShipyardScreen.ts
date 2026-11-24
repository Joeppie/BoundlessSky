// The shipyard — the first step after the landing splash: buy a ship with
// the credits you started with, then continue (the reference: OnConversationEnd
// pushes a ShipyardPanel when the player has no ships; the intro mission is
// offered once the player lands with a ship).
//
// Milestone-scoped: buying one ship from the "Basic Ships" stock; the
// reference's quantity stepper, licenses and fleet management are Milestone 2+.

import { createScreen } from './Panel';
import type { Audio } from '../audio/Audio';
import type { PlayerInfo } from '../game/PlayerInfo';
import type { Ship } from '../game/Ship';
import type { Shipyard } from '../data/ShipyardData';

export interface ShipyardScreenOptions {
  audio: Audio;
  player: PlayerInfo;
  // Fresh-load the stock — each call refetches (never returns a cached failure).
  loadStock: () => Promise<Shipyard>;
  onBuy: (model: Ship, givenName: string) => void;
  onLeave: () => void;
}

export class ShipyardScreen {
  readonly element: HTMLElement;
  private audio: Audio;
  private player: PlayerInfo;
  private loadStock: () => Promise<Shipyard>;
  private stock: Shipyard | null = null;
  private onBuy: (model: Ship, givenName: string) => void;
  private onLeave: () => void;

  private selected = 0;
  private naming = false;
  private confirmed = false;
  private destroyed = false;
  private nameInputValue = '';
  private failure: string | null = null;
  private loading = true;

  // DOM
  private listEl: HTMLElement;
  private detailEl: HTMLElement;
  private creditsEl: HTMLElement;
  private namePanel: HTMLElement;
  private nameInput: HTMLInputElement;
  private nameErrorEl: HTMLElement;
  private buyButton: HTMLButtonElement;

  constructor(options: ShipyardScreenOptions) {
    this.audio = options.audio;
    this.player = options.player;
    this.loadStock = options.loadStock;
    this.onBuy = options.onBuy;
    this.onLeave = options.onLeave;

    this.element = createScreen('shipyard-screen');

    const inner = document.createElement('div');
    inner.className = 'shipyard-inner';

    const header = document.createElement('div');
    header.className = 'shipyard-header';
    const kicker = document.createElement('div');
    kicker.className = 'shipyard-kicker';
    kicker.textContent = `${this.player.planetName || 'New Boston'} — Shipyard`;
    const title = document.createElement('h1');
    title.className = 'shipyard-title';
    title.textContent = 'Buy your ship';
    const sub = document.createElement('div');
    sub.className = 'shipyard-sub';
    sub.textContent = 'Three models are within your reach. One purchase, then on to the first quest.';
    this.creditsEl = document.createElement('div');
    this.creditsEl.className = 'shipyard-credits';
    this.renderCredits();
    header.append(kicker, title, sub, this.creditsEl);

    this.listEl = document.createElement('div');
    this.listEl.className = 'shipyard-list';

    this.detailEl = document.createElement('div');
    this.detailEl.className = 'shipyard-detail';

    this.namePanel = document.createElement('div');
    this.namePanel.className = 'shipyard-name';
    this.namePanel.style.display = 'none';
    const nameKicker = document.createElement('div');
    nameKicker.className = 'shipyard-name-kicker';
    nameKicker.textContent = 'Name your ship';
    const nameHint = document.createElement('div');
    nameHint.className = 'shipyard-name-hint';
    nameHint.textContent = 'Leave blank for a default name';
    this.nameInput = document.createElement('input');
    this.nameInput.className = 'shipyard-name-input';
    this.nameInput.autocomplete = 'off';
    this.nameInput.spellcheck = false;
    this.nameInput.maxLength = 30;
    this.nameInput.placeholder = 'e.g. Watchful';
    this.nameInput.addEventListener('input', () => {
      this.nameInputValue = this.nameInput.value;
    });
    this.nameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.confirmName();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        this.cancelNaming();
      }
    });
    this.nameErrorEl = document.createElement('div');
    this.nameErrorEl.className = 'shipyard-name-error';
    this.nameErrorEl.style.display = 'none';
    // Buttons — everything tappable is a button.
    const confirmButton = document.createElement('button');
    confirmButton.type = 'button';
    confirmButton.className = 'shipyard-name-confirm';
    confirmButton.innerHTML = '<span class="menu-key">Enter</span> Name &amp; buy';
    confirmButton.addEventListener('mouseenter', () => this.audio.play('soft'));
    confirmButton.addEventListener('click', () => this.confirmName());
    const cancelButton = document.createElement('button');
    cancelButton.type = 'button';
    cancelButton.className = 'shipyard-name-cancel';
    cancelButton.innerHTML = '<span class="menu-key">Esc</span> Cancel';
    cancelButton.addEventListener('mouseenter', () => this.audio.play('soft'));
    cancelButton.addEventListener('click', () => this.cancelNaming());
    const nameActions = document.createElement('div');
    nameActions.className = 'shipyard-name-actions';
    nameActions.append(confirmButton, cancelButton);
    this.namePanel.append(nameKicker, nameHint, this.nameInput, this.nameErrorEl, nameActions);

    const footer = document.createElement('div');
    footer.className = 'shipyard-footer';
    this.buyButton = document.createElement('button');
    this.buyButton.type = 'button';
    this.buyButton.className = 'shipyard-buy';
    this.buyButton.textContent = 'Buy — Enter';
    this.buyButton.addEventListener('mouseenter', () => this.audio.play('soft'));
    this.buyButton.addEventListener('click', () => this.buySelected());
    const leaveButton = document.createElement('button');
    leaveButton.type = 'button';
    leaveButton.className = 'shipyard-leave';
    leaveButton.innerHTML = '<span class="menu-key">L</span> Leave — no ship, no quest';
    leaveButton.addEventListener('mouseenter', () => this.audio.play('soft'));
    leaveButton.addEventListener('click', () => { this.audio.play('normal'); this.onLeave(); });
    footer.append(this.buyButton, leaveButton);

    inner.append(header, this.listEl, this.detailEl, this.namePanel, footer);
    this.element.appendChild(inner);

    // The stock loads lazily; render the skeleton first, then resolve it.
    this.startLoad();
  }

  // (Re)load the stock from scratch. A failure renders an error state with a
  // Retry button — never a silent "Loading…" that never resolves.
  private startLoad(): void {
    if (this.destroyed) return;
    this.loading = true;
    this.failure = null;
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
        console.warn('shipyard stock failed to load', err);
        this.failure = `Could not load the shipyard stock — ${err instanceof Error ? err.message : 'try again'}`;
        this.loading = false;
        this.render();
      });
  }

  private renderCredits(): void {
    this.creditsEl.innerHTML = `Credits: <strong>${this.player.account.credits.toLocaleString('en-US')}</strong>`;
    this.creditsEl.title = `Credits: ${this.player.account.credits.toLocaleString('en-US')}`;
  }

  private current(): Ship {
    if (!this.stock) throw new Error('shipyard stock not loaded');
    return this.stock.ships[this.selected];
  }

  private render(): void {
    if (this.loading || !this.stock) {
      this.listEl.innerHTML = '';
      if (this.failure) {
        const error = document.createElement('div');
        error.className = 'shipyard-error';
        error.textContent = this.failure;
        this.listEl.appendChild(error);
        const retry = document.createElement('button');
        retry.type = 'button';
        retry.className = 'shipyard-retry';
        retry.innerHTML = '<span class="menu-key">R</span> Retry';
        retry.addEventListener('mouseenter', () => this.audio.play('soft'));
        retry.addEventListener('click', () => { this.audio.play('normal'); this.startLoad(); });
        this.listEl.appendChild(retry);
      } else {
        const loading = document.createElement('div');
        loading.className = 'shipyard-loading';
        loading.textContent = 'Loading shipyard stock…';
        this.listEl.appendChild(loading);
      }
      this.detailEl.innerHTML = '';
      this.buyButton.textContent = this.failure ? 'Unavailable' : 'Loading…';
      this.buyButton.disabled = true;
      return;
    }

    this.listEl.innerHTML = '';
    this.stock.ships.forEach((ship, i) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'shipyard-card';
      if (i === this.selected) card.classList.add('is-selected');
      if (this.naming && i !== this.selected) card.classList.add('is-dimmed');
      card.addEventListener('click', () => {
        this.selected = i;
        this.render();
      });

      const nameRow = document.createElement('div');
      nameRow.className = 'shipyard-card-name';
      const name = document.createElement('span');
      name.className = 'shipyard-card-title';
      name.textContent = ship.name;
      const cat = document.createElement('span');
      cat.className = 'shipyard-card-category';
      cat.textContent = ship.category;
      nameRow.append(name, cat);

      const stats = document.createElement('div');
      stats.className = 'shipyard-card-stats';
      stats.textContent =
        `Hull ${ship.hull} · Shields ${ship.shields} · Bunks ${ship.bunks} · Crew ${ship.requiredCrew} · Cargo ${ship.cargoSpace}`;

      const price = document.createElement('div');
      price.className = 'shipyard-card-price';
      price.textContent = `${ship.cost.toLocaleString('en-US')} credits`;
      if (!this.player.canAffordShip(ship)) price.classList.add('is-unaffordable');

      card.append(nameRow, stats, price);
      this.listEl.appendChild(card);
    });

    const ship = this.current();
    const afford = this.player.canAffordShip(ship);
    this.detailEl.innerHTML = '';
    const detailName = document.createElement('div');
    detailName.className = 'shipyard-detail-name';
    detailName.textContent = ship.name;
    const detailMeta = document.createElement('div');
    detailMeta.className = 'shipyard-detail-meta';
    detailMeta.textContent = afford
      ? `${ship.category} — ${ship.cost.toLocaleString('en-US')} credits, leaves ${(this.player.account.credits - ship.cost).toLocaleString('en-US')}`
      : `Not enough credits — you have ${this.player.account.credits.toLocaleString('en-US')} but need ${ship.cost.toLocaleString('en-US')}`;
    detailMeta.classList.toggle('is-denied', !afford);
    const shipLine = document.createElement('div');
    shipLine.className = 'shipyard-detail-ship';
    shipLine.textContent = `${ship.name} — ${ship.category}`;
    this.detailEl.append(detailName, detailMeta, shipLine);

    // Footer button label.
    this.buyButton.textContent = afford ? 'Buy — Enter' : 'Not affordable';
    this.buyButton.disabled = !afford;
    this.buyButton.classList.toggle('is-disabled', !afford);

    this.namePanel.style.display = this.naming ? '' : 'none';
    if (this.naming) {
      this.nameInput.value = this.nameInputValue;
      this.nameErrorEl.style.display = this.failure ? '' : 'none';
      this.nameErrorEl.textContent = this.failure ?? '';
      requestAnimationFrame(() => this.nameInput.focus());
    }
  }

  // --- interactions ───────────────────────────────────────────────────────

  private buySelected(): void {
    if (this.naming || !this.stock) return;
    const ship = this.current();
    if (!this.player.canAffordShip(ship)) {
      this.failure = `You need ${ship.cost.toLocaleString('en-US')} credits to buy a ${ship.name}.`;
      this.audio.play('failure');
      this.render();
      return;
    }
    this.naming = true;
    this.nameInputValue = '';
    this.failure = null;
    this.audio.play('soft');
    this.render();
  }

  private confirmName(): void {
    // The name panel is a one-shot action — guard against double-firing (a
    // keydown may bubble through the global router after navigation starts).
    if (this.destroyed || this.confirmed) return;
    this.confirmed = true;
    if (!this.stock) return;
    const ship = this.current();
    // A blank name falls back to the model's name (the reference uses a random
    // name here; the reference's weighted-phrase generator is out of scope).
    const givenName = this.nameInputValue.trim() || ship.name;
    if (!this.player.buyShip(ship, givenName)) {
      this.failure = `You need ${ship.cost.toLocaleString('en-US')} credits to buy a ${ship.name}.`;
      this.audio.play('failure');
      this.render();
      return;
    }
    this.audio.play('target');
    this.onBuy(ship, givenName);
  }

  private cancelNaming(): void {
    this.naming = false;
    this.nameInputValue = '';
    this.failure = null;
    this.audio.play('soft');
    this.render();
  }

  private cycle(delta: number): void {
    if (!this.stock) return;
    const count = this.stock.ships.length;
    if (count === 0) return;
    this.selected = (this.selected + delta + count) % count;
    this.audio.play('soft');
    this.render();
  }

  // --- keyboard ───────────────────────────────────────────────────────────

  handleKey(event: KeyboardEvent): boolean {
    if (this.naming) {
      // The name input handles Enter/Escape itself — let those through.
      return false;
    }

    if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
      this.cycle(-1);
      return true;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
      this.cycle(1);
      return true;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      if (!this.stock) return false;
      event.preventDefault();
      this.buySelected();
      return true;
    }
    if (this.failure && (event.key === 'r' || event.key === 'R')) {
      this.audio.play('normal');
      this.startLoad();
      return true;
    }
    if (event.key === 'Escape' || event.key === 'l' || event.key === 'L') {
      this.audio.play('normal');
      this.onLeave();
      return true;
    }
    return false;
  }

  // --- lifecycle ──────────────────────────────────────────────────────────

  mount(): void {
    requestAnimationFrame(() => this.element.classList.add('is-visible'));
  }

  unmount(): void {
    this.destroyed = true;
    this.naming = false;
    this.element.classList.remove('is-visible');
  }
}
