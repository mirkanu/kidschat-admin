import { Skeleton } from "@/components/ui/skeleton";

export default function SettingsLoading() {
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-4 w-72" />
      </div>

      {/* Tabs header */}
      <div className="flex gap-2">
        <Skeleton className="h-9 w-36 rounded-md" />
        <Skeleton className="h-9 w-44 rounded-md" />
      </div>

      {/* Global defaults section */}
      <div className="space-y-4">
        <div className="space-y-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-px w-full" />
        </div>

        {/* 2 number input rows (dailyCostCapEur, monthlyCostCapEur) */}
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="grid grid-cols-3 items-center gap-4">
            <Skeleton className="h-4 w-32 ml-auto" />
            <div className="col-span-2">
              <Skeleton className="h-9 w-full" />
            </div>
          </div>
        ))}
      </div>

      {/* Per-child overrides table skeleton */}
      <div className="space-y-3 pt-2">
        <Skeleton className="h-4 w-80" />
        <div className="rounded-md border overflow-hidden">
          {/* Table header */}
          <div className="flex items-center gap-3 p-3 border-b bg-muted/40">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-16 ml-auto" />
          </div>
          {/* 2–3 placeholder child rows */}
          {Array.from({ length: 2 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-3 p-3 border-b last:border-0"
            >
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-28" />
              <Skeleton className="h-8 w-28" />
              <Skeleton className="h-7 w-14 ml-auto" />
            </div>
          ))}
        </div>
      </div>

      {/* Save button */}
      <div className="flex justify-end">
        <Skeleton className="h-9 w-44" />
      </div>
    </div>
  );
}
