// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import "forge-std/Test.sol";
import "../src/Panel.sol";

contract PanelHandler is Test {
    Panel public panel;

    address[] public actors;
    uint256 public ghost_totalFunded;
    uint256 public ghost_totalWithdrawn;

    constructor(Panel _panel) {
        panel = _panel;
        actors = new address[](4);
        actors[0] = address(0xAA11);
        actors[1] = address(0xBB22);
        actors[2] = address(0xCC33);
        actors[3] = address(0xDD44);

        for (uint256 i = 0; i < actors.length; i++) {
            deal(actors[i], 1_000 ether);
        }
    }

    function createSurvey(
        uint8 actorIdx,
        uint8 optCountSeed,
        uint64 rewardSeed,
        uint8 maxRespSeed,
        uint32 durationSeed
    ) external {
        address asker = actors[actorIdx % actors.length];
        uint8 optCount = uint8(bound(optCountSeed, 2, 6));
        uint128 reward = uint128(bound(rewardSeed, 1, 0.05 ether));
        uint32 maxResp = uint32(bound(maxRespSeed, 1, 10));
        uint64 duration = uint64(bound(durationSeed, 1 hours, 7 days));

        string[] memory opts = new string[](optCount);
        for (uint256 i = 0; i < optCount; i++) {
            opts[i] = "choice";
        }

        uint256 cost = uint256(reward) * uint256(maxResp);
        vm.prank(asker);
        try panel.create{value: cost}("Question?", opts, reward, maxResp, duration) returns (uint256) {
            ghost_totalFunded += cost;
        } catch {}
    }

    function respondSurvey(
        uint256 surveyIdSeed,
        uint8 actorIdx,
        uint8 optionSeed
    ) external {
        uint256 total = panel.surveyCount();
        if (total == 0) return;

        uint256 id = bound(surveyIdSeed, 1, total);
        address responder = actors[actorIdx % actors.length];

        Panel.Survey memory s = panel.surveyOf(id);
        if (s.optionCount == 0) return;
        uint8 opt = uint8(optionSeed % s.optionCount);

        vm.prank(responder);
        try panel.respond(id, opt) {} catch {}
    }

    function reclaimSurvey(uint256 surveyIdSeed, bool warpPastClose) external {
        uint256 total = panel.surveyCount();
        if (total == 0) return;

        uint256 id = bound(surveyIdSeed, 1, total);
        Panel.Survey memory s = panel.surveyOf(id);

        if (warpPastClose && block.timestamp < s.closesAt) {
            vm.warp(s.closesAt + 1);
        }

        vm.prank(s.asker);
        try panel.reclaim(id) {} catch {}
    }

    function withdrawActor(uint8 actorIdx) external {
        address who = actors[actorIdx % actors.length];
        uint256 p = panel.pending(who);
        if (p == 0) return;

        vm.prank(who);
        try panel.withdraw() {
            ghost_totalWithdrawn += p;
        } catch {}
    }
}

contract PanelInvariantTest is Test {
    Panel public panel;
    PanelHandler public handler;

    function setUp() public {
        panel = new Panel();
        handler = new PanelHandler(panel);

        bytes4[] memory selectors = new bytes4[](4);
        selectors[0] = handler.createSurvey.selector;
        selectors[1] = handler.respondSurvey.selector;
        selectors[2] = handler.reclaimSurvey.selector;
        selectors[3] = handler.withdrawActor.selector;

        targetSelector(FuzzSelector({addr: address(handler), selectors: selectors}));
        targetContract(address(handler));
    }

    function invariant_SolvencyAndConservation() public view {
        assertEq(
            address(panel).balance,
            handler.ghost_totalFunded() - handler.ghost_totalWithdrawn(),
            "Contract balance must equal total funded minus total withdrawn"
        );

        // Sum of pending across all actors cannot exceed contract balance
        uint256 sumPending = 0;
        for (uint256 i = 0; i < 4; i++) {
            sumPending += panel.pending(handler.actors(i));
        }
        assertTrue(address(panel).balance >= sumPending, "Balance must cover all pending balances");
    }

    function invariant_TallyIntegrity() public view {
        uint256 total = panel.surveyCount();
        if (total == 0) return;

        // Check survey 1 and newest survey
        _checkSurveyTally(1);
        if (total > 1) {
            _checkSurveyTally(total);
        }
    }

    function _checkSurveyTally(uint256 id) internal view {
        Panel.Survey memory s = panel.surveyOf(id);
        assertTrue(s.responses <= s.maxResponses, "Responses must never exceed maxResponses");

        uint32[] memory tallies = panel.tallyOf(id);
        uint32 sum = 0;
        for (uint256 i = 0; i < tallies.length; i++) {
            sum += tallies[i];
        }
        assertEq(sum, s.responses, "Sum of tallies must equal responses count");
    }
}
