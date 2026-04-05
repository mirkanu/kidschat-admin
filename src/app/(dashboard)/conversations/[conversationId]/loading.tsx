import { Skeleton } from "@/components/ui/skeleton";

export default function ConversationDetailLoading() {
  return (
    <div className="space-y-4">
      {/* Back arrow + title skeleton */}
      <div className="flex items-center gap-3 mb-6">
        <Skeleton className="h-8 w-8 rounded-md" />
        <Skeleton className="h-7 w-64" />
        <Skeleton className="h-6 w-16 rounded-full ml-2" />
      </div>

      {/* Message thread skeleton: alternating right (child) and left (AI) */}
      <div className="space-y-4 max-h-[calc(100vh-200px)]">
        {/* Child message — right aligned */}
        <div className="flex justify-end">
          <div className="flex flex-col items-end gap-1 max-w-[70%]">
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-12 w-48 rounded-2xl rounded-tr-sm" />
            <Skeleton className="h-3 w-32" />
          </div>
        </div>

        {/* AI message — left aligned */}
        <div className="flex justify-start">
          <div className="flex flex-col items-start gap-1 max-w-[70%]">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-16 w-64 rounded-2xl rounded-tl-sm" />
            <Skeleton className="h-3 w-32" />
          </div>
        </div>

        {/* Child message — right aligned */}
        <div className="flex justify-end">
          <div className="flex flex-col items-end gap-1 max-w-[70%]">
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-10 w-56 rounded-2xl rounded-tr-sm" />
            <Skeleton className="h-3 w-32" />
          </div>
        </div>

        {/* AI message — left aligned */}
        <div className="flex justify-start">
          <div className="flex flex-col items-start gap-1 max-w-[70%]">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-20 w-72 rounded-2xl rounded-tl-sm" />
            <Skeleton className="h-3 w-32" />
          </div>
        </div>

        {/* Child message — right aligned */}
        <div className="flex justify-end">
          <div className="flex flex-col items-end gap-1 max-w-[70%]">
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-12 w-40 rounded-2xl rounded-tr-sm" />
            <Skeleton className="h-3 w-32" />
          </div>
        </div>

        {/* AI message — left aligned */}
        <div className="flex justify-start">
          <div className="flex flex-col items-start gap-1 max-w-[70%]">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-14 w-60 rounded-2xl rounded-tl-sm" />
            <Skeleton className="h-3 w-32" />
          </div>
        </div>
      </div>
    </div>
  );
}
