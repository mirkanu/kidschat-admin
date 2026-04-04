import { auth } from "@/auth";
import clientPromise from "@/lib/mongodb";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, MessageSquare, Database, CheckCircle2 } from "lucide-react";
import { Suspense } from "react";
import { DashboardStats } from "./page-client";
import { Skeleton } from "@/components/ui/skeleton";

async function getStats() {
  const client = await clientPromise;
  const db = client.db("test");
  const [userCount, conversationCount] = await Promise.all([
    db.collection("users").countDocuments(),
    db.collection("conversations").countDocuments(),
  ]);
  return { userCount, conversationCount };
}

export default async function DashboardPage() {
  const session = await auth();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">
          Welcome back, {session?.user?.name?.split(" ")[0]}
        </h2>
        <p className="text-muted-foreground">Here&apos;s what&apos;s happening with KidsChat.</p>
      </div>

      <div className="flex items-center gap-2">
        <CheckCircle2 className="h-4 w-4 text-green-500" />
        <span className="text-sm text-muted-foreground">Connected to MongoDB (test database)</span>
        <Badge variant="outline" className="text-green-600 border-green-200">Live</Badge>
      </div>

      <Suspense fallback={<StatsSkeleton />}>
        <DashboardStats statsPromise={getStats()} />
      </Suspense>
    </div>
  );
}

function StatsSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-4" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-16 mb-1" />
            <Skeleton className="h-3 w-32" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
