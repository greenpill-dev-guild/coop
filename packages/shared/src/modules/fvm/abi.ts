/**
 * CoopRegistry ABI — generated from Foundry compilation.
 * Only includes the functions and events used by the TypeScript client.
 */
export const COOP_REGISTRY_ABI = [
  {
    type: 'function',
    name: 'registerArchive',
    inputs: [
      { name: 'rootCid', type: 'string', internalType: 'string' },
      { name: 'pieceCid', type: 'string', internalType: 'string' },
      { name: 'scope', type: 'uint8', internalType: 'uint8' },
      { name: 'coopId', type: 'string', internalType: 'string' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'registerMembership',
    inputs: [
      { name: 'coopId', type: 'string', internalType: 'string' },
      { name: 'commitment', type: 'string', internalType: 'string' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'registerMemberships',
    inputs: [
      { name: 'coopId', type: 'string', internalType: 'string' },
      { name: 'commitments', type: 'string[]', internalType: 'string[]' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'getArchives',
    inputs: [{ name: 'coop', type: 'address', internalType: 'address' }],
    outputs: [
      {
        name: '',
        type: 'tuple[]',
        internalType: 'struct CoopRegistry.ArchiveEntry[]',
        components: [
          { name: 'rootCid', type: 'string', internalType: 'string' },
          { name: 'pieceCid', type: 'string', internalType: 'string' },
          { name: 'scope', type: 'uint8', internalType: 'uint8' },
          { name: 'coopId', type: 'string', internalType: 'string' },
          { name: 'timestamp', type: 'uint48', internalType: 'uint48' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getArchiveCount',
    inputs: [{ name: 'coop', type: 'address', internalType: 'address' }],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getMemberCommitments',
    inputs: [{ name: 'coop', type: 'address', internalType: 'address' }],
    outputs: [{ name: '', type: 'string[]', internalType: 'string[]' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getMemberCommitmentCount',
    inputs: [{ name: 'coop', type: 'address', internalType: 'address' }],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'event',
    name: 'ArchiveRegistered',
    inputs: [
      { name: 'coop', type: 'address', indexed: true, internalType: 'address' },
      { name: 'idx', type: 'uint256', indexed: true, internalType: 'uint256' },
      { name: 'rootCid', type: 'string', indexed: false, internalType: 'string' },
      { name: 'pieceCid', type: 'string', indexed: false, internalType: 'string' },
      { name: 'scope', type: 'uint8', indexed: false, internalType: 'uint8' },
      { name: 'coopId', type: 'string', indexed: false, internalType: 'string' },
      { name: 'timestamp', type: 'uint48', indexed: false, internalType: 'uint48' },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'MembershipRegistered',
    inputs: [
      { name: 'coop', type: 'address', indexed: true, internalType: 'address' },
      { name: 'coopId', type: 'string', indexed: false, internalType: 'string' },
      { name: 'commitment', type: 'string', indexed: false, internalType: 'string' },
      { name: 'timestamp', type: 'uint48', indexed: false, internalType: 'uint48' },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'MembershipBatchRegistered',
    inputs: [
      { name: 'coop', type: 'address', indexed: true, internalType: 'address' },
      { name: 'coopId', type: 'string', indexed: false, internalType: 'string' },
      { name: 'count', type: 'uint256', indexed: false, internalType: 'uint256' },
      { name: 'timestamp', type: 'uint48', indexed: false, internalType: 'uint48' },
    ],
    anonymous: false,
  },
] as const;
