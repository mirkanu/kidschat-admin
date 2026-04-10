"use server";

import { revalidatePath } from "next/cache";
import getMongoClient from "@/lib/mongodb";
import type { EffectiveLimits } from "@/lib/settings";

type SettingsFields = Partial<EffectiveLimits>;
type SettingsDoc = Partial<EffectiveLimits> & { _id?: string };

function parseNumber(value: FormDataEntryValue | null): number | undefined {
  if (value === null || value === "") return undefined;
  const n = parseFloat(value as string);
  return isNaN(n) ? undefined : n;
}

/**
 * Save global default settings.
 */
export async function saveGlobalDefaults(formData: FormData): Promise<{ success: boolean; error?: string }> {
  try {
    const updates: SettingsFields = {};

    const dailyImageLimit = parseNumber(formData.get("dailyImageLimit"));
    if (dailyImageLimit !== undefined) updates.dailyImageLimit = dailyImageLimit;

    const dailyMessageLimit = parseNumber(formData.get("dailyMessageLimit"));
    if (dailyMessageLimit !== undefined) updates.dailyMessageLimit = dailyMessageLimit;

    const monthlyCostCapEUR = parseNumber(formData.get("monthlyCostCapEUR"));
    if (monthlyCostCapEUR !== undefined) updates.monthlyCostCapEUR = monthlyCostCapEUR;

    const weeklyBonusCap = parseNumber(formData.get("weeklyBonusCap"));
    if (weeklyBonusCap !== undefined) updates.weeklyBonusCap = weeklyBonusCap;

    const bonusPackSize = parseNumber(formData.get("bonusPackSize"));
    if (bonusPackSize !== undefined) updates.bonusPackSize = bonusPackSize;

    const bonusMessageTemplate = formData.get("bonusMessageTemplate");
    if (bonusMessageTemplate && typeof bonusMessageTemplate === "string" && bonusMessageTemplate.trim()) {
      updates.bonusMessageTemplate = bonusMessageTemplate.trim();
    }

    if (Object.keys(updates).length === 0) {
      return { success: false, error: "No changes to save" };
    }

    const client = await getMongoClient();
    const db = client.db("test");
    const col = db.collection<SettingsDoc>("settings");

    await col.updateOne(
      { _id: "global_defaults" } as Parameters<typeof col.updateOne>[0],
      { $set: updates },
      { upsert: true }
    );

    revalidatePath("/settings");
    return { success: true };
  } catch (err) {
    console.error("[saveGlobalDefaults] error:", err);
    return { success: false, error: "Failed to save settings" };
  }
}

/**
 * Save per-child override settings.
 */
export async function saveChildOverride(
  userId: string,
  formData: FormData
): Promise<{ success: boolean; error?: string }> {
  try {
    const updates: SettingsFields = {};

    const dailyImageLimit = parseNumber(formData.get("dailyImageLimit"));
    if (dailyImageLimit !== undefined) updates.dailyImageLimit = dailyImageLimit;

    const dailyMessageLimit = parseNumber(formData.get("dailyMessageLimit"));
    if (dailyMessageLimit !== undefined) updates.dailyMessageLimit = dailyMessageLimit;

    const monthlyCostCapEUR = parseNumber(formData.get("monthlyCostCapEUR"));
    if (monthlyCostCapEUR !== undefined) updates.monthlyCostCapEUR = monthlyCostCapEUR;

    const weeklyBonusCap = parseNumber(formData.get("weeklyBonusCap"));
    if (weeklyBonusCap !== undefined) updates.weeklyBonusCap = weeklyBonusCap;

    const bonusPackSize = parseNumber(formData.get("bonusPackSize"));
    if (bonusPackSize !== undefined) updates.bonusPackSize = bonusPackSize;

    const bonusMessageTemplate = formData.get("bonusMessageTemplate");
    if (bonusMessageTemplate && typeof bonusMessageTemplate === "string" && bonusMessageTemplate.trim()) {
      updates.bonusMessageTemplate = bonusMessageTemplate.trim();
    }

    const client = await getMongoClient();
    const db = client.db("test");
    const col = db.collection<SettingsDoc>("settings");

    await col.updateOne(
      { _id: `override_${userId}` } as Parameters<typeof col.updateOne>[0],
      { $set: updates },
      { upsert: true }
    );

    revalidatePath("/settings");
    revalidatePath(`/users/${userId}`);
    return { success: true };
  } catch (err) {
    console.error("[saveChildOverride] error:", err);
    return { success: false, error: "Failed to save override" };
  }
}

/**
 * Delete per-child override (revert to global defaults).
 */
export async function deleteChildOverride(
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const client = await getMongoClient();
    const db = client.db("test");
    const col = db.collection<SettingsDoc>("settings");

    await col.deleteOne(
      { _id: `override_${userId}` } as Parameters<typeof col.deleteOne>[0]
    );

    revalidatePath("/settings");
    revalidatePath(`/users/${userId}`);
    return { success: true };
  } catch (err) {
    console.error("[deleteChildOverride] error:", err);
    return { success: false, error: "Failed to delete override" };
  }
}
