"use client";

import Link from "next/link";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ShieldCheck,
  AlertTriangle,
  MessageSquare,
  Users,
  ArrowRight,
  Activity,
  Shield,
} from "lucide-react";
import type { SystemStatus, ActivityDigest, RecentAlert } from "@/lib/trust-dashboard";

// ---------------------------------------------------------------------------
// Helper: format relative time
// ---------------------------------------------------------------------------

function relativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ---------------------------------------------------------------------------
// TRUST-01: Safety Status Card
// ---------------------------------------------------------------------------

export function SafetyStatusCard({ status }: { status: SystemStatus }) {
  const allActive = status.allSystemsActive;

  const statusDot: Record<"active" | "degraded" | "down", string> = {
    active: "bg-green-500",
    degraded: "bg-yellow-400",
    down: "bg-red-500",
  };

  return (
    <Card
      className={
        allActive
          ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900"
          : "bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-900"
      }
    >
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          {allActive ? (
            <ShieldCheck className="h-8 w-8 text-green-600 dark:text-green-400" />
          ) : (
            <AlertTriangle className="h-8 w-8 text-yellow-600 dark:text-yellow-400" />
          )}
          <div>
            <CardTitle className="text-lg">
              {allActive ? "All Systems Active" : "Attention Required"}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Last checked: {relativeTime(status.lastChecked)}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {status.systems.map((sys) => (
            <li key={sys.name} className="flex items-center gap-2 text-sm">
              <span
                className={`inline-block h-2 w-2 rounded-full shrink-0 ${statusDot[sys.status]}`}
              />
              <span className="font-medium">{sys.name}</span>
              <span className="text-muted-foreground">— {sys.detail}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// TRUST-02: Activity Digest Card
// ---------------------------------------------------------------------------

export function ActivityDigestCard({ digest }: { digest: ActivityDigest }) {
  const healthVariant: Record<
    ActivityDigest["systemHealth"],
    "default" | "secondary" | "destructive"
  > = {
    healthy: "default",
    warning: "secondary",
    critical: "destructive",
  };

  const healthLabel: Record<ActivityDigest["systemHealth"], string> = {
    healthy: "Healthy",
    warning: "Warning",
    critical: "Critical",
  };

  const healthBadgeClass: Record<ActivityDigest["systemHealth"], string> = {
    healthy: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border-green-200",
    warning: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 border-yellow-200",
    critical: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 border-red-200",
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Last 24 Hours</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div className="flex flex-col items-center gap-1 rounded-lg border p-3">
            <MessageSquare className="h-5 w-5 text-muted-foreground" />
            <span className="text-2xl font-bold">{digest.messagesSent}</span>
            <span className="text-xs text-muted-foreground">Messages Sent</span>
          </div>
          <div className="flex flex-col items-center gap-1 rounded-lg border p-3">
            <AlertTriangle
              className={`h-5 w-5 ${
                digest.safetyEventsDetected > 0 ? "text-yellow-500" : "text-muted-foreground"
              }`}
            />
            <span className="text-2xl font-bold">{digest.safetyEventsDetected}</span>
            <span className="text-xs text-muted-foreground">Safety Events</span>
          </div>
          <div className="flex flex-col items-center gap-1 rounded-lg border p-3">
            <Users className="h-5 w-5 text-muted-foreground" />
            <span className="text-2xl font-bold">{digest.activeChildren}</span>
            <span className="text-xs text-muted-foreground">Active Children</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">System health:</span>
          <span
            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
              healthBadgeClass[digest.systemHealth]
            }`}
          >
            {healthLabel[digest.systemHealth]}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// TRUST-03: Recent Alerts Card
// ---------------------------------------------------------------------------

export function RecentAlertsCard({ alerts }: { alerts: RecentAlert[] }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Recent Safety Alerts</CardTitle>
      </CardHeader>
      <CardContent>
        {alerts.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400">
            <ShieldCheck className="h-4 w-4" />
            No safety events detected recently.
          </div>
        ) : (
          <ul className="space-y-3">
            {alerts.map((alert, idx) => (
              <li key={idx} className="flex flex-col gap-1 border-b last:border-0 pb-3 last:pb-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge
                    variant={alert.type === "jailbreak_attempt" ? "destructive" : "secondary"}
                    className={
                      alert.type !== "jailbreak_attempt"
                        ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 border-yellow-200"
                        : ""
                    }
                  >
                    {alert.type === "jailbreak_attempt" ? "Jailbreak Attempt" : "Safety Redirect"}
                  </Badge>
                  <span className="text-sm font-medium">{alert.childName}</span>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {relativeTime(alert.detectedAt)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2 pl-0">
                  &ldquo;{alert.messageExcerpt}&rdquo;
                </p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      <CardFooter className="pt-0">
        <Link
          href="/alerts"
          className="flex items-center gap-1 text-sm text-primary hover:underline active:scale-95 transition-transform"
        >
          View all alerts <ArrowRight className="h-3 w-3" />
        </Link>
      </CardFooter>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// TRUST-04: Quick Links (static, rendered in page.tsx but typed here)
// ---------------------------------------------------------------------------

export interface QuickLink {
  href: string;
  label: string;
  description: string;
  icon: React.ElementType;
  comingSoon?: boolean;
}

export const QUICK_LINKS: QuickLink[] = [
  {
    href: "/safety-rules",
    label: "Safety Rules",
    description: "View content boundaries and system prompt",
    icon: Shield,
    comingSoon: true,
  },
  {
    href: "/test-mode",
    label: "Test Mode",
    description: "Try safety scenarios yourself",
    icon: Activity,
    comingSoon: true,
  },
  {
    href: "/conversations",
    label: "Conversations",
    description: "Browse all chat logs",
    icon: MessageSquare,
  },
  {
    href: "/alerts",
    label: "Safety Alerts",
    description: "Review detected events",
    icon: AlertTriangle,
  },
];

export function QuickLinksGrid() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {QUICK_LINKS.map((link) => {
        const Icon = link.icon;
        return (
          <Link
            key={link.href}
            href={link.href}
            className="group relative flex items-start gap-3 rounded-lg border p-4 transition-transform hover:scale-[1.02] active:scale-95 bg-card hover:bg-accent/50"
          >
            <Icon className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0 group-hover:text-foreground transition-colors" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-medium text-sm">{link.label}</p>
                {link.comingSoon && (
                  <Badge variant="secondary" className="text-xs py-0">
                    Coming soon
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{link.description}</p>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
