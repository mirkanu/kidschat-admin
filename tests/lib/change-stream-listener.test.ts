/**
 * Unit tests for change-stream-listener.ts processMessageEvent
 *
 * Required 4 test cases per Plan 15-04:
 * 1. Idempotent 70% warning: double-call with same messageId must NOT double-insert warning
 * 2. Idempotent YES credit: double-call with YES messageId must NOT double-credit
 * 3. YES after expiry rejected: message.createdAt > activeOfferExpiresAt → no credit
 * 4. YES before expiry accepted: message.createdAt < activeOfferExpiresAt → credit applied
 */

import { describe, it, expect, jest, beforeEach } from "@jest/globals";

// ---- Minimal in-memory mock Db ----
function makeCollection(initialDocs: unknown[] = []) {
  const docs = [...initialDocs];
  const inserted: unknown[] = [];
  const updated: { query: unknown; update: unknown; options?: unknown }[] = [];

  return {
    insertOne: jest.fn().mockImplementation(async (doc: unknown) => {
      inserted.push(doc);
      return { insertedId: "mock_id_" + Date.now() };
    }),
    findOne: jest.fn().mockImplementation(async () => docs[0] ?? null),
    find: jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      toArray: jest.fn().mockResolvedValue(docs),
    }),
    updateOne: jest.fn().mockImplementation(async (query: unknown, update: unknown, options?: unknown) => {
      updated.push({ query, update, options });
      return { modifiedCount: 1 };
    }),
    aggregate: jest.fn().mockReturnValue({
      toArray: jest.fn().mockResolvedValue([]),
    }),
    countDocuments: jest.fn().mockResolvedValue(docs.length),
    _docs: docs,
    _inserted: inserted,
    _updated: updated,
  };
}

type MockDb = {
  collection: jest.Mock;
  _cols: Record<string, ReturnType<typeof makeCollection>>;
};

function makeMockDb(collections: Record<string, ReturnType<typeof makeCollection> | unknown[]> = {}): MockDb {
  const cols: Record<string, ReturnType<typeof makeCollection>> = {};
  for (const [name, val] of Object.entries(collections)) {
    if (Array.isArray(val)) {
      cols[name] = makeCollection(val);
    } else {
      cols[name] = val as ReturnType<typeof makeCollection>;
    }
  }
  return {
    collection: jest.fn().mockImplementation((name: string) => {
      if (!cols[name]) {
        cols[name] = makeCollection();
      }
      return cols[name];
    }),
    _cols: cols,
  };
}

function makeSettingsCol(overrides: Partial<{
  dailyCostCapEur: number;
  monthlyCostCapEur: number;
  bonusPackEur: number;
  weeklyBonusCapEur: number;
}> = {}) {
  const col = makeCollection();
  col.findOne = jest.fn().mockResolvedValue({
    key: "global_defaults",
    dailyCostCapEur: overrides.dailyCostCapEur ?? 0.10,
    monthlyCostCapEur: overrides.monthlyCostCapEur ?? 2.00,
    bonusPackEur: overrides.bonusPackEur ?? 0.20,
    weeklyBonusCapEur: overrides.weeklyBonusCapEur ?? 0.50,
    bonusMessageTemplate: "You've reached your limit. Type YES to unlock extra usage.",
  });
  return col;
}

// ---- Tests ----

