// The audio module — plays the reference's UI sounds through Web Audio.
//
// Faithful to the reference's UI sounds (endless-sky/source/UI.cpp):
// - NORMAL → sounds/ui/click.wav
// - SOFT → sounds/ui/click soft.wav
// - SOFT_BUZZ → sounds/ui/buzz soft.wav
// - TARGET → sounds/ui/target.wav
// - FAILURE → sounds/ui/fail.wav
//
// Audio is initialized on user gesture (the browser's autoplay policy), so
// the loading panel unlocks it on first interaction.

export type UiSound = 'normal' | 'soft' | 'softBuzz' | 'target' | 'failure';

const SOUND_FILES: Record<UiSound, string> = {
  normal: '/content/sounds/ui/click.wav',
  soft: '/content/sounds/ui/click soft.wav',
  softBuzz: '/content/sounds/ui/buzz soft.wav',
  target: '/content/sounds/ui/target.wav',
  failure: '/content/sounds/ui/fail.wav',
};

export class Audio {
  private context: AudioContext | null = null;
  private buffers = new Map<UiSound, AudioBuffer>();
  private loading: Promise<void> | null = null;

  // Unlock the context and load the sound files. Called from user-gesture
  // context (or at the end of the boot sequence, where we are still allowed
  // to start the context in most browsers).
  async init(onProgress?: (fraction: number, message: string) => void): Promise<void> {
    if (this.loading) return this.loading;
    this.loading = this._load(onProgress);
    await this.loading;
  }

  private async _load(onProgress?: (fraction: number, message: string) => void): Promise<void> {
    const ctx = new AudioContext();
    this.context = ctx;
    const keys = Object.keys(SOUND_FILES) as UiSound[];
    for (let i = 0; i < keys.length; ++i) {
      const key = keys[i];
      onProgress?.((i + 1) / keys.length * 0.5, `Loading sounds… (${key})`);
      try {
        const response = await fetch(SOUND_FILES[key], { credentials: 'omit' });
        if (!response.ok) continue;
        const bytes = await response.arrayBuffer();
        const buffer = await ctx.decodeAudioData(bytes);
        this.buffers.set(key, buffer);
      } catch {
        // Sounds are nice-to-have; a missing file is not fatal.
      }
    }
    onProgress?.(1, 'Sounds ready');
  }

  // Play a UI sound at full volume. No-ops if not loaded.
  play(sound: UiSound): void {
    const buffer = this.buffers.get(sound);
    if (!buffer || !this.context) return;
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    const gain = this.context.createGain();
    gain.gain.value = 0.9;
    source.connect(gain).connect(this.context.destination);
    source.start();
  }

  // Ensure the context is running (browser gesture requirements).
  async resume(): Promise<void> {
    if (this.context && this.context.state === 'suspended') {
      await this.context.resume();
    }
  }
}
