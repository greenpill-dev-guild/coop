import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const manifestPath = resolve(currentDir, '../../public/manifest.webmanifest');

describe('receiver PWA manifest', () => {
  it('uses the app route namespace for installed launches and shortcuts', () => {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
      start_url: string;
      scope: string;
      shortcuts: Array<{ url: string }>;
      share_target: { action: string };
    };

    expect(manifest.start_url).toBe('/app');
    expect(manifest.scope).toBe('/app');
    expect(manifest.shortcuts.map((shortcut) => shortcut.url)).toEqual([
      '/app/pair',
      '/app/receiver',
      '/app/inbox',
    ]);
    expect(manifest.share_target.action).toBe('/app/receiver');
  });
});
