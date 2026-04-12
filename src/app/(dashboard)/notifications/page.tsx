import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { NotificationSettings } from "@/components/dashboard/notification-settings";

interface EmailNotification {
  _id: string;
  type: "safety_alert" | "weekly_digest";
  sentAt: string;
  to: string[];
  childName?: string;
  weekOf?: string;
  resendId?: string;
  meta: Record<string, unknown>;
}

async function getNotifications(): Promise<EmailNotification[]> {
  try {
    const getMongoClient = (await import("@/lib/mongodb")).default;
    const client = await getMongoClient();
    const db = client.db("test");

    const records = await db
      .collection("email_notifications")
      .find({})
      .sort({ sentAt: -1 })
      .limit(100)
      .toArray();

    return records.map((n) => ({
      _id: n._id.toString(),
      type: (n.type as "safety_alert" | "weekly_digest") ?? "safety_alert",
      sentAt: n.sentAt instanceof Date ? n.sentAt.toISOString() : String(n.sentAt ?? ""),
      to: Array.isArray(n.to) ? (n.to as string[]) : [],
      childName: n.childName as string | undefined,
      weekOf: n.weekOf as string | undefined,
      resendId: n.resendId as string | undefined,
      meta: (n.meta as Record<string, unknown>) ?? {},
    }));
  } catch {
    return [];
  }
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function truncate(str: string | undefined, maxLen: number): string {
  if (!str) return "\u2014";
  return str.length > maxLen ? str.slice(0, maxLen) + "\u2026" : str;
}

export default async function NotificationsPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const notifications = await getNotifications();

  const safetyAlertsCount = notifications.filter((n) => n.type === "safety_alert").length;
  const weeklyDigestCount = notifications.filter((n) => n.type === "weekly_digest").length;

  return (
    <div className="space-y-6">
      {/* Page heading */}
      <div>
        <h1 className="text-2xl font-semibold">Email Notifications</h1>
        <p className="text-sm text-muted-foreground mt-1">
          History of all emails sent to parent accounts
        </p>
      </div>

      {/* Summary badges */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Total sent:</span>
          <Badge variant="secondary" className="font-semibold">
            {notifications.length}
          </Badge>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Safety alerts:</span>
          <Badge
            variant="secondary"
            className="bg-red-100 text-red-800 hover:bg-red-100 border-red-200 font-semibold"
          >
            {safetyAlertsCount}
          </Badge>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Weekly digests:</span>
          <Badge
            variant="secondary"
            className="bg-blue-100 text-blue-800 hover:bg-blue-100 border-blue-200 font-semibold"
          >
            {weeklyDigestCount}
          </Badge>
        </div>
      </div>

      {/* Tabbed layout: History + Settings */}
      <Tabs defaultValue="history" className="w-full">
        <TabsList>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        {/* History tab — existing notification table */}
        <TabsContent value="history">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Recipient(s)</TableHead>
                  <TableHead>Child / Subject</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Resend ID</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {notifications.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center text-muted-foreground py-12"
                    >
                      No notifications sent yet
                    </TableCell>
                  </TableRow>
                ) : (
                  notifications.map((n) => (
                    <TableRow key={n._id}>
                      <TableCell>
                        {n.type === "safety_alert" ? (
                          <Badge
                            variant="secondary"
                            className="bg-red-100 text-red-800 hover:bg-red-100 border-red-200 whitespace-nowrap"
                          >
                            Safety Alert
                          </Badge>
                        ) : (
                          <Badge
                            variant="secondary"
                            className="bg-blue-100 text-blue-800 hover:bg-blue-100 border-blue-200 whitespace-nowrap"
                          >
                            Weekly Digest
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {n.to.length > 0 ? n.to.join(", ") : "\u2014"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {n.type === "safety_alert"
                          ? (n.childName ?? "\u2014")
                          : n.weekOf
                          ? `Week of ${n.weekOf}`
                          : "\u2014"}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                        {formatDate(n.sentAt)}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs font-mono">
                        {truncate(n.resendId, 20)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Settings tab — recipient management (client component island) */}
        <TabsContent value="settings">
          <NotificationSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}
