"use client";

import { useTransition, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { saveGlobalDefaults } from "./actions";
import { ChildOverridesTable } from "./child-overrides-table";
import type { GlobalDefaults } from "@/lib/budget";
import type { ChildOverrideRow } from "./types";

interface SettingsFormProps {
  globals: GlobalDefaults;
  overrides: ChildOverrideRow[];
  lastUpdated?: string | null;
}

function NumberFieldRow({
  label,
  name,
  defaultValue,
  step = "0.01",
  min = "0",
}: {
  label: string;
  name: string;
  defaultValue: number;
  step?: string;
  min?: string;
}) {
  return (
    <div className="grid grid-cols-3 items-center gap-4">
      <Label
        htmlFor={name}
        className="text-right text-sm text-muted-foreground"
      >
        {label}
      </Label>
      <div className="col-span-2">
        <Input
          id={name}
          name={name}
          type="number"
          step={step}
          min={min}
          defaultValue={defaultValue}
          className="h-9"
        />
      </div>
    </div>
  );
}

export function SettingsForm({ globals, overrides, lastUpdated }: SettingsFormProps) {
  const [globalPending, startGlobal] = useTransition();
  const [lastSaved, setLastSaved] = useState<string | null>(
    lastUpdated ?? null
  );

  function handleSaveGlobal(formData: FormData) {
    startGlobal(async () => {
      const result = await saveGlobalDefaults(formData);
      if (result.ok) {
        const now = new Date().toLocaleTimeString();
        setLastSaved(now);
        toast.success("Global defaults saved");
      } else {
        toast.error(result.error ?? "Failed to save");
      }
    });
  }

  const activeOverrideCount = overrides.filter(
    (o) => o.override !== null
  ).length;

  return (
    <Tabs defaultValue="global" className="space-y-6">
      <TabsList>
        <TabsTrigger value="global">Global Defaults</TabsTrigger>
        <TabsTrigger value="per-child">
          Per-Child Overrides
          {activeOverrideCount > 0 && (
            <span className="ml-1.5 text-xs bg-primary text-primary-foreground rounded-full px-1.5 py-0.5">
              {activeOverrideCount}
            </span>
          )}
        </TabsTrigger>
      </TabsList>

      {/* Global Defaults Tab */}
      <TabsContent value="global">
        <form action={handleSaveGlobal} className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold">Cost Caps</h3>
              <p className="text-xs text-muted-foreground">
                Applied to all children unless overridden per-child.
              </p>
            </div>
            <Separator />
            <div className="space-y-3">
              <NumberFieldRow
                label="Daily cap (€)"
                name="dailyCostCapEur"
                defaultValue={globals.dailyCostCapEur}
                step="0.001"
              />
              <NumberFieldRow
                label="Monthly cap (€)"
                name="monthlyCostCapEur"
                defaultValue={globals.monthlyCostCapEur}
                step="0.01"
              />
            </div>

            <div className="space-y-1 pt-2">
              <h3 className="text-sm font-semibold">Bonus Purchase Settings</h3>
              <p className="text-xs text-muted-foreground">
                Controls the bonus pack shown to children when they hit their daily cap.
              </p>
            </div>
            <Separator />
            <div className="space-y-3">
              <NumberFieldRow
                label="Bonus pack (€)"
                name="bonusPackEur"
                defaultValue={globals.bonusPackEur}
                step="0.01"
              />
              <NumberFieldRow
                label="Weekly bonus cap (€)"
                name="weeklyBonusCapEur"
                defaultValue={globals.weeklyBonusCapEur}
                step="0.01"
              />
              <div className="grid grid-cols-3 items-start gap-4">
                <Label
                  htmlFor="bonusMessageTemplate"
                  className="text-right text-sm text-muted-foreground pt-2"
                >
                  Offer message
                </Label>
                <div className="col-span-2">
                  <Textarea
                    id="bonusMessageTemplate"
                    name="bonusMessageTemplate"
                    defaultValue={globals.bonusMessageTemplate}
                    rows={4}
                    maxLength={500}
                    className="text-sm resize-none"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Message shown to child when offering a bonus pack. Type YES to confirm is added automatically.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            {lastSaved ? (
              <p className="text-xs text-muted-foreground">
                Last saved: {lastSaved}
              </p>
            ) : (
              <span />
            )}
            <Button
              type="submit"
              disabled={globalPending}
              className="active:scale-95 transition-transform"
            >
              {globalPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                "Save Global Defaults"
              )}
            </Button>
          </div>
        </form>
      </TabsContent>

      {/* Per-Child Overrides Tab */}
      <TabsContent value="per-child">
        <ChildOverridesTable users={overrides} globals={globals} />
      </TabsContent>
    </Tabs>
  );
}
