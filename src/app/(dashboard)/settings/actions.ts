"use server";

import { revalidatePath } from "next/cache";
import getMongoClient from "@/lib/mongodb";
import type { GlobalDefaults, ChildOverride } from "@/lib/budget";

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function parseOptionalFloat(
  value: FormDataEntryValue | null
): number | undefined {
  if (value === null || value === "") return undefined;
  const n = parseFloat(value as string);
  if (isNaN(n) || n < 0) return undefined;
  return n;
}

function parseOptionalInt(
  value: FormDataEntryValue | null
): number | undefined {
  if (value === null || value === "") return undefined;
  const n = parseInt(value as string, 10);
  if (isNaN(n) || n < 0) return undefined;
  return n;
}

// ---------------------------------------------------------------------------
// Save global defaults
// ---------------------------------------------------------------------------

/**
 * Upserts the global_defaults settings doc.
 * Called from the Global Defaults tab form in settings-form.tsx.
 */
export async function saveGlobalDefaults(
  formData: FormData
): Promise<{ ok: boolean; error?: string }> {
  try {
    const dailyCostCapEur = parseOptionalFloat(formData.get("dailyCostCapEur"));
    const monthlyCostCapEur = parseOptionalFloat(
      formData.get("monthlyCostCapEur")
    );
    const dailySearchCountCap = parseOptionalInt(
      formData.get("dailySearchCountCap")
    );

    // Build update — only include fields that were provided
    const setFields: Partial<Omit<GlobalDefaults, "key">> = {};
    if (dailyCostCapEur !== undefined) setFields.dailyCostCapEur = dailyCostCapEur;
    if (monthlyCostCapEur !== undefined)
      setFields.monthlyCostCapEur = monthlyCostCapEur;
    if (dailySearchCountCap !== undefined)
      setFields.dailySearchCountCap = dailySearchCountCap;

    if (Object.keys(setFields).length === 0) {
      return { ok: false, error: "No changes to save" };
    }

    const client = await getMongoClient();
    const db = client.db("test");

    await db
      .collection("settings")
      .updateOne(
        { key: "global_defaults" } as Record<string, unknown>,
        { $set: { key: "global_defaults", ...setFields } },
        { upsert: true }
      );

    revalidatePath("/settings");
    revalidatePath("/"); // dashboard home reads limits for the overview card

    return { ok: true };
  } catch (err) {
    console.error("[saveGlobalDefaults] error:", err);
    return { ok: false, error: "Failed to save global defaults" };
  }
}

// ---------------------------------------------------------------------------
// Save per-child override
// ---------------------------------------------------------------------------

/**
 * Upserts a child_override settings doc.
 *
 * CRITICAL: userId is a CLOSURE PARAMETER — never read from formData.
 * This is the fix for the Plan 15-02 wiring bug where userId was accidentally
 * read from formData and could be missing/wrong depending on form state.
 *
 * Usage: <form action={saveChildOverride.bind(null, user._id.toString())}>
 *   (server action closure pattern — userId baked in at bind time)
 */
export async function saveChildOverride(
  userId: string,
  formData: FormData
): Promise<{ ok: boolean; userId: string; error?: string }> {
  try {
    // Parse each optional field; empty string → exclude from override (falls back to global)
    const dailyCostCapEur = parseOptionalFloat(formData.get("dailyCostCapEur"));
    const monthlyCostCapEur = parseOptionalFloat(
      formData.get("monthlyCostCapEur")
    );
    const dailySearchCountCap = parseOptionalInt(
      formData.get("dailySearchCountCap")
    );

    const setFields: Partial<Omit<ChildOverride, "key" | "userId">> = {};
    const unsetFields: Record<string, ""> = {};

    // Fields with values → set; fields without values → unset (fall back to global)
    if (dailyCostCapEur !== undefined) {
      setFields.dailyCostCapEur = dailyCostCapEur;
    } else {
      unsetFields.dailyCostCapEur = "";
    }

    if (monthlyCostCapEur !== undefined) {
      setFields.monthlyCostCapEur = monthlyCostCapEur;
    } else {
      unsetFields.monthlyCostCapEur = "";
    }

    if (dailySearchCountCap !== undefined) {
      setFields.dailySearchCountCap = dailySearchCountCap;
    } else {
      unsetFields.dailySearchCountCap = "";
    }

    const update: Record<string, unknown> = {
      $set: { key: "child_override", userId, ...setFields },
    };
    if (Object.keys(unsetFields).length > 0) {
      update.$unset = unsetFields;
    }

    const client = await getMongoClient();
    const db = client.db("test");

    await db
      .collection("settings")
      .updateOne(
        { key: "child_override", userId } as Record<string, unknown>,
        update,
        { upsert: true }
      );

    revalidatePath("/settings");
    revalidatePath(`/users/${userId}`);
    revalidatePath("/");

    return { ok: true, userId };
  } catch (err) {
    console.error("[saveChildOverride] error:", err);
    return { ok: false, userId, error: "Failed to save override" };
  }
}

// ---------------------------------------------------------------------------
// Delete per-child override
// ---------------------------------------------------------------------------

/**
 * Deletes the child_override doc for a user, reverting to global defaults.
 */
export async function deleteChildOverride(
  userId: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const client = await getMongoClient();
    const db = client.db("test");

    await db
      .collection("settings")
      .deleteOne({ key: "child_override", userId } as Record<string, unknown>);

    revalidatePath("/settings");
    revalidatePath(`/users/${userId}`);
    revalidatePath("/");

    return { ok: true };
  } catch (err) {
    console.error("[deleteChildOverride] error:", err);
    return { ok: false, error: "Failed to delete override" };
  }
}
