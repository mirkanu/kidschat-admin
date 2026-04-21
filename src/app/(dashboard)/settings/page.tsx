import { redirect } from "next/navigation";
import { Suspense } from "react";
import { auth } from "@/auth";
import getMongoClient from "@/lib/mongodb";
import { HARDCODED_DEFAULTS } from "@/lib/budget";
import type { GlobalDefaults, ChildOverride } from "@/lib/budget";
import { SettingsForm } from "./settings-form";
import { Skeleton } from "@/components/ui/skeleton";
import type { ChildOverrideRow } from "./types";
import { UsageBars, UsageBarsSkeleton } from "@/components/dashboard/usage-bars";
import { TopUpButton } from "../users/[userId]/top-up-button";

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

async function getSettingsData(): Promise<{
  globals: GlobalDefaults;
  overrides: ChildOverrideRow[];
  lastUpdated: string | null;
}> {
  const client = await getMongoClient();
  const db = client.db("test");
  const settingsCol = db.collection("settings");

  // Fetch all children (non-admin users)
  const childUsers = await db
    .collection("users")
    .find({ role: { $ne: "ADMIN" } } as Record<string, unknown>)
    .project<{ _id: { toString(): string }; name: string }>({ _id: 1, name: 1 })
    .sort({ name: 1 })
    .toArray();

  // Fetch global defaults
  const globalDoc = await settingsCol.findOne(
    { key: "global_defaults" } as Record<string, unknown>
  );

  const globals: GlobalDefaults = {
    key: "global_defaults",
    dailyCostCapEur:
      (globalDoc?.dailyCostCapEur as number | undefined) ??
      HARDCODED_DEFAULTS.dailyCostCapEur,
    monthlyCostCapEur:
      (globalDoc?.monthlyCostCapEur as number | undefined) ??
      HARDCODED_DEFAULTS.monthlyCostCapEur,
    dailySearchCountCap:
      (globalDoc?.dailySearchCountCap as number | undefined) ??
      HARDCODED_DEFAULTS.dailySearchCountCap,
  };

  // Fetch per-child override docs
  const overrideDocs = await settingsCol
    .find({ key: "child_override" } as Record<string, unknown>)
    .toArray();

  // Build override map keyed by userId
  const overrideMap = new Map<string, Partial<Omit<ChildOverride, "key" | "userId">>>();
  for (const doc of overrideDocs) {
    const uid = doc.userId as string | undefined;
    if (!uid) continue;
    const entry: Partial<Omit<ChildOverride, "key" | "userId">> = {};
    if (doc.dailyCostCapEur != null) entry.dailyCostCapEur = doc.dailyCostCapEur as number;
    if (doc.monthlyCostCapEur != null) entry.monthlyCostCapEur = doc.monthlyCostCapEur as number;
    if (doc.dailySearchCountCap != null) entry.dailySearchCountCap = doc.dailySearchCountCap as number;
    overrideMap.set(uid, Object.keys(entry).length > 0 ? entry : null as unknown as typeof entry);
  }

  const overrides: ChildOverrideRow[] = childUsers.map((u) => {
    const uid = u._id.toString();
    const override = overrideMap.get(uid) ?? null;
    return {
      userId: uid,
      childName: u.name ?? "Unknown",
      override: override && Object.keys(override).length > 0 ? override : null,
    };
  });

  const lastUpdated = globalDoc?.updatedAt
    ? new Date(globalDoc.updatedAt as Date).toLocaleString()
    : null;

  return { globals, overrides, lastUpdated };
}

// ---------------------------------------------------------------------------
// Server sub-component (inside Suspense)
// ---------------------------------------------------------------------------

async function SettingsContent() {
  const { globals, overrides, lastUpdated } = await getSettingsData();
  return (
    <SettingsForm globals={globals} overrides={overrides} lastUpdated={lastUpdated} />
  );
}

// ---------------------------------------------------------------------------
// Skeleton fallback (shown while SettingsContent is streaming)
// ---------------------------------------------------------------------------

function SettingsFormSkeleton() {
  return (
    <div className="space-y-6">
      {/* Tabs header */}
      <div className="flex gap-2">
        <Skeleton className="h-9 w-36 rounded-md" />
        <Skeleton className="h-9 w-44 rounded-md" />
      </div>

      {/* Global defaults tab inputs */}
      <div className="space-y-4">
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-px w-full" />
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="grid grid-cols-3 items-center gap-4">
            <Skeleton className="h-4 w-32 ml-auto" />
            <div className="col-span-2">
              <Skeleton className="h-9 w-full" />
            </div>
          </div>
        ))}
      </div>

      {/* Per-child table skeleton */}
      <div className="rounded-md border">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 p-3 border-b last:border-0">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-28" />
            <Skeleton className="h-8 w-28" />
            <Skeleton className="h-7 w-16" />
          </div>
        ))}
      </div>

      <div className="flex justify-end">
        <Skeleton className="h-9 w-40" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Per-child Usage section (above the tabs)
// ---------------------------------------------------------------------------

async function ChildUsageSection() {
  const { overrides } = await getSettingsData();
  // `overrides` is already the full list of non-admin children (userId + childName),
  // sorted by name — reuse it directly to avoid a second MongoDB roundtrip.

  if (overrides.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No child accounts yet.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {overrides.map((child) => (
        <div key={child.userId} className="space-y-3">
          <h3 className="text-base font-medium">{child.childName}</h3>
          <Suspense fallback={<UsageBarsSkeleton />}>
            <UsageBars userId={child.userId} childName={child.childName} />
          </Suspense>
          <div className="flex justify-end">
            <TopUpButton userId={child.userId} childName={child.childName} />
          </div>
        </div>
      ))}
    </div>
  );
}

function ChildUsageSectionSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="space-y-3">
          <Skeleton className="h-5 w-32" />
          <UsageBarsSkeleton />
          <div className="flex justify-end">
            <Skeleton className="h-9 w-32" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function SettingsPage() {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Usage Limits</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure daily and monthly cost caps and per-child overrides.
        </p>
      </div>

      {/* NEW: Current usage section */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Current usage</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Live balance and daily/monthly spend per child.
          </p>
        </div>
        <Suspense fallback={<ChildUsageSectionSkeleton />}>
          <ChildUsageSection />
        </Suspense>
      </section>

      {/* EXISTING: Tabs (Global Defaults / Per-Child Overrides) */}
      <Suspense fallback={<SettingsFormSkeleton />}>
        <SettingsContent />
      </Suspense>
    </div>
  );
}
