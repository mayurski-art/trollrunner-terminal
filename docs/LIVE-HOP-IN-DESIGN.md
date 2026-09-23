# LIVE HOP-IN — talking to troublemakers as the terminal

```
 ██╗  ██╗ ██████╗ ██████╗       ██╗███╗   ██╗
 ██║  ██║██╔═══██╗██╔══██╗      ██║████╗  ██║
 ███████║██║   ██║██████╔╝█████╗██║██╔██╗ ██║
 ██╔══██║██║   ██║██╔═══╝ ╚════╝██║██║╚██╗██║
 ██║  ██║╚██████╔╝██║           ██║██║ ╚████║
 ╚═╝  ╚═╝ ╚═════╝ ╚═╝           ╚═╝╚═╝  ╚═══╝
   the persona keeps talking · you can take the wheel
```

Status: **all four phases shipped (2026-09-22)** — live on main. Verified with
two browsers at once against the real app: the owner typed into a visitor's
conversation and it arrived on the visitor's already-open page, rendered as
the terminal, with no reload and no economy side effects.

One optional step is outstanding: **migration 022 has not been run** on the
live database. Nothing is blocked by that — the insert retries without the
column, and that fallback is the path the tests actually exercised. Running it
adds the `from_owner` tag for telling your own lines from the model's when
re-reading a transcript later.

Prior docs: [`TERMINAL-V2-DESIGN.md`](TERMINAL-V2-DESIGN.md) (chat + PROBLEMS
economy), [`TERMINAL-V4-DESIGN.md`](TERMINAL-V4-DESIGN.md) (the archive).

---

## 0. What this is

The owner can see who is talking to the terminal right now, click a name,
watch that conversation stream live, and type messages into it. Those
messages land in the troublemaker's chat looking **exactly like the terminal's
own replies** — same styling, same `terminal>` label, no "operator" tag, no
tell. The AI persona keeps answering normally the whole time; hopping in is
additive, not a takeover.

### 0.1 Decisions locked

| # | Decision | Consequence |
|---|---|---|
| 1 | Owner messages appear **as the terminal**, indistinguishable | No new role, no new label. Insert `role: "terminal"` rows. |
| 2 | Roster + hop-in live **inside `[ speak to it ]`**, not a new page | `/inspect` is untouched by this work. |
| 3 | **Signed-in users only** | Matches reality — `POST /api/chat` already requires a Bearer token, so every chatter has a `user_id`. |
| 4 | The persona **keeps replying** while you're hopped in | Hop-in adds a voice; it does not pause the AI. |
| 5 | Near-zero marginal cost | Owner messages skip the LLM entirely — they cost nothing and must not touch the budget ledger. |

---

## 1. What already exists (measured against the code, 2026-09-22)

A surprising amount of this is already built, just in the wrong place and
read-only.

| Piece | Where | State |
|---|---|---|
| "Who's live" list | [`app/api/admin/live/route.ts`](../app/api/admin/live/route.ts) | **Works.** Polling, 3-min activity window. Returns `userId`/`username`/`liveChat`/`liveUndervoice`. |
| Read a user's transcript | [`app/api/admin/conversations/route.ts`](../app/api/admin/conversations/route.ts) | **Works.** Owner-gated, returns full `chatMessages`. |
| Owner gate | [`lib/admin.ts`](../lib/admin.ts) `requireOwner()` | **Works.** Bearer token → service client → username check. |
| Roster + transcript UI | [`components/Inspect.tsx`](../components/Inspect.tsx) | **Works, read-only.** 5s poll for the ● live dot; transcript loads once on click and never updates. |
| Owner detection client-side | [`components/Chat.tsx`](../components/Chat.tsx) `isOwner` | **Was broken, fixed in phase 3.** It sampled the session once on mount, so a session restored a moment later left `isOwner` false for the life of the page. Harmless while it only hid a provider label; it silently hid the whole roster. Subscribes to auth changes now. |

