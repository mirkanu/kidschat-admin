import { redirect } from "next/navigation";
import { Suspense } from "react";
import { auth } from "@/auth";
import getMongoClient from "@/lib/mongodb";
import { getEffectiveLimits } from "@/lib/settings";
import type { EffectiveLimits } from "@/lib/settings";
import { SettingsForm } from "./settings-form";
import { Skeleton } from "@/components/ui/skeleton";

interface ChildUser {
  id: string;
  name: string;
}

async function getSettingsData() {
  const client = await getMongoClient();
  const db = client.db("test");
  const settingsCol = db.collection("settings");

  // Get child users list
  const childUsers = await db
    .collection("users")
    .find({ role: { $ne: "ADMIN" } })
    .project<{ _id: { toString(): string }; name: string }>({ _id: 1, name: 1 })
    .sort({ name: 1 })
    .toArray();

  // Global defaults via the legacy shim (maps new budget schema to old EffectiveLimits shape)
  // Use a dummy userId — global only, no override
  const globalDefaults = await getEffectiveLimits("__global__", db);

  // Per-child overrides: fetch docs with key: "child_override"
  const overrideDocs = await settingsCol
    .find({ key: "child_override" } as Parameters<typeof settingsCol.find>[0])
    .toArray();

  // Build override map
  const overrideMap = new Map<string, Partial<EffectiveLimits>>();
  for (const doc of overrideDocs) {
    const userId = doc.userId as string;
    if (!userId) continue;
    const overrideOnly: Partial<EffectiveLimits> = {};
    // Map new schema fields to legacy EffectiveLimits shape for the settings form
    if (doc.monthlyCostCapEur != null) overrideOnly.monthlyCostCapEUR = doc.monthlyCostCapEur as number;
    if (doc.bonusPackEur != null) overrideOnly.bonusPackSize = doc.bonusPackEur as number;
    if (doc.weeklyBonusCapEur != null) overrideOnly.weeklyBonusCap = doc.weeklyBonusCapEur as number;
    if (Object.keys(overrideOnly).length > 0) {
      overrideMap.set(userId, overrideOnly);
    }
  }

  const children: ChildUser[] = childUsers.map((u) => ({
    id: u._id.toString(),
    name: u.name ?? "Unknown",
  }));

  const childOverrides = children.map((child) => ({
    userId: child.id,
    childName: child.name,
    override: overrideMap.get(child.id) ?? null,
  }));

  return { globalDefaults, childOverrides };
}

async function SettingsContent() {
  const { globalDefaults, childOverrides } = await getSettingsData();
  return <SettingsForm globalDefaults={globalDefaults} childOverrides={childOverrides} />;
}

function SettingsFormSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        <Skeleton className="h-9 w-36 rounded-md" />
        <Skeleton className="h-9 w-40 rounded-md" />
      </div>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="grid grid-cols-3 items-center gap-4">
          <Skeleton className="h-4 w-32 ml-auto" />
          <div className="col-span-2">
            <Skeleton className={i === 4 ? "h-20 w-full" : "h-9 w-full"} />
          </div>
        </div>
      ))}
      <div className="flex justify-end">
        <Skeleton className="h-9 w-40" />
      </div>
    </div>
  );
}

export default async function SettingsPage() {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure global usage limits and per-child overrides.
        </p>
      </div>

      <Suspense fallback={<SettingsFormSkeleton />}>
        <SettingsContent />
      </Suspense>
    </div>
  );
}