describe("change-stream-listener.ts processMessageEvent", () => {
  let processMessageEvent: (event: {
    userId: string;
    text: string;
    conversationId: string;
    messageId: string;
    createdAt: Date;
    db: unknown;
  }) => Promise<void>;

  beforeEach(async () => {
    jest.resetModules();
    const mod = await import("@/lib/change-stream-listener");
    processMessageEvent = mod.processMessageEvent;
  });

  // ---- Test 1: Idempotent 70% warning ----
  it("does NOT double-insert 70% warning when called twice with same messageId (warnedAt70PctOn guard)", async () => {
    const todayIso = new Date().toISOString().split("T")[0];
    // Already warned today
    const balanceStateDoc = {
      userId: "000000000000000000000001",
      monthlySpendEur: 0.50,
      warnedAt70PctOn: todayIso, // already warned today
      activeOfferMessageId: null,
      activeOfferExpiresAt: null,
      activeOfferConversationId: null,
      lastDailyReset: new Date(),
      lastMonthlyReset: new Date(),
    };

    const balanceStateCol = makeCollection([balanceStateDoc]);
    // findOne returns the already-warned state
    balanceStateCol.findOne = jest.fn().mockResolvedValue(balanceStateDoc);

    const settingsCol = makeSettingsCol();
    const balancesCol = makeCollection([{ user: "000000000000000000000001", tokenCredits: 25000 }]); // ~25% remaining of 0.10 = below 30%
    const messagesCol = makeCollection();
    const bonusPurchasesCol = makeCollection();
    bonusPurchasesCol.aggregate = jest.fn().mockReturnValue({ toArray: jest.fn().mockResolvedValue([]) });
    const conversationsCol = makeCollection([{ conversationId: "conv1", user: "000000000000000000000001", updatedAt: new Date() }]);
    conversationsCol.findOne = jest.fn().mockResolvedValue({ conversationId: "conv1", user: "000000000000000000000001" });

    const db = makeMockDb({
      settings: settingsCol,
      balance_state: balanceStateCol,
      balances: balancesCol,
      messages: messagesCol,
      bonus_purchases: bonusPurchasesCol,
      conversations: conversationsCol,
    });

    const event = {
      userId: "000000000000000000000001",
      text: "Hello!",
      conversationId: "conv1",
      messageId: "msg_1",
      createdAt: new Date(),
      db,
    };

    // Call twice
    await processMessageEvent(event);
    await processMessageEvent(event);

    // Since warnedAt70PctOn is already today, NO warning should be inserted
    expect(messagesCol.insertOne).not.toHaveBeenCalled();
  });

  // ---- Test 2: Idempotent YES credit ----
  it("does NOT double-credit when YES processMessageEvent called twice (activeOfferMessageId cleared after first call)", async () => {
    const now = new Date();
    const futureExpiry = new Date(now.getTime() + 300_000); // 5 min from now

    // Simulate mutable state: the balance_state is updated by applyBonusCredit
    const mutableState = {
      userId: "000000000000000000000002",
      monthlySpendEur: 2.00, // monthly cap exhausted — prevents new offer being triggered
      warnedAt70PctOn: null,
      activeOfferMessageId: "offer_msg_abc",
      activeOfferExpiresAt: futureExpiry,
      activeOfferConversationId: "conv2",
      lastDailyReset: new Date(),
      lastMonthlyReset: new Date(),
    };

    const balanceStateCol = makeCollection([mutableState]);
    balanceStateCol.findOne = jest.fn().mockImplementation(async () => {
      // Return a copy of the current mutable state
      return { ...mutableState };
    });
    // Simulate applyBonusCredit clearing the offer via updateOne
    balanceStateCol.updateOne = jest.fn().mockImplementation(async (_query: unknown, update: unknown) => {
      const upd = update as { $set?: Record<string, unknown> };
      if (upd.$set?.activeOfferMessageId === null) {
        // Simulate the state being cleared
        mutableState.activeOfferMessageId = null as unknown as string;
        mutableState.activeOfferExpiresAt = null as unknown as Date;
      }
      return { modifiedCount: 1 };
    });

    const settingsCol = makeSettingsCol();
    const balancesCol = makeCollection([{ user: "000000000000000000000002", tokenCredits: 0 }]);
    // Simulate $inc on balances
    balancesCol.updateOne = jest.fn().mockResolvedValue({ modifiedCount: 1 });

    const bonusPurchasesCol = makeCollection();
    bonusPurchasesCol.aggregate = jest.fn().mockReturnValue({ toArray: jest.fn().mockResolvedValue([]) });

    const db = makeMockDb({
      settings: settingsCol,
      balance_state: balanceStateCol,
      balances: balancesCol,
      bonus_purchases: bonusPurchasesCol,
      messages: makeCollection(),
    });

    const yesEvent = {
      userId: "000000000000000000000002",
      text: "YES",
      conversationId: "conv2",
      messageId: "msg_yes_2",
      createdAt: new Date(now.getTime() - 30_000), // 30s ago = before expiry
      db,
    };

    // First call — should credit
    await processMessageEvent(yesEvent);
    const firstCallInsertCount = bonusPurchasesCol.insertOne.mock.calls.length;
    expect(firstCallInsertCount).toBe(1); // credited once

    // Second call — offer already cleared (activeOfferMessageId=null), should NOT credit again
    await processMessageEvent(yesEvent);
    const secondCallInsertCount = bonusPurchasesCol.insertOne.mock.calls.length;
    expect(secondCallInsertCount).toBe(1); // still just 1 — no double-credit
  });

  // ---- Test 3: YES after expiry rejected ----
  it("does NOT credit bonus when YES message createdAt > activeOfferExpiresAt (expired offer)", async () => {
    const now = new Date();
    // Offer expired 10 minutes ago
    const pastExpiry = new Date(now.getTime() - 10 * 60_000);

    const balanceStateDoc = {
      userId: "000000000000000000000003",
      monthlySpendEur: 0,
      warnedAt70PctOn: null,
      activeOfferMessageId: "offer_expired",
      activeOfferExpiresAt: pastExpiry,
      activeOfferConversationId: "conv3",
      lastDailyReset: new Date(),
      lastMonthlyReset: new Date(),
    };

    const balanceStateCol = makeCollection([balanceStateDoc]);
    balanceStateCol.findOne = jest.fn().mockResolvedValue(balanceStateDoc);

    const settingsCol = makeSettingsCol();
    // Some tokens remaining so evaluateChildState doesn't fire a new offer
    const balancesCol = makeCollection([{ user: "000000000000000000000003", tokenCredits: 80000 }]); // plenty remaining
    const bonusPurchasesCol = makeCollection();
    bonusPurchasesCol.aggregate = jest.fn().mockReturnValue({ toArray: jest.fn().mockResolvedValue([]) });
    const messagesCol = makeCollection();
    const conversationsCol = makeCollection([{ conversationId: "conv3", user: "000000000000000000000003", updatedAt: new Date() }]);

    const db = makeMockDb({
      settings: settingsCol,
      balance_state: balanceStateCol,
      balances: balancesCol,
      bonus_purchases: bonusPurchasesCol,
      messages: messagesCol,
      conversations: conversationsCol,
    });

    // YES message created AFTER expiry
    const yesAfterExpiry = {
      userId: "000000000000000000000003",
      text: "YES",
      conversationId: "conv3",
      messageId: "msg_late_yes",
      createdAt: new Date(now.getTime() - 5 * 60_000), // 5 min ago = AFTER the pastExpiry (10 min ago)
      // Wait: createdAt (5 min ago) > activeOfferExpiresAt (10 min ago) — YES is after expiry
      db,
    };

    await processMessageEvent(yesAfterExpiry);

    // Should NOT have inserted a bonus_purchase
    expect(bonusPurchasesCol.insertOne).not.toHaveBeenCalled();
  });

  // ---- Test 4: YES before expiry accepted ----
  it("credits bonus when YES message createdAt < activeOfferExpiresAt (valid offer window)", async () => {
    const now = new Date();
    // Offer expires in 4 minutes
    const futureExpiry = new Date(now.getTime() + 4 * 60_000);

    const balanceStateDoc = {
      userId: "000000000000000000000004",
      monthlySpendEur: 0,
      warnedAt70PctOn: null,
      activeOfferMessageId: "offer_active",
      activeOfferExpiresAt: futureExpiry,
      activeOfferConversationId: "conv4",
      lastDailyReset: new Date(),
      lastMonthlyReset: new Date(),
    };

    const balanceStateCol = makeCollection([balanceStateDoc]);
    balanceStateCol.findOne = jest.fn().mockResolvedValue(balanceStateDoc);

    const settingsCol = makeSettingsCol();
    const balancesCol = makeCollection([{ user: "000000000000000000000004", tokenCredits: 0 }]);
    const bonusPurchasesCol = makeCollection();
    bonusPurchasesCol.aggregate = jest.fn().mockReturnValue({ toArray: jest.fn().mockResolvedValue([]) });
    const messagesCol = makeCollection();

    const db = makeMockDb({
      settings: settingsCol,
      balance_state: balanceStateCol,
      balances: balancesCol,
      bonus_purchases: bonusPurchasesCol,
      messages: messagesCol,
    });

    // YES message created 30 seconds ago (before the future expiry = within window)
    const yesBeforeExpiry = {
      userId: "000000000000000000000004",
      text: "YES",
      conversationId: "conv4",
      messageId: "msg_valid_yes",
      createdAt: new Date(now.getTime() - 30_000), // 30s ago < futureExpiry
      db,
    };

    await processMessageEvent(yesBeforeExpiry);

    // Should have inserted a bonus_purchase record
    expect(bonusPurchasesCol.insertOne).toHaveBeenCalled();
    const purchaseDoc = bonusPurchasesCol._inserted[0] as Record<string, unknown>;
    expect(purchaseDoc.userId).toBe("000000000000000000000004");
  });
});
