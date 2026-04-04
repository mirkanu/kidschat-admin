import { Skeleton } from "@/components/ui/skeleton";

export default function ConversationsLoading() {
  return (
    <div className="p-6 space-y-6">
      {/* Page heading skeleton */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>

      {/* Search + filter skeleton */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 flex-1" />
        <Skeleton className="h-7 w-12" />
        <Skeleton className="h-7 w-20" />
        <Skeleton className="h-7 w-20" />
      </div>

      {/* 8 conversation row skeletons */}
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 rounded-md border p-4"
          >
            {/* Icon */}
            <Skeleton className="h-8 w-8 rounded-md shrink-0" />
            {/* Title + child name */}
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-20" />
            </div>
            {/* Timestamp */}
            <Skeleton className="h-3 w-24 shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}
