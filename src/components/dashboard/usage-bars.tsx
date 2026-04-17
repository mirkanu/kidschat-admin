import getMongoClient from "@/lib/mongodb";
import { evaluateChildState } from "@/lib/budget";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface UsageBarsProps {
  userId: string;
  childName?: string;
}

/**
 * UsageBars — server component.
 *
 * Renders exactly 2 progress bars for a child:
 *   1. Daily spend: €X / €dailyCap
 *   2. Monthly spend: €X / €monthlyCap
 *
 * Driven exclusively by evaluateChildState (budget.ts).
 * No legacy cost-ledger imports, no bonus offer state.
 */
export async function UsageBars({ userId }: UsageBarsProps) {
  const client = await getMongoClient();
  const db = client.db("test");

  const state = await evaluateChildState(userId, db);

  const dailySpentEur = state.dailyCapEur - state.remainingEur;
  const dailyPercent = Math.min(
    100,
    Math.round((1 - state.dailyPctRemaining) * 100)
  );
  const monthlyPercent =
    state.monthlyCapEur > 0
      ? Math.min(
          100,
          Math.round((state.displayedMonthlySpendEur / state.monthlyCapEur) * 100)
        )
      : 0;

  // Color coding based on percentage used
  function barColor(pct: number) {
    if (pct >= 100) return "bg-red-500";
    if (pct >= 70) return "bg-amber-500";
    return "bg-green-500";
  }

  const dailyColor = barColor(dailyPercent);
  const monthlyColor = barColor(monthlyPercent);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Usage &amp; Limits</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Bar 1: Daily spend */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Today</span>
            <span className="font-medium tabular-nums">
              €{Math.max(0, dailySpentEur).toFixed(3)}{" "}
              <span className="text-muted-foreground">/ €{state.dailyCapEur.toFixed(2)}</span>
            </span>
          </div>
          <div className="relative h-2 w-full rounded-full bg-secondary overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${dailyColor}`}
              style={{ width: `${dailyPercent}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {dailyPercent}% of daily allowance used
          </p>
        </div>

        {/* Bar 2: Monthly spend */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">This month</span>
            <span className="font-medium tabular-nums">
              €{state.displayedMonthlySpendEur.toFixed(2)}{" "}
              <span className="text-muted-foreground">/ €{state.monthlyCapEur.toFixed(2)}</span>
            </span>
          </div>
          <div className="relative h-2 w-full rounded-full bg-secondary overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${monthlyColor}`}
              style={{ width: `${monthlyPercent}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {monthlyPercent}% of monthly cap used
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Skeleton fallback for UsageBars (2-bar shape).
 * Used by Suspense fallback in /users/[userId]/page.tsx
 */
export function UsageBarsSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="h-5 w-28 rounded bg-muted animate-pulse" />
      </CardHeader>
      <CardContent className="space-y-5">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="h-4 w-12 rounded bg-muted animate-pulse" />
              <div className="h-4 w-32 rounded bg-muted animate-pulse" />
            </div>
            <div className="h-2 w-full rounded-full bg-muted animate-pulse" />
            <div className="h-3 w-40 rounded bg-muted animate-pulse" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
