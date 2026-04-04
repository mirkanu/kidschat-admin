import { Suspense } from "react";
import { auth } from "@/auth";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getSystemStatus, get24hDigest, getRecentAlerts } from "@/lib/trust-dashboard";
import {
  SafetyStatusCard,
  ActivityDigestCard,
  RecentAlertsCard,
  QuickLinksGrid,
} from "./page-client";

// ---------------------------------------------------------------------------
// Async server sub-components — each fetches its own data slice
// ---------------------------------------------------------------------------

async function SafetyStatusSection() {
  const status = await getSystemStatus();
  return <SafetyStatusCard status={status} />;
}

async function DigestSection() {
  const digest = await get24hDigest();
  return <ActivityDigestCard digest={digest} />;
}

async function AlertsSection() {
  const alerts = await getRecentAlerts(5);
  return <RecentAlertsCard alerts={alerts} />;
}

// ---------------------------------------------------------------------------
// Skeleton fallbacks
// ---------------------------------------------------------------------------

function StatusSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-full" />
          <div className="space-y-1">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-3 w-28" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-full" />
        ))}
      </CardContent>
    </Card>
  );
}

function DigestSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <Skeleton className="h-5 w-32" />
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-1 rounded-lg border p-3">
              <Skeleton className="h-5 w-5 rounded" />
              <Skeleton className="h-8 w-12" />
              <Skeleton className="h-3 w-20" />
            </div>
          ))}
        </div>
        <Skeleton className="h-4 w-36" />
      </CardContent>
    </Card>
  );
}

function AlertsSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <Skeleton className="h-5 w-44" />
      </CardHeader>
      <CardContent className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-1 border-b pb-3 last:border-0 last:pb-0">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-24 rounded-full" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-3 w-12 ml-auto" />
            </div>
            <Skeleton className="h-3 w-full" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function DashboardPage() {
  const session = await auth();
  const firstName = session?.user?.name?.split(" ")[0] ?? "Parent";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Welcome back, {firstName}</h2>
        <p className="text-muted-foreground">Your KidsChat safety overview.</p>
      </div>

      {/* Section 1: Safety Status */}
      <Suspense fallback={<StatusSkeleton />}>
        <SafetyStatusSection />
      </Suspense>

      {/* Section 2: 24h Activity Digest */}
      <Suspense fallback={<DigestSkeleton />}>
        <DigestSection />
      </Suspense>

      {/* Section 3: Recent Safety Alerts */}
      <Suspense fallback={<AlertsSkeleton />}>
        <AlertsSection />
      </Suspense>

      {/* Section 4: Quick Links (static) */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Quick Links
        </h3>
        <QuickLinksGrid />
      </div>
    </div>
  );
}
