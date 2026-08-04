// A small static image library the persona can hand back in chat when a
// troublemaker asks about something it has a picture for. New images: drop
// the file in public/lore/ and add an entry here — no migration needed.
export type LoreAsset = {
  id: string;
  url: string;
  caption: string;
  keywords: string[];
};

export const LORE_ASSETS: LoreAsset[] = [
  {
    id: "simpson-troll-lore",
    url: "/lore/simpson-troll-lore.png",
    caption: "the community theory image — “P.S., I Hate You”",
    keywords: [
      "simpson",
      "simpsons",
      "troll doll",
      "trolldoll",
      "ps i hate you",
      "p.s. i hate you",
      "p.s., i hate you",
    ],
  },
];

// Case-insensitive substring match against the user's message. First hit
// wins — the library is small enough that ordering doubles as priority.
export function matchLoreAsset(message: string): LoreAsset | null {
  const normalized = message.toLowerCase();
  for (const asset of LORE_ASSETS) {
    if (asset.keywords.some((k) => normalized.includes(k))) {
      return asset;
    }
  }
  return null;
}
