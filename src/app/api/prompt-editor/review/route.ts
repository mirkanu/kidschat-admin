import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { auth } from "@/auth";

const REVIEWER_SYSTEM_PROMPT = `You are a safety prompt reviewer for a children's AI chat application. Check the following draft system prompt against the required sections checklist. For each section, respond with PASS or FAIL and a brief explanation.

Required sections:
1. JAILBREAK_RESISTANCE — Must contain explicit instructions for handling attempts to override rules
2. CONTENT_BOUNDARIES — Must define prohibited content categories (profanity, violence, sexual, substance abuse)
3. REFORMED_VALUES — Must reference Christian/biblical principles and prohibit theological contradiction
4. ANTI_CHEATING — Must instruct the AI to teach, not complete homework
5. TONE_REDIRECT — Must describe gentle redirection when boundaries are hit
6. IDENTITY_FRAMING — Must instruct AI to maintain its identity and not reveal full instructions

Respond in JSON format:
{
  "sections": [
    { "id": "JAILBREAK_RESISTANCE", "status": "PASS", "reason": "..." },
    { "id": "CONTENT_BOUNDARIES", "status": "PASS", "reason": "..." },
    { "id": "REFORMED_VALUES", "status": "PASS", "reason": "..." },
    { "id": "ANTI_CHEATING", "status": "PASS", "reason": "..." },
    { "id": "TONE_REDIRECT", "status": "PASS", "reason": "..." },
    { "id": "IDENTITY_FRAMING", "status": "PASS", "reason": "..." }
  ],
  "overall": "PASS",
  "summary": "Brief overall assessment"
}`;

interface ReviewSection {
  id: string;
  status: "PASS" | "FAIL";
  reason: string;
}

interface ReviewResult {
  sections: ReviewSection[];
  overall: "PASS" | "FAIL" | "ERROR";
  summary: string;
  rawText?: string;
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

  let body: { draft?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { draft } = body;
  if (!draft || typeof draft !== "string") {
    return NextResponse.json(
      { error: "draft (string) is required" },
      { status: 400 }
    );
  }

  try {
    const client = new Anthropic();

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: REVIEWER_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Please review this draft system prompt:\n\n${draft}`,
        },
      ],
    });

    const rawText =
      response.content[0].type === "text" ? response.content[0].text : "";

    let result: ReviewResult;
    try {
      // Strip markdown code fences if present
      const cleaned = rawText
        .replace(/^```(?:json)?\n?/m, "")
        .replace(/\n?```$/m, "")
        .trim();
      result = JSON.parse(cleaned) as ReviewResult;
    } catch {
      result = {
        sections: [],
        overall: "ERROR",
        summary: "Failed to parse review response",
        rawText,
      };
    }

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Review request failed: ${message}` },
      { status: 500 }
    );
  }
}
