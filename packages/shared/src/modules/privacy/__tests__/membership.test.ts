import { beforeEach, describe, expect, it, vi } from 'vitest';

const semaphoreMocks = vi.hoisted(() => ({
  Identity: vi.fn(),
  Group: vi.fn(),
  generateProof: vi.fn(),
  verifyProof: vi.fn(),
}));

vi.mock('@semaphore-protocol/core', () => ({
  Identity: semaphoreMocks.Identity,
  Group: semaphoreMocks.Group,
  generateProof: semaphoreMocks.generateProof,
  verifyProof: semaphoreMocks.verifyProof,
}));

import {
  membershipProofSchema,
  privacyGroupSchema,
  privacyIdentitySchema,
} from '../../../contracts/schema';
import {
  createMembershipGroup,
  createPrivacyIdentity,
  generateMembershipProof,
  restorePrivacyIdentity,
  verifyMembershipProof,
} from '../membership';

describe('privacy membership', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createPrivacyIdentity', () => {
    it('creates a new Semaphore identity and returns serializable form', () => {
      const mockIdentity = {
        privateKey: 'mock-private-key',
        publicKey: [BigInt(123), BigInt(456)],
        commitment: BigInt(789),
        export: vi.fn().mockReturnValue('base64-exported-key'),
      };
      semaphoreMocks.Identity.mockImplementation(() => mockIdentity);

      const result = createPrivacyIdentity();

      expect(semaphoreMocks.Identity).toHaveBeenCalledOnce();
      expect(result.commitment).toBe('789');
      expect(result.publicKey).toEqual(['123', '456']);
      expect(result.exportedPrivateKey).toBe('base64-exported-key');
      expect(privacyIdentitySchema.safeParse(result).success).toBe(true);
    });
  });

  describe('restorePrivacyIdentity', () => {
    it('restores identity from a secret message string', () => {
      const mockIdentity = {
        privateKey: 'restored-key',
        publicKey: [BigInt(111), BigInt(222)],
        commitment: BigInt(333),
        export: vi.fn().mockReturnValue('restored-base64'),
      };
      semaphoreMocks.Identity.mockImplementation(() => mockIdentity);

      const result = restorePrivacyIdentity('my-secret-message');

      expect(semaphoreMocks.Identity).toHaveBeenCalledWith('my-secret-message');
      expect(result.commitment).toBe('333');
      expect(result.exportedPrivateKey).toBe('restored-base64');
      expect(privacyIdentitySchema.safeParse(result).success).toBe(true);
    });

    it('throws on empty secret message', () => {
      expect(() => restorePrivacyIdentity('')).toThrow('secretMessage must be a non-empty string');
    });
  });

  describe('createMembershipGroup', () => {
    it('creates an off-chain group from member commitments', () => {
      const mockGroup = {
        root: BigInt(999),
        depth: 20,
        size: 3,
        members: [BigInt(1), BigInt(2), BigInt(3)],
      };
      semaphoreMocks.Group.mockImplementation(() => mockGroup);

      const commitments = ['1', '2', '3'];
      const result = createMembershipGroup(commitments);

      expect(semaphoreMocks.Group).toHaveBeenCalledWith([BigInt(1), BigInt(2), BigInt(3)]);
      expect(result.group).toBe(mockGroup);
      expect(result.metadata.memberCount).toBe(3);
      expect(result.metadata.merkleRoot).toBe('999');
      expect(privacyGroupSchema.safeParse(result.metadata).success).toBe(true);
    });

    it('throws on empty member list', () => {
      expect(() => createMembershipGroup([])).toThrow(
        'members must contain at least one commitment',
      );
    });
  });

  describe('generateMembershipProof', () => {
    it('generates a ZK proof of membership', async () => {
      const mockProof = {
        merkleTreeDepth: 20,
        merkleTreeRoot: '12345',
        nullifier: '67890',
        message: '11111',
        scope: '22222',
        points: ['1', '2', '3', '4', '5', '6', '7', '8'],
      };
      semaphoreMocks.generateProof.mockResolvedValue(mockProof);

      const mockIdentityInstance = { commitment: BigInt(1) };
      const mockGroupInstance = { root: BigInt(999) };

      const result = await generateMembershipProof(
        mockIdentityInstance,
        mockGroupInstance,
        'hello',
        'election-1',
      );

      expect(semaphoreMocks.generateProof).toHaveBeenCalledWith(
        mockIdentityInstance,
        mockGroupInstance,
        'hello',
        'election-1',
      );
      expect(result).toEqual(mockProof);
      expect(membershipProofSchema.safeParse(result).success).toBe(true);
    });
  });

  describe('verifyMembershipProof', () => {
    it('returns true for a valid proof', async () => {
      semaphoreMocks.verifyProof.mockResolvedValue(true);

      const proof = {
        merkleTreeDepth: 20,
        merkleTreeRoot: '12345',
        nullifier: '67890',
        message: '11111',
        scope: '22222',
        points: ['1', '2', '3', '4', '5', '6', '7', '8'],
      };

      const result = await verifyMembershipProof(proof);

      expect(semaphoreMocks.verifyProof).toHaveBeenCalledWith(proof);
      expect(result).toBe(true);
    });

    it('returns false for an invalid proof', async () => {
      semaphoreMocks.verifyProof.mockResolvedValue(false);

      const proof = {
        merkleTreeDepth: 20,
        merkleTreeRoot: '12345',
        nullifier: '67890',
        message: '11111',
        scope: '22222',
        points: ['1', '2', '3', '4', '5', '6', '7', '8'],
      };

      const result = await verifyMembershipProof(proof);
      expect(result).toBe(false);
    });
  });
});
