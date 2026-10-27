# Panel

Pay people to answer one question.

Panel is a prefunded single-question survey application built on BOT Chain (Bohr testnet chain ID 968). Anyone can post a question with 2 to 6 options, set a per-response bounty in BOT, specify a respondent capacity (1 to 100), and fund the maximum budget up front.

Respondents connect their wallet, pick an option, and submit their response. Each wallet can answer each survey at most once. Bounties accrue into a pull payment balance that can be withdrawn at any time. Unspent budgets from expired or filled surveys can be reclaimed by the survey creator.

## What it does
- **Upfront Prefunded Budget:** Creators deposit `reward * maxResponses` in BOT at creation time. No respondent works on credit.
- **One Wallet, One Answer:** Each wallet can respond to a survey at most once. Creators cannot answer their own questions.
- **Pull Payment Payouts:** Respondent rewards and reclaimed budgets accumulate in a secure on-chain `pending` balance, protected by Checks-Effects-Interactions and reentrancy guards.
- **Reclaimable Unspent Budget:** If a survey closes with fewer than `maxResponses` answers, the creator can reclaim all unspent bounty (`reward * (maxResponses - responses)`) to their withdrawable balance.
- **Hidden Results Until Answer:** Results and percentage shares remain concealed from respondents until they submit their answer (or until the survey closes/fills), preventing bandwagon bias.
- **Archetype AD · Questionnaire:** Clean editorial questionnaire design featuring deep editorial violet (`#6C47FF`), crisp white cards on soft tinted canvas (`#F7F5FF`), editorial serif question typography (`DM Serif Display`), tight functional UI headers (`Inter Tight`), and monospaced financial data (`JetBrains Mono`).

## What it cannot do
- **No Sybil Resistance Beyond Wallets:** The smart contract enforces one response per wallet address. One person with multiple funded wallets can submit multiple answers. Results should be read as "wallets answered", not "unique human beings".
- **No Off-Chain Answer Editing:** Once submitted, an answer cannot be updated or retracted.
- **No Free Surveys:** Every survey requires a minimum bounty of 1 wei and upfront prefunding.

## Gas Profile
Measured with Solc 0.8.23 via Foundry:

| Operation | Gas Used | Cost (BOT at 20 gwei) |
|---|---|---|
| `create(question, options, reward, maxResponses, durationSecs)` (3 options) | ~226,000 | ~0.0045 BOT |
| `respond(id, option)` | ~103,000 | ~0.0021 BOT |
| `reclaim(id)` | ~48,000 | ~0.0010 BOT |
| `withdraw()` | ~35,000 | ~0.0007 BOT |
| `surveyOf(id)` | View call | Free |
| `optionsOf(id)` | View call | Free |
| `tallyOf(id)` | View call | Free |
| `choiceOf(id, voter)` | View call | Free |
| `latest(limit)` | View call | Free |

## Development & Local Stack

Run the local stack with 5 seeded surveys (chain ID 968 on port 8725):
```bash
node scripts/local-stack.mjs
npm run dev
```

Run tests:
```bash
# Contract unit, fuzz (256 runs), and invariant suites
cd contracts && forge test --gas-report

# Frontend unit tests and typecheck
npm test
npx tsc --noEmit

# Full integration test suite on live anvil node
npm run test:integration

# Headless Chrome automated walkthrough
node scripts/browser-walkthrough.mjs
```
