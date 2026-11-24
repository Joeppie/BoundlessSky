// The main menu — the first screen after loading.
//
// Shows the title, a credits marquee (from the reference's credits.txt), the
// pilot card (hidden until a pilot is loaded) and two actions:
//   - NEW PILOT — start the new-pilot flow (StartConditionsPanel)
//   - CONTINUE — go to the landing splash (the pilot's start state)

import { createScreen } from './Panel';
import type { Audio } from '../audio/Audio';
import type { PlayerInfo } from '../game/PlayerInfo';

const CREDITS_URL = '/content/credits.txt';

const IDLE_CREDITS = [
  'Welcome to Endless Sky!',
  'Please give feedback on the project.',
  'Support us on Steam.',
];

export class MenuScreen {
  readonly element: HTMLElement;
  private title: HTMLElement;
  private pilotCard: HTMLElement;
  private pilotName: HTMLElement;
  private pilotDetail: HTMLElement;
  private newPilotButton: HTMLButtonElement;
  private continueButton: HTMLButtonElement;
  private creditsViewport: HTMLElement;
  private creditsTrack: HTMLElement;
  private audio: Audio;
  private onNewPilot: () => void;
  private onContinue: () => void;
  private onQuit: () => void;
  private player: PlayerInfo | null = null;
  private creditsOffset = 0;
  private creditsFrame = 0;
  private creditsPaused = false;
  private destroyed = false;

  constructor(audio: Audio, onNewPilot: () => void, onContinue: () => void, onQuit: () => void) {
    this.audio = audio;
    this.onNewPilot = onNewPilot;
    this.onContinue = onContinue;
    this.onQuit = onQuit;

    this.element = createScreen('menu-screen');

    // Left column — the title and the marquee.
    const left = document.createElement('div');
    left.className = 'menu-left';

    const kicker = document.createElement('div');
    kicker.className = 'menu-kicker';
    kicker.textContent = 'The 2D re-implementation';

    this.title = document.createElement('h1');
    this.title.className = 'menu-title';
    this.title.innerHTML = 'BOUND<span class="menu-title-glow">LESS</span><br>SKY';

    const tagline = document.createElement('p');
    tagline.className = 'menu-tagline';
    tagline.textContent = 'The same space adventure, built again — TypeScript, sprites, and dialogue you can actually play.';

    const marquee = document.createElement('div');
    marquee.className = 'menu-marquee';
    this.creditsViewport = document.createElement('div');
    this.creditsViewport.className = 'menu-marquee-viewport';
    this.creditsTrack = document.createElement('div');
    this.creditsTrack.className = 'menu-marquee-track';
    this.creditsViewport.appendChild(this.creditsTrack);
    this.creditsViewport.addEventListener('pointerenter', () => { this.creditsPaused = true; });
    this.creditsViewport.addEventListener('pointerleave', () => { this.creditsPaused = false; });

    marquee.appendChild(this.creditsViewport);

    left.append(kicker, this.title, tagline, marquee);

    // Right column — the pilot card and the actions.
    const right = document.createElement('div');
    right.className = 'menu-right';

    this.pilotCard = document.createElement('div');
    this.pilotCard.className = 'menu-pilot';
    const pilotKicker = document.createElement('div');
    pilotKicker.className = 'menu-pilot-kicker';
    pilotKicker.textContent = 'Pilot';
    this.pilotName = document.createElement('div');
    this.pilotName.className = 'menu-pilot-name';
    this.pilotName.textContent = 'No Pilot Loaded';
    this.pilotDetail = document.createElement('div');
    this.pilotDetail.className = 'menu-pilot-detail';
    this.pilotDetail.textContent = 'Press NEW PILOT to begin.';
    this.pilotCard.append(pilotKicker, this.pilotName, this.pilotDetail);

    this.newPilotButton = this.makeButton('New Pilot', 'primary', () => this.clickNewPilot(), 'NEW');
    this.continueButton = this.makeButton('Continue', 'normal', () => this.clickContinue(), 'ENTER');
    this.continueButton.disabled = true;

    const footer = document.createElement('div');
    footer.className = 'menu-footer';
    // A tappable quit button — everything tappable is a button.
    const quitButton = document.createElement('button');
    quitButton.type = 'button';
    quitButton.className = 'menu-quit';
    quitButton.innerHTML = '<span class="menu-key">Q</span> Quit';
    quitButton.addEventListener('mouseenter', () => this.audio.play('soft'));
    quitButton.addEventListener('click', () => { this.audio.play('normal'); this.onQuit(); });
    const hintRow = document.createElement('div');
    hintRow.className = 'menu-hint';
    hintRow.innerHTML = '<span class="menu-key">Enter</span> confirm &nbsp;·&nbsp; <span class="menu-key">Esc</span> menu';
    footer.append(quitButton, hintRow);

    right.append(this.pilotCard, this.newPilotButton, this.continueButton, footer);

    this.element.append(left, right);

    this.refreshPilotCard();
    void this.loadCredits();
  }

