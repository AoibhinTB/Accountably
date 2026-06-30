import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Chevron } from "@/components/ui/chevron";
import { Squiggle } from "@/components/ui/squiggle";
import { noteTimestamp } from "@/lib/period";
import { CalendarMonth } from "./calendar-month";
import { JournalEntryActions, JournalForm } from "./journal-form";
import { Trends } from "./trends";

type Challenge = {
  id: string;
  metric_kind: "count" | "minutes" | null;
  metric_name: string | null;
  start_date: string;
  archived: boolean;
};

type Pact = {
  id: string;
  name: string;
  icon: string | null;
  challenges: Challenge[];
};

type Completion = {
  id: string;
  completed_at: string;
  note: string | null;
  private_note: string | null;
  metric_value: number | null;
};

type JournalEntry = {
  id: string;
  body: string;
  created_at: string;
};

const startOfDay = (d: Date) => {
  const r = new Date(d);
  r.setUTCHours(0, 0, 0, 0);
  return r;
};
const startOfWeek = (d: Date) => {
  const r = startOfDay(d);
  const offset = (r.getUTCDay() + 6) % 7;
  r.setUTCDate(r.getUTCDate() - offset);
  return r;
};
const startOfMonth = (d: Date) =>
  new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
const startOfYear = (d: Date) =>
  new Date(Date.UTC(d.getUTCFullYear(), 0, 1));

function formatMetric(
  total: number,
  kind: "count" | "minutes",
  name: string | null,
): { number: string; unit: string } {
  if (kind === "minutes") {
    if (total < 60) return { number: String(total), unit: "min" };
    const totalH = Math.floor(total / 60);
    const remM = total % 60;
    if (totalH < 24) {
      return { number: `${totalH}h${remM > 0 ? ` ${remM}m` : ""}`, unit: "" };
    }
    const d = Math.floor(totalH / 24);
    const remH = totalH % 24;
    return { number: `${d}d${remH > 0 ? ` ${remH}h` : ""}`, unit: "" };
  }
  return { number: total.toLocaleString(), unit: name ?? "units" };
}

