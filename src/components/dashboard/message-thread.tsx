"use client";

import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface ImageAttachment {
  fileId: string;
  url: string;
  width?: number;
  height?: number;
}

interface MessageItem {
  messageId: string;
  text: string;
  isCreatedByUser: boolean;
  sender: string;
  createdAt: string; // ISO string
  images: ImageAttachment[];
}

interface Props {
  conversation: { conversationId: string; title: string };
  messages: MessageItem[];
}

function formatTimestamp(isoString: string): string {
  if (!isoString) return "";
  try {
    return new Date(isoString).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return isoString;
  }
}

export function MessageThread({ conversation, messages }: Props) {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/conversations" aria-label="Back to conversations">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <h1 className="text-xl font-semibold flex-1 truncate">
          {conversation.title || "Untitled Conversation"}
        </h1>
        <Badge variant="secondary">
          {messages.length} {messages.length === 1 ? "message" : "messages"}
        </Badge>
      </div>

      {/* Message list */}
      {messages.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          No messages in this conversation
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto max-h-[calc(100vh-200px)] space-y-4 pr-1">
          {messages.map((msg) =>
            msg.isCreatedByUser ? (
              // Child message — right aligned
              <div key={msg.messageId} className="flex justify-end">
                <div className="flex flex-col items-end gap-1 max-w-[70%]">
                  <span className="text-xs text-muted-foreground">Child</span>
                  <div className="bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-4 py-2.5 whitespace-pre-wrap break-words">
                    {msg.text}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {formatTimestamp(msg.createdAt)}
                  </span>
                </div>
              </div>
            ) : (
              // AI message — left aligned
              <div key={msg.messageId} className="flex justify-start">
                <div className="flex flex-col items-start gap-1 max-w-[70%]">
                  <span className="text-xs text-muted-foreground">
                    AI Assistant
                  </span>
                  {msg.text && (
                    <div className="bg-muted text-foreground rounded-2xl rounded-tl-sm px-4 py-2.5 break-words prose prose-sm dark:prose-invert max-w-none">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.text}</ReactMarkdown>
                    </div>
                  )}
                  {msg.images.length > 0 && (
                    <div className="flex flex-col gap-2 mt-1">
                      {msg.images.map((img) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          key={img.fileId || img.url}
                          src={img.url}
                          alt="Generated image"
                          width={img.width ?? 400}
                          height={img.height ?? 400}
                          className="rounded-lg border max-w-full h-auto"
                          loading="lazy"
                        />
                      ))}
                    </div>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {formatTimestamp(msg.createdAt)}
                  </span>
                </div>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}
