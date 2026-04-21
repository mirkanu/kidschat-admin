/**
 * Seed Penelope with synthetic image-search messages for Plan 21-06 verification.
 *
 * Strategy: write messages + conversation rows directly into MongoDB (mirrors
 * the scripts/mongo-inspect.ts synthetic-message probe pattern used in Phase 15).
 * This bypasses LibreChat auth (we don't have Penelope's password in env).
 *
 * Creates 3 synthetic "image-search" messages authored by Penelope,
 * timestamped within the last 24h. The daily-summary aggregation + audit
 * will then pick her up on the next manual trigger.
 */
import { MongoClient, ObjectId } from "mongodb";
import { randomUUID } from "crypto";

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI not set");
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db("test");

  const user = await db
    .collection("users")
    .findOne<{ _id: ObjectId; name: string }>({ name: "Penelope" });
  if (!user) throw new Error("Penelope user not found");
  console.log("Penelope userId:", user._id.toString());

  const convId = randomUUID();
  const now = new Date();

  await db.collection("conversations").insertOne({
    conversationId: convId,
    user: user._id.toString(),
    spec: "image-search",
    endpoint: "agents",
    title: "Plan 21-06 seed",
    createdAt: now,
    updatedAt: now,
  });

  const queries = [
    "cute red origami cats",
    "fluffy puppies playing",
    "watercolor paintings of mountains",
  ];
  for (let i = 0; i < queries.length; i++) {
    const msgTime = new Date(now.getTime() - (queries.length - i) * 60_000);
    await db.collection("messages").insertOne({
      messageId: randomUUID(),
      conversationId: convId,
      user: user._id.toString(),
      isCreatedByUser: true,
      text: queries[i],
      sender: "User",
      createdAt: msgTime,
      updatedAt: msgTime,
    });
  }
  console.log(`Seeded ${queries.length} image-search messages for Penelope in conv ${convId}`);
  await client.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
