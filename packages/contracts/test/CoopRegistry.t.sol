// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "forge-std/Test.sol";
import "../src/CoopRegistry.sol";

contract CoopRegistryTest is Test {
    CoopRegistry registry;
    address coop1 = address(0xC001);

    function setUp() public {
        registry = new CoopRegistry();
    }

    // --- Archive Tests ---

    function test_registerArchive_artifact() public {
        vm.prank(coop1);
        registry.registerArchive("bafy...root", "baga...piece", 0, "coop-abc");

        CoopRegistry.ArchiveEntry[] memory entries = registry.getArchives(coop1);
        assertEq(entries.length, 1);
        assertEq(entries[0].rootCid, "bafy...root");
        assertEq(entries[0].pieceCid, "baga...piece");
        assertEq(entries[0].scope, 0);
        assertEq(entries[0].coopId, "coop-abc");
        assertEq(entries[0].timestamp, uint48(block.timestamp));
    }

    function test_registerArchive_snapshot() public {
        vm.prank(coop1);
        registry.registerArchive("bafy...snap", "", 1, "coop-xyz");

        assertEq(registry.getArchiveCount(coop1), 1);
        CoopRegistry.ArchiveEntry[] memory entries = registry.getArchives(coop1);
        assertEq(entries[0].scope, 1);
    }

    function test_registerArchive_emitsEvent() public {
        vm.prank(coop1);
        vm.expectEmit(true, true, false, true);
        emit CoopRegistry.ArchiveRegistered(
            coop1, 0, "bafy...root", "baga...piece", 0, "coop-abc", uint48(block.timestamp)
        );
        registry.registerArchive("bafy...root", "baga...piece", 0, "coop-abc");
    }

    function test_registerArchive_invalidScope_reverts() public {
        vm.prank(coop1);
        vm.expectRevert("Invalid scope");
        registry.registerArchive("bafy...root", "", 2, "coop-abc");
    }

    function test_registerArchive_emptyRootCid_reverts() public {
        vm.prank(coop1);
        vm.expectRevert("rootCid required");
        registry.registerArchive("", "", 0, "coop-abc");
    }

    function test_registerArchive_multipleEntries() public {
        vm.startPrank(coop1);
        registry.registerArchive("bafy...1", "piece1", 0, "coop-abc");
        registry.registerArchive("bafy...2", "piece2", 1, "coop-abc");
        vm.stopPrank();

        assertEq(registry.getArchiveCount(coop1), 2);
    }

    function test_getArchives_emptyAddress() public view {
        CoopRegistry.ArchiveEntry[] memory entries = registry.getArchives(address(0xDEAD));
        assertEq(entries.length, 0);
    }

    // --- Membership Tests ---

    function test_registerMembership() public {
        vm.prank(coop1);
        registry.registerMembership("coop-abc", "commitment123");

        string[] memory commitments = registry.getMemberCommitments(coop1);
        assertEq(commitments.length, 1);
        assertEq(commitments[0], "commitment123");
    }

    function test_registerMembership_emitsEvent() public {
        vm.prank(coop1);
        vm.expectEmit(true, false, false, true);
        emit CoopRegistry.MembershipRegistered(
            coop1, "coop-abc", "commitment123", uint48(block.timestamp)
        );
        registry.registerMembership("coop-abc", "commitment123");
    }

    function test_registerMembership_emptyCommitment_reverts() public {
        vm.prank(coop1);
        vm.expectRevert("commitment required");
        registry.registerMembership("coop-abc", "");
    }

    function test_registerMemberships_batch() public {
        string[] memory commitments = new string[](3);
        commitments[0] = "comm1";
        commitments[1] = "comm2";
        commitments[2] = "comm3";

        vm.prank(coop1);
        registry.registerMemberships("coop-abc", commitments);

        assertEq(registry.getMemberCommitmentCount(coop1), 3);
        string[] memory stored = registry.getMemberCommitments(coop1);
        assertEq(stored[0], "comm1");
        assertEq(stored[1], "comm2");
        assertEq(stored[2], "comm3");
    }

    function test_registerMemberships_emitsEvent() public {
        string[] memory commitments = new string[](2);
        commitments[0] = "comm1";
        commitments[1] = "comm2";

        vm.prank(coop1);
        vm.expectEmit(true, false, false, true);
        emit CoopRegistry.MembershipBatchRegistered(
            coop1, "coop-abc", 2, uint48(block.timestamp)
        );
        registry.registerMemberships("coop-abc", commitments);
    }

    function test_registerMemberships_emptyBatch_reverts() public {
        string[] memory commitments = new string[](0);

        vm.prank(coop1);
        vm.expectRevert("empty batch");
        registry.registerMemberships("coop-abc", commitments);
    }

    function test_registerMemberships_emptyCommitmentInBatch_reverts() public {
        string[] memory commitments = new string[](2);
        commitments[0] = "comm1";
        commitments[1] = "";

        vm.prank(coop1);
        vm.expectRevert("empty commitment");
        registry.registerMemberships("coop-abc", commitments);
    }

    function test_getMemberCommitments_emptyAddress() public view {
        string[] memory commitments = registry.getMemberCommitments(address(0xDEAD));
        assertEq(commitments.length, 0);
    }

    // --- Constants ---

    function test_constants() public view {
        assertEq(registry.ENTRY_ARCHIVE_ARTIFACT(), 0);
        assertEq(registry.ENTRY_ARCHIVE_SNAPSHOT(), 1);
        assertEq(registry.ENTRY_MEMBERSHIP(), 2);
        assertEq(registry.ENTRY_GOVERNANCE(), 3);
    }
}
