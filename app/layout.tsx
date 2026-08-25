import type { Metadata, Viewport } from "next";
import { Barlow_Condensed, Manrope, IBM_Plex_Mono } from "next/font/google";
import HomeBar from "@/components/HomeBar";
import ThemeSwitcher from "@/components/ThemeSwitcher";
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
  viewportFit: "cover",
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
        <div className="landscape-lock fixed inset-0 z-50 flex-col items-center justify-center gap-3 bg-steel-950 px-8 text-center">
          <p className="font-display text-2xl font-extrabold text-chalk-100">Rotate back to portrait</p>
          <p className="text-sm text-chalk-500">ApexLoad is designed for portrait use only.</p>
        </div>
        <HomeBar />
        <div className="mx-auto max-w-md">{children}</div>
        <ThemeSwitcher />
      </body>
    </html>
  );
}
