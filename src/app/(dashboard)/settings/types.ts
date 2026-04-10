import type { ChildOverride } from "@/lib/budget";

/**
 * Shared types for the /settings page components.
 */

export interface ChildOverrideRow {
  userId: string;
  childName: string;
  override: Partial<Omit<ChildOverride, "key" | "userId">> | null;
}
