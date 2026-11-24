// The base panel class — every screen is a full-screen DOM element that the
// app mounts into #app. Enter/exit animations are CSS transitions toggled by
// the app, so the screens stay mostly DOM + classList juggling.

export interface Panel {
  readonly element: HTMLElement;
  // Show (mount + enter animation). Called once by the app.
  mount(): void;
  // Hide (exit animation). The app waits for it before unmounting.
  unmount(): void;
  // Called on every key press while the screen is on top. Return true if
  // the key was handled (no further propagation).
  handleKey(event: KeyboardEvent): boolean;
}

export function createScreen(className: string): HTMLElement {
  const el = document.createElement('div');
  el.className = `screen ${className}`;
  el.setAttribute('role', 'region');
  return el;
}

// Toggle an enter animation on the element.
export function playEnter(el: HTMLElement): void {
  requestAnimationFrame(() => {
    el.classList.add('is-visible');
  });
}

// Toggle an exit animation on the element; calls onDone after the transition.
export function playExit(el: HTMLElement, onDone: () => void): void {
  el.classList.remove('is-visible');
  el.classList.add('is-leaving');
  window.setTimeout(onDone, 380);
}
