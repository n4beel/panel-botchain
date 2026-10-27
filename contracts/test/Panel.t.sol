// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import "forge-std/Test.sol";
import "../src/Panel.sol";

contract MaliciousRecipient {
    Panel public panel;
    bool public attacked;

    constructor(Panel _panel) {
        panel = _panel;
    }

    function attack() external payable {
        string[] memory opts = new string[](2);
        opts[0] = "Yes";
        opts[1] = "No";
        uint256 id = panel.create{value: 1 ether}(
            "Attack test?",
            opts,
            1 ether,
            1,
            1 hours
        );
        // address(this) cannot respond since it's asker, so just test withdraw reentrancy if pending > 0
    }

    receive() external payable {
        if (!attacked) {
            attacked = true;
            panel.withdraw();
        }
    }
}

contract ReentrantRespondent {
    Panel public panel;
    bool public reentrancyReverted;

    constructor(Panel _panel) {
        panel = _panel;
    }

    function answer(uint256 id, uint8 opt) external {
        panel.respond(id, opt);
    }

    function doWithdraw() external {
        panel.withdraw();
    }

    receive() external payable {
        try panel.withdraw() {
        } catch (bytes memory reason) {
            if (bytes4(reason) == Panel.ReentrantCall.selector) {
                reentrancyReverted = true;
            }
        }
    }
}

