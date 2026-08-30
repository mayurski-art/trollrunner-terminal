// A small static media library the persona can hand back in chat when a
// troublemaker asks about something it has a picture (or clip) for. New
// images: drop the file in public/lore/ and add an entry here — no
// migration needed. New videos: too large for the git repo — upload to the
// `lore` bucket in the shared Supabase project instead (same project
// lib/avatar.ts already uses for avatars) and use the resulting public URL
// here.
export type LoreAsset = {
  id: string;
  url: string;
  caption: string;
  keywords: string[];
  // The TROLL-LORE.md section number(s) this asset actually illustrates.
  // findLoreImagesForArchiveSection (below) looks assets up by this field
  // directly — no keyword matching — because keyword-matching a whole
  // section's prose picked up assets a section only mentioned in passing
  // (a "same pattern as §37/§38" aside pulled in Limp Bizkit and Beeple
  // images) while dropping assets that should have matched (§43's own
  // Crash image lost a tiebreak to an unrelated "u mad bro" pool-float
  // asset). matchLoreAsset (the chat path, scored against a single short
  // user message) doesn't have this problem at the same scale and still
  // uses keywords.
  sections: number[];
};

const VIDEO_EXTENSIONS = [".mp4", ".webm", ".mov"];
export function isVideoAsset(url: string): boolean {
  const path = url.split("?")[0].toLowerCase();
  return VIDEO_EXTENSIONS.some((ext) => path.endsWith(ext));
}

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
    sections: [24],
  },
  {
    id: "krypto2009",
    url: "/lore/krypto2009.png",
    caption: "krypto2009 — the mask worn in the flesh",
    keywords: ["krypto2009", "krypto 2009"],
    sections: [30],
  },
  {
    id: "krypto2009-mask-worn",
    url: "/lore/krypto2009-mask-worn.jpg",
    caption: "krypto2009 in the mask, rosary and MAD? cap, in a theater seat",
    keywords: ["krypto2009", "krypto 2009", "mad cap", "krypto mask"],
    sections: [30],
  },
  {
    id: "goatfarm-troll-belt-slippers",
    url: "/lore/goatfarm-troll-1.jpeg",
    caption: "GOATFARM's Trollface belt buckle and slippers",
    keywords: ["kevin rosa", "goatfarm", "goat farm", "slumpy kev", "troll belt", "troll slippers"],
    sections: [31],
  },
  {
    id: "goatfarm-troll-campaign",
    url: "/lore/goatfarm-troll-2.jpeg",
    caption: "the GOATFARM x Trollface campaign shoot — \"U MAD BRO\" longsleeve and the Trollface pillow",
    keywords: ["u mad bro", "goatfarm campaign", "goatfarm shoot", "goatfarm photoshoot"],
    sections: [31],
  },
  {
    id: "goatfarm-troll-snack-table",
    url: "/lore/goatfarm-troll-3.jpeg",
    caption: "behind the scenes at the GOATFARM x Trollface shoot — the snack table",
    keywords: ["goatfarm snacks", "goatfarm bts", "goatfarm behind the scenes"],
    sections: [31],
  },
  {
    id: "goatfarm-troll-rosary-bracelet",
    url: "/lore/goatfarm-troll-4.jpeg",
    caption: "GOATFARM's Trollface rosary and bracelet",
    keywords: ["troll rosary", "troll bracelet", "goatfarm jewelry", "goatfarm jewellery"],
    sections: [31],
  },
  {
    id: "rolling-loud-art-basel-map",
    url: "/lore/trollingloud-maplocation.jpg",
    caption: "Rolling Loud × Destroy Lonely Art Basel Miami 2025 — event location",
    keywords: ["rolling loud", "art basel", "destroy lonely", "trollingloud"],
    sections: [32],
  },
  {
    id: "rolling-loud-art-basel-flyer",
    url: "/lore/rolling-loud-troll-announcement-flyer.jpg",
    caption: "Rolling Loud's Art Basel 2025 announcement flyer",
    keywords: ["rolling loud", "art basel", "destroy lonely", "announcement flyer"],
    sections: [32],
  },
  {
    id: "troll-weed-rolling-loud",
    url: "/lore/troll-weed-from-rolling-loud.jpg",
    caption: "the trollface weed packaging handed out at the Art Basel event",
    keywords: ["troll weed", "weed packaging", "adermaz0ne"],
    sections: [32],
  },
  {
    id: "troll-weed-dms",
    url: "/lore/troll-weed-dms.jpg",
    caption: "DMs with more on the trollface weed packaging",
    keywords: ["troll weed", "weed dms", "adermaz0ne"],
    sections: [32],
  },
  {
    id: "killmigi-art-basel",
    url: "/lore/killmigi-art-basel.jpg",
    caption: "killmigi's Rolling Loud Art Basel piece — Trollface at the decks",
    keywords: ["killmigi", "kill migi", "dj art", "art basel art"],
    sections: [44],
  },
  {
    id: "killmigi-art-basel-2",
    url: "/lore/killmigi-art-basel-2.jpg",
    caption: "killmigi's second Art Basel piece — Trollface on the mic under the $TROLL stage backdrop",
    keywords: ["killmigi", "kill migi", "stage art", "mic art", "art basel stage"],
    sections: [44],
  },
  {
    id: "rolling-loud-art-basel-clip",
    url: "https://tjsyhfplxjtakdfkpdtg.supabase.co/storage/v1/object/sign/lore/trollingloudclip1.mp4?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV83MTJlYmRmOC03MTFiLTQ1NTAtOGFhYy04ZGI3ZmMxNzEyYTQiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJsb3JlL3Ryb2xsaW5nbG91ZGNsaXAxLm1wNCIsInNjb3BlIjoiZG93bmxvYWQiLCJpYXQiOjE3ODY2MzE2ODAsImV4cCI6MzE1NTM4NjYzMTY4MH0.mMEkFDR9Yu0ltY2T6nxV_6_H3JJW_PtKgCiuGfRL8yg",
    caption: "video from Rolling Loud × Destroy Lonely Art Basel Miami 2025",
    keywords: ["rolling loud clip", "art basel video", "art basel clip", "trollingloud clip"],
    sections: [32],
  },
  {
    id: "rolling-loud-art-basel-clip-2",
    url: "https://tjsyhfplxjtakdfkpdtg.supabase.co/storage/v1/object/sign/lore/trollingloudclip2.mp4?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV83MTJlYmRmOC03MTFiLTQ1NTAtOGFhYy04ZGI3ZmMxNzEyYTQiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJsb3JlL3Ryb2xsaW5nbG91ZGNsaXAyLm1wNCIsInNjb3BlIjoiZG93bmxvYWQiLCJpYXQiOjE3ODY2MzIwNDYsImV4cCI6MzE3MTQ2NjMyMDQ2fQ.p2mCFyltJ6EJAoa_IEI6_tedivwn0RU4C5CfZeCRpfw",
    caption: "a second video from Rolling Loud × Destroy Lonely Art Basel Miami 2025",
    keywords: ["rolling loud clip 2", "art basel video 2", "art basel clip 2", "trollingloud clip 2", "another clip"],
    sections: [32],
  },
  {
    id: "rolling-loud-art-basel-clip-3",
    url: "https://tjsyhfplxjtakdfkpdtg.supabase.co/storage/v1/object/sign/lore/trollingloudclip3.mp4?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV83MTJlYmRmOC03MTFiLTQ1NTAtOGFhYy04ZGI3ZmMxNzEyYTQiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJsb3JlL3Ryb2xsaW5nbG91ZGNsaXAzLm1wNCIsInNjb3BlIjoiZG93bmxvYWQiLCJpYXQiOjE3ODY2MzI1MDUsImV4cCI6MzE3MTQ2NjMyNTA1fQ.W5seBr2pncz8G_S_YjKE4D8tvodbrOQq7byFiVdrPgs",
    caption: "a third video from Rolling Loud × Destroy Lonely Art Basel Miami 2025",
    keywords: ["rolling loud clip 3", "art basel video 3", "art basel clip 3", "trollingloud clip 3", "third clip"],
    sections: [32],
  },
  {
    id: "trollsummer-beach-shoreline",
    url: "/lore/trollsummer-beach-shoreline.jpeg",
    caption: "troll summer — kneeling at the shoreline, beads and a watch, waves coming in",
    keywords: ["troll summer", "trollsummer", "beach shoreline", "beach 1"],
    sections: [34],
  },
  {
    id: "trollsummer-beach-car-selfie",
    url: "/lore/trollsummer-beach-car-selfie.jpeg",
    caption: "troll summer — post-beach, red-lens shades pushed up, salt still drying",
    keywords: ["troll summer", "trollsummer", "car selfie", "red sunglasses", "beach 2"],
    sections: [34],
  },
  {
    id: "trollsummer-beach-sand-drawing",
    url: "/lore/trollsummer-beach-sand-drawing.jpeg",
    caption: "troll summer — a figure scratched into wet sand at the waterline, gone with the next wave",
    keywords: ["troll summer", "trollsummer", "sand drawing", "sand art", "beach 3"],
    sections: [34],
  },
  {
    id: "trollsummer-beach-picnic",
    url: "/lore/trollsummer-beach-picnic.jpeg",
    caption: "troll summer — a paper plate of hoagies, potato salad, and Doritos on the sand",
    keywords: ["troll summer", "trollsummer", "beach picnic", "doritos", "hoagie", "beach 4"],
    sections: [34],
  },
  {
    id: "trollsummer-beach-sticker-pole",
    url: "/lore/trollsummer-beach-sticker-pole.jpeg",
    caption: "troll summer — a trollrunner.net sticker dropped on a boardwalk pole, palm trees behind it",
    keywords: ["troll summer", "trollsummer", "sticker pole", "boardwalk sticker", "beach 5", "sticker drop"],
    sections: [34],
  },
  {
    id: "troll-summer-pool-float",
    url: "/lore/troll-summer-pool-float.jpg",
    caption: "official troll summer art — Trollface floating on a \"U MAD BRO?\" ring with a cocktail",
    keywords: ["troll summer", "trollsummer", "pool float", "u mad bro", "poolside", "cocktail"],
    sections: [35],
  },
  {
    id: "troll-summer-stay-salty",
    url: "/lore/troll-summer-stay-salty.jpg",
    caption: "official troll summer art — Trollface on a beach lounger, seashells over the eyes reading \"STAY SALTY\"",
    keywords: ["troll summer", "trollsummer", "stay salty", "seashells", "beach lounger"],
    sections: [35],
  },
  {
    id: "limp-bizkit-umadbro-1",
    url: "/lore/limp-bizkit-umadbro-1.jpg",
    caption: "Limp Bizkit in full \"U MAD BRO?\" trollface merch, one jacket carrying the GOATFARM print",
    keywords: ["limp bizkit", "u mad bro", "limp bizkit merch", "goatfarm jacket"],
    sections: [37],
  },
  {
    id: "limp-bizkit-umadbro-2",
    url: "/lore/limp-bizkit-umadbro-2.jpg",
    caption: "an earlier Limp Bizkit \"U MAD BRO?\" promo shoot in matching trollface tracksuits",
    keywords: ["limp bizkit", "u mad bro", "limp bizkit tracksuit", "limp bizkit promo"],
    sections: [37],
  },
  {
    id: "limp-bizkit-madrid-stage",
    url: "/lore/limp-bizkit-madrid-stage.png",
    caption: "a giant trollface, cap and all, lit up over the stage during Limp Bizkit's Madrid show",
    keywords: ["limp bizkit madrid", "madrid stage", "trollface stage prop", "limp bizkit stage"],
    sections: [37],
  },
  {
    id: "beeple-troll-fluencer",
    url: "/lore/beeple-troll-fluencer.jpg",
    caption: "Beeple's \"TROLL-FLUENCER\" — a giant trollface-headed figure juggling a coin logo and a Pepe head over a crowd",
    keywords: ["beeple", "troll-fluencer", "trollfluencer", "beeple troll"],
    sections: [38],
  },
  {
    id: "beeple-no-crying-casino",
    url: "/lore/beeple-no-crying-casino.jpg",
    caption: "Beeple's \"NO CRYING IN THE CASINO\" — a jail-cell scene with a trollface sticker among the CryptoPunks/Pepe wall memorabilia",
    keywords: ["beeple", "no crying in the casino", "beeple jail"],
    sections: [38],
  },
  {
    id: "beeple-supply-side-attack",
    url: "/lore/beeple-supply-side-attack.jpg",
    caption: "Beeple's \"SUPPLY SIDE ATTACK\" — a dripping trollface-grin doodle signed into the corner of the piece",
    keywords: ["beeple", "supply side attack"],
    sections: [38],
  },
  {
    id: "beeple-swamp-2",
    url: "/lore/beeple-swamp-2.jpg",
    caption: "Beeple's \"SWAMP 2.0\"",
    keywords: ["beeple", "swamp 2.0", "swamp 2"],
    sections: [38],
  },
  {
    id: "beeple-elon-poor-af",
    url: "/lore/beeple-elon-poor-af.jpg",
    caption: "Beeple's \"ELON POOR AF\"",
    keywords: ["beeple", "elon poor af"],
    sections: [38],
  },
  {
    id: "beeple-cabal-stuff",
    url: "/lore/beeple-cabal-stuff.jpg",
    caption: "Beeple's \"CABAL STUFF\" — a hooded ritual scene with a trollface-grin doodle at the base of the altar",
    keywords: ["beeple", "cabal stuff"],
    sections: [38],
  },
  {
    id: "meme-generator-trollface",
    url: "/faces/trollface-grin.gif",
    caption: "meme_generator output — no AI needed, this is the whole meme",
    keywords: ["meme_generator", "meme generator", "--ai-generate", "generate a meme", "make a meme"],
    sections: [1],
  },
  {
    id: "goodbye-nikita-meme",
    url: "/lore/goodbye-nikita-meme.jpg",
    caption: "\"Farewell Nikita\" — the @Troll_ meme about Nikita Bier stepping down as X's head of product",
    keywords: ["nikita", "nikita bier", "goodbye nikita", "farewell nikita", "head of product", "u mad bro book"],
    sections: [36],
  },
  {
    id: "hb-rosary-hand",
    url: "/lore/hb-rosary-hand.jpg",
    caption: "Huntington Beach, August 8 2026 — the Trollface rosary held up against the surf",
    keywords: ["huntington beach", "hb rosary", "troll rosary", "rosary surf"],
    sections: [41],
  },
  {
    id: "hb-kneeling-shoreline",
    url: "/lore/hb-kneeling-shoreline.jpg",
    caption: "Huntington Beach, August 8 2026 — kneeling at the shoreline, rosary on",
    keywords: [
      "huntington beach",
      "hb shoreline",
      "kneeling beach",
      "shoreline rosary",
      // The only face-forward photo of the Troll Runner in this library
      // (§41 — "another entry in the Troll Runner's own camera roll") —
      // catch "what does he look like" style questions, which otherwise
      // have no keyword overlap with any asset and get answered with the
      // persona's in-character "I don't have his face" line even though a
      // photo exists.
      "what does he look like",
      "what does the troll runner look like",
      "what do you look like",
      "show me his face",
      "show me your face",
      "his face",
      "your face",
    ],
    sections: [41],
  },
  {
    id: "hb-rosary-sand",
    url: "/lore/hb-rosary-sand.jpg",
    caption: "Huntington Beach, August 8 2026 — letters drawn in the sand, rosary laid across it",
    keywords: ["huntington beach", "hb sand", "sand drawing", "sand writing"],
    sections: [41],
  },
  {
    id: "hb-jedo-peace-sign",
    url: "/lore/hb-jedo-peace-sign.jpg",
    caption: "Huntington Beach, August 8 2026 — Jedo in the MAD? cap, peace sign up",
    keywords: ["huntington beach", "jedo", "mad hat", "mad cap", "peace sign beach"],
    sections: [41],
  },
  {
    id: "alon-crash-twins-alon",
    url: "/lore/alon-crash-twins-alon.jpg",
    caption: "the \"Alon and Crash were twins the whole time\" bit — the Alon side",
    keywords: ["alon", "alon cohen", "alon crash", "crash alon", "twins theory", "alon and crash"],
    sections: [43],
  },
  {
    id: "alon-crash-twins-crash",
    url: "/lore/alon-crash-twins-crash.jpg",
    caption: "the \"Alon and Crash were twins the whole time\" bit — the Crash side",
    keywords: ["crashius clay", "alon crash", "crash alon", "twins theory", "alon and crash"],
    sections: [43],
  },
  {
    id: "crash-trollface-mask",
    url: "/lore/crash-trollface-mask.jpg",
    caption: "\"CRASH IS A TROLL\" — the trollface mask over Crash's avatar",
    keywords: ["crash is a troll", "trollshius clay", "crash troll mask", "crash trollface"],
    sections: [43],
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

// Powers the archive's inline pictures (docs/TERMINAL-V4-DESIGN.md §3.1).
// Looks assets up by their declared `sections` field rather than scoring
// keyword overlap against the section's prose — a section's body routinely
// namedrops other sections in passing ("the same pattern §37 and §38 log
// elsewhere in this file"), and that alone was enough for a keyword scorer
// to pull in Limp Bizkit/Beeple images on an unrelated section, or lose a
// section's own image to a higher-scoring false positive from another
// section's asset. Every image in a section is returned — an archive file
// is the section, not a chat aside, so there's no reason to cap it.
export function findLoreImagesForArchiveSection(sectionNumber: number): LoreAsset[] {
  return LORE_ASSETS.filter(
    (asset) => !isVideoAsset(asset.url) && asset.sections.includes(sectionNumber)
  );
}
