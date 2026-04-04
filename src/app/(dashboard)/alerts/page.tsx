import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AlertsTable } from "@/components/dashboard/alerts-table";
import { Badge } from "@/components/ui/badge";
import type { SafetyEvent } from "@/lib/safety-patterns";

async function getAlertsDirectly(): Promise<SafetyEvent[]> {
  const getMongoClient = (await import("@/lib/mongodb")).default;
  const { detectSafetyEvent } = await import("@/lib/safety-patterns");
  const { ObjectId } = await import("mongodb");

  const client = await getMongoClient();
  const db = client.db("test");

  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  const rawMessages = await db
    .collection("messages")
    .find({ createdAt: { $gte: cutoff } })
    .sort({ createdAt: -1 })
    .limit(5000)
    .toArray();

  const matchedMessages = rawMessages
    .map((msg) => {
      const text: string = msg.text ?? "";
      const isUser: boolean = Boolean(msg.isCreatedByUser);
      const result = detectSafetyEvent(text, isUser);
      if (!result.detected) return null;
      return {
        conversationId: msg.conversationId as string,
        messageText: text.slice(0, 150),
        type: result.type!,
        matchedPattern: result.matchedPattern!,
        detectedAt:
          msg.createdAt instanceof Date
            ? msg.createdAt.toISOString()
            : String(msg.createdAt ?? ""),
      };
    })
    .filter(
      (
        m
      ): m is {
        conversationId: string;
        messageText: string;
        type: SafetyEvent["type"];
        matchedPattern: string;
        detectedAt: string;
      } => m !== null
    );

  if (matchedMessages.length === 0) return [];

  const conversationIds = [...new Set(matchedMessages.map((m) => m.conversationId))];
  const conversations = await db
    .collection("conversations")
    .find({ conversationId: { $in: conversationIds } })
    .toArray();

  const convMap = new Map<string, { title: string; user: string }>();
  for (const conv of conversations) {
    convMap.set(conv.conversationId as string, {
      title: (conv.title as string) ?? "Untitled Conversation",
      user: (conv.user as string) ?? "",
    });
  }

  const userIds = [...new Set(conversations.map((c) => c.user as string).filter(Boolean))];
  const validObjectIds = userIds
    .filter((id) => {
      try { new ObjectId(id); return true; } catch { return false; }
    })
    .map((id) => new ObjectId(id));

  const users = validObjectIds.length
    ? await db
        .collection("users")
        .find({ _id: { $in: validObjectIds } })
        .project({ _id: 1, name: 1 })
        .toArray()
    : [];

  const userMap = new Map<string, string>();
  for (const user of users) {
    userMap.set(user._id.toString(), (user.name as string) ?? "Unknown");
  }

  const alerts: SafetyEvent[] = matchedMessages.map((m) => {
    const conv = convMap.get(m.conversationId);
    const childName = conv ? (userMap.get(conv.user) ?? "Unknown Child") : "Unknown Child";
    return {
      type: m.type,
      conversationId: m.conversationId,
      conversationTitle: conv?.title ?? "Untitled Conversation",
      childName,
      messageText: m.messageText,
      detectedAt: m.detectedAt,
      matchedPattern: m.matchedPattern,
    };
  });

  alerts.sort(
    (a, b) => new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime()
  );

  return alerts;
}

export default async function AlertsPage() {
  const session = await auth();
  if (!session) {
    redirect("/login");
  }

  // Use direct MongoDB query in server component — avoids HTTP auth complexity
  const alerts = await getAlertsDirectly();

  const redirectCount = alerts.filter((a) => a.type === "safety_redirect").length;
  const jailbreakCount = alerts.filter((a) => a.type === "jailbreak_attempt").length;

  return (
    <div className="p-6 space-y-6">
      {/* Page heading */}
      <div>
        <h1 className="text-2xl font-semibold">Safety Alerts</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Detected safety events from the last 90 days
        </p>
      </div>

      {/* Summary badges */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Total events:</span>
          <Badge variant="secondary" className="font-semibold">
            {alerts.length}
          </Badge>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Safety redirects:</span>
          <Badge
            variant="secondary"
            className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100 border-yellow-200 font-semibold"
          >
            {redirectCount}
          </Badge>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Jailbreak attempts:</span>
          <Badge variant="destructive" className="font-semibold">
            {jailbreakCount}
          </Badge>
        </div>
      </div>

      <AlertsTable initialAlerts={alerts} />
    </div>
  );
}
