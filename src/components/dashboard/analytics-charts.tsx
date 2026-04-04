"use client";

import { useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface MessagesPerDay {
  date: string;
  total: number;
  children: Record<string, number>;
}

interface ActiveHour {
  hour: number;
  total: number;
  children: Record<string, number>;
}

interface PresetUsage {
  preset: string;
  total: number;
  children: Record<string, number>;
}

interface AnalyticsChartsProps {
  messagesPerDay: MessagesPerDay[];
  activeHours: ActiveHour[];
  presetUsage: PresetUsage[];
}

const CHILD_COLORS = ["#3b82f6", "#f97316", "#22c55e", "#a855f7", "#ec4899", "#14b8a6"];

function getChildNames(data: { children: Record<string, number> }[]): string[] {
  const names = new Set<string>();
  for (const row of data) {
    Object.keys(row.children).forEach((n) => names.add(n));
  }
  return Array.from(names).sort();
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatHour(hour: number): string {
  if (hour === 0) return "12am";
  if (hour < 12) return `${hour}am`;
  if (hour === 12) return "12pm";
  return `${hour - 12}pm`;
}

export function AnalyticsCharts({ messagesPerDay, activeHours, presetUsage }: AnalyticsChartsProps) {
  const [msgPerDayMode, setMsgPerDayMode] = useState<"total" | "perChild">("total");

  const msgChildNames = getChildNames(messagesPerDay);
  const hourChildNames = getChildNames(activeHours);
  const presetChildNames = getChildNames(presetUsage);

  // Flatten messagesPerDay for recharts
  const msgPerDayData = messagesPerDay.map((d) => ({
    date: formatDate(d.date),
    total: d.total,
    ...d.children,
  }));

  // Flatten activeHours for recharts
  const activeHoursData = activeHours.map((h) => ({
    hour: formatHour(h.hour),
    total: h.total,
    ...h.children,
  }));

  // Flatten presetUsage for recharts (horizontal bar)
  const presetData = presetUsage.map((p) => ({
    preset: p.preset,
    total: p.total,
    ...p.children,
  }));

  return (
    <div className="space-y-6">
      {/* Messages Per Day Chart */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Messages Per Day (Last 30 Days)</CardTitle>
          <div className="flex gap-2">
            <Button
              variant={msgPerDayMode === "total" ? "default" : "outline"}
              size="sm"
              onClick={() => setMsgPerDayMode("total")}
            >
              Total
            </Button>
            <Button
              variant={msgPerDayMode === "perChild" ? "default" : "outline"}
              size="sm"
              onClick={() => setMsgPerDayMode("perChild")}
            >
              Per Child
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={msgPerDayData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11 }}
                interval={Math.floor(messagesPerDay.length / 7)}
              />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              {msgPerDayMode === "total" ? (
                <Bar dataKey="total" name="Messages" fill="#3b82f6" radius={[2, 2, 0, 0]} />
              ) : (
                <>
                  <Legend />
                  {msgChildNames.map((child, i) => (
                    <Bar
                      key={child}
                      dataKey={child}
                      name={child}
                      stackId="stack"
                      fill={CHILD_COLORS[i % CHILD_COLORS.length]}
                      radius={i === msgChildNames.length - 1 ? [2, 2, 0, 0] : undefined}
                    />
                  ))}
                </>
              )}
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Active Hours Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Active Hours (Messages by Hour of Day)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={activeHoursData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="hour" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Legend />
              {hourChildNames.length > 0 ? (
                hourChildNames.map((child, i) => (
                  <Bar
                    key={child}
                    dataKey={child}
                    name={child}
                    stackId="stack"
                    fill={CHILD_COLORS[i % CHILD_COLORS.length]}
                    radius={i === hourChildNames.length - 1 ? [2, 2, 0, 0] : undefined}
                  />
                ))
              ) : (
                <Bar dataKey="total" name="Messages" fill="#3b82f6" radius={[2, 2, 0, 0]} />
              )}
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Preset Usage Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tone Preset Usage</CardTitle>
        </CardHeader>
        <CardContent>
          {presetData.length === 0 ? (
            <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">
              No preset usage data yet
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(200, presetData.length * 48)}>
              <BarChart
                layout="vertical"
                data={presetData}
                margin={{ top: 4, right: 16, left: 80, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                <YAxis
                  dataKey="preset"
                  type="category"
                  tick={{ fontSize: 11 }}
                  width={80}
                />
                <Tooltip />
                <Legend />
                {presetChildNames.length > 0 ? (
                  presetChildNames.map((child, i) => (
                    <Bar
                      key={child}
                      dataKey={child}
                      name={child}
                      stackId="stack"
                      fill={CHILD_COLORS[i % CHILD_COLORS.length]}
                      radius={i === presetChildNames.length - 1 ? [0, 2, 2, 0] : undefined}
                    />
                  ))
                ) : (
                  <Bar dataKey="total" name="Conversations" fill="#3b82f6" radius={[0, 2, 2, 0]} />
                )}
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
