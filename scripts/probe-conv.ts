import { MongoClient } from "mongodb";

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI required");
  const client = await MongoClient.connect(uri);
  const db = client.db("test");

  // Claude-test userId
  const claudeTestId = "68fef0ce5c9a5c1c9c7f8f95"; // placeholder — resolve below
  const user = await db.collection("users").findOne({ email: "claude-test@kidschat.local" });
  console.log("claude-test user:", user?._id?.toString(), user?.name);

  const userId = user?._id?.toString() ?? claudeTestId;
  const convs = await db
    .collection("conversations")
    .find({ user: userId })
    .sort({ updatedAt: -1 })
    .limit(10)
    .toArray();

  console.log(`\nFound ${convs.length} conversations for claude-test`);
  for (const c of convs) {
    console.log("\n---");
    console.log("title:", c.title);
    console.log("conversationId:", c.conversationId);
    console.log("endpoint:", c.endpoint);
    console.log("iconURL:", c.iconURL);
    console.log("model:", c.model);
    console.log("modelLabel:", c.modelLabel);
    console.log("spec:", c.spec);
    console.log("agent_id:", c.agent_id);
    console.log("agentId:", c.agentId);
    console.log("preset-candidates:", Object.keys(c).filter(k => /preset|spec|icon|agent|model/i.test(k)));
  }
  await client.close();
}
main().catch(e => { console.error(e); process.exit(1); });
