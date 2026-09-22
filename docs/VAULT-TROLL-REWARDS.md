# VAULT — $TROLL REWARDS

Design doc for distributing real `$TROLL` to terminal users, drafted
2026-09-22. Nothing here is built yet. Two separate systems share one
budget and one manual-approval principle.

**Status: awaiting approval. No code written.**

---

## 0. The shape, in one paragraph

Two independent paths, both ending in the operator manually sending
`$TROLL` from their own wallet. Neither path ever moves a token
automatically, holds custody, or signs a transaction.

1. **Wallet submission** (`/vault` form → `/inspect` list) — a user pastes
   a Solana address and asks to be considered. The operator reviews and
   airdrops at their discretion. No PROBLEMS are spent. No entitlement is
   created. **Budget: 3% of creator rewards.**
2. **PROBLEMS redemption** (`/vault`) — a user spends PROBLEMS to enter an
   open redemption round. The operator approves payouts in `/inspect`.
   **Budget: a separate 3% of creator rewards.**

Total exposure: **6% of creator rewards**, 94% retained. Both budgets are
percentages of a *stream* that grows as fees accrue, not a fixed slice.

---

## 1. The numbers, measured (not assumed)

Read from the live database on **2026-09-22**.

### 1.1 The $TROLL side

| | |
|---|---|
| Creator rewards claimed to date | **5,841 TROLL** (~$315 at ~$0.054) |
| 3% for wallet-submission airdrops | **~175 TROLL** (~$9.46) |
| 3% for PROBLEMS redemption | **~175 TROLL** (~$9.46) |
| Retained | 94% |

Both pools grow with every future claim. The 175 figure is *today's*
ceiling, not the design's ceiling.

### 1.2 The PROBLEMS side — the finding that shapes everything

| | |
|---|---|
| Wallets total | 46 |
| PROBLEMS in circulation | 33,406 |
| **Held by `troll_runner` (the operator)** | **33,297 — 99.7%** |
| **Held by everyone else combined** | **109** |
| Wallets with any balance at all | 15 |
| Largest real-user balance | **26** |

**The real user economy is 109 PROBLEMS across 45 accounts.** The
33,297 is the operator's own testing balance and must be excluded from
every rate calculation — including it would overstate demand by ~300x.

This is good news. A ~175 TROLL pool against 109 real PROBLEMS is a
comfortable ratio. The system is being designed while it is small, which
is the right time.

### 1.3 How PROBLEMS enter circulation

| Source | Rate |
|---|---|
| Chatting | 1 PROBLEM per 7 qualifying messages |
| **Correct musing guess** | **+10 PROBLEMS** (costs 1 to attempt, 2 attempts max) |

| Sink | Cost |
|---|---|
| XP redemption | 5 minimum, 25 XP each |
| Archive unlock | 1 (deep: 3) |
| Guess attempt | 1 |
| Chat loop penalty | escalating |

**Supply is uncapped and there is no per-user limit.** The guess bonus is
net-positive by 9 PROBLEMS, so it is an inflation source independent of
chat volume. Neither fact is a problem today at 109 PROBLEMS; both become
one if a published fixed rate makes farming worth the effort.

---

## 2. Why the rate floats

The core risk, stated plainly: **PROBLEMS are cheap to mint and uncapped;
`$TROLL` may appreciate a great deal.** A fixed public rate is a standing
promise denominated in an asset you expect to rise, redeemable with a
currency that costs 7 chat messages.

Worked example at a hypothetical "500 PROBLEMS = 1 TROLL":

| $TROLL price | What 500 PROBLEMS (≈3,500 messages) claims |
|---|---|
| $0.054 (today) | $0.05 |
| $5.40 (100x) | $5.40 |
| $54.00 (1000x) | $54.00 |

The cost to mint the claim never changes. The liability scales with
exactly the outcome you are hoping for. And the pool is ~175 TROLL — a
handful of users could drain it, after which the published rate is either
broken or funded out of pocket.

**Therefore: no permanent rate is ever published.** `/vault` shows the
*current round's* rate and the pool remaining. Language is always "this
round," never "always." Rounds open and close.

This keeps the user-facing clarity of a fixed rate — you always know what
your PROBLEMS are worth *right now* — with none of the open-ended
exposure.

---

## 3. Path A — wallet submission

The simpler half. **No PROBLEMS involved, no rate, no entitlement.**

### 3.1 User flow (`/vault`)

- A signed-in user pastes a Solana address into a form.
- Client-side validation: base58, 32–44 chars. Server revalidates.
- One active submission per user; re-submitting updates the address
  rather than creating a second row.
- Confirmation copy must be explicit that this is **a request for
  consideration, not a claim**: *"submitted. no promises — the operator
  reviews these by hand."*

### 3.2 Operator flow (`/inspect`)

A new submissions panel, gated by the existing `requireOwner()` used by
every other `/inspect` endpoint. Per row: username, address (copy
button), submitted-at, terminal activity (PROBLEMS earned, messages,
archive unlocks) as review signal, and a status.

