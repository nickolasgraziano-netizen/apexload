import type { Metadata, Viewport } from "next";
import { Ma_Shan_Zheng, Manrope, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

// Brush-calligraphy display font for headings only — body/mono text stays
// on the original clean, readable faces below.
const display = Ma_Shan_Zheng({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-display",
});

const body = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-body",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "ApexLoad",
  description: "Your rolling rotation. Tracked, timed, and dialed in.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#0B0D10",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body className="bg-steel-950 text-chalk-100 font-body antialiased">{children}</body>
    </html>
  );
}
