import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { auth } from "@/auth";
import { SYSTEM_PROMPT } from "@/lib/system-prompt";
import getMongoClient from "@/lib/mongodb";
import {
  DEFAULT_AGENT_ID,
  applyManagedRules,
  renderRulesForAgent,
} from "@/lib/agent-rules";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { messages?: ChatMessage[]; systemPrompt?: string; agentId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { messages, systemPrompt, agentId } = body;

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

  try {
    // Build the prompt the child would actually get: the real agent
    // instructions with the drafted rules block swapped in.
    let system = systemPrompt || SYSTEM_PROMPT;

    try {
      const client = await getMongoClient();
      const db = client.db("test");
      const agent = await db
        .collection("agents")
        .findOne({ id: agentId || DEFAULT_AGENT_ID });

      if (agent?.instructions) {
        const instructions = agent.instructions as string;
        const name = (agent.name as string) ?? "KidsChat";
        system = systemPrompt
          ? applyManagedRules(
              instructions,
              renderRulesForAgent(systemPrompt, name)
            )
          : instructions;
      }
    } catch {
      // Fall back to the draft-only prompt when Mongo is unavailable.
    }

    const anthropic = new Anthropic();

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system,
      messages,
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";

    return NextResponse.json({ role: "assistant", content: text });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `AI request failed: ${message}` },
      { status: 500 }
    );
  }
}
