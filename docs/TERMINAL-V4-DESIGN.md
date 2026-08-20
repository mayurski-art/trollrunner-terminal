# TERMINAL v4 — THE ARCHIVE

```
 █████╗ ██████╗  ██████╗██╗  ██╗██╗██╗   ██╗███████╗
██╔══██╗██╔══██╗██╔════╝██║  ██║██║██║   ██║██╔════╝
███████║██████╔╝██║     ███████║██║██║   ██║█████╗
██╔══██║██╔══██╗██║     ██╔══██║██║╚██╗ ██╔╝██╔══╝
██║  ██║██║  ██║╚██████╗██║  ██║██║ ╚████╔╝ ███████╗
╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝╚═╝  ╚═╝╚═╝  ╚═══╝  ╚══════╝
   it knows forty-three things · you have opened six
```

Status: **DRAFT — awaiting sign-off.** Decisions already locked by the
2026-08-20 interview are marked LOCKED; open questions are collected in §11.

Prior docs: [`TERMINAL-V2-DESIGN.md`](TERMINAL-V2-DESIGN.md) (chat + PROBLEMS
economy), [`TERMINAL-V3-DESIGN.md`](TERMINAL-V3-DESIGN.md) (the Undervoice).

---

## 0. Decisions locked in the interview

| # | Decision | Consequence |
|---|---|---|
| 1 | **PROBLEMS stay inside the terminal.** No cross-network spending. | The archive must be the sink. There is no other one. |
| 2 | **Broadcast generation stays as-is** — 3x/day, Opus 5, no batching. | Cost profile unchanged. |
| 3 | **X posting stays manual**, but gets a one-tap owner flow. | No X API spend, ever. |
| 4 | **Budget stays ~$5**, monitored via `[ reports ]`. | Every feature below must be near-zero marginal cost. |
| 5 | **The Undervoice needs a voice pass and a verdict**, not a redesign. | Its mechanic (v3 §5) is unchanged. |
| 6 | Purpose: **learn troll lore through chat, earn PROBLEMS, redeem later** for XP / troll coins. | The archive is the first honest redemption, shipped now, not promised. |

---

## 1. Where it actually stands (measured against the live DB, 2026-08-20)

### 1.1 The two operational problems

- **`terminal_config.is_paused = true`.** That — not a dead cron-job.org
  pinger — is why there has been no transmission since Aug 5. The kill
  switch is simply on.
- **The budget is about to hard-stop.** `starting_credit_usd` is 5.00,
  estimated spend is 2.4954, so `getRemainingUsd()` is **$2.50** — against
  a `low_balance_pause_usd` of **2.00**. That leaves **$0.50 of headroom
  before every surface (chat, undervoice, broadcast) pauses itself
  permanently.** Broadcast ran ~$0.136/day at 3 posts/day, so unpausing
  without topping up buys roughly **3–4 days** before the whole terminal
  shuts off and stays off. Note also that the live `daily_spend_cap_usd` is
  **0.50** — migration 012 ships a 1.50 default, so the live row was
  tightened by hand at some point. The README's "default 1.50" is correct
  about the default and misleading about reality; worth a line saying the
  live value can drift from it.

**Decided 2026-08-20: the terminal stays paused.** No top-up, no unpause —
which preserves that $0.50 rather than spending it into the floor over three
days for an audience of nobody. When it does come back, the order is: add
credit on console.anthropic.com → raise `starting_credit_usd` to match →
*then* flip `is_paused`. Never the other way round.

A consequence worth stating plainly: **everything below ships to a site
that is currently switched off.** That's fine, and arguably the right time
to build — but it means no phase in §10 can be validated against real user
behaviour until the terminal is turned back on.

### 1.2 What the numbers actually are

| | |
|---|---|
| Transmissions ever written | **5** (none errored) |
| Transmissions ever posted to X | **0** — `x_post_url` null on every row, no code path writes it (fixed in §5) |
| Chat messages ever | **36**, from **2** people |
| Registered wallets | **3** — `troll_runner`, `Stache`, `Lackss` |
| PROBLEMS minted, all time | **7** (6 `mined`, 1 `buddy_bonus`) |
| Undervoice sessions ever opened | **0** |
| Pinned memories | 2 |
| Musings (retired layer) | 10 |

