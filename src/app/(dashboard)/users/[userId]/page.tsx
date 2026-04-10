import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import Link from "next/link";
import getMongoClient from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, MessageSquare, Image, Calendar, Coins, ShoppingCart } from "lucide-react";
import { getEffectiveLimits } from "@/lib/settings";
import { getImageCountToday, getDailyMessageCount, getMonthlySpendEUR } from "@/lib/cost-ledger";
import { getActiveBonusCredit, getWeeklyBonusSpend } from "@/lib/bonus-purchases";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
  lastActive: string | null;
}

async function getUser(userId: string): Promise<User | null> {
  try {
    const client = await getMongoClient();
    const db = client.db("test");

    let objectId: ObjectId;
    try {
      objectId = new ObjectId(userId);
    } catch {
      return null;
    }

    const user = await db
      .collection("users")
      .findOne({ _id: objectId }, { projection: { password: 0 } });

    if (!user) return null;

    return {
      id: user._id.toString(),
      name: (user.name as string) ?? "",
      email: (user.email as string) ?? "",
      role: (user.role as string) ?? "USER",
      createdAt: user.createdAt
        ? new Date(user.createdAt as Date).toISOString()
        : new Date().toISOString(),
      lastActive: user.updatedAt ? new Date(user.updatedAt as Date).toISOString() : null,
    };
  } catch {
    return null;
  }
}

interface UsageStats {
  imageCountToday: number;
  messageCountToday: number;
  monthlySpendEUR: number;
  activeBonusCredit: number;
  weeklyBonusSpend: number;
  limits: {
    dailyImageLimit: number;
    dailyMessageLimit: number;
    monthlyCostCapEUR: number;
    weeklyBonusCap: number;
  };
}

async function getUserUsageStats(userId: string): Promise<UsageStats> {
  const client = await getMongoClient();
  const db = client.db("test");

  const [imageCountToday, messageCountToday, monthlySpendEUR, activeBonusCredit, weeklyBonusSpend, limits] =
    await Promise.all([
      getImageCountToday(userId, db),
      getDailyMessageCount(userId, db),
      getMonthlySpendEUR(userId, db),
      getActiveBonusCredit(userId, db),
      getWeeklyBonusSpend(userId, db),
      getEffectiveLimits(userId, db),
    ]);

  return {
    imageCountToday,
    messageCountToday,
    monthlySpendEUR,
    activeBonusCredit,
    weeklyBonusSpend,
    limits: {
      dailyImageLimit: limits.dailyImageLimit,
      dailyMessageLimit: limits.dailyMessageLimit,
      monthlyCostCapEUR: limits.monthlyCostCapEUR,
      weeklyBonusCap: limits.weeklyBonusCap,
    },
  };
}

function UsageSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-28" />
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="space-y-2 rounded-md border p-3">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-6 w-16" />
              <Skeleton className="h-2 w-full rounded-full" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

async function UsageSection({ userId }: { userId: string }) {
  const stats = await getUserUsageStats(userId);

  const imagePercent = Math.min(
    100,
    Math.round((stats.imageCountToday / stats.limits.dailyImageLimit) * 100)
  );
  const messagePercent = Math.min(
    100,
    Math.round((stats.messageCountToday / stats.limits.dailyMessageLimit) * 100)
  );
  const monthlyPercent = Math.min(
    100,
    Math.round((stats.monthlySpendEUR / stats.limits.monthlyCostCapEUR) * 100)
  );

  const usageItems = [
    {
      label: "Images today",
      value: `${stats.imageCountToday} / ${stats.limits.dailyImageLimit}`,
      percent: imagePercent,
      icon: Image,
      color: imagePercent >= 90 ? "bg-red-500" : imagePercent >= 70 ? "bg-yellow-500" : "bg-blue-500",
    },
    {
      label: "Messages today",
      value: `${stats.messageCountToday} / ${stats.limits.dailyMessageLimit}`,
      percent: messagePercent,
      icon: MessageSquare,
      color: messagePercent >= 90 ? "bg-red-500" : messagePercent >= 70 ? "bg-yellow-500" : "bg-green-500",
    },
    {
      label: "Monthly spend",
      value: `€${stats.monthlySpendEUR.toFixed(2)} / €${stats.limits.monthlyCostCapEUR.toFixed(2)}`,
      percent: monthlyPercent,
      icon: Calendar,
      color: monthlyPercent >= 90 ? "bg-red-500" : monthlyPercent >= 70 ? "bg-yellow-500" : "bg-purple-500",
    },
    {
      label: "Active bonus credit",
      value: stats.activeBonusCredit > 0 ? `€${stats.activeBonusCredit.toFixed(2)}` : "None",
      percent: null,
      icon: Coins,
      color: "bg-amber-500",
    },
    {
      label: "Bonus purchases (week)",
      value: `€${stats.weeklyBonusSpend.toFixed(2)} / €${stats.limits.weeklyBonusCap.toFixed(2)}`,
      percent: stats.limits.weeklyBonusCap > 0
        ? Math.min(100, Math.round((stats.weeklyBonusSpend / stats.limits.weeklyBonusCap) * 100))
        : null,
      icon: ShoppingCart,
      color: "bg-violet-500",
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Usage &amp; Limits</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {usageItems.map((item) => (
            <div key={item.label} className="rounded-md border p-3 space-y-2">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <item.icon className="h-3.5 w-3.5" />
                {item.label}
              </div>
              <div className="text-sm font-semibold">{item.value}</div>
              {item.percent !== null && (
                <Progress
                  value={item.percent}
                  className="h-1.5"
                />
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function formatDate(isoString: string | null): string {
  if (!isoString) return "Never";
  return new Date(isoString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const { userId } = await params;
  const user = await getUser(userId);
  if (!user) notFound();

  return (
    <div className="space-y-6">
      {/* Breadcrumb nav */}
      <div>
        <Link
          href="/users"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors active:scale-95"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Users
        </Link>
      </div>

      {/* Page heading */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{user.name}</h1>
          <p className="text-sm text-muted-foreground mt-1">{user.email}</p>
        </div>
        <Badge variant={user.role === "ADMIN" ? "destructive" : "secondary"}>
          {user.role}
        </Badge>
      </div>

      {/* User metadata */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Account Details</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
            <div>
              <dt className="text-muted-foreground">Joined</dt>
              <dd className="font-medium mt-0.5">{formatDate(user.createdAt)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Last active</dt>
              <dd className="font-medium mt-0.5">{formatDate(user.lastActive)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">User ID</dt>
              <dd className="font-mono text-xs mt-0.5 text-muted-foreground">{user.id}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Role</dt>
              <dd className="font-medium mt-0.5">{user.role}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {/* Usage & Limits — streams in independently via Suspense */}
      {user.role !== "ADMIN" && (
        <Suspense fallback={<UsageSkeleton />}>
          <UsageSection userId={userId} />
        </Suspense>
      )}

      {/* Link to settings for this user */}
      {user.role !== "ADMIN" && (
        <div className="text-sm text-muted-foreground">
          To set per-child limits for {user.name},{" "}
          <Link href="/settings" className="underline hover:text-foreground transition-colors">
            visit the Settings page
          </Link>
          .
        </div>
      )}
    </div>
  );
}
