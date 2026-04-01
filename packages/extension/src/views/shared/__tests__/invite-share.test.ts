import { describe, expect, it } from 'vitest';
import { type InviteShareInput, buildInviteShareContent } from '../invite-share';

const FIXED_EXPIRY = '2026-06-15T00:00:00.000Z';

function memberInput(overrides?: Partial<InviteShareInput>): InviteShareInput {
  return {
    coopName: 'Garden Guild',
    inviteType: 'member',
    code: 'MEMBER-ABC-123',
    expiresAt: FIXED_EXPIRY,
    ...overrides,
  };
}

function trustedInput(overrides?: Partial<InviteShareInput>): InviteShareInput {
  return {
    coopName: 'Garden Guild',
    inviteType: 'trusted',
    code: 'TRUSTED-XYZ-789',
    expiresAt: FIXED_EXPIRY,
    ...overrides,
  };
}

const formattedExpiry = new Date(FIXED_EXPIRY).toLocaleDateString(undefined, {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
});

describe('buildInviteShareContent', () => {
  describe('member invite', () => {
    it('renders the correct preview title', () => {
      const result = buildInviteShareContent(memberInput());
      expect(result.previewTitle).toBe('Member invite to Garden Guild');
    });

    it('includes the invite code in the body', () => {
      const result = buildInviteShareContent(memberInput());
      expect(result.previewBody).toContain('MEMBER-ABC-123');
    });

    it('includes the formatted expiry date in the body', () => {
      const result = buildInviteShareContent(memberInput());
      expect(result.previewBody).toContain(`Expires ${formattedExpiry}`);
    });

    it('describes member access in the body', () => {
      const result = buildInviteShareContent(memberInput());
      expect(result.previewBody).toContain(
        'Member access lets you capture, review, and participate in the coop.',
      );
    });

    it('notes the code is reusable', () => {
      const result = buildInviteShareContent(memberInput());
      expect(result.previewBody).toContain(
        'This code can be used by multiple people until it is revoked or expires.',
      );
    });

    it('sets shareText equal to previewBody', () => {
      const result = buildInviteShareContent(memberInput());
      expect(result.shareText).toBe(result.previewBody);
    });

    it('sets trustedWarning to null', () => {
      const result = buildInviteShareContent(memberInput());
      expect(result.trustedWarning).toBeNull();
    });

    it('does not require confirmation before native share', () => {
      const result = buildInviteShareContent(memberInput());
      expect(result.confirmBeforeNativeShare).toBe(false);
    });
  });

  describe('trusted invite', () => {
    it('renders the correct preview title', () => {
      const result = buildInviteShareContent(trustedInput());
      expect(result.previewTitle).toBe('Trusted invite to Garden Guild');
    });

    it('includes the invite code in the body', () => {
      const result = buildInviteShareContent(trustedInput());
      expect(result.previewBody).toContain('TRUSTED-XYZ-789');
    });

    it('includes the formatted expiry date in the body', () => {
      const result = buildInviteShareContent(trustedInput());
      expect(result.previewBody).toContain(`Expires ${formattedExpiry}`);
    });

    it('describes stewardship in the body', () => {
      const result = buildInviteShareContent(trustedInput());
      expect(result.previewBody).toContain(
        'Trusted members can help steward the coop and manage invite codes.',
      );
    });

    it('notes the code is reusable', () => {
      const result = buildInviteShareContent(trustedInput());
      expect(result.previewBody).toContain(
        'This code can be used by multiple people until it is revoked or expires.',
      );
    });

    it('sets shareText equal to previewBody', () => {
      const result = buildInviteShareContent(trustedInput());
      expect(result.shareText).toBe(result.previewBody);
    });

    it('sets trustedWarning to the stewardship warning string', () => {
      const result = buildInviteShareContent(trustedInput());
      expect(result.trustedWarning).toBe(
        'Trusted invites grant stewardship access. Share intentionally.',
      );
    });

    it('requires confirmation before native share', () => {
      const result = buildInviteShareContent(trustedInput());
      expect(result.confirmBeforeNativeShare).toBe(true);
    });
  });

  describe('coop name variation', () => {
    it('embeds the coop name in member title and body', () => {
      const result = buildInviteShareContent(memberInput({ coopName: 'Reef Collective' }));
      expect(result.previewTitle).toBe('Member invite to Reef Collective');
      expect(result.previewBody).toContain('Join Reef Collective as a member.');
    });

    it('embeds the coop name in trusted title and body', () => {
      const result = buildInviteShareContent(trustedInput({ coopName: 'Reef Collective' }));
      expect(result.previewTitle).toBe('Trusted invite to Reef Collective');
      expect(result.previewBody).toContain('Join Reef Collective as a trusted member.');
    });
  });
});
