import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { auth } from "@/auth";
import {
  buildAdminSystemPrompt,
  ADMIN_CHAT_MAX_TOKENS,
} from "@/lib/admin-system-prompt";
import type { AdminChatContext } from "@/lib/admin-system-prompt";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface AdminChatRequest {
  messages: ChatMessage[];
  context: AdminChatContext;
}

export async function POST(request: Request) {
  // Auth guard: require authenticated ADMIN session
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if ((session.user as { role?: string })?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: AdminChatRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { messages, context } = body;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json(
      { error: "messages array must be non-empty" },
      { status: 400 }
    );
  }

  const lastMessage = messages[messages.length - 1];
  if (lastMessage.role !== "user") {
    return NextResponse.json(
      { error: "Last message must have role 'user'" },
      { status: 400 }
    );
  }

  if (!context) {
    return NextResponse.json(
      { error: "context is required" },
      { status: 400 }
    );
  }

  const systemMessage = buildAdminSystemPrompt(context);

  try {
    const client = new Anthropic();

    // Streaming SSE response via Anthropic SDK.
    // Model: claude-sonnet-4-6-20250514 per v2.2 architecture decision.
    // If this returns a 400, check the Anthropic error message for the correct model string.
    const stream = client.messages.stream({
      model: "claude-sonnet-4-6-20250217",
      max_tokens: ADMIN_CHAT_MAX_TOKENS,
      system: systemMessage,
      messages,
    });

    // Return the raw SSE stream. The frontend reads this with ReadableStreamDefaultReader.
    return new Response(stream.toReadableStream());
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `AI request failed: ${message}` },
      { status: 500 }
    );
  }
}
