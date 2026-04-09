"use client";

import { useState, useRef, useEffect } from "react";
import { usePathname } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { MessageCircle, X, SendHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AdminChatContext {
  systemPromptText: string;
  users: { name: string; email: string; role: string }[];
  recentAlertCount: number;
  messageCountLast24h: number;
  recentConversationLogs?: string;
}

interface Message {
  role: "user" | "assistant";
  content: string;
}

// ---------------------------------------------------------------------------
// Suggested question chips shown in empty state
// ---------------------------------------------------------------------------

const SUGGESTED_QUESTIONS = [
  "What safety rules are active?",
  "Summarize recent conversations",
  "How does the app work?",
  "Show me user activity",
];

// ---------------------------------------------------------------------------
// Loading dots indicator (same pattern as test-mode-client.tsx)
// ---------------------------------------------------------------------------

function LoadingDots() {
  return (
    <div className="flex items-center gap-1 px-4 py-3">
      <span className="h-2 w-2 rounded-full bg-muted-foreground animate-bounce [animation-delay:-0.3s]" />
      <span className="h-2 w-2 rounded-full bg-muted-foreground animate-bounce [animation-delay:-0.15s]" />
      <span className="h-2 w-2 rounded-full bg-muted-foreground animate-bounce" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main AdminChatWidget component
// ---------------------------------------------------------------------------

export function AdminChatWidget() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [context, setContext] = useState<AdminChatContext | null>(null);
  const [contextLoading, setContextLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom on new messages or loading state change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Fetch context once when the widget is first opened
  useEffect(() => {
    if (!isOpen || context !== null) return;

    async function fetchContext() {
      setContextLoading(true);
      try {
        const res = await fetch("/api/admin-chat/context");
        if (res.ok) {
          const data = await res.json();
          setContext(data);
        }
      } catch {
        // Context fetch failure is non-fatal — widget still works, just with no context
      } finally {
        setContextLoading(false);
      }
    }

    fetchContext();
  }, [isOpen, context]);

  // Send a message and stream the response
  async function handleSubmit(messageText?: string) {
    const text = (messageText ?? input).trim();
    if (!text || isLoading) return;

    const userMsg: Message = { role: "user", content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/admin-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages, context }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: `Error: ${err.error ?? "Unknown error"}` },
        ]);
        return;
      }

      // Stream the response using ReadableStream.
      //
      // The Anthropic SDK's stream.toReadableStream() emits raw Server-Sent Events (SSE).
      // Each chunk may contain one or more SSE events, each formatted as:
      //   event: <event_type>\n
      //   data: <json_payload>\n\n
      //
      // We extract text from `content_block_delta` events where `delta.type === "text_delta"`.
      // Example payload: { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "Hello" } }
      //
      // Non-JSON lines (event: lines, empty lines) are silently skipped.
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let assistantContent = "";

      // Add an empty assistant message that we'll update incrementally
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === "content_block_delta" && data.delta?.text) {
                assistantContent += data.delta.text;
                setMessages((prev) => {
                  const updated = [...prev];
                  updated[updated.length - 1] = {
                    role: "assistant",
                    content: assistantContent,
                  };
                  return updated;
                });
              }
            } catch {
              // Skip non-JSON lines (event: lines, empty lines, ping events)
            }
          }
        }
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Error: Failed to connect. Please try again.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  // Handle chip click: set input and auto-submit
  function handleChipClick(question: string) {
    handleSubmit(question);
  }

  // ---------------------------------------------------------------------------
  // Hide on test-mode page — it has its own chat UI and the bubble overlaps
  // its Send button on mobile
  // ---------------------------------------------------------------------------

  if (pathname === "/test-mode") return null;

  // ---------------------------------------------------------------------------
  // Collapsed state — floating button
  // ---------------------------------------------------------------------------

  if (!isOpen) {
    return (
      <Button
        onClick={() => setIsOpen(true)}
        className={cn(
          // z-40: stays below the mobile Sheet sidebar (z-50)
          "fixed bottom-6 right-6 z-40",
          "h-14 w-14 rounded-full shadow-lg",
          "bg-primary text-primary-foreground",
          "hover:scale-105 transition-transform"
        )}
        aria-label="Open admin assistant"
      >
        <MessageCircle className="h-6 w-6" />
      </Button>
    );
  }

  // ---------------------------------------------------------------------------
  // Expanded state — chat panel
  // ---------------------------------------------------------------------------

  return (
    <Card
      className={cn(
        // z-40: stays below the mobile Sheet sidebar (z-50)
        "fixed z-40 flex flex-col shadow-2xl rounded-xl overflow-hidden",
        // Desktop: fixed bottom-right panel
        "bottom-6 right-6 w-[400px] h-[500px] max-h-[80vh]",
        // Mobile: full-width bottom sheet
        "max-sm:bottom-0 max-sm:right-0 max-sm:left-0 max-sm:w-full max-sm:h-[70vh] max-sm:rounded-b-none"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3 shrink-0">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-primary" />
          <span className="font-semibold text-sm">Admin Assistant</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => setIsOpen(false)}
          aria-label="Close admin assistant"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Message area */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-4 space-y-3">
          {contextLoading ? (
            /* Skeleton while context loads */
            <div className="space-y-3">
              <Skeleton className="h-10 w-3/4" />
              <Skeleton className="h-10 w-1/2" />
              <Skeleton className="h-10 w-2/3" />
            </div>
          ) : messages.length === 0 && !isLoading ? (
            /* Empty state with suggested question chips */
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground text-center pt-2">
                Ask me anything about your dashboard
              </p>
              <div className="flex flex-col gap-2">
                {SUGGESTED_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    onClick={() => handleChipClick(q)}
                    className={cn(
                      "text-left text-xs px-3 py-2 rounded-lg border",
                      "bg-muted/50 hover:bg-muted transition-colors",
                      "text-foreground cursor-pointer"
                    )}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={cn(
                    "flex flex-col",
                    msg.role === "user" ? "items-end" : "items-start"
                  )}
                >
                  <div
                    className={cn(
                      "rounded-2xl px-4 py-2.5 text-sm max-w-[85%] break-words",
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground whitespace-pre-wrap"
                        : "bg-muted text-foreground prose prose-sm dark:prose-invert max-w-none"
                    )}
                  >
                    {msg.role === "assistant" ? (
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                    ) : (
                      msg.content
                    )}
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex items-start">
                  <div className="rounded-2xl bg-muted">
                    <LoadingDots />
                  </div>
                </div>
              )}
            </>
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {/* Input area */}
      <div className="border-t p-3 flex items-center gap-2 bg-background shrink-0">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask your admin assistant..."
          disabled={isLoading || contextLoading}
          className="flex-1 text-sm"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
          }}
        />
        <Button
          type="button"
          size="icon"
          disabled={isLoading || contextLoading || !input.trim()}
          onClick={() => handleSubmit()}
          className="shrink-0"
          aria-label="Send message"
        >
          <SendHorizontal className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  );
}