Statuses: `pending` → `airdropped` | `skipped`. Marking `airdropped`
records the operator-entered amount and an optional tx signature, purely
as a record — **the system never sends anything.**

### 3.3 Why this ships first

It has no economics in it. It unblocks collecting addresses and
airdropping by hand immediately, and nothing about it constrains the
Path B design.

---

## 4. Path B — PROBLEMS redemption

### 4.1 Rounds

A round is an operator-created record: a rate, a pool cap, an open/closed
flag. Only one round is open at a time. `/vault` shows the open round's
rate and remaining pool, or "no round open right now."

### 4.2 User flow

1. User sees the open round's rate and their balance.
2. Enters a PROBLEMS amount (subject to a minimum and a per-round
   per-user cap).
3. On submit: **PROBLEMS are debited immediately** and a redemption
   request is created as `pending`, carrying the round's rate and the
   user's submitted wallet address.
4. `/vault` shows their pending request and its implied `$TROLL` amount.

### 4.3 Operator flow (`/inspect`)

Pending requests list with the same approve/skip treatment as Path A.
Approving records amount and optional signature. **Skipping must refund
the PROBLEMS** — see 4.4.

### 4.4 The rollback constraint — important

`/api/vault/redeem` (the XP path) debits PROBLEMS and rolls the debit
back if the downstream award fails, so a spend never vanishes. **A
`$TROLL` redemption cannot work that way** — approval is manual and
happens hours or days later. There is nothing to synchronously roll back
against.

So this must **not** extend the XP route. It needs its own table and its
own route, with refund-on-skip as an explicit operator action. Reusing
the XP route would make a legitimately pending airdrop indistinguishable
from a failed redemption.

### 4.5 Setting each round's rate

Suggested method, not a formula to hardcode:

```
rate = pool_for_this_round / expected_PROBLEMS_redeemed
```

With 109 real PROBLEMS outstanding and ~175 TROLL available, even
redeeming the entire real supply is comfortably covered. Start
conservative, watch one round, adjust. The rate is a dial, not a
constant.

---

## 5. Schema sketch

```sql
-- Path A
create table terminal_wallet_submissions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id),
  address      text not null,
  status       text not null default 'pending',  -- pending|airdropped|skipped
  amount_troll numeric,        -- operator-entered, record only
  tx_signature text,
  note         text,
  created_at   timestamptz not null default now(),
  reviewed_at  timestamptz,
  unique (user_id)             -- one active submission per user
);

-- Path B
create table terminal_redemption_rounds (
  id                uuid primary key default gen_random_uuid(),
  problems_per_troll numeric not null,
  pool_troll        numeric not null,
  is_open           boolean not null default true,
  created_at        timestamptz not null default now(),
  closed_at         timestamptz
);

create table terminal_redemption_requests (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id),
  round_id       uuid not null references terminal_redemption_rounds(id),
  problems_spent integer not null,
  rate_at_request numeric not null,   -- frozen; round edits never restate a request
  address        text not null,
  status         text not null default 'pending', -- pending|paid|refunded
  amount_troll   numeric,
  tx_signature   text,
  created_at     timestamptz not null default now(),
  reviewed_at    timestamptz
);
```

Both tables: RLS on, users read only their own rows, all writes through
service-role routes. `/inspect` endpoints gated by `requireOwner()`.

---

## 6. Boundaries

- **No custody, no signing, no automated transfers.** Every payout is the
  operator sending from their own wallet by hand. The app records that it
  happened; it never causes it.
- **No private keys in this project, ever.**
- **`/vault` copy never promises a payout.** "Considered," "reviewed by
  hand," "this round" — never "guaranteed," "owed," or "always."
- **No rate is published as permanent.**
- **The terminal persona never mentions any of this.** The no-shill
  boundary in lore §57/§59 is unchanged — a redemption system is not a
  reason for the entity to start talking about token value, and it must
  not become transmission material.

---

## 7. Build phases

| Phase | Scope | Risk |
|---|---|---|
| **1** | Path A: table, `/vault` form, `/inspect` panel, statuses | Low — no economics |
| **2** | Path B schema + round management in `/inspect` | Low — operator-only |
| **3** | Path B user flow: debit, request, pending display | Medium — real balances |
| **4** | Refund-on-skip, per-user caps, round close | Medium |

Phase 1 is independently shippable and useful on its own.

---

## 8. Open questions

1. **Minimum and per-user cap for Path B?** With a top real balance of 26,
   a 25-PROBLEM minimum would exclude every real user today. Suggest a
   minimum of 5 (matching XP redemption) and a per-round cap.
2. **Should Path A require any qualification** (a minimum lifetime_earned,
   say) or accept all submissions and let review sort it out?
3. **Does a Path B request reuse the Path A address,** or is it entered
   per request? Reuse is simpler; per-request is safer if a user's wallet
   changes.
4. **What happens to the operator's 33,297 PROBLEMS?** They should be
   excluded from any supply statistic shown publicly, or zeroed, so the
   `/vault` ladder and any future rate math aren't distorted.
