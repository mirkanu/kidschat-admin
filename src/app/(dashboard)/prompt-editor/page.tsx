import { redirect } from "next/navigation";
import { auth } from "@/auth";
import getMongoClient from "@/lib/mongodb";
import { SYSTEM_PROMPT } from "@/lib/system-prompt";
import { PromptEditorClient } from "./prompt-editor-client";

export default async function PromptEditorPage() {
  const session = await auth();
  if (!session) {
    redirect("/login");
  }

  let initialPrompt = SYSTEM_PROMPT;

  try {
    const client = await getMongoClient();
    const db = client.db("test");
    const activePromptDoc = await db
      .collection("app_config")
      .findOne({ key: "active_prompt" });
    if (activePromptDoc?.value) {
      initialPrompt = activePromptDoc.value as string;
    }
  } catch {
    // Fall back to hardcoded constant if MongoDB is unavailable
  }

  return (
    <PromptEditorClient
      initialPrompt={initialPrompt}
      hardcodedPrompt={SYSTEM_PROMPT}
    />
  );
}
