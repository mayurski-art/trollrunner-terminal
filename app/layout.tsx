import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
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
        <BootSequence />
        {children}
      </body>
    </html>
  );
}
