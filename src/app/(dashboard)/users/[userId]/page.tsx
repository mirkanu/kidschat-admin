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
import { ArrowLeft, Calendar, Coins, ShoppingCart } from "lucide-react";
import { evaluateChildState } from "@/lib/budget";
import { getWeeklyBonusSpend } from "@/lib/bonus-purchases";

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
  remainingEur: number;
  dailyCapEur: number;
  dailyPctRemaining: number;
  monthlySpendEur: number;
  monthlyCapEur: number;
  monthlyCapExhausted: boolean;
  weeklyBonusSpentEur: number;
  weeklyBonusCapEur: number;
  hasActiveOffer: boolean;
}

async function getUserUsageStats(userId: string): Promise<UsageStats> {
  const client = await getMongoClient();
  const db = client.db("test");

  const [childState, weeklyBonusSpentEur] = await Promise.all([
    evaluateChildState(userId, db),
    getWeeklyBonusSpend(userId, db),
  ]);

  return {
    remainingEur: childState.remainingEur,
    dailyCapEur: childState.dailyCapEur,
    dailyPctRemaining: childState.dailyPctRemaining,
    monthlySpendEur: childState.monthlySpendEur,
    monthlyCapEur: childState.monthlyCapEur,
    monthlyCapExhausted: childState.monthlyCapExhausted,
    weeklyBonusSpentEur,
    weeklyBonusCapEur: childState.monthlyCapEur > 0 ? 0.50 : 0.50, // from HARDCODED_DEFAULTS
    hasActiveOffer: childState.hasActiveOffer,
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

  const dailyPercent = Math.min(100, Math.round((1 - stats.dailyPctRemaining) * 100));
  const monthlyPercent = stats.monthlyCapEur > 0
    ? Math.min(100, Math.round((stats.monthlySpendEur / stats.monthlyCapEur) * 100))
    : 0;
  const weeklyBonusPercent = stats.weeklyBonusCapEur > 0
    ? Math.min(100, Math.round((stats.weeklyBonusSpentEur / stats.weeklyBonusCapEur) * 100))
    : null;

  const usageItems = [
    {
      label: "Daily budget used",
      value: `€${(stats.dailyCapEur - stats.remainingEur).toFixed(3)} / €${stats.dailyCapEur.toFixed(2)}`,
      percent: dailyPercent,
      icon: Calendar,
      color: dailyPercent >= 90 ? "bg-red-500" : dailyPercent >= 70 ? "bg-yellow-500" : "bg-blue-500",
    },
    {
      label: "Monthly spend",
      value: `€${stats.monthlySpendEur.toFixed(2)} / €${stats.monthlyCapEur.toFixed(2)}`,
      percent: monthlyPercent,
      icon: Calendar,
      color: monthlyPercent >= 90 ? "bg-red-500" : monthlyPercent >= 70 ? "bg-yellow-500" : "bg-purple-500",
    },
    {
      label: "Active bonus offer",
      value: stats.hasActiveOffer ? "Active (awaiting YES)" : "None",
      percent: null,
      icon: Coins,
      color: "bg-amber-500",
    },
    {
      label: "Bonus purchases (week)",
      value: `€${stats.weeklyBonusSpentEur.toFixed(2)} / €${stats.weeklyBonusCapEur.toFixed(2)}`,
      percent: weeklyBonusPercent,
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
