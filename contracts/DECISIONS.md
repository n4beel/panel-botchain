# Panel Contract Design Decisions

## 1. Architectural Decisions

### 1.1 Prefunded Escrow & Pull Payments
- The asker must fund the entire potential payout `reward * maxResponses` upfront at the time of creation (`create`).
- Upon each valid response (`respond`), `pending[msg.sender] += reward` is credited immediately.
- Respondents and askers withdraw accrued BOT via a reentrancy-guarded pull payment (`withdraw`).
- **Rationale:** Pushing payments directly inside `respond` or `reclaim` introduces untrusted external calls and griefing vectors (such as gas exhaustion or revert loops by malicious receivers). Pull payments ensure that every response transaction executes cleanly in constant time.

### 1.2 One Answer Per Address
- `_choice[id][addr]` maps `addr` to `option + 1` (where 0 means not answered, 1 means option 0, etc.).
- An address can answer each survey at most once.
- The asker is explicitly prohibited from responding to their own survey (`AskerCannotRespond`).
- **Rationale:** Prevents sybil draining of the asker's own bounty within a single wallet while preserving simple O(1) checks.

### 1.3 Strict Parameter Bounds & Gas Optimization
- Question length: `1 <= bytes(question).length <= 120`.
- Options count: `2 <= options.length <= 6`.
- Option label length: `1 <= bytes(options[i]).length <= 32`.
- Responses count: `1 <= maxResponses <= 1000`.
- Duration: `1 hours <= durationSecs <= 90 days`.
- Tally storage: `uint32[6]` fixed array per survey, avoiding dynamic array resizing.
- Pagination: `latest` caps batch retrieval at 50 surveys per call.

### 1.4 Reclaim Mechanics
- Asker can reclaim unspent funds `reward * (maxResponses - responses)` only when the survey has closed (`block.timestamp >= closesAt`) or is full (`responses == maxResponses`).
- Reclaiming marks `reclaimed = true`, credits `pending[asker]`, and emits `Reclaimed(id, amount)`.
- Reclaiming can only occur once (`AlreadyReclaimed`).

---

## 2. Invariant Specifications

1. **Conservation of Funds:**
   At all times, contract balance equals total prefunded deposits minus total withdrawn amounts:
   `address(panel).balance == sum(funded) - sum(withdrawn)`.
   Additionally, contract balance always covers all accrued pending balances:
   `address(panel).balance >= sum(pending[all_actors])`.

2. **Tally Integrity & Bounded Responses:**
   For any survey `id`, the sum of option tallies equals the recorded responses count, which never exceeds `maxResponses`:
   `sum(tallyOf(id)) == surveyOf(id).responses <= surveyOf(id).maxResponses`.

3. **Asker Isolation:**
   The creator of a survey cannot submit responses or collect respondent bounty from their own survey.

---

## 3. Mutation Testing Analysis

Ran `python3 scripts/mutation-check.py panel --max 25` against `Panel.sol`:
- **Mutants Tested:** 25
- **Mutants Killed:** 22
- **Surviving Mutants:** 3

All 3 surviving mutants are mathematically and semantically equivalent transformations:
1. `Panel.sol:241` — `count_ < available ? count_ : available` mutated to `<= available`:
   - When `count_ == available`, both `<` (taking the false branch `available`) and `<=` (taking the true branch `count_`) evaluate to the exact same numerical value.
2. `Panel.sol:179` — `if (amount > 0)` mutated to `if (amount >= 0)`:
   - When `amount == 0`, executing `pending[s.asker] += 0` adds zero to storage, producing an identical state and emitting `Reclaimed(id, 0)` without side effects.
3. `Panel.sol:233` — `if (count_ > 50) count_ = 50` mutated to `>= 50`:
   - When `count_ == 50`, assigning `count_ = 50` leaves the value unchanged in both cases.