contract PanelTest is Test {
    Panel public panel;

    address public alice = address(0x1111);
    address public bob = address(0x2222);
    address public charlie = address(0x3333);
    address public dave = address(0x4444);

    string[] internal standardOptions;

    function setUp() public {
        panel = new Panel();
        vm.deal(alice, 100 ether);
        vm.deal(bob, 100 ether);
        vm.deal(charlie, 100 ether);
        vm.deal(dave, 100 ether);

        standardOptions = new string[](3);
        standardOptions[0] = "Option A";
        standardOptions[1] = "Option B";
        standardOptions[2] = "Option C";
    }

    function test_CreateRequiresExactFunding() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Panel.WrongFunding.selector, 1.5 ether));
        panel.create{value: 1 ether}("Which color?", standardOptions, 0.5 ether, 3, 1 days);

        vm.prank(alice);
        uint256 id = panel.create{value: 1.5 ether}("Which color?", standardOptions, 0.5 ether, 3, 1 days);
        assertEq(id, 1);
        assertEq(panel.surveyCount(), 1);

        Panel.Survey memory s = panel.surveyOf(1);
        assertEq(s.asker, alice);
        assertEq(s.reward, 0.5 ether);
        assertEq(s.maxResponses, 3);
        assertEq(s.responses, 0);
        assertEq(s.optionCount, 3);
        assertEq(s.question, "Which color?");
        assertEq(panel.optionsOf(1).length, 3);
    }

    function test_RespondPaysOnce() public {
        vm.prank(alice);
        uint256 id = panel.create{value: 0.3 ether}("Which fruit?", standardOptions, 0.1 ether, 3, 1 days);

        assertEq(panel.pending(bob), 0);
        vm.prank(bob);
        panel.respond(id, 1); // Option B

        assertEq(panel.pending(bob), 0.1 ether);
        uint32[] memory tallies = panel.tallyOf(id);
        assertEq(tallies[0], 0);
        assertEq(tallies[1], 1);
        assertEq(tallies[2], 0);

        (bool answered, uint8 opt) = panel.choiceOf(id, bob);
        assertTrue(answered);
        assertEq(opt, 1);

        // Bob withdraws
        uint256 bobBalBefore = bob.balance;
        vm.prank(bob);
        panel.withdraw();
        assertEq(bob.balance, bobBalBefore + 0.1 ether);
        assertEq(panel.pending(bob), 0);
    }

    function test_SecondResponseReverts() public {
        vm.prank(alice);
        uint256 id = panel.create{value: 0.2 ether}("Pick one", standardOptions, 0.1 ether, 2, 1 days);

        vm.prank(bob);
        panel.respond(id, 0);

        vm.prank(bob);
        vm.expectRevert(Panel.AlreadyResponded.selector);
        panel.respond(id, 1);
    }

    function test_FullSurveyRejects() public {
        vm.prank(alice);
        uint256 id = panel.create{value: 0.2 ether}("Pick one", standardOptions, 0.1 ether, 2, 1 days);

        vm.prank(bob);
        panel.respond(id, 0);
        vm.prank(charlie);
        panel.respond(id, 1);

        vm.prank(dave);
        vm.expectRevert(Panel.Full.selector);
        panel.respond(id, 2);
    }

    function test_ClosedSurveyRejects() public {
        vm.prank(alice);
        uint256 id = panel.create{value: 0.5 ether}("Time test", standardOptions, 0.1 ether, 5, 2 hours);

        vm.warp(block.timestamp + 2 hours + 1);

        vm.prank(bob);
        vm.expectRevert(Panel.Closed.selector);
        panel.respond(id, 0);
    }

    function test_BadOptionReverts() public {
        vm.prank(alice);
        uint256 id = panel.create{value: 0.5 ether}("Option test", standardOptions, 0.1 ether, 5, 2 hours);

        vm.prank(bob);
        vm.expectRevert(Panel.BadOption.selector);
        panel.respond(id, 3); // out of bounds (only 0, 1, 2)
    }

    function test_AskerCannotRespond() public {
        vm.prank(alice);
        uint256 id = panel.create{value: 0.5 ether}("Self test", standardOptions, 0.1 ether, 5, 2 hours);

        vm.prank(alice);
        vm.expectRevert(Panel.AskerCannotRespond.selector);
        panel.respond(id, 0);
    }

    function test_ReclaimOnlyAfterCloseOrFull() public {
        vm.prank(alice);
        uint256 id = panel.create{value: 0.3 ether}("Reclaim check", standardOptions, 0.1 ether, 3, 2 hours);

        // Neither full nor closed -> reverts
        vm.prank(alice);
        vm.expectRevert(Panel.NotClosedOrFull.selector);
        panel.reclaim(id);

        // Bob responds (1/3)
        vm.prank(bob);
        panel.respond(id, 0);

        // Still neither full nor closed
        vm.prank(alice);
        vm.expectRevert(Panel.NotClosedOrFull.selector);
        panel.reclaim(id);

        // Warp past closesAt
        vm.warp(block.timestamp + 2 hours + 1);

        // Now reclaim succeeds
        vm.prank(alice);
        panel.reclaim(id);

        // Alice pending has unspent 0.2 ether
        assertEq(panel.pending(alice), 0.2 ether);
        Panel.Survey memory s = panel.surveyOf(id);
        assertTrue(s.reclaimed);
    }

    function test_ReclaimWhenFullBeforeClose() public {
        vm.prank(alice);
        uint256 id = panel.create{value: 0.2 ether}("Full reclaim", standardOptions, 0.1 ether, 2, 2 hours);

        vm.prank(bob);
        panel.respond(id, 0);
        vm.prank(charlie);
        panel.respond(id, 1);

        // Full before time closes: unspent is 0
        vm.prank(alice);
        panel.reclaim(id);
        assertEq(panel.pending(alice), 0);
        assertTrue(panel.surveyOf(id).reclaimed);
    }

    function test_ReclaimExactRemainder() public {
        vm.prank(alice);
        uint256 id = panel.create{value: 1 ether}("Remainder check", standardOptions, 0.2 ether, 5, 2 hours);

        // 2 responses = 0.4 ether spent, 0.6 ether unspent
        vm.prank(bob);
        panel.respond(id, 0);
        vm.prank(charlie);
        panel.respond(id, 1);

        vm.warp(block.timestamp + 3 hours);

        vm.prank(alice);
        panel.reclaim(id);

        assertEq(panel.pending(alice), 0.6 ether);
        assertEq(panel.pending(bob), 0.2 ether);
        assertEq(panel.pending(charlie), 0.2 ether);
        assertEq(address(panel).balance, 1 ether);

        // Alice withdraws
        uint256 aliceBefore = alice.balance;
        vm.prank(alice);
        panel.withdraw();
        assertEq(alice.balance, aliceBefore + 0.6 ether);
        assertEq(panel.pending(alice), 0);
    }

    function test_ReclaimOnce() public {
        vm.prank(alice);
        uint256 id = panel.create{value: 0.2 ether}("Reclaim once", standardOptions, 0.1 ether, 2, 2 hours);

        vm.warp(block.timestamp + 3 hours);

        vm.prank(alice);
        panel.reclaim(id);

        vm.prank(alice);
        vm.expectRevert(Panel.AlreadyReclaimed.selector);
        panel.reclaim(id);
    }

    function test_OptionBounds() public {
        // 1 option -> reverts
        string[] memory oneOpt = new string[](1);
        oneOpt[0] = "One";
        vm.prank(alice);
        vm.expectRevert(Panel.BadOptions.selector);
        panel.create{value: 0.1 ether}("Q?", oneOpt, 0.1 ether, 1, 1 days);

        // 2 options -> succeeds
        string[] memory twoOpts = new string[](2);
        twoOpts[0] = "One";
        twoOpts[1] = "Two";
        vm.prank(alice);
        uint256 id2 = panel.create{value: 0.1 ether}("Q?", twoOpts, 0.1 ether, 1, 1 days);
        assertEq(id2, 1);

        // 6 options -> succeeds
        string[] memory sixOpts = new string[](6);
        for (uint256 i = 0; i < 6; i++) {
            sixOpts[i] = string(abi.encodePacked("Opt ", vm.toString(i)));
        }
        vm.prank(alice);
        uint256 id6 = panel.create{value: 0.1 ether}("Q?", sixOpts, 0.1 ether, 1, 1 days);
        assertEq(id6, 2);

        // 7 options -> reverts
        string[] memory sevenOpts = new string[](7);
        for (uint256 i = 0; i < 7; i++) {
            sevenOpts[i] = string(abi.encodePacked("Opt ", vm.toString(i)));
        }
        vm.prank(alice);
        vm.expectRevert(Panel.BadOptions.selector);
        panel.create{value: 0.1 ether}("Q?", sevenOpts, 0.1 ether, 1, 1 days);
    }

    function test_ReentrantWithdrawBlocked() public {
        ReentrantRespondent attacker = new ReentrantRespondent(panel);

        vm.prank(alice);
        uint256 id = panel.create{value: 0.5 ether}("Reentrancy?", standardOptions, 0.5 ether, 1, 1 days);

        attacker.answer(id, 0);
        assertEq(panel.pending(address(attacker)), 0.5 ether);

        // Withdrawal attempts reentrant call inside receive(), catching ReentrantCall
        attacker.doWithdraw();
        assertTrue(attacker.reentrancyReverted());
    }

    function test_OddFundingArithmetic() public {
        // reward = 1 wei, maxResponses = 1000
        vm.prank(alice);
        uint256 id = panel.create{value: 1000}("Odd funding", standardOptions, 1, 1000, 1 days);
        assertEq(id, 1);
        Panel.Survey memory s = panel.surveyOf(1);
        assertEq(s.reward, 1);
        assertEq(s.maxResponses, 1000);
    }

    function test_InputValidations() public {
        // Bad question: empty
        vm.prank(alice);
        vm.expectRevert(Panel.BadQuestion.selector);
        panel.create{value: 0.1 ether}("", standardOptions, 0.1 ether, 1, 1 days);

        // Bad question: > 120 bytes
        string memory longQ = "1234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901";
        vm.prank(alice);
        vm.expectRevert(Panel.BadQuestion.selector);
        panel.create{value: 0.1 ether}(longQ, standardOptions, 0.1 ether, 1, 1 days);

        // Exact 120 bytes question succeeds
        string memory exact120 = "123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890";
        vm.prank(alice);
        uint256 idExact = panel.create{value: 0.1 ether}(exact120, standardOptions, 0.1 ether, 1, 1 days);
        assertEq(idExact, 1);

        // Bad option len: empty
        string[] memory badOpts = new string[](2);
        badOpts[0] = "";
        badOpts[1] = "Valid";
        vm.prank(alice);
        vm.expectRevert(Panel.BadOptions.selector);
        panel.create{value: 0.1 ether}("Q?", badOpts, 0.1 ether, 1, 1 days);

        // Bad option len: > 32 bytes
        badOpts[0] = "123456789012345678901234567890123";
        vm.prank(alice);
        vm.expectRevert(Panel.BadOptions.selector);
        panel.create{value: 0.1 ether}("Q?", badOpts, 0.1 ether, 1, 1 days);

        // Bad reward: 0
        vm.prank(alice);
        vm.expectRevert(Panel.BadReward.selector);
        panel.create{value: 0}("Q?", standardOptions, 0, 1, 1 days);

        // Bad maxResponses: 0
        vm.prank(alice);
        vm.expectRevert(Panel.BadResponses.selector);
        panel.create{value: 0}("Q?", standardOptions, 1 ether, 0, 1 days);

        // Bad maxResponses: 1001
        vm.prank(alice);
        vm.expectRevert(Panel.BadResponses.selector);
        panel.create{value: 1001}("Q?", standardOptions, 1, 1001, 1 days);

        // Bad duration: < 1 hour
        vm.prank(alice);
        vm.expectRevert(Panel.BadDuration.selector);
        panel.create{value: 1 ether}("Q?", standardOptions, 1 ether, 1, 59 minutes);

        // Bad duration: > 90 days
        vm.prank(alice);
        vm.expectRevert(Panel.BadDuration.selector);
        panel.create{value: 1 ether}("Q?", standardOptions, 1 ether, 1, 90 days + 1);
    }

    function test_AccessControlAndErrors() public {
        vm.prank(alice);
        uint256 id = panel.create{value: 0.2 ether}("Auth check", standardOptions, 0.1 ether, 2, 1 days);

        // Not asker tries to reclaim
        vm.warp(block.timestamp + 2 days);
        vm.prank(bob);
        vm.expectRevert(Panel.NotAsker.selector);
        panel.reclaim(id);

        // NoSuchSurvey
        vm.expectRevert(Panel.NoSuchSurvey.selector);
        panel.surveyOf(99);

        vm.expectRevert(Panel.NoSuchSurvey.selector);
        panel.optionsOf(99);

        vm.expectRevert(Panel.NoSuchSurvey.selector);
        panel.tallyOf(99);

        vm.expectRevert(Panel.NoSuchSurvey.selector);
        panel.choiceOf(99, bob);

        // Nothing to withdraw
        vm.prank(bob);
        vm.expectRevert(Panel.NothingToWithdraw.selector);
        panel.withdraw();
    }

    function test_LatestPagination() public {
        for (uint256 i = 1; i <= 5; i++) {
            vm.prank(alice);
            panel.create{value: 0.1 ether}(
                string(abi.encodePacked("Question ", vm.toString(i))),
                standardOptions,
                0.1 ether,
                1,
                1 days
            );
        }

        (Panel.Survey[] memory surveys, uint256[] memory ids) = panel.latest(0, 3);
        assertEq(surveys.length, 3);
        assertEq(ids.length, 3);
        assertEq(ids[0], 5);
        assertEq(ids[1], 4);
        assertEq(ids[2], 3);

        (surveys, ids) = panel.latest(3, 10);
        assertEq(surveys.length, 2);
        assertEq(ids.length, 2);
        assertEq(ids[0], 2);
        assertEq(ids[1], 1);

        (surveys, ids) = panel.latest(5, 5);
        assertEq(surveys.length, 0);
        assertEq(ids.length, 0);
    }

    // --- Fuzz Tests ---

    function testFuzz_Conservation(uint128 reward, uint8 maxResp, uint8 ansCount) public {
        vm.assume(reward > 0 && reward <= 1 ether);
        vm.assume(maxResp >= 1 && maxResp <= 20);
        vm.assume(ansCount <= maxResp);

        uint256 funding = uint256(reward) * uint256(maxResp);
        vm.deal(alice, funding);

        vm.prank(alice);
        uint256 id = panel.create{value: funding}("Fuzz Q", standardOptions, reward, maxResp, 1 days);

        for (uint256 i = 0; i < ansCount; i++) {
            address responder = address(uint160(0x5000 + i));
            vm.prank(responder);
            panel.respond(id, uint8(i % 3));
        }

        // Warp and reclaim remainder
        vm.warp(block.timestamp + 2 days);
        vm.prank(alice);
        panel.reclaim(id);

        uint256 totalPending = panel.pending(alice);
        for (uint256 i = 0; i < ansCount; i++) {
            address responder = address(uint160(0x5000 + i));
            totalPending += panel.pending(responder);
        }

        assertEq(totalPending, funding);
        assertEq(address(panel).balance, funding);
    }

    function testFuzz_TallySumsToResponses(uint8 numResponders) public {
        vm.assume(numResponders >= 1 && numResponders <= 30);

        uint256 funding = uint256(0.01 ether) * uint256(numResponders);
        vm.deal(alice, funding);

        vm.prank(alice);
        uint256 id = panel.create{value: funding}("Tally Fuzz", standardOptions, 0.01 ether, numResponders, 1 days);

        for (uint256 i = 0; i < numResponders; i++) {
            address responder = address(uint160(0x6000 + i));
            vm.prank(responder);
            panel.respond(id, uint8(i % 3));
        }

        uint32[] memory tallies = panel.tallyOf(id);
        uint32 sum = tallies[0] + tallies[1] + tallies[2];
        Panel.Survey memory s = panel.surveyOf(id);

        assertEq(sum, s.responses);
        assertEq(sum, numResponders);
    }
}
