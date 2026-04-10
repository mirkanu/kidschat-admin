"use client";

import { useTransition, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Loader2, Trash2 } from "lucide-react";
import {
  saveGlobalDefaults,
  saveChildOverride,
  deleteChildOverride,
} from "./actions";
import type { EffectiveLimits } from "@/lib/settings";

interface ChildOverride {
  userId: string;
  childName: string;
  override: Partial<EffectiveLimits> | null;
}

interface SettingsFormProps {
  globalDefaults: EffectiveLimits;
  childOverrides: ChildOverride[];
}

function FieldRow({
  label,
  name,
  value,
  type = "number",
  step,
  placeholder,
}: {
  label: string;
  name: string;
  value: string | number;
  type?: string;
  step?: string;
  placeholder?: string;
}) {
  return (
    <div className="grid grid-cols-3 items-center gap-4">
      <Label htmlFor={name} className="text-right text-sm text-muted-foreground">
        {label}
      </Label>
      <div className="col-span-2">
        <Input
          id={name}
          name={name}
          type={type}
          step={step}
          defaultValue={value}
          placeholder={placeholder}
          className="h-9"
        />
      </div>
    </div>
  );
}

export function SettingsForm({ globalDefaults, childOverrides }: SettingsFormProps) {
  const [globalPending, startGlobal] = useTransition();
  const [pendingChildId, setPendingChildId] = useState<string | null>(null);
  const [deletingChildId, setDeletingChildId] = useState<string | null>(null);

  function handleSaveGlobal(formData: FormData) {
    startGlobal(async () => {
      const result = await saveGlobalDefaults(formData);
      if (result.success) {
        toast.success("Global defaults saved");
      } else {
        toast.error(result.error ?? "Failed to save");
      }
    });
  }

  function handleSaveChild(userId: string, formData: FormData) {
    setPendingChildId(userId);
    Promise.resolve(saveChildOverride(userId, formData)).then((result) => {
      setPendingChildId(null);
      if (result.success) {
        toast.success("Override saved");
      } else {
        toast.error(result.error ?? "Failed to save override");
      }
    });
  }

  function handleDeleteChild(userId: string) {
    setDeletingChildId(userId);
    Promise.resolve(deleteChildOverride(userId)).then((result) => {
      setDeletingChildId(null);
      if (result.success) {
        toast.success("Override deleted — reverted to global defaults");
      } else {
        toast.error(result.error ?? "Failed to delete override");
      }
    });
  }

  return (
    <Tabs defaultValue="global" className="space-y-6">
      <TabsList>
        <TabsTrigger value="global">Global Defaults</TabsTrigger>
        <TabsTrigger value="per-child">
          Per-Child Overrides
          {childOverrides.filter((c) => c.override !== null).length > 0 && (
            <span className="ml-1.5 text-xs bg-primary text-primary-foreground rounded-full px-1.5 py-0.5">
              {childOverrides.filter((c) => c.override !== null).length}
            </span>
          )}
        </TabsTrigger>
      </TabsList>

      {/* Global Defaults Tab */}
      <TabsContent value="global">
        <form action={handleSaveGlobal} className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold">Usage Limits</h3>
              <p className="text-xs text-muted-foreground">
                Applied to all children unless overridden per-child.
              </p>
            </div>
            <Separator />
            <div className="space-y-3">
              <FieldRow label="Daily Image Limit" name="dailyImageLimit" value={globalDefaults.dailyImageLimit} step="1" />
              <FieldRow label="Daily Message Limit" name="dailyMessageLimit" value={globalDefaults.dailyMessageLimit} step="1" />
              <FieldRow label="Monthly Cost Cap (€)" name="monthlyCostCapEUR" value={globalDefaults.monthlyCostCapEUR} step="0.01" />
            </div>

            <div className="space-y-1 pt-2">
              <h3 className="text-sm font-semibold">Bonus Purchase Settings</h3>
              <p className="text-xs text-muted-foreground">
                Controls the bonus pack shown to children when they hit a limit.
              </p>
            </div>
            <Separator />
            <div className="space-y-3">
              <FieldRow label="Weekly Bonus Cap (€)" name="weeklyBonusCap" value={globalDefaults.weeklyBonusCap} step="0.01" />
              <FieldRow label="Bonus Pack Size (€)" name="bonusPackSize" value={globalDefaults.bonusPackSize} step="0.01" />
              <div className="grid grid-cols-3 items-start gap-4">
                <Label htmlFor="bonusMessageTemplate" className="text-right text-sm text-muted-foreground pt-2">
                  Offer Message
                </Label>
                <div className="col-span-2">
                  <Textarea
                    id="bonusMessageTemplate"
                    name="bonusMessageTemplate"
                    defaultValue={globalDefaults.bonusMessageTemplate}
                    rows={4}
                    className="text-sm resize-none"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Message shown to child when offering a bonus pack. Must include "Type YES to confirm."
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
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
        {childOverrides.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">
            No children found. Children appear here once they log in.
          </div>
        ) : (
          <div className="space-y-6">
            <p className="text-sm text-muted-foreground">
              Override specific limits for individual children. Leave fields blank to use the global default.
            </p>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-36">Child</TableHead>
                    <TableHead>Daily Images</TableHead>
                    <TableHead>Daily Messages</TableHead>
                    <TableHead>Monthly Cap (€)</TableHead>
                    <TableHead>Weekly Bonus Cap (€)</TableHead>
                    <TableHead className="w-24">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {childOverrides.map((child) => (
                    <TableRow key={child.userId}>
                      <TableCell className="font-medium text-sm">{child.childName}</TableCell>
                      <form
                        key={`form-${child.userId}`}
                        action={(formData) => handleSaveChild(child.userId, formData)}
                        className="contents"
                      >
                        <TableCell>
                          <Input
                            name="dailyImageLimit"
                            type="number"
                            step="1"
                            min="0"
                            defaultValue={child.override?.dailyImageLimit ?? ""}
                            placeholder={String(globalDefaults.dailyImageLimit)}
                            className="h-8 w-24 text-sm"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            name="dailyMessageLimit"
                            type="number"
                            step="1"
                            min="0"
                            defaultValue={child.override?.dailyMessageLimit ?? ""}
                            placeholder={String(globalDefaults.dailyMessageLimit)}
                            className="h-8 w-24 text-sm"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            name="monthlyCostCapEUR"
                            type="number"
                            step="0.01"
                            min="0"
                            defaultValue={child.override?.monthlyCostCapEUR ?? ""}
                            placeholder={String(globalDefaults.monthlyCostCapEUR)}
                            className="h-8 w-24 text-sm"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            name="weeklyBonusCap"
                            type="number"
                            step="0.01"
                            min="0"
                            defaultValue={child.override?.weeklyBonusCap ?? ""}
                            placeholder={String(globalDefaults.weeklyBonusCap)}
                            className="h-8 w-24 text-sm"
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              type="submit"
                              size="sm"
                              variant="outline"
                              disabled={pendingChildId === child.userId}
                              className="h-7 text-xs active:scale-95 transition-transform"
                            >
                              {pendingChildId === child.userId ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                "Save"
                              )}
                            </Button>
                            {child.override !== null && (
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                disabled={deletingChildId === child.userId}
                                onClick={() => handleDeleteChild(child.userId)}
                                className="h-7 w-7 p-0 text-destructive hover:text-destructive active:scale-95 transition-transform"
                                title="Delete override — revert to global defaults"
                              >
                                {deletingChildId === child.userId ? (
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
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}
