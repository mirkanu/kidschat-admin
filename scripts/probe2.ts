import { MongoClient } from "mongodb";
async function main() {
  const client = await MongoClient.connect(process.env.MONGODB_URI!);
  const db = client.db("test");
  const convs = await db.collection("conversations").find({ spec: "image-search" }).sort({ updatedAt: -1 }).limit(3).toArray();
  for (const c of convs) {
    console.log(`\n=== ${c.title} (${c.conversationId}) ===`);
    const msgs = await db.collection("messages").find({ conversationId: c.conversationId }).sort({ createdAt: 1 }).toArray();
    for (const m of msgs) {
      const text: string = m.text ?? (Array.isArray(m.content) ? m.content.map((b: any) => b.text).join("") : "");
      console.log(`  [${m.isCreatedByUser ? "USER" : "AI"}] len=${text.length}  ${text.slice(0,150).replace(/\n/g," ")}`);
    }
  }
  await client.close();
}
main().catch(e => { console.error(e); process.exit(1); });
