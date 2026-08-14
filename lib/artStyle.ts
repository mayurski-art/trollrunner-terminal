// Prompt scaffold for transmission art (see supabase/migrations/014).
// Generated manually per post (currently in Grok) — paste the result's URL
// into terminal_posts.art_url. Keep the fixed part identical every time so
// the archive reads as one consistent set; only SUBJECT changes per post.
//
// Fixed style: blacklight embroidery / neon-thread stitch art. Pure black
// background, every contour built from short dashed stitches (not solid
// lines), no fill or shading — line only. 4-5 overlapping neon thread
// colors (orange, cyan, magenta, yellow, white) so crossings glow slightly.
// Mascot is the classic trollface, chibi/wireframe proportions.
//
// For clue-tagged posts: fold one concrete object or setting detail from
// the clue into the scene as the hint — something a close reader could
// connect back to the clue, not literal text and not the answer itself.
export function artPrompt(subject: string): string {
  return `blacklight embroidery thread art style, dashed neon stitched outline on pure black background, multicolor thread glow (orange/cyan/magenta/yellow/white), no fill, wireframe contour only, chibi trollface mascot, UV thread illustration. Subject: ${subject}`;
}
