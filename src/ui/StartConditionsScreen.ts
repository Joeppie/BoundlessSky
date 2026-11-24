// The scenario picker — the "start conditions" list, with the selected
// scenario's details on the right and a START button at the bottom.
//
// States (faithful to the reference): scenarios that are DISPLAYED are shown,
// but cannot be started (they're locked); UNLOCKED scenarios start the game.

import { createScreen } from './Panel';
import type { Audio } from '../audio/Audio';
import type { LoadedGameData } from '../data/GameData';
import { StartState } from '../game/StartConditions';
import type { StartConditions } from '../game/StartConditions';

const LOCKED_HINT = 'Complete this start’s conditions to unlock it.';

export class StartConditionsScreen {
  readonly element: HTMLElement;
  private listEl: HTMLElement;
  private thumbnailEl: HTMLImageElement;
  private infoName: HTMLElement;
  private infoDate: HTMLElement;
  private infoPlanet: HTMLElement;
  private infoSystem: HTMLElement;
  private infoCredits: HTMLElement;
  private infoDebt: HTMLElement;
  private infoDescription: HTMLElement;
  private startButton: HTMLButtonElement;
  private backButton: HTMLButtonElement;
  private infoStatusEl: HTMLElement;
  private audio: Audio;
  private starts: StartConditions[];
  private selected = 0;
  private onStart: (start: StartConditions) => void;
  private onBack: () => void;

  constructor(audio: Audio, data: LoadedGameData, onStart: (start: StartConditions) => void, onBack: () => void) {
    this.audio = audio;
    this.starts = data.starts;
    this.onStart = onStart;
    this.onBack = onBack;

    this.element = createScreen('startconditions-screen');

    // Left: the scenario list.
    const listCol = document.createElement('div');
    listCol.className = 'startconditions-list-col';
    listCol.innerHTML = '<div class="startconditions-kicker">Start scenario</div>';
    this.listEl = document.createElement('div');
    this.listEl.className = 'startconditions-list';
    listCol.appendChild(this.listEl);

    // Right: the scenario details.
    const infoCol = document.createElement('div');
    infoCol.className = 'startconditions-info-col';

    const infoCard = document.createElement('div');
    infoCard.className = 'startconditions-card';

    this.thumbnailEl = document.createElement('img');
    this.thumbnailEl.className = 'startconditions-thumb';
    this.thumbnailEl.alt = 'scenario thumbnail';

    const infoKicker = document.createElement('div');
    infoKicker.className = 'startconditions-info-kicker';
    infoKicker.textContent = 'Scenario';

    this.infoName = document.createElement('h2');
    this.infoName.className = 'startconditions-info-name';

    this.infoStatusEl = document.createElement('div');
    this.infoStatusEl.className = 'startconditions-status';

    const detailRow = document.createElement('div');
    detailRow.className = 'startconditions-detail-grid';
    this.infoDate = this.detailRow('date', 'Date');
    this.infoPlanet = this.detailRow('planet', 'Planet');
    this.infoSystem = this.detailRow('system', 'System');
    this.infoCredits = this.detailRow('credits', 'Credits');
    this.infoDebt = this.detailRow('debt', 'Debt');
    detailRow.append(this.infoDate, this.infoPlanet, this.infoSystem, this.infoCredits, this.infoDebt);

    this.infoDescription = document.createElement('div');
    this.infoDescription.className = 'startconditions-description';

    const controls = document.createElement('div');
    controls.className = 'startconditions-controls';

    this.backButton = document.createElement('button');
    this.backButton.className = 'startconditions-button startconditions-button--back';
    this.backButton.innerHTML = '<span class="startconditions-button-label">Back to Menu</span><span class="startconditions-button-key">B</span>';
    this.backButton.addEventListener('mouseenter', () => this.audio.play('soft'));
    this.backButton.addEventListener('click', () => { this.audio.play('soft'); this.onBack(); });

    this.startButton = document.createElement('button');
    this.startButton.className = 'startconditions-button startconditions-button--start';
    this.startButton.innerHTML = '<span class="startconditions-button-label">Start Game</span><span class="startconditions-button-key">S</span>';
    this.startButton.addEventListener('mouseenter', () => this.audio.play('soft'));
    this.startButton.addEventListener('click', () => this.start());

    controls.append(this.backButton, this.startButton);

    infoCard.append(this.thumbnailEl, infoKicker, this.infoName, this.infoStatusEl, detailRow, this.infoDescription);
    infoCol.appendChild(infoCard);
    // The controls are a direct child of the screen (not of the info card) so
    // they can stay pinned to the viewport's bottom edge — the Start button
    // must never be buried below the fold on a phone.
    this.element.append(listCol, infoCol, controls);

    this.renderList();
    this.renderInfo();
  }

