import Link from "next/link";
import { Chevron } from "@/components/ui/chevron";
import { Squiggle } from "@/components/ui/squiggle";

const COMMIT_SHA =
  process.env.NEXT_PUBLIC_BUILD_SHA?.slice(0, 7) ?? "dev";

export default function AboutPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-10 pb-28">
      <Link
        href="/you"
        className="press inline-flex min-h-10 items-center gap-1.5 text-sm"
        style={{ color: "var(--ink-soft)" }}
      >
        <Chevron direction="left" size={14} strokeWidth={2} />
        <span>you</span>
      </Link>

      <header className="mt-4 mb-4">
        <h1 className="h-display m-0" style={{ fontSize: 36, lineHeight: 1.05 }}>
          about <span style={{ fontStyle: "italic" }}>accountably</span>
        </h1>
        <Squiggle width={90} />
      </header>

      <div
        className="prose"
        style={{
          color: "var(--ink)",
          fontSize: 16,
          lineHeight: 1.5,
        }}
      >
        <p>
          a small habit app for groups. you start a pact with friends, agree on
          a rhythm, and check in together. notes, nudges, and a shared metric
          per pact keep it social without turning into a leaderboard.
        </p>

        <p className="mt-4">
          built by{" "}
          <a
            href="mailto:davidsh@tcd.ie"
            style={{
              color: "var(--ink)",
              textDecoration: "underline",
              textDecorationColor: "var(--accent)",
              textDecorationThickness: 1.5,
              textUnderlineOffset: 3,
            }}
          >
            david @ tcd
          </a>
          . runs on next.js and supabase. push notifications via web push and
          a tiny external cron. no analytics, no ad tracking, no third-party
          embeds in the app.
        </p>

        <p className="mt-4">
          feedback, bug reports, feature requests — same email. no support
          team, but every message is read.
        </p>
      </div>

      <div
        className="label mt-12"
        style={{ fontSize: 10, color: "var(--mute)" }}
      >
        build · {COMMIT_SHA}
      </div>
    </main>
  );
}
