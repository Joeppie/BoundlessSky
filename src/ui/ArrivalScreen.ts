// The landing splash — shown when the start conversation completes, and again
// once the first quest is accepted. It summarizes the pilot's state and hands
// off to the next screen.

import { createScreen } from './Panel';
import type { Audio } from '../audio/Audio';
import type { PlayerInfo } from '../game/PlayerInfo';

export interface ArrivalScreenOptions {
  kicker?: string;
  title?: string;
  sub?: string;
  hint?: string;
  meta?: [string, string][];
}

export class ArrivalScreen {
  readonly element: HTMLElement;
  private audio: Audio;
  private player: PlayerInfo;
  private onContinue: () => void;

  constructor(audio: Audio, player: PlayerInfo, onContinue: () => void, options: ArrivalScreenOptions = {}) {
    this.audio = audio;
    this.player = player;
    this.onContinue = onContinue;

    this.element = createScreen('arrival-screen');

    const inner = document.createElement('div');
    inner.className = 'arrival-inner';

    const kicker = document.createElement('div');
    kicker.className = 'arrival-kicker';
    kicker.textContent = options.kicker ?? 'Arrived';

    const title = document.createElement('h1');
    title.className = 'arrival-title';
    title.textContent = options.title ?? player.planetName ?? 'New Boston';

    const sub = document.createElement('div');
    sub.className = 'arrival-sub';
    sub.textContent = options.sub ?? player.systemName ?? 'Rutilicus';

    const account = player.account;
    const flagship = player.flagship();
    const defaultRows: [string, string][] = [
      ['Date', player.date?.toString() ?? '—'],
      ['Pilot', player.pilot ? player.pilot.fullName() : (player.firstName + ' ' + player.lastName).trim() || '(Unnamed pilot)'],
      ['Credits', String(account.credits ?? 0)],
      ['Debt', String(account.totalDebt?.() ?? 0)],
    ];
    const rows: [string, string][] = options.meta ?? defaultRows;

    const meta = document.createElement('div');
    meta.className = 'arrival-meta';
    for (const [label, value] of rows) {
      const cell = document.createElement('div');
      cell.className = 'arrival-meta-cell';
      const l = document.createElement('div');
      l.className = 'arrival-meta-label';
      l.textContent = label;
      const v = document.createElement('div');
      v.className = 'arrival-meta-value';
      v.textContent = value;
      cell.append(l, v);
      meta.appendChild(cell);
    }

    // A tappable continue button — every action must be a button, not just a key.
    const continueButton = document.createElement('button');
    continueButton.type = 'button';
    continueButton.className = 'arrival-continue';
    continueButton.innerHTML = `<span class="menu-key">Enter</span> ${options.hint ?? 'back to the menu'}`;
    continueButton.addEventListener('mouseenter', () => this.audio.play('soft'));
    continueButton.addEventListener('click', () => {
      this.audio.play('normal');
      this.onContinue();
    });

    inner.append(kicker, title, sub, meta, continueButton);
    // A ship line when a ship is on file.
    if (flagship) {
      const ship = document.createElement('div');
      ship.className = 'arrival-ship';
      ship.textContent = `Ship: ${flagship.givenName} — ${flagship.model.name} (${flagship.model.category})`;
      inner.insertBefore(ship, continueButton);
    }
    this.element.appendChild(inner);
  }

  mount(): void {
    requestAnimationFrame(() => this.element.classList.add('is-visible'));
  }

  unmount(): void {
    this.element.classList.remove('is-visible');
  }

  handleKey(event: KeyboardEvent): boolean {
    if (event.key === 'Enter' || event.key === ' ') {
      this.audio.play('normal');
      this.onContinue();
      return true;
    }
    return false;
  }
}
