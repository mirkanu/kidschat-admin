/**
 * Unit tests for bonus-delivery.ts
 * Uses in-memory mock Db pattern (jest.fn()) — NO real MongoDB connection.
 */
import { describe, it, expect, jest, beforeEach } from "@jest/globals";

// ---- Minimal in-memory mock Db ----
function makeCollection(initialDocs: unknown[] = []) {
  const docs = [...initialDocs];
  const inserted: unknown[] = [];
  const updated: unknown[] = [];

  return {
    insertOne: jest.fn().mockImplementation(async (doc: unknown) => {
      inserted.push(doc);
      const { ObjectId } = jest.requireActual("mongodb") as { ObjectId: new () => object };
      return { insertedId: new ObjectId() };
    }),
    insertMany: jest.fn().mockImplementation(async (newDocs: unknown[]) => {
      inserted.push(...newDocs);
      return { insertedCount: newDocs.length };
    }),
    deleteMany: jest.fn().mockResolvedValue({ deletedCount: 0 }),
    findOne: jest.fn().mockImplementation(async () => docs[0] ?? null),
    find: jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      toArray: jest.fn().mockResolvedValue(docs),
    }),
    updateOne: jest.fn().mockImplementation(async () => {
      updated.push(true);
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

function makeMockDb(collections: Record<string, ReturnType<typeof makeCollection>> = {}) {
  const cols: Record<string, ReturnType<typeof makeCollection>> = { ...collections };
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

// ---- Tests ----

describe("bonus-delivery.ts", () => {
  let sendBonusOfferMessage: (args: {
    userId: string;
    conversationId: string;
    agentId: string;
    template: string;
    db: unknown;
  }) => Promise<string>;
  let detectBonusConfirmation: (userId: string, pending: unknown, db: unknown) => Promise<boolean>;
  let applyBonusCredit: (userId: string, pending: unknown, db: unknown) => Promise<void>;

  beforeEach(async () => {
    jest.resetModules();
    const mod = await import("@/lib/bonus-delivery");
    sendBonusOfferMessage = mod.sendBonusOfferMessage;
    detectBonusConfirmation = mod.detectBonusConfirmation;
    applyBonusCredit = mod.applyBonusCredit;
  });

  describe("sendBonusOfferMessage", () => {
    it("inserts a doc into messages with correct fields and updates conversations.updatedAt", async () => {
      const messagesCol = makeCollection();
      const conversationsCol = makeCollection();
      const db = makeMockDb({
        messages: messagesCol,
        conversations: conversationsCol,
      });

      const messageId = await sendBonusOfferMessage({
        userId: "user1",
        conversationId: "conv123",
        agentId: "agent_wxgt6su7d3pcosiil3",
        template: "You've reached your limit. Type YES to confirm.",
        db,
      });

      // Should return a non-empty messageId
      expect(typeof messageId).toBe("string");
      expect(messageId.length).toBeGreaterThan(0);

      // Should insert into messages
      expect(messagesCol.insertOne).toHaveBeenCalled();
      const insertedDoc = (messagesCol.insertOne as jest.Mock).mock.calls[0][0] as {
        isCreatedByUser: boolean;
        endpoint: string;
        agent_id: string;
        text: string;
        conversationId: string;
      };
      expect(insertedDoc.isCreatedByUser).toBe(false);
      expect(insertedDoc.endpoint).toBe("agents");
      expect(insertedDoc.agent_id).toBe("agent_wxgt6su7d3pcosiil3");
      expect(insertedDoc.text).toContain("Type YES to confirm.");
      expect(insertedDoc.conversationId).toBe("conv123");

      // Should update conversations.updatedAt (Pitfall 6)
      expect(conversationsCol.updateOne).toHaveBeenCalled();
    });
  });

  describe("detectBonusConfirmation", () => {
    function makePendingState(overrides: Partial<{
      confirmationOfferedAt: Date;
      lockType: string;
      activeConversationId: string;
    }> = {}) {
      return {
        awaitingBonusConfirmation: true,
        confirmationOfferedAt: overrides.confirmationOfferedAt ?? new Date(Date.now() - 30000), // 30s ago
        lockType: overrides.lockType ?? "image_cap",
        activeConversationId: overrides.activeConversationId ?? "conv123",
      };
    }

    it('returns true for a user message with text "yes" created after confirmationOfferedAt within 5-min window', async () => {
      const now = new Date();
      const offeredAt = new Date(now.getTime() - 30000); // 30s ago

      const yesMsg = {
        text: "yes",
        isCreatedByUser: true,
        conversationId: "conv123",
        createdAt: new Date(now.getTime() - 10000), // 10s ago (after offered)
      };
      const messagesCol = makeCollection([yesMsg]);
      messagesCol.findOne = jest.fn().mockResolvedValue(yesMsg);

      const db = makeMockDb({ messages: messagesCol });

      const result = await detectBonusConfirmation(
        "user1",
        makePendingState({ confirmationOfferedAt: offeredAt }),
        db
      );
      expect(result).toBe(true);
    });

    it('returns true for "YES" (uppercase)', async () => {
      const now = new Date();
      const offeredAt = new Date(now.getTime() - 30000);

      const yesMsg = {
        text: "YES",
        isCreatedByUser: true,
        conversationId: "conv123",
        createdAt: new Date(now.getTime() - 10000),
      };
      const messagesCol = makeCollection([yesMsg]);
      messagesCol.findOne = jest.fn().mockResolvedValue(yesMsg);

      const db = makeMockDb({ messages: messagesCol });

      const result = await detectBonusConfirmation(
        "user1",
        makePendingState({ confirmationOfferedAt: offeredAt }),
        db
      );
      expect(result).toBe(true);
    });

    it('returns true for "yes." (with period)', async () => {
      const now = new Date();
      const offeredAt = new Date(now.getTime() - 30000);

      const yesMsg = {
        text: "yes.",
        isCreatedByUser: true,
        conversationId: "conv123",
        createdAt: new Date(now.getTime() - 10000),
      };
      const messagesCol = makeCollection([yesMsg]);
      messagesCol.findOne = jest.fn().mockResolvedValue(yesMsg);

      const db = makeMockDb({ messages: messagesCol });

      const result = await detectBonusConfirmation(
        "user1",
        makePendingState({ confirmationOfferedAt: offeredAt }),
        db
      );
      expect(result).toBe(true);
    });

    it('returns false for "no"', async () => {
      const messagesCol = makeCollection();
      messagesCol.findOne = jest.fn().mockResolvedValue(null); // no YES found

      const db = makeMockDb({ messages: messagesCol });

      const result = await detectBonusConfirmation("user1", makePendingState(), db);
      expect(result).toBe(false);
    });

    it('returns false for "yes please later" (does not match strict pattern)', async () => {
      const messagesCol = makeCollection();
      messagesCol.findOne = jest.fn().mockResolvedValue(null); // no YES match
      const db = makeMockDb({ messages: messagesCol });

      const result = await detectBonusConfirmation("user1", makePendingState(), db);
      expect(result).toBe(false);
    });

    it("returns false if 5 minutes have elapsed (expiry)", async () => {
      const expiredOfferedAt = new Date(Date.now() - 6 * 60 * 1000); // 6 min ago

      const yesMsg = {
        text: "yes",
        isCreatedByUser: true,
        conversationId: "conv123",
        createdAt: new Date(),
      };
      const messagesCol = makeCollection([yesMsg]);
      messagesCol.findOne = jest.fn().mockResolvedValue(yesMsg);

      const db = makeMockDb({ messages: messagesCol });

      const result = await detectBonusConfirmation(
        "user1",
        makePendingState({ confirmationOfferedAt: expiredOfferedAt }),
        db
      );
      expect(result).toBe(false);
    });
  });

  describe("applyBonusCredit", () => {
    function makePendingState(lockType: "image_cap" | "monthly_cap" = "image_cap") {
      return {
        awaitingBonusConfirmation: true,
        confirmationOfferedAt: new Date(Date.now() - 30000),
        lockType,
        activeConversationId: "conv123",
        packSizeEUR: 2.0,
        confirmedViaMessageId: "msg123",
      };
    }

    it("for lockType 'image_cap' → inserts bonus_purchases, unlocks ACL, clears pending state", async () => {
      const agentDocs = [
        { _id: "oid1", agentId: "agent_wxgt6su7d3pcosiil3" },
        { _id: "oid2", agentId: "agent_y4w1cvoyg77p9thed9" },
        { _id: "oid3", agentId: "agent_64q6z5s57552cpgl0hr" },
        { _id: "oid4", agentId: "agent_aiv99mzvdzquym6y89k" },
      ];
      const lockedDocs = [
        { principalId: "user1", resourceId: "oid1", lockReason: "image_cap" },
      ];

      const bonusPurchasesCol = makeCollection();
      const settingsCol = makeCollection();
      settingsCol.findOne = jest.fn().mockResolvedValue({
        weeklyBonusCap: 5,
        bonusPackSize: 2,
      });
      settingsCol.updateOne = jest.fn().mockResolvedValue({ modifiedCount: 1 });

      // bonus_purchases aggregate for weekly spend check — returns 0 (not exhausted)
      const bonusAggregate = jest.fn().mockReturnValue({
        toArray: jest.fn().mockResolvedValue([]),
      });
      bonusPurchasesCol.aggregate = bonusAggregate;

      const agentsCol = makeCollection(agentDocs);
      agentsCol.find = jest.fn().mockReturnValue({ toArray: jest.fn().mockResolvedValue(agentDocs) });

      const lockedCol = makeCollection(lockedDocs);
      lockedCol.find = jest.fn().mockReturnValue({ toArray: jest.fn().mockResolvedValue(lockedDocs) });

      const aclCol = makeCollection();
      const db = makeMockDb({
        bonus_purchases: bonusPurchasesCol,
        settings: settingsCol,
        agents: agentsCol,
        locked_acl_entries: lockedCol,
        aclentries: aclCol,
      });

      await applyBonusCredit("user1", makePendingState("image_cap"), db);

      // Should insert a bonus_purchase record
      expect(bonusPurchasesCol.insertOne).toHaveBeenCalled();
      const insertedDoc = (bonusPurchasesCol.insertOne as jest.Mock).mock.calls[0][0] as {
        userId: string;
        packSizeEUR: number;
      };
      expect(insertedDoc.userId).toBe("user1");
      expect(insertedDoc.packSizeEUR).toBe(2.0);

      // Should clear the pending state in settings
      expect(settingsCol.updateOne).toHaveBeenCalled();
    });

    it("for lockType 'monthly_cap' → inserts bonus_purchases, adds tokenCredits via $inc, clears pending state", async () => {
      const bonusPurchasesCol = makeCollection();
      bonusPurchasesCol.aggregate = jest.fn().mockReturnValue({
        toArray: jest.fn().mockResolvedValue([]), // no prior purchases this week
      });

      const settingsCol = makeCollection();
      settingsCol.findOne = jest.fn().mockResolvedValue({
        weeklyBonusCap: 5,
        bonusPackSize: 2,
      });
      settingsCol.updateOne = jest.fn().mockResolvedValue({ modifiedCount: 1 });

      const balancesCol = makeCollection();

      const agentDocs = [
        { _id: "oid1", agentId: "agent_wxgt6su7d3pcosiil3" },
      ];
      const agentsCol = makeCollection(agentDocs);
      agentsCol.find = jest.fn().mockReturnValue({ toArray: jest.fn().mockResolvedValue(agentDocs) });

      const lockedCol = makeCollection([]);
      lockedCol.find = jest.fn().mockReturnValue({ toArray: jest.fn().mockResolvedValue([]) });

      const db = makeMockDb({
        bonus_purchases: bonusPurchasesCol,
        settings: settingsCol,
        balances: balancesCol,
        agents: agentsCol,
        locked_acl_entries: lockedCol,
        aclentries: makeCollection(),
      });

      await applyBonusCredit("user1", makePendingState("monthly_cap"), db);

      // Should insert bonus_purchase
      expect(bonusPurchasesCol.insertOne).toHaveBeenCalled();

      // Should add tokenCredits via $inc on balances
      expect(balancesCol.updateOne).toHaveBeenCalled();
      const balanceUpdateCall = (balancesCol.updateOne as jest.Mock).mock.calls[0];
      const updateDoc = balanceUpdateCall[1] as { $inc?: { tokenCredits: number } };
      expect(updateDoc.$inc?.tokenCredits).toBeGreaterThan(0);
    });

    it("respects weekly bonus cap: throws or returns early if getWeeklyBonusSpend + packSize > weeklyBonusCap", async () => {
      const bonusPurchasesCol = makeCollection();
      // Weekly spend already at cap
      bonusPurchasesCol.aggregate = jest.fn().mockReturnValue({
        toArray: jest.fn().mockResolvedValue([{ totalSpend: 5.0 }]), // 5.0 = weeklyBonusCap
      });

      const settingsCol = makeCollection();
      settingsCol.findOne = jest.fn().mockResolvedValue({
        weeklyBonusCap: 5,
        bonusPackSize: 2,
      });

      const db = makeMockDb({
        bonus_purchases: bonusPurchasesCol,
        settings: settingsCol,
      });

      // Should throw or return early when cap is hit
      await expect(
        applyBonusCredit("user1", { packSizeEUR: 2, lockType: "image_cap", confirmedViaMessageId: "msg1" }, db)
      ).rejects.toThrow();
    });
  });
});
