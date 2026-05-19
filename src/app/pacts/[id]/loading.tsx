import { Skeleton } from "@/components/ui/skeleton";

export default function PactDetailLoading() {
  return (
    <main className="mx-auto w-full max-w-2xl pt-6 pb-28">
      <div className="px-5">
        <Skeleton width={100} height={14} />
      </div>

      <section
        className="mx-5 mt-3 px-6 pt-8 pb-7"
        style={{
          background: "var(--accent2-soft)",
          borderRadius: "var(--radius-lg)",
        }}
      >
        <div className="mx-auto" style={{ width: 78 }}>
          <Skeleton width={78} height={78} rounded="22px" />
        </div>
        <div className="mt-4 flex flex-col items-center gap-2">
          <Skeleton width="60%" height={28} />
          <Skeleton width={84} height={6} rounded="999px" />
          <Skeleton width={140} height={12} className="mt-2" />
        </div>
      </section>

      <section className="px-5 pt-6">
        <Skeleton height={56} rounded="var(--radius-lg)" />
      </section>

      <section className="px-5 pt-6">
        <Skeleton width={92} height={12} />
        <div className="mt-3 flex flex-col gap-3">
          {[0, 1].map((i) => (
            <Skeleton key={i} height={108} />
          ))}
        </div>
      </section>
    </main>
  );
}
