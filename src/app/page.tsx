import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Chevron } from "@/components/ui/chevron";
import { Squiggle } from "@/components/ui/squiggle";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) redirect("/feed");

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center gap-8 px-6">
      <div className="text-center">
        <h1
          className="m-0"
          style={{
            fontFamily: "var(--font-display)",
            fontStyle: "italic",
            fontSize: 60,
            lineHeight: 0.95,
            color: "var(--ink)",
            letterSpacing: "-0.02em",
          }}
        >
          accountably<span style={{ color: "var(--accent)" }}>.</span>
        </h1>
        <Squiggle width={100} className="mx-auto" />
        <p
          className="mt-4"
          style={{ color: "var(--ink-soft)", fontSize: 18, lineHeight: 1.35 }}
        >
          group pacts with your friends.
        </p>
      </div>
      <a
        href="/login"
        className="press inline-flex items-center justify-center gap-2"
        style={{
          minHeight: 56,
          padding: "0 28px",
          borderRadius: "var(--radius)",
          background: "var(--accent)",
          color: "#fff",
          fontFamily: "var(--font-body)",
          fontWeight: 600,
          fontSize: 17,
        }}
      >
        <span>get started</span>
        <Chevron direction="right" size={18} strokeWidth={2.2} />
      </a>
    </main>
  );
}
