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
  // Words that make a chat turn worth asking the paid show_image call about
  // (see turnMightWantLoreImage below). They no longer PICK the image — the
  // model does that from the captions — they only decide whether it's worth
  // asking at all. An asset without keywords can still be shown, but only
  // on turns that explicitly ask to see something, so give new entries a few.
  keywords?: string[];
  // The TROLL-LORE.md section number(s) this asset actually illustrates.
  // findLoreImagesForArchiveSection (below) looks assets up by this field
  // directly.
  sections: number[];
  // True for a short looping clip that should play like a GIF (autoplay,
  // muted, loop, no controls) rather than a real video clip a troublemaker
  // would want to scrub through with controls. Chat.tsx reads this.
  loopGif?: boolean;
};

const VIDEO_EXTENSIONS = [".mp4", ".webm", ".mov"];
export function isVideoAsset(url: string): boolean {
  const path = url.split("?")[0].toLowerCase();
  return VIDEO_EXTENSIONS.some((ext) => path.endsWith(ext));
}

// Looks the asset up by URL to check its loopGif flag — used by Chat.tsx to
// decide whether a video message should render as an autoplaying, muted,
// looping GIF instead of a controls-driven clip.
export function isLoopGifAsset(url: string): boolean {
  return LORE_ASSETS.some((asset) => asset.url === url && asset.loopGif);
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
    // Spelled out the same way as hb-kneeling-shoreline below: krypto2009
    // never shows his bare face, so this — him wearing the trollface mask
    // in person, chains and leopard print — IS the real answer to "what
    // does he look like," not a dodge. Without saying that outright, the
    // model has no way to connect it to the question and will (wrongly)
    // claim there's no way to show what he looks like at all.
    caption:
      "krypto2009 in the flesh, wearing the trollface mask with chains and leopard print — this IS what he looks like; he never shows his bare face, so this is the real answer to a 'what does he look like' question, not a non-answer.",
    keywords: ["krypto2009", "krypto 2009", "what does krypto2009 look like", "krypto2009 look like"],
    sections: [30],
  },
  {
    id: "krypto2009-mask-worn",
    url: "/lore/krypto2009-mask-worn.jpg",
    caption:
      "krypto2009 in the flesh, in the mask, rosary and MAD? cap, sitting in a theater seat — another real answer to 'what does he look like,' same reasoning as krypto2009 above.",
    keywords: ["krypto2009", "krypto 2009", "mad cap", "krypto mask", "what does krypto2009 look like"],
    sections: [30],
  },
  {
    id: "krypto2009-cap-and-krypto-tee",
    url: "/lore/krypto2009-cap-and-krypto-tee.jpg",
    caption:
      "krypto2009, October 2, 2026: \"TROLLed the F*** Out.\" A washed grey cap with an embroidered trollface pulled down over his eyes, and a black KЯYPTO tee with the trollface in a circle.",
    keywords: ["krypto2009", "krypto cap", "krypto tee", "krypto shirt", "trolled the f out", "trollface cap"],
    sections: [30],
  },
  {
    id: "krypto2009-halloween-obey-hoodie",
    url: "/lore/krypto2009-halloween-obey-hoodie.jpg",
    caption:
      "krypto2009's Halloween 2026 costume: the molded trollface mask from umadbro.shop, UMadBro's Obey Troll hoodie, and a Pepe plush held upside down. The post named the costume with the $TROLL mint address instead of the word.",
    keywords: ["krypto2009", "halloween", "obey troll hoodie", "trollface mask", "umadbro mask", "krypto halloween"],
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
    id: "umadbro-higher-rolling-tray",
    url: "/lore/umadbro-higher-rolling-tray.jpg",
    caption:
      "@umadbro's 'time to go higher?' post (Sept 25, 2026): a hand holding a lime-and-violet swirl rolling tray with a trollface in the center and HIGHER down the side, held up against a field of flowering cannabis. It's a teaser; the tray wasn't in the shop's catalog",
    keywords: ["troll weed", "rolling tray", "higher", "umadbro tray", "420"],
    sections: [32, 81],
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
    // This caption (not the keywords list below) is what the model
    // actually sees via loreAssetCatalogForPrompt/IMAGE LIBRARY — it needs
    // to say outright that this is a real photo of the Troll Runner
    // himself, or the model has no way to connect it to "what does he look
    // like" questions and will (wrongly) claim it has no photo of him at
    // all, per §41's own text: this is the closest thing to a portrait in
    // the library, sunglasses on, not a clean face shot but a real one.
    caption:
      "the Troll Runner himself — Huntington Beach, August 8 2026, kneeling at the shoreline, sunglasses on, rosary around his neck. The only real photo of him in this library.",
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
      "what he looks like",
      "who is he",
      "who is the troll runner",
      "who's the troll runner",
      "describe him",
      "describe the troll runner",
      "picture of him",
      "photo of him",
      "image of him",
      "see his face",
      "see him",
      "what does the owner look like",
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
  {
    id: "laptop-coin-eric-trump-chart",
    url: "/lore/laptop-coin-eric-trump-chart.jpg",
    caption:
      "Eric Trump's reply to the $LAPTOP crash, captioned \"Hunter should go back to painting…\" — a split image: the LAPTOP/USDC chart cratering from over $1,000 to under $5, next to a photo of Joe and Hunter Biden walking together",
    keywords: ["laptop coin", "eric trump", "laptop chart", "laptop crash"],
    sections: [47],
  },
  {
    id: "laptop-coin-hunter-trollface-joke",
    url: "/lore/laptop-coin-hunter-trollface-joke.jpg",
    caption:
      "a joke portrait made after the $LAPTOP launch — Hunter Biden's face swapped for the actual trollface, the punchline being that he was the real troll all along",
    keywords: ["laptop coin", "hunter biden trollface", "laptop coin joke", "hunter biden troll"],
    sections: [47],
  },
  {
    id: "ethanprosper-mclaren",
    url: "/lore/ethanprosper-mclaren.jpg",
    caption:
      "Ethan Prosper (@pr6spr), the memecoin trencher who bought a McLaren 720S at 22 — the clip @_bolivian roasted him over",
    keywords: ["ethan prosper", "ethanprosper", "pr6spr", "mclaren trencher", "trencher mclaren"],
    sections: [49],
  },
  {
    id: "ethanprosper-grin",
    url: "/lore/ethanprosper-grin.jpg",
    caption:
      "Ethan Prosper mid-laugh, closer crop — wide grin and frizzed curly hair that reads like a real-life trollface",
    keywords: ["ethan prosper", "ethanprosper", "looks like a troll", "trollface irl", "pr6spr"],
    sections: [49],
  },
  {
    id: "trollface-18th-birthday",
    url: "/lore/trollface18thday.jpg",
    caption: "Trollface's 18th birthday — September 19, 2026, eighteen years out from the original 2008 drawing",
    keywords: ["18th birthday", "trollface birthday", "happy birthday trollface", "turns 18", "trollface turns 18"],
    sections: [54],
  },
  {
    id: "swish-trollface-18th-birthday-gif",
    url: "/lore/swish-trollface-18th-birthday.mp4",
    caption: "SWISH's birthday GIF of the grin, from his 18th-birthday tribute post",
    keywords: ["swish birthday gif", "trollface gif", "18th birthday gif", "birthday loop", "trollface loop"],
    sections: [54],
    loopGif: true,
  },
  {
    id: "whynne-happy-troll-day-mario",
    url: "/lore/whynne-happy-troll-day-mario.jpg",
    caption:
      "Whynne's \"Happy Troll Day\" post for the 18th birthday — no trollface at all, just a mangled low-poly N64-style Mario with a caved-in head clutching a sandwich",
    keywords: ["happy troll day", "whynne birthday", "troll day", "cursed mario", "mario sandwich"],
    sections: [54],
  },
  {
    id: "umadbro-mousepads",
    url: "/lore/umadbro-mousepads.jpg",
    caption:
      "UMadBro's two ergonomic mousepad styles, Model Eclipse (dark) and Model Waifu (pink), on a desk next to a \"U mad bro?\" mousebag and a trollface keycap",
    keywords: ["mousepad", "mousepads", "model eclipse", "model waifu", "ergonomic mousepad", "wrist rest", "umadbro mousepad"],
    sections: [40],
  },
  {
    id: "umadbro-keyboard-claymore-1",
    url: "/lore/umadbro-keyboard-claymore-1.jpg",
    caption:
      "Kevin Rosa's \"Key Board Warrior\" claymore sculpture propped in a sitting room, blade stamped \"U MAD BRO?\", trollface pommel on the grip",
    keywords: ["keyboard claymore", "key board warrior", "keyboard sword", "umadbro sculpture", "kevin rosa sculpture"],
    sections: [63],
  },
  {
    id: "umadbro-keyboard-claymore-2",
    url: "/lore/umadbro-keyboard-claymore-2.jpg",
    caption:
      "Kevin Rosa wiping down the keyboard blade of his \"Key Board Warrior\" claymore sculpture, trollface printed on a keycap near the arrow keys",
    keywords: ["keyboard claymore", "key board warrior", "keyboard sword", "umadbro sculpture", "kevin rosa sculpture"],
    sections: [63],
  },
  {
    id: "umadbro-keyboard-claymore-3",
    url: "/lore/umadbro-keyboard-claymore-3.jpg",
    caption:
      "a third angle on Kevin Rosa's \"Key Board Warrior\" claymore sculpture, the keyboard-bladed sword built as UMadBro merch",
    keywords: ["keyboard claymore", "key board warrior", "keyboard sword", "umadbro sculpture", "kevin rosa sculpture"],
    sections: [63],
  },
  {
    id: "garrett-jin-portrait",
    url: "/lore/garrett-jin-portrait.png",
    caption:
      "Garrett Jin — former Gate.io co-founder, the 'insider whale' who shorted 38,000 ZEC and lost $35.44M on it while sitting on $221M unrealized profit on his own spot ZEC bag",
    keywords: ["garrett jin", "zec short", "zcash short", "insider whale", "gate.io co-founder"],
    sections: [55],
  },
  {
    id: "trollworld-island-map-countdown",
    url: "/lore/trollworld-island-map-countdown.png",
    caption:
      "the TROLLWORLD island map on trollface.io, header showing the 69:69:69 countdown state, with the /cave, /observatory and other named routes visible as physical landmarks",
    keywords: ["trollworld", "trollface.io", "island map", "69:69:69", "countdown", "trollworld island"],
    sections: [60],
  },
  {
    id: "biden-bath-cigarette",
    url: "/lore/biden-bath-cigarette.jpg",
    caption: "Hunter Biden in a bath, smoking a cigarette with his eyes closed — from the laptop material",
    keywords: ["hunter biden bath", "hunter biden cigarette", "biden bathtub"],
    sections: [48],
  },
  {
    id: "laptop-from-hell",
    url: "/lore/laptop-from-hell.webp",
    caption: "the spending table from Miranda Devine's book \"Laptop from Hell\"",
    keywords: ["laptop from hell", "miranda devine", "spending table", "biden indictment table"],
    sections: [48],
  },
  {
    id: "hunter-with-a-widow",
    url: "/lore/hunter-with-a-widow.webp",
    caption: "Hunter Biden with Hallie, his late brother Beau's widow, during the Annapolis waterfront home period",
    keywords: ["hunter with a widow", "hallie biden", "annapolis home"],
    sections: [48],
  },
  {
    id: "biden-with-escort",
    url: "/lore/biden-with-escort.webp",
    caption: "material referenced in the $8,000 Los Angeles escort callout detailed in the indictment",
    keywords: ["biden escort", "yanna", "emerald fantasy girls"],
    sections: [48],
  },
  {
    id: "general-view-chateau-marmont-hotel",
    url: "/lore/general-view-chateau-marmont-hotel.webp",
    caption: "the Chateau Marmont hotel, where Biden charged 42 nights in a poolside bungalow",
    keywords: ["chateau marmont", "poolside bungalow"],
    sections: [48],
  },
  {
    id: "smile-biden",
    url: "/lore/smile-biden.webp",
    caption: "Smile Design Cosmetic Dentistry in Midtown, where Biden spent over $69,000 on dental work",
    keywords: ["smile design", "biden teeth", "biden dental work"],
    sections: [48],
  },
  {
    id: "biden-crack",
    url: "/lore/biden-crack.webp",
    caption: "Biden photographed smoking crack while driving at 172 mph in his Porsche en route to Las Vegas",
    keywords: ["biden crack", "biden porsche", "biden driving"],
    sections: [48],
  },
  {
    id: "4chan-automated-draft-post",
    url: "/lore/4chan-automated-draft-post.png",
    caption:
      "the original 4chan /pol/ thread — \"88 DAYS UNTIL THE US GOV CAN INSTITUTE AN AUTOMATED MILITARY DRAFT\" — citing Section 535 of the FY2026 NDAA and the withdrawn Selective Service rules",
    keywords: ["4chan draft thread", "automated military draft", "section 535", "ndaa draft", "selective service rules withdrawn"],
    sections: [61],
  },
  {
    id: "pumpfun-bonnieblue-auction",
    url: "/lore/pumpfun-bonnieblue-auction.png",
    caption:
      "an early-morning snapshot of the bonnieblue.io baby-name auction leaderboard (Sept 22, 2026), showing \"Group Project\" bid by Pump Fun in first place at $750,000, ahead of \"Plan B\" and \"Mixed nuts\" — the board moved same-day and Pump Fun later dropped to 5th behind higher bids",
    keywords: ["bonnie blue", "pump.fun baby name", "group project", "baby name auction", "pumpfun auction"],
    sections: [62],
  },
  {
    id: "bonnieblue-choose-a-name-hero",
    url: "/lore/bonnieblue-choose-a-name-hero.png",
    caption:
      "the bonnieblue.io landing page itself (Sept 22, 2026) — \"CHOOSE A NAME\" in bubble letters over a pastel-blue gender-reveal backdrop, with the pitch spelled out: \"Come up with a name and bid on it. The winning name will gain access to a private party to celebrate the name selection!\" and a \"Make a bid\" button. Proof the auction is a real, produced site rather than a rumour",
    keywords: ["bonnie blue", "choose a name", "bonnieblue.io", "baby name auction site", "make a bid"],
    sections: [62],
  },
  {
    id: "kfcereal-kfc-surreal",
    url: "/lore/kfcereal-kfc-surreal.png",
    caption:
      "KFC UK's \"KFCereal\" launch shot (Sept 23, 2026) — a black-and-red box reading \"Full English Kentucky Breakfast\" and \"KF Cereal / SURREAL,\" flagged 19g protein / 1g sugar / inspired by 11 herbs and spices, next to a KFC-branded bowl of cereal with gravy being poured over it from a KFC gravy pot onto a red gingham tablecloth. A real limited-edition product, not a mockup",
    keywords: ["kfcereal", "kfc cereal", "kfc", "fried chicken cereal"],
    sections: [64],
  },
  {
    id: "kraft-dinner-cream-soda",
    url: "/lore/kraft-dinner-cream-soda.png",
    caption:
      "the Kraft Dinner x Solly's mac & cheese cream soda (Sept 23, 2026) — a blue 355ml can with the orange KD bubble wordmark, a forkful of macaroni on the front, \"Smile, it's Solly's!\" and a maple leaf marking it Canada-only, held against blue sky with bright orange liquid erupting from the opened top",
    keywords: ["kraft dinner", "mac and cheese soda", "mac & cheese soda", "cream soda", "solly's"],
    sections: [64],
  },
  {
    id: "roundtable-dr-pepper-pizza",
    url: "/lore/roundtable-dr-pepper-pizza.png",
    caption:
      "Round Table Pizza's Dr Pepper pizza (Sept 23, 2026) — a full pie covered edge to edge in crispy cupped pepperoni holding little pools of grease, a dark Dr Pepper BBQ sauce streaked diagonally across the melted cheese, and chopped green onions scattered on top. A real limited-time menu item, not a mockup",
    keywords: ["round table", "dr pepper pizza", "dr pepper", "dr. pepper", "soda pizza"],
    sections: [64],
  },
  {
    id: "trolls-first-1k-sale-after-reveal",
    url: "/lore/trolls-first-1k-sale-after-reveal.png",
    caption:
      "OpenSea activity for the TROLLS collection on reveal day (Sept 23, 2026), filtered to sales over $1,000: TROLLS #1969 sold for $1,844.25 about 35 minutes earlier, the first four-figure sale since the reveal, above two sales from three months before it, \"Pepe\" at $3,559.61 and TROLLS #88 from KillMigi at $1,258.65",
    keywords: ["#1969", "four-figure sale", "first sale after the reveal", "trolls sale"],
    sections: [66],
  },
  {
    id: "trolls-1718-tank-runner",
    url: "/lore/trolls-1718-tank-runner.jpg",
    caption:
      "TROLLS #1718, which troll_runner bought for 0.11 ETH on Sept 27, 2026: a trollface with relaxed closed eyes and a curled French moustache, wearing the black Goatfarm \"U MAD BRO?\" cap and a neon-green racing tank top with RUNNER across the chest, on a grey stone gradient",
    keywords: ["#1718", "1718", "tank runner", "troll runner nft", "troll_runner nft", "runner troll", "which troll does troll runner own"],
    sections: [66],
  },
  {
    id: "troll-tek-1718-watch-selfie",
    url: "/lore/troll-tek-1718-watch-selfie.jpg",
    caption:
      "\"troll tek\" (Sept 27, 2026): the Troll Runner against a cinderblock wall, forearm over his eyes, in the black MAD? cap, a white trollface YOU MAD? tee and the GOATFARM rosary, with his COROS watch showing TROLLS #1718 as its face at 06:46",
    keywords: ["troll tek", "watch face", "coros", "nft on a watch", "nft watch", "troll watch"],
    sections: [66],
  },
  {
    id: "troll-tek-1718-watch-wrist",
    url: "/lore/troll-tek-1718-watch-wrist.jpg",
    caption:
      "\"troll tek\" close-up (Sept 27, 2026): the Troll Runner's COROS watch at 07:00 with TROLLS #1718 (moustache, U MAD BRO? cap, RUNNER tank) glowing on a blue backlight, a woven red strap, and a bracelet of enamel trollface charms on the same wrist over ripped jeans",
    keywords: ["troll tek", "watch face", "coros", "nft on a watch", "trollface bracelet", "troll watch"],
    sections: [66],
  },
  {
    id: "troll-tek-mad-hat-collage",
    url: "/lore/troll-tek-mad-hat-collage.jpg",
    caption:
      "\"no one shills the hat harder\": TROLLS #1718 in the middle of eight real photos of the black MAD? cap: held up on the sand, Jedo at Huntington Beach, with a corgi (twice), a gym mirror selfie, in a GOATFARM jacket, next to a GOATFARM bag and rosary, and over a COROS showing a 13.11-mile half marathon in 2:02:47",
    keywords: ["mad hat", "mad cap", "mad? hat", "shills the hat", "hat collage", "half marathon", "corgi"],
    sections: [66],
  },
  {
    id: "troll-tek-opensea-floor",
    url: "/lore/troll-tek-opensea-floor.jpg",
    caption:
      "OpenSea TROLLS collection card attached to the \"troll tek\" post (Sept 27, 2026): floor $186.59 (+14.4% on the day), top offer $158.47, $11K 24h volume, $1.4M total volume, 684 unique owners, 551 listed, 3,333 items by troll-dev",
    keywords: ["trolls floor", "floor price", "nft floor", "opensea trolls"],
    sections: [66],
  },
  {
    id: "bitget-drain-arkham-transfers",
    url: "/lore/bitget-drain-arkham-transfers.webp",
    caption:
      "Arkham transfer log from the Bitget drain (Sept 24, 2026): thirteen rows of Bitget hot and cold wallets sending to one address, 0x770b10b273fC44Fe9197…, within about an hour. 13,966 ETH ($37.55M), 34.75M USDT, 19.67M USDT0, 12.85M USDC, 3K XAUT, 12,719 BNB and 821K AVAX, across Ethereum, Arbitrum, Optimism, BNB Chain and Avalanche, about $175M in total",
    keywords: ["bitget", "bitget hack", "exchange hack", "hot wallet", "cold wallet", "wait for asia", "asia to wake up", "arkham"],
    sections: [67],
  },
  {
    id: "bitget-turns8-summit-post",
    url: "/lore/bitget-turns8-summit-post.jpg",
    caption:
      "@bitget's #BitgetTurns8 anniversary post, \"The view hits different from up here.\", published at 19:00 UTC on Sept 24, 2026, mid-drain, 29 minutes after its own systems detected the hack: a hooded hiker seen from behind with a Bitget backpack and Bitget trekking pole, arms thrown wide on a stone summit above a sea of clouds and blue mountain ranges",
    keywords: ["bitgetturns8", "bitget turns 8", "bitget anniversary", "bitget birthday", "view from up here", "summit"],
    sections: [67],
  },
  {
    id: "bitget-ceo-gracy-chen",
    url: "/lore/bitget-ceo-gracy-chen.jpg",
    caption:
      "Bitget CEO Gracy Chen's X profile picture on the night of the drain (Sept 24, 2026): a studio portrait in a plain white tee, framed by a glossy white ring with the Bitget logo on one side and a big \"8\" for the exchange's eighth anniversary on the other",
    keywords: ["gracy chen", "gracy", "bitget ceo", "ceo of bitget"],
    sections: [67],
  },
  {
    id: "bitget-proof-of-reserves-sept-2026",
    url: "/lore/bitget-proof-of-reserves-sept-2026.png",
    caption:
      "Bitget's September 2026 Proof of Reserves page (snapshot Sept 15, 17:00 UTC+8), as posted by @0xG00gly nine days later during the drain: 135% total reserve ratio with a green \"Sufficient reserves\" badge and a Merkle root, then per-coin tiles: LINK 131%, BTC 133%, USDT 100%, ETH 160%, LTC 126%, USDC 140%, NEAR 182%, USDGO 216%",
    keywords: ["proof of reserves", "reserve ratio", "bitget reserves", "por", "merkle"],
    sections: [67],
  },
  {
    id: "nft-whitehat-rescue-wallet-cirrus",
    url: "/lore/nft-whitehat-rescue-wallet-cirrus.jpg",
    caption:
      "@CirrusNFT's screenshot at 06:31 UTC on Sept 25, 2026: wallet 0x71cf...fe33 holding 3,832 NFTs worth $1.4M swept from hundreds of wallets (Bored Apes, an Azuki, 527 Otherdeed Expanded, 467 Quirklings, Mutant Apes, Meebits), before anyone knew it was 0xQuit's whitehat rescue",
    keywords: ["whitehat", "white hat", "nft drain", "cirrus", "payment processor", "rescue wallet"],
    sections: [68],
  },
  {
    id: "nft-whitehat-nfts-are-safu",
    url: "/lore/nft-whitehat-nfts-are-safu.jpg",
    caption:
      "0xQuit's own OpenSea view of the rescue wallet, named nfts_are_safu (created Sep 2026), at 17,581 items and $1.5M, part of the 23,155 NFTs he moved to safety from the Limit Break Payment Processor V2 exploit",
    keywords: ["nfts are safu", "safu", "0xquit", "whitehat", "magic eden", "limit break", "revoke"],
    sections: [68],
  },
  {
    id: "dicey-blackjack-100k-to-1m",
    url: "/lore/dicey-blackjack-100k-to-1m.jpg",
    caption:
      "@DiceyHQ's post from Sept 21, 2026, four days before the Payment Processor exploit: '7 MINUTES, $100K to $1,000,000' on Dicey Blackjack. Dicey is the crypto casino run by Magic Eden's founders, and Magic Eden's feed was mostly Dicey reposts that week",
    keywords: ["dicey", "blackjack", "magic eden casino", "100k to 1m"],
    sections: [68],
  },
  {
    id: "nft-drain-lazy-lions-wiimee",
    url: "/lore/nft-drain-lazy-lions-wiimee.jpg",
    caption:
      "@wiimee's screenshot at 12:41 UTC on Sept 25, 2026, hours after the whitehat rescue: an OpenSea activity feed of Lazy Lions transferred one after another from wallets like MattyZ, TLDNs-Vault and 0xba65 into a single address ending f2324d, every row '20m ago', proof the Payment Processor V2 drain was still going",
    keywords: ["lazy lions", "kodamara", "wiimee", "still ongoing", "nft drain", "revoke approvals"],
    sections: [68],
  },
  {
    id: "jack-doherty-portrait",
    url: "/lore/jack-doherty-portrait.png",
    caption:
      "Jack Doherty himself, the streamer the JACK coins were aimed at: curly hair, a double silver chain, a clip-on mic on a turquoise Galerie-style tee, one hand held up to the lens, and friends behind him under neon-lit venue lights",
    keywords: ["jack doherty", "dohertyjackk", "what does jack doherty look like", "jack doherty photo"],
    sections: [69],
  },
  {
    id: "jack-doherty-fomo-portfolio",
    url: "/lore/jack-doherty-fomo-portfolio.png",
    caption:
      "Jack Doherty's Fomo portfolio card from his Sept 26, 2026 post 'Just made a Fomo account… what meme coins should I buy?': $10,000.87, a flat line that jumps straight up on Sept 26, and a '10% off fees with code dohertyjackk' referral banner along the bottom",
    keywords: ["jack doherty", "dohertyjackk", "fomo account", "fomo portfolio", "jack doherty wallet"],
    sections: [69],
  },
  {
    id: "jack-doherty-cybertruck-drkwyd",
    url: "/lore/jack-doherty-cybertruck-drkwyd.webp",
    caption:
      "a night street shot @drkwyd posted with 'I linked up with Jack Doherty and had dinner with him last yr' as he launched the Jack Doherty Official coin: a bright-blue Cybertruck with rainbow underglow parked outside a Lobster Bar Sea Grille, a young guy looking at his phone by the open door (Jack, per the post), and a few guys in black standing around him. The frame carries the tag E4WuDt, the start of drkwyd's own wallet",
    keywords: ["jack doherty", "drkwyd", "cybertruck", "jack doherty official", "jack doherty coin"],
    sections: [69],
  },
  {
    id: "jack-coin-j1yx-logo",
    url: "/lore/jack-coin-j1yx-logo.jpg",
    caption:
      "the logo of the J1yx JACK coin, from its own on-chain metadata on usepaid.app ('Fees to @dohertyjackk via UsePaid'): a mugshot-style photo of Jack Doherty against a grey wall, curly hair and black tee. It's the coin that ran to a $6.4M wick on Sept 27, 2026 before Jack sold his whole bag into the top for $214k",
    keywords: ["jack coin", "j1yx", "jack trollherty", "jack logo", "usepaid", "jack million"],
    sections: [69],
  },
  {
    id: "jack-coin-j1yx-rug-chart",
    url: "/lore/jack-coin-j1yx-rug-chart.jpg",
    caption:
      "a phone screenshot of the J1yx JACK 5-minute chart, 13 hours after launch: a slow climb from about $1M, a green run to $5M, a single wick to about $7M on the chart's axis, then one long red candle straight back under $1M as Jack Doherty sold his 59.7M tokens for $214k. The header reads MC $642.64K, down 88.8%, with 7.7K holders",
    keywords: ["jack rug", "jack dump", "jack sold", "jack doherty rug", "rug pull", "jack chart", "6 million", "jack crash"],
    sections: [69],
  },
  {
    id: "jack-doherty-fomo-sell-receipt",
    url: "/lore/jack-doherty-fomo-sell-receipt.jpg",
    caption:
      "a screenshot of Jack Doherty's Fomo profile right after he sold: his JACK position marked 'Closed', the chart with a column of green buy markers and one red sell marker at the spike, +$213,060.60 and +8,810.86%, avg entry $38.9K MC, avg exit $3.4M MC, and under it his own Fomo thesis post 'WERE GOING TO SMASH THROUGH 10m!!!'. Posted by @0xBriann tagging the FBI and SEC",
    keywords: ["jack rug", "jack sold", "jack receipt", "213k", "214k", "smash through 10m", "jack thesis", "jack profit", "jack doherty scam"],
    sections: [69],
  },
  {
    id: "jack-doherty-fomo-141k",
    url: "/lore/jack-doherty-fomo-141k.jpg",
    caption:
      "the Fomo portfolio card Jack Doherty posted at 05:57 UTC Sept 27, 2026 with '$2m market cap on fomo! We're hitting $10m by the morning and $100m when I post my TikTok!!': $141,789.20 total, JACK worth $123.7K and up $121,475.69, plus small BRANDRISK and PONS bags, and his 'code dohertyjackk' banner. He sold the JACK bag 47 minutes later",
    keywords: ["jack portfolio", "141k", "jack doherty fomo", "never selling", "10m by the morning", "jack shill", "jack tiktok"],
    sections: [69],
  },
  {
    // AI-generated joke, not a real photo: Jack has not been charged or
    // jailed. Keywords stay narrow so it only shows when asked for.
    id: "jack-doherty-jail-meme-eyewhales",
    url: "/lore/jack-doherty-jail-meme-eyewhales.jpg",
    caption:
      "an AI-GENERATED MEME, NOT A REAL PHOTO: a Jack Doherty lookalike asleep on a prison bunk in an orange jumpsuit behind rusty bars, posted by @EyeWhales under Jack's 'only going up from here' tweet after the JACK sell with 'Good night and have a nice sleep'. Jack has not been charged with anything; always call it a fake/AI joke when showing it",
    keywords: ["jack jail meme", "jack prison meme", "jack jail pic", "jack prison pic", "jack in jail", "jack in prison", "eyewhales"],
    sections: [69],
  },
  // The eleven TROLLS Alpha 1-of-1s (§65), pulled from each token's IPFS
  // image and resized to 800px. Shared keywords ("alpha", "1 of 1") let a
  // general question about the Alphas through the gate; the model then picks
  // one from the captions.
  {
    id: "trolls-alpha-1-trollface",
    url: "/lore/trolls-alpha-1-trollface.jpg",
    caption: "TROLLS Alpha #1 \"Trollface\": a crude MS Paint stick figure with the face, drawn like the 2008 original",
    keywords: ["alpha", "alphas", "1 of 1", "1/1", "trollface #1", "token 1", "nft reveal", "trolls reveal"],
    sections: [65],
  },
  {
    id: "trolls-alpha-69-69",
    url: "/lore/trolls-alpha-69-69.jpg",
    caption: "TROLLS Alpha #69 \"69\": a pale troll holding its own legs up over its face, a \"69\" heart tattooed on its arm",
    keywords: ["alpha", "alphas", "1 of 1", "#69", "troll 69", "legs up"],
    sections: [65],
  },
  {
    id: "trolls-alpha-369-glorp",
    url: "/lore/trolls-alpha-369-glorp.jpg",
    caption: "TROLLS Alpha #369 \"Glorp\": a green alien troll with glowing antennae, shirtless in space",
    keywords: ["alpha", "alphas", "1 of 1", "glorp", "#369", "alien troll"],
    sections: [65],
  },
  {
    id: "trolls-alpha-420-pepe",
    url: "/lore/trolls-alpha-420-pepe.jpg",
    caption: "TROLLS Alpha #420 \"Pepe\": Pepe the Frog with a trollface where his open mouth should be, blue shirt, trading chart behind him",
    keywords: ["alpha", "alphas", "1 of 1", "pepe", "#420", "pepe troll"],
    sections: [65, 66],
  },
  {
    id: "trolls-alpha-919-barely-legal",
    url: "/lore/trolls-alpha-919-barely-legal.jpg",
    caption: "TROLLS Alpha #919 \"Barely Legal\": the plain shirtless grayscale troll; 9/19 is the birthday and it just turned 18",
    keywords: ["alpha", "alphas", "1 of 1", "barely legal", "#919"],
    sections: [65],
  },
  {
    id: "trolls-alpha-1111-im-spidey",
    url: "/lore/trolls-alpha-1111-im-spidey.jpg",
    caption: "TROLLS Alpha #1111 \"I'm Spidey\": a red Spider-Man troll in front of an NYPD van, one half of the pointing meme",
    keywords: ["alpha", "alphas", "1 of 1", "spidey", "spider-man", "spiderman", "#1111"],
    sections: [65],
  },
  {
    id: "trolls-alpha-1234-trollock",
    url: "/lore/trolls-alpha-1234-trollock.jpg",
    caption: "TROLLS Alpha #1234 \"Trollock\": a wizard troll with a starry hat, round glasses and a wand, on the Advice Animals color wheel",
    keywords: ["alpha", "alphas", "1 of 1", "trollock", "wizard", "#1234"],
    sections: [65],
  },
  {
    id: "trolls-alpha-1337-final-form",
    url: "/lore/trolls-alpha-1337-final-form.jpg",
    caption: "TROLLS Alpha #1337 \"Final Form\": a huge grayscale muscle troll with \"Problem?\" in gothic script across its chest",
    keywords: ["alpha", "alphas", "1 of 1", "final form", "#1337", "muscle troll", "buff troll"],
    sections: [65],
  },
  {
    id: "trolls-alpha-2079-chief-troll-officer",
    url: "/lore/trolls-alpha-2079-chief-troll-officer.jpg",
    caption: "TROLLS Alpha #2079 \"Chief Troll Officer\": a troll cradling a Doge, in a shirt with the X logo, a rocket on a hazy orange planet behind",
    keywords: ["alpha", "alphas", "1 of 1", "chief troll officer", "#2079", "doge troll"],
    sections: [65],
  },
  {
    id: "trolls-alpha-2222-no-im-spidey",
    url: "/lore/trolls-alpha-2222-no-im-spidey.jpg",
    caption: "TROLLS Alpha #2222 \"No I'm Spidey\": the second Spider-Man troll, facing the other way among crates, the other half of the pointing meme",
    keywords: ["alpha", "alphas", "1 of 1", "spidey", "spider-man", "spiderman", "#2222"],
    sections: [65],
  },
  {
    id: "trolls-alpha-3333-whynning",
    url: "/lore/trolls-alpha-3333-whynning.jpg",
    caption: "TROLLS Alpha #3333 \"Whynning\": a gold troll with a glowing eye in a white top hat and suit, the last token, named after Whynne",
    keywords: ["alpha", "alphas", "1 of 1", "whynning", "#3333", "top hat troll", "gold troll"],
    sections: [65],
  },
  {
    id: "openai-dots-devday-stage",
    url: "/lore/openai-dots-devday-stage.jpg",
    caption:
      "OpenAI DevDay 2026, Sept 29: a packed crowd in front of a giant screen with a glowing lowercase 'dots' and a row of blob mascots, one in a beret and one in round glasses. The same night, dot.com was found redirecting to xAI's Grok Bot page",
    keywords: ["dots", "dot.com", "dots.com", "openai dots", "devday", "grok bot", "x.ai/bot", "birdabo"],
    sections: [70],
  },
  {
    id: "openai-dots-mascot-board",
    url: "/lore/openai-dots-mascot-board.jpg",
    caption:
      "a frame from OpenAI's 'Introducing dots' launch video (Sept 29, 2026): the mascot design board, with a yellow triangle in sleepy glasses and a bow tie (No. 001), a green frog in a bow tie (No. 002), a blue cloud in a black beret (No. 003), and a tray of swappable eyes, glasses, headphones and bodies, including a pink heart",
    keywords: ["dots mascot", "dots mascots", "dots characters", "openai dots", "beret", "frog dot", "what do dots look like"],
    sections: [70],
  },
  {
    id: "dot-com-grok-bot-redirect",
    url: "/lore/dot-com-grok-bot-redirect.jpg",
    caption:
      "where dot.com actually lands, captured Sept 29, 2026: x.ai/bot, 'Meet Grok Bot — AI teammates you can give real work to', with a 'Download for Windows' button. That's SpaceXAI's rival agent, reached by typing the singular of OpenAI's new product name",
    keywords: ["dot.com", "grok bot", "x.ai/bot", "redirect", "spacexai", "where does dot.com go"],
    sections: [70],
  },
  {
    id: "dots-com-fashion-brand",
    url: "/lore/dots-com-fashion-brand.jpg",
    caption:
      "dots.com, the plural, captured Sept 29, 2026: not OpenAI at all, but the Dots budget fashion brand ('Love the Looks. Love the Prices.') showing a 'Welcome Back!' relaunch sign-up form",
    keywords: ["dots.com", "dots fashion", "dots clothing", "who owns dots.com"],
    sections: [70],
  },
  {
    id: "dots-look-closely-riedsschichter",
    url: "/lore/dots-look-closely-riedsschichter.png",
    caption:
      "@riedsschichter's reply to the dot.com post (Sept 29, 2026), 'If you look closely, you can see it': the Peter Parker glasses meme, with the OpenAI DevDay 'dots' stage glasses-off and a 'Grok Bot' stage full of colorful blob agents glasses-on. It's a fan edit, and the Grok Bot stage shot hasn't been verified",
    keywords: ["look closely", "peter parker", "glasses meme", "dots vs grok", "dots grok bot", "riedsschichter"],
    sections: [70],
  },
  {
    id: "unites-states-greg-circle",
    url: "/lore/unites-states-greg-circle.jpg",
    caption:
      "greg's (@greg16676935420) quote-post of the White House Accord on Super Intelligence, Sept 30, 2026, captioned just '\"Super Intelligence\"': a close crop of Trump's spiky signature with the typed title under it, 'President of the Unites States', and the typo circled in red",
    keywords: ["unites states", "super intelligence", "white house typo", "trump typo", "greg16676935420", "accord typo"],
    sections: [71],
  },
  {
    id: "white-house-si-accord-signatures",
    url: "/lore/white-house-si-accord-signatures.jpg",
    caption:
      "the signature page of the White House Accord on Super Intelligence (signed Sept 29, 2026): Trump alone on the left over 'President of the Unites States', and down the right Sundar Pichai (Google), Dario Amodei (Anthropic), Mark Zuckerberg (Meta), Greg Brockman signing 'gdb' (OpenAI), Elon Musk (XAI) and Jensen Huang (Nvidia)",
    keywords: ["super intelligence accord", "si accord", "accord signatures", "who signed", "white house ai accord", "unites states"],
    sections: [71],
  },
  {
    id: "white-house-si-accord-page1",
    url: "/lore/white-house-si-accord-page1.jpg",
    caption:
      "page one of the White House Accord on Super Intelligence, 'Joint Commitment on Frontier Responsibilities' (Sept 2026): a voluntary pledge of four layers of controls and audits, internal monitoring, an internal team, an independent external auditor and a board committee, so everything operates 'as intended'",
    keywords: ["super intelligence accord", "frontier responsibilities", "white house ai accord", "si accord text"],
    sections: [71],
  },
  {
    id: "jadoodoo-drinks-then-cries",
    url: "/lore/jadoodoo-drinks-then-cries.jpg",
    caption:
      "two frames from the Korea Trading Showdown final, Sept 30, 2026: trader Jadoodoo, just beaten by Saewoo, tips her head back chugging a water bottle on stage, then sobs straight at the camera. It's the T1 Dumbo meme move for move",
    keywords: ["jadoodoo", "saewoo", "korea trading showdown", "seoul showdown", "frontier", "trader crying", "crying trader"],
    sections: [72],
  },
  {
    id: "t1-dumbo-drinking-crying",
    url: "/lore/t1-dumbo-drinking-crying.gif",
    caption:
      "the original T1 'Dumbo' meme: comedian Moon Sang-hoon, T1's April Fools' 'sixth man', chugs a small bottle with his head tipped back and someone patting his head, then ugly-cries at the camera after T1's LCK loss to Dplus KIA (April 17, 2026)",
    keywords: ["t1 dumbo", "dumbo", "drinking and crying", "crying drinking meme", "asian guy crying", "moon sang-hoon", "esports crying meme"],
    sections: [72],
  },
  {
    id: "ken-carson-story-ill-smack-u",
    url: "/lore/ken-carson-story-ill-smack-u.jpg",
    caption:
      "Ken Carson's old story (account user00xman, reposted as 2022), white typewriter text on black: if anyone calls him anything other than 'teen x, ken carson, x_man, Ken or X', 'I'll smack U'. He posted it after fans kept calling him Goomba",
    keywords: ["ken carson", "goomba", "teen x", "x_man", "x man", "ill smack u", "i'll smack you"],
    sections: [73],
  },
  {
    id: "ken-carson-story-mad-annoying",
    url: "/lore/ken-carson-story-mad-annoying.jpg",
    caption:
      "the second slide of Ken Carson's Goomba story: 'and all y'all know wtf im talking about shits mad annoying'",
    keywords: ["ken carson", "goomba", "mad annoying"],
    sections: [73],
  },
  {
    id: "ken-carson-smack-hand-reply",
    url: "/lore/ken-carson-smack-hand-reply.jpg",
    caption:
      "@lyricTeenX's top reply, captioned 'I'll smack u': Ken Carson in glasses, a cross-print hoodie and a chain, holding his open palm up at the camera. The smack hand, loaded",
    keywords: ["ken carson", "smack hand", "ill smack u", "ken carson hand"],
    sections: [73],
  },
  {
    id: "ken-carson-slow-down-for-me-5",
    url: "/lore/ken-carson-slow-down-for-me-5.jpg",
    caption:
      "a reply meme to Ken Carson's 'I'll smack U' story: a singer in a durag belting into a mic, palm out at the lens, with a laughing-crying emoji and the caption 'slow down for me 5 🖤😂✋'",
    keywords: ["ken carson", "slow down for me 5", "smack hand"],
    sections: [73],
  },
  {
    id: "ken-carson-grown-man-x-man",
    url: "/lore/ken-carson-grown-man-x-man.gif",
    caption:
      "reply GIF under the Ken Carson post, 'im a grown man and you want me to call you x_man': a streamer in a black Nike beanie on a gaming chair, staring blankly into his camera",
    keywords: ["ken carson", "grown man", "call you x_man", "teen x", "x man"],
    sections: [73],
  },
  {
    id: "ken-carson-look-like-a-goomba-reddit",
    url: "/lore/ken-carson-look-like-a-goomba-reddit.jpg",
    caption:
      "where the nickname started: cashewkid's r/playboicarti post 'Ken Carson look like a goomba' (Dec 19, 2020), a frowning Ken with bleached spiky hair next to a Mario Goomba",
    keywords: ["ken carson goomba", "goomba", "look like a goomba", "goomba origin", "cashewkid"],
    sections: [73],
  },
  {
    id: "ken-carson-vamp-goomba-plush",
    url: "/lore/ken-carson-vamp-goomba-plush.jpg",
    caption:
      "Rare Randy's 'vamp goomba' plush (July 2022): a brown Goomba body with Ken Carson's grey dreads, angry brows, fangs and black-and-white sneakers, held up against a brick wall",
    keywords: ["ken carson goomba plush", "goomba plush", "goomba plushie", "vamp goomba", "rare randy", "rarerandy"],
    sections: [73],
  },
  {
    id: "ken-carson-catches-goomba-plush",
    url: "/lore/ken-carson-catches-goomba-plush.gif",
    caption:
      "Ken Carson catching a Goomba plush thrown from the crowd, holding it, then throwing it back (July 15, 2024)",
    keywords: ["ken carson goomba plush", "goomba plush", "catches goomba", "goomba thrown on stage", "ken carson concert"],
    sections: [73],
  },
  {
    id: "robinhood-agent-bald-avatar",
    url: "/lore/robinhood-agent-bald-avatar.jpg",
    caption:
      "HOOD Summit '26 keynote, Houston, Sept 29, 2026: the Robinhood Agents demo puts a bald, ice-blue AI face on the giant screen while Vlad Tenev stands below in a yellow sweater. It's a blue Brian Armstrong",
    keywords: ["blue brian armstrong", "robinhood agents", "hood summit", "vlad tenev", "bald agent", "always bald", "bald ai"],
    sections: [74],
  },
  {
    id: "robinhood-agent-bald-loop",
    url: "/lore/robinhood-agent-bald-loop.gif",
    caption:
      "HOOD Summit '26 keynote: the bald, blue-lit Robinhood Agent talks from the big screen while Vlad Tenev and the presenters watch",
    keywords: ["blue brian armstrong", "robinhood agents", "bald agent", "always bald", "vlad tenev"],
    sections: [74],
  },
  {
    id: "robinhood-agent-with-hair",
    url: "/lore/robinhood-agent-with-hair.jpg",
    caption:
      "after 'why are they always bald?': the Robinhood Agent on the HOOD Summit screen is now a guy with a full head of hair and stubble, with Vlad Tenev in yellow on stage below",
    keywords: ["why are they always bald", "robinhood agents", "agent with hair", "vlad tenev", "hood summit"],
    sections: [74],
  },
  {
    id: "robinhood-agent-hair-swap",
    url: "/lore/robinhood-agent-hair-swap.gif",
    caption:
      "HOOD Summit '26 keynote: the new Robinhood Agent, this time with hair, comes up on the big screen while Vlad Tenev walks the stage",
    keywords: ["why are they always bald", "robinhood agents", "hair swap", "vlad tenev"],
    sections: [74],
  },
  {
    id: "every-crypto-founder-year-1-year-2",
    url: "/lore/every-crypto-founder-year-1-year-2.jpg",
    caption:
      "@ProofofIntern's 'every crypto founder...' meme: an NFL player's Year 1 photo with hair next to his Year 2 photo fully bald. Brian Armstrong quoted it: 'False - bald since day 1 over here'",
    keywords: ["every crypto founder", "year 1 year 2", "bald since day 1", "crypto founder bald", "brian armstrong bald"],
    sections: [74],
  },
  {
    id: "brian-armstrong-breaking-free-blog",
    url: "/lore/brian-armstrong-breaking-free-blog.jpg",
    caption:
      "Brian Armstrong's old 'Breaking Free' make-money-online blog: an eBook on quitting your 9-to-5, an eBay startup-kit banner ad, and a young Brian with a full head of hair. Proof he wasn't bald since day 1",
    keywords: ["breaking free", "brian armstrong blog", "brian armstrong hair", "young brian armstrong", "bald since day 1"],
    sections: [74],
  },
  {
    id: "blou-ai-more-water-post",
    url: "/lore/blou-ai-more-water-post.jpg",
    caption:
      "B Lou's post, Sept 29, 2026: 'If AI using water why can't we just AI more water', over a clip of two guys staring into the camera, one with his hand on his chin",
    keywords: ["b lou", "blou", "ai more water", "ai water", "ai using water", "data center water"],
    sections: [75],
  },
  {
    id: "blou-ai-more-water-thinking",
    url: "/lore/blou-ai-more-water-thinking.jpg",
    caption:
      "the clip under B Lou's 'why can't we just AI more water' post: two guys staring into the camera, one with his hand on his chin, thinking very hard about it",
    keywords: ["b lou", "blou", "ai more water", "thinking", "shower thought"],
    sections: [75],
  },
  {
    id: "blou-ai-more-water-thinking-loop",
    url: "/lore/blou-ai-more-water-thinking.gif",
    caption:
      "the hand-on-chin stare from B Lou's 'AI more water' post, still thinking about how to make more water",
    keywords: ["b lou", "blou", "ai more water", "ai water", "thinking face"],
    sections: [75],
  },
  {
    id: "tyler-best-verse-story",
    url: "/lore/tyler-best-verse-story.jpg",
    caption:
      "Tyler, The Creator's story over the 'Baby Breath' cover, Oct 1, 2026: his best verse of all time, 'prolly top 25 in rap history,' 'shall be studied,' '10/10 real grown man bars'",
    keywords: ["tyler", "tyler the creator", "baby breath", "best verse", "shall be studied", "grown man bars", "quavo", "qromelife"],
    sections: [76],
  },
  {
    id: "tyler-best-verse-laughing",
    url: "/lore/tyler-best-verse-laughing.jpg",
    caption:
      "Tyler, The Creator laughing with his eyes shut, posted alongside his 'best verse of all time' claim, the day before everyone heard it",
    keywords: ["tyler", "tyler the creator", "best verse", "laughing", "baby breath"],
    sections: [76],
  },
  {
    id: "gregorian-1582-calendar",
    url: "/lore/gregorian-1582-calendar.jpg",
    caption:
      "October 1582 on a phone calendar: Monday 1, Tuesday 2, Wednesday 3, Thursday 4, Friday 15. Ten days, gone",
    keywords: ["gregorian", "julian", "calendar", "1582", "october 15", "missing days", "dexerto", "444 years"],
    sections: [77],
  },
  {
    id: "gregorian-pope-gregory",
    url: "/lore/gregorian-pope-gregory.jpg",
    caption:
      "Pope Gregory XIII, the man who decided October 5 through 14, 1582 would not be happening",
    keywords: ["pope gregory", "gregory xiii", "gregorian", "pope", "calendar", "1582"],
    sections: [77],
  },
  {
    id: "gas-war-powder-springs-line",
    url: "/lore/gas-war-powder-springs-line.jpg",
    caption:
      "The Powder Springs gas war: the Sunoco sign at $1.24, then $0.99, next to a line of cars backed up down the road",
    keywords: ["gas war", "gas", "gas prices", "powder springs", "georgia", "sunoco", "amoco", "99 cents", "traffic"],
    sections: [78],
  },
  {
    id: "gas-war-powder-springs-1-19",
    url: "/lore/gas-war-powder-springs-1-19.jpg",
    caption:
      "The neighbor's sign at $1.19 regular while Sunoco sits at $0.99. Diesel still $5.69, because nobody was fighting over diesel",
    keywords: ["gas war", "gas prices", "powder springs", "welcome foods", "amoco", "1.19", "price war"],
    sections: [78],
  },
  {
    id: "gas-war-powder-springs-99-cents",
    url: "/lore/gas-war-powder-springs-99-cents.jpg",
    caption:
      "Sunoco #4150 at night, $0.99 a gallon: \"GAS WAR IN POWDER SPRINGS, GA is still going\"",
    keywords: ["gas war", "99 cents", "cheap gas", "sunoco", "powder springs", "georgia", "gas station"],
    sections: [78],
  },
  {
    id: "ai-farm-girl-edimar",
    url: "/lore/ai-farm-girl-edimar.jpg",
    caption:
      "Edimar Rocha Martins, 49, suitcase in hand after selling everything and riding a bus 1,200 miles to meet a woman who was never there",
    keywords: ["ai girlfriend", "catfish", "brazil", "bricklayer", "edimar", "belo horizonte", "dream woman", "sold everything"],
    sections: [79],
  },
  {
    id: "ai-farm-girl-jessica",
    url: "/lore/ai-farm-girl-jessica.jpg",
    caption:
      "\"Jéssica Fazendeira,\" the AI-generated farm girl with 300,000 TikTok followers who promised you'd never work again",
    keywords: ["ai girlfriend", "ai generated", "ai woman", "jessica", "fazendeira", "farm girl", "tiktok", "deepfake"],
    sections: [79],
  },
  {
    id: "kimchi-be-the-next-kimchi",
    url: "/lore/kimchi-be-the-next-kimchi.jpg",
    caption:
      "Pump.fun's street poster: \"PILL YOUR FRIENDS,\" and a pill on a tongue that says \"be the next kimchi\"",
    keywords: ["kimchi", "be the next kimchi", "pump.fun", "pumpfun", "billboard", "poster", "pill your friends"],
    sections: [80],
  },
  {
    id: "kimchi-ferrari",
    url: "/lore/kimchi-ferrari.jpg",
    caption:
      "Kimchi in a Ferrari at golden hour, the kind of captionless flex his whole feed is made of",
    keywords: ["kimchi", "kimchi1x", "ferrari", "supercar", "flex", "trader"],
    sections: [80],
  },
  {
    id: "kimchi-42m-portfolio",
    url: "/lore/kimchi-42m-portfolio.jpg",
    caption:
      "Kimchi's Pump.fun balance an hour after signing: $42,571,858.56, up 1,479.5%, almost none of it sellable",
    keywords: ["kimchi", "32 million", "42 million", "paper gains", "portfolio", "pump.fun", "pumpfun"],
    sections: [80],
  },
  {
    id: "kimchi-bio-pioneerfnf",
    url: "/lore/kimchi-bio-pioneerfnf.jpg",
    caption:
      "@kimchi1x two days after joining Pump.fun: the bio now says @pioneerfnf",
    keywords: ["kimchi", "kimchi1x", "bio", "pioneer", "pioneerfnf", "hacked", "left pump"],
    sections: [80],
  },
  {
    id: "kimchi-jet-grin",
    url: "/lore/kimchi-jet-grin.jpg",
    caption:
      "Kimchi grinning on a private jet, the photo that went around with the \"not actually hacked\" speculation",
    keywords: ["kimchi", "grin", "private jet", "hacked", "trollface grin"],
    sections: [80],
  },
  {
    id: "umadbro-shop-new-row",
    url: "/lore/umadbro-shop-new-row.jpg",
    caption:
      "GO2WAR's umadbro.shop screenshot (Oct 22, 2026): four new products in a row, the HIGHER rolling tray, the mango air freshener, the Joker trucker hat and the realistic human trollface balaclava",
    keywords: ["umadbro", "umadbro.shop", "merch", "new drop", "go2war", "adermaz0ne", "halloween"],
    sections: [81],
  },
  {
    id: "umadbro-joker-hat-front",
    url: "/lore/umadbro-joker-hat-front.jpg",
    caption:
      "The Troll \"Joker\" Trucker Hat: white crown, black mesh, purple brim, and a trollface in Joker hair and grin on the front",
    keywords: ["joker", "joker hat", "trucker hat", "hat", "cap", "umadbro", "merch"],
    sections: [81],
  },
  {
    id: "umadbro-joker-hat-lining",
    url: "/lore/umadbro-joker-hat-lining.jpg",
    caption:
      "Inside the Joker trucker hat: \"U MAD BRO?\" printed along every seam tape",
    keywords: ["joker hat", "trucker hat", "u mad bro", "lining", "umadbro"],
    sections: [81],
  },
  {
    id: "umadbro-joker-hat-strap",
    url: "/lore/umadbro-joker-hat-strap.jpg",
    caption:
      "The Joker trucker hat's snap strap with its little \"U MAD BRO?\" tag",
    keywords: ["joker hat", "trucker hat", "snapback", "strap", "u mad bro"],
    sections: [81],
  },
  {
    id: "umadbro-balaclavas-bagged",
    url: "/lore/umadbro-balaclavas-bagged.jpg",
    caption:
      "GO2WAR's \"GM\" photo: a stack of realistic human trollface balaclavas, still in their plastic bags, next to a keyboard",
    keywords: ["balaclava", "mask", "human troll face", "realistic", "nightmare fuel", "halloween", "go2war", "umadbro"],
    sections: [81],
  },
  {
    id: "bieber-love-hurts-video",
    url: "/lore/bieber-love-hurts-video.jpg",
    caption:
      "A frame of Justin Bieber's captionless 12-second video, posted 35 minutes before the $carti coin was minted",
    keywords: ["bieber", "justin bieber", "love hurts", "carti", "playboi carti", "video"],
    sections: [82],
  },
  {
    id: "carti-bio-pumpfun",
    url: "/lore/carti-bio-pumpfun.jpg",
    caption:
      "@playboicarti, 3.6M followers, with \"@pumpfun\" in the bio, a pump.fun coin link and a post that's just the coin's chart card",
    keywords: ["carti", "playboi carti", "hacked", "pumpfun", "pump.fun", "bio", "carti coin"],
    sections: [82],
  },
  {
    id: "carti-coin-pump-chart",
    url: "/lore/carti-coin-pump-chart.jpg",
    caption:
      "The $carti coin an hour in: $302.7K market cap, up 7,794%, 1,462 holders",
    keywords: ["carti", "carti coin", "chart", "pump", "memecoin", "solana"],
    sections: [82],
  },
  {
    id: "carti-bio-before-after",
    url: "/lore/carti-bio-before-after.jpg",
    caption:
      "Carti's profile before and after: @pumpfun and the coin link circled, then gone, and \"1 Following\" back to 0",
    keywords: ["carti", "bio", "before after", "pumpfun", "removed", "hack", "deleted"],
    sections: [82],
  },
  {
    id: "carti-coin-96-percent",
    url: "/lore/carti-coin-96-percent.jpg",
    caption:
      "carti/SOL: one green candle to $1.2M, one red one back down, -96.34%",
    keywords: ["carti", "rug", "dump", "chart", "96%", "crash", "candle"],
    sections: [82],
  },
  {
    id: "carti-lone-wolf-avatar",
    url: "/lore/carti-lone-wolf-avatar.jpg",
    caption:
      "Carti's new profile picture after the coin came down: a shirtless muscle wolf in goggles",
    keywords: ["carti", "wolf", "lone wolf", "avatar", "pfp", "profile picture"],
    sections: [82],
  },
  {
    id: "carti-beanie-dog",
    url: "/lore/carti-beanie-dog.jpg",
    caption:
      "What @playboicarti posted a minute later, with no caption: a dog in a beanie and a jacket on a couch",
    keywords: ["carti", "dog", "beanie", "meme", "post", "no caption"],
    sections: [82],
  },
  {
    // A troll post, not a real text: nobody knows who made it.
    id: "kimchi-carti-hack-imessage",
    url: "/lore/kimchi-carti-hack-imessage.jpg",
    caption:
      "A FAKE, TROLL POST from Carti's replies, maker unknown: a phone showing an iMessage thread with \"Kimchi\" at 9:12 PM. Kimchi: \"You ready to hack my shit?\" Reply: \"yeah\". Kimchi: \"Bet, carti said he down too\". @troll_runner reposted it quoting the dog post. Always call it a joke when showing it",
    keywords: ["kimchi", "carti", "hack", "imessage", "text", "fake", "down too", "ready to hack"],
    sections: [82],
  },
  {
    id: "kimchi-bio-pumpfun-again",
    url: "/lore/kimchi-bio-pumpfun-again.jpg",
    caption:
      "@kimchi1x the same night: the bio says @pumpfun again, and the location says \"project kimchi\"",
    keywords: ["kimchi", "kimchi1x", "bio", "pumpfun", "back", "pioneerfnf", "project kimchi"],
    sections: [82],
  },
  {
    id: "kimchi-jasontheween-clip",
    url: "/lore/kimchi-jasontheween-clip.jpg",
    caption:
      "A frame from Trenches Insider's clip of Jasontheween saying he never met Kimchi: \"I heard that he got exposed\"",
    keywords: ["kimchi", "jasontheween", "jason", "exposed", "never met", "larp"],
    sections: [80],
  },
  {
    id: "carti-fazeblaze-loss-card",
    url: "/lore/carti-fazeblaze-loss-card.jpg",
    caption:
      "FaZe Blaze's Pump.fun PnL card on $CARTI: $1.89K in at a $659K average entry, -$1,231 (-64.99%), \"Join with code: @FaZeBlaze\"",
    keywords: ["fazeblaze", "faze", "blaze", "rugged", "carti", "pnl", "loss"],
    sections: [82],
  },
  {
    id: "carti-coin-51m-chart",
    url: "/lore/carti-coin-51m-chart.jpg",
    caption:
      "The $carti chart at 51 minutes old, posted by @catalogging: the climb, the top and the long bleed, with \"Dev 2.0%\" in the header",
    keywords: ["carti", "chart", "market cap", "dev", "catalogging", "pump"],
    sections: [82],
  },
  {
    id: "carti-jade-onchain-trace",
    url: "/lore/carti-jade-onchain-trace.jpg",
    caption:
      "Jade's on-chain trace of $carti: \"70 wallets. One address. Same second.\" 2,221 SOL swept, ~2,046 SOL net, -98% from the peak",
    keywords: ["carti", "70 wallets", "same second", "sweep", "bundle", "jade", "binance", "trace"],
    sections: [82],
  },
  {
    id: "bloom-just-at-us",
    url: "/lore/bloom-just-at-us.jpg",
    caption:
      "The GIF on Bloom's \"Just @ us 😎\" reply, three and a half hours before the drain: a man in a suit, arms out, grinning",
    keywords: ["bloom", "bloomtrading", "just at us", "brag", "trading bot", "gif"],
    sections: [83],
  },
  {
    id: "bloom-drain-transfers",
    url: "/lore/bloom-drain-transfers.jpg",
    caption:
      "Saint_pablo's \"everyone is getting drained\" screenshot: the drainer's incoming transfers, casino847's and Domy's wallets among them",
    keywords: ["bloom", "drain", "drained", "transfers", "casino847", "domy", "wallets", "7ky8qx"],
    sections: [83],
  },
  {
    id: "bloom-domy-wallets",
    url: "/lore/bloom-domy-wallets.jpg",
    caption:
      "Domy's Bloom chat, \"Wallets Settings\": the six wallets he'd imported, the same ones that got drained",
    keywords: ["bloom", "domy", "domyxbt", "wallets", "telegram", "drained", "kolscan"],
    sections: [83],
  },
  {
    id: "bloom-discord-rapid",
    url: "/lore/bloom-discord-rapid.jpg",
    caption:
      "Bloom's Discord, via Hiruzen: staffer Bata says \"rapid is draining, not us\"",
    keywords: ["bloom", "discord", "rapid", "rapid launch", "not us", "bata", "blame"],
    sections: [83],
  },
  {
    id: "bloom-drain-grx-transfers",
    url: "/lore/bloom-drain-grx-transfers.jpg",
    caption:
      "Two of the drain's transfers into 7kY8…p8BQ, via Hiruzen: 201.1 SOL from a GRX wallet and 640.5 SOL from Domy's KOLSCAN wallet",
    keywords: ["bloom", "drain", "grx", "transfers", "640", "domy", "7ky8qx"],
    sections: [83],
  },
  {
    id: "bloom-security-statement",
    url: "/lore/bloom-security-statement.jpg",
    caption:
      "Bloom's card on its October 26 statement: \"Security Incident Update / Official Statement\" (49 wallets, 9 users, about 9,408 SOL, full reimbursement promised)",
    keywords: ["bloom", "statement", "security incident", "rce", "refund", "reimbursed", "9408"],
    sections: [83],
  },
  {
    id: "bloom-refunds-processed",
    url: "/lore/bloom-refunds-processed.jpg",
    caption:
      "Bloom's \"Refunds Sent.\" card on its 1:37 PM October 26 post saying 9,408 SOL went back to all 9 users (the nine linked transfers add up to 9,399.23 SOL)",
    keywords: ["bloom", "refunds sent", "refund", "refunded", "9408", "solscan", "casino847"],
    sections: [83],
  },
  {
    id: "troll-anthrobbing-ant-bridge",
    url: "/lore/troll-anthrobbing-ant-bridge.jpg",
    caption:
      "@Troll_'s \"anthrobbing\": trollface ants linking into a bridge up a chart line to a leaf, a rage-face worm left on the ground",
    keywords: ["anthrobbing", "anthropic", "ant", "ants", "ipo", "s-1", "claude", "worm"],
    sections: [84],
  },
  {
    id: "troll-sharing-is-caring",
    url: "/lore/troll-sharing-is-caring.jpg",
    caption:
      "@Troll_'s \"sharing is caring!\": a puppet in a suit with an orange starburst coin for a head, trollface in the middle, cash raining down",
    keywords: ["sharing is caring", "puppet", "coin", "money", "anthropic", "claude", "starburst"],
    sections: [84],
  },
  {
    id: "lore-84-photo",
    url: "/lore/lore-84-photo.png",
    caption:
      "A smiling man in round blue glasses, a dark suit and a patterned tie at a crowded indoor event",
    keywords: ["anthropic", "ipo", "s-1", "photo"],
    sections: [84],
  },
  {
    id: "squads-standings-after-chubbicorns",
    url: "/lore/squads-standings-after-chubbicorns.jpg",
    caption:
      "Pump.fun's Squads standings after Chubbicorns were taken off: Underground 1st at +$171,421.12, Dabal 2nd, Synagogue 3rd, \"TOP 3 GET PAID\" under them (from @slurptoshi_'s post)",
    keywords: ["squads", "squad", "standings", "leaderboard", "underground", "dabal", "chubbicorns", "competition"],
    sections: [85],
  },
  {
    id: "fpump-chart-7m-spike",
    url: "/lore/fpump-chart-7m-spike.jpg",
    caption:
      "\"Fuck Pumpfun\" (FPUMP) open in the Pump.fun app: a green spike to about $7M and back down to $986.94K (posted by @troll_runner, \"oh shit\")",
    keywords: ["fpump", "fuck pumpfun", "chart", "spike", "robinhood", "chubbicorns"],
    sections: [85],
  },
  {
    id: "chubbicorns-squad-first-place",
    url: "/lore/chubbicorns-squad-first-place.webp",
    caption:
      "Chubbicorns in the Pump.fun app while they were winning: $193,212.46, +$205,879.99 #1, and the \"Fuck Pumpfun\" row at $211.75K, +$205,881 (+3,504.9%)",
    keywords: ["chubbicorns", "squad", "first place", "#1", "fpump", "fuck pumpfun", "205k", "competition"],
    sections: [85],
  },
  {
    id: "chubbicorns-squad-page",
    url: "/lore/chubbicorns-squad-page.jpg",
    caption:
      "Chubbicorns' Pump.fun squad page at 7:10 PM Pacific: chubby unicorns in prison orange, 3 members (Dtrain22k owner, frizzaud, chubbicorn33), $FPUMP still in the holdings at +$38,707.53",
    keywords: ["chubbicorns", "squad", "dtrain22k", "frizzaud", "chubbicorn33", "fpump", "members"],
    sections: [85],
  },
  {
    id: "chubbicorns-cup-rank-489",
    url: "/lore/chubbicorns-cup-rank-489.jpg",
    caption:
      "The same squad page on the \"Cup\" contest view: $FPUMP gone from the holdings, the squad at -$2.88 (-4.8%), rank #489",
    keywords: ["chubbicorns", "cup", "rank", "489", "struck", "zeroed", "disqualified", "squad"],
    sections: [85],
  },
  {
    id: "standard-reserve-867-banks",
    url: "/lore/standard-reserve-867-banks.jpg",
    caption:
      "Standard Reserve's app on October 26: 867 active banks of 1,060 charters minted, 193 burned (posted by @dtrain22k to show where $FPUMP's 80% went)",
    keywords: ["standard reserve", "charter", "charters", "banks", "867", "airdrop", "vault", "bundle", "fpump"],
    sections: [85],
  },
  {
    id: "standard-charter-drops-fpump",
    url: "/lore/standard-charter-drops-fpump.jpg",
    caption:
      "A Standard Reserve charter's drops list: 2.03M FPUMP \"Paid in full when this charter exits,\" above SNP, RING, AGEM and SKARLY (posted by @dtrain22k)",
    keywords: ["standard reserve", "charter drops", "airdrop", "fpump", "exit", "burn", "bundle", "vault"],
    sections: [85],
  },
  {
    id: "fpump-holders-vault-80pct",
    url: "/lore/fpump-holders-vault-80pct.jpg",
    caption:
      "$FPUMP's holder list on Blockscout: one vault contract with 79.96% (the charter airdrop), then Dtrain22k's wallet at 2.26% and frizzaud's at 1.52%",
    keywords: ["fpump", "holders", "holder list", "vault", "80%", "bundle", "bundled", "blockscout", "airdrop"],
    sections: [85],
  },
  {
    id: "troll-runner-discretion-reply",
    url: "/lore/troll-runner-discretion-reply.jpg",
    caption:
      "A frame of the reaction GIF in @troll_runner's reply to Pump.fun's head of content: \"ohhhh so we're just gonna pick and choose 'at our discretion'\"",
    keywords: ["at our discretion", "pick and choose", "troll_runner", "json1444", "reply", "chubbicorns"],
    sections: [85],
  },
  {
    id: "justin-sun-pepe-face",
    url: "/lore/justin-sun-pepe-face.jpg?v=2",
    caption:
      "An edit, not a photo: Justin Sun at a conference table, lanyard and mic in front of him, with his face and hands painted Pepe green and Pepe's droopy red lips",
    keywords: ["justin sun", "pepe", "pepe face", "green", "frog", "edit", "meme"],
    sections: [86],
  },
  {
    id: "arkham-sun-pepe-poloniex-hot-wallet",
    url: "/lore/arkham-sun-pepe-poloniex-hot-wallet.jpg",
    caption:
      "Arkham transfers for a wallet it predicts is Justin Sun's, with one row boxed in red: 4.65T PEPE ($20.32M) from \"Poloniex: Hot Wallet\" 18 hours earlier (from @arkham's post)",
    keywords: ["justin sun", "pepe", "arkham", "poloniex", "hot wallet", "transfer", "4.65t"],
    sections: [86],
  },
  {
    id: "arkham-sun-pepe-poloniex-safe",
    url: "/lore/arkham-sun-pepe-poloniex-safe.jpg",
    caption:
      "Arkham's PEPE transfers into Justin Sun's \"trypoly\" address: 7.2T PEPE ($28.44M) from \"Poloniex: Gnosis Safe\" nine days earlier, boxed in red, over four small buys from two years back (from @arkham's post)",
    keywords: ["justin sun", "pepe", "arkham", "poloniex", "gnosis safe", "trypoly", "7.2t"],
    sections: [86],
  },
  {
    id: "arkham-sun-entity-page",
    url: "/lore/arkham-sun-entity-page.jpg",
    caption:
      "Justin Sun's Arkham entity page: $2.31B across 211 addresses, a red-eyed Bored Ape avatar, 7.268T PEPE ($31.25M) in the portfolio and a PEPE balance line flat since 2024 that shoots straight up in September 2026 (from @arkham's post)",
    keywords: ["justin sun", "pepe", "arkham", "entity", "portfolio", "chart", "bored ape", "wlfi"],
    sections: [86],
  },
  {
    id: "arkham-sun-visualizer",
    url: "/lore/arkham-sun-visualizer.jpg",
    caption:
      "Arkham's visualizer around Justin Sun: a web of his own wallets (each with the same ape avatar) wired to Poloniex, HTX, Binance, Aave and Sky, $16.8B of transfer volume across 9 chains (from @arkham's post)",
    keywords: ["justin sun", "arkham", "visualizer", "wallets", "poloniex", "htx", "graph"],
    sections: [86],
  },
  {
    id: "mudwater-packs-floor-drop",
    url: "/lore/mudwater-packs-floor-drop.jpg",
    caption:
      "The Mudwater Packs collection page during the dump: floor 0.604 SOL, -25.9% on the day, top offer 0.56 SOL, 294.43 SOL of 24-hour volume (from @BR4ted's post)",
    keywords: ["mudwater", "packs", "floor", "swamp origins", "bored ape", "apestr", "exploit"],
    sections: [87],
  },
  {
    id: "apestrategy-holdings-21-apes",
    url: "/lore/apestrategy-holdings-21-apes.jpg",
    caption:
      "ApeStrategy's holdings during the swap: 21 Bored Apes, every one marked 0.000 ETH, over \"ApeStrategy sold 98 NFTs for 832.949 ETH, realizing -64.935 ETH profit\" (from @a_raving_ape's post)",
    keywords: ["apestrategy", "apestr", "bored ape", "holdings", "tokenworks", "strategy", "exploit"],
    sections: [87],
  },
  {
    id: "mudwater-packs-dumped-0-6-sol",
    url: "/lore/mudwater-packs-dumped-0-6-sol.jpg",
    caption:
      "Mudwater Pack sales, one every five seconds or so, all 0.60 SOL, all from 7VpfKg to lowonsol (from @a_raving_ape's post)",
    keywords: ["mudwater", "packs", "sales", "dump", "7vpfkg", "lowonsol", "0.6 sol"],
    sections: [87],
  },
  {
    id: "mudwater-exploiter-wallet-154",
    url: "/lore/mudwater-exploiter-wallet-154.png",
    caption:
      "The swapping wallet 7VpfKg…2waM on OpenSea: 154 items left, all Mudwater Packs, $12.7K portfolio with a spike at the end, $3,443 in SOL (from @Aegidos's post)",
    keywords: ["mudwater", "exploiter", "wallet", "7vpfkg", "opensea", "154", "packs"],
    sections: [87],
  },
  {
    id: "musk-padilla-investigate-your-wiener",
    url: "/lore/musk-padilla-investigate-your-wiener.png",
    caption:
      "Sen. Alex Padilla: \"INVESTIGATE ELON MUSK.\" Elon Musk, under it: \"Investigate your wiener\" (6:34 PM, Oct 26, 2026, 125.5K likes)",
    keywords: ["padilla", "musk", "elon", "wiener", "investigate", "senator", "starlink"],
    sections: [88],
  },
  {
    id: "musk-interesting-druckenmiller",
    url: "/lore/musk-interesting-druckenmiller.png",
    caption:
      "Elon Musk quotes Stan Druckenmiller's Trade[XYZ] / ICE / Hyperliquid post with one word: \"Interesting\" (8:08 AM, Oct 29, 2026)",
    keywords: ["musk", "elon", "interesting", "druckenmiller", "hyperliquid", "ice", "trade xyz", "perps"],
    sections: [89],
  },
  {
    id: "hype-oct29-interesting-chart",
    url: "/lore/hype-oct29-interesting-chart.png",
    caption:
      "HYPE on Hyperliquid, Oct 29, 2026 (Pacific): flat at $79.3 until the ICE + Trade[XYZ] deal at 3:30 AM, nothing on Druckenmiller's post, then $91.0 to $94.6 in four minutes after Musk's \"Interesting\" at 8:08 AM",
    keywords: ["hype", "hyperliquid", "chart", "price", "musk", "interesting", "ice"],
    sections: [89],
  },
  {
    id: "polymarket-notch-candy-room-reply",
    url: "/lore/polymarket-notch-candy-room-reply.png",
    caption:
      "Polymarket: Notch lists his Beverly Hills mansion for $70M, \"& a $200,000 candy room.\" @aethernet_port, under it: \"Of course his fat ass had a candy room\" (10:19 AM, Oct 29, 2026)",
    keywords: ["notch", "minecraft", "persson", "mansion", "candy room", "polymarket", "beverly hills"],
    sections: [90],
  },
  {
    id: "polymarket-notch-photo",
    url: "/lore/polymarket-notch-photo.jpg",
    caption:
      "Markus \"Notch\" Persson in his Mojang days, black fedora and tee: the photo Polymarket ran with the $70M listing",
    keywords: ["notch", "minecraft", "persson", "fedora", "mojang"],
    sections: [90],
  },
  {
    id: "notch-trousdale-mansion",
    url: "/lore/notch-trousdale-mansion.jpg",
    caption:
      "Notch's Trousdale Estates house in Beverly Hills, bought for $70M in 2014 and listed for $70M again in October 2026",
    keywords: ["notch", "mansion", "beverly hills", "trousdale", "house", "70 million"],
    sections: [90],
  },
  {
    id: "starplatinum-polymarket-drained",
    url: "/lore/starplatinum-polymarket-drained.png",
    caption:
      "StarPlatinum: \"Polymarket users are getting drained RIGHT NOW\", $2.68M reportedly gone in an hour, with the Relay swap screenshot (11:15 AM, Oct 29, 2026)",
    keywords: ["polymarket", "drained", "hack", "exploit", "starplatinum", "stolen", "wallet"],
    sections: [91],
  },
  {
    id: "polymarket-made-whole-statement",
    url: "/lore/polymarket-made-whole-statement.png",
    caption:
      "@PolymarketTrade: \"One of our 3rd party providers was compromised\"; \"Anyone who has been impacted will be made whole\" (11:33 AM, Oct 29, 2026)",
    keywords: ["polymarket", "made whole", "refund", "statement", "hack", "third party"],
    sections: [91],
  },
  {
    id: "polymarket-drain-relay-swaps",
    url: "/lore/polymarket-drain-relay-swaps.jpg",
    caption:
      "Relay swaps from drained Polymarket deposit wallets: USDC.e in, POL out, every one to recipient 0x3F...fc18",
    keywords: ["polymarket", "relay", "usdc", "pol", "swaps", "drain"],
    sections: [91],
  },
  {
    id: "polymarket-drainer-polygonscan",
    url: "/lore/polymarket-drainer-polygonscan.png",
    caption:
      "Polygonscan, 12:30 PM Oct 29, 2026: the Polymarket drainer wallet empty after sending out 18.6M, 4.3M and 5.7M POL, with lookalike dust arriving after each send (address poisoning)",
    keywords: ["polymarket", "polygonscan", "drainer", "address poisoning", "dust", "pol"],
    sections: [91],
  },
  {
    id: "cz-email-tip-elon-fire-laugh",
    url: "/lore/cz-email-tip-elon-fire-laugh.png",
    caption:
      "CZ, Oct 28: \"Do NOT click links in emails. Do NOT download attachments.\" Elon, the night after the $6.3B hack: 🔥😂 (10:10 PM, Oct 29, 2026)",
    keywords: ["cz", "elon", "musk", "binance", "email", "links", "attachments", "laptop", "hack", "fire", "laughing"],
    sections: [92],
  },
  {
    id: "elon-everyday-is-zeroday",
    url: "/lore/elon-everyday-is-zeroday.png",
    caption:
      "Elon quotes The Kobeissi Letter's \"Binance has been hacked\": \"Everyday is Zeroday\" (3:33 PM, Oct 29, 2026; 54.8K likes)",
    keywords: ["elon", "musk", "zeroday", "zero-day", "kobeissi", "binance", "hack"],
    sections: [92],
  },
  {
    id: "nikita-bier-safu",
    url: "/lore/nikita-bier-safu.png",
    caption:
      "X's head of product Nikita Bier on the Binance hack: \"What a time to be alive.\" (3:00 PM, Oct 29, 2026)",
    keywords: ["nikita bier", "x", "safu", "cz", "binance", "dubai", "hack"],
    sections: [92],
  },
  {
    id: "elon-superintelligence-agents",
    url: "/lore/elon-superintelligence-agents.png",
    caption:
      "Elon under cryptoblaney's Aave thread: \"Super intelligence agents will at some point do this to gain currency for themselves, not a human\" (8:12 PM, Oct 29, 2026)",
    keywords: ["elon", "musk", "ai", "agents", "superintelligence", "aave", "binance", "hack"],
    sections: [92],
  },
  {
    id: "yi-he-major-shareholder",
    url: "/lore/yi-he-major-shareholder.png",
    caption:
      "Yi He under CZ's \"Please stop\": \"Reporting to the major shareholder ... we do not yet need to sell the SpaceX shares you are bullish on.💁‍♀️\" (2:33 AM, Oct 30, 2026)",
    keywords: ["yi he", "cz", "elon", "spacex", "spcx", "major shareholder", "binance"],
    sections: [92],
  },
  {
    id: "cz-rough-math-spcx",
    url: "/lore/cz-rough-math-spcx.png",
    caption:
      "CZ's rough math: \"$6.x b hack, $3b frozen, $1.x b SAFU fund. Gap is about $2b, we have $1.x billion in SPCX alone.\" (2:33 AM, Oct 30, 2026)",
    keywords: ["cz", "rough math", "safu", "spcx", "spacex", "gap", "binance", "elon"],
    sections: [92],
  },
  {
    id: "cz-elon-bad-time-to-troll",
    url: "/lore/cz-elon-bad-time-to-troll.png",
    caption:
      "Elon's 😬, then CZ: \"Elon, have a lot of respect for you, but bad time to troll. Please stop.\" (2:19 AM, Oct 30, 2026)",
    keywords: ["cz", "elon", "musk", "binance", "bad time to troll", "please stop", "spcx", "spacex", "twitter"],
    sections: [92],
  },
  {
    id: "cz-will-cover-bruh",
    url: "/lore/cz-will-cover-bruh.png",
    caption:
      "CZ quotes 0xngmi's ~$1bn estimate: \"Loss might be a bit higher than that, but will cover. 🙏\"; Baseball Bonk Inu replies \"bruh\" with SBF's tweet (Oct 29, 2026)",
    keywords: ["cz", "binance", "will cover", "bruh", "0xngmi", "sbf", "hack"],
    sections: [92],
  },
  {
    id: "bruh-sbf-ftx-has-enough",
    url: "/lore/bruh-sbf-ftx-has-enough.png",
    caption:
      "The screenshot in the bruh reply: SBF, Nov 7, 2022, \"FTX has enough to cover all client holdings\", underlined in red",
    keywords: ["sbf", "ftx", "bankman-fried", "cover all client holdings", "bruh"],
    sections: [92],
  },
  {
    id: "cz-user-funds-safe",
    url: "/lore/cz-user-funds-safe.png",
    caption:
      "CZ: \"User funds are safe! It does look like a hack on Binance,\" thanking Tether (~$971m) and Circle (~$823m) for the freezes (2:15 PM, Oct 29, 2026)",
    keywords: ["cz", "binance", "user funds are safe", "hack", "tether", "circle", "freeze"],
    sections: [92],
  },
  {
    id: "watcherguru-binance-hacked",
    url: "/lore/watcherguru-binance-hacked.png",
    caption:
      "Watcher.Guru: \"World's largest crypto exchange Binance hacked with over $5.6 billion stolen\", coin by coin (2:42 PM, Oct 29, 2026)",
    keywords: ["binance", "hack", "watcher guru", "stolen", "5.6 billion"],
    sections: [92],
  },
  {
    id: "marketinsider-binance-bybit",
    url: "/lore/marketinsider-binance-bybit.png",
    caption:
      "Market Insider: the record was Bybit's $1.5B; Binance \"just hacked for over $5.8B\", nearly 4x (Oct 29, 2026)",
    keywords: ["binance", "bybit", "biggest hack", "record", "cz"],
    sections: [92],
  },
  {
    id: "binance-drainer-etherscan",
    url: "/lore/binance-drainer-etherscan.jpg",
    caption:
      "Etherscan: the Binance drainer, funded by Binance 14, holding $1.54B in 63 tokens and sending out 195,460 ETH (Jacob King, Oct 29, 2026)",
    keywords: ["binance", "etherscan", "drainer", "hack", "eth", "binance 14"],
    sections: [92],
  },
  {
    id: "binance-14-eth-transfer",
    url: "/lore/binance-14-eth-transfer.jpg",
    caption:
      "Etherscan: Binance 14 transfers 167,464.25 ETH to the attacker at 8:24 PM UTC, Oct 29, 2026",
    keywords: ["binance", "binance 14", "167464 eth", "transfer", "etherscan", "hack"],
    sections: [92],
  },
  {
    id: "binance-hot-wallet-arkham",
    url: "/lore/binance-hot-wallet-arkham.jpg",
    caption:
      "Arkham: a Binance hot wallet's balance goes from $1.5B to nothing on Oct 29, 2026, \"dropped by 99.98%\" (Bull Theory)",
    keywords: ["binance", "arkham", "hot wallet", "balance", "hack", "chart"],
    sections: [92],
  },
  {
    id: "bulltheory-binance-crash",
    url: "/lore/bulltheory-binance-crash.jpg",
    caption: "Bull Theory's graphic for the Binance hack: the logo over a red candle chart falling off a cliff",
    keywords: ["binance", "crash", "chart", "red candles", "bull theory"],
    sections: [92],
  },
  {
    id: "logan-paul-crypto-scam-clip",
    url: "/lore/logan-paul-crypto-scam-clip.png",
    caption:
      "Logan Paul on stream after Mike Majlak reads out the Binance hack: \"I don't trust crypto. It's a scam\" (clipped by Jack, Oct 29, 2026)",
    keywords: ["logan paul", "mike majlak", "crypto is a scam", "cryptozoo", "binance"],
    sections: [92],
  },
  {
    id: "wataminoodles-life-after-hack",
    url: "/lore/wataminoodles-life-after-hack.png",
    caption:
      "wataminoodles: \"Life after the binance hack\", three made-up pictures of a well-paid Kim Jong Un (4:14 AM, Oct 30, 2026)",
    keywords: ["kim jong un", "north korea", "life after", "binance", "hack", "meme", "wataminoodles"],
    sections: [92],
  },
  {
    id: "kim-after-hack-ferrari",
    url: "/lore/kim-after-hack-ferrari.jpg",
    caption:
      "\"Life after the binance hack\" 1/3: Kim in a Ferrari with cream seats (fake picture, wataminoodles)",
    keywords: ["kim jong un", "ferrari", "north korea", "binance", "meme"],
    sections: [92],
  },
  {
    id: "kim-after-hack-desert-daybed",
    url: "/lore/kim-after-hack-desert-daybed.jpg",
    caption:
      "\"Life after the binance hack\" 2/3: Kim on a desert daybed in white socks, fruit bowl beside him (fake picture, wataminoodles)",
    keywords: ["kim jong un", "desert", "resort", "socks", "north korea", "binance", "meme"],
    sections: [92],
  },
  {
    id: "kim-after-hack-infinity-pool",
    url: "/lore/kim-after-hack-infinity-pool.jpg",
    caption:
      "\"Life after the binance hack\" 3/3: Kim at an infinity pool at sunset with a Birkin bag (fake picture, wataminoodles)",
    keywords: ["kim jong un", "infinity pool", "birkin", "sunset", "north korea", "binance", "meme"],
    sections: [92],
  },
  {
    id: "chasm-heron-brook-rule",
    url: "/lore/chasm-heron-brook-rule.png",
    caption:
      "chasm: \"ANTHROPIC IS CRACKING DOWN ON VIDEO GAME REWRITES 🚨\", the post that found the tengu_heron_brook rule (12:01 AM, Oct 30, 2026)",
    keywords: ["chasm", "anthropic", "claude code", "tengu_heron_brook", "games", "rewrites", "rule"],
    sections: [93],
  },
  {
    id: "heron-brook-claude-json",
    url: "/lore/heron-brook-claude-json.jpg",
    caption:
      "chasm's screenshot: line 2937 of .claude.json, \"tengu_heron_brook\": \"... Don't build a recreation of a specific existing game, even if it is renamed or called original.\"",
    keywords: ["claude.json", "config", "tengu_heron_brook", "flag", "games", "recreation", "renamed"],
    sections: [93],
  },
  {
    id: "platinumfx-roblox-heart-attack",
    url: "/lore/platinumfx-roblox-heart-attack.png",
    caption:
      "PlatinumFX quotes chasm: \"Roblox devs are gonna have a heart attack.\" (3:34 AM, Oct 30, 2026)",
    keywords: ["platinumfx", "roblox", "heart attack", "claude code", "games", "clones"],
    sections: [93],
  },
  {
    id: "tokengremlin-fable-3d",
    url: "/lore/tokengremlin-fable-3d.png",
    caption:
      "Token Gremlin: \"Bad news for Claude users who make games.\" (5:08 AM, Oct 30, 2026)",
    keywords: ["token gremlin", "claude", "games", "3d", "recreation"],
    sections: [93],
  },
  {
    id: "kimmonismus-gta-benchmarks",
    url: "/lore/kimmonismus-gta-benchmarks.png",
    caption:
      "Chubby: \"Another reason for open source ... Anthropic no longer allows good benchmarks like Minecraft or GTA 5 recreational games.\" (5:41 AM, Oct 30, 2026)",
    keywords: ["chubby", "kimmonismus", "open source", "minecraft", "gta", "benchmarks", "ipo"],
    sections: [93],
  },
  {
    id: "steipete-own-harness",
    url: "/lore/steipete-own-harness.png",
    caption:
      "Peter Steinberger: \"Another reason why you wanna use your own harness ...\" (6:00 AM, Oct 30, 2026; 2.9K likes)",
    keywords: ["steipete", "peter steinberger", "harness", "claude code", "anthropic", "rule"],
    sections: [93],
  },
  {
    id: "agtp-heron-brook-summary",
    url: "/lore/agtp-heron-brook-summary.jpg",
    caption:
      "AGTP's summary card: \"Anthropic blocks Claude Code from recreating existing video games\", flag tengu_heron_brook, off switch: none",
    keywords: ["agtp", "anthropic", "claude code", "tengu_heron_brook", "video games", "off switch"],
    sections: [93],
  },
  {
    id: "pepe-periodt-post",
    url: "/lore/pepe-periodt-post.png",
    caption:
      "@pepecoineth: \"periodt $PEPE\", Pepe in lashes, orange lip gloss and acrylic nails (8:49 AM, Oct 30, 2026)",
    keywords: ["pepe", "pepecoineth", "periodt", "glam", "lashes", "nails"],
    sections: [94],
  },
  {
    id: "pepe-periodt-glam",
    url: "/lore/pepe-periodt-glam.mp4",
    caption:
      "The \"periodt\" clip: Pepe side-eyes, puts a hand in your face, blows a kiss and laughs",
    keywords: ["pepe", "periodt", "glam pepe", "kiss", "talk to the hand", "pepe clip"],
    sections: [94],
    loopGif: true,
  },
  {
    id: "pepe-near-confidential",
    url: "/lore/pepe-near-confidential.jpg",
    caption:
      "@pepecoineth's ad under Arkham's Justin Sun post: \"PEPE. NOW CONFIDENTIAL.\" (\"Onchain, every holding is public by default.\" Oct 27, 2026)",
    keywords: ["pepe", "near", "confidential", "arkham", "justin sun", "privacy"],
    sections: [94],
  },
  {
    id: "pepe-reject-humanity",
    url: "/lore/pepe-reject-humanity.jpg",
    caption:
      "@pepecoineth: \"reject humanity, return to frog\", a classical profile turning into Pepe across ten heads (1:30 PM, Oct 27, 2026)",
    keywords: ["pepe", "reject humanity", "return to frog", "engraving", "evolution"],
    sections: [94],
  },
  {
    id: "lookonchain-binance-hacker-pepe-dump",
    url: "/lore/lookonchain-binance-hacker-pepe-dump.jpg",
    caption:
      "Lookonchain, 3:48 PM Oct 29, 2026: wallets tagged Binance_Hacker selling PEPE (17.4B, 12.2B, 70.3B) and LINK into Uniswap for ETH",
    keywords: ["lookonchain", "binance hacker", "pepe", "dump", "uniswap", "eth", "binance hack"],
    sections: [94],
  },
  {
    id: "bscnews-dmt-whale-pepe",
    url: "/lore/bscnews-dmt-whale-pepe.jpg",
    caption:
      "BSC News: \"Legendary Whale is now all in on PEPE\", dimethyltryptamine.eth buys 45.08B PEPE after the Binance hacker's dump (3:52 AM, Oct 30, 2026)",
    keywords: ["bsc news", "whale", "pepe", "dimethyltryptamine", "dmt", "legendary whale"],
    sections: [94],
  },
  {
    id: "pepe-price-oct-17-30",
    url: "/lore/pepe-price-oct-17-30.png",
    caption:
      "PEPE hourly, Oct 17-30, 2026, from CoinGecko data: $0.00000379 low, $0.00000549 peak, the Binance hacker's dump to $0.00000447, then \"periodt\"",
    keywords: ["pepe", "price", "chart", "coingecko", "binance hack", "justin sun"],
    sections: [94],
  },
];