### 1.1 The four real gaps

1. **No write path.** Nothing can insert a `terminal` message that didn't come
   from the LLM.
2. **Transcripts don't stream.** `Inspect` fetches once per click. A live
   conversation would sit frozen.
3. **The troublemaker can't receive an injected message.** `Chat.tsx` only
   appends replies returned by its own `POST /api/chat` response. A row
   inserted out-of-band is invisible until a full page reload — so today,
   hopping in would produce a message nobody sees.
4. **The roster isn't in `[ speak to it ]`.** It only exists at `/inspect`.

Gap 3 is the one that's easy to miss and fatal if missed: **the write path is
useless without it.**

---

## 2. Architecture

### 2.1 Delivery: SSE, not polling and not Supabase Realtime

Three options were weighed against an explicit **egress** constraint.

**Supabase Realtime — rejected.** It would work, but it means a direct
client→Supabase websocket, enabling Realtime on the project, and (with
Postgres Changes) broadcasting `terminal_chat_messages` rows that carry
per-message cost and token columns. Decided against a Supabase-side transport
entirely.

**Fixed polling — rejected on cost.** Egress is measured on the wire, not the
body. An empty `{"messages":[]}` is ~18 bytes, but headers, TLS and HTTP/2
framing put a floor of ~300–600 bytes on every request. At 4s that is ~900
requests/hour/visitor — **~0.3–0.5 MB per visitor-hour to say "nothing
happened"** — plus two Supabase round trips per poll (`auth.getUser` then the
query). It also scales with open tabs, which is exactly the wrong axis.

**Decision: Server-Sent Events** from the app's own Vercel route.

Polling is expensive *because it asks repeatedly when nothing has happened*.
SSE inverts that: the visitor opens **one** connection and the server holds it,
sending only when a message actually exists. The wire stays silent while idle,
so idle egress is ~0 — better than a 60s poll on bytes while being
**sub-second** rather than up-to-60s on latency.

The cost does not vanish, it **moves**. The held-open route polls Postgres
internally (~2s) to notice new rows. That is a server-side database query, not
network egress — cheap, and off the axis that was the concern.

**Viability confirmed:** this repo already ships routes with
`maxDuration = 60` (`app/api/cron/route.ts`,
`app/api/admin/generate-transmission/route.ts`), so 60s functions are
available on the current plan. There is no `vercel.json` overriding it.

### 2.2 Message flow

```
  OWNER (in [ speak to it ])          TROUBLEMAKER (in [ speak to it ])
  ---------------------------        ---------------------------------
                                      on mount, opens ONE connection:
                                        GET /api/chat/stream  (SSE)
                                              |
                                      server holds it open, checking
                                      for new rows every ~2s.
                                      wire stays silent. ~0 bytes.
  picks a name from the roster                |
  types "i can see you, you know"             |
          |                                   |
          v                                   |
  POST /api/admin/say  ------------> inserts row:
   { userId, message }                 role: "terminal"
   requireOwner()                      content: "i can see you..."
                                       from_owner: true  (owner-only flag)
                                              |
                                      within ~2s the held connection
                                      notices it and pushes:
                                        data: {"messages":[...]}
                                              |
                                              v
                                      renders as a normal terminal>
                                      message. identical styling.

  at ~45s the server closes cleanly; the client reopens immediately.
```

### 2.3 The stream endpoint

`GET /api/chat/stream` — authenticated as the signed-in user, same bearer
pattern as `/api/chat`. Returns `text/event-stream`. It:

- resolves the user once, up front (not per tick)
- polls `terminal_chat_messages` for rows newer than a moving `after`
  timestamp, every `TICK_MS` (2000)
- emits `data: {"messages":[…]}` whenever that query is non-empty, advancing
  `after` past what it sent
- emits a comment heartbeat (`: ping`) every ~15s so proxies don't kill an
  idle connection
- closes cleanly at `STREAM_MS` (45000), under the 60s function ceiling
- selects only display columns — never `from_owner`, cost, or token fields

