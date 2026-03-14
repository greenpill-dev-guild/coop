import type { ReviewDraft } from '@coop/shared';
import { describe, expect, it } from 'vitest';
import type { DashboardResponse, RuntimeRequest } from '../messages';

describe('privacy runtime message types', () => {
  it('accepts get-privacy-identity as a valid RuntimeRequest', () => {
    const msg: RuntimeRequest = {
      type: 'get-privacy-identity',
      payload: { coopId: 'coop-1', memberId: 'member-1' },
    };
    expect(msg.type).toBe('get-privacy-identity');
  });

  it('accepts get-stealth-meta-address as a valid RuntimeRequest', () => {
    const msg: RuntimeRequest = {
      type: 'get-stealth-meta-address',
      payload: { coopId: 'coop-1' },
    };
    expect(msg.type).toBe('get-stealth-meta-address');
  });

  it('accepts get-membership-commitments as a valid RuntimeRequest', () => {
    const msg: RuntimeRequest = {
      type: 'get-membership-commitments',
      payload: { coopId: 'coop-1' },
    };
    expect(msg.type).toBe('get-membership-commitments');
  });

  it('accepts publish-draft with optional anonymous flag', () => {
    const msg: RuntimeRequest = {
      type: 'publish-draft',
      payload: {
        draft: {} as unknown as ReviewDraft,
        targetCoopIds: ['coop-1'],
        anonymous: true,
      },
    };
    expect(msg.type).toBe('publish-draft');
    if (msg.type === 'publish-draft') {
      expect(msg.payload.anonymous).toBe(true);
    }
  });

  it('accepts publish-draft without anonymous flag (backward compatible)', () => {
    const msg: RuntimeRequest = {
      type: 'publish-draft',
      payload: {
        draft: {} as unknown as ReviewDraft,
        targetCoopIds: ['coop-1'],
      },
    };
    expect(msg.type).toBe('publish-draft');
    if (msg.type === 'publish-draft') {
      expect(msg.payload.anonymous).toBeUndefined();
    }
  });
});

describe('DashboardResponse runtimeConfig includes providerMode', () => {
  it('has providerMode in the type definition', () => {
    const config: DashboardResponse['runtimeConfig'] = {
      chainKey: 'sepolia',
      onchainMode: 'mock',
      archiveMode: 'mock',
      sessionMode: 'off',
      receiverAppUrl: 'http://localhost:3001',
      signalingUrls: [],
      providerMode: 'standard',
    };
    expect(config.providerMode).toBe('standard');
  });
});
