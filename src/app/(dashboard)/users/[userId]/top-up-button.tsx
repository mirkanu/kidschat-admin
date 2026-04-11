"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { topUpChildBalance } from "./actions";

const DEFAULT_AMOUNT_EUR = 0.10;

export function TopUpButton({ userId, childName }: { userId: string; childName: string }) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await topUpChildBalance(userId, DEFAULT_AMOUNT_EUR);
      if (result.ok) {
        toast.success(
          `Topped up €${DEFAULT_AMOUNT_EUR.toFixed(2)} for ${childName}` +
          (result.newBalanceEur != null ? ` (new balance €${result.newBalanceEur.toFixed(2)})` : "")
        );
      } else {
        toast.error(result.error ?? "Failed to top up");
      }
    });
  }

  return (
    <Button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className="active:scale-95 transition-transform"
    >
      {isPending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Topping up…
        </>
      ) : (
        <>
          <Plus className="mr-2 h-4 w-4" />
          Top up €{DEFAULT_AMOUNT_EUR.toFixed(2)}
        </>
      )}
    </Button>
  );
}
