import { Skeleton } from "@/components/ui/skeleton";

export default function PactsLoading() {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-10 pb-28">
      <header className="mb-5">
        <Skeleton width={180} height={40} />
        <Skeleton width={60} height={6} rounded="999px" className="mt-2" />
      </header>

      <div className="flex flex-col gap-3.5">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} height={88} />
        ))}
      </div>

      <div className="mt-5 flex flex-col gap-3">
        <Skeleton height={56} />
        <Skeleton height={56} />
      </div>
    </main>
  );
}
