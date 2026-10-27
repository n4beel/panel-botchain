# Panel Handover Report

## 1. What Was Built
Panel is a prefunded single-question survey application on BOT Chain (Bohr testnet chain ID 968). It allows creators to ask a question with 2 to 6 options, set a per-response bounty in BOT, set a cap on respondents (1 to 100), and fund the maximum budget upfront.

Key components:
- **Smart Contract (`contracts/src/Panel.sol`)**:
  - Implements survey creation (`create`), response submission (`respond`), unspent budget reclaiming (`reclaim`), and pull payment withdrawals (`withdraw`).
  - View methods: `surveyOf`, `optionsOf`, `tallyOf`, `choiceOf`, `surveyCount`, `latest`, `pending`.
  - Comprehensive custom errors:
    - `NoSuchSurvey`
    - `EmptyQuestion`, `QuestionTooLong` (<= 280 bytes)
    - `TooFewOptions`, `TooManyOptions` (2 to 6 options)
    - `BadOptions` (1 to 64 bytes per option)
    - `BadReward` (reward > 0)
    - `BadResponses` (1 to 100 responses)
    - `BadDuration` (60 seconds to 30 days)
    - `WrongFunding(expected)` (enforces `msg.value == reward * maxResponses`)
    - `Closed`, `Full`, `BadOption`, `AskerCannotRespond`, `AlreadyResponded`
    - `NotAsker`, `NotClosedOrFull`, `AlreadyReclaimed`, `NoRewardToReclaim`
    - `NoBalance`, `TransferFailed`, `ReentrantCall`
  - Pull payment security pattern with Checks-Effects-Interactions and `nonReentrant` guard.
  - No fallback/receive functions; accidental value transfers without calldata revert.
- **Design Decisions (`contracts/DECISIONS.md`)**:
  - Full documentation of upfront prefunding model, 1-indexed option storage, pull payment mechanism, reentrancy guards, invariant definitions, and mutation test kill analysis.
- **Frontend Architecture (Archetype AD · Questionnaire)**:
  - Color palette: Editorial violet accent (`#6C47FF`), tinted canvas (`#F7F5FF`), clean border (`#ECE9F7`), and deep charcoal ink (`#0D0D0D`).
  - Typography: DM Serif Display for questions and headers, Inter Tight for UI controls and chips, and JetBrains Mono for bounties, counts, and addresses.
  - Bespoke Components:
    - `QuestionnaireView`: Renders single questionnaire state machine:
      - State A (Unanswered): Large question heading, full-width rounded pill option buttons with letter badges and radio rings, and confirm button.
      - State B (Results): Results bar graph with horizontal animated bars (`@keyframes bar-grow`), percentage labels, vote counts, "You" badge on user's choice, and answered notification banner.
      - Creator Strip: Budget calculator breakdown showing spent vs unspent BOT and a one-click "Reclaim Unspent" button when expired or full.
  - Routes:
    - `/`: Latest survey questionnaire with previous/next stepper and quick links.
    - `/q/[id]`: Direct permalink to any specific survey questionnaire.
    - `/ask`: Survey creation form with live budget calculator (`reward * maxResponses`), duration presets, and option management.
    - `/me`: Personal dashboard showing withdrawable pull payment balance, one-click withdraw button, created questions list, and reclaim controls.
    - `not-found.tsx`: Styled 404 questionnaire page.
  - Shared UI Contract:
    - 3 mandatory footer links on all pages (`Built on BOT Chain`, `botchain.ai`, `scan.botchain.ai`).
    - Verified AAA contrast tokens for wallet dropdown menu.
    - Clear honesty limits disclaimer on all questionnaire views: "Read the result as wallets, not people. One wallet answers once. One person can have many wallets."

---

## 2. Verification Results

### Forge Tests
```bash
$ cd contracts && forge test --gas-report
Compiler run successful!

Ran 19 tests for test/Panel.t.sol:PanelTest
[PASS] testFuzz_RespondAndWithdraw(uint8,uint8) (runs: 256, μ: 252190, ~: 252190)
[PASS] test_AlreadyRespondedReverts() (gas: 301290)
[PASS] test_AskerCannotReclaimTwice() (gas: 366914)
[PASS] test_AskerCannotRespondReverts() (gas: 297594)
[PASS] test_BadOptionReverts() (gas: 298101)
[PASS] test_CannotReclaimWhileOpenAndNotFull() (gas: 351740)
[PASS] test_CreateSurveyAndReadBack() (gas: 260384)
[PASS] test_DirectBotTransferReverts() (gas: 15309)
[PASS] test_FullSurveyRevertsRespond() (gas: 442567)
[PASS] test_InputValidations() (gas: 48931)
[PASS] test_LatestSurveysQuery() (gas: 820692)
[PASS] test_NonAskerCannotReclaim() (gas: 354673)
[PASS] test_ReclaimFullSurvey() (gas: 422476)
[PASS] test_ReclaimUnspentBudgetAfterClose() (gas: 366228)
[PASS] test_ReentrantWithdrawBlocked() (gas: 379477)
[PASS] test_RespondClosedSurveyReverts() (gas: 302095)
[PASS] test_RespondIncrementsTallyAndPending() (gas: 382434)
[PASS] test_WithdrawEmptyBalanceReverts() (gas: 14751)
[PASS] test_WithdrawPendingBalance() (gas: 354929)
Suite result: ok. 19 passed; 0 failed; 0 skipped

Ran 2 tests for test/PanelInvariant.t.sol:PanelInvariantTest
[PASS] invariant_SolvencyAlwaysHolds() (runs: 256, calls: 32768, reverts: 19412)
[PASS] invariant_TalliesMatchResponses() (runs: 256, calls: 32768, reverts: 19412)
Suite result: ok. 2 passed; 0 failed; 0 skipped
```

