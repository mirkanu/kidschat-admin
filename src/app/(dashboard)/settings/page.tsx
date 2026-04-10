import { redirect } from "next/navigation";
import { Suspense } from "react";
import { auth } from "@/auth";
import getMongoClient from "@/lib/mongodb";
import { HARDCODED_DEFAULTS } from "@/lib/settings";
import type { EffectiveLimits } from "@/lib/settings";
import { SettingsForm } from "./settings-form";
import { Skeleton } from "@/components/ui/skeleton";

interface ChildUser {
  id: string;
  name: string;
}

type SettingsDoc = Partial<EffectiveLimits> & { _id?: string };

async function getSettingsData() {
  const client = await getMongoClient();
  const db = client.db("test");
  const settingsCol = db.collection<SettingsDoc>("settings");

  // Get global defaults and all non-ADMIN users in parallel
  const [globalDoc, childUsers, overrideDocs] = await Promise.all([
    settingsCol.findOne({ _id: "global_defaults" } as Parameters<typeof settingsCol.findOne>[0]),
    db
      .collection("users")
      .find({ role: { $ne: "ADMIN" } })
      .project<{ _id: { toString(): string }; name: string }>({ _id: 1, name: 1 })
      .sort({ name: 1 })
      .toArray(),
    settingsCol
      .find({ _id: { $regex: /^override_/ } } as Parameters<typeof settingsCol.find>[0])
      .toArray(),
  ]);

  const g: Partial<EffectiveLimits> = globalDoc ?? {};
  const d = HARDCODED_DEFAULTS;

  const globalDefaults: EffectiveLimits = {
    dailyImageLimit: g.dailyImageLimit ?? d.dailyImageLimit,
    dailyMessageLimit: g.dailyMessageLimit ?? d.dailyMessageLimit,
    monthlyCostCapEUR: g.monthlyCostCapEUR ?? d.monthlyCostCapEUR,
    weeklyBonusCap: g.weeklyBonusCap ?? d.weeklyBonusCap,
    bonusPackSize: g.bonusPackSize ?? d.bonusPackSize,
    bonusMessageTemplate: g.bonusMessageTemplate ?? d.bonusMessageTemplate,
  };

  // Build override map
  const overrideMap = new Map<string, Partial<EffectiveLimits>>();
  for (const doc of overrideDocs) {
    const id = (doc._id as string).replace("override_", "");
    // Strip MongoDB metadata, keep only EffectiveLimits fields
    const { _id: _, ...rest } = doc;
    // Filter out any non-limits fields (like awaitingBonusConfirmation)
    const limitFields: (keyof EffectiveLimits)[] = [
      "dailyImageLimit", "dailyMessageLimit", "monthlyCostCapEUR",
      "weeklyBonusCap", "bonusPackSize", "bonusMessageTemplate"
    ];
    const overrideOnly: Partial<EffectiveLimits> = {};
    for (const field of limitFields) {
      if (rest[field] !== undefined) {
        (overrideOnly as Record<string, unknown>)[field] = rest[field];
      }
    }
    if (Object.keys(overrideOnly).length > 0) {
      overrideMap.set(id, overrideOnly);
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
