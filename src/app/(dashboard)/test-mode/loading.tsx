import { Skeleton } from "@/components/ui/skeleton";

export default function TestModeLoading() {
  return (
    <div className="p-6 space-y-6">
      {/* Page heading skeleton */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-36" />
        <Skeleton className="h-4 w-64" />
      </div>

      {/* Scenario button skeletons (2x2 on mobile, 4 across on desktop) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-md" />
        ))}
      </div>

      {/* Chat area skeleton */}
      <div className="rounded-lg border bg-card overflow-hidden">
        {/* Chat messages area */}
        <div className="p-4 min-h-[300px] flex flex-col items-center justify-center gap-2">
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-4 w-72" />
          <Skeleton className="h-4 w-56" />
        </div>

        {/* Input area skeleton */}
        <div className="border-t p-3 flex items-center gap-2">
          <Skeleton className="h-10 flex-1 rounded-md" />
          <Skeleton className="h-10 w-10 rounded-md shrink-0" />
        </div>
      </div>
    </div>
  );
}
