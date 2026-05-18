import { describe, expect, it } from 'vitest';
import {
  buildGemma4FallbackPrompt,
  canUseBrowserCache,
  isUnsupportedChatTemplateError,
  normalizeGemma4InitConfig,
} from '../gemma4-worker';

describe('canUseBrowserCache', () => {
  it('uses browser cache when the runtime exposes cache storage', () => {
    expect(canUseBrowserCache({ caches: {} })).toBe(true);
  });

  it('disables browser cache when cache storage is missing', () => {
    expect(canUseBrowserCache({})).toBe(false);
  });

  it('disables browser cache when sandbox access throws', () => {
    const sandboxLikeScope = {};
    Object.defineProperty(sandboxLikeScope, 'caches', {
      get() {
        throw new Error('Cache storage is disabled.');
      },
    });

    expect(canUseBrowserCache(sandboxLikeScope)).toBe(false);
  });
});

describe('Gemma 4 chat-template fallback', () => {
  it('recognizes the unsupported Transformers.js trim filter error', () => {
    expect(isUnsupportedChatTemplateError(new Error('Unknown ArrayValue filter: trim'))).toBe(true);
    expect(isUnsupportedChatTemplateError(new Error('Other template error'))).toBe(false);
  });

  it('builds a plain prompt when Gemma 4 chat-template rendering is unavailable', () => {
    const prompt = buildGemma4FallbackPrompt(
      [
        { role: 'system', content: [{ type: 'text', text: 'Return JSON.' }] },
        {
          role: 'user',
          content: [
            { type: 'image' },
            { type: 'audio' },
            { type: 'text', text: 'Draft the action brief.' },
          ],
        },
      ],
      [
        {
          type: 'function',
          function: {
            name: 'draft_regen_action_brief',
            description: 'Draft an action brief.',
            parameters: { type: 'object' },
          },
        },
      ],
    );

    expect(prompt).toContain('SYSTEM:');
    expect(prompt).toContain('Return JSON.');
    expect(prompt).toContain('[image input attached]');
    expect(prompt).toContain('[audio input attached]');
    expect(prompt).toContain('draft_regen_action_brief');
    expect(prompt).toContain('ASSISTANT:');
  });
});

describe('normalizeGemma4InitConfig', () => {
  it('defaults to remote q4f16 WebGPU loading', () => {
    expect(normalizeGemma4InitConfig()).toEqual({
      modelSource: 'remote',
      localModelPath: null,
      dtype: 'q4f16',
      device: 'webgpu',
      useBrowserCache: undefined,
    });
  });

  it('accepts explicit local model loading config', () => {
    expect(
      normalizeGemma4InitConfig({
        modelSource: 'local',
        localModelPath: ' http://127.0.0.1:8765/models/ ',
        dtype: 'q4',
        device: 'wasm',
        useBrowserCache: false,
      }),
    ).toEqual({
      modelSource: 'local',
      localModelPath: 'http://127.0.0.1:8765/models/',
      dtype: 'q4',
      device: 'wasm',
      useBrowserCache: false,
    });
  });
});
