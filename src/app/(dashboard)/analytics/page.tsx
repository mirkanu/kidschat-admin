import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquare, MessagesSquare, User2 } from "lucide-react";
import { AnalyticsCharts } from "@/components/dashboard/analytics-charts";
import { CostSummaryCard } from "@/components/dashboard/cost-summary-card";

interface AnalyticsData {
  messagesPerDay: { date: string; total: number; children: Record<string, number> }[];
  activeHours: { hour: number; total: number; children: Record<string, number> }[];
  presetUsage: { preset: string; total: number; children: Record<string, number> }[];
  summary: {
    totalMessages: number;
    totalConversations: number;
    mostActiveChild: string | null;
  };
}

interface CostData {
  daily: { date: string; messages: number }[];
  monthly: {
    haikuMessages: number;
    sonnetMessages: number;
    haikuCost: number;
    sonnetCost: number;
    totalCost: number;
    periodDays: number;
  };
}

async function getAnalytics(): Promise<AnalyticsData> {
  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const res = await fetch(`${baseUrl}/api/analytics`, {
    cache: "no-store",
    headers: { Cookie: "" },
  });
  if (!res.ok) {
    throw new Error("Failed to fetch analytics");
  }
  return res.json();
}

export default async function AnalyticsPage() {
  const session = await auth();
  if (!session) {
    redirect("/login");
  }

  // Call aggregations directly since we're server-side
  // Using internal fetch with cookie forwarding pattern
  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

  let data: AnalyticsData;
  try {
    const res = await fetch(`${baseUrl}/api/analytics`, {
      cache: "no-store",
    });
    if (!res.ok) {
      throw new Error("Analytics fetch failed");
    }
    data = await res.json();
  } catch {
    // Return empty state on error
    data = {
      messagesPerDay: [],
      activeHours: Array.from({ length: 24 }, (_, h) => ({ hour: h, total: 0, children: {} })),
      presetUsage: [],
      summary: { totalMessages: 0, totalConversations: 0, mostActiveChild: null },
    };
  }

  let costData: CostData | null = null;
  try {
    const costRes = await fetch(`${baseUrl}/api/cost-estimate`, {
      cache: "no-store",
    });
    if (costRes.ok) {
      costData = await costRes.json();
    }
  } catch {
    // Cost section is optional — page renders fine without it
  }

  const summaryCards = [
    {
      title: "Messages (30d)",
      value: data.summary.totalMessages.toLocaleString(),
      icon: MessageSquare,
      desc: "Total messages in last 30 days",
    },
    {
      title: "Conversations (30d)",
      value: data.summary.totalConversations.toLocaleString(),
      icon: MessagesSquare,
      desc: "Chat sessions in last 30 days",
    },
    {
      title: "Most Active",
      value: data.summary.mostActiveChild ?? "—",
      icon: User2,
      desc: "Child with most messages",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Analytics</h2>
        <p className="text-muted-foreground">Usage patterns for KidsChat over the last 30 days.</p>
      </div>

      {/* Summary stats */}
      <div className="grid gap-4 md:grid-cols-3">
        {summaryCards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
              <card.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.value}</div>
              <p className="text-xs text-muted-foreground">{card.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Cost summary */}
      {costData && (
        <CostSummaryCard daily={costData.daily} monthly={costData.monthly} />
      )}

      {/* Charts */}
      <AnalyticsCharts
        messagesPerDay={data.messagesPerDay}
        activeHours={data.activeHours}
        presetUsage={data.presetUsage}
      />
    </div>
  );
}
