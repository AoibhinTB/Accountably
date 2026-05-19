import Image from "next/image";
import { SubmitButton } from "@/components/submit-button";
import { login, signup } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; mode?: string; next?: string }>;
}) {
  const { error, mode, next } = await searchParams;
  const isSignup = mode === "signup";
  const safeNext =
    next && next.startsWith("/") && !next.startsWith("//") ? next : "";
  const toggleHref = isSignup
    ? `/login${safeNext ? `?next=${encodeURIComponent(safeNext)}` : ""}`
    : `/login?mode=signup${safeNext ? `&next=${encodeURIComponent(safeNext)}` : ""}`;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col px-6 pb-8 pt-12">
      <div className="mt-8">
        <h1 className="m-0" style={{ lineHeight: 0 }}>
          <span className="sr-only">Accountably</span>
          <Image
            src="/wordmark.png"
            alt=""
            width={800}
            height={228}
            priority
            style={{ width: "100%", height: "auto", maxWidth: 320 }}
          />
        </h1>
      </div>

      <p
        className="mt-4 max-w-[320px]"
        style={{
          fontSize: 18,
          color: "var(--ink-soft)",
          lineHeight: 1.35,
        }}
      >
        do the thing.{" "}
        <span style={{ fontFamily: "var(--font-display)", fontStyle: "italic" }}>
          together.
        </span>
        <br />
        keep each other accountable.
      </p>

      {error && (
        <div
          className="mt-6 px-4 py-3 text-sm"
          style={{
            borderRadius: "var(--radius)",
            border: "1px solid rgba(156, 31, 31, 0.3)",
            background: "rgba(216, 98, 58, 0.1)",
            color: "#7A1F1F",
          }}
        >
          {error}
        </div>
      )}

      <form className="mt-8 flex flex-col gap-2.5">
        {safeNext && <input type="hidden" name="next" value={safeNext} />}
        {isSignup && (
          <label className="block">
            <span className="label">Display name</span>
            <input
              name="display_name"
              type="text"
              required
              className="mt-1.5 w-full outline-none"
              style={inputStyle}
            />
          </label>
        )}
        <label className="block">
          <span className="label">Email</span>
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            className="mt-1.5 w-full outline-none"
            style={inputStyle}
          />
        </label>
        <label className="block">
          <span className="label">Password</span>
          <input
            name="password"
            type="password"
            required
            minLength={6}
            autoComplete={isSignup ? "new-password" : "current-password"}
            className="mt-1.5 w-full outline-none"
            style={inputStyle}
          />
        </label>

        <SubmitButton
          formAction={isSignup ? signup : login}
          pendingLabel={isSignup ? "signing up…" : "signing in…"}
          className="mt-4 w-full"
          style={{
            minHeight: 56,
            background: "var(--accent)",
            color: "#fff",
            borderRadius: "var(--radius)",
            fontFamily: "var(--font-body)",
            fontWeight: 600,
            fontSize: 17,
            letterSpacing: "-0.005em",
            border: "none",
          }}
        >
          {isSignup ? "create account" : "sign in"}
        </SubmitButton>

        <a
          href={toggleHref}
          className="press mt-3 self-center"
          style={{
            color: "var(--ink-soft)",
            fontSize: 14,
            textDecoration: "underline",
            textDecorationColor: "var(--accent)",
            textDecorationThickness: 1.5,
            textUnderlineOffset: 4,
          }}
        >
          {isSignup ? "have one? sign in" : "no account? sign up"}
        </a>
      </form>

      <div className="flex-1" />
      <div
        className="mt-6 text-center"
        style={{
          color: "var(--mute)",
          fontFamily: "var(--font-stat-mono)",
          fontSize: 10,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}
      >
        support · be on time · show up
      </div>
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  height: 56,
  background: "var(--card)",
  border: "1.5px solid var(--line)",
  borderRadius: "var(--radius)",
  padding: "0 18px",
  fontSize: 16,
  color: "var(--ink)",
  fontFamily: "var(--font-body)",
};
