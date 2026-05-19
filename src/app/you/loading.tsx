import { Skeleton } from "@/components/ui/skeleton";

export default function YouLoading() {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-10 pb-28">
      <header className="flex flex-col items-center pt-2 text-center">
        <Skeleton width={96} height={96} rounded="50%" />
        <Skeleton width={160} height={32} className="mt-4" />
        <Skeleton width={70} height={6} rounded="999px" className="mt-2" />
        <Skeleton width={200} height={12} className="mt-3" />
      </header>

      <section className="mt-6 grid grid-cols-3 gap-2.5">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} height={88} />
        ))}
      </section>

      <section className="mt-7">
        <Skeleton width={92} height={12} className="mb-2" />
        <Skeleton height={180} />
      </section>
    </main>
  );
}
