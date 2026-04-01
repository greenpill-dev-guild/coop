import { describe, expect, it } from 'vitest';
import { type InviteShareInput, buildInviteShareContent } from '../../../shared/invite-share';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FIXED_EXPIRY = '2026-06-15T00:00:00.000Z';

function makeInput(overrides: Partial<InviteShareInput> = {}): InviteShareInput {
  return {
    coopName: 'Watershed Coop',
    inviteType: 'member',
    code: 'ABCD-1234',
    expiresAt: FIXED_EXPIRY,
    ...overrides,
  };
}

function expectedExpiryString(): string {
  return new Date(FIXED_EXPIRY).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

// ---------------------------------------------------------------------------
// Member invite share content
// ---------------------------------------------------------------------------

describe('buildInviteShareContent — member invite', () => {
  it('includes "Join {coopName} as a member." in the share text', () => {
    const content = buildInviteShareContent(makeInput());

    expect(content.shareText).toContain('Join Watershed Coop as a member.');
  });

  it('includes the invite code in the share text', () => {
    const content = buildInviteShareContent(makeInput({ code: 'XYZ-9999' }));

    expect(content.shareText).toContain('XYZ-9999');
  });

  it('includes the locale-formatted expiry date in the share text', () => {
    const content = buildInviteShareContent(makeInput());

    expect(content.shareText).toContain(`Expires ${expectedExpiryString()}.`);
  });

  it('sets previewTitle to "Member invite to {coopName}"', () => {
    const content = buildInviteShareContent(makeInput());

    expect(content.previewTitle).toBe('Member invite to Watershed Coop');
  });

  it('sets previewBody equal to shareText', () => {
    const content = buildInviteShareContent(makeInput());

    expect(content.previewBody).toBe(content.shareText);
  });

  it('returns null for trustedWarning', () => {
    const content = buildInviteShareContent(makeInput());

    expect(content.trustedWarning).toBeNull();
  });

  it('does not require confirmation before native share', () => {
    const content = buildInviteShareContent(makeInput());

    expect(content.confirmBeforeNativeShare).toBe(false);
  });

  it('describes member access capabilities', () => {
    const content = buildInviteShareContent(makeInput());

    expect(content.shareText).toContain('capture, review, and participate');
  });

  it('notes that the code is reusable until revoked or expired', () => {
    const content = buildInviteShareContent(makeInput());

    expect(content.shareText).toContain(
      'This code can be used by multiple people until it is revoked or expires.',
    );
  });
});

// ---------------------------------------------------------------------------
// Trusted invite share content
// ---------------------------------------------------------------------------

describe('buildInviteShareContent — trusted invite', () => {
  it('includes "Join {coopName} as a trusted member." in the share text', () => {
    const content = buildInviteShareContent(makeInput({ inviteType: 'trusted' }));

    expect(content.shareText).toContain('Join Watershed Coop as a trusted member.');
  });

  it('includes the invite code in the share text', () => {
    const content = buildInviteShareContent(
      makeInput({ inviteType: 'trusted', code: 'TRUST-5678' }),
    );

    expect(content.shareText).toContain('TRUST-5678');
  });

  it('includes the locale-formatted expiry date in the share text', () => {
    const content = buildInviteShareContent(makeInput({ inviteType: 'trusted' }));

    expect(content.shareText).toContain(`Expires ${expectedExpiryString()}.`);
  });

  it('sets previewTitle to "Trusted invite to {coopName}"', () => {
    const content = buildInviteShareContent(makeInput({ inviteType: 'trusted' }));

    expect(content.previewTitle).toBe('Trusted invite to Watershed Coop');
  });

  it('returns the stewardship warning text', () => {
    const content = buildInviteShareContent(makeInput({ inviteType: 'trusted' }));

    expect(content.trustedWarning).toBe(
      'Trusted invites grant stewardship access. Share intentionally.',
    );
  });

  it('requires confirmation before native share', () => {
    const content = buildInviteShareContent(makeInput({ inviteType: 'trusted' }));

    expect(content.confirmBeforeNativeShare).toBe(true);
  });

  it('describes stewardship capabilities', () => {
    const content = buildInviteShareContent(makeInput({ inviteType: 'trusted' }));

    expect(content.shareText).toContain('steward the coop and manage invite codes');
  });

  it('notes that the code is reusable until revoked or expired', () => {
    const content = buildInviteShareContent(makeInput({ inviteType: 'trusted' }));

    expect(content.shareText).toContain(
      'This code can be used by multiple people until it is revoked or expires.',
    );
  });
});

// ---------------------------------------------------------------------------
// Nest-specific scenarios: different coop names and codes
// ---------------------------------------------------------------------------

describe('buildInviteShareContent — Nest integration scenarios', () => {
  it('handles a coop name with special characters', () => {
    const content = buildInviteShareContent(makeInput({ coopName: "Regen's Garden & Co." }));

    expect(content.shareText).toContain("Join Regen's Garden & Co. as a member.");
    expect(content.previewTitle).toBe("Member invite to Regen's Garden & Co.");
  });

  it('handles a short code', () => {
    const content = buildInviteShareContent(makeInput({ code: 'A' }));

    expect(content.shareText).toContain('\nA\n');
  });

  it('uses a different expiry date correctly', () => {
    const laterExpiry = '2027-12-31T23:59:59.000Z';
    const content = buildInviteShareContent(makeInput({ expiresAt: laterExpiry }));

    const expected = new Date(laterExpiry).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    expect(content.shareText).toContain(`Expires ${expected}.`);
  });

  it('member and trusted produce different share text for the same coop', () => {
    const base = { coopName: 'Test Coop', code: 'SAME-CODE', expiresAt: FIXED_EXPIRY };

    const memberContent = buildInviteShareContent({ ...base, inviteType: 'member' });
    const trustedContent = buildInviteShareContent({ ...base, inviteType: 'trusted' });

    expect(memberContent.shareText).not.toBe(trustedContent.shareText);
    expect(memberContent.shareText).toContain('as a member.');
    expect(trustedContent.shareText).toContain('as a trusted member.');
  });

  it('share text includes join instructions', () => {
    const content = buildInviteShareContent(makeInput());

    expect(content.shareText).toContain('Use this code in Coop > Join with Code:');
  });
});
