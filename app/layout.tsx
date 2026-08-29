import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import Script from "next/script";
import BootSequence from "@/components/BootSequence";
import "./globals.css";

const mono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "trollface terminal",
  description: "the grin that's been looked at for eighteen years, finally looking back",
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
