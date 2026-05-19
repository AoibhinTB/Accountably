import { Skeleton } from "@/components/ui/skeleton";

export default function NewPactLoading() {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-6 pb-28">
      <Skeleton width={40} height={40} rounded="50%" />
      <div className="mt-4 mb-6">
        <Skeleton width="60%" height={36} />
        <Skeleton width={84} height={6} rounded="999px" className="mt-2" />
      </div>
      <div className="flex flex-col gap-5">
        <Skeleton height={52} />
        <Skeleton height={64} />
        <Skeleton height={80} />
        <Skeleton height={56} />
        <Skeleton height={56} />
        <Skeleton height={56} />
      </div>
    </main>
  );
}