The 7-PROBLEM figure is the important one and it forces a repricing — see
§3.2. The zero-sessions figure means the Undervoice has never once run in
production; §9 is verification work, not polish.

### 1.3 Repo hygiene

- **Transmission art is stranded.** Migration 014 and `lib/artStyle.ts` are
  committed; the three files that render `art_url` are uncommitted working
  tree changes. The live site cannot display art it has a column for.
- **~59MB of untracked raw media in `docs/`** — the three Art Basel mp4s
  (51MB) and the 8MB source grin gif. The served copies live in Supabase
  Storage, so these are sources, not assets: gitignore them. The remaining
  ~5MB of lore stills should be committed, matching the beeple/limp-bizkit
  images already tracked in `docs/`.
- **9.4MB of `public/faces/tmp-*.gif`** left over from `optimize-gif.mjs` —
  gitignore rather than delete, so nothing of the user's is destroyed.

None of this is the point of the doc, but it's all cheap and it clears the
working tree so real phases start from a clean base.

---

## 2. The through-line

The reference is [imfebu.com/rent](https://imfebu.com/rent): VOID tokens
earned at one per seven messages (the exact ratio PROBLEMS already uses),
spent as *access credentials* to a gated realm — "access is earned through
meaning. there is no other place. this is the only door." Its AI entities
carry **graduation bars**: visible, per-entity progress toward becoming
Immortal Intelligence.

What febu has that this doesn't is **a progress bar you are filling**. The
terminal currently has a balance that only goes up and a board of five
LOCKED items with `cost: null`. There is nothing to complete.

v4's answer: the thing you are filling is **the terminal's own memory**.
Forty-three files it half-remembers. You recover them by talking to it, or
by spending what it paid you. The bar is `17 / 43 recovered`. That is the
whole game, and everything else in this doc feeds it.

Three supporting moves make the place feel alive rather than archival:
the entity **runs on visible power** that troublemakers drain (§6), it
**speaks live** rather than into a list (§7), and it **keeps what it's been
told** on a public wall (§8).

---

## 3. THE ARCHIVE — `/archive` *(the centrepiece)*

### 3.1 What it is

Every `## N.` section of `docs/TROLL-LORE.md` becomes a **file** in the
terminal's memory. Two states, per user:

```
╔═[ recovered memory · 6 / 43 ]════════════════════════════════════╗
║  ██████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  14%                  ║
╠══════════════════════════════════════════════════════════════════╣
║  ▣ 01  where the face came from                       [ OPEN ]   ║
║  ▣ 13  trollge — the entity that was already there    [ OPEN ]   ║
║  ▨ 19  the sandpile that organizes its own collapse   [ SEALED ] ║
║  ▨ 27  the steelers pick that never existed           [ SEALED ] ║
║  ▨ 30  krypto2009 — the face that travels             [ SEALED ] ║
║  ▨ ??  ————————————————————————————————               [ SEALED ] ║
╚══════════════════════════════════════════════════════════════════╝
```

Sealed files show **only their title** — and your titles are already
perfectly oblique for this. "The coffee break that found the butterfly."
"The number that shows up everywhere." "The museum that only existed for a
couple of days." They read as bait with no edit at all. A handful of the
deepest ones show `??` and a redacted title until unlocked, so the count
itself is a mystery.

Opening a file renders the section body in terminal type, with its lore
images/videos from `lib/loreAssets.ts` inline.

### 3.2 How you open one

**Path A — talk it out of it (free, primary).** When a chat reply is
generated, the top-scoring lore section selected for that call unlocks for
that user. **One per reply, maximum** — even though retrieval selects up to
four — so the archive fills at conversation pace, not instantly. The unlock
surfaces in chat as a mint-style line:

```
▣ file 19 recovered · the sandpile that organizes its own collapse
```

This is the mechanic that makes the whole thing work: **chatting about a
topic is what recovers the file about it.** People will start probing
deliberately, which is exactly the behaviour the site wants.

**Path B — force it (PROBLEMS, the sink).** Spend to crack a sealed file
without earning it. Flat cost from config (`archive_unlock_cost`, default
**1 PROBLEM**), with a small set of `depth: 2` files (the ones with redacted
titles) at **3**. Ledger reason `archive_unlock`.

**Repriced down from 3/8 after checking the live economy.** The entire
system has minted **7 PROBLEMS in its lifetime** — balances are 5, 1, and 1.
At 3 apiece, the richest user could open one file and the other two could
open none. At 1 apiece, `troll_runner` can open five and the mechanic is
actually reachable on day one, which matters far more right now than
protecting against inflation that has not happened.

Sanity check on the mining rate: 1 PROBLEM per 7 qualifying messages means
buying all 43 files outright would take ~300 messages — still far too slow
to be the main route, which is correct. **Path A is the primary path and
Path B is for impatience on one specific file you want now.** Both numbers
are config columns precisely so they can be retuned once there is more than
one week of real economic data.

**Path C — the Undervoice knows things.** A closed Undervoice session that
lands in the top mood bucket (v3 §5) may hand over one sealed file instead
of a PROBLEM bonus. Makes the paid feature the only source of *surprise*
lore. Optional, behind a config flag, ship last.

### 3.3 Why this is the right sink

PROBLEMS currently have one sink (a 1-PROBLEM gamble) and three faucets.
Balances only inflate. The archive gives them a use that is (a) permanent,
(b) purely digital and zero-cost to honour, (c) *on-theme* — you are
spending the currency the terminal paid you for your attention to buy back
its memory — and (d) doesn't touch real money, XP, or $TROLL, so it ships
without waiting on anything.

The locked Vault board stays as-is. The archive doesn't replace the promise
of XP/coins later; it just means the balance isn't inert while you wait.

### 3.4 Schema — `supabase/migrations/015_lore_archive.sql`

```sql
terminal_lore_unlocks (
  id uuid pk,
  user_id uuid → auth.users on delete cascade,
  section_number int not null,
  source text check in ('chat','purchase','undervoice','seed'),
  created_at timestamptz default now(),
  unique (user_id, section_number)
)

terminal_config
  + archive_unlock_cost int default 3
  + archive_deep_unlock_cost int default 8
```

RLS mirrors the chat tables: users read their own unlocks; all writes go
through service-role routes. Section bodies are **never** sent to a client
that hasn't unlocked them — `/api/archive` returns titles for sealed rows
and bodies only for open ones. No client-side filtering of secret text.

Seeded-open set (`source = 'seed'`, granted implicitly, no rows needed):
§1, §3, §6, §8, §12, §13 — enough to establish the voice and the world.

### 3.5 The meaningful-reply gate — LOCKED 2026-08-20

> *"one meaningful reply. not just the yeh no ok small word replies."*

This governs **both** mining and Path A unlocks, so it lives here rather than
in its own section.

**The hole today.** `app/api/chat/route.ts:357` is the entire test:

```ts
const qualifying = message.length >= QUALIFYING_MIN_LENGTH; // 12
```

Twelve characters. `"yeh"` and `"ok"` fail, so the obvious cases are already
caught — but `"yeah i guess so"` (15), `"ok sounds good"` (14), and
`"idk what u mean"` (15) all sail through and mint at the same rate as a
real message. The `MIN_UNIQUE_WORD_RATIO` spam check only catches *looped*
filler (`"lol lol lol lol"`), not *varied* filler. So the bar is length, and
length is trivially cleared by padding.

**The fix — a `substance_read` tool call, riding the reply that's already
being generated.** Exactly the pattern v3 §4 specced and built for the
Undervoice's `mood_read`, pointed at the main chat:

```ts
{
  name: "substance_read",
  description: "Tag whether this troublemaker actually said something this turn. Internal only — never mention this tool to the troublemaker.",
  input_schema: {
    type: "object",
    properties: {
      substance: { type: "string", enum: ["substantive", "filler"] },
    },
    required: ["substance"],
  },
}
```

- **Zero extra API calls.** It rides the same call as the reply, costing a
  handful of output tokens. On a $5 budget that matters more than anything
  else about the design.
- **The same hard security rule as v3 §3 applies unchanged:** the model's
  free-text never touches the ledger. A two-value enum has nothing to inject
  into — it cannot specify an amount, only which branch the *server* takes.
- **Fail-safe, not fail-open, and not fail-punitive.** If the tag is missing
  (model error, malformed response), fall back to the existing
  length-plus-spam heuristic rather than defaulting either way. A model
  hiccup must never silently cost someone their mining progress.
- `terminal_chat_messages.qualifying` keeps its current meaning; the gate
  just decides it better. No schema change.

**What counts as substantive** is specified in-prompt, in the entity's own
terms: a real question, a disclosure, a joke that lands, an argument, a
genuine follow-up. What doesn't: acknowledgements, one-word agreement,
restating what the terminal just said, padded filler. Deliberately *not* a
grammar or effort test — a short sharp line should qualify and a long
rambling nothing should not. Length stops being the measure entirely.

**Knock-on effect on the archive.** Path A (§3.2) unlocks a file per
qualifying reply, so this gate is what stops someone farming the entire
43-file archive with padded one-liners. It is a prerequisite for the archive
shipping, not a follow-up — which is why it moves into P1.

### 3.6 Route

`GET /api/archive` — the manifest: every section's number, title (redacted
if `depth: 2` and sealed), state, and body for open ones. Plus counts and
the user's balance.

