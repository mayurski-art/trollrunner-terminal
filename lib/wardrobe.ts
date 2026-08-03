// Wardrobe catalog for the /faces avatar builder. Every item is a
// transparent PNG sized to line up against BASE_FACE_SRC at CANVAS_SIZE —
// x/y/scale are hand-tuned per item against that fixed canvas, not derived
// at runtime, so adding an item means eyeballing its offset once here.
export const BASE_FACE_SRC = "/faces/base/trollface.png";
export const CANVAS_SIZE = 256;

export type WardrobeSlot = "headwear" | "eyewear" | "mouth" | "neck";

export type WardrobeItem = {
  id: string;
  label: string;
  slot: WardrobeSlot;
  src: string;
  x: number;
  y: number;
  scale: number;
};

export const SLOTS: { id: WardrobeSlot; label: string }[] = [
  { id: "headwear", label: "headwear" },
  { id: "eyewear", label: "eyewear" },
  { id: "mouth", label: "mouth" },
  { id: "neck", label: "neck" },
];

export const WARDROBE_ITEMS: WardrobeItem[] = [
  { id: "top-hat", label: "top hat", slot: "headwear", src: "/faces/items/top-hat.png", x: 60, y: -15, scale: 0.55 },
  { id: "propeller-cap", label: "propeller cap", slot: "headwear", src: "/faces/items/propeller-cap.png", x: 50, y: -40, scale: 0.6 },
  { id: "bandana", label: "bandana", slot: "headwear", src: "/faces/items/bandana.png", x: 55, y: -10, scale: 0.6 },
  { id: "sunglasses", label: "sunglasses", slot: "eyewear", src: "/faces/items/sunglasses.png", x: 50, y: 5, scale: 0.85 },
  { id: "cigar", label: "cigar", slot: "mouth", src: "/faces/items/cigar.png", x: 125, y: 140, scale: 0.7 },
  { id: "gold-chain", label: "gold chain", slot: "neck", src: "/faces/items/gold-chain.png", x: 45, y: 190, scale: 0.9 },
];
