import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiSdkMocks = vi.hoisted(() => ({
  createGroup: vi.fn(),
  addMemberByApiKey: vi.fn(),
  removeMemberByApiKey: vi.fn(),
  getGroup: vi.fn(),
  isGroupMember: vi.fn(),
}));

vi.mock('@bandada/api-sdk', () => {
  const MockApiSdk = vi.fn().mockImplementation(() => ({
    createGroup: apiSdkMocks.createGroup,
    addMemberByApiKey: apiSdkMocks.addMemberByApiKey,
    removeMemberByApiKey: apiSdkMocks.removeMemberByApiKey,
    getGroup: apiSdkMocks.getGroup,
    isGroupMember: apiSdkMocks.isGroupMember,
  }));
  return {
    ApiSdk: MockApiSdk,
    SupportedUrl: {
      DEV: 'http://localhost:3000',
      PROD: 'https://api.bandada.pse.dev',
      STAGING: 'https://api-staging.bandada.pse.dev',
    },
  };
});

import {
  addGroupMember,
  createBandadaGroup,
  getGroupMembers,
  isGroupMember,
  removeGroupMember,
} from '../groups';

describe('bandada group management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createBandadaGroup', () => {
    it('creates a group via Bandada API and returns the group', async () => {
      const mockGroup = {
        id: 'group-1',
        name: 'Test Coop',
        description: 'A test coop group',
        admin: 'admin-1',
        treeDepth: 16,
        fingerprint: 'fp-123',
        fingerprintDuration: 3600,
        createdAt: new Date(),
        members: [],
        credentials: null,
      };
      apiSdkMocks.createGroup.mockResolvedValue(mockGroup);

      const result = await createBandadaGroup({
        name: 'Test Coop',
        description: 'A test coop group',
        treeDepth: 16,
        fingerprintDuration: 3600,
        apiKey: 'test-api-key',
      });

      expect(apiSdkMocks.createGroup).toHaveBeenCalledWith(
        {
          name: 'Test Coop',
          description: 'A test coop group',
          treeDepth: 16,
          fingerprintDuration: 3600,
        },
        'test-api-key',
      );
      expect(result).toEqual(mockGroup);
    });

    it('throws on missing name', async () => {
      await expect(
        createBandadaGroup({
          name: '',
          description: 'desc',
          treeDepth: 16,
          fingerprintDuration: 3600,
          apiKey: 'key',
        }),
      ).rejects.toThrow('name is required');
    });

    it('throws on missing apiKey', async () => {
      await expect(
        createBandadaGroup({
          name: 'Test',
          description: 'desc',
          treeDepth: 16,
          fingerprintDuration: 3600,
          apiKey: '',
        }),
      ).rejects.toThrow('apiKey is required');
    });
  });

  describe('addGroupMember', () => {
    it('adds a member commitment to a group', async () => {
      apiSdkMocks.addMemberByApiKey.mockResolvedValue(undefined);

      await addGroupMember({
        groupId: 'group-1',
        commitment: '12345',
        apiKey: 'test-api-key',
      });

      expect(apiSdkMocks.addMemberByApiKey).toHaveBeenCalledWith(
        'group-1',
        '12345',
        'test-api-key',
      );
    });

    it('throws on empty groupId', async () => {
      await expect(
        addGroupMember({ groupId: '', commitment: '123', apiKey: 'key' }),
      ).rejects.toThrow('groupId is required');
    });

    it('throws on empty commitment', async () => {
      await expect(
        addGroupMember({ groupId: 'g1', commitment: '', apiKey: 'key' }),
      ).rejects.toThrow('commitment is required');
    });
  });

  describe('removeGroupMember', () => {
    it('removes a member commitment from a group', async () => {
      apiSdkMocks.removeMemberByApiKey.mockResolvedValue(undefined);

      await removeGroupMember({
        groupId: 'group-1',
        commitment: '12345',
        apiKey: 'test-api-key',
      });

      expect(apiSdkMocks.removeMemberByApiKey).toHaveBeenCalledWith(
        'group-1',
        '12345',
        'test-api-key',
      );
    });
  });

  describe('getGroupMembers', () => {
    it('returns member commitments for a group', async () => {
      apiSdkMocks.getGroup.mockResolvedValue({
        id: 'group-1',
        name: 'Test',
        members: ['111', '222', '333'],
      });

      const members = await getGroupMembers('group-1');

      expect(apiSdkMocks.getGroup).toHaveBeenCalledWith('group-1');
      expect(members).toEqual(['111', '222', '333']);
    });

    it('throws on empty groupId', async () => {
      await expect(getGroupMembers('')).rejects.toThrow('groupId is required');
    });
  });

  describe('isGroupMember', () => {
    it('returns true when commitment is a member', async () => {
      apiSdkMocks.isGroupMember.mockResolvedValue(true);

      const result = await isGroupMember('group-1', '12345');

      expect(apiSdkMocks.isGroupMember).toHaveBeenCalledWith('group-1', '12345');
      expect(result).toBe(true);
    });

    it('returns false when commitment is not a member', async () => {
      apiSdkMocks.isGroupMember.mockResolvedValue(false);

      const result = await isGroupMember('group-1', '99999');
      expect(result).toBe(false);
    });

    it('throws on empty groupId', async () => {
      await expect(isGroupMember('', '123')).rejects.toThrow('groupId is required');
    });

    it('throws on empty commitment', async () => {
      await expect(isGroupMember('g1', '')).rejects.toThrow('commitment is required');
    });
  });
});
