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
