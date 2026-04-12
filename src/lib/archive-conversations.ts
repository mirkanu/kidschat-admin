/**
 * archive-conversations.ts
 *
 * Phase 17-01: Conversation delete protection via periodic snapshots.
 *
 * Reads ALL documents from `conversations` and `messages` collections and
 * upserts them into `archived_conversations` and `archived_messages`.
 *
 * The archive collections are append-only: documents are never deleted from
 * them, so conversations hard-deleted by a child in LibreChat are still
 * recoverable by the parent through the admin dashboard.
 *
 * Data loss window: at most one cron interval (5 minutes). A conversation
 * created and deleted within the same 5-minute window could be lost.
 * Acceptable for a family safety app.
 */

import getMongoClient from "@/lib/mongodb";
import type { Db, BulkWriteOptions } from "mongodb";

export interface ArchiveResult {
  conversationsArchived: number;
  messagesArchived: number;
  timestamp: string;
}

const BULK_OPTIONS: BulkWriteOptions = { ordered: false };

/**
 * Archive all conversations and messages into their respective archive
 * collections. Safe to call repeatedly — upserts are idempotent.
 */
export async function archiveConversations(db?: Db): Promise<ArchiveResult> {
  const client = await getMongoClient();
  const database = db ?? client.db("test");

  const [conversations, messages] = await Promise.all([
    database.collection("conversations").find({}).toArray(),
    database.collection("messages").find({}).toArray(),
  ]);

  let conversationsArchived = 0;
  let messagesArchived = 0;

  // Upsert conversations into archived_conversations
  if (conversations.length > 0) {
    const ops = conversations.map((doc) => ({
      updateOne: {
        filter: { _id: doc._id },
        update: { $set: doc },
        upsert: true,
      },
    }));
    const result = await database
      .collection("archived_conversations")
      .bulkWrite(ops, BULK_OPTIONS);
    conversationsArchived = result.upsertedCount + result.modifiedCount;
  }

  // Upsert messages into archived_messages
  if (messages.length > 0) {
    const ops = messages.map((doc) => ({
      updateOne: {
        filter: { _id: doc._id },
        update: { $set: doc },
        upsert: true,
      },
    }));
    const result = await database
      .collection("archived_messages")
      .bulkWrite(ops, BULK_OPTIONS);
    messagesArchived = result.upsertedCount + result.modifiedCount;
  }

  const timestamp = new Date().toISOString();
  console.log(
    `[archive-conversations] conversationsArchived=${conversationsArchived} messagesArchived=${messagesArchived} timestamp=${timestamp}`
  );

  return { conversationsArchived, messagesArchived, timestamp };
}
