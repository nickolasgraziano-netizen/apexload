import type { Metadata, Viewport } from "next";
import { Barlow_Condensed, Manrope, IBM_Plex_Mono } from "next/font/google";
import HomeBar from "@/components/HomeBar";
import "./globals.css";

// Runs before paint so a saved theme choice applies immediately instead of
// flashing the default palette first. Kept inline (not in ThemeSwitcher,
// which only mounts client-side after hydration) specifically to win that
// race.
const themeInitScript = `
  (function () {
    try {
      var t = localStorage.getItem("apexload:theme");
      if (t && t !== "dragon") document.documentElement.dataset.theme = t;
    } catch (e) {}
  })();
`;

const display = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
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
    <html
      lang="en"
      className={`${display.variable} ${body.variable} ${mono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="bg-steel-950 text-chalk-100 font-body antialiased">
        <HomeBar />
        <div className="mx-auto max-w-md">{children}</div>
      </body>
    </html>
  );
}
