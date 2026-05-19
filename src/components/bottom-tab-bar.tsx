"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ICON_PROPS = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const FeedIcon = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
    <path d="M4 6c4-1 12-1 16 0M4 12c4-1 12-1 16 0M4 18c4-1 8-1 11 0" {...ICON_PROPS} />
  </svg>
);

const GroupsIcon = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
    <circle cx="9" cy="9" r="3.4" {...ICON_PROPS} />
    <circle cx="17" cy="11" r="2.6" {...ICON_PROPS} />
    <path d="M3.5 19c.8-3 3-4.5 5.5-4.5s4.7 1.5 5.5 4.5M14 18c.4-1.8 1.8-3 3.2-3s2.6.8 3.3 2" {...ICON_PROPS} />
  </svg>
);

const YouIcon = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
    <circle cx="12" cy="8.5" r="3.6" {...ICON_PROPS} />
    <path d="M5 20c1-3.4 3.7-5.2 7-5.2s6 1.8 7 5.2" {...ICON_PROPS} />
  </svg>
);

const tabs = [
  {
    href: "/feed",
    label: "Feed",
    match: (p: string) => p === "/feed" || p === "/",
    Icon: FeedIcon,
  },
  {
    href: "/pacts",
    label: "Pacts",
    match: (p: string) =>
      p === "/pacts" ||
      p.startsWith("/pacts/") ||
      p === "/groups" ||
      p.startsWith("/groups/"),
    Icon: GroupsIcon,
  },
  {
    href: "/you",
    label: "You",
    match: (p: string) => p === "/you",
    Icon: YouIcon,
  },
];

const HIDDEN_PREFIXES = ["/login", "/auth", "/join", "/signup-confirm"];

export function BottomTabBar() {
  const pathname = usePathname();
  if (HIDDEN_PREFIXES.some((p) => pathname.startsWith(p))) return null;

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-3 z-40"
      style={{
        bottom: "calc(env(safe-area-inset-bottom, 0px) + 5px)",
      }}
    >
      <ul
        className="mx-auto flex items-center justify-around"
        style={{
          maxWidth: "calc(42rem - 24px)",
          height: 64,
          borderRadius: 999,
          background: "var(--ink)",
          padding: "0 6px",
          boxShadow:
            "0 8px 30px rgba(42, 31, 24, 0.25), 0 0 0 1px rgba(0,0,0,0.05)",
        }}
      >
        {tabs.map((tab) => {
          const active = tab.match(pathname);
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className="press flex flex-col items-center justify-center gap-0.5"
                style={{
                  minWidth: 80,
                  padding: "8px 14px",
                  borderRadius: 999,
                  background: active ? "var(--accent)" : "transparent",
                  color: active ? "#fff" : "rgba(251, 242, 231, 0.6)",
                  fontFamily: "var(--font-stat-mono)",
                  fontSize: 11,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  fontWeight: 500,
                }}
              >
                <tab.Icon size={20} />
                <span>{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
