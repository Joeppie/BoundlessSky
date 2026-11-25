// The corner HUD — the player status block that stays pinned to the top-right
// corner of the screen at all times (menu, planet menu, shipyard, map/flight).
//
// Faithful to the reference's "hud" interface (player status): location, date
// and credits, plus the flagship glyph inside shield/hull rings. Honest about
// what we don't model yet: only the flagship's identity and mint-ship integrity
// are shown — no fuel/energy/heat bars (resources are Milestone 3+), so those
// bars are omitted rather than faked as full.

import type { PlayerInfo } from '../game/PlayerInfo';

export class CornerHud {
  readonly element: HTMLElement;
  private headerEl: HTMLElement;
  private glyphWrap: HTMLElement;
  private glyphImg: HTMLImageElement;
  private shieldRing: SVGCircleElement;
  private hullRing: SVGCircleElement;

  constructor() {
    this.element = document.createElement('div');
    this.element.className = 'corner-hud';
    this.element.setAttribute('aria-hidden', 'true');

    this.headerEl = document.createElement('div');
    this.headerEl.className = 'corner-hud-header';

    this.glyphWrap = document.createElement('div');
    this.glyphWrap.className = 'corner-hud-glyph';

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 84 84');
    svg.setAttribute('class', 'corner-hud-rings');

    // Outer ring = shields (cyan), inner = hull (olive/tan, like the reference).
    this.shieldRing = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    this.shieldRing.setAttribute('cx', '42');
    this.shieldRing.setAttribute('cy', '42');
    this.shieldRing.setAttribute('r', '38');
    this.shieldRing.setAttribute('class', 'corner-hud-ring corner-hud-ring--shield');

    this.hullRing = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    this.hullRing.setAttribute('cx', '42');
    this.hullRing.setAttribute('cy', '42');
    this.hullRing.setAttribute('r', '31');
    this.hullRing.setAttribute('class', 'corner-hud-ring corner-hud-ring--hull');

    svg.append(this.shieldRing, this.hullRing);

    this.glyphImg = document.createElement('img');
    this.glyphImg.className = 'corner-hud-ship';
    this.glyphImg.alt = '';
    this.glyphImg.addEventListener('error', () => { this.glyphImg.style.display = 'none'; });

    this.glyphWrap.append(svg, this.glyphImg);
    this.element.append(this.headerEl, this.glyphWrap);
    this.hide();
  }

  // Refresh from the live player. The header always shows (system, date,
  // credits — the reference draws it unconditionally); the flagship glyph
  // shows only once the player has a ship.
  setPlayer(player: PlayerInfo | null): void {
    if (!player || !player.isLoaded()) {
      this.hide();
      this.headerEl.innerHTML = '';
      this.glyphWrap.style.display = 'none';
      return;
    }
    this.element.style.display = '';

    this.headerEl.innerHTML = '';
    const system = document.createElement('div');
    system.className = 'corner-hud-system';
    system.textContent = player.getSystem() || '—';
    const date = document.createElement('div');
    date.className = 'corner-hud-date';
    date.textContent = player.date ? player.date.toString() : '—';
    const credits = document.createElement('div');
    credits.className = 'corner-hud-credits';
    credits.textContent = `${player.account.credits.toLocaleString('en-US')} credits`;
    this.headerEl.append(system, date, credits);

    // The flagship thumbnail + mint-ship integrity rings.
    const ship = player.flagship();
    if (ship) {
      this.glyphWrap.style.display = '';
      const thumb = ship.model.thumbnail;
      if (thumb) {
        this.glyphImg.src = `/content/images/${thumb}.png`;
        this.glyphImg.style.display = '';
      } else {
        this.glyphImg.removeAttribute('src');
        this.glyphImg.style.display = 'none';
      }
      // 100% integrity — our fleet models no damage yet (milestones 3+), so
      // the rings read as full, which is honest for a mint ship.
      this.shieldRing.style.strokeDasharray = 'none';
      this.hullRing.style.strokeDasharray = 'none';
    } else {
      this.glyphWrap.style.display = 'none';
    }
  }

  hide(): void {
    this.element.style.display = 'none';
    this.glyphWrap.style.display = 'none';
    this.headerEl.innerHTML = '';
  }
}