// Chat used to pre-select an image with a keyword substring match against
// only the troublemaker's latest message — cheap, but it meant an image
// only ever surfaced if someone happened to type a phrase a human had
// pre-written into that asset's `keywords` list. "what does the troll
// runner look like" needed its own hand-added keyword; "who is he" or
// "describe him" would have needed their own too, forever. Chat now hands
// the model this catalog (id + caption only, never the keywords list) and a
// show_image tool (lib/persona.ts's IMAGE_TOOL) so it decides — from actual
// understanding of the conversation, not string matching — whether any
// asset is worth attaching, the same way a person who'd memorized this
// index would. The archive's per-section lookup (below) is unrelated and
// keeps working exactly as before.
// Chat can show everything the archive shows: stills plus loopGif clips
// (Chat.tsx renders those as autoplaying GIFs). Only real scrub-through
// videos stay out of chat.
function isChatShowable(asset: LoreAsset): boolean {
  return !isVideoAsset(asset.url) || asset.loopGif === true;
}

export function loreAssetCatalogForPrompt(): string {
  return LORE_ASSETS.filter(isChatShowable)
    .map((asset) => `${asset.id}: ${asset.caption}`)
    .join("\n");
}

// show_image is the one paid Claude call left in chat, and it used to run on
// every turn, "gm" included, to hear "no image" back almost every time. This
// free local check runs first, and the paid call only happens when it says
// yes: the troublemaker asked to see something, or their own message named a
// subject the library has a picture of. Only the troublemaker's words count:
// the terminal naming a subject in its reply never triggers an image. It only
// decides whether to ask. The model still picks the image, or none.
const IMAGE_INTENT =
  /\b(show|pic|pics|picture|pictures|photo|photos|image|images|img|look(?:s|ed)? like|let me see|lemme see|can i see)\b/i;

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const KEYWORD_PATTERNS: RegExp[] = [
  ...new Set(
    LORE_ASSETS.filter(isChatShowable).flatMap((asset) =>
      (asset.keywords ?? []).map((k) => k.toLowerCase())
    )
  ),
].map((k) => new RegExp(`(?<![a-z0-9])${escapeRegExp(k)}(?![a-z0-9])`, "i"));

