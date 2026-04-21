import { MongoClient } from "mongodb";
async function main() {
  const client = await MongoClient.connect(process.env.MONGODB_URI!);
  const db = client.db("test");

  // OVERSIGHT-01: conversations + messages for "origami" query persisted
  const origamiConvs = await db.collection("conversations").find({
    title: { $regex: "origami", $options: "i" },
    spec: "image-search"
  }).toArray();
  console.log(`OVERSIGHT-01: image-search conversations matching 'origami': ${origamiConvs.length}`);

  const convIds = origamiConvs.map(c => c.conversationId);
  const userMsgs = await db.collection("messages").countDocuments({
    conversationId: { $in: convIds },
    isCreatedByUser: true,
    text: { $regex: "origami", $options: "i" }
  });
  const aiMsgsWithThumbs = await db.collection("messages").find({
    conversationId: { $in: convIds },
    isCreatedByUser: false
  }).toArray();
  let aiWithUrl = 0;
  for (const m of aiMsgsWithThumbs) {
    const combined = (m.text ?? "") + JSON.stringify(m.content ?? "");
    if (/openverse|\/proxy\?u=/i.test(combined)) aiWithUrl++;
  }
  console.log(`OVERSIGHT-01: user messages containing 'origami': ${userMsgs}`);
  console.log(`OVERSIGHT-01: AI responses containing openverse/proxy URL: ${aiWithUrl} of ${aiMsgsWithThumbs.length}`);

  // Sanity: grand total image-search messages + convs
  const totalConvs = await db.collection("conversations").countDocuments({ spec: "image-search" });
  const totalMsgs = await db.collection("messages").countDocuments({
    conversationId: { $in: (await db.collection("conversations").find({ spec: "image-search" }).project({ conversationId: 1 }).toArray()).map(c => c.conversationId) }
  });
  console.log(`\nGRAND TOTAL: ${totalConvs} image-search conversations, ${totalMsgs} messages across them`);

  await client.close();
}
main().catch(e => { console.error(e); process.exit(1); });
