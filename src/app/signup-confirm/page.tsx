import Link from "next/link";
import { Squiggle } from "@/components/ui/squiggle";

export default async function SignupConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; next?: string }>;
}) {
  const { email, next } = await searchParams;
  const safeNext =
    next && next.startsWith("/") && !next.startsWith("//") ? next : "";
  const signinHref = `/login${safeNext ? `?next=${encodeURIComponent(safeNext)}` : ""}`;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col px-6 pb-8 pt-16">
      <div>
        <h1
          className="m-0"
          style={{
            fontFamily: "var(--font-display)",
            fontStyle: "italic",
            fontSize: 44,
            lineHeight: 1,
            color: "var(--ink)",
            letterSpacing: "-0.01em",
          }}
        >
          check your email
          <span style={{ color: "var(--accent)" }}>.</span>
        </h1>
        <Squiggle width={110} />
      </div>

      <p
        className="mt-5"
        style={{ fontSize: 17, color: "var(--ink-soft)", lineHeight: 1.4 }}
      >
        we sent a confirmation link to{" "}
        {email ? (
          <span style={{ fontWeight: 600, color: "var(--ink)" }}>{email}</span>
        ) : (
          "your inbox"
        )}
        . click it to finish setting up your account and start your first pact.
      </p>

      <div
        className="mt-6 p-4"
        style={{
          background: "var(--accent2-soft)",
          borderRadius: "var(--radius)",
        }}
      >
        <p
          style={{
            fontFamily: "var(--font-display)",
            fontStyle: "italic",
            fontSize: 17,
            color: "var(--ink)",
            lineHeight: 1.35,
          }}
        >
          you can&apos;t sign in until your email is confirmed.
        </p>
        <p
          className="mt-2"
          style={{ fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.4 }}
        >
          can&apos;t find it? check your spam folder, or wait a minute and
          refresh your inbox.
        </p>
      </div>

      <div className="flex-1" />

      <Link
        href={signinHref}
        className="press inline-flex items-center justify-center"
        style={{
          minHeight: 52,
          background: "var(--card)",
          color: "var(--ink)",
          borderRadius: "var(--radius)",
          border: "1.5px solid var(--line-strong)",
          fontFamily: "var(--font-body)",
          fontWeight: 600,
          fontSize: 16,
        }}
      >
        i&apos;ve confirmed — sign in
      </Link>
    </main>
  );
}
