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
  {
    id: "krypto2009",
    url: "/lore/krypto2009.png",
    caption: "krypto2009 — the mask worn in the flesh",
    keywords: ["krypto2009", "krypto 2009"],
  },
  {
    // Placeholder — image not yet dropped in public/lore/. Drop the file and
    // this entry goes live with no other changes needed.
    id: "kevin-rosa-goatfarm",
    url: "/lore/kevin-rosa-goatfarm.png",
    caption: "GOATFARM — Kevin Rosa's Troll Face Collection",
    keywords: ["kevin rosa", "goatfarm", "goat farm", "u mad bro", "slumpy kev"],
  },
  {
    id: "rolling-loud-art-basel-map",
    url: "/lore/trollingloud-maplocation.jpg",
    caption: "Rolling Loud × Destroy Lonely Art Basel Miami 2025 — event location",
    keywords: ["rolling loud", "art basel", "destroy lonely", "trollingloud"],
  },
  {
    id: "rolling-loud-art-basel-flyer",
    url: "/lore/rolling-loud-troll-announcement-flyer.jpg",
    caption: "Rolling Loud's Art Basel 2025 announcement flyer",
    keywords: ["rolling loud", "art basel", "destroy lonely", "announcement flyer"],
  },
  {
    id: "troll-weed-rolling-loud",
    url: "/lore/troll-weed-from-rolling-loud.jpg",
    caption: "the trollface weed packaging handed out at the Art Basel event",
    keywords: ["troll weed", "weed packaging", "adermaz0ne"],
  },
  {
    id: "troll-weed-dms",
    url: "/lore/troll-weed-dms.jpg",
    caption: "DMs with more on the trollface weed packaging",
    keywords: ["troll weed", "weed dms", "adermaz0ne"],
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
