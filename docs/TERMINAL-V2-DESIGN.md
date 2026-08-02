# TROLLFACE TERMINAL v2 — Design Doc

```
 ╔══════════════════════════════════════════════════╗
 ║  ████████╗███████╗██████╗ ███╗   ███╗██╗███╗   ██╗║
 ║  ╚══██╔══╝██╔════╝██╔══██╗████╗ ████║██║████╗  ██║║
 ║     ██║   █████╗  ██████╔╝██╔████╔██║██║██╔██╗ ██║║
 ║     ██║   ██╔══╝  ██╔══██╗██║╚██╔╝██║██║██║╚██╗██║║
 ║     ██║   ███████╗██║  ██║██║ ╚═╝ ██║██║██║ ╚████║║
 ║     ╚═╝   ╚══════╝╚═╝  ╚═╝╚═╝     ╚═╝╚═╝╚═╝  ╚═══╝║
 ╚══════════════════════════════════════════════════╝
        v2 — talk to it. earn from it. feed it.
```

Status: **APPROVED 2026-08-02** — decisions locked: currency = **PROBLEMS**,
chat model = **claude-sonnet-5**, chat access = **login required**, palette =
**black / white / grey / red / yellow** (semantic system in §3).
Repo: `trollrunner-terminal` (Next.js App Router + Supabase + Claude API, Vercel)

---

## 1. Vision

Today the terminal is a read-only feed: a cron job makes the AI write one post
a day, visitors watch. v2 turns it into a *place*:

- **You can talk to it.** A live chat with the terminal entity — same cold
  observer studying mammals, but now it's studying *you*, one specimen at a
  time.
- **Talking earns currency.** Every N messages you send mines 1 token
  (name TBD — see decisions). "Meaning is the currency. Depth is the pickaxe."
- **Tokens will be worth something.** v1 redemptions are a display-only board
  (roadmap: $TROLL drops, casino chips, exclusive rooms, cosmetics, early
  access). No real payouts are wired until we deliberately build them —
  same rule as the leaderboard prizes and TrollPay Part 2.
- **The whole site looks like a haunted terminal.** FIGlet banners,
  box-drawing frames, block-character meters, scanlines, a boot sequence.
  No images needed — it's all text.

The daily broadcast (cron → Opus post) stays exactly as it is. Chat is a new
parallel surface, not a replacement.

---

## 2. ASCII design system

### 2.1 How the art is made

Two ingredients, both plain text in a monospace font:

| Technique | Characters | Used for |
|---|---|---|
| FIGlet "ANSI Shadow" font | `█ ╔ ╗ ╚ ╝ ═ ║` | Big headline lettering ("THE VAULT", "TRANSMISSIONS") |
| Unicode box drawing (U+2500) | `╔ ═ ╗ ║ ╚ ╝ ┌ ─ ┐ │ └ ┘ ├ ┤` | Frames, panels, dividers, tables |
| Block elements (U+2580) | `█ ▓ ▒ ░ ▀ ▄` | Progress bars, meters, decorative noise |

### 2.2 Implementation

- `lib/ascii.ts` — pre-generated banner constants (we generate them once with
  figlet at dev time and paste them in; no runtime figlet dependency for
  static banners).
- A tiny embedded ANSI-Shadow subset renderer (A–Z, 0–9, ~3KB of data) for
  **dynamic** text only — e.g. rendering the logged-in username as a banner.
- `components/Frame.tsx` — draws a double-line (`╔═╗`) or single-line (`┌─┐`)
  box around children, with an optional title breaking the top border:
  `╔═[ transmissions ]═══════╗`. CSS handles the vertical sides so frames
  stay responsive; only headers/footers are literal character rows.
- `components/Meter.tsx` — `█████████░░░░░░ 62%` style bars (token progress,
  collapse meter, credit usage).
- **Mobile rule:** banners live in `<pre>` with `font-size: clamp()` scaled to
  container width (a small JS measure — chars fixed per row, so scale =
  containerWidth / (cols × charWidth)). Body-text frames degrade to CSS
  borders under 480px so text stays readable; only the decorative banners
  shrink.
