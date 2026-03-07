# Plan 05 - Smart Contracts

## Scope

Complete `packages/contracts` for Coop registry lifecycle, deployability, and smart-account-ready integration.

## Current State

- `CoopRegistry.sol` scaffold exists.
- Pimlico integration file is a stub.
- No test/deploy pipeline is complete.

## Todos

1. Extend registry contract with member removal and metadata update paths.
2. Add stable view interfaces and access control boundaries.
3. Replace Pimlico stub with real ERC-4337 integration helpers.
4. Add deploy script and deployment artifact output.
5. Add Foundry tests covering core lifecycle and edge cases.
6. Export ABI artifacts for backend/client usage.

## Dependencies

- `02-anchor-node.md` for on-chain API usage assumptions.
- `07-skills-system.md` where on-chain actions are triggered.

## Key Files

- `packages/contracts/src/CoopRegistry.sol`
- `packages/contracts/src/pimlico.ts`
- `packages/contracts/foundry.toml`
- `packages/contracts/script/*` (new)
- `packages/contracts/test/*` (new)
- `packages/contracts/src/interfaces/*` (new)

## Dependencies to Install

- `permissionless`
- `viem`

## Done Criteria

- `forge test` passes with meaningful coverage.
- Registry deployment can be executed and ABI exported.
- Smart account helper returns valid account/session constructs.
