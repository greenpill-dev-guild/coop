// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

/// @title CoopRegistry
/// @notice DataDAO registry for Coop on Filecoin FVM.
///         Archives + Semaphore membership commitments.
contract CoopRegistry {
    uint8 public constant ENTRY_ARCHIVE_ARTIFACT = 0;
    uint8 public constant ENTRY_ARCHIVE_SNAPSHOT = 1;
    uint8 public constant ENTRY_MEMBERSHIP       = 2;
    uint8 public constant ENTRY_GOVERNANCE        = 3; // reserved

    // --- Archives ---
    struct ArchiveEntry {
        string rootCid;
        string pieceCid;
        uint8  scope;       // 0=artifact, 1=snapshot
        string coopId;
        uint48 timestamp;
    }

    mapping(address => ArchiveEntry[]) public archives;

    event ArchiveRegistered(
        address indexed coop, uint256 indexed idx,
        string rootCid, string pieceCid, uint8 scope,
        string coopId, uint48 timestamp
    );

    function registerArchive(
        string calldata rootCid, string calldata pieceCid,
        uint8 scope, string calldata coopId
    ) external {
        require(scope <= 1, "Invalid scope");
        require(bytes(rootCid).length > 0, "rootCid required");
        uint256 idx = archives[msg.sender].length;
        archives[msg.sender].push(ArchiveEntry(
            rootCid, pieceCid, scope, coopId, uint48(block.timestamp)
        ));
        emit ArchiveRegistered(msg.sender, idx, rootCid, pieceCid,
            scope, coopId, uint48(block.timestamp));
    }

    function getArchives(address coop) external view returns (ArchiveEntry[] memory) {
        return archives[coop];
    }
    function getArchiveCount(address coop) external view returns (uint256) {
        return archives[coop].length;
    }

    // --- Membership (Semaphore commitments) ---
    mapping(address => string[]) public memberCommitments;

    event MembershipRegistered(
        address indexed coop, string coopId,
        string commitment, uint48 timestamp
    );
    event MembershipBatchRegistered(
        address indexed coop, string coopId,
        uint256 count, uint48 timestamp
    );

    function registerMembership(
        string calldata coopId, string calldata commitment
    ) external {
        require(bytes(commitment).length > 0, "commitment required");
        memberCommitments[msg.sender].push(commitment);
        emit MembershipRegistered(msg.sender, coopId,
            commitment, uint48(block.timestamp));
    }

    function registerMemberships(
        string calldata coopId, string[] calldata commitments
    ) external {
        require(commitments.length > 0, "empty batch");
        for (uint256 i = 0; i < commitments.length; i++) {
            require(bytes(commitments[i]).length > 0, "empty commitment");
            memberCommitments[msg.sender].push(commitments[i]);
        }
        emit MembershipBatchRegistered(msg.sender, coopId,
            commitments.length, uint48(block.timestamp));
    }

    function getMemberCommitments(address coop) external view returns (string[] memory) {
        return memberCommitments[coop];
    }
    function getMemberCommitmentCount(address coop) external view returns (uint256) {
        return memberCommitments[coop].length;
    }
}
