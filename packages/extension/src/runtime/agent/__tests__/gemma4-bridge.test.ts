import { describe, expect, it } from 'vitest';
import {
  AgentGemma4Bridge,
  getDefaultGemma4ModelId,
  getQualityGemma4ModelId,
  parseGemma4ToolCall,
} from '../gemma4-bridge';

describe('parseGemma4ToolCall', () => {
  it('extracts a tool call wrapped in <tool_call> tags', () => {
    const text = `Sure, I'll call it.\n<tool_call>{"name": "extract_opportunity", "arguments": {"candidates": []}}</tool_call>`;
    const call = parseGemma4ToolCall(text);
    expect(call?.name).toBe('extract_opportunity');
    expect(call?.arguments).toEqual({ candidates: [] });
  });

  it('falls back to a JSON object embedded in a fenced block', () => {
    const text = '```json\n{"name":"score_grant_fit","arguments":{"scores":[]}}\n```';
    const call = parseGemma4ToolCall(text);
    expect(call?.name).toBe('score_grant_fit');
    expect(call?.arguments).toEqual({ scores: [] });
  });

  it('accepts the alternate `parameters` key', () => {
    const text =
      '<tool_call>{"name":"draft_application_outline","parameters":{"sections":["intro"]}}</tool_call>';
    const call = parseGemma4ToolCall(text);
    expect(call?.arguments).toEqual({ sections: ['intro'] });
  });

  it('returns undefined when no name field is present', () => {
    const text = '<tool_call>{"arguments":{"foo":1}}</tool_call>';
    expect(parseGemma4ToolCall(text)).toBeUndefined();
  });

  it('returns undefined for prose with no JSON object', () => {
    expect(parseGemma4ToolCall('I will think about it.')).toBeUndefined();
  });

  it('returns undefined for non-JSON content inside the tag', () => {
    expect(parseGemma4ToolCall('<tool_call>not json</tool_call>')).toBeUndefined();
  });
});

describe('AgentGemma4Bridge', () => {
  it('exposes the E2B model id by default and switches to E4B on request', () => {
    const bridge = new AgentGemma4Bridge();
    expect(bridge.status.model).toBe(getDefaultGemma4ModelId());
    bridge.setModelVariant('E4B');
    expect(bridge.status.model).toBe(getQualityGemma4ModelId());
    bridge.setModelVariant('E2B');
    expect(bridge.status.model).toBe(getDefaultGemma4ModelId());
    bridge.teardown();
  });

  it('reports an unready status on construction', () => {
    const bridge = new AgentGemma4Bridge();
    expect(bridge.status.ready).toBe(false);
    expect(bridge.status.error).toBeUndefined();
    bridge.teardown();
  });
});
