"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign } from "lucide-react";

interface CostSummaryCardProps {
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

function formatUSD(amount: number): string {
  if (amount === 0) return "$0.00";
  if (amount >= 1) return `$${amount.toFixed(2)}`;
  return `$${amount.toFixed(4)}`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function CostSummaryCard({ daily, monthly }: CostSummaryCardProps) {
  const totalMessages = monthly.haikuMessages + monthly.sonnetMessages;

  const chartData = daily.map((d) => ({
    date: formatDate(d.date),
    messages: d.messages,
  }));

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-muted-foreground" />
          Estimated API Cost (30 Days)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Cost breakdown table */}
        <div className="space-y-2">
          <div className="grid grid-cols-3 text-xs font-medium text-muted-foreground border-b pb-1">
            <span>Model</span>
            <span className="text-right">Messages</span>
            <span className="text-right">Est. Cost</span>
          </div>
          <div className="grid grid-cols-3 text-sm py-1">
            <span>Haiku (Children&apos;s Chat)</span>
            <span className="text-right">{monthly.haikuMessages.toLocaleString()}</span>
            <span className="text-right">{formatUSD(monthly.haikuCost)}</span>
          </div>
          <div className="grid grid-cols-3 text-sm py-1">
            <span>Sonnet (Admin Tools)</span>
            <span className="text-right">{monthly.sonnetMessages.toLocaleString()}</span>
            <span className="text-right">{formatUSD(monthly.sonnetCost)}</span>
          </div>
          <div className="grid grid-cols-3 text-sm font-bold border-t pt-2">
            <span>Total Estimated</span>
            <span className="text-right">{totalMessages.toLocaleString()}</span>
            <span className="text-right">{formatUSD(monthly.totalCost)}</span>
          </div>
        </div>

        {/* Disclaimer */}
        <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800 space-y-1">
          <p>
            These costs are estimates based on average message length. For exact billing, check your{" "}
            <a
              href="https://console.anthropic.com/settings/billing"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-medium hover:text-amber-900"
            >
              Anthropic billing console
            </a>
            .
          </p>
          <p className="text-muted-foreground text-xs">
            Estimates assume ~100 input tokens and ~150 output tokens per message, plus ~400 system
            prompt tokens.
          </p>
        </div>

        {/* Daily message trend chart */}
        <div>
          <p className="text-sm font-medium mb-3">Daily Message Volume</p>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="messageGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11 }}
                interval={Math.floor(chartData.length / 7)}
              />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip
                formatter={(value) => [value, "Messages"]}
                labelFormatter={(label) => `Date: ${label}`}
              />
              <Area
                type="monotone"
                dataKey="messages"
                stroke="#3b82f6"
                strokeWidth={2}
                fill="url(#messageGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
