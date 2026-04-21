/**
 * Plan 21-06 post-deploy audit check.
 */
import { MongoClient } from "mongodb";

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI not set");
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db("test");

  console.log("=== Latest daily_summary audit doc ===");
  const doc = await db
    .collection("email_notifications")
    .find({ type: "daily_summary" })
    .sort({ sentAt: -1 })
    .limit(1)
    .project({ "meta.childStats": 1, sentAt: 1, date: 1 })
    .toArray();

  const audit = doc[0];
  console.log("sentAt:", audit.sentAt, "date:", audit.date);
  const children = (audit.meta as { childStats: Array<Record<string, unknown>> })
    ?.childStats ?? [];
  for (const c of children) {
    console.log(
      `  ${c.name}: imageSearchCount=${c.imageSearchCount} imageSearchSummary=${JSON.stringify(
        c.imageSearchSummary,
      )} HAS_RAW_QUERIES=${"imageSearchQueries" in c}`,
    );
  }

  console.log("\n=== 24h image-search messages by user ===");
  const oneDayAgo = new Date();
  oneDayAgo.setDate(oneDayAgo.getDate() - 1);
  const byUser = await db
    .collection("messages")
    .aggregate([
      { $match: { createdAt: { $gte: oneDayAgo }, isCreatedByUser: true } },
      {
        $lookup: {
          from: "conversations",
          localField: "conversationId",
          foreignField: "conversationId",
          as: "conv",
        },
      },
      { $unwind: "$conv" },
      { $match: { "conv.spec": "image-search" } },
      {
        $lookup: {
          from: "users",
          let: { userId: "$conv.user" },
          pipeline: [
            { $match: { $expr: { $eq: [{ $toString: "$_id" }, "$$userId"] } } },
          ],
          as: "userInfo",
        },
      },
      { $unwind: { path: "$userInfo", preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: { name: "$userInfo.name", role: "$userInfo.role" },
          count: { $sum: 1 },
          sample: { $push: "$text" },
        },
      },
    ])
    .toArray();
  for (const u of byUser) {
    console.log(
      `  ${JSON.stringify(u._id)}: count=${u.count} sample=${JSON.stringify((u.sample as string[]).slice(0, 3))}`,
    );
  }

  console.log("\n=== All non-ADMIN users ===");
  const users = await db
    .collection("users")
    .find({ role: { $ne: "ADMIN" } })
    .project({ name: 1, email: 1, role: 1 })
    .toArray();
  for (const u of users) console.log(`  ${u.name} (${u.role}) ${u.email}`);

  await client.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
