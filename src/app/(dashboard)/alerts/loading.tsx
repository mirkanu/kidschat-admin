import { Skeleton } from "@/components/ui/skeleton";

export default function AlertsLoading() {
  return (
    <div className="p-6 space-y-6">
      {/* Page heading skeleton */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-44" />
        <Skeleton className="h-4 w-64" />
      </div>

      {/* Summary badges skeleton */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-6 w-28" />
        <Skeleton className="h-6 w-36" />
        <Skeleton className="h-6 w-40" />
      </div>

      {/* Filter tabs skeleton */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-8 w-12" />
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-8 w-40" />
      </div>

      {/* Table skeleton */}
      <div className="rounded-md border">
        {/* Header row */}
        <div className="flex items-center gap-4 border-b px-4 py-3">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-12" />
        </div>

        {/* 6 skeleton table rows */}
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 border-b last:border-0 px-4 py-4"
          >
            <Skeleton className="h-5 w-28 rounded-full" />
            <Skeleton className="h-4 w-20" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-3/4" />
            </div>
            <Skeleton className="h-3 w-32 shrink-0" />
            <Skeleton className="h-6 w-6 rounded-md shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}
