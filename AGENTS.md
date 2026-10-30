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
