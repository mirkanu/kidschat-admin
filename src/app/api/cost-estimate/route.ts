import { NextResponse } from "next/server";
import { auth } from "@/auth";
import getMongoClient from "@/lib/mongodb";
import { estimateCost } from "@/lib/cost-estimates";

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const client = await getMongoClient();
  const db = client.db("test");

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // ----- Aggregation A: Daily message counts (last 30 days, ALL messages for trend) -----
  const dailyRaw = await db
    .collection("messages")
    .aggregate([
      {
        $match: {
          createdAt: { $gte: thirtyDaysAgo },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
          },
          count: { $sum: 1 },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ])
    .toArray();

  // Fill in zero-count days for the full 30-day range
  const dateMap: Record<string, number> = {};
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split("T")[0];
    dateMap[key] = 0;
  }
  for (const row of dailyRaw) {
    const date = row._id as string;
    if (dateMap[date] !== undefined) {
      dateMap[date] = row.count as number;
    }
  }

  const daily = Object.entries(dateMap).map(([date, messages]) => ({ date, messages }));

  // ----- Aggregation B: Monthly Haiku message count (child messages only, last 30 days) -----
  // Children use Haiku model. We exclude ADMIN users via conversation lookup, same as analytics route.
  const haikuCountRaw = await db
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
        $count: "total",
      },
    ])
    .toArray();

  const haikuMessages = (haikuCountRaw[0]?.total as number) ?? 0;

  // Sonnet (admin chatbot) — Phase 11 will add this; hardcode 0 for now
  const sonnetMessages = 0;

  // Calculate cost estimates
  const costEstimate = estimateCost({ haikuMessages, sonnetMessages });

  return NextResponse.json({
    daily,
    monthly: {
      haikuMessages,
      sonnetMessages,
      haikuCost: costEstimate.haikuCost,
      sonnetCost: costEstimate.sonnetCost,
      totalCost: costEstimate.totalCost,
      periodDays: 30,
    },
  });
}