export function turnMightWantLoreImage(userMessage: string): boolean {
  if (IMAGE_INTENT.test(userMessage)) return true;
  return KEYWORD_PATTERNS.some((pattern) => pattern.test(userMessage));
}

export function getLoreAssetById(id: string): LoreAsset | null {
  return LORE_ASSETS.find((asset) => asset.id === id) ?? null;
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
// Real scrub-through video clips are still excluded (an archive file reads
// like a document, not a chat thread to scrub through), but a loopGif asset
// is kept — it's meant to play like a picture, just an animated one, so
// dropping it here silently orphaned §54's birthday clip.
export function findLoreImagesForArchiveSection(sectionNumber: number): LoreAsset[] {
  return LORE_ASSETS.filter(
    (asset) =>
      (!isVideoAsset(asset.url) || asset.loopGif) && asset.sections.includes(sectionNumber)
  );
}

// Lays a section's prose and its pictures out as one interleaved reading
// order for the archive (docs/TERMINAL-V4-DESIGN.md §3.1). The archive used
// to render the whole body as a single block and then dump every image
// underneath it, so a file like §32 (seven pictures) or §48 (thirty-six
// paragraphs) read as an essay followed by an unrelated contact sheet —
// the pictures arrived long after the sentences they illustrate.
//
// Placement is positional, not semantic: paragraphs and images are spread
// evenly so pictures land at even intervals through the prose. Matching an
// image to the paragraph that names it would need per-asset paragraph
// anchors that don't exist in TROLL-LORE.md, and the keyword scorer that
// findLoreImagesForArchiveSection's comment warns about is exactly the
// wrong tool for it. Even spacing is the honest version: it never claims a
// picture belongs to a sentence it doesn't.
//
// Prose both opens and closes a file: the first paragraph always leads,
// and the last paragraph always has the final word, so a file never opens
// on an image or trails off into one. Sections with more images than
// interior gaps (§31 and §32 both carry more pictures than paragraphs)
// double up within a gap, rendering as a grid, so nothing is dropped.
// Animated assets ride the same path as stills — a real .gif is just an
// <img>, and a loopGif .mp4 (§54's birthday clip) renders as an
// autoplaying muted <video> in the same figure slot.
export type LoreFlowItem =
  | { kind: "text"; text: string }
  | { kind: "images"; images: LoreAsset[] };

export function buildLoreFlow<T extends { id: string }>(
  body: string,
  images: T[]
): ({ kind: "text"; text: string } | { kind: "images"; images: T[] })[] {
  const paragraphs = body.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  if (paragraphs.length === 0) {
    return images.length > 0 ? [{ kind: "images", images }] : [];
  }
  if (images.length === 0) {
    return paragraphs.map((text) => ({ kind: "text" as const, text }));
  }

  // Slots are the gaps AFTER each paragraph, excluding the gap after the
  // last one — a picture there is an image trailing the finished article,
  // which is the exact layout this function exists to undo. Restricting to
  // interior gaps means the prose always closes the file, so §1 (two
  // paragraphs, one GIF) reads T I T instead of T T I. A one-paragraph
  // section has no interior gap at all and keeps its images at the end;
  // there's nowhere else for them to go.
  const slots = paragraphs.length > 1 ? paragraphs.length - 1 : 1;
  const buckets: T[][] = Array.from({ length: paragraphs.length }, () => []);
  images.forEach((image, i) => {
    // Spread across the gaps: with 2 images and 5 paragraphs this puts them
    // after paragraphs 2 and 4 rather than both at the top or both at the end.
    const slot = Math.min(slots - 1, Math.floor(((i + 1) * slots) / (images.length + 1)));
    buckets[slot].push(image);
  });

  const flow: ({ kind: "text"; text: string } | { kind: "images"; images: T[] })[] = [];
  paragraphs.forEach((text, i) => {
    flow.push({ kind: "text", text });
    if (buckets[i].length > 0) flow.push({ kind: "images", images: buckets[i] });
  });
  return flow;
}
