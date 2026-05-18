import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SubmitButton } from "@/components/submit-button";
import { Squiggle } from "@/components/ui/squiggle";
import { createGroup, joinGroupByCode } from "./actions";

type Membership = {
  joined_at: string;
  groups: {
    id: string;
    name: string;
    created_at: string;
  } | null;
};

const stickerForName = (name: string) => {
  const trimmed = name.trim();
  return trimmed[0]?.toUpperCase() || "?";
};

const tiltClass = (idx: number) => {
  const r = idx % 3;
  return r === 0 ? "-rotate-2" : r === 1 ? "rotate-2" : "";
};

export default async function GroupsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();

  const { data: memberships } = await supabase
    .from("group_members")
    .select("joined_at, groups(id, name, created_at)")
    .order("joined_at", { ascending: false })
    .returns<Membership[]>();

  const groups = (memberships ?? []).flatMap((m) => (m.groups ? [m.groups] : []));

  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-10 pb-28">
      <header className="flex items-baseline justify-between">
        <div>
          <h1 className="h-display m-0" style={{ fontSize: 40, lineHeight: 1 }}>
            <span style={{ fontStyle: "italic" }}>your</span> groups
          </h1>
          <Squiggle width={60} />
        </div>
      </header>

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

      <section className="mt-6 flex flex-col gap-3.5">
        {groups.length === 0 ? (
          <div
            className="px-6 py-8 text-center"
            style={{
              borderRadius: "var(--radius)",
              border: "1.5px dashed var(--line-strong)",
            }}
          >
            <p className="text-sm" style={{ color: "var(--ink-soft)" }}>
              you&apos;re not in any groups yet. make a group or join with an invite code below.
            </p>
          </div>
        ) : (
          groups.map((g, i) => (
            <Link
              key={g.id}
              href={`/groups/${g.id}`}
              className="press flex items-center gap-3.5"
              style={{
                background: "var(--card)",
                border: "1px solid var(--line)",
                borderRadius: "var(--radius)",
                padding: "var(--density-pad)",
              }}
            >
              <div
                className={tiltClass(i)}
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 16,
                  background: "var(--accent-soft)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: "var(--font-display)",
                  fontSize: 28,
                  color: "var(--accent)",
                  boxShadow: "0 2px 0 var(--line)",
                  flexShrink: 0,
                }}
                aria-hidden
              >
                {stickerForName(g.name)}
              </div>
              <div className="min-w-0 flex-1">
                <div
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: 22,
                    lineHeight: 1.1,
                    color: "var(--ink)",
                  }}
                >
                  {g.name}
                </div>
                <div className="label mt-1">
                  started {new Date(g.created_at).toLocaleDateString()}
                </div>
              </div>
              <span style={{ color: "var(--mute)" }} aria-hidden>→</span>
            </Link>
          ))
        )}
      </section>

      <section className="mt-5 flex flex-col gap-3">
        <details className="group" open={groups.length === 0}>
          <summary
            className="press flex min-h-14 cursor-pointer list-none items-center justify-center gap-2 [&::-webkit-details-marker]:hidden"
            style={{
              background: "var(--accent)",
              color: "#fff",
              borderRadius: "var(--radius)",
              padding: "0 22px",
              fontFamily: "var(--font-body)",
              fontWeight: 600,
              fontSize: 16,
              boxShadow: "0 4px 14px rgba(216, 98, 58, 0.25)",
            }}
          >
            <span aria-hidden style={{ fontSize: 20, lineHeight: 1 }}>+</span>
            <span>make a group</span>
            <span
              className="transition-transform group-open:rotate-180"
              style={{ color: "rgba(255,255,255,0.7)" }}
              aria-hidden
            >
              ▾
            </span>
          </summary>
          <form
            action={createGroup}
            className="mt-2 flex flex-col gap-3 p-4"
            style={{
              background: "var(--card)",
              border: "1px solid var(--line)",
              borderRadius: "var(--radius)",
            }}
          >
            <label className="block">
              <span className="label">Group name</span>
              <input
                name="name"
                type="text"
                required
                maxLength={80}
                placeholder="e.g. Morning Run Crew"
                className="mt-1.5 w-full outline-none"
                style={inputStyle}
              />
            </label>
            <SubmitButton
              pendingLabel="creating…"
              className="w-full"
              style={primaryStyle}
            >
              create group
            </SubmitButton>
          </form>
        </details>

        <details className="group">
          <summary
            className="press flex min-h-14 cursor-pointer list-none items-center justify-between [&::-webkit-details-marker]:hidden"
            style={{
              background: "var(--card)",
              border: "1px solid var(--line)",
              borderRadius: "var(--radius)",
              padding: "0 var(--density-pad)",
              fontFamily: "var(--font-body)",
              fontWeight: 600,
              color: "var(--ink)",
            }}
          >
            <span>join with code</span>
            <span
              className="transition-transform group-open:rotate-180"
              style={{ color: "var(--mute)" }}
              aria-hidden
            >
              ▾
            </span>
          </summary>
          <form
            action={joinGroupByCode}
            className="mt-2 flex flex-col gap-3 p-4"
            style={{
              background: "var(--card)",
              border: "1px solid var(--line)",
              borderRadius: "var(--radius)",
            }}
          >
            <label className="block">
              <span className="label">Invite code</span>
              <input
                name="code"
                type="text"
                required
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                className="mt-1.5 w-full outline-none"
                style={{ ...inputStyle, fontFamily: "var(--font-stat-mono)" }}
              />
            </label>
            <SubmitButton
              pendingLabel="joining…"
              className="w-full"
              style={ghostStyle}
            >
              join
            </SubmitButton>
          </form>
        </details>
      </section>
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

const primaryStyle: React.CSSProperties = {
  minHeight: 52,
  background: "var(--accent)",
  color: "#fff",
  borderRadius: "var(--radius)",
  border: "none",
  fontFamily: "var(--font-body)",
  fontWeight: 600,
  fontSize: 16,
};

const ghostStyle: React.CSSProperties = {
  minHeight: 52,
  background: "transparent",
  color: "var(--ink)",
  borderRadius: "var(--radius)",
  border: "1.5px solid var(--line-strong)",
  fontFamily: "var(--font-body)",
  fontWeight: 600,
  fontSize: 16,
};
