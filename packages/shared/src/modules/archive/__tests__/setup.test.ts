import { beforeEach, describe, expect, it, vi } from 'vitest';
import { extractClientCredentials, provisionStorachaSpace } from '../setup';

/* ------------------------------------------------------------------ */
/*  Mocks                                                              */
/* ------------------------------------------------------------------ */

const storachaMocks = vi.hoisted(() => {
  const spaceDid = 'did:key:z6MkSpace123' as const;
  const agentDid = 'did:key:z6MkAgent456' as const;

  const spaceCreateAuthorization = vi.fn(async () => ({
    archive: async () => ({
      ok: new Uint8Array([10, 20, 30, 40]),
    }),
  }));

  const space = {
    did: vi.fn(() => spaceDid),
    name: 'coop-test-coop',
    signer: {
      encode: vi.fn(() => new Uint8Array([1, 2, 3, 4, 5, 6])),
    },
    createAuthorization: spaceCreateAuthorization,
    save: vi.fn(async () => ({ ok: {} })),
  };

  const login = vi.fn(async () => ({
    did: vi.fn(() => 'did:mailto:example.com:alice'),
  }));

  const createSpace = vi.fn(async () => space);
  const did = vi.fn(() => agentDid);
  const agent = {
    issuer: {
      encode: vi.fn(() => new Uint8Array([7, 8, 9])),
    },
  };

  const clientFactory = vi.fn(async () => ({
    did,
    login,
    createSpace,
    agent: { issuer: agent.issuer },
    _agent: { issuer: agent.issuer },
    setCurrentSpace: vi.fn(),
  }));

  return {
    spaceDid,
    agentDid,
    space,
    login,
    createSpace,
    did,
    agent,
    clientFactory,
    spaceCreateAuthorization,
  };
});

vi.mock('@storacha/client', () => ({
  create: storachaMocks.clientFactory,
}));

vi.mock('@ucanto/principal/ed25519', () => ({
  encode: vi.fn((signer: { encode: () => Uint8Array }) => signer.encode()),
}));

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('provisionStorachaSpace', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a client, logs in, and creates a space', async () => {
    const result = await provisionStorachaSpace({
      email: 'alice@example.com',
      coopName: 'test-coop',
    });

    expect(storachaMocks.clientFactory).toHaveBeenCalledOnce();
    expect(storachaMocks.login).toHaveBeenCalledWith('alice@example.com', {
      signal: undefined,
    });
    expect(storachaMocks.createSpace).toHaveBeenCalledWith('coop-test-coop', {
      account: expect.anything(),
    });

    expect(result.publicConfig.spaceDid).toBe(storachaMocks.spaceDid);
    expect(result.publicConfig.gatewayBaseUrl).toBe('https://storacha.link');
    expect(result.publicConfig.allowsFilecoinInfo).toBe(true);
    expect(result.publicConfig.expirationSeconds).toBe(600);
  });

  it('passes abort signal through to login', async () => {
    const controller = new AbortController();
    await provisionStorachaSpace({
      email: 'bob@example.com',
      coopName: 'signal-coop',
      signal: controller.signal,
    });

    expect(storachaMocks.login).toHaveBeenCalledWith('bob@example.com', {
      signal: controller.signal,
    });
  });

  it('propagates login errors (email verification timeout)', async () => {
    storachaMocks.login.mockRejectedValueOnce(new Error('Email verification timed out'));

    await expect(
      provisionStorachaSpace({
        email: 'timeout@example.com',
        coopName: 'timeout-coop',
      }),
    ).rejects.toThrow('Email verification timed out');
  });

  it('propagates abort signal cancellation', async () => {
    const abortError = new DOMException('The operation was aborted.', 'AbortError');
    storachaMocks.login.mockRejectedValueOnce(abortError);

    await expect(
      provisionStorachaSpace({
        email: 'abort@example.com',
        coopName: 'abort-coop',
        signal: AbortSignal.abort(),
      }),
    ).rejects.toThrow('The operation was aborted.');
  });

  it('propagates space creation failure', async () => {
    storachaMocks.createSpace.mockRejectedValueOnce(new Error('Space limit reached'));

    await expect(
      provisionStorachaSpace({
        email: 'full@example.com',
        coopName: 'full-coop',
      }),
    ).rejects.toThrow('Space limit reached');
  });
});

describe('extractClientCredentials', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns public config with space DID and agent DID', async () => {
    const mockClient = {
      did: vi.fn(() => 'did:key:z6MkAgent789' as `did:key:${string}`),
      _agent: {
        issuer: {
          encode: vi.fn(() => new Uint8Array([11, 22, 33])),
        },
      },
    };

    const mockSpace = {
      did: vi.fn(() => 'did:key:z6MkSpaceABC' as `did:key:${string}`),
      signer: {
        encode: vi.fn(() => new Uint8Array([44, 55, 66])),
      },
      createAuthorization: vi.fn(async () => ({
        archive: async () => ({
          ok: new Uint8Array([77, 88, 99]),
        }),
      })),
    };

    const result = await extractClientCredentials(
      mockClient as never,
      mockSpace as never,
      'my-coop',
    );

    expect(result.publicConfig.spaceDid).toBe('did:key:z6MkSpaceABC');
    expect(result.publicConfig.delegationIssuer).toBe('did:key:z6MkAgent789');
    expect(result.publicConfig.gatewayBaseUrl).toBe('https://storacha.link');
    expect(result.publicConfig.allowsFilecoinInfo).toBe(true);
    expect(result.publicConfig.expirationSeconds).toBe(600);
  });

  it('returns secrets with agent private key and space delegation', async () => {
    const mockClient = {
      did: vi.fn(() => 'did:key:z6MkAgent789' as `did:key:${string}`),
      _agent: {
        issuer: {
          encode: vi.fn(() => new Uint8Array([11, 22, 33])),
        },
      },
    };

    const mockSpace = {
      did: vi.fn(() => 'did:key:z6MkSpaceABC' as `did:key:${string}`),
      signer: {
        encode: vi.fn(() => new Uint8Array([44, 55, 66])),
      },
      createAuthorization: vi.fn(async () => ({
        archive: async () => ({
          ok: new Uint8Array([77, 88, 99]),
        }),
      })),
    };

    const result = await extractClientCredentials(
      mockClient as never,
      mockSpace as never,
      'my-coop',
    );

    // Agent private key should be base64-encoded
    expect(result.secrets.agentPrivateKey).toBeDefined();
    expect(typeof result.secrets.agentPrivateKey).toBe('string');

    // Space delegation should be base64-encoded
    expect(result.secrets.spaceDelegation).toBeDefined();
    expect(typeof result.secrets.spaceDelegation).toBe('string');
    expect(result.secrets.spaceDelegation.length).toBeGreaterThan(0);
  });
});
