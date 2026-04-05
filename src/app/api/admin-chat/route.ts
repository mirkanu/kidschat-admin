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

    const stream = client.messages.stream({
      model: "claude-sonnet-4-6",
      max_tokens: ADMIN_CHAT_MAX_TOKENS,
      system: systemMessage,
      messages,
    });

    // Create a proper SSE stream that the frontend can parse
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        stream.on("text", (text) => {
          const event = JSON.stringify({
            type: "content_block_delta",
            delta: { type: "text_delta", text },
          });
          controller.enqueue(encoder.encode(`data: ${event}\n\n`));
        });
        stream.on("end", () => {
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        });
        stream.on("error", (err) => {
          const msg = err instanceof Error ? err.message : "Stream error";
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "error", error: msg })}\n\n`)
          );
          controller.close();
        });
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `AI request failed: ${message}` },
      { status: 500 }
    );
  }
}