export default async function LogbookPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/pacts/${id}/logbook`);

  const { data: pact } = await supabase
    .from("groups")
    .select(
      "id, name, icon, challenges(id, metric_kind, metric_name, start_date, archived)",
    )
    .eq("id", id)
    .maybeSingle<Pact>();
  if (!pact) notFound();

  const challenge =
    (pact.challenges ?? []).find((c) => !c.archived) ?? null;
  const metricKind = challenge?.metric_kind ?? null;
  const metricName = challenge?.metric_name ?? null;

  const completionsPromise = challenge
    ? supabase
        .from("completions")
        .select("id, completed_at, note, private_note, metric_value")
        .eq("user_id", user.id)
        .eq("challenge_id", challenge.id)
        .order("completed_at", { ascending: false })
        .returns<Completion[]>()
    : Promise.resolve({ data: [] as Completion[] });

  const journalPromise = supabase
    .from("journal_entries")
    .select("id, body, created_at")
    .eq("pact_id", id)
    .order("created_at", { ascending: false })
    .returns<JournalEntry[]>();

  const [{ data: completions }, { data: journal }] = await Promise.all([
    completionsPromise,
    journalPromise,
  ]);

  // Surface both public and private notes the user posted on their own
  // check-ins. Each row keeps its visibility so we can label it.
  const myNotes = (completions ?? [])
    .filter(
      (c) =>
        (c.note && c.note.trim().length > 0) ||
        (c.private_note && c.private_note.trim().length > 0),
    )
    .flatMap((c) => {
      const out: {
        id: string;
        completed_at: string;
        body: string;
        visibility: "public" | "private";
        metric_value: number | null;
      }[] = [];
      if (c.note && c.note.trim().length > 0) {
        out.push({
          id: `${c.id}-pub`,
          completed_at: c.completed_at,
          body: c.note,
          visibility: "public",
          metric_value: c.metric_value,
        });
      }
      if (c.private_note && c.private_note.trim().length > 0) {
        out.push({
          id: `${c.id}-priv`,
          completed_at: c.completed_at,
          body: c.private_note,
          visibility: "private",
          metric_value: c.metric_value,
        });
      }
      return out;
    });

  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-10 pb-28">
      <Link
        href={`/pacts/${pact.id}`}
        className="press inline-flex min-h-10 items-center gap-1.5 text-sm"
        style={{ color: "var(--ink-soft)" }}
      >
        <Chevron direction="left" size={14} strokeWidth={2} />
        <span>{pact.name}</span>
      </Link>

      <header className="mt-4 mb-4">
        <div className="label">your private space</div>
        <h1 className="h-display m-0 mt-1" style={{ fontSize: 36, lineHeight: 1.05 }}>
          logbook
        </h1>
        <Squiggle width={64} />
      </header>

      <Trends
        completions={(completions ?? []).map((c) => ({
          completed_at: c.completed_at,
          metric_value: c.metric_value,
        }))}
        metricKind={metricKind}
        metricName={metricName}
      />

      <CalendarMonth
        pactId={pact.id}
        startDate={challenge?.start_date ?? null}
        completions={(completions ?? []).map((c) => ({
          id: c.id,
          completed_at: c.completed_at,
          note: c.note,
          private_note: c.private_note,
          metric_value: c.metric_value,
        }))}
        metricKind={metricKind}
        metricName={metricName}
      />

      <section className="mb-6">
        <details className="group">
          <summary
            className="press flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 [&::-webkit-details-marker]:hidden"
            style={{
              padding: "0 16px",
              background: "var(--card)",
              border: "1.5px dashed var(--line-strong)",
              borderRadius: "var(--radius)",
              color: "var(--ink-soft)",
            }}
          >
            <span
              className="inline-flex items-center gap-2"
              style={{
                fontFamily: "var(--font-stat-mono)",
                fontSize: 12,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                fontWeight: 600,
              }}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
              add private entry
            </span>
            <span
              className="label group-open:hidden"
              style={{ fontSize: 9, color: "var(--mute)" }}
            >
              tap
            </span>
          </summary>
          <div className="mt-3">
            <JournalForm pactId={pact.id} />
          </div>
        </details>
      </section>

      {(journal ?? []).length > 0 && (
        <section className="mb-6">
          <div className="label mb-2">your entries</div>
          <ul className="flex flex-col gap-2">
            {(journal ?? []).map((j) => (
              <li
                key={j.id}
                className="p-3 relative"
                style={{
                  background: "var(--card)",
                  border: "1px solid var(--line)",
                  borderRadius: "var(--radius)",
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div
                    className="label"
                    style={{ fontSize: 10, color: "var(--mute)" }}
                  >
                    {noteTimestamp(j.created_at)}
                  </div>
                  <JournalEntryActions entryId={j.id} />
                </div>
                <p
                  className="mt-2 whitespace-pre-wrap"
                  style={{
                    fontSize: 14,
                    color: "var(--ink)",
                    lineHeight: 1.4,
                    paddingLeft: 10,
                    borderLeft: "2px solid var(--accent)",
                  }}
                >
                  {j.body}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {myNotes.length > 0 && (
        <section>
          <div className="label mb-2">your check-in notes</div>
          {(() => {
            // Bucket by calendar month so older months can collapse.
            const monthBuckets = new Map<
              string,
              { label: string; notes: typeof myNotes }
            >();
            for (const n of myNotes) {
              const d = new Date(n.completed_at);
              const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
              const label = d.toLocaleDateString(undefined, {
                month: "long",
                year: "numeric",
              });
              const bucket = monthBuckets.get(key) ?? { label, notes: [] };
              bucket.notes.push(n);
              monthBuckets.set(key, bucket);
            }
            const ordered = Array.from(monthBuckets.entries()).sort((a, b) =>
              a[0] < b[0] ? 1 : -1,
            );
            const renderNote = (c: (typeof myNotes)[number]) => {
              const metricChip =
                c.metric_value !== null && metricKind
                  ? (() => {
                      const f = formatMetric(
                        c.metric_value,
                        metricKind,
                        metricName,
                      );
                      return `${f.number}${f.unit ? ` ${f.unit}` : ""}`;
                    })()
                  : null;
              const isPrivate = c.visibility === "private";
              return (
                <li
                  key={c.id}
                  className="p-3"
                  style={{
                    background: "var(--card)",
                    border: "1px solid var(--line)",
                    borderRadius: "var(--radius)",
                  }}
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <div
                        className="label"
                        style={{ fontSize: 10, color: "var(--mute)" }}
                      >
                        {noteTimestamp(c.completed_at)}
                      </div>
                      <span
                        className="label"
                        style={{
                          fontSize: 9,
                          padding: "1px 8px",
                          borderRadius: 999,
                          background: isPrivate
                            ? "var(--card-inset)"
                            : "var(--accent-soft)",
                          color: isPrivate
                            ? "var(--ink-soft)"
                            : "var(--accent)",
                          letterSpacing: "0.06em",
                          textTransform: "uppercase",
                          fontWeight: 600,
                        }}
                      >
                        {isPrivate ? "private" : "public"}
                      </span>
                    </div>
                    {metricChip && (
                      <span
                        style={{
                          padding: "2px 10px",
                          borderRadius: 999,
                          background: "var(--accent-soft)",
                          color: "var(--accent)",
                          fontFamily: "var(--font-stat-mono)",
                          fontSize: 10.5,
                          letterSpacing: "0.04em",
                          textTransform: "uppercase",
                          fontWeight: 600,
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {metricChip}
                      </span>
                    )}
                  </div>
                  <p
                    className="mt-2 whitespace-pre-wrap"
                    style={{
                      fontSize: 14,
                      color: "var(--ink)",
                      lineHeight: 1.4,
                      paddingLeft: 10,
                      borderLeft: `2px solid ${isPrivate ? "var(--line-strong)" : "var(--accent)"}`,
                    }}
                  >
                    {c.body}
                  </p>
                </li>
              );
            };
            return (
              <div className="flex flex-col gap-4">
                {ordered.map(([key, bucket], idx) => {
                  // Current month stays open; everything older collapses.
                  const isCurrent = idx === 0;
                  if (isCurrent) {
                    return (
                      <div key={key}>
                        <div
                          className="label mb-1.5"
                          style={{ color: "var(--ink-soft)" }}
                        >
                          {bucket.label} · {bucket.notes.length}
                        </div>
                        <ul className="flex flex-col gap-2">
                          {bucket.notes.map(renderNote)}
                        </ul>
                      </div>
                    );
                  }
                  return (
                    <details key={key} className="group">
                      <summary
                        className="press flex min-h-10 cursor-pointer list-none items-center justify-between [&::-webkit-details-marker]:hidden"
                        style={{
                          padding: "0 14px",
                          background: "var(--card-inset)",
                          border: "1px solid var(--line)",
                          borderRadius: "var(--radius)",
                          color: "var(--ink-soft)",
                          fontSize: 13,
                        }}
                      >
                        <span
                          className="inline-flex items-center gap-2"
                          style={{
                            fontFamily: "var(--font-stat-mono)",
                            fontSize: 11,
                            letterSpacing: "0.06em",
                            textTransform: "uppercase",
                            fontWeight: 600,
                          }}
                        >
                          {bucket.label}
                          <span style={{ color: "var(--mute)" }}>
                            · {bucket.notes.length}
                          </span>
                        </span>
                        <span
                          className="transition-transform group-open:rotate-180"
                          style={{ color: "var(--mute)", fontSize: 12 }}
                          aria-hidden
                        >
                          ▾
                        </span>
                      </summary>
                      <ul className="mt-2 flex flex-col gap-2">
                        {bucket.notes.map(renderNote)}
                      </ul>
                    </details>
                  );
                })}
              </div>
            );
          })()}
        </section>
      )}
    </main>
  );
}
