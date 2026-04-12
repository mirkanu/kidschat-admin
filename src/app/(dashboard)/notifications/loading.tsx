import { Skeleton } from "@/components/ui/skeleton";

export default function NotificationsLoading() {
  return (
    <div className="space-y-6">
      {/* Heading skeleton */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-80" />
      </div>

      {/* Summary badges skeleton */}
      <div className="flex items-center gap-3 flex-wrap">
        <Skeleton className="h-6 w-28" />
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-6 w-36" />
      </div>

      {/* Tab bar skeleton */}
      <div className="flex gap-1 bg-muted rounded-md p-1 w-fit">
        <Skeleton className="h-8 w-20 rounded-sm" />
        <Skeleton className="h-8 w-20 rounded-sm" />
      </div>

      {/* Table skeleton (history tab default) */}
      <div className="rounded-md border">
        {/* Header row */}
        <div className="grid grid-cols-5 gap-4 p-4 border-b bg-muted/40">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-20" />
        </div>
        {/* Data rows */}
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="grid grid-cols-5 gap-4 p-4 border-b last:border-0">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}
