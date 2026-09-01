"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import ThemeSwitcher from "@/components/ThemeSwitcher";

const NAV_ITEMS = [
  { href: "/", label: "Home", match: (pathname: string) => pathname === "/" },
  {
    href: "/workout/new",
    label: "Log",
    match: (pathname: string) => pathname.startsWith("/workout"),
  },
  {
    href: "/progress",
    label: "Progress",
    match: (pathname: string) => pathname.startsWith("/progress"),
  },
  {
    href: "/exercises",
    label: "Catalog",
    match: (pathname: string) => pathname.startsWith("/exercises"),
  },
];

// Persistent app navigation: visible on every signed-in surface so top-level
// routes stay predictable and page headers can focus on the current task.
export default function HomeBar() {
  const pathname = usePathname();
  if (
    pathname === "/login" ||
    pathname === "/forgot-password" ||
    pathname === "/reset-password" ||
    pathname.startsWith("/auth/")
  ) {
    return null;
  }

  return (
    <nav className="apex-bottom-nav" aria-label="Primary">
      <div className="apex-bottom-nav-inner apex-bottom-nav-inner-theme">
        {NAV_ITEMS.map((item) => {
          const active = item.match(pathname);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`apex-bottom-link ${active ? "apex-bottom-link-active" : ""}`}
            >
              <span aria-hidden="true">
                {item.label === "Home"
                  ? "⌂"
                  : item.label === "Log"
                    ? "+"
                    : item.label === "Progress"
                      ? "▥"
                      : "▦"}
              </span>
              {item.label}
            </Link>
          );
        })}
        <ThemeSwitcher />
      </div>
    </nav>
  );
}