  private makeButton(label: string, variant: 'primary' | 'normal', onClick: () => void, keyHint: string): HTMLButtonElement {
    const button = document.createElement('button');
    button.className = `menu-button menu-button--${variant}`;
    button.innerHTML = `<span class="menu-button-label">${label}</span><span class="menu-button-key">${keyHint}</span>`;
    button.addEventListener('mouseenter', () => this.audio.play('soft'));
    button.addEventListener('click', () => {
      this.audio.play('normal');
      onClick();
    });
    return button;
  }

  setPlayer(player: PlayerInfo | null): void {
    this.player = player;
    this.refreshPilotCard();
  }

  private refreshPilotCard(): void {
    const player = this.player;
    const hasPilot = player?.isLoaded();
    if (hasPilot && player) {
      const name = [player.firstName, player.lastName].filter(Boolean).join(' ') || '(Unnamed pilot)';
      this.pilotName.textContent = name;
      const detailParts = [player.systemName, player.planetName].filter(Boolean);
      this.pilotDetail.textContent = detailParts.join(' · ');
      this.continueButton.disabled = false;
      this.newPilotButton.disabled = true;
      this.newPilotButton.classList.add('menu-button--dimmed');
    } else {
      this.pilotName.textContent = 'No Pilot Loaded';
      this.pilotDetail.textContent = 'Press NEW PILOT to begin.';
      this.continueButton.disabled = true;
      this.newPilotButton.disabled = false;
      this.newPilotButton.classList.remove('menu-button--dimmed');
    }
  }

  private clickNewPilot(): void {
    if (this.newPilotButton.disabled) return;
    this.onNewPilot();
  }

  private clickContinue(): void {
    if (this.continueButton.disabled) return;
    this.onContinue();
  }

  private async loadCredits(): Promise<void> {
    try {
      const response = await fetch(CREDITS_URL, { credentials: 'omit' });
      if (!response.ok) throw new Error(String(response.status));
      const text = await response.text();
      // Skip the first few lines (welcome + version), keep the credits.
      const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0 && !l.startsWith('Welcome') && !l.startsWith('version'));
      this.creditsLines = lines;
      this.fillMarquee();
    } catch {
      this.creditsLines = IDLE_CREDITS;
      this.fillMarquee();
    }
  }

  private creditsLines: string[] = IDLE_CREDITS;

  private fillMarquee(): void {
    const lines = [...this.creditsLines, ...this.creditsLines]; // loop seamlessly
    this.creditsTrack.innerHTML = '';
    for (const line of lines) {
      const row = document.createElement('div');
      row.className = 'menu-marquee-line';
      row.textContent = line;
      this.creditsTrack.appendChild(row);
    }
    this.creditsOffset = 0;
    this.creditsTrack.style.transform = 'translateY(0)';
    this.startMarquee();
  }

  private startMarquee(): void {
    cancelAnimationFrame(this.creditsFrame);
    const tick = () => {
      if (this.destroyed) return;
      if (!this.creditsPaused) {
        const total = this.creditsTrack.scrollHeight / 2;
        if (total > 0) {
          this.creditsOffset = (this.creditsOffset + 0.35) % total;
          this.creditsTrack.style.transform = `translateY(-${this.creditsOffset}px)`;
        }
      }
      this.creditsFrame = requestAnimationFrame(tick);
    };
    this.creditsFrame = requestAnimationFrame(tick);
  }

  mount(): void {
    requestAnimationFrame(() => this.element.classList.add('is-visible'));
  }

  unmount(): void {
    this.destroyed = true;
    cancelAnimationFrame(this.creditsFrame);
    this.element.classList.remove('is-visible');
  }

  handleKey(event: KeyboardEvent): boolean {
    if (event.key === 'Enter') {
      if (!this.newPilotButton.disabled) { this.clickNewPilot(); return true; }
      if (!this.continueButton.disabled) { this.clickContinue(); return true; }
    }
    if (event.key === 'q' || event.key === 'Q') {
      this.audio.play('normal');
      this.onQuit();
      return true;
    }
    return false;
  }
}