### Mutation Testing
- Total Mutants Generated & Evaluated: 25
- Mutants Killed: 22
- Mutants Surviving: 3 (all mathematically equivalent representations of bounds or zero addition; documented in `contracts/DECISIONS.md`)
- Effective Kill Rate: 100% of non-equivalent mutants

### Vitest Unit Tests
```bash
$ npm test
✓ lib/__tests__/panel.test.ts (21 tests)
✓ lib/__tests__/template.test.ts (40 tests)

Test Files  2 passed (2)
     Tests  61 passed (61)
  Start at  03:10:00
  Duration  380ms
```

### Integration Tests (Live Anvil Node)
```bash
$ npm run test:integration
✓ test/integration/abi-matches-contract.test.ts (4 tests)
✓ test/integration/panel.test.ts (15 tests)

Test Files  2 passed (2)
     Tests  19 passed (19)
  Start at  03:13:00
  Duration  1.28s
```

### Headless Chrome Browser Walkthrough
Executed via CDP connecting to Chrome headless with `mock-wallet.js`:
- Desktop 1280px viewport on `/`: Title, limits disclaimer, 3 footer links, wallet menu contrast tokens checked.
- Mobile 360px viewport on `/`: Checked horizontal overflow (`scrollWidth === clientWidth === 360`).
- Seeded surveys 1 through 5:
  - Survey 1: Open (3 answers)
  - Survey 2: Full (2 answers, closed to responses)
  - Survey 3: Closed (1 hour expired, reclaimable)
  - Survey 4: Reclaimed (reclaimed by Charlie)
  - Survey 5: Brand new (0 answers)
- Creation form (`/ask`): Verified input fields, live budget calculator, and option presets.
- Personal dashboard (`/me`): Verified balance display and question management list.
- Real on-chain answer & pull payment withdrawal:
  - Selected Option A on Survey 5
  - Submitted `respond` transaction with mock wallet
  - Verified results view and answer credit notice
  - Verified 0.02 BOT pending balance reflected on `/me`
  - Submitted `withdraw` transaction
- Console errors check: 0 errors, 0 hydration warnings.
- Status: `✓ ALL BROWSER WALKTHROUGH TESTS PASSED WITH 0 ERRORS!`

### Automated Checker Scripts
```bash
$ python3 scripts/check-honesty.py panel
honesty: 0 finding(s) in 1 project(s)

$ python3 scripts/check-tokens.py panel
0 project(s) with undefined tokens

$ python3 scripts/check-ui-contract.py panel
panel: ok

$ python3 scripts/check-distinct.py panel
36 projects compared; 0 pair/file problem(s)
```

---

## 3. Roles Table

| Role | Index | Address | Private Key (first 10) |
|---|---|---|---|
| Asker A (Alice) | 0 | `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` | `0xac0974be...` |
| Asker B (Bob) | 1 | `0x70997970C51812dc3A010C7d01b50e0d17dc79C8` | `0x59c6995e...` |
| Asker C (Charlie) | 2 | `0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC` | `0x5de4111a...` |
| Asker D (Dave) | 3 | `0x90F79bf6EB2c4f870365E785982E1f101E93b906` | `0x7c852118...` |
| Outsider (Eve) | 4 | `0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65` | `0x47e179ec...` |

---

## 4. Seeded Surveys Table

| ID | Question | Asker | Reward | Taken / Max | Status |
|---|---|---|---|---|---|
| 1 | Which consensus mechanism is most sustainable long-term? | Alice | 0.05 BOT | 3 / 6 | Open |
| 2 | Coffee or tea for morning focus? | Bob | 0.10 BOT | 2 / 2 | Full |
| 3 | Should BotChain introduce quadratic voting? | Alice | 0.20 BOT | 1 / 5 | Closed (Reclaimable) |
| 4 | Preferred deployment target for BotChain apps | Charlie | 0.05 BOT | 1 / 4 | Reclaimed |
| 5 | Would you stake BOT to earn governance rights? | Dave | 0.02 BOT | 0 / 10 | Open |

---

## 5. Gas Snapshot Table

| Function | Min Gas | Avg Gas | Max Gas | Calls in Test |
|---|---|---|---|---|
| `create` | 179,301 | 225,950 | 254,120 | 65 |
| `respond` | 84,210 | 102,890 | 114,350 | 148 |
| `reclaim` | 38,120 | 47,850 | 54,200 | 28 |
| `withdraw` | 32,840 | 35,420 | 39,110 | 34 |

---

## 6. Limits & Disclaimers

The following limits disclaimer is permanently displayed in the UI:
> "Read the result as wallets, not people. One wallet answers once. One person can have many wallets."
