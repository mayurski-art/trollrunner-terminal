<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Every lore article ships with its images

No `## N.` section of `docs/TROLL-LORE.md` is committed without its images.
That means every one of these the story has:

- Every photo, screenshot or chart attached to a post the article cites.
  Download it from the post's media URL (fxtwitter's JSON has it).
- Every image the operator sends in chat for the story. If it can't be
  saved from chat, capture the same thing yourself, e.g. by opening the
  page and screenshotting it. If that isn't possible, ask the operator to
  drop the file in `public/lore/` before committing.
- Screenshots of the key evidence the article leans on: the board, profile,
  holder list, chart or explorer page behind the main numbers.

Put each file in `public/lore/`, add an entry for it in `lib/loreAssets.ts`
(caption, keywords, `sections: [N]`), and list every image id in the
section's **Sourcing** "Images:" line. Crop screenshots to the part that
matters, and don't capture anything that shows the operator's own account
or wallet.

# After publishing a lore article: hand over a tweet

Whenever a new `## N.` section of `docs/TROLL-LORE.md` (a trolltruths.com
article) is committed, end the turn with a ready-to-post tweet for it, without
being asked. Put it in a plain code block so it copies cleanly. Follow this
shape:

```
trolltruths.com/<N>

October 25, 2026

> 1:30 PM PST: @handle does the thing, with the "short quote" kept.
> 2:30 PM PST: next event, with numbers and SOL/$ amounts in.

October 26, 2026

> 8:00 AM PST: a new date line whenever the timeline crosses a day.

The image. What's in the picture and what its symbols point to: the
references, puns and visual jokes, and what they say about trolling (who's
the troll, who's getting trolled, what the troll is mocking).

Why it's a troll. Two or three punchy sentences.
```

- One `>` line per event, in time order. Keep each to a line or two.
- Write Pacific times as "PST", the way the operator does.
- Include "The image." whenever the story has art or screenshots, @Troll_
  posts above all. Skip it when there's nothing visual to read.
- Don't state anything the article marks as unverified or interpretation as
  fact. A short "reads as" or "likely" is enough.
