"use server";

import { ObjectId } from "mongodb";
import { revalidatePath } from "next/cache";
import getMongoClient from "@/lib/mongodb";
import { eurToTokens, tokensToEur } from "@/lib/budget";

const MAX_TOP_UP_EUR = 10; // sanity cap per single action call
const HEX_24 = /^[a-f0-9]{24}$/i;

export async function topUpChildBalance(
  userId: string,
  amountEur: number
): Promise<{ ok: boolean; newBalanceEur?: number; error?: string }> {
  try {
    if (!HEX_24.test(userId)) {
      return { ok: false, error: "Invalid userId" };
    }
    if (typeof amountEur !== "number" || isNaN(amountEur) || amountEur <= 0) {
      return { ok: false, error: "Invalid amount" };
    }
    if (amountEur > MAX_TOP_UP_EUR) {
      return { ok: false, error: "Amount exceeds cap" };
    }

    const tokensToAdd = eurToTokens(amountEur);
    const client = await getMongoClient();
    const db = client.db("test");

    const result = await db.collection("balances").findOneAndUpdate(
      { user: new ObjectId(userId) },
      { $inc: { tokenCredits: tokensToAdd } },
      { upsert: true, returnDocument: "after" }
    );

    const newCredits = (result?.tokenCredits as number | undefined) ?? tokensToAdd;
    const newBalanceEur = tokensToEur(Math.max(0, newCredits));

    revalidatePath(`/users/${userId}`);
    revalidatePath("/settings");

    return { ok: true, newBalanceEur };
  } catch (err) {
    console.error("[topUpChildBalance] error:", err);
    return { ok: false, error: "Failed to top up balance" };
  }
}
