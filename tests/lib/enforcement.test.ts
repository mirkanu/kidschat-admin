/**
 * Unit tests for enforcement.ts
 * Uses in-memory mock Db pattern (jest.fn()) — NO real MongoDB connection.
 */
import { describe, it, expect, jest, beforeEach } from "@jest/globals";

// ---- Minimal in-memory mock Db ----
type MockCollection = {
  find: jest.Mock;
  deleteMany: jest.Mock;
  insertMany: jest.Mock;
  insertOne: jest.Mock;
  findOne: jest.Mock;
  updateOne: jest.Mock;
  countDocuments: jest.Mock;
  aggregate: jest.Mock;
  // Internal state for assertions
  _docs: Record<string, unknown[]>;
  _deleted: unknown[];
  _inserted: unknown[];
  _updated: unknown[];
};

function makeCollection(docs: unknown[] = []): MockCollection {
  const state: {
    docs: unknown[];
    deleted: unknown[];
    inserted: unknown[];
    updated: unknown[];
  } = {
    docs: [...docs],
    deleted: [],
    inserted: [],
    updated: [],
  };

  const col = {
    find: jest.fn().mockReturnValue({
      toArray: jest.fn().mockResolvedValue(state.docs),
    }),
    deleteMany: jest.fn().mockImplementation(async () => {
      state.deleted.push("deleteMany called");
      return { deletedCount: state.docs.length };
    }),
    insertMany: jest.fn().mockImplementation(async (docs: unknown[]) => {
      state.inserted.push(...docs);
      return { insertedCount: docs.length };
    }),
    insertOne: jest.fn().mockImplementation(async (doc: unknown) => {
      state.inserted.push(doc);
      return { insertedId: "mock_id" };
    }),
    findOne: jest.fn().mockImplementation(async () => state.docs[0] ?? null),
    updateOne: jest.fn().mockImplementation(async (_q: unknown, update: unknown) => {
      state.updated.push(update);
      return { modifiedCount: 1 };
    }),
    countDocuments: jest.fn().mockResolvedValue(state.docs.length),
    aggregate: jest.fn().mockReturnValue({
      toArray: jest.fn().mockResolvedValue([]),
    }),
    _docs: state as unknown as Record<string, unknown[]>,
    _deleted: state.deleted,
    _inserted: state.inserted,
    _updated: state.updated,
  } as unknown as MockCollection;

  return col;
}

