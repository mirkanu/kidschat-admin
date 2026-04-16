# Phase 19 Plan 02 — MongoDB Evidence

**Date:** 2026-04-16
**Task:** Task 3 — Update live MongoDB settings.global_defaults to dailyCostCapEur=0.50

---

## Before

### settings doc {key: "global_defaults"}

```json
{
  "_id": "global_defaults",
  "key": "global_defaults",
  "dailyCostCapEur": 0.2,
  "monthlyCostCapEur": 2
}
```

### settings docs {key: "child_override"} (all)

```json
[]
```

No per-child overrides existed at the time of this update.

---

## Update Operation

```
db.settings.updateOne({key: "global_defaults"}, {$set: {dailyCostCapEur: 0.50}})
matchedCount: 1
modifiedCount: 1
```

---

## After

### settings doc {key: "global_defaults"}

```json
{
  "_id": "global_defaults",
  "key": "global_defaults",
  "dailyCostCapEur": 0.5,
  "monthlyCostCapEur": 2
}
```

monthlyCostCapEur is unchanged at 2 (was 2 before, still 2 after).

---

## Overrides Before / After

No child_override documents existed before the update. No child_override documents were created or modified. The child_override collection query returned `[]` both before and after.

---

## getEffectiveBudget Live Check

Script: `scripts/19-02-check-effective-budget.ts`
Run date: 2026-04-16

### Sebastian (userId: 69d0315763d6125f1f553e97)

```json
{
  "dailyCostCapEur": 0.5,
  "monthlyCostCapEur": 2
}
```

No per-child override. Global default (0.50) is the effective value. Precedence: global_defaults wins over HARDCODED_DEFAULTS. Confirmed correct.

### Penelope (userId: 69d0315763d6125f1f553e98)

```json
{
  "dailyCostCapEur": 0.5,
  "monthlyCostCapEur": 2
}
```

No per-child override. Global default (0.50) is the effective value. Confirmed correct.

---

## Precedence Verification

The `getEffectiveBudget` merge order is: `child_override > global_defaults > HARDCODED_DEFAULTS`.

- No child_override docs exist → global_defaults wins.
- global_defaults.dailyCostCapEur = 0.50 → both children show 0.50.
- HARDCODED_DEFAULTS.dailyCostCapEur = 0.50 (updated in Task 1) → consistent fallback.
- monthlyCostCapEur = 2.00 throughout all layers → unchanged.

If a child_override with dailyCostCapEur is created for either child in the future, it will win over the 0.50 global default per the `??` chain in getEffectiveBudget.
