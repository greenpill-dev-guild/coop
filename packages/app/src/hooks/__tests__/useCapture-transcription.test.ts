import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Verifies that useCapture wires background transcription after audio capture.
 *
 * Uses source-level verification consistent with the existing app hook test
 * pattern (useCapture-compression.test.ts) because the vite alias plugin
 * resolves @coop/shared differently for app vs test code.
 */

const hookSource = fs.readFileSync(path.resolve(__dirname, '../useCapture.ts'), 'utf-8');

/** Extract the recorder.onstop callback body. */
function extractOnStopBlock() {
  const start = hookSource.indexOf('recorder.onstop');
  // Find the closing of the startRecording useCallback (its dependency array)
  const end = hookSource.indexOf('[isMountedRef, setMessage, stashCapture]', start);
  return hookSource.slice(start, end);
}

describe('useCapture audio transcription wiring', () => {
  it('imports isWhisperSupported from @coop/shared', () => {
    expect(hookSource).toMatch(
      /import\s*\{[^}]*isWhisperSupported[^}]*\}\s*from\s*['"]@coop\/shared['"]/,
    );
  });

  it('imports transcribeAudio from @coop/shared', () => {
    expect(hookSource).toMatch(
      /import\s*\{[^}]*transcribeAudio[^}]*\}\s*from\s*['"]@coop\/shared['"]/,
    );
  });

  it('imports saveCoopBlob from @coop/shared', () => {
    expect(hookSource).toMatch(
      /import\s*\{[^}]*saveCoopBlob[^}]*\}\s*from\s*['"]@coop\/shared['"]/,
    );
  });

  it('imports createId from @coop/shared', () => {
    expect(hookSource).toMatch(/import\s*\{[^}]*createId[^}]*\}\s*from\s*['"]@coop\/shared['"]/);
  });

  it('calls isWhisperSupported inside the onstop handler', () => {
    const block = extractOnStopBlock();
    expect(block).toContain('isWhisperSupported');
  });

  it('calls transcribeAudio with the audio blob', () => {
    const block = extractOnStopBlock();
    expect(block).toMatch(/transcribeAudio\s*\(\s*\{[\s\S]*?audioBlob/);
  });

  it('saves transcript via saveCoopBlob with kind audio-transcript', () => {
    const block = extractOnStopBlock();
    expect(block).toMatch(/saveCoopBlob/);
    expect(block).toMatch(/['"]audio-transcript['"]/);
  });

  it('wraps transcription in fire-and-forget pattern (non-blocking)', () => {
    const block = extractOnStopBlock();
    // The transcription should be kicked off without blocking the main flow.
    // Either via .then().catch() or void ... .catch()
    expect(block).toMatch(/\.then\s*\(|void\s+.*isWhisperSupported|\.catch/);
  });

  it('logs transcription failures with console.warn', () => {
    const block = extractOnStopBlock();
    expect(block).toMatch(/console\.warn\s*\(\s*['"\[`].*transcri/i);
  });

  it('skips transcription when whisper is not supported', () => {
    const block = extractOnStopBlock();
    // There should be a guard: if (!supported) return
    expect(block).toMatch(/!supported.*return|supported.*===.*false/);
  });

  it('skips empty transcription results', () => {
    const block = extractOnStopBlock();
    // Guard against empty text
    expect(block).toMatch(/result\.text.*trim\(\)|!.*text.*trim/);
  });

  it('links transcript to the audio capture via sourceEntityId', () => {
    const block = extractOnStopBlock();
    expect(block).toMatch(/sourceEntityId/);
  });

  it('uses the pairing coopId for the transcript blob', () => {
    const block = extractOnStopBlock();
    expect(block).toMatch(/coopId/);
  });
});
