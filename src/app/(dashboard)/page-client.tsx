"use client";
import { use } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, MessageSquare, Database } from "lucide-react";

interface Stats { userCount: number; conversationCount: number; messageCount30d: number; }

export function DashboardStats({ statsPromise }: { statsPromise: Promise<Stats> }) {
  const stats = use(statsPromise);
  const cards = [
    { title: "Total Users", value: stats.userCount, icon: Users, desc: "Across all accounts" },
    { title: "Conversations", value: stats.conversationCount, icon: MessageSquare, desc: "Total chat sessions" },
    { title: "Messages (30d)", value: stats.messageCount30d.toLocaleString(), icon: MessageSquare, desc: "Messages in last 30 days" },
    { title: "Database", value: "test", icon: Database, desc: "MongoDB (LibreChat shared)" },
  ];
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
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
  );
}
