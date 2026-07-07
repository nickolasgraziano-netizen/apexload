"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// A thin, always-present strip so you can get back to Home from anywhere,
// without hunting for a page-specific back button. Sticky (not fixed) so it
// takes up real layout space and never overlaps page content underneath it.
export default function HomeBar() {
  const pathname = usePathname();
  if (pathname === "/" || pathname === "/login") return null;

  return (
    <div className="sticky top-0 z-30 border-b border-steel-800 bg-steel-950/90 px-5 py-2 backdrop-blur-md">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-widest text-copper-400"
      >
        ← Home
      </Link>
    </div>
  );
}
