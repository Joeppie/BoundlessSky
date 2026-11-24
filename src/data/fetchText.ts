// Bounded text fetch — used by the lazily-loaded data files (sales, ships,
// intro missions). Without a timeout a stalled or dead connection leaves the
// caller waiting forever (e.g. a phone on a flaky Tailscale path), so every
// call is bounded and rejections carry a clear message.

export const FETCH_TIMEOUT_MS = 8_000;

export async function fetchText(url: string, timeoutMs = FETCH_TIMEOUT_MS): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { credentials: 'omit', signal: controller.signal });
    if (!response.ok) throw new Error(`could not load ${url} (HTTP ${response.status})`);
    return await response.text();
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error(`timed out loading ${url}`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