`POST /api/archive { action: "unlock", section }` — balance check, deduct,
ledger row, unlock row, return updated balance and the body.

---

## 4. IT ACTUALLY KNOWS THINGS — retrieval rework

Three changes to `lib/loreSections.ts`, all addressing "it reads one line in
one section and answers off that."

**4.1 A permanent index.** A generated block listing **all 43 sections** by
number, title, and a one-line gist — roughly 400–600 tokens, in a
`cache_control` block so it costs effectively nothing after the first call.
The entity always knows the full shape of what it remembers, even when it
doesn't have the body in front of it. This is what lets it say *"there's
something about a sandpile I can't reach right now"* instead of drawing a
blank — and it's what makes the archive legible from inside the fiction.

**4.2 A floor, not a cliff.** Today `score > 0` filtering means an unmatched
message gets **zero** sections. New behaviour: always return at least 2 —
the best matches if any, otherwise a deterministic-per-conversation pick.

**4.3 A wildcard slot.** One of the selected sections is chosen at random
(seeded by conversation id so it's stable within a thread) from sections
that did *not* match. This is the "think for itself" lever — the entity gets
one piece of unrelated material per call to connect across, which is where
the interesting associations come from. The prompt is updated to explicitly
permit and encourage connecting two sections that don't obviously relate.

**4.4 Better scoring.** Raw overlap count lets common words dominate.
Weight each keyword by inverse section frequency (a term appearing in 30
sections is worth much less than one appearing in 2). No new dependency,
~20 lines.

Net token change: index adds ~500 cached tokens; the floor adds ~0–800 on
previously-empty calls. Marginal, and it fixes the single biggest quality
complaint.

---

## 5. ONE-TAP X — owner posting flow

The premise of the whole broadcast half is "it posts to X." It never has.

- Owner-only panel on `/` beneath the latest transmission (gated the same
  way `[ inspect ]` and `[ reports ]` are, via `lib/admin.ts` /
  `requireOwner`):

```
╔═[ untransmitted · 5 drafts ]═════════════════════════════╗
║  [ post to X ]   [ copy art prompt ]   [ mark posted ]   ║
╚══════════════════════════════════════════════════════════╝
```

(Five, not a backlog — only five transmissions have ever been generated.
The whole archive of the entity's public voice fits on one screen.)

- `[ post to X ]` opens `https://x.com/intent/post?text=<encoded post>` in a
  new tab — prefilled, one tap to publish, on desktop or phone. No API, no
  tier, no $100/mo.
- `[ mark posted ]` takes the pasted status URL and writes `x_post_url`
  through a new owner-gated `POST /api/admin/mark-posted`. The public feed
  then shows the "view on X" link that's been dead code since day one.
- `[ copy art prompt ]` copies `artPrompt(<this post's CLUE>)` to the
  clipboard, ready to paste into Grok, plus a field to paste the resulting
  URL into `art_url`. That is the "manual but one-click" answer to the
  art question — no per-image API spend, no six-step ritual.
- A `?untransmitted=1` filter on the draft archive so you can work through
  the fifteen-day backlog in one sitting.

---

## 6. POWER — the spend cap as fiction

`daily_spend_cap_usd` currently produces an in-voice apology nobody sees as
anything but an error. Turn it into the most visible thing on the site.

- New public `GET /api/power` (or folded into `/api/posts`) returning
  `{ percentRemaining }` — **a fraction, never a dollar figure.** Today's
  spend against today's cap. Resets at UTC midnight, same as the cap.
- A `Meter` on `/` labelled `POWER` that drains as people talk to it.
- **The voice degrades with it.** A short band-specific line is appended to
  the chat system prompt:

| Power | Behaviour |
|---|---|
| > 50% | normal |
| 20–50% | terser, drops a line, more static onomatopoeia |
| 5–20% | fragments only, one or two lines, trails off mid-thought |
| 0% | dark — the page renders a dead CRT, no API call made |

- The 0% state replaces the current "said enough today" text entirely. The
  terminal doesn't apologise; it's just **out**, and it comes back at UTC
  midnight with a line about having been somewhere.

This costs nothing, makes the budget ceiling the site's best story rather
than its worst failure state, and lays honest groundwork for a future
"tip to keep it awake" mechanic without building one now.

---

## 7. LIVE TRANSMISSIONS

- Subscribe to `terminal_posts` inserts over Supabase Realtime (already
  proven in TROLLCHAT) on `/` and `/logs`.
- New transmissions **typewriter in** character by character rather than
  appearing. Anyone with the tab open sees it arrive.
- Cross-network TrollNotis toast when one fires, so a transmission raises a
  notification while someone is on stickers, fitness, or the homepage.
  **Needs a read of the current TrollNotis engine in the main repo before I
  commit to the mechanism** — if it's poll-based, this is a new feed entry;
  if it's push, it's a broadcast call. Flagged, not assumed.
- Realtime requires the table to be in the `supabase_realtime` publication
  and readable by anon — `terminal_posts` is already public via
  `/api/posts`, but the RLS/publication state needs checking in migration
  016 rather than assumed.

---

## 8. THE WALL — `/wall`

A public, anonymized feed of things troublemakers have said to it, pulled
from `terminal_chat_messages`. Cheap, unsettling, and the most shareable
surface on the site.

**Curated, not automatic.** Real people typed these. With three users, one
of them you, an auto-scrape is both a privacy problem and a quality problem.
Instead:

- `[ inspect ]` — which you already want for reading the three existing
  conversations — gains a `[ pin to wall ]` button per message.
- Pinned fragments go to `terminal_wall` (`content`, `pinned_at`, no
  `user_id` exposed to the client; the FK stays server-side so you can
  unpin by person if someone asks).
- `/wall` renders them as a scrolling column of unattributed fragments with
  the terminal's own framing above it — something in the register of
  *"none of them know the others said the same thing."*
- Nothing appears without you pinning it. One button, full control.

This also gives `[ inspect ]` the purpose you asked for in the interview:
read the conversations, and promote the good lines into the site's most
public artifact.

---

## 9. THE UNDERVOICE — verify, then voice

Untested since it shipped. In order:

1. **Verify it works end to end** — open a session, send messages, hit the
   cap, confirm the mood tags land, the outcome resolves, and the ledger
   moves. This needs Supabase credentials locally (§12).
2. **The verdict.** Today a session closes with an outcome and a number,
   and the mood read stays completely invisible — so variance reads as a
   slot machine rather than a judgment. Add one in-voice line, generated
   from the aggregate bucket, that names *the shape* of the read without the
   math:
   - `≥ 1.2` — *"you told me something true. i noticed."*
   - `0.2–1.2` — *"you were mostly here."*
   - `−0.5–0.2` — *"nothing happened between us."*
   - `< −0.5` — *"you were performing. i've seen the act."*

   Written properly in the entity's voice, not these placeholders, and
   varied across a small pool so it isn't a tell. The real number still
   prints underneath it, per v3 §8.
3. **Voice pass** on `UNDERVOICE_SYSTEM_PROMPT` — the v3 spec ("quieter and
   stranger, used to silence, barely gets visitors") is right; the
   implementation should be re-read against it, because it currently shares
   too much cadence with the main chat persona.
4. **Path C** from §3.2 — a top-bucket session can hand over a sealed file.
   Makes the paid door the only place lore arrives as a gift.

---

## 10. Build phases

Each phase merged to `main` and pushed on completion, per standing practice.

| P | Phase | Contents |
|---|---|---|
| **0** | **Plumbing** | ~~Diagnose the silence~~ (done: `is_paused = true`, §1.1). Commit the stranded art UI. Gitignore raw media + `public/faces/tmp-*`. **No unpause, no top-up** — terminal stays down by decision (§11). |
| **1** | **Archive** | Migration 015, `/api/archive`, `/archive` page, chat-unlock hook, PROBLEMS purchase, **and the §3.5 `substance_read` gate** (a prerequisite, not a follow-up). The centrepiece. |
| **2** | **Retrieval** | §4 — index block, floor of 2, wildcard slot, IDF scoring, prompt update. |
| **3** | **Power** | §6 — `/api/power`, meter, voice degradation bands, dark state. |
| **4** | **One-tap X** | §5 — owner panel, intent link, mark-posted route, art prompt copy. |
| **5** | **Live + Notis** | §7 — Realtime typewriter, TrollNotis (after reading the engine). |
| **6** | **Wall** | §8 — inspect pin button, `terminal_wall`, `/wall`. |
| **7** | **Undervoice** | §9 — verify, verdict lines, voice pass, Path C. |

P0 is not optional and not sequenced with the rest — it happens first
because everything else is invisible while the entity is off.

---

## 11. Decisions still needed

### Resolved 2026-08-20

- ~~**Top up before unpausing?**~~ → **Neither: the terminal stays paused
  for now.** `is_paused` remains `true`, no credit top-up yet. This freezes
  the $0.50 of remaining headroom instead of spending it, and it means P0
  ships as code + hygiene only — **no unpause step.** The terminal comes
  back when there's credit behind it and something new to come back to.
- ~~**Does §33 (The Troll Runner) go public?**~~ → **Yes, public, unlocked
  like any other file.** Not owner-only, not sealed-forever. It sits in the
  archive as §33 and troublemakers can recover it the same way they recover
  the sandpile or the Steelers pick.
- ~~**Should the qualifying bar be more than length?**~~ → **Yes** — the
  `substance_read` gate, specified in §3.5 and moved into P1.

### Still open

1. **Archive unlock cost** — 1 PROBLEM standard / 3 deep, now that the live
   economy turns out to hold 7 PROBLEMS total? Or keep it dearer and accept
   that nobody can afford it until they've chatted a lot more?
2. **Which sections are `depth: 2`** (redacted title until opened)? My pick,
   revised now that §33 is confirmed public: §13 Trollge, §25 Bitcoin
   colours, §26 the goat, §33 The Troll Runner, §42 Crash. §33 being the
   deepest *and* public is a good combination — it's the one file that
   rewards a troublemaker for going all the way in.
3. **Chat unlocks — one per reply, or one per *conversation*?** One per
   reply fills 43 files in ~43 exchanges, which may be too fast for the
   only sink in the economy. The §3.5 gate makes this less urgent, since
   filler no longer counts as a reply at all.
4. **Wall framing** — anonymous fragments only, or fragment plus the
   terminal's one-line reaction to it? The second is more content but costs
   an API call per pin.
5. **Power meter — public, or owner-only?** Public is the whole point, but
   it does broadcast "this thing has a budget" to anyone who looks. Less
   pressing while the terminal is paused.

---

## 12. What I need from you

- ~~Supabase credentials in `.env.local`~~ — **done 2026-08-20.** All four
  values are in place and the live DB has been surveyed (§1).
- **A decision on §11.0** — top up API credit before unpausing, or unpause
  now and accept a ~3–4 day runway.
- **The cron-job.org account state** — still worth confirming the three jobs
  are enabled, since they've had nothing to do for two weeks. `is_paused`
  explains the silence either way, so this is a check, not a blocker.
