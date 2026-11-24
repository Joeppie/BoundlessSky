// The app entry point — boots the game.
//
// main.ts renders nothing into the page; the Game does. It also starts a
// global keyboard route from every key press.

import '@fontsource/press-start-2p';
import '@fontsource/vt323';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';

import './style.css';
import { Game } from './app/Game';

const app = document.getElementById('app');

function scheduleShootingStar(): void {
  const shooting = document.getElementById('shooting');
  if (!shooting) return;
  const spawn = () => {
    const el = document.createElement('div');
    el.className = 'streak';
    const angle = 150 + Math.random() * 30; // degrees
    el.style.setProperty('--angle', `${angle}deg`);
    el.style.left = `${Math.random() * 70}%`;
    el.style.top = `${Math.random() * 45}%`;
    shooting.appendChild(el);
    window.setTimeout(() => el.remove(), 1300);
    window.setTimeout(spawn, 5000 + Math.random() * 9000);
  };
  window.setTimeout(spawn, 1500 + Math.random() * 3000);
}

async function boot(): Promise<void> {
  if (!app) throw new Error('#app element not found');
  const game = new Game(app);

  // Read-only debug/test handle for the e2e suite — never used by the game itself.
  (window as unknown as Record<string, unknown>).__boundlessSky = game;

  window.addEventListener('keydown', (event) => game.handleGlobalKey(event));

  scheduleShootingStar();

  await game.start();
}

void boot();
