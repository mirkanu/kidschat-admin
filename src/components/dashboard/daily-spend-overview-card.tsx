import Link from "next/link";
import getMongoClient from "@/lib/mongodb";
import { evaluateChildState } from "@/lib/budget";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { ArrowRight } from "lucide-react";

/**
 * DailySpendOverviewCard — server component (no props, fetches its own data).
 *
 * Shows a "Today's spend per child" progress bar for every non-admin child.
 * Fetches all children + runs evaluateChildState in parallel via Promise.all.
 * Uses native CSS progress bars for lightweight rendering without shadcn Progress.
 */
export async function DailySpendOverviewCard() {
  const client = await getMongoClient();
  const db = client.db("test");

  // Fetch all non-admin children
  const childUsers = await db
    .collection("users")
    .find({ role: { $ne: "ADMIN" } } as Record<string, unknown>)
    .project<{ _id: { toString(): string }; name: string }>({ _id: 1, name: 1 })
    .sort({ name: 1 })
    .toArray();

  if (childUsers.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Today&apos;s spend per child</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No children yet.</p>
        </CardContent>
      </Card>
    );
  }

  // Evaluate all children in parallel
  const states = await Promise.all(
    childUsers.map(async (u) => {
      const userId = u._id.toString();
      const state = await evaluateChildState(userId, db);
      return { userId, name: u.name ?? "Unknown", state };
    })
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Today&apos;s spend per child</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {states.map(({ userId, name, state }) => {
          const dailySpentEur = Math.max(0, state.dailyCapEur - state.remainingEur);
          const pctUsed = Math.min(
            100,
            Math.round((1 - state.dailyPctRemaining) * 100)
          );

          // Color coding
          let barColor = "bg-green-500";
          if (pctUsed >= 100 || state.hasActiveOffer) barColor = "bg-red-500";
          else if (pctUsed >= 70) barColor = "bg-amber-500";

          return (
            <div key={userId} className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <Link
                  href={`/users/${userId}`}
                  className="font-medium hover:underline transition-colors"
                >
                  {name}
                </Link>
                <span className="tabular-nums text-muted-foreground text-xs">
                  €{dailySpentEur.toFixed(3)} / €{state.dailyCapEur.toFixed(2)}
                </span>
              </div>
              <div className="relative h-2 w-full rounded-full bg-secondary overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${barColor}`}
                  style={{ width: `${pctUsed}%` }}
                />
              </div>
            </div>
          );
        })}
      </CardContent>
      <CardFooter className="pt-0">
        <Link
          href="/settings"
          className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
        >
          Edit limits
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </CardFooter>
    </Card>
  );
}

/**
 * Skeleton fallback matching the card shape (2–3 progress bar rows).
 */
export function DailySpendOverviewSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="h-5 w-48 rounded bg-muted animate-pulse" />
      </CardHeader>
      <CardContent className="space-y-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="h-4 w-24 rounded bg-muted animate-pulse" />
              <div className="h-3 w-28 rounded bg-muted animate-pulse" />
            </div>
            <div className="h-2 w-full rounded-full bg-muted animate-pulse" />
          </div>
        ))}
      </CardContent>
      <CardFooter className="pt-0">
        <div className="h-4 w-20 rounded bg-muted animate-pulse" />
      </CardFooter>
    </Card>
  );
}
