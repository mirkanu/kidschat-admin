import { MongoClient } from "mongodb";

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI required");
  const client = await MongoClient.connect(uri);
  const db = client.db("test");

  // Count conversations matching "origami"
  const convMatches = await db
    .collection("conversations")
    .find({ title: { $regex: "origami", $options: "i" } })
    .project({ conversationId: 1, title: 1, spec: 1, user: 1 })
    .limit(10)
    .toArray();
  console.log(`conversations matching 'origami': ${convMatches.length}`);
  for (const c of convMatches) {
    console.log(`  - ${c.conversationId}  title="${c.title}"  spec=${c.spec}`);
  }

  // Find messages from image-search conversations with openverse or /proxy URLs
  const convIds = convMatches.map((c) => c.conversationId);
  const msgs = await db
    .collection("messages")
    .find({ conversationId: { $in: convIds } })
    .limit(20)
    .toArray();
  console.log(`\nmessages in those conversations: ${msgs.length}`);

  let hasOpenverse = 0, hasProxy = 0, userMsgs = 0, aiMsgs = 0;
  for (const m of msgs) {
    const text: string = m.text ?? (Array.isArray(m.content) ? m.content.map((b: any) => b.text).join("") : "");
    if (m.isCreatedByUser) userMsgs++; else aiMsgs++;
    if (/openverse/i.test(text)) hasOpenverse++;
    if (/\/proxy\?u=/i.test(text)) hasProxy++;
  }
  console.log(`  user messages: ${userMsgs}`);
  console.log(`  ai messages: ${aiMsgs}`);
  console.log(`  messages containing 'openverse': ${hasOpenverse}`);
  console.log(`  messages containing '/proxy?u=': ${hasProxy}`);

  // Print one AI message text snippet
  const aiSample = msgs.find((m) => !m.isCreatedByUser);
  if (aiSample) {
    const text: string = aiSample.text ?? (Array.isArray(aiSample.content) ? aiSample.content.map((b: any) => b.text).join("") : "");
    console.log(`\nSample AI message (first 400 chars):`);
    console.log(text.slice(0, 400));
  }

  await client.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
