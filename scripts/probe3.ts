import { MongoClient } from "mongodb";
async function main() {
  const client = await MongoClient.connect(process.env.MONGODB_URI!);
  const db = client.db("test");
  const conv = await db.collection("conversations").findOne({ spec: "image-search", title: /origami cats/i }, { sort: { updatedAt: -1 } });
  console.log("conv:", conv?.title, conv?.conversationId);
  const msgs = await db.collection("messages").find({ conversationId: conv!.conversationId }).sort({ createdAt: 1 }).toArray();
  for (const m of msgs) {
    if (!m.isCreatedByUser) {
      console.log("\n--- AI msg ---");
      console.log("text:", JSON.stringify(m.text)?.slice(0, 200));
      console.log("content keys:", m.content ? (Array.isArray(m.content) ? `array[${m.content.length}]` : typeof m.content) : "none");
      if (Array.isArray(m.content)) {
        for (const b of m.content) {
          console.log("  block type:", b.type, "text:", (b.text ?? "").slice(0, 200));
        }
      }
      console.log("all keys:", Object.keys(m));
    }
  }
  await client.close();
}
main().catch(e => { console.error(e); process.exit(1); });