  private detailRow(_label: string, _value: string): HTMLElement {
    const cell = document.createElement('div');
    cell.className = 'startconditions-detail-cell';
    const label = document.createElement('div');
    label.className = 'startconditions-detail-label';
    label.textContent = _value;
    const value = document.createElement('div');
    value.className = 'startconditions-detail-value';
    value.textContent = '…';
    cell.append(label, value);
    cell.dataset.role = _label;
    return cell;
  }

  private detailValue(role: string): HTMLElement {
    return this.element.querySelector<HTMLElement>(`[data-role="${role}"] .startconditions-detail-value`)!;
  }

  private renderList(): void {
    this.listEl.innerHTML = '';
    this.starts.forEach((start, i) => {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'startconditions-row';
      if (i === this.selected) row.classList.add('is-selected');
      if (start.state === StartState.UNLOCKED) row.classList.add('is-unlocked');
      else row.classList.add('is-locked');

      const index = document.createElement('span');
      index.className = 'startconditions-row-index';
      index.textContent = String(i + 1).padStart(2, '0');

      const text = document.createElement('span');
      text.className = 'startconditions-row-text';
      const name = document.createElement('span');
      name.className = 'startconditions-row-name';
      name.textContent = start.getDisplayName();
      const sub = document.createElement('span');
      sub.className = 'startconditions-row-sub';
      sub.textContent = start.state === StartState.UNLOCKED
        ? `${start.getSystemName()} · ${start.getPlanetName()}`
        : 'Locked';
      text.append(name, sub);

      const lock = document.createElement('span');
      lock.className = 'startconditions-row-lock';
      lock.textContent = start.state === StartState.UNLOCKED ? 'UNLOCKED' : 'LOCKED';

      row.append(index, text, lock);
      row.addEventListener('click', () => this.select(i));
      row.addEventListener('mouseenter', () => {
        if (i !== this.selected) {
          this.audio.play('soft');
          this.select(i);
        }
      });

      this.listEl.appendChild(row);
    });
  }

  private renderInfo(): void {
    const start = this.starts[this.selected];
    if (!start) return;

    const unlocked = start.state === StartState.UNLOCKED;
    const thumbnail = start.getThumbnail();
    if (thumbnail) {
      this.thumbnailEl.src = `/content/images/${thumbnail}.jpg`;
      this.thumbnailEl.style.display = '';
    } else {
      this.thumbnailEl.style.display = 'none';
    }

    this.infoName.textContent = start.getDisplayName();
    this.infoStatusEl.textContent = unlocked ? 'UNLOCKED' : 'LOCKED';
    this.infoStatusEl.classList.toggle('is-unlocked', unlocked);
    this.infoStatusEl.classList.toggle('is-locked', !unlocked);

    this.detailValue('date').textContent = start.getDateString();
    this.detailValue('planet').textContent = start.getPlanetName();
    this.detailValue('system').textContent = start.getSystemName();
    this.detailValue('credits').textContent = start.getCredits();
    this.detailValue('debt').textContent = start.getDebt();

    const description = start.getDescription().trim();
    this.infoDescription.textContent = unlocked ? description : description;
    this.infoDescription.classList.toggle('is-locked', !unlocked);

    this.startButton.disabled = !unlocked;
    this.startButton.classList.toggle('is-disabled', !unlocked);
  }

  private select(i: number): void {
    this.selected = i;
    this.renderList();
    this.renderInfo();
  }

  private start(): void {
    const start = this.starts[this.selected];
    if (!start) return;
    if (start.state !== StartState.UNLOCKED) {
      this.audio.play('failure');
      return;
    }
    this.audio.play('target');
    this.onStart(start);
  }

  mount(): void {
    requestAnimationFrame(() => this.element.classList.add('is-visible'));
  }

  unmount(): void {
    this.element.classList.remove('is-visible');
  }

  handleKey(event: KeyboardEvent): boolean {
    const len = this.starts.length;
    switch (event.key) {
      case 'ArrowUp':
        this.select((this.selected - 1 + len) % len);
        this.audio.play('soft');
        return true;
      case 'ArrowDown':
        this.select((this.selected + 1) % len);
        this.audio.play('soft');
        return true;
      case 'PageUp':
        this.select(Math.max(0, this.selected - Math.max(1, len - 1)));
        this.audio.play('soft');
        return true;
      case 'PageDown':
        this.select(Math.min(len - 1, this.selected + Math.max(1, len - 1)));
        this.audio.play('soft');
        return true;
      case 'Enter':
      case 's':
      case 'S':
        this.start();
        return true;
      case 'b':
      case 'B':
      case 'Escape':
        this.audio.play('soft');
        this.onBack();
        return true;
    }
    return false;
  }
}
