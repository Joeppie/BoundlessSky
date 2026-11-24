import { defineConfig, type Plugin } from 'vitest/config';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = fileURLToPath(new URL('.', import.meta.url));
const CONTENT_ROOT = join(REPO_ROOT, 'endless-sky');

const MIME: Record<string, string> = {
  '.txt': 'text/plain; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

// Serve the reference content (data/, images/, sounds/, ...) from the read-only
// submodule at /content/<file>, without copying it into the build.
function contentPlugin(): Plugin {
  return {
    name: 'boundless-sky-content',
    configureServer(server) {
      server.middlewares.use('/content', serve);
    },
    configurePreviewServer(server) {
      server.middlewares.use('/content', serve);
    },
  };
}

async function serve(req: any, res: any, next: any) {
  const rel = normalize(decodeURIComponent(req.url ?? ''));
  if (rel.startsWith('..') || rel.includes('\0')) {
    res.statusCode = 403;
    res.end('Forbidden');
    return;
  }
  const file = join(CONTENT_ROOT, rel);
  try {
    const st = await stat(file);
    if (!st.isFile()) throw new Error('not a file');
    const type = MIME[extname(file).toLowerCase()] ?? 'application/octet-stream';
    res.setHeader('Content-Type', type);
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Content-Length', st.size);
    res.statusCode = 200;
    res.end(await readFile(file));
  } catch {
    next();
  }
}

export default defineConfig({
  plugins: [contentPlugin()],
  test: {
    // e2e/ is driven by Playwright (npx playwright test), not Vitest.
    exclude: ['e2e/**', 'node_modules/**', 'endless-sky/**'],
  },
  server: {
    fs: {
      allow: [REPO_ROOT],
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