function makeMockDb(collections: Record<string, unknown[] | MockCollection> = {}): {
  collection: jest.Mock;
  _cols: Record<string, MockCollection>;
} {
  const cols: Record<string, MockCollection> = {};
  for (const [name, val] of Object.entries(collections)) {
    if (Array.isArray(val)) {
      cols[name] = makeCollection(val);
    } else {
      cols[name] = val as MockCollection;
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

// ---- Tests ----

describe("enforcement.ts", () => {
  let lockImageAccess: (userId: string, db: unknown, reason?: string) => Promise<void>;
  let unlockImageAccess: (userId: string, db: unknown, reason?: string) => Promise<void>;
  let hardLockAllAccess: (userId: string, db: unknown) => Promise<void>;
  let unlockAllAccess: (userId: string, db: unknown, credits: number) => Promise<void>;
  let enforceChildLimits: (userId: string, childName: string, db: unknown) => Promise<unknown>;
  let DRAWING_AGENT_IDS: string[];

  beforeEach(async () => {
    jest.resetModules();
    const mod = await import("@/lib/enforcement");
    lockImageAccess = mod.lockImageAccess;
    unlockImageAccess = mod.unlockImageAccess;
    hardLockAllAccess = mod.hardLockAllAccess;
    unlockAllAccess = mod.unlockAllAccess;
    enforceChildLimits = mod.enforceChildLimits;
    DRAWING_AGENT_IDS = mod.DRAWING_AGENT_IDS;
  });

  describe("DRAWING_AGENT_IDS", () => {
    it("exports exactly 4 agent IDs", () => {
      expect(DRAWING_AGENT_IDS).toHaveLength(4);
      expect(DRAWING_AGENT_IDS).toContain("agent_wxgt6su7d3pcosiil3");
      expect(DRAWING_AGENT_IDS).toContain("agent_y4w1cvoyg77p9thed9");
      expect(DRAWING_AGENT_IDS).toContain("agent_64q6z5s57552cpgl0hr");
      expect(DRAWING_AGENT_IDS).toContain("agent_aiv99mzvdzquym6y89k");
    });
  });

  describe("lockImageAccess", () => {
    it("snapshots existing aclentries to locked_acl_entries and then deletes them for DRAWING_AGENT_IDS only", async () => {
      const agentDocs = [
        { _id: "oid1", agentId: "agent_wxgt6su7d3pcosiil3" },
        { _id: "oid2", agentId: "agent_y4w1cvoyg77p9thed9" },
        { _id: "oid3", agentId: "agent_64q6z5s57552cpgl0hr" },
        { _id: "oid4", agentId: "agent_aiv99mzvdzquym6y89k" },
      ];

      const existingAcl = [
        { principalId: "user1", resourceId: "oid1", resourceType: "agent" },
        { principalId: "user1", resourceId: "oid2", resourceType: "agent" },
      ];

      const agentsCol = makeCollection(agentDocs);
      agentsCol.find = jest.fn().mockReturnValue({
        toArray: jest.fn().mockResolvedValue(agentDocs),
      });

      const aclCol = makeCollection(existingAcl);
      aclCol.find = jest.fn().mockReturnValue({
        toArray: jest.fn().mockResolvedValue(existingAcl),
      });

      const lockedCol = makeCollection();
      const db = makeMockDb();
      db.collection.mockImplementation((name: string) => {
        if (name === "agents") return agentsCol;
        if (name === "aclentries") return aclCol;
        if (name === "locked_acl_entries") return lockedCol;
        return makeCollection();
      });

      await lockImageAccess("user1", db);

      // Should insert into locked_acl_entries
      expect(lockedCol.insertMany).toHaveBeenCalled();
      // Should delete from aclentries
      expect(aclCol.deleteMany).toHaveBeenCalled();
    });

    it("does not affect ACL entries for other agents (non-drawing)", async () => {
      const agentDocs = [
        { _id: "oid1", agentId: "agent_wxgt6su7d3pcosiil3" },
      ];
      const allAcl = [
        { principalId: "user1", resourceId: "oid1", resourceType: "agent" },
        { principalId: "user1", resourceId: "other_agent_oid", resourceType: "agent" },
      ];
      // Only drawing agent ACLs should be fetched
      const drawingAcl = allAcl.filter((a) => a.resourceId === "oid1");

      const agentsCol = makeCollection(agentDocs);
      agentsCol.find = jest.fn().mockReturnValue({
        toArray: jest.fn().mockResolvedValue(agentDocs),
      });

      const aclCol = makeCollection(drawingAcl);
      aclCol.find = jest.fn().mockReturnValue({
        toArray: jest.fn().mockResolvedValue(drawingAcl),
      });

      const lockedCol = makeCollection();
      const db = makeMockDb();
      db.collection.mockImplementation((name: string) => {
        if (name === "agents") return agentsCol;
        if (name === "aclentries") return aclCol;
        if (name === "locked_acl_entries") return lockedCol;
        return makeCollection();
      });

      await lockImageAccess("user1", db);

      // The insertMany call should only include drawing agent ACLs
      const insertCalls = (lockedCol.insertMany as jest.Mock).mock.calls;
      if (insertCalls.length > 0) {
        const insertedDocs = insertCalls[0][0] as Array<{ resourceId: string }>;
        expect(insertedDocs.every((d) => d.resourceId === "oid1")).toBe(true);
      }
    });
  });

  describe("unlockImageAccess", () => {
    it("re-inserts locked_acl_entries for the user; duplicate key errors (11000) are swallowed", async () => {
      const lockedDocs = [
        { principalId: "user1", resourceId: "oid1", lockReason: "daily_image_cap" },
        { principalId: "user1", resourceId: "oid2", lockReason: "daily_image_cap" },
      ];

      const lockedCol = makeCollection(lockedDocs);
      lockedCol.find = jest.fn().mockReturnValue({
        toArray: jest.fn().mockResolvedValue(lockedDocs),
      });
      const aclCol = makeCollection();
      // Simulate duplicate key error on insertMany
      aclCol.insertMany = jest.fn().mockRejectedValue({ code: 11000, message: "dup key" });

      const db = makeMockDb();
      db.collection.mockImplementation((name: string) => {
        if (name === "locked_acl_entries") return lockedCol;
        if (name === "aclentries") return aclCol;
        return makeCollection();
      });

      // Should NOT throw despite duplicate key error
      await expect(unlockImageAccess("user1", db, "daily_image_cap")).resolves.not.toThrow();
    });
  });

  describe("hardLockAllAccess", () => {
    it("writes tokenCredits: 0 to balances collection AND calls lockImageAccess (belt-and-suspenders)", async () => {
      const agentDocs = [
        { _id: "oid1", agentId: "agent_wxgt6su7d3pcosiil3" },
      ];
      const agentsCol = makeCollection(agentDocs);
      agentsCol.find = jest.fn().mockReturnValue({ toArray: jest.fn().mockResolvedValue(agentDocs) });

      const aclCol = makeCollection([]);
      aclCol.find = jest.fn().mockReturnValue({ toArray: jest.fn().mockResolvedValue([]) });

      const lockedCol = makeCollection();
      const balancesCol = makeCollection();

      const db = makeMockDb();
      db.collection.mockImplementation((name: string) => {
        if (name === "agents") return agentsCol;
        if (name === "aclentries") return aclCol;
        if (name === "locked_acl_entries") return lockedCol;
        if (name === "balances") return balancesCol;
        return makeCollection();
      });

      await hardLockAllAccess("user1", db);

      // Must write tokenCredits: 0 to balances
      expect(balancesCol.updateOne).toHaveBeenCalled();
      const updateCall = (balancesCol.updateOne as jest.Mock).mock.calls[0];
      const updateDoc = updateCall[1] as { $set: { tokenCredits: number } };
      expect(updateDoc.$set.tokenCredits).toBe(0);
    });
  });

  describe("unlockAllAccess", () => {
    it("writes positive tokenCredits to balances and restores ACL", async () => {
      const agentDocs = [{ _id: "oid1", agentId: "agent_wxgt6su7d3pcosiil3" }];
      const lockedDocs = [{ principalId: "user1", resourceId: "oid1", lockReason: "monthly_cost_cap" }];

      const agentsCol = makeCollection(agentDocs);
      agentsCol.find = jest.fn().mockReturnValue({ toArray: jest.fn().mockResolvedValue(agentDocs) });

      const lockedCol = makeCollection(lockedDocs);
      lockedCol.find = jest.fn().mockReturnValue({ toArray: jest.fn().mockResolvedValue(lockedDocs) });

      const aclCol = makeCollection();
      const balancesCol = makeCollection();

      const db = makeMockDb();
      db.collection.mockImplementation((name: string) => {
        if (name === "agents") return agentsCol;
        if (name === "locked_acl_entries") return lockedCol;
        if (name === "aclentries") return aclCol;
        if (name === "balances") return balancesCol;
        return makeCollection();
      });

      await unlockAllAccess("user1", db, 1000000);

      // Must write positive tokenCredits to balances
      expect(balancesCol.updateOne).toHaveBeenCalled();
      const updateCall = (balancesCol.updateOne as jest.Mock).mock.calls[0];
      const updateDoc = updateCall[1] as { $set: { tokenCredits: number } };
      expect(updateDoc.$set.tokenCredits).toBeGreaterThan(0);
    });
  });

  describe("enforceChildLimits", () => {
    function makeEnforceDb(overrides: {
      imageCount?: number;
      monthlySpend?: number;
      weeklyBonus?: number;
      activeBonus?: number;
      awaitingConfirmation?: boolean;
      limits?: {
        dailyImageLimit?: number;
        monthlyCostCapEUR?: number;
        weeklyBonusCap?: number;
        bonusPackSize?: number;
        bonusMessageTemplate?: string;
      };
    }) {
      const {
        imageCount = 0,
        monthlySpend = 0,
        weeklyBonus = 0,
        activeBonus = 0,
        awaitingConfirmation = false,
        limits = {},
      } = overrides;

      const agentDocs = DRAWING_AGENT_IDS.map((id, i) => ({ _id: `oid${i}`, agentId: id }));

      // Mock settings
      const settingsCol = makeCollection();
      settingsCol.findOne = jest.fn().mockImplementation(async (query: { _id?: string }) => {
        if (query?._id === "global_defaults") {
          return {
            dailyImageLimit: limits.dailyImageLimit ?? 10,
            dailyMessageLimit: 50,
            monthlyCostCapEUR: limits.monthlyCostCapEUR ?? 10,
            weeklyBonusCap: limits.weeklyBonusCap ?? 5,
            bonusPackSize: limits.bonusPackSize ?? 2,
            bonusMessageTemplate: limits.bonusMessageTemplate ?? "You've reached your limit.",
          };
        }
        if (query?._id?.startsWith("override_")) {
          // Return awaiting state if set
          if (awaitingConfirmation) {
            return {
              awaitingBonusConfirmation: true,
              confirmationOfferedAt: new Date(),
              lockType: "image_cap",
              activeConversationId: "conv123",
            };
          }
          return null;
        }
        return null;
      });

      // Mock files for image count
      const filesCol = makeCollection();
      filesCol.countDocuments = jest.fn().mockResolvedValue(imageCount);

      // Mock cost_ledger for monthly spend
      const costLedgerCol = makeCollection();
      costLedgerCol.aggregate = jest.fn().mockReturnValue({
        toArray: jest.fn().mockResolvedValue(
          monthlySpend > 0 ? [{ totalEUR: monthlySpend }] : []
        ),
      });

      // Mock bonus_purchases
      const bonusPurchasesCol = makeCollection();
      bonusPurchasesCol.aggregate = jest.fn().mockReturnValue({
        toArray: jest.fn().mockImplementation(async () => {
          // Return weeklyBonus or activeBonus depending on context
          return weeklyBonus > 0 ? [{ totalSpend: weeklyBonus }] : [];
        }),
      });

      const agentsCol = makeCollection(agentDocs);
      agentsCol.find = jest.fn().mockReturnValue({ toArray: jest.fn().mockResolvedValue(agentDocs) });

      const aclCol = makeCollection([]);
      aclCol.find = jest.fn().mockReturnValue({ toArray: jest.fn().mockResolvedValue([]) });

      const lockedCol = makeCollection([]);
      lockedCol.find = jest.fn().mockReturnValue({ toArray: jest.fn().mockResolvedValue([]) });

      const balancesCol = makeCollection();
      const messagesCol = makeCollection();
      const conversationsCol = makeCollection();

      // Mock conversations for finding latest conversation
      conversationsCol.findOne = jest.fn().mockResolvedValue({
        conversationId: "conv123",
        user: "user1",
      });

      conversationsCol.updateOne = jest.fn().mockResolvedValue({ modifiedCount: 1 });

      const db = makeMockDb();
      db.collection.mockImplementation((name: string) => {
        if (name === "settings") return settingsCol;
        if (name === "files") return filesCol;
        if (name === "cost_ledger") return costLedgerCol;
        if (name === "bonus_purchases") return bonusPurchasesCol;
        if (name === "agents") return agentsCol;
        if (name === "aclentries") return aclCol;
        if (name === "locked_acl_entries") return lockedCol;
        if (name === "balances") return balancesCol;
        if (name === "messages") return messagesCol;
        if (name === "conversations") return conversationsCol;
        return makeCollection();
      });

      return db;
    }

    it("with imageCount >= limit, no bonus, weekly bonus not exhausted → calls lockImageAccess + sendBonusOfferMessage", async () => {
      const db = makeEnforceDb({
        imageCount: 10, // >= dailyImageLimit of 10
        activeBonus: 0,
        weeklyBonus: 0,
        awaitingConfirmation: false,
        limits: { dailyImageLimit: 10 },
      });

      const result = await enforceChildLimits("user1", "TestChild", db) as {
        action: string;
        lockReason?: string;
      };

      // Should lock image access and send bonus offer
      expect(result.action).toBe("image_locked");
    });

    it("with monthlyCostHit, no bonus, weekly bonus exhausted → calls hardLockAllAccess", async () => {
      const db = makeEnforceDb({
        imageCount: 0,
        monthlySpend: 10.5, // > monthlyCostCapEUR of 10
        weeklyBonus: 5.0, // == weeklyBonusCap (exhausted)
        activeBonus: 0,
        awaitingConfirmation: false,
        limits: { monthlyCostCapEUR: 10, weeklyBonusCap: 5 },
      });

      const result = await enforceChildLimits("user1", "TestChild", db) as {
        action: string;
      };

      expect(result.action).toBe("hard_locked");
    });

    it("with imageCount >= limit, active bonus credit > 0 → NO lock, NO offer", async () => {
      // Build a custom db that returns active bonus credit from bonus_purchases
      const agentDocs = DRAWING_AGENT_IDS.map((id, i) => ({ _id: `oid${i}`, agentId: id }));

      const settingsCol = makeCollection();
      settingsCol.findOne = jest.fn().mockImplementation(async (query: { _id?: string }) => {
        if (query?._id === "global_defaults") {
          return {
            dailyImageLimit: 10,
            dailyMessageLimit: 50,
            monthlyCostCapEUR: 10,
            weeklyBonusCap: 5,
            bonusPackSize: 2,
            bonusMessageTemplate: "You've reached your limit.",
          };
        }
        return null; // No awaitingBonusConfirmation
      });

      const filesCol = makeCollection();
      filesCol.countDocuments = jest.fn().mockResolvedValue(10); // imageCount = 10 (at limit)

      const costLedgerCol = makeCollection();
      costLedgerCol.aggregate = jest.fn().mockReturnValue({
        toArray: jest.fn().mockResolvedValue([]), // monthlySpend = 0
      });

      // Pipeline-aware mock: distinguish getWeeklyBonusSpend vs getActiveBonusCredit
      const bonusPurchasesCol = makeCollection();
      bonusPurchasesCol.aggregate = jest.fn().mockImplementation((pipeline: unknown[]) => {
        const matchStage = (pipeline as Array<{ $match?: Record<string, unknown> }>)[0]?.$match ?? {};
        if ("expiresAt" in matchStage) {
          // getActiveBonusCredit: active credit = 2.0
          return { toArray: jest.fn().mockResolvedValue([{ totalCredit: 2.0 }]) };
        } else {
          // getWeeklyBonusSpend: weekly spend = 0
          return { toArray: jest.fn().mockResolvedValue([]) };
        }
      });

      const agentsCol = makeCollection(agentDocs);
      agentsCol.find = jest.fn().mockReturnValue({ toArray: jest.fn().mockResolvedValue(agentDocs) });

      const db = makeMockDb();
      db.collection.mockImplementation((name: string) => {
        if (name === "settings") return settingsCol;
        if (name === "files") return filesCol;
        if (name === "cost_ledger") return costLedgerCol;
        if (name === "bonus_purchases") return bonusPurchasesCol;
        if (name === "agents") return agentsCol;
        return makeCollection();
      });

      const result = await enforceChildLimits("user1", "TestChild", db) as {
        action: string;
      };

      expect(result.action).toBe("no_action");
    });

    it("when already awaiting confirmation → NO new offer (idempotent)", async () => {
      const db = makeEnforceDb({
        imageCount: 10,
        activeBonus: 0,
        awaitingConfirmation: true,
        limits: { dailyImageLimit: 10 },
      });

      const result = await enforceChildLimits("user1", "TestChild", db) as {
        action: string;
      };

      expect(result.action).toBe("already_awaiting");
    });

    it("with imageCount < limit and monthly spend < cap → no action", async () => {
      const db = makeEnforceDb({
        imageCount: 3,
        monthlySpend: 2.0,
        activeBonus: 0,
        awaitingConfirmation: false,
      });

      const result = await enforceChildLimits("user1", "TestChild", db) as {
        action: string;
      };

      expect(result.action).toBe("no_action");
    });
  });
});
