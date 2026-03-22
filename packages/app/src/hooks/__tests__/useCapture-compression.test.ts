import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Verifies that useCapture compresses photos before stashing,
 * but leaves audio and file captures uncompressed.
 *
 * Uses source-level verification because the vite alias plugin resolves
 * @coop/shared to different entry points for app code vs test code,
 * making vi.mock interception unreliable for behavioral tests here.
 * The compressImage function itself is tested in
 * packages/shared/src/modules/blob/__tests__/compress.test.ts.
 */

const hookSource = fs.readFileSync(path.resolve(__dirname, '../useCapture.ts'), 'utf-8');

/** Extract the onPickFile callback body for targeted assertions. */
function extractOnPickFileBlock() {
  const start = hookSource.indexOf('const onPickFile');
  // Find the matching dependency array that closes the useCallback
  const depArrayMatch = hookSource.indexOf('[stashCapture]', start);
  return hookSource.slice(start, depArrayMatch + 30);
}

describe('useCapture photo compression', () => {
  it('imports compressImage from @coop/shared', () => {
    expect(hookSource).toMatch(
      /import\s*\{[^}]*compressImage[^}]*\}\s*from\s*['"]@coop\/shared['"]/,
    );
  });

  it('calls compressImage only when kind is photo', () => {
    const block = extractOnPickFileBlock();
    // Guard present
    expect(block).toMatch(/kind\s*===\s*['"]photo['"]/);
    // compressImage called with the blob
    expect(block).toMatch(/compressImage\s*\(\s*\{\s*blob/);
    // compressImage appears AFTER the photo guard (not unconditionally)
    const photoGuardIndex = block.indexOf("kind === 'photo'");
    const compressIndex = block.indexOf('compressImage');
    expect(compressIndex).toBeGreaterThan(photoGuardIndex);
  });

  it('replaces fileName extension to .webp after compression', () => {
    const block = extractOnPickFileBlock();
    expect(block).toMatch(/replaceExtension\s*\(\s*file\.name\s*,\s*['"]webp['"]\s*\)/);
  });

  it('wraps compression in try/catch for graceful fallback', () => {
    const block = extractOnPickFileBlock();
    // try block contains compressImage
    expect(block).toMatch(/try\s*\{[\s\S]*compressImage/);
    // catch block follows
    expect(block).toMatch(/\}\s*catch\s*[\s({]/);
  });

  it('falls through to raw stashCapture after catch', () => {
    const block = extractOnPickFileBlock();
    // After the try/catch, the final stashCapture uses the original file
    const catchIndex = block.lastIndexOf('catch');
    const fallbackStash = block.indexOf('stashCapture({ blob: file', catchIndex);
    expect(fallbackStash).toBeGreaterThan(catchIndex);
  });

  it('does NOT call compressImage for kind file', () => {
    const block = extractOnPickFileBlock();
    // The only path to compressImage is inside `if (kind === 'photo')`
    // Verify there's no second compressImage call outside that guard
    const firstCompress = block.indexOf('compressImage');
    const secondCompress = block.indexOf('compressImage', firstCompress + 1);
    // There should be no second compressImage call
    expect(secondCompress).toBe(-1);
  });

  it('uses the compressed blob (not the raw file) in the photo stash path', () => {
    const block = extractOnPickFileBlock();
    // Inside the try block, stashCapture should use compressedBlob, not file
    const tryIndex = block.indexOf('try');
    const catchIndex = block.indexOf('catch', tryIndex);
    const tryBlock = block.slice(tryIndex, catchIndex);
    expect(tryBlock).toMatch(/stashCapture\(\s*\{\s*blob:\s*compressedBlob/);
  });
});

describe('replaceExtension helper', () => {
  it('is defined in the hook module', () => {
    expect(hookSource).toMatch(/function\s+replaceExtension/);
  });

  it('handles dot-separated file names', () => {
    // Verify the implementation splits on the last dot
    expect(hookSource).toMatch(/lastIndexOf\s*\(\s*['"]\.['"]|\.lastIndexOf/);
  });
});
