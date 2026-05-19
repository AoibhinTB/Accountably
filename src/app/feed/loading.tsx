import { Skeleton } from "@/components/ui/skeleton";

export default function FeedLoading() {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-10 pb-28">
      <header className="mb-5 flex items-end justify-between gap-3">
        <div className="flex-1">
          <Skeleton width={64} height={10} rounded="999px" />
          <Skeleton width="70%" height={36} className="mt-2" />
          <Skeleton width={84} height={6} rounded="999px" className="mt-2" />
        </div>
        <Skeleton width={34} height={34} rounded="50%" />
      </header>

      <div className="mb-7">
        <Skeleton width={56} height={10} rounded="999px" />
        <div className="mt-2 flex gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex flex-col items-center gap-1.5">
              <Skeleton width={76} height={76} rounded="50%" />
              <Skeleton width={68} height={12} className="mt-1" />
            </div>
          ))}
        </div>
      </div>

      <Skeleton width={120} height={20} className="mb-3" />
      <div className="flex flex-col gap-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} height={108} />
        ))}
      </div>
    </main>
  );
}