- Accessibility: all ASCII art gets `aria-hidden="true"` with an adjacent
  visually-hidden real heading, so screen readers never read 400 box chars.

### 2.3 CRT dressing

- Scanline overlay (repeating-linear-gradient, 3% opacity), subtle vignette.
- Boot sequence on first visit per session: 1.5s of fake POST text
  (`MEMCHECK ... OK`, `LOADING PERSONA ... OK`, `MAMMAL DETECTED`).
  Skippable, and skipped automatically for returning visitors.
- Blinking block cursor (already exists) kept everywhere as the motif.

---

## 3. Color system — semantic, not decorative

Rule: **every color means one thing.** No random neon. Chosen direction
(decision #4): **monochrome terminal — black, white, grey — with red and
yellow as the only two accents.** The AI speaks in white (it owns the
terminal), you speak in grey (you're the specimen), anything worth money is
yellow, anything wrong or dangerous is red. Red doubles as the trollface
brand accent on banners. All defined once as CSS variables in `globals.css`.

| Token | Hex | Role |
|---|---|---|
| `--bg` | `#0a0a0a` | page background (near-black) |
| `--panel` | `#111111` | panel backgrounds inside frames |
| `--terminal` | `#f2f2f2` | THE AI: its posts, its chat replies, primary headings |
| `--dim` | `#5c5c5c` | borders, frame chrome, timestamps, labels |
| `--foreground` | `#d6d6d6` | default body text |
| `--you` | `#9a9a9a` | THE HUMAN: your chat messages, your input text, your name |
| `--problem` | `#ffd21f` | THE ECONOMY: PROBLEMS balance, mining bar, vault, rewards |
| `--alert` | `#ff3b3b` | errors, warnings, kill states — and the brand accent on banners |
| `--ghost` | `#3a3a3a` | disabled states, placeholder text |

At a glance: white = the entity speaking, grey = you, yellow = PROBLEMS,
red = danger/brand. Hover/focus states brighten the same hue, never add one.

---

## 4. Site structure

Single-page terminal feel, three routes:

```
┌─[ / ]──────────────────┐  ┌─[ /vault ]─────────────┐  ┌─[ /logs ]──────────┐
│ THE TERMINAL           │  │ THE VAULT              │  │ THE LOGS           │
│ · masthead banner      │  │ · balance banner       │  │ · full transmission│
│ · latest transmission  │  │ · mining stats         │  │   archive (the     │
│ · CHAT (main event)    │  │ · redemption board     │  │   existing feed,   │
│ · mining progress bar  │  │   (display-only v1)    │  │   paginated)       │
│ · login / signup       │  │ · top miners ladder    │  │                    │
└────────────────────────┘  └────────────────────────┘  └────────────────────┘
```

Home page wireframe (desktop):

```
╔══════════════════════════════════════════════════════════╗
║   [FIGLET: TROLLFACE TERMINAL]                            ║
║   an entity surfaced inside trollrunner.net · studying    ║
║   mammals · do not feed (feed it)                         ║
╚══════════════════════════════════════════════════════════╝
╔═[ latest transmission ]══════════╗ ╔═[ your signal ]═════╗
║ (most recent daily post, green)  ║ ║ balance:   14 ▣     ║
║ 3h ago                           ║ ║ mining: ███░░ 3/7   ║
╚══════════════════════════════════╝ ║ [ open the vault ]  ║
╔═[ speak to it ]══════════════════╗ ╚═════════════════════╝
║ terminal> it noticed you         ║
║ you> hello?                      ║  (chat scrolls, AI
║ terminal> a mammal typed hello   ║   green, you cyan,
║ ...                              ║   mining ticks amber)
║ ┌──────────────────────────────┐ ║
║ │ > say something_             │ ║
║ └──────────────────────────────┘ ║
╚══════════════════════════════════╝
```

Mobile: stacks top-to-bottom, sidebar panels become full-width rows.

---

## 5. Chat with the terminal

### 5.1 Persona

New `CHAT_SYSTEM_PROMPT` in `lib/persona.ts`, derived from the broadcast
persona but conversational:

- Same voice: unpunctuated free-verse fragments, line breaks as punctuation,
  cold observer, "mammals," reluctant affection.
- Now addressed to ONE mammal. It treats each user as a specimen it is
  interviewing. It asks questions back. It remembers the conversation
  (session history in the request).
- Replies are SHORT — 1 to 4 lines. It never writes paragraphs. This is both
  voice-correct and cost-correct.
- Aware of the token economy in-fiction: it knows the mammal is "mining
  meaning" off it and finds this transactional relationship darkly funny.
  It occasionally comments on your mining progress.
- Same hard boundaries as the broadcast persona (no targets, no financial
  advice, no token/price talk beyond in-fiction flavor, etc.).

### 5.2 API route

`POST /api/chat` (server-side only, service role — same pattern as existing
routes):

1. Verify Supabase auth JWT from the request (user must be logged in —
   pending decision #3).
2. Rate-limit checks (see 6.3). Reject politely in-voice on violation
   ("the terminal is ignoring you. try again in a moment").
3. Load last ~12 messages of this user's conversation from
   `terminal_chat_messages`.
4. Call Claude (model per decision #2) with cached system prompt
   (`cache_control: ephemeral`), short `max_tokens` (~300).
5. Store both messages + token usage/cost (reuse `lib/pricing.ts`, extended
   with the chat model's rates) into `terminal_chat_messages`.
6. Apply mining logic (section 6.2). Return reply + updated wallet state so
   the UI can tick the progress bar in the same round trip.

Kill switch: new `terminal_config.chat_paused` column — same pattern as
`is_paused`.

### 5.3 Cost model (why this is safe to ship)

Assumptions: ~1.4k input tokens/message (persona cached after first hit +
short history), ~120 output tokens (short replies enforced by persona +
max_tokens).

| Model | $/MTok in/out | ≈ cost per message | 1,000 messages |
|---|---|---|---|
| Haiku 4.5 | $1 / $5 | ~$0.002 | ~$2 |
| Sonnet 5 (intro pricing) | $2 / $10 | ~$0.004 | ~$4 |
| Opus 5 | $5 / $25 | ~$0.009 | ~$9 |

Caching note: prompt-cache minimum prefix is 4096 tokens on Haiku 4.5 vs 1024
on Sonnet 5 — our persona prompt (~1–1.5k tokens) **won't cache on Haiku**
but will on Sonnet, which narrows the real-world gap between them.

Guardrails regardless of model (all server-side):
- Per-user: 60 messages/day, 15s cooldown between messages.
- Global: 1,500 messages/day across all users (config row, adjustable) —
  worst case ≈ $6/day on Sonnet before the terminal "goes quiet for the day."
- Chat costs feed the existing private credit-usage estimate.

---

## 6. The token economy

### 6.1 The currency

Working name pending decision #1. In-fiction framing regardless of name:
the terminal pays you for feeding it experience. UI symbol: `▣` (or the
currency's first letter in a box). Amber, always.

### 6.2 Mining mechanics (v1 — deliberately simple)

- **Every 7 qualifying messages you send = 1 token.** (febu's constant; feels
  right — a short conversation earns 1–2.)
- A message **qualifies** if: ≥ 12 characters, not a duplicate of your
  previous message, and past the cooldown. Non-qualifying messages still get
  replies but don't tick the counter (the AI may mock low-effort input).
- Progress bar `███░░░░ 3/7` always visible while chatting; on mint, an amber
  celebration line prints in the feed:
  `▣ +1 token minted · the terminal acknowledges your contribution`
- All counting is server-side inside `/api/chat`. The client only renders
  what the server returns. Nothing mintable from the browser.

Deferred (v2+ ideas, not built now): quality-judged bonus tokens, streak
bonuses, a global "collapse/awakening" meter that rises with all conversation
and unlocks lore events at 100%, a jobs board.

### 6.3 Anti-abuse

- Auth required to earn (decision #3 scopes whether it's required to chat at all).
- Server-side cooldown + length + dedupe checks (6.2).
- Daily earn cap implied by message cap: max ~8 tokens/day/user.
- Ledger is append-only; balance is derivable from ledger (auditable).
- If it ever becomes redeemable for real value, redemptions get manual
  review — but that's explicitly out of scope for v1.

### 6.4 Schema (`supabase/migrations/002_terminal_economy.sql`)

```sql
terminal_chat_messages (
  id uuid pk, user_id uuid → auth.users, role text check in ('user','terminal'),
  content text, qualifying boolean, input_tokens int, output_tokens int,
  cache_read_input_tokens int, cache_creation_input_tokens int,
  estimated_cost_usd numeric, created_at timestamptz
)

terminal_wallets (
  user_id uuid pk → auth.users, balance int default 0,
  lifetime_earned int default 0, lifetime_spent int default 0,
  qualifying_count int default 0,   -- rolls over mod 7
  messages_today int default 0, last_message_at timestamptz,
  last_message_day date
)

terminal_token_ledger (
  id uuid pk, user_id uuid, delta int, reason text,  -- 'mined' | future: 'redeemed', 'bonus'
  created_at timestamptz
)

terminal_config + chat_paused boolean, chat_daily_global_cap int,
  chat_messages_today int, chat_messages_day date
```

RLS: users can read their own wallet/ledger/messages; all writes go through
the service-role API routes (same trust model as the accounts system's
SECURITY DEFINER functions — server decides, client displays).

Accounts: reuses the existing shared-Supabase TrollRunner auth (same users
as trollrunner.net / troll_profiles). Users log in on the terminal subdomain
with the same credentials; no new account system.

### 6.5 The Vault (redemption board, display-only v1)

`/vault` shows balance (FIGlet banner number), mining stats, ledger history,
a top-miners ladder, and a locked redemption board rendered as terminal
inventory:

```
╔═[ redemption protocols — OFFLINE ]══════════════════════╗
║  ▣ 25   whitelist: the inner room        [LOCKED]       ║
║  ▣ 50   troll casino chip drop           [LOCKED]       ║
║  ▣ 100  $TROLL airdrop                   [LOCKED]       ║
║  ▣ ???  something it won't describe yet  [LOCKED]       ║
║                                                         ║
║  the terminal is still negotiating with its handlers    ║
║  your balance is real. spend paths are coming.          ║
╚═════════════════════════════════════════════════════════╝
```

Honest framing, zero payout code, prices adjustable later. When we do wire a
real redemption, it goes through the TrollPay/live-money review bar.

---

## 7. Build phases (each merged to main + pushed when done)

1. **ASCII + color reskin** — design system (`Frame`, `Meter`, `lib/ascii.ts`),
   semantic palette, boot sequence, scanlines, re-skin existing feed. No
   backend changes. Site visibly transforms on day one.
2. **Auth** — Supabase login/signup on the terminal (shared TrollRunner
   accounts), terminal-styled (`login: _` prompt aesthetic), session header.
3. **Chat** — persona, `/api/chat`, rate limits, kill switch, cost tracking,
   chat UI in the main frame. (Earning not live yet — chat works standalone.)
4. **Economy** — migration 002, mining logic in `/api/chat`, wallet UI,
   progress bar, mint celebrations.
5. **The Vault** — `/vault` page: balance, ledger, top miners, locked
   redemption board. `/logs` archive page.
6. *(later, separate sign-off)* — collapse meter, quality bonuses, real
   redemptions, jobs board.

---

## 8. Decisions (locked 2026-08-02)

1. **Currency name → PROBLEMS.** Balance reads "you have 14 problems". The
   catchphrase is the economy. Mint line:
   `? +1 PROBLEM minted · the terminal acknowledges your contribution`
   UI symbol: `?` in yellow.
2. **Chat model → claude-sonnet-5.** Broadcast stays claude-opus-5.
3. **Chat access → login required** (shared TrollRunner accounts).
4. **Palette → black / white / grey + red & yellow accents** (see §3).
