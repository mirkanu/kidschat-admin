import { NextResponse } from "next/server";
import { auth } from "@/auth";
import getMongoClient from "@/lib/mongodb";

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const client = await getMongoClient();
  const db = client.db("test");

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // ----- a) Messages per day (last 30 days) -----
  const messagesPerDayRaw = await db
    .collection("messages")
    .aggregate([
      {
        $match: {
          createdAt: { $gte: thirtyDaysAgo },
        },
      },
      {
        $lookup: {
          from: "conversations",
          localField: "conversationId",
          foreignField: "conversationId",
          as: "conv",
        },
      },
      {
        $unwind: {
          path: "$conv",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: "users",
          let: { userId: "$conv.user" },
          pipeline: [
            {
              $match: {
                $expr: { $eq: [{ $toString: "$_id" }, "$$userId"] },
              },
            },
          ],
          as: "userInfo",
        },
      },
      {
        $unwind: {
          path: "$userInfo",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $match: {
          "userInfo.role": { $ne: "ADMIN" },
        },
      },
      {
        $group: {
          _id: {
            date: {
              $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
            },
            child: "$userInfo.name",
          },
          count: { $sum: 1 },
        },
      },
      {
        $sort: { "_id.date": 1 },
      },
    ])
    .toArray();

  // Build the date map for last 30 days
  const dateMap: Record<string, { total: number; children: Record<string, number> }> = {};
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split("T")[0];
    dateMap[key] = { total: 0, children: {} };
  }

  for (const row of messagesPerDayRaw) {
    const date = row._id.date as string;
    const child = (row._id.child as string) || "Unknown";
    const count = row.count as number;
    if (dateMap[date]) {
      dateMap[date].total += count;
      dateMap[date].children[child] = (dateMap[date].children[child] || 0) + count;
    }
  }

  const messagesPerDay = Object.entries(dateMap).map(([date, data]) => ({
    date,
    total: data.total,
    children: data.children,
  }));

  // ----- b) Active hours -----
  const activeHoursRaw = await db
    .collection("messages")
    .aggregate([
      {
        $match: {
          createdAt: { $gte: thirtyDaysAgo },
        },
      },
      {
        $lookup: {
          from: "conversations",
          localField: "conversationId",
          foreignField: "conversationId",
          as: "conv",
        },
      },
      {
        $unwind: {
          path: "$conv",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: "users",
          let: { userId: "$conv.user" },
          pipeline: [
            {
              $match: {
                $expr: { $eq: [{ $toString: "$_id" }, "$$userId"] },
              },
            },
          ],
          as: "userInfo",
        },
      },
      {
        $unwind: {
          path: "$userInfo",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $match: {
          "userInfo.role": { $ne: "ADMIN" },
        },
      },
      {
        $group: {
          _id: {
            hour: { $hour: "$createdAt" },
            child: "$userInfo.name",
          },
          count: { $sum: 1 },
        },
      },
      {
        $sort: { "_id.hour": 1 },
      },
    ])
    .toArray();

  const hourMap: Record<number, { total: number; children: Record<string, number> }> = {};
  for (let h = 0; h < 24; h++) {
    hourMap[h] = { total: 0, children: {} };
  }

  for (const row of activeHoursRaw) {
    const hour = row._id.hour as number;
    const child = (row._id.child as string) || "Unknown";
    const count = row.count as number;
    if (hourMap[hour] !== undefined) {
      hourMap[hour].total += count;
      hourMap[hour].children[child] = (hourMap[hour].children[child] || 0) + count;
    }
  }

  const activeHours = Object.entries(hourMap).map(([hour, data]) => ({
    hour: Number(hour),
    total: data.total,
    children: data.children,
  }));

  // ----- c) Preset usage -----
  const presetUsageRaw = await db
    .collection("conversations")
    .aggregate([
      {
        $match: {
          chatGptLabel: { $exists: true, $nin: [null, ""] },
        },
      },
      {
        $lookup: {
          from: "users",
          let: { userId: "$user" },
          pipeline: [
            {
              $match: {
                $expr: { $eq: [{ $toString: "$_id" }, "$$userId"] },
              },
            },
          ],
          as: "userInfo",
        },
      },
      {
        $unwind: {
          path: "$userInfo",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $match: {
          "userInfo.role": { $ne: "ADMIN" },
        },
      },
      {
        $group: {
          _id: {
            preset: "$chatGptLabel",
            child: "$userInfo.name",
          },
          count: { $sum: 1 },
        },
      },
      {
        $sort: { count: -1 },
      },
    ])
    .toArray();

  const presetMap: Record<string, { total: number; children: Record<string, number> }> = {};
  for (const row of presetUsageRaw) {
    const preset = (row._id.preset as string) || "Unknown";
    const child = (row._id.child as string) || "Unknown";
    const count = row.count as number;
    if (!presetMap[preset]) {
      presetMap[preset] = { total: 0, children: {} };
    }
    presetMap[preset].total += count;
    presetMap[preset].children[child] = (presetMap[preset].children[child] || 0) + count;
  }

  const presetUsage = Object.entries(presetMap)
    .map(([preset, data]) => ({ preset, total: data.total, children: data.children }))
    .sort((a, b) => b.total - a.total);

  // ----- d) Summary stats -----
  const totalMessages = messagesPerDay.reduce((sum, d) => sum + d.total, 0);

  const totalConversationsRaw = await db
    .collection("conversations")
    .aggregate([
      {
        $match: {
          updatedAt: { $gte: thirtyDaysAgo },
        },
      },
      {
        $lookup: {
          from: "users",
          let: { userId: "$user" },
          pipeline: [
            {
              $match: {
                $expr: { $eq: [{ $toString: "$_id" }, "$$userId"] },
              },
            },
          ],
          as: "userInfo",
        },
      },
      {
        $unwind: {
          path: "$userInfo",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $match: {
          "userInfo.role": { $ne: "ADMIN" },
        },
      },
      {
        $count: "total",
      },
    ])
    .toArray();

  const totalConversations = totalConversationsRaw[0]?.total ?? 0;

  // Find most active child
  const childTotals: Record<string, number> = {};
  for (const day of messagesPerDay) {
    for (const [child, count] of Object.entries(day.children)) {
      childTotals[child] = (childTotals[child] || 0) + count;
    }
  }
  const mostActiveChild =
    Object.entries(childTotals).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  return NextResponse.json({
    messagesPerDay,
    activeHours,
    presetUsage,
    summary: {
      totalMessages,
      totalConversations,
      mostActiveChild,
    },
  });
}