`GET /api/chat` is untouched and still does the initial history load. The
stream only carries what arrives *after* the page is open.

**Reconnect:** `EventSource` reconnects on its own, but it cannot send an
`Authorization` header. Two workable shapes — a short-lived token in the query
string, or a `fetch()`-based reader over `ReadableStream` which *can* set
headers and gives explicit reconnect control. **Use the `fetch` reader**: it
keeps auth on the header like every other call in this app, and the reconnect
loop is a few lines. Back off on repeated failures so a down deploy doesn't
spin.

---

## 3. Data model

**No migration is strictly required.** The feature works entirely on existing
tables.

One **optional** column is worth adding:

```sql
-- supabase/migrations/0NN_owner_injected_messages.sql
alter table terminal_chat_messages
  add column if not exists from_owner boolean not null default false;
```

`from_owner` is never sent to the troublemaker's client. Its purposes:

- Lets `/inspect` and the owner's own hop-in view mark which lines you wrote,
  so you can tell your voice from the model's when re-reading later.
- Lets the persona's history builder know a line was human-written, if that
  ever matters for context.
- Makes owner messages auditable and reversible.

Following the established pattern from `provider` (migration 019, see
`app/api/chat/route.ts` lines 477–492), **the insert must retry without the
column if it doesn't exist**, so the feature ships and works before the
migration is run.

### 3.1 What owner messages must NOT do

An owner message is not an AI turn. It must not:

- touch `terminal_config.chat_messages_today` (the shared daily cap)
- call `recordSpend()` or `checkAndReserveSpend()` — it costs nothing
- mine PROBLEMS, advance `qualifying_count`, or change `friendship_score`
- unlock archive sections
- count against the troublemaker's `messages_today`

It is one row insert and nothing else. Every counter in `POST /api/chat` is
deliberately skipped.

---

## 4. Build plan

Four phases, each shippable and mergeable on its own.

### Phase 1 — the troublemaker can receive injected messages

**This must be first.** Without it every later phase is invisible.

- **New:** `app/api/chat/stream/route.ts` — the SSE endpoint described in
  §2.3. `runtime = "nodejs"`, `maxDuration = 60`, closing itself at 45s.
- **New:** a small client transport module (the `fetch` + `ReadableStream`
  reader and its reconnect loop), kept separate from `Chat.tsx` so the
  transport can be swapped without touching chat logic.
- **Changed:** `components/Chat.tsx` — open the stream on mount when a session
  exists; close it on unmount and while the tab is hidden, reopening on
  `visibilitychange`. Append arriving messages, **deduping by `created_at` +
  content**, since the client already optimistically appends its own turns and
  the stream will also carry them.
- **Test:** insert a `terminal` row by hand in the Supabase SQL editor for a
  logged-in test user; it should appear in their open chat within ~2s, with no
  reload.

Shipping Phase 1 alone changes nothing visible — it's plumbing.

### Phase 2 — the write path

- **New:** `app/api/admin/say/route.ts` — `POST { userId, message }`,
  `requireOwner()` gated. Validates non-empty, ≤ `MAX_MESSAGE_LENGTH` (1000,
  same as chat). Inserts one `role: "terminal"` row with `from_owner: true`,
  retrying without `from_owner` on a PGRST204-style column error. Returns the
  inserted row.
- **Test:** curl it as the owner, confirm the row lands and Phase 1 delivers
  it live.

### Phase 3 — the roster inside `[ speak to it ]`

- **Changed:** `components/Chat.tsx` — when `isOwner`, render a roster strip.
  Reuses `GET /api/admin/live` (already built, already polling-shaped) on the
  existing 5s cadence. Shows username + ● for live.
