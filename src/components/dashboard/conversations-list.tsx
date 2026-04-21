"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, MessageSquare } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface ConversationSummary {
  conversationId: string;
  title: string;
  updatedAt: string | null;
  userName: string | null;
  userEmail: string | null;
  preset?: "image-search";
}

interface ConversationsListProps {
  initialConversations: ConversationSummary[];
  children: string[];
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const FILTER_TABS = ["All", "Sebastian", "Penelope"] as const;

export function ConversationsList({
  initialConversations,
  children: _childNames,
}: ConversationsListProps) {
  const [search, setSearch] = useState("");
  const [childFilter, setChildFilter] = useState<string>("all");

  const filtered = initialConversations.filter((conv) => {
    // Apply child filter
    if (childFilter !== "all") {
      if (!conv.userName?.toLowerCase().includes(childFilter.toLowerCase())) {
        return false;
      }
    }
    // Apply keyword search on title
    if (search && !conv.title.toLowerCase().includes(search.toLowerCase())) {
      return false;
    }
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search conversations..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-2">
        {FILTER_TABS.map((tab) => {
          const value = tab === "All" ? "all" : tab.toLowerCase();
          const isActive = childFilter === value;
          return (
            <Button
              key={tab}
              variant={isActive ? "default" : "outline"}
              size="sm"
              onClick={() => setChildFilter(value)}
              className="active:scale-95 transition-transform"
            >
              {tab}
            </Button>
          );
        })}
      </div>

      {/* Conversation rows */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          No conversations found
        </div>
      ) : (
        <div className="space-y-1">
          {filtered.map((conv) => (
            <Link
              key={conv.conversationId}
              href={`/conversations/${conv.conversationId}`}
              className="flex items-center gap-4 rounded-md border p-4 hover:bg-accent hover:text-accent-foreground active:scale-[0.99] transition-all"
            >
              {/* Icon */}
              <div className="shrink-0 rounded-md p-2 bg-muted">
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
              </div>

              {/* Title + child name */}
              <div className="flex-1 min-w-0 space-y-1">
                <p className="text-sm font-medium truncate">{conv.title}</p>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {conv.userName && (
                    <Badge variant="secondary" className="text-xs">
                      {conv.userName}
                    </Badge>
                  )}
                  {conv.preset === "image-search" && (
                    <Badge variant="secondary" className="text-xs">
                      Image Search
                    </Badge>
                  )}
                </div>
              </div>

              {/* Timestamp */}
              <span className="shrink-0 text-xs text-muted-foreground">
                {formatDate(conv.updatedAt)}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
