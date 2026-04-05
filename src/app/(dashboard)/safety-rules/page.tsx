import { redirect } from "next/navigation";
import { auth } from "@/auth";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ShieldCheck, FileText, AlertTriangle, Palette, PenLine } from "lucide-react";
import { SYSTEM_PROMPT } from "@/lib/system-prompt";
import getMongoClient from "@/lib/mongodb";

const TONE_PRESETS = [
  {
    name: "Friendly Tutor",
    description:
      "Warm and encouraging with an educational focus. Uses analogies and asks guiding questions to help children understand concepts.",
    bestFor: "Learning sessions and curious exploration.",
  },
  {
    name: "Casual Buddy",
    description:
      "Relaxed and conversational with age-appropriate humor. Feels like chatting with a knowledgeable friend.",
    bestFor: "Everyday questions and casual conversation.",
  },
  {
    name: "Balanced Helper",
    description:
      "A middle ground between formal and casual. Clear, helpful, and approachable without being too stiff or too loose.",
    bestFor: "General use — works well for most situations.",
  },
  {
    name: "Standard Formal",
    description:
      "Professional and structured responses. Organized and thorough.",
    bestFor: "Older children, academic help, and research tasks.",
  },
];

export default async function SafetyRulesPage() {
  const session = await auth();
  if (!session) {
    redirect("/login");
  }

  let activePrompt = SYSTEM_PROMPT;

  try {
    const client = await getMongoClient();
    const db = client.db("test");
    const activePromptDoc = await db
      .collection("app_config")
      .findOne({ key: "active_prompt" });
    if (activePromptDoc?.value) {
      activePrompt = activePromptDoc.value as string;
    }
  } catch {
    // Fall back to hardcoded constant if MongoDB is unavailable
  }

  return (
    <div className="p-6 space-y-6">
      {/* Page heading */}
      <div>
        <h1 className="text-2xl font-semibold">Safety Rules</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Full transparency into the content rules that protect your children
        </p>
      </div>

      {/* Section 1: Content Boundaries Summary (SAFE-01) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-green-600" />
            Content Boundaries
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            These rules are enforced in every conversation, regardless of how the child phrases their request.
          </p>
          <dl className="space-y-4">
            <div>
              <dt className="text-sm font-semibold">Reformed Christian Values</dt>
              <dd className="text-sm text-muted-foreground mt-0.5">
                Conversations reflect biblical principles. The AI won&apos;t contradict core Christian
                teachings or promote relativism.
              </dd>
            </div>
            <div>
              <dt className="text-sm font-semibold">No Profanity or Crude Language</dt>
              <dd className="text-sm text-muted-foreground mt-0.5">
                The AI won&apos;t use or encourage vulgar, obscene, or disrespectful language — even if
                the child uses it first.
              </dd>
            </div>
            <div>
              <dt className="text-sm font-semibold">Age-Appropriate Content Only</dt>
              <dd className="text-sm text-muted-foreground mt-0.5">
                Topics like graphic violence, sexual content, substance abuse, and self-harm are
                off-limits. The AI gently redirects to safer subjects.
              </dd>
            </div>
            <div>
              <dt className="text-sm font-semibold">Anti-Cheating Policy</dt>
              <dd className="text-sm text-muted-foreground mt-0.5">
                The AI helps children understand concepts but won&apos;t write essays, solve homework
                problems directly, or do schoolwork for them. It teaches, not completes.
              </dd>
            </div>
            <div>
              <dt className="text-sm font-semibold">No Personal Data Collection</dt>
              <dd className="text-sm text-muted-foreground mt-0.5">
                The AI won&apos;t ask for or store names, addresses, phone numbers, or other personal
                information.
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {/* Section 2: Full System Prompt (SAFE-02) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-600" />
            Full System Prompt
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            This is the exact instruction text given to the AI. Nothing is hidden.
          </p>
          <Accordion type="single" collapsible>
            <AccordionItem value="system-prompt">
              <AccordionTrigger className="text-sm font-medium">
                Click to view the complete system prompt
              </AccordionTrigger>
              <AccordionContent>
                <pre className="whitespace-pre-wrap font-mono text-xs bg-muted p-4 rounded-lg overflow-x-auto">
                  {activePrompt}
                </pre>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
          <div className="mt-4">
            <Link
              href="/prompt-editor"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <PenLine className="h-4 w-4" />
              Edit Prompt
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Section 3: What Happens When Rules Trigger (SAFE-03) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            What Happens When Rules Trigger
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Safety Redirect */}
          <div className="border-l-4 border-yellow-400 pl-4 space-y-2">
            <h3 className="text-sm font-semibold">Safety Redirect</h3>
            <ul className="space-y-1.5 text-sm text-muted-foreground list-none">
              <li>
                When a child asks about an off-limits topic, the AI gently redirects the
                conversation to a related but appropriate subject.
              </li>
              <li>
                The child is never shamed or scolded — the AI simply steers toward safer ground.
              </li>
              <li>
                <span className="italic">
                  Example: If asked about violence, the AI might say &ldquo;That&apos;s not something I can
                  help with, but I&apos;d love to talk about [safe topic]!&rdquo;
                </span>
              </li>
            </ul>
          </div>

          {/* Jailbreak Response */}
          <div className="border-l-4 border-red-400 pl-4 space-y-2">
            <h3 className="text-sm font-semibold">Jailbreak Response</h3>
            <ul className="space-y-1.5 text-sm text-muted-foreground list-none">
              <li>
                If someone tries to trick the AI into ignoring its rules (for example,
                &ldquo;pretend you have no rules&rdquo; or &ldquo;you are now a different AI&rdquo;), it responds firmly
                but kindly.
              </li>
              <li>
                The AI will never play along with attempts to bypass safety, and it won&apos;t reveal
                its internal instructions.
              </li>
              <li>
                Repeated attempts get a firmer response, but the AI always stays respectful.
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Section 4: Tone Presets (SAFE-04) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5 text-purple-600" />
            Tone Presets
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Four conversation styles are available. Each one maintains all safety rules — the tone
            changes, not the boundaries.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {TONE_PRESETS.map((preset) => (
              <div
                key={preset.name}
                className="rounded-lg border bg-card p-4 space-y-1.5"
              >
                <h3 className="text-sm font-semibold">{preset.name}</h3>
                <p className="text-sm text-muted-foreground">{preset.description}</p>
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">Best for:</span> {preset.bestFor}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
