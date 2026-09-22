# VAULT — $TROLL REWARDS

Design doc for distributing real `$TROLL` to terminal users, drafted
2026-09-22. Nothing here is built yet. Two separate systems share one
budget and one manual-approval principle.

**Status: all four phases BUILT (2026-09-22). Both migrations still need
running against the live database — until then the forms error.**

| Phase | Status |
|---|---|
| 1 — wallet submission | built: migration `020`, `/api/vault/wallet`, `/api/admin/wallet-submissions` |
| 2 — round schema + operator controls | built: migration `021`, `/api/admin/redemptions` |
| 3 — user redemption flow | built: `/api/vault/redeem-troll`, `/vault` panel |
| 4 — refund-on-skip, caps, round close | built: refund action, per-user cap, one-open-round index |

**To go live:** run `supabase/migrations/020_wallet_submissions.sql` then
`021_redemption_rounds.sql` in the Supabase SQL editor. `021` seeds round 1
at 69 PROBLEMS = 1 TROLL, a 175 TROLL pool and a 500-PROBLEMS per-user cap.

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

**Round 1 rate: `69 PROBLEMS = 1 TROLL`** — chosen 2026-09-22.

How it measures up against the two things that matter:

| | |
|---|---|
| 1 TROLL costs | 69 PROBLEMS = **483 chat messages** (or 7 correct guesses) |
| Top real user (26 PROBLEMS) | **0.377 TROLL** — within sight of a whole coin |
| Minimum redeem (5 PROBLEMS) | 0.072 TROLL |
| Pool absorbs | **12,090 PROBLEMS — 111x the current real supply** |
| Everyone redeems all 109 | 1.58 TROLL = **0.9% of the pool** |

It is reachable without being farmable at today's prices, which is the
balance the rate has to strike. A much larger number (420 was considered)
is equally safe but puts a whole coin 2,940 messages away and leaves the
top real user at 6% of one — technically fine, motivationally dead.

**Watch this line as `$TROLL` appreciates:**

| $TROLL price | Effective value per chat message |
|---|---|
| $0.054 (today) | $0.00011 |
| $0.54 | $0.00112 |
| $5.40 | $0.01118 |
| $54.00 | **$0.11180** |

Around the $5–50 range, farming chat messages starts to pay for itself.
That is the trigger to lower the rate for the next round — which is
precisely why the rate is per-round and never published as permanent
(§2). 69 is *this round's* rate.

General method for later rounds:

```
rate = pool_for_this_round / expected_PROBLEMS_redeemed
```

Start conservative, watch one round, adjust. The rate is a dial, not a
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

1. ~~**Minimum and per-user cap for Path B?**~~ **Both resolved.** Minimum
   is 5 PROBLEMS, matching XP redemption (0.072 TROLL at 69:1); a higher
   floor would exclude most real users (top balance 26). Round 1 seeds a
   **500-PROBLEMS per-user cap** — non-binding at today's balances, in
   place before it needs to be.
2. ~~**Should Path A require any qualification?**~~ **No gate.** Anyone
   signed in may submit; the operator sees each filer's PROBLEMS balance
   and lifetime earned next to their address and decides from there.
   Review is the filter, which is the whole premise of a manual system.
3. ~~**Does a Path B request reuse the Path A address?**~~ **Reuse.**
   `/api/vault/redeem-troll` requires a Path A submission and copies that
   address onto the request, rather than offering a second field. One
   address, typed once, validated once — a second entry point is a second
   chance to typo an address that real tokens get sent to. The address is
   **frozen onto the request** at file time, so changing your wallet later
   never redirects a payout already in the queue.
4. **What happens to the operator's 33,297 PROBLEMS?** Still open. They
   should be excluded from any public supply statistic, or zeroed, so the
   `/vault` ladder and future rate math aren't distorted. Nothing built so
   far reads them — `checkRedemption` works per-user — but the top-miners
   ladder still shows them.

### Deliberately not built

- **Automatic payouts.** Every transfer is the operator sending by hand.
  No keys, no signing, no custody anywhere in this project.
- **Un-refunding.** Undo works on a `paid` mark only. A refund already
  moved PROBLEMS back to the user; reversing it would have to debit them
  again, which is a new request, not an undo.
- **A published rate history.** RLS exposes only the open round, so
  `/vault` can't be mined for a rate schedule that looks like a promise.
