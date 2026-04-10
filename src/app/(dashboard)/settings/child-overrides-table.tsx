"use client";

import { useTransition, useState } from "react";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
 * ChildOverrideRow — a single row in the per-child overrides table.
 *
 * Each row is an INDEPENDENT <form> bound to saveChildOverride.bind(null, userId)
 * (server action closure pattern). This means:
 * - userId is NEVER read from formData (eliminates the Plan 15-02 wiring bug)
 * - Each row has its own useTransition state (only that row shows pending)
 * - Saving one row does not affect other rows
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

  // Controlled state initialized from the override prop
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

  // Closure: userId baked in at bind time — NEVER from formData
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
        // Reset local state to empty (shows global as placeholder)
        setDailyCap("");
        setMonthlyCap("");
        setBonusPack("");
        setWeeklyBonusCap("");
        toast.success(`Override deleted for ${user.childName} — using global defaults`);
      } else {
        toast.error(result.error ?? "Failed to delete override");
      }
    });
  }

  const hasOverride =
    dailyCap !== "" || monthlyCap !== "" || bonusPack !== "" || weeklyBonusCap !== "";

  return (
    <TableRow>
      <TableCell className="font-medium text-sm">{user.childName}</TableCell>
      {/* Each row is its own independent <form> — critical for the wiring fix */}
      <form action={handleSave} className="contents">
        <TableCell>
          <Input
            name="dailyCostCapEur"
            type="number"
            step="0.001"
            min="0"
            value={dailyCap}
            onChange={(e) => setDailyCap(e.target.value)}
            placeholder={String(globals.dailyCostCapEur)}
            className="h-8 w-28 text-sm"
            disabled={isPending}
          />
        </TableCell>
        <TableCell>
          <Input
            name="monthlyCostCapEur"
            type="number"
            step="0.01"
            min="0"
            value={monthlyCap}
            onChange={(e) => setMonthlyCap(e.target.value)}
            placeholder={String(globals.monthlyCostCapEur)}
            className="h-8 w-28 text-sm"
            disabled={isPending}
          />
        </TableCell>
        <TableCell>
          <Input
            name="bonusPackEur"
            type="number"
            step="0.01"
            min="0"
            value={bonusPack}
            onChange={(e) => setBonusPack(e.target.value)}
            placeholder={String(globals.bonusPackEur)}
            className="h-8 w-24 text-sm"
            disabled={isPending}
          />
        </TableCell>
        <TableCell>
          <Input
            name="weeklyBonusCapEur"
            type="number"
            step="0.01"
            min="0"
            value={weeklyBonusCap}
            onChange={(e) => setWeeklyBonusCap(e.target.value)}
            placeholder={String(globals.weeklyBonusCapEur)}
            className="h-8 w-24 text-sm"
            disabled={isPending}
          />
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-1">
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
        </TableCell>
      </form>
    </TableRow>
  );
}

export function ChildOverridesTable({ users, globals }: ChildOverridesTableProps) {
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
        Override specific limits for individual children. Leave fields blank to use the global default (shown as placeholder).
      </p>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-36">Child</TableHead>
              <TableHead>Daily cap (€)</TableHead>
              <TableHead>Monthly cap (€)</TableHead>
              <TableHead>Bonus pack (€)</TableHead>
              <TableHead>Weekly bonus cap (€)</TableHead>
              <TableHead className="w-28">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <OverrideRow key={user.userId} user={user} globals={globals} />
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