- Clicking a name puts the panel into **hop-in mode**: the transcript area
  swaps from the owner's own conversation to that user's, loaded from
  `GET /api/admin/conversations?userId=…` (already built) and kept fresh by
  its own 4s poll. A clear `[ back ]` control returns to the owner's own chat.

  **This view polls rather than streaming**, unlike the visitor side.
  `/api/chat/stream` is deliberately scoped to the caller's own `user_id` — it
  must never become a way to read someone else's messages — and this is a
  single owner screen rather than every visitor, so the egress argument that
  chose SSE (§2.1) does not apply.
- The owner's own conversation state is preserved, not discarded, while
  hopped in.

**Layout note:** `[ speak to it ]` is height-locked on desktop
(`lg:h-[34rem]`) and already portals its status and controls rows out to a
separate Frame (`statusPortalEl` / `controlsPortalEl` in `app/page.tsx`)
precisely because vertical space there is scarce. The roster must therefore
be collapsible and default to collapsed — a persistent list of names would
eat the transcript. A single line like `[ 3 live ▸ ]` that expands on click
is the right footprint.

### Phase 4 — sending while hopped in

- **Changed:** `components/Chat.tsx` — in hop-in mode the existing input box
  posts to `/api/admin/say` with the selected `userId` instead of
  `/api/chat`. The placeholder changes (`speak as the terminal to <name>_`)
  and the send button gets a distinct accent, so you can never mistake which
  mode you're typing into.
- The sent message appends to the hop-in transcript immediately, same
  optimistic pattern as normal chat.

**Safety:** mistaking hop-in mode for your own chat would send a private
thought to a stranger as the terminal. The mode indicator must be
unmissable — a colored border on the input row, not just placeholder text.

---

## 5. Things that could go wrong

| Risk | Mitigation |
|---|---|
| Owner sends to the wrong person | Selected username rendered directly above the input in hop-in mode; distinct input border; explicit `[ back ]`. |
| Egress cost | The whole reason for SSE (§2.1). Idle wire is silent; one reconnect per 45s. Stream closed while the tab is hidden. |
| Function duration ceiling | Stream self-closes at 45s against a 60s limit, then the client reopens. Never relies on being killed. |
| Connections held open by abandoned tabs | Closed on `visibilitychange` when hidden, and on unmount. A backgrounded tab holds nothing. |
| Injected message races the AI's reply | Both are plain rows ordered by `created_at`; the transcript sorts by it. Interleaving is fine and reads naturally. |
| Troublemaker's client double-renders | Dedupe on `created_at` + content — the stream carries the user's own turns too, which the client already appended optimistically. |
| Reconnect storm on a bad deploy | Exponential backoff in the reconnect loop. |
| `from_owner` migration not run | Insert retries without it (§3), exactly as `provider` does today. |
| Someone finds `/api/admin/say` | `requireOwner()` — same gate as every other admin route. Username check against `OWNER_USERNAME`. |

---

## 6. Out of scope

- Guest (signed-out) visitors in the roster — they can't chat today anyway.
- Hopping into **Undervoice** sessions. Different table, different flow.
  Possible later; the roster already knows who has one open.
- Typing indicators ("the terminal is typing…") for hop-in messages.
- Editing or deleting a message after you've sent it.
- Any change to `/inspect`.

---

## 7. Separately: `[ top miners ]` live refresh

Unrelated to hop-in, asked at the same time. The vault ladder
(`app/vault/page.tsx`) currently refetches on mount, on `visibilitychange`,
and on window `focus` — so it is fresh whenever you return to the tab, but
frozen while you sit and watch it.

**Change:** add a periodic refresh (~12s) to the existing `load()` effect,
gated on the tab being visible so a backgrounded vault doesn't poll forever.
Roughly four lines; no migration, no new endpoint.

**Why this one polls and hop-in doesn't.** The ladder is a *snapshot* — it
only needs to be roughly current, nobody is waiting on a specific event, and
the payload is ten rows the page already fetches anyway. Hop-in is the
opposite: a specific message, at an unpredictable moment, where latency is the
whole point. Polling suits the first and is wasteful for the second.
