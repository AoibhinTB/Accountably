import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SubmitButton } from "@/components/submit-button";
import { HowOftenPicker } from "@/components/ui/how-often-picker";
import { IconPicker } from "@/components/ui/icon-picker";
import { Squiggle } from "@/components/ui/squiggle";
import { createPact } from "../actions";

export default async function NewPactPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/pacts/new");

  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-6 pb-28">
      <div className="mb-4 flex items-center">
        <Link
          href="/pacts"
          aria-label="Back"
          className="press inline-flex items-center justify-center"
          style={{
            width: 40,
            height: 40,
            borderRadius: "50%",
            background: "var(--card)",
            border: "1px solid var(--line)",
            color: "var(--ink)",
          }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </Link>
      </div>

      <header className="mb-6">
        <h1 className="h-display m-0" style={{ fontSize: 36, lineHeight: 1.05 }}>
          <span style={{ fontStyle: "italic" }}>start</span> a pact
        </h1>
        <Squiggle width={84} />
        <p
          className="mt-3"
          style={{ color: "var(--ink-soft)", fontSize: 15, lineHeight: 1.4 }}
        >
          pick a habit, set the rhythm, invite your people.
        </p>
      </header>

      {error && (
        <div
          className="mb-5 px-4 py-3 text-sm"
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

      <form action={createPact} className="flex flex-col gap-5">
        <label className="block">
          <span className="label">name the pact</span>
          <input
            name="name"
            type="text"
            required
            maxLength={80}
            placeholder="e.g. Meditate 10 minutes"
            className="mt-1.5 w-full outline-none"
            style={inputStyle}
          />
        </label>

        <IconPicker />

        <label className="block">
          <span className="label">description (optional)</span>
          <textarea
            name="description"
            rows={2}
            maxLength={500}
            placeholder="anything to remind your friends what this means"
            className="mt-1.5 w-full resize-none outline-none"
            style={{
              ...inputStyle,
              height: "auto",
              paddingTop: 12,
              paddingBottom: 12,
              fontFamily: "var(--font-display)",
              fontStyle: "italic",
            }}
          />
        </label>

        <HowOftenPicker />

        <details className="group">
          <summary
            className="press flex min-h-11 cursor-pointer list-none items-center justify-between [&::-webkit-details-marker]:hidden"
            style={{
              padding: "0 14px",
              background: "var(--card)",
              border: "1px solid var(--line)",
              borderRadius: "var(--radius)",
              color: "var(--ink-soft)",
              fontSize: 14,
            }}
          >
            <span>add custom dates (optional)</span>
            <span
              aria-hidden
              className="transition-transform group-open:rotate-180"
              style={{ color: "var(--mute)" }}
            >
              ▾
            </span>
          </summary>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <label className="block">
              <span className="label">start date</span>
              <input
                name="start_date"
                type="date"
                className="mt-1.5 w-full outline-none"
                style={dateInputStyle}
              />
            </label>
            <label className="block">
              <span className="label">end date</span>
              <input
                name="end_date"
                type="date"
                className="mt-1.5 w-full outline-none"
                style={dateInputStyle}
              />
            </label>
          </div>
        </details>

        {/* Hidden frequency value — new pacts use days_of_week as the source
            of truth; we set frequency='daily' so the existing enum stays
            populated. */}
        <input type="hidden" name="frequency" value="daily" />

        <SubmitButton
          pendingLabel="starting…"
          className="w-full"
          style={primaryStyle}
        >
          start the pact
        </SubmitButton>
      </form>
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  height: 52,
  background: "var(--card-inset)",
  border: "1.5px solid var(--line)",
  borderRadius: "var(--radius)",
  padding: "0 16px",
  fontSize: 16,
  color: "var(--ink)",
  fontFamily: "var(--font-body)",
};

const dateInputStyle: React.CSSProperties = {
  height: 44,
  background: "var(--card-inset)",
  border: "1.5px solid var(--line)",
  borderRadius: "var(--radius-sm)",
  padding: "0 12px",
  fontSize: 14,
  color: "var(--ink)",
  fontFamily: "var(--font-body)",
  textAlign: "left",
};

const primaryStyle: React.CSSProperties = {
  minHeight: 56,
  background: "var(--accent)",
  color: "#fff",
  borderRadius: "var(--radius)",
  border: "none",
  fontFamily: "var(--font-body)",
  fontWeight: 600,
  fontSize: 17,
  padding: "0 22px",
  boxShadow: "0 8px 30px rgba(216, 98, 58, 0.35)",
};
