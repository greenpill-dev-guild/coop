import { describe, expect, it } from 'vitest';
import { type InviteShareInput, buildInviteShareContent } from '../../shared/invite-share';
import type { PopupInviteCardItem } from '../popup-types';

const FIXED_EXPIRY = '2026-06-15T00:00:00.000Z';
const FIXED_CODE = 'FARM-COOP-42';

function makeInvite(overrides: Partial<PopupInviteCardItem> = {}): PopupInviteCardItem {
  return {
    inviteType: 'member',
    status: 'active',
    code: FIXED_CODE,
    expiresAt: FIXED_EXPIRY,
    usedCount: 0,
    ...overrides,
  };
}

function makeShareInput(overrides: Partial<InviteShareInput> = {}): InviteShareInput {
  return {
    coopName: 'River Guardians',
    inviteType: 'member',
    code: FIXED_CODE,
    expiresAt: FIXED_EXPIRY,
    ...overrides,
  };
}

/** Mirrors the disableShare logic from PopupInviteTypeCard */
function isShareDisabled(invite: PopupInviteCardItem): boolean {
  return (
    !invite.code ||
    invite.status === 'missing' ||
    invite.status === 'revoked' ||
    invite.status === 'expired'
  );
}

describe('invite share: button eligibility', () => {
  describe('disabled states', () => {
    it('disables share for expired invites', () => {
      const invite = makeInvite({ status: 'expired' });
      expect(isShareDisabled(invite)).toBe(true);
    });

    it('disables share for revoked invites', () => {
      const invite = makeInvite({ status: 'revoked' });
      expect(isShareDisabled(invite)).toBe(true);
    });

    it('disables share for missing invites', () => {
      const invite = makeInvite({ status: 'missing', code: undefined });
      expect(isShareDisabled(invite)).toBe(true);
    });

    it('disables share when code is absent even if status is active', () => {
      const invite = makeInvite({ status: 'active', code: undefined });
      expect(isShareDisabled(invite)).toBe(true);
    });
  });

  describe('enabled states', () => {
    it('enables share for active invites with a code', () => {
      const invite = makeInvite({ status: 'active', code: FIXED_CODE });
      expect(isShareDisabled(invite)).toBe(false);
    });

    it('enables share for used invites with a code', () => {
      const invite = makeInvite({ status: 'used', code: FIXED_CODE, usedCount: 3 });
      expect(isShareDisabled(invite)).toBe(false);
    });

    it('enables share for trusted active invites', () => {
      const invite = makeInvite({ inviteType: 'trusted', status: 'active' });
      expect(isShareDisabled(invite)).toBe(false);
    });
  });
});

describe('invite share: buildInviteShareContent', () => {
  describe('previewTitle', () => {
    it('returns member preview title for member invites', () => {
      const content = buildInviteShareContent(makeShareInput({ inviteType: 'member' }));
      expect(content.previewTitle).toBe('Member invite to River Guardians');
    });

    it('returns trusted preview title for trusted invites', () => {
      const content = buildInviteShareContent(makeShareInput({ inviteType: 'trusted' }));
      expect(content.previewTitle).toBe('Trusted invite to River Guardians');
    });

    it('includes the coop name in the preview title', () => {
      const content = buildInviteShareContent(
        makeShareInput({ coopName: 'Soil Stewards', inviteType: 'member' }),
      );
      expect(content.previewTitle).toBe('Member invite to Soil Stewards');
    });
  });

  describe('shareText', () => {
    it('contains the coop name in member share text', () => {
      const content = buildInviteShareContent(makeShareInput({ coopName: 'Forest Keepers' }));
      expect(content.shareText).toContain('Forest Keepers');
    });

    it('contains the invite code in share text', () => {
      const content = buildInviteShareContent(makeShareInput({ code: 'JOIN-XYZ-99' }));
      expect(content.shareText).toContain('JOIN-XYZ-99');
    });

    it('contains a formatted expiry date in share text', () => {
      const content = buildInviteShareContent(makeShareInput({ expiresAt: FIXED_EXPIRY }));
      // toLocaleDateString uses local time, so the rendered day may shift by timezone.
      // Assert on the year and the "Expires" prefix which are always stable.
      expect(content.shareText).toMatch(/Expires .+ 2026/);
      expect(content.shareText).toMatch(/June/);
    });

    it('includes member role description for member invites', () => {
      const content = buildInviteShareContent(makeShareInput({ inviteType: 'member' }));
      expect(content.shareText).toContain('Join');
      expect(content.shareText).toContain('as a member');
    });

    it('includes trusted role description for trusted invites', () => {
      const content = buildInviteShareContent(makeShareInput({ inviteType: 'trusted' }));
      expect(content.shareText).toContain('Join');
      expect(content.shareText).toContain('as a trusted member');
    });
  });

  describe('confirmBeforeNativeShare', () => {
    it('sets confirmBeforeNativeShare to true for trusted invites', () => {
      const content = buildInviteShareContent(makeShareInput({ inviteType: 'trusted' }));
      expect(content.confirmBeforeNativeShare).toBe(true);
    });

    it('sets confirmBeforeNativeShare to false for member invites', () => {
      const content = buildInviteShareContent(makeShareInput({ inviteType: 'member' }));
      expect(content.confirmBeforeNativeShare).toBe(false);
    });
  });

  describe('trustedWarning', () => {
    it('includes a trusted warning string for trusted invites', () => {
      const content = buildInviteShareContent(makeShareInput({ inviteType: 'trusted' }));
      const { trustedWarning } = content;
      expect(trustedWarning).toBeTypeOf('string');
      if (!trustedWarning) {
        throw new Error('Expected trusted invite share content to include a warning');
      }
      expect(trustedWarning.length).toBeGreaterThan(0);
    });

    it('returns null trusted warning for member invites', () => {
      const content = buildInviteShareContent(makeShareInput({ inviteType: 'member' }));
      expect(content.trustedWarning).toBeNull();
    });
  });

  describe('previewBody matches shareText', () => {
    it('uses the same message for previewBody and shareText', () => {
      const content = buildInviteShareContent(makeShareInput());
      expect(content.previewBody).toBe(content.shareText);
    });
  });
});
