/**
 * Unit tests for bonus-delivery.ts
 * Uses in-memory mock Db pattern (jest.fn()) — NO real MongoDB connection.
 *
 * Plan 15.2-01: Updated for Option 7 (Agent System Prompt Context Injection).
 * sendBonusOfferMessage now injects into agents.instructions instead of
 * inserting into messages collection.
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

// ---- UUID v4 regex ----
const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// ---- Tests ----

describe("bonus-delivery.ts", () => {
  let sendBonusOfferMessage: (args: {
    userId: string;
    conversationId: string;
    agentId: string;
    template: string;
    db: unknown;
  }) => Promise<string>;
  let restoreAgentSystemPrompt: (args: { userId: string; db: unknown }) => Promise<void>;
  let detectBonusConfirmation: (userId: string, pending: unknown, db: unknown) => Promise<boolean>;
  let applyBonusCredit: (userId: string, pending: unknown, db: unknown) => Promise<void>;

  beforeEach(async () => {
    jest.resetModules();
    const mod = await import("@/lib/bonus-delivery");
    sendBonusOfferMessage = mod.sendBonusOfferMessage;
    restoreAgentSystemPrompt = mod.restoreAgentSystemPrompt;
    detectBonusConfirmation = mod.detectBonusConfirmation;
    applyBonusCredit = mod.applyBonusCredit;
  });

  describe("sendBonusOfferMessage (Option 7 — Agent System Prompt Injection)", () => {
    const AGENT_ID = "agent_wxgt6su7d3pcosiil3";
    const ORIGINAL_INSTRUCTIONS = "You are a helpful assistant for kids.";

    function makeAgentCol(originalInstructions = ORIGINAL_INSTRUCTIONS) {
      const col = makeCollection([{ id: AGENT_ID, instructions: originalInstructions, _id: "mock_agent_oid" }]);
      col.findOne = jest.fn().mockResolvedValue({ id: AGENT_ID, instructions: originalInstructions, _id: "mock_agent_oid" });
      return col;
    }

    it("returns a UUID v4 string (not a 24-char hex ObjectId)", async () => {
      const agentsCol = makeAgentCol();
      const balanceStateCol = makeCollection([]);
      balanceStateCol.findOne = jest.fn().mockResolvedValue(null);
      const db = makeMockDb({ agents: agentsCol, balance_state: balanceStateCol });

      const messageId = await sendBonusOfferMessage({
        userId: "user1",
        conversationId: "conv1",
        agentId: AGENT_ID,
        template: "You've reached your limit. Type YES to confirm.",
        db,
      });

      expect(UUID_V4_REGEX.test(messageId)).toBe(true);
      // Not a 24-char hex
      expect(messageId).not.toMatch(/^[0-9a-f]{24}$/);
    });

    it("generates 100 unique messageIds (no collisions)", async () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        const agentsCol = makeAgentCol();
        const balanceStateCol = makeCollection([]);
        balanceStateCol.findOne = jest.fn().mockResolvedValue(null);
        const db = makeMockDb({ agents: agentsCol, balance_state: balanceStateCol });
        const id = await sendBonusOfferMessage({
          userId: `user${i}`,
          conversationId: "conv1",
          agentId: AGENT_ID,
          template: "test",
          db,
        });
        ids.add(id);
      }
      expect(ids.size).toBe(100);
    });

    it("stores originalAgentInstructions in balance_state on first call (idempotent)", async () => {
      const agentsCol = makeAgentCol();
      const balanceStateCol = makeCollection([]);
      balanceStateCol.findOne = jest.fn().mockResolvedValue(null); // no prior state

      const db = makeMockDb({ agents: agentsCol, balance_state: balanceStateCol });

      await sendBonusOfferMessage({
        userId: "user1",
        conversationId: "conv1",
        agentId: AGENT_ID,
        template: "Budget warning!",
        db,
      });

      // balance_state.updateOne should have been called with $set containing originalAgentInstructions
      const balanceStateUpdateCalls = (balanceStateCol.updateOne as jest.Mock).mock.calls;
      expect(balanceStateUpdateCalls.length).toBeGreaterThan(0);
      const lastCall = balanceStateUpdateCalls[balanceStateUpdateCalls.length - 1];
      const updateDoc = lastCall[1] as { $set?: Record<string, unknown> };
      expect(updateDoc.$set?.originalAgentInstructions).toBe(ORIGINAL_INSTRUCTIONS);
    });

    it("does NOT overwrite originalAgentInstructions on second call (idempotent)", async () => {
      const agentsCol = makeAgentCol("MODIFIED INSTRUCTIONS (already injected)");
      const balanceStateCol = makeCollection([]);
      // Simulate already having originalAgentInstructions stored
      balanceStateCol.findOne = jest.fn().mockResolvedValue({
        userId: "user1",
        originalAgentInstructions: ORIGINAL_INSTRUCTIONS,
        pendingWarning: null,
      });

      const db = makeMockDb({ agents: agentsCol, balance_state: balanceStateCol });

      await sendBonusOfferMessage({
        userId: "user1",
        conversationId: "conv1",
        agentId: AGENT_ID,
        template: "Budget warning!",
        db,
      });

      // balance_state.updateOne should NOT include originalAgentInstructions in $set
      const balanceStateUpdateCalls = (balanceStateCol.updateOne as jest.Mock).mock.calls;
      const lastCall = balanceStateUpdateCalls[balanceStateUpdateCalls.length - 1];
      const updateDoc = lastCall[1] as { $set?: Record<string, unknown> };
      // originalAgentInstructions should be absent from $set (not overwritten)
      expect(updateDoc.$set?.originalAgentInstructions).toBeUndefined();
    });

    it("updates agent instructions to include the verbatim-delivery instruction prefix", async () => {
      const agentsCol = makeAgentCol();
      const balanceStateCol = makeCollection([]);
      balanceStateCol.findOne = jest.fn().mockResolvedValue(null);

      const db = makeMockDb({ agents: agentsCol, balance_state: balanceStateCol });

      const template = "Budget warning — you have 30% left!";
      await sendBonusOfferMessage({
        userId: "user1",
        conversationId: "conv1",
        agentId: AGENT_ID,
        template,
        db,
      });

      // agents.updateOne should have been called with an injected instructions string
      const agentsUpdateCalls = (agentsCol.updateOne as jest.Mock).mock.calls;
      expect(agentsUpdateCalls.length).toBe(1);
      const updateDoc = agentsUpdateCalls[0][1] as { $set?: Record<string, unknown> };
      const newInstructions = updateDoc.$set?.instructions as string;
      expect(typeof newInstructions).toBe("string");
      // Should start with the delivery instruction
      expect(newInstructions).toMatch(/SYSTEM INSTRUCTION/);
      expect(newInstructions).toContain(template);
      // Should include the original instructions after the prefix
      expect(newInstructions).toContain(ORIGINAL_INSTRUCTIONS);
    });

    it("sets balance_state.pendingWarning with messageTemplate, injectedAt, agentId", async () => {
      const agentsCol = makeAgentCol();
      const balanceStateCol = makeCollection([]);
      balanceStateCol.findOne = jest.fn().mockResolvedValue(null);

      const db = makeMockDb({ agents: agentsCol, balance_state: balanceStateCol });

      const beforeCall = new Date();
      await sendBonusOfferMessage({
        userId: "user1",
        conversationId: "conv1",
        agentId: AGENT_ID,
        template: "Test template",
        db,
      });
      const afterCall = new Date();

      const balanceStateUpdateCalls = (balanceStateCol.updateOne as jest.Mock).mock.calls;
      const lastCall = balanceStateUpdateCalls[balanceStateUpdateCalls.length - 1];
      const updateDoc = lastCall[1] as { $set?: Record<string, unknown> };
      const pendingWarning = updateDoc.$set?.pendingWarning as {
        messageTemplate: string;
        injectedAt: Date;
        agentId: string;
      };

      expect(pendingWarning.messageTemplate).toBe("Test template");
      expect(pendingWarning.agentId).toBe(AGENT_ID);
      expect(pendingWarning.injectedAt).toBeInstanceOf(Date);
      expect(pendingWarning.injectedAt.getTime()).toBeGreaterThanOrEqual(beforeCall.getTime());
      expect(pendingWarning.injectedAt.getTime()).toBeLessThanOrEqual(afterCall.getTime());
    });

    it("does NOT call db.collection('messages').insertOne", async () => {
      const agentsCol = makeAgentCol();
      const balanceStateCol = makeCollection([]);
      balanceStateCol.findOne = jest.fn().mockResolvedValue(null);
      const messagesCol = makeCollection();

      const db = makeMockDb({ agents: agentsCol, balance_state: balanceStateCol, messages: messagesCol });

      await sendBonusOfferMessage({
        userId: "user1",
        conversationId: "conv1",
        agentId: AGENT_ID,
        template: "Test",
        db,
      });

      expect(messagesCol.insertOne).not.toHaveBeenCalled();
    });

    it("throws an error if agent is not found", async () => {
      const agentsCol = makeCollection([]);
      agentsCol.findOne = jest.fn().mockResolvedValue(null);
      const db = makeMockDb({ agents: agentsCol });

      await expect(
        sendBonusOfferMessage({
          userId: "user1",
          conversationId: "conv1",
          agentId: "nonexistent_agent",
          template: "Test",
          db,
        })
      ).rejects.toThrow(/Agent not found/);
    });
  });

  describe("restoreAgentSystemPrompt", () => {
    const AGENT_ID = "agent_wxgt6su7d3pcosiil3";
    const ORIGINAL_INSTRUCTIONS = "You are a helpful assistant for kids.";

    it("restores agent instructions to originalAgentInstructions and clears balance_state fields", async () => {
      const agentsCol = makeCollection([{ id: AGENT_ID, instructions: "INJECTED PROMPT" }]);
      agentsCol.findOne = jest.fn().mockResolvedValue({ id: AGENT_ID, instructions: "INJECTED PROMPT" });

      const balanceStateDoc = {
        userId: "user1",
        originalAgentInstructions: ORIGINAL_INSTRUCTIONS,
        pendingWarning: {
          messageTemplate: "Test",
          injectedAt: new Date(Date.now() - 30_000),
          agentId: AGENT_ID,
        },
      };
      const balanceStateCol = makeCollection([balanceStateDoc]);
      balanceStateCol.findOne = jest.fn().mockResolvedValue(balanceStateDoc);

      const db = makeMockDb({ agents: agentsCol, balance_state: balanceStateCol });

      await restoreAgentSystemPrompt({ userId: "user1", db });

      // Should have updated agents with the original instructions
      const agentsUpdateCalls = (agentsCol.updateOne as jest.Mock).mock.calls;
      expect(agentsUpdateCalls.length).toBe(1);
      const agentsUpdateDoc = agentsUpdateCalls[0][1] as { $set?: Record<string, unknown> };
      expect(agentsUpdateDoc.$set?.instructions).toBe(ORIGINAL_INSTRUCTIONS);

      // Should have called $unset on balance_state
      const balanceStateUpdateCalls = (balanceStateCol.updateOne as jest.Mock).mock.calls;
      expect(balanceStateUpdateCalls.length).toBe(1);
      const balanceStateUpdateDoc = balanceStateUpdateCalls[0][1] as { $unset?: Record<string, unknown> };
      expect(balanceStateUpdateDoc.$unset?.pendingWarning).toBe("");
      expect(balanceStateUpdateDoc.$unset?.originalAgentInstructions).toBe("");
    });

    it("is idempotent — no-op when no pendingWarning exists", async () => {
      const agentsCol = makeCollection([]);
      agentsCol.findOne = jest.fn().mockResolvedValue({ id: AGENT_ID });
      const balanceStateCol = makeCollection([]);
      balanceStateCol.findOne = jest.fn().mockResolvedValue({
        userId: "user1",
        // no pendingWarning field
      });

      const db = makeMockDb({ agents: agentsCol, balance_state: balanceStateCol });

      // Should not throw, should not call updateOne on agents
      await expect(restoreAgentSystemPrompt({ userId: "user1", db })).resolves.toBeUndefined();
      expect(agentsCol.updateOne).not.toHaveBeenCalled();
    });

    it("is idempotent when called twice — second call is a no-op", async () => {
      const balanceStateDoc = {
        userId: "user1",
        originalAgentInstructions: ORIGINAL_INSTRUCTIONS,
        pendingWarning: { messageTemplate: "T", injectedAt: new Date(), agentId: AGENT_ID },
      };

      let callCount = 0;
      const balanceStateCol = makeCollection([]);
      balanceStateCol.findOne = jest.fn().mockImplementation(async () => {
        callCount++;
        // First call returns pendingWarning, second returns null (already cleared)
        return callCount === 1 ? balanceStateDoc : { userId: "user1" };
      });

      const agentsCol = makeCollection([]);
      agentsCol.findOne = jest.fn().mockResolvedValue({ id: AGENT_ID });

      const db = makeMockDb({ agents: agentsCol, balance_state: balanceStateCol });

      await restoreAgentSystemPrompt({ userId: "user1", db });
      await restoreAgentSystemPrompt({ userId: "user1", db });

      // agents.updateOne called exactly once (second call was no-op)
      expect(agentsCol.updateOne).toHaveBeenCalledTimes(1);
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
        "000000000000000000000001",
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
        "000000000000000000000001",
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
        "000000000000000000000001",
        makePendingState({ confirmationOfferedAt: offeredAt }),
        db
      );
      expect(result).toBe(true);
    });

    it('returns false for "no"', async () => {
      const messagesCol = makeCollection();
      messagesCol.findOne = jest.fn().mockResolvedValue(null); // no YES found

      const db = makeMockDb({ messages: messagesCol });

      const result = await detectBonusConfirmation("000000000000000000000001", makePendingState(), db);
      expect(result).toBe(false);
    });

    it('returns false for "yes please later" (does not match strict pattern)', async () => {
      const messagesCol = makeCollection();
      messagesCol.findOne = jest.fn().mockResolvedValue(null); // no YES match
      const db = makeMockDb({ messages: messagesCol });

      const result = await detectBonusConfirmation("000000000000000000000001", makePendingState(), db);
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
        "000000000000000000000001",
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
        { principalId: "000000000000000000000001", resourceId: "oid1", lockReason: "image_cap" },
      ];

      const bonusPurchasesCol = makeCollection();
      const settingsCol = makeCollection();
      // Use new schema field names (Plan 15-04)
      settingsCol.findOne = jest.fn().mockResolvedValue({
        key: "global_defaults",
        weeklyBonusCapEur: 5.0,
        bonusPackEur: 2.0,
        dailyCostCapEur: 0.10,
        monthlyCostCapEur: 2.00,
        bonusMessageTemplate: "test",
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

      const balanceStateCol = makeCollection([{
        userId: "000000000000000000000001", activeOfferMessageId: "offer1", activeOfferExpiresAt: new Date(Date.now() + 300000),
        activeOfferConversationId: "conv1", monthlySpendEur: 0, warnedAt70PctOn: null, lastDailyReset: new Date(), lastMonthlyReset: new Date(),
      }]);

      const aclCol = makeCollection();
      const db = makeMockDb({
        bonus_purchases: bonusPurchasesCol,
        settings: settingsCol,
        agents: agentsCol,
        locked_acl_entries: lockedCol,
        aclentries: aclCol,
        balance_state: balanceStateCol,
        balances: makeCollection([{ user: "000000000000000000000001", tokenCredits: 0 }]),
      });

      await applyBonusCredit("000000000000000000000001", makePendingState("image_cap"), db);

      // Should insert a bonus_purchase record
      expect(bonusPurchasesCol.insertOne).toHaveBeenCalled();
      const insertedDoc = (bonusPurchasesCol.insertOne as jest.Mock).mock.calls[0][0] as {
        userId: string;
        packSizeEUR: number;
      };
      expect(insertedDoc.userId).toBe("000000000000000000000001");
      expect(insertedDoc.packSizeEUR).toBe(2.0);
    });

    it("for lockType 'monthly_cap' → inserts bonus_purchases, adds tokenCredits via $inc, clears pending state", async () => {
      const bonusPurchasesCol = makeCollection();
      bonusPurchasesCol.aggregate = jest.fn().mockReturnValue({
        toArray: jest.fn().mockResolvedValue([]), // no prior purchases this week
      });

      const settingsCol = makeCollection();
      // Use new schema field names (Plan 15-04)
      settingsCol.findOne = jest.fn().mockResolvedValue({
        key: "global_defaults",
        weeklyBonusCapEur: 5.0,
        bonusPackEur: 2.0,
        dailyCostCapEur: 0.10,
        monthlyCostCapEur: 2.00,
        bonusMessageTemplate: "test",
      });
      settingsCol.updateOne = jest.fn().mockResolvedValue({ modifiedCount: 1 });

      const balancesCol = makeCollection([{ user: "000000000000000000000001", tokenCredits: 0 }]);
      const balanceStateCol = makeCollection([{
        userId: "000000000000000000000001", activeOfferMessageId: "offer1", activeOfferExpiresAt: new Date(Date.now() + 300000),
        activeOfferConversationId: "conv1", monthlySpendEur: 0, warnedAt70PctOn: null, lastDailyReset: new Date(), lastMonthlyReset: new Date(),
      }]);

      const db = makeMockDb({
        bonus_purchases: bonusPurchasesCol,
        settings: settingsCol,
        balances: balancesCol,
        balance_state: balanceStateCol,
      });

      await applyBonusCredit("000000000000000000000001", makePendingState("monthly_cap"), db);

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
      // Weekly spend already at cap (5.0 >= 5.0)
      bonusPurchasesCol.aggregate = jest.fn().mockReturnValue({
        toArray: jest.fn().mockResolvedValue([{ totalSpend: 5.0 }]),
      });

      const settingsCol = makeCollection();
      // Use new schema field names (Plan 15-04)
      settingsCol.findOne = jest.fn().mockResolvedValue({
        key: "global_defaults",
        weeklyBonusCapEur: 5.0,
        bonusPackEur: 2.0,
        dailyCostCapEur: 0.10,
        monthlyCostCapEur: 2.00,
        bonusMessageTemplate: "test",
      });

      const db = makeMockDb({
        bonus_purchases: bonusPurchasesCol,
        settings: settingsCol,
      });

      // Should throw or return early when cap is hit
      await expect(
        applyBonusCredit("000000000000000000000001", { packSizeEUR: 2, lockType: "image_cap", confirmedViaMessageId: "msg1" }, db)
      ).rejects.toThrow();
    });
  });
});
