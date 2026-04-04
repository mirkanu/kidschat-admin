---
phase: quick-2
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/app/(dashboard)/conversations/page.tsx
  - src/app/(dashboard)/conversations/[conversationId]/page.tsx
autonomous: true
must_haves:
  truths:
    - "Admin can load /conversations without server error"
    - "Admin can load /conversations/[id] and see message thread"
    - "Client-side search/filter still works via API routes"
  artifacts:
    - path: "src/app/(dashboard)/conversations/page.tsx"
      provides: "Conversations list page with direct MongoDB query"
    - path: "src/app/(dashboard)/conversations/[conversationId]/page.tsx"
      provides: "Conversation detail page with direct MongoDB query"
  key_links:
    - from: "src/app/(dashboard)/conversations/page.tsx"
      to: "MongoDB conversations collection"
      via: "getMongoClient() direct query"
      pattern: "getMongoClient.*aggregate"
    - from: "src/app/(dashboard)/conversations/[conversationId]/page.tsx"
      to: "MongoDB conversations + messages collections"
      via: "getMongoClient() direct query"
      pattern: "getMongoClient.*findOne|find"
---

<objective>
Fix server error on admin conversation pages caused by server components fetching their own API routes without forwarding auth cookies.

Purpose: Server components call `fetch(baseUrl/api/conversations/...)` but don't forward cookies, so auth() returns null in the API route, which returns 401/HTML, and `res.json()` blows up parsing HTML as JSON.

Output: Both server components query MongoDB directly via `getMongoClient()`, eliminating the self-referencing fetch entirely.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@src/app/api/conversations/route.ts (reference — copy aggregation pipeline from here)
@src/app/api/conversations/[conversationId]/route.ts (reference — copy query logic from here)
@src/lib/mongodb.ts (getMongoClient import)

<interfaces>
From src/lib/mongodb.ts:
```typescript
export default function getMongoClient(): Promise<MongoClient>;
```

From src/app/api/conversations/route.ts (aggregation pipeline to copy):
- $lookup joining users by $toString on _id matching conversations.user string
- $unwind with preserveNullAndEmptyArrays
- $sort by updatedAt desc, $limit 100
- $project returning conversationId, title, updatedAt, createdAt, userName, userEmail

From src/app/api/conversations/[conversationId]/route.ts (queries to copy):
- db.collection("conversations").findOne({ conversationId })
- db.collection("messages").find({ conversationId }).sort({ createdAt: 1 })
- Message serialization: messageId, text, isCreatedByUser, sender, createdAt
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Refactor conversations list page to use direct MongoDB query</name>
  <files>src/app/(dashboard)/conversations/page.tsx</files>
  <action>
Replace the `getConversations()` function that fetches from `/api/conversations` with a direct MongoDB query using `getMongoClient()`.

1. Add import: `import getMongoClient from "@/lib/mongodb";`
2. Remove the `fetch(baseUrl/api/conversations)` call entirely
3. Rewrite `getConversations()` to:
   - Call `const client = await getMongoClient(); const db = client.db("test");`
   - Run the same aggregation pipeline from `src/app/api/conversations/route.ts`:
     - $lookup joining users collection (let: { userId: "$user" }, match $expr $eq $toString $_id to $$userId)
     - $unwind userInfo with preserveNullAndEmptyArrays
     - $sort updatedAt -1, $limit 100
     - $project: conversationId, title, updatedAt, createdAt, userName from userInfo.name, userEmail from userInfo.email
   - Serialize dates: map updatedAt to ISO string or null
   - Return the conversations array
4. Remove the `process.env.NEXTAUTH_URL` reference (no longer needed)
5. Keep the ConversationSummary interface, the auth() check, childNames derivation, and JSX unchanged

Do NOT pass search/child filters in the server component — initial load shows all conversations. Client-side filtering via the API route is handled by ConversationsList component separately.
  </action>
  <verify>
    <automated>cd /data/home/KidAI && npx tsc --noEmit src/app/\(dashboard\)/conversations/page.tsx 2>&1 | head -20</automated>
  </verify>
  <done>Conversations list page queries MongoDB directly. No self-referencing fetch. TypeScript compiles without errors.</done>
</task>

<task type="auto">
  <name>Task 2: Refactor conversation detail page to use direct MongoDB query</name>
  <files>src/app/(dashboard)/conversations/[conversationId]/page.tsx</files>
  <action>
Replace the `fetch(baseUrl/api/conversations/${conversationId})` call with direct MongoDB queries using `getMongoClient()`.

1. Add import: `import getMongoClient from "@/lib/mongodb";`
2. Remove the `fetch()` call and `baseUrl` / `process.env.NEXTAUTH_URL` reference
3. After the auth check and params extraction, query MongoDB directly:
   - `const client = await getMongoClient(); const db = client.db("test");`
   - `const conversation = await db.collection("conversations").findOne({ conversationId });`
   - If !conversation, render the existing "not found" JSX (keep as-is)
   - `const rawMessages = await db.collection("messages").find({ conversationId }).sort({ createdAt: 1 }).toArray();`
   - Map rawMessages to MessageItem[] using the same serialization from the API route:
     - messageId: msg.messageId ?? msg._id.toString()
     - text: msg.text ?? ""
     - isCreatedByUser: Boolean(msg.isCreatedByUser)
     - sender: msg.sender ?? "Unknown"
     - createdAt: msg.createdAt instanceof Date ? msg.createdAt.toISOString() : String(msg.createdAt ?? "")
   - Build conversationDetail: { conversationId: conversation.conversationId ?? conversationId, title: conversation.title ?? "Untitled Conversation" }
4. Pass conversationDetail and messages to MessageThread component (same props as before)
5. Keep MessageItem and ConversationDetailData interfaces, auth check, not-found JSX, and final JSX unchanged

Note: You will need `import { ObjectId } from "mongodb"` only if referencing _id — but since we use msg._id.toString() which is already on the document object, the standard mongodb driver types should suffice without explicit ObjectId import.
  </action>
  <verify>
    <automated>cd /data/home/KidAI && npx tsc --noEmit src/app/\(dashboard\)/conversations/\[conversationId\]/page.tsx 2>&1 | head -20</automated>
  </verify>
  <done>Conversation detail page queries MongoDB directly. No self-referencing fetch. TypeScript compiles without errors.</done>
</task>

</tasks>

<verification>
```bash
# Full type check
cd /data/home/KidAI && npx tsc --noEmit 2>&1 | tail -5

# Build check (catches runtime issues in server components)
cd /data/home/KidAI && npm run build 2>&1 | tail -20

# Verify API routes still exist and unchanged (for client-side use)
grep -l "NextResponse.json" src/app/api/conversations/route.ts src/app/api/conversations/\[conversationId\]/route.ts

# Verify no more self-referencing fetch in server components
grep -r "fetch.*api/conversations" src/app/\(dashboard\)/conversations/ && echo "FAIL: still has self-fetch" || echo "PASS: no self-fetch"
```
</verification>

<success_criteria>
- Both conversation pages load without SyntaxError in production (no HTML-as-JSON parsing)
- `npm run build` succeeds
- API routes remain unchanged for client-side ConversationsList search/filter
- No self-referencing fetch calls remain in server components
</success_criteria>

<output>
After completion, create `.planning/quick/2-fix-admin-conversation-page-server-error/2-SUMMARY.md`
</output>
