"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ReviewSection {
  id: string;
  status: "PASS" | "FAIL";
  reason: string;
}

interface ReviewResult {
  sections: ReviewSection[];
  overall: "PASS" | "FAIL" | "ERROR";
  summary: string;
}

interface RollbackEntry {
  hasHistory: boolean;
  entry?: {
    previousPrompt: string;
    deployedPrompt: string;
    deployedAt: string;
    deployedBy: string;
  };
}

interface PromptEditorClientProps {
  initialPrompt: string;
  hardcodedPrompt: string;
}

export function PromptEditorClient({
  initialPrompt,
  hardcodedPrompt,
}: PromptEditorClientProps) {
  const router = useRouter();

  const [draft, setDraft] = useState(initialPrompt);
  const [reviewResult, setReviewResult] = useState<ReviewResult | null>(null);
  const [isReviewing, setIsReviewing] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);
  const [showDeployModal, setShowDeployModal] = useState(false);
  const [deploySuccess, setDeploySuccess] = useState<{
    deployedAt: string;
  } | null>(null);
  const [rollbackEntry, setRollbackEntry] = useState<RollbackEntry | null>(
    null
  );
  const [isRollingBack, setIsRollingBack] = useState(false);

  // Load rollback availability on mount
  useEffect(() => {
    async function fetchHistory() {
      try {
        const res = await fetch("/api/prompt-editor/history");
        if (res.ok) {
          const data = await res.json();
          setRollbackEntry(data);
        }
      } catch {
        // Non-fatal — rollback section just won't show
      }
    }
    fetchHistory();
  }, []);

  const hasChanges = draft !== initialPrompt;

  async function handleReview() {
    setIsReviewing(true);
    setReviewResult(null);
    try {
      const res = await fetch("/api/prompt-editor/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draft }),
      });
      if (!res.ok) {
        throw new Error(`Review failed: ${res.status}`);
      }
      const data: ReviewResult = await res.json();
      setReviewResult(data);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "AI review failed. Please retry."
      );
    } finally {
      setIsReviewing(false);
    }
  }

  function handleTestInSandbox() {
    sessionStorage.setItem("draft-prompt", draft);
    window.open("/test-mode", "_blank");
  }

  function handleReset() {
    setDraft(initialPrompt);
    setReviewResult(null);
  }

  async function handleDeploy() {
    setIsDeploying(true);
    try {
      const res = await fetch("/api/prompt-editor/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draft }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Deploy failed: ${res.status}`);
      }
      setDeploySuccess({ deployedAt: data.deployedAt });
      setShowDeployModal(false);
      // Refresh rollback availability
      const histRes = await fetch("/api/prompt-editor/history");
      if (histRes.ok) {
        setRollbackEntry(await histRes.json());
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Deploy failed. Please retry."
      );
    } finally {
      setIsDeploying(false);
      setShowDeployModal(false);
    }
  }

  async function handleRollback() {
    setIsRollingBack(true);
    try {
      const res = await fetch("/api/prompt-editor/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "rollback" }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Rollback failed: ${res.status}`);
      }
      toast.success("Previous version restored. Reloading...");
      // Reload to reflect rolled-back prompt
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Rollback failed. Please retry."
      );
    } finally {
      setIsRollingBack(false);
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Page heading */}
      <div>
        <h1 className="text-2xl font-semibold">Prompt Editor</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Edit, review, and deploy the system prompt
        </p>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: editor */}
        <div className="lg:col-span-2 space-y-3">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="font-mono text-sm min-h-[400px] resize-y"
            placeholder="Enter system prompt..."
            spellCheck={false}
          />

          {/* Character count */}
          <p className="text-xs text-muted-foreground">
            {draft.length.toLocaleString()} characters
          </p>

          {/* Button row */}
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={handleReview}
              disabled={isReviewing}
              className="bg-violet-600 hover:bg-violet-700 text-white"
            >
              {isReviewing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Reviewing...
                </>
              ) : (
                "AI Review"
              )}
            </Button>

            <Button variant="secondary" onClick={handleTestInSandbox}>
              Test in Sandbox
            </Button>

            <Button
              variant="destructive"
              onClick={() => setShowDeployModal(true)}
              disabled={!hasChanges || isDeploying}
            >
              {isDeploying ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deploying...
                </>
              ) : (
                "Deploy to Gist"
              )}
            </Button>

            <Button
              variant="ghost"
              onClick={handleReset}
              disabled={!hasChanges}
            >
              Reset
            </Button>
          </div>
        </div>

        {/* Right column: review results + status panels */}
        <div className="space-y-4">
          {/* Redeploy banner */}
          {deploySuccess && (
            <Card className="border-amber-400 bg-amber-50 dark:bg-amber-950/30">
              <CardContent className="pt-4">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                      System prompt deployed to Gist
                    </p>
                    <p className="text-xs text-amber-700 dark:text-amber-400">
                      Redeploy LibreChat to activate changes for children.
                    </p>
                    <p className="text-xs text-amber-600 dark:text-amber-500">
                      Deployed at{" "}
                      {new Date(deploySuccess.deployedAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* AI Review Results */}
          {reviewResult && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  AI Review Results
                  <Badge
                    variant={
                      reviewResult.overall === "PASS" ? "default" : "destructive"
                    }
                    className={
                      reviewResult.overall === "PASS"
                        ? "bg-green-600 hover:bg-green-700"
                        : ""
                    }
                  >
                    {reviewResult.overall}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  {reviewResult.summary}
                </p>
                <ul className="space-y-2">
                  {reviewResult.sections.map((section) => (
                    <li key={section.id} className="flex items-start gap-2">
                      {section.status === "PASS" ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                      )}
                      <div className="space-y-0.5">
                        <p className="text-xs font-semibold">{section.id}</p>
                        <p className="text-xs text-muted-foreground">
                          {section.reason}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Rollback section */}
          {rollbackEntry?.hasHistory && rollbackEntry.entry && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Rollback Available</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Previous version from{" "}
                  {new Date(rollbackEntry.entry.deployedAt).toLocaleDateString()}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRollback}
                  disabled={isRollingBack}
                  className="w-full"
                >
                  {isRollingBack ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Restoring...
                    </>
                  ) : (
                    <>
                      <RotateCcw className="mr-2 h-4 w-4" />
                      Restore Previous Version
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Hardcoded fallback info */}
          {draft === hardcodedPrompt && (
            <Card className="border-dashed">
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">
                  Showing the built-in default prompt. No custom version has been
                  deployed yet.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Deploy confirmation modal */}
      <AlertDialog open={showDeployModal} onOpenChange={setShowDeployModal}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deploy System Prompt?</AlertDialogTitle>
            <AlertDialogDescription>
              This will update the system prompt in GitHub Gist. The change will
              take effect after LibreChat is redeployed. The current version will
              be saved for rollback.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeploying}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeploy}
              disabled={isDeploying}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeploying ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deploying...
                </>
              ) : (
                "Deploy"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
