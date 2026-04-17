import { Skeleton } from "@/components/ui/skeleton";

export default function UserDetailLoading() {
  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <Skeleton className="h-5 w-28" />

      {/* Page heading */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-56" />
        </div>
        <Skeleton className="h-6 w-16 rounded-full" />
      </div>

      {/* Account details card */}
      <div className="rounded-lg border p-6 space-y-4">
        <Skeleton className="h-5 w-32" />
        <div className="grid grid-cols-2 gap-x-8 gap-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-1">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-4 w-36" />
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
