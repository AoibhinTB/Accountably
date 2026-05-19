import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SubmitButton } from "@/components/submit-button";
import { Avatar } from "@/components/ui/avatar";
import { IconPicker } from "@/components/ui/icon-picker";
import { Squiggle } from "@/components/ui/squiggle";
import { createPact, joinPactByCode } from "./actions";

type Membership = {
  joined_at: string;
  groups: {
    id: string;
    name: string;
    icon: string | null;
    created_at: string;
    challenges: {
      id: string;
      frequency: "daily" | "weekly";
      start_date: string;
      end_date: string | null;
      archived: boolean;
    }[];
  } | null;
};

type MemberRow = {
  group_id: string;
  user_id: string;
  profiles: { display_name: string } | null;
};

const stickerForName = (name: string) =>
  name.trim()[0]?.toUpperCase() || "?";

const tiltClass = (idx: number) => {
  const r = idx % 3;
  return r === 0 ? "-rotate-2" : r === 1 ? "rotate-2" : "";
};

const today = () => new Date().toISOString().slice(0, 10);

export default async function PactsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: memberships } = await supabase
    .from("group_members")
    .select(
      "joined_at, groups(id, name, icon, created_at, challenges(id, frequency, start_date, end_date, archived))",
    )
    .eq("user_id", user?.id ?? "")
    .order("joined_at", { ascending: false })
    .returns<Membership[]>();

  const myPactIds = (memberships ?? [])
    .flatMap((m) => (m.groups ? [m.groups.id] : []));

  const { data: allMembers } = myPactIds.length
    ? await supabase
        .from("group_members")
        .select("group_id, user_id, profiles(display_name)")
        .in("group_id", myPactIds)
        .returns<MemberRow[]>()
    : { data: [] as MemberRow[] };

  const membersByGroup = new Map<string, MemberRow[]>();
  for (const m of allMembers ?? []) {
    const list = membersByGroup.get(m.group_id) ?? [];
    list.push(m);
    membersByGroup.set(m.group_id, list);
  }

  const pacts = (memberships ?? [])
    .flatMap((m) => (m.groups ? [m.groups] : []))
    .map((g) => ({
      id: g.id,
      name: g.name,
      icon: g.icon,
      created_at: g.created_at,
      active: g.challenges?.find((c) => !c.archived) ?? null,
      members: membersByGroup.get(g.id) ?? [],
    }));

  const isEmpty = pacts.length === 0;

  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-10 pb-28">
      <header className="flex items-baseline justify-between">
        <div>
          <h1 className="h-display m-0" style={{ fontSize: 40, lineHeight: 1 }}>
            <span style={{ fontStyle: "italic" }}>your</span> pacts
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

      {!isEmpty && (
        <section className="mt-6 flex flex-col gap-3.5">
          {pacts.map((p, i) => (
            <Link
              key={p.id}
              href={`/pacts/${p.id}`}
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
                  fontFamily: p.icon ? "inherit" : "var(--font-display)",
                  fontSize: p.icon ? 32 : 28,
                  color: "var(--accent)",
                  boxShadow: "0 2px 0 var(--line)",
                  flexShrink: 0,
                }}
                aria-hidden
              >
                {p.icon ?? stickerForName(p.name)}
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
                  {p.name}
                </div>
                <div className="label mt-1">
                  {p.active ? p.active.frequency : "no active challenge"}
                  {p.active && ` · since ${new Date(p.active.start_date).toLocaleDateString()}`}
                </div>
                {p.members.length > 0 && (
                  <div className="mt-2 flex items-center gap-2">
                    <div className="avastack">
                      {p.members.slice(0, 4).map((m) => (
                        <Avatar
                          key={m.user_id}
                          name={m.profiles?.display_name ?? "?"}
                          size={22}
                        />
                      ))}
                    </div>
                    <span className="label">
                      {p.members.length} friend{p.members.length === 1 ? "" : "s"}
                    </span>
                  </div>
                )}
              </div>
              <span style={{ color: "var(--mute)" }} aria-hidden>→</span>
            </Link>
          ))}
        </section>
      )}

      {isEmpty && (
        <div
          className="mt-6 px-6 py-7 text-center"
          style={{
            borderRadius: "var(--radius)",
            border: "1.5px dashed var(--line-strong)",
          }}
        >
          <p className="text-sm" style={{ color: "var(--ink-soft)", lineHeight: 1.4 }}>
            no pacts yet. start one with your people below, or join with an
            invite code.
          </p>
        </div>
      )}

      <section className="mt-5 flex flex-col gap-3">
        <details className="group" open={isEmpty}>
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
            <span>start a pact</span>
            <span
              className="transition-transform group-open:rotate-180"
              style={{ color: "rgba(255,255,255,0.7)" }}
              aria-hidden
            >
              ▾
            </span>
          </summary>
          <form
            action={createPact}
            className="mt-2 flex flex-col gap-3 p-4"
            style={{
              background: "var(--card)",
              border: "1px solid var(--line)",
              borderRadius: "var(--radius)",
            }}
          >
            <label className="block">
              <span className="label">Name the pact</span>
              <input
                name="name"
                type="text"
                required
                maxLength={80}
                placeholder="e.g. Meditate 10 minutes daily"
                className="mt-1.5 w-full outline-none"
                style={inputStyle}
              />
            </label>
            <IconPicker />
            <label className="block">
              <span className="label">Description (optional)</span>
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
            <fieldset>
              <legend className="label">How often</legend>
              <div className="mt-2 flex gap-3">
                {(["daily", "weekly"] as const).map((freq, i) => (
                  <label
                    key={freq}
                    className="press inline-flex flex-1 items-center justify-center gap-2 cursor-pointer"
                    style={{
                      minHeight: 44,
                      borderRadius: "var(--radius)",
                      border: "1.5px solid var(--line)",
                      background: "var(--card-inset)",
                      padding: "0 14px",
                      fontFamily: "var(--font-body)",
                      fontSize: 15,
                      color: "var(--ink)",
                      textTransform: "capitalize",
                    }}
                  >
                    <input
                      type="radio"
                      name="frequency"
                      value={freq}
                      defaultChecked={i === 0}
                      className="accent-[color:var(--accent)]"
                    />
                    {freq}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="label">Start date</span>
                <input
                  name="start_date"
                  type="date"
                  defaultValue={today()}
                  className="mt-1.5 w-full outline-none"
                  style={inputStyle}
                />
              </label>
              <label className="block">
                <span className="label">End date (optional)</span>
                <input
                  name="end_date"
                  type="date"
                  className="mt-1.5 w-full outline-none"
                  style={inputStyle}
                />
              </label>
            </div>
            <SubmitButton
              pendingLabel="creating…"
              className="w-full"
              style={primaryStyle}
            >
              start the pact
            </SubmitButton>
          </form>
        </details>

        <details className="group" open={isEmpty}>
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
            action={joinPactByCode}
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
