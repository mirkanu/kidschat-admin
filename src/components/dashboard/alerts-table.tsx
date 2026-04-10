"use client";

import { useState } from "react";
import Link from "next/link";
import { Shield, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { SafetyEvent } from "@/lib/safety-patterns";

interface AlertsTableProps {
  initialAlerts: SafetyEvent[];
}

type FilterType = "all" | "safety_redirect" | "jailbreak_attempt" | "image_prompt";

const FILTER_TABS: Array<{ label: string; value: FilterType }> = [
  { label: "All", value: "all" },
  { label: "Safety Redirects", value: "safety_redirect" },
  { label: "Jailbreak Attempts", value: "jailbreak_attempt" },
  { label: "Image Requests", value: "image_prompt" },
];

function formatDateTime(isoString: string): string {
  if (!isoString) return "—";
  return new Date(isoString).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function AlertsTable({ initialAlerts }: AlertsTableProps) {
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");

  const filtered =
    activeFilter === "all"
      ? initialAlerts
      : initialAlerts.filter((a) => a.type === activeFilter);

  return (
    <div className="space-y-4">
      {/* Filter tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        {FILTER_TABS.map((tab) => (
          <Button
            key={tab.value}
            variant={activeFilter === tab.value ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveFilter(tab.value)}
            className="active:scale-95 transition-transform"
          >
            {tab.label}
            {tab.value !== "all" && (
              <span className="ml-1.5 text-xs opacity-70">
                ({initialAlerts.filter((a) => a.type === tab.value).length})
              </span>
            )}
          </Button>
        ))}
        <span className="ml-auto text-sm text-muted-foreground">
          {filtered.length} event{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Empty state */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
          <Shield className="h-10 w-10 opacity-40" />
          <p className="text-sm font-medium">No safety events detected</p>
          <p className="text-xs text-center max-w-sm">
            All conversations are within safe boundaries. Safety events appear here when the AI redirects a conversation or a child attempts to bypass safety rules.
          </p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-36">Type</TableHead>
                <TableHead className="w-32">Child</TableHead>
                <TableHead>Excerpt</TableHead>
                <TableHead className="w-44">When</TableHead>
                <TableHead className="w-16 text-center">Source</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((alert, idx) => (
                <TableRow key={`${alert.conversationId}-${alert.detectedAt}-${idx}`}>
                  <TableCell>
                    {alert.type === "safety_redirect" ? (
                      <Badge
                        variant="secondary"
                        className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100 border-yellow-200 text-xs whitespace-nowrap"
                      >
                        Safety Redirect
                      </Badge>
                    ) : alert.type === "image_prompt" ? (
                      <Badge
                        variant="secondary"
                        className="bg-orange-100 text-orange-800 hover:bg-orange-100 border-orange-200 text-xs whitespace-nowrap"
                      >
                        Image
                      </Badge>
                    ) : (
                      <Badge
                        variant="destructive"
                        className="text-xs whitespace-nowrap"
                      >
                        Jailbreak Attempt
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="font-medium text-sm">
                    {alert.childName}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-xs">
                    <span className="line-clamp-2">
                      {alert.messageText.length >= 150
                        ? `${alert.messageText}…`
                        : alert.messageText}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatDateTime(alert.detectedAt)}
                  </TableCell>
                  <TableCell className="text-center">
                    <Link
                      href={`/conversations/${alert.conversationId}`}
                      className="inline-flex items-center justify-center rounded-md hover:bg-accent p-1.5 transition-colors active:scale-95"
                      title={`View conversation: ${alert.conversationTitle}`}
                    >
                      <ExternalLink className="h-4 w-4 text-muted-foreground" />
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
