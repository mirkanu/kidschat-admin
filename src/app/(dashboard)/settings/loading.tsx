import { Skeleton } from "@/components/ui/skeleton";

export default function SettingsLoading() {
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-4 w-64" />
      </div>

      {/* Tabs header */}
      <div className="flex gap-2">
        <Skeleton className="h-9 w-36 rounded-md" />
        <Skeleton className="h-9 w-40 rounded-md" />
      </div>

      {/* Form skeleton */}
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-px w-full" />
        </div>

        {/* Field rows */}
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="grid grid-cols-3 items-center gap-4">
            <Skeleton className="h-4 w-32 ml-auto" />
            <div className="col-span-2">
              <Skeleton className="h-9 w-full" />
            </div>
          </div>
        ))}

        <div className="space-y-2 pt-2">
          <Skeleton className="h-5 w-44" />
          <Skeleton className="h-px w-full" />
        </div>

        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i + 3} className="grid grid-cols-3 items-center gap-4">
            <Skeleton className="h-4 w-32 ml-auto" />
            <div className="col-span-2">
              <Skeleton className={i === 2 ? "h-20 w-full" : "h-9 w-full"} />
            </div>
          </div>
        ))}
      </div>

      {/* Save button */}
      <div className="flex justify-end">
        <Skeleton className="h-9 w-40" />
      </div>
    </div>
  );
}
