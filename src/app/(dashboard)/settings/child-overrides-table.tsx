"use client";

import { useTransition, useState } from "react";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveChildOverride, deleteChildOverride } from "./actions";
import type { ChildOverrideRow } from "./types";
import type { GlobalDefaults } from "@/lib/budget";

interface ChildOverridesTableProps {
  users: ChildOverrideRow[];
  globals: Pick<
    GlobalDefaults,
    "dailyCostCapEur" | "monthlyCostCapEur" | "bonusPackEur" | "weeklyBonusCapEur"
  >;
}

/**
 * OverrideRow — a single row rendered as an independent top-level <form>.
 *
 * Uses CSS grid (not a <table>) so each row can be a real <form> element.
 * <form> is NOT a valid child of <tr> per HTML spec — browsers discard or
 * hoist the form element, which breaks submission. Grid layout sidesteps
 * this entirely.
 *
 * userId is baked into the server action via closure
 * (saveChildOverride.bind(null, userId)) and is NEVER read from formData.
 * This eliminates the Plan 15-02 wiring bug at the type level.
 */
function OverrideRow({
  user,
  globals,
}: {
  user: ChildOverrideRow;
  globals: ChildOverridesTableProps["globals"];
}) {
  const [isPending, startTransition] = useTransition();
  const [isDeleting, startDeleteTransition] = useTransition();

  const [dailyCap, setDailyCap] = useState(
    user.override?.dailyCostCapEur != null
      ? String(user.override.dailyCostCapEur)
      : ""
  );
  const [monthlyCap, setMonthlyCap] = useState(
    user.override?.monthlyCostCapEur != null
      ? String(user.override.monthlyCostCapEur)
      : ""
  );
  const [bonusPack, setBonusPack] = useState(
    user.override?.bonusPackEur != null
      ? String(user.override.bonusPackEur)
      : ""
  );
  const [weeklyBonusCap, setWeeklyBonusCap] = useState(
    user.override?.weeklyBonusCapEur != null
      ? String(user.override.weeklyBonusCapEur)
      : ""
  );

  const boundSaveAction = saveChildOverride.bind(null, user.userId);

  function handleSave(formData: FormData) {
    startTransition(async () => {
      const result = await boundSaveAction(formData);
      if (result.ok) {
        toast.success(`Override saved for ${user.childName}`);
      } else {
        toast.error(result.error ?? "Failed to save override");
      }
    });
  }

  function handleDelete() {
    startDeleteTransition(async () => {
      const result = await deleteChildOverride(user.userId);
      if (result.ok) {
        setDailyCap("");
        setMonthlyCap("");
        setBonusPack("");
        setWeeklyBonusCap("");
        toast.success(
          `Override deleted for ${user.childName} — using global defaults`
        );
      } else {
        toast.error(result.error ?? "Failed to delete override");
      }
    });
  }

  const hasOverride =
    dailyCap !== "" ||
    monthlyCap !== "" ||
    bonusPack !== "" ||
    weeklyBonusCap !== "";

  return (
    <form
      action={handleSave}
      className="grid grid-cols-[9rem_1fr_1fr_1fr_1fr_7rem] items-center gap-2 border-t px-3 py-2 first:border-t-0"
    >
      <div className="text-sm font-medium truncate">{user.childName}</div>
      <div>
        <Input
          name="dailyCostCapEur"
          type="number"
          step="0.001"
          min="0"
          value={dailyCap}
          onChange={(e) => setDailyCap(e.target.value)}
          placeholder={String(globals.dailyCostCapEur)}
          className="h-8 text-sm"
          disabled={isPending}
        />
      </div>
      <div>
        <Input
          name="monthlyCostCapEur"
          type="number"
          step="0.01"
          min="0"
          value={monthlyCap}
          onChange={(e) => setMonthlyCap(e.target.value)}
          placeholder={String(globals.monthlyCostCapEur)}
          className="h-8 text-sm"
          disabled={isPending}
        />
      </div>
      <div>
        <Input
          name="bonusPackEur"
          type="number"
          step="0.01"
          min="0"
          value={bonusPack}
          onChange={(e) => setBonusPack(e.target.value)}
          placeholder={String(globals.bonusPackEur)}
          className="h-8 text-sm"
          disabled={isPending}
        />
      </div>
      <div>
        <Input
          name="weeklyBonusCapEur"
          type="number"
          step="0.01"
          min="0"
          value={weeklyBonusCap}
          onChange={(e) => setWeeklyBonusCap(e.target.value)}
          placeholder={String(globals.weeklyBonusCapEur)}
          className="h-8 text-sm"
          disabled={isPending}
        />
      </div>
      <div className="flex items-center gap-1 justify-end">
        <Button
          type="submit"
          size="sm"
          variant="outline"
          disabled={isPending || isDeleting}
          className="h-7 text-xs active:scale-95 transition-transform"
        >
          {isPending ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            "Save"
          )}
        </Button>
        {hasOverride && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={isPending || isDeleting}
            onClick={handleDelete}
            className="h-7 w-7 p-0 text-destructive hover:text-destructive active:scale-95 transition-transform"
            title={`Delete override for ${user.childName} — revert to global defaults`}
          >
            {isDeleting ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Trash2 className="h-3 w-3" />
            )}
          </Button>
        )}
      </div>
    </form>
  );
}

export function ChildOverridesTable({
  users,
  globals,
}: ChildOverridesTableProps) {
  if (users.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        No children found. Children appear here once they log in.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Override specific limits for individual children. Leave fields blank to
        use the global default (shown as placeholder).
      </p>
      <div className="rounded-md border">
        {/* Header row — matches the form grid template */}
        <div className="grid grid-cols-[9rem_1fr_1fr_1fr_1fr_7rem] items-center gap-2 px-3 py-2 bg-muted/50 text-xs font-medium text-muted-foreground">
          <div>Child</div>
          <div>Daily cap (€)</div>
          <div>Monthly cap (€)</div>
          <div>Bonus pack (€)</div>
          <div>Weekly bonus cap (€)</div>
          <div className="text-right">Actions</div>
        </div>
        {users.map((user) => (
          <OverrideRow key={user.userId} user={user} globals={globals} />
        ))}
      </div>
    </div>
  );
}
