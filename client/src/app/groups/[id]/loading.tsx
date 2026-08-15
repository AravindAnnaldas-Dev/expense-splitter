import { Skeleton } from "@/components/Skeleton";

// Next.js shows this automatically during the client-side transition into
// this route segment — covering the gap between clicking a group card and
// the page's own component mounting (and taking over with its own
// query-driven loading state).
export default function GroupDetailLoading() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div className="flex flex-col gap-8">
        <Skeleton className="h-4 w-28" />
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-24" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-10 w-28" />
            <Skeleton className="h-10 w-28" />
          </div>
        </div>
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
      </div>
    </div>
  );
}
