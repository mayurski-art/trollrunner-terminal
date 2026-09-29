import type { MetadataRoute } from "next";

// Phones' equivalent of the favicon: Android reads these icons for the
// home-screen shortcut and app switcher (iOS uses app/apple-icon.png).
// Same art as the desktop tab icon — still, since phone browsers never
// repaint the script-driven spin in components/AnimatedFavicon.tsx.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "trollface terminal",
    short_name: "terminal",
    start_url: "/",
    display: "standalone",
    background_color: "#000000",
    theme_color: "#000000",
    icons: [{ src: "/icon.png", sizes: "any", type: "image/png" }],
  };
}
