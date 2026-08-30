import type { Metadata, Viewport } from "next";
import { JetBrains_Mono } from "next/font/google";
import Script from "next/script";
import BootSequence from "@/components/BootSequence";
import Cursor from "@/components/Cursor";
import "./globals.css";

const mono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "trollface terminal",
  description: "the grin that's been looked at for eighteen years, finally looking back",
};

// Matches the main trollrunner.net site's zoom lock — this reads as an app
// UI (fixed nav, boot overlay, chat), not a document, so pinch-zoom fights
// the layout more than it helps. Without this, the boot overlay's `fixed
// inset-0` also stops actually covering the screen the moment a visitor
// pinch-zooms or the page becomes horizontally pannable, letting the real
// site peek out from behind it.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${mono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        {/* Opaque cover painted with the server HTML, before React hydrates,
            so the site can never flash through in the frames before
            BootSequence's overlay exists. BootSequence clears it once its
            own overlay is mounted; the failsafe below clears it if the boot
            script never runs at all (JS off, hydration error) so the site is
            never permanently hidden behind it. */}
        <div id="preboot-shield" aria-hidden="true" />
        <script
          dangerouslySetInnerHTML={{
            __html:
              "setTimeout(function(){document.documentElement.setAttribute('data-boot-ready','')},4000)",
          }}
        />
        <BootSequence />
        <Cursor />
        {children}
        {/* Shared trollrunner.net network-wide lock overlay — same script as
            the main site and sibling subdomains, reading the same Supabase
            site_updates row, so an admin lock on the main site's admin.html
            covers this subdomain too. No admin.html here, so this terminal
            only ever acts as a reader, never a writer. */}
        <Script src="/assets/js/site-lock.js" strategy="afterInteractive" />
      </body>
    </html>
  );
}
