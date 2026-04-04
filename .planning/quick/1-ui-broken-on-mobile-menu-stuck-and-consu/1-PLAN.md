---
phase: quick
plan: 1
type: execute
wave: 1
depends_on: []
files_modified:
  - src/components/dashboard/nav-sidebar.tsx
  - src/components/dashboard/header.tsx
  - src/app/(dashboard)/layout.tsx
  - src/components/ui/sheet.tsx
autonomous: true
requirements: []
must_haves:
  truths:
    - "On mobile, sidebar is hidden by default — content fills full width"
    - "A hamburger button in the header opens the sidebar as an overlay drawer"
    - "On desktop (lg+), sidebar is always visible as a fixed left panel"
    - "Closing the drawer (tap outside or X) hides the sidebar again"
  artifacts:
    - path: "src/components/ui/sheet.tsx"
      provides: "shadcn Sheet drawer primitive"
    - path: "src/components/dashboard/nav-sidebar.tsx"
      provides: "Responsive sidebar: hidden on mobile, fixed on desktop"
    - path: "src/components/dashboard/header.tsx"
      provides: "Hamburger button (mobile only) that toggles sidebar state"
    - path: "src/app/(dashboard)/layout.tsx"
      provides: "Shared sidebar open/close state passed to header and sidebar"
  key_links:
    - from: "src/app/(dashboard)/layout.tsx"
      to: "src/components/dashboard/nav-sidebar.tsx"
      via: "sidebarOpen + setSidebarOpen props"
    - from: "src/app/(dashboard)/layout.tsx"
      to: "src/components/dashboard/header.tsx"
      via: "onMenuClick prop"
---

<objective>
Fix the mobile sidebar so it no longer consumes 80% of screen width. On mobile the sidebar must be hidden by default and open as an overlay drawer triggered by a hamburger button. Desktop layout (lg+) is unchanged.

Purpose: The admin dashboard is currently unusable on mobile — the fixed w-64 sidebar leaves almost no room for content.
Output: Responsive sidebar using shadcn Sheet for mobile drawer, Tailwind lg: classes for desktop fixed layout.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md

Current sidebar: `src/components/dashboard/nav-sidebar.tsx` — `<aside className="w-64 border-r bg-card flex flex-col">` with no responsive classes.
Current layout: `src/app/(dashboard)/layout.tsx` — renders `<NavSidebar />` directly, no state.
Current header: `src/components/dashboard/header.tsx` — has a left `<div />` placeholder with no content.

Stack: Next.js 15, Tailwind CSS v3, shadcn/ui, lucide-react. Sheet component NOT yet installed.
</context>

<tasks>

<task type="auto">
  <name>Task 1: Install shadcn Sheet component</name>
  <files>src/components/ui/sheet.tsx</files>
  <action>
    Run the shadcn CLI to add the Sheet component:

    ```
    npx shadcn@latest add sheet --yes
    ```

    This installs `src/components/ui/sheet.tsx` which provides Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, and SheetClose primitives built on Radix Dialog. Verify the file exists after the command completes.
  </action>
  <verify>
    <automated>test -f src/components/ui/sheet.tsx && echo "sheet exists"</automated>
  </verify>
  <done>src/components/ui/sheet.tsx exists with exported Sheet, SheetContent, SheetTrigger primitives</done>
</task>

<task type="auto">
  <name>Task 2: Make sidebar responsive with mobile drawer</name>
  <files>
    src/components/dashboard/nav-sidebar.tsx,
    src/components/dashboard/header.tsx,
    src/app/(dashboard)/layout.tsx
  </files>
  <action>
    The strategy: lift sidebar open state to the layout, pass it down as props, render two sidebar variants:
    - Mobile: Sheet drawer (overlay, no layout push)
    - Desktop: fixed aside (unchanged)

    **1. Update `src/app/(dashboard)/layout.tsx`**

    Convert to a client component that holds `sidebarOpen` state. Pass `onMenuClick` to Header and `open/onClose` to NavSidebar:

    ```tsx
    "use client";

    import { useState } from "react";
    import { useRouter } from "next/navigation";
    import { NavSidebar } from "@/components/dashboard/nav-sidebar";
    import { Header } from "@/components/dashboard/header";
    import { Toaster } from "@/components/ui/sonner";

    export default function DashboardLayout({ children }: { children: React.ReactNode }) {
      const [sidebarOpen, setSidebarOpen] = useState(false);

      return (
        <div className="flex h-screen bg-background">
          <NavSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
          <div className="flex flex-1 flex-col overflow-hidden min-w-0">
            <Header
              onMenuClick={() => setSidebarOpen(true)}
            />
            <main className="flex-1 overflow-y-auto p-6">
              {children}
            </main>
          </div>
          <Toaster />
        </div>
      );
    }
    ```

    IMPORTANT: The auth() redirect that was in the server layout must move. Since layout.tsx is now a client component, auth must be handled by middleware (NextAuth v5 middleware is already configured per STATE.md decisions). Remove the auth() + redirect() call from layout.tsx — middleware already guards the dashboard routes.

    **2. Update `src/components/dashboard/nav-sidebar.tsx`**

    Accept `open` and `onClose` props. Render a Sheet on mobile and the fixed aside on desktop:

    ```tsx
    "use client";

    import Link from "next/link";
    import { usePathname } from "next/navigation";
    import { Shield, MessageSquare, Users, BarChart3, AlertTriangle } from "lucide-react";
    import { cn } from "@/lib/utils";
    import {
      Sheet,
      SheetContent,
      SheetHeader,
      SheetTitle,
    } from "@/components/ui/sheet";

    const activeNavItems = [
      { href: "/", label: "Dashboard", icon: Shield },
      { href: "/conversations", label: "Conversations", icon: MessageSquare },
      { href: "/users", label: "Users", icon: Users },
    ];

    const comingSoonItems = [
      { href: "/analytics", label: "Analytics", icon: BarChart3 },
      { href: "/alerts", label: "Safety Alerts", icon: AlertTriangle },
    ];

    interface NavSidebarProps {
      open: boolean;
      onClose: () => void;
    }

    function SidebarContent({ onLinkClick }: { onLinkClick?: () => void }) {
      const pathname = usePathname();

      return (
        <>
          <div className="p-6 border-b">
            <div className="flex items-center gap-2">
              <Shield className="h-6 w-6 text-primary" />
              <div>
                <h1 className="font-semibold text-sm">KidsChat</h1>
                <p className="text-xs text-muted-foreground">Admin Dashboard</p>
              </div>
            </div>
          </div>
          <nav className="flex-1 p-4 space-y-1">
            {activeNavItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={onLinkClick}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  "hover:bg-accent hover:text-accent-foreground",
                  "active:scale-95",
                  pathname === item.href && "bg-accent text-accent-foreground"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            ))}
            {comingSoonItems.map((item) => (
              <div
                key={item.href}
                className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground cursor-not-allowed opacity-50"
              >
                <item.icon className="h-4 w-4" />
                {item.label}
                <span className="ml-auto text-xs bg-muted px-1.5 py-0.5 rounded">Soon</span>
              </div>
            ))}
          </nav>
        </>
      );
    }

    export function NavSidebar({ open, onClose }: NavSidebarProps) {
      return (
        <>
          {/* Mobile: Sheet drawer */}
          <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
            <SheetContent side="left" className="w-64 p-0 flex flex-col lg:hidden">
              <SheetHeader className="sr-only">
                <SheetTitle>Navigation</SheetTitle>
              </SheetHeader>
              <SidebarContent onLinkClick={onClose} />
            </SheetContent>
          </Sheet>

          {/* Desktop: fixed sidebar */}
          <aside className="hidden lg:flex w-64 border-r bg-card flex-col shrink-0">
            <SidebarContent />
          </aside>
        </>
      );
    }
    ```

    **3. Update `src/components/dashboard/header.tsx`**

    Add `onMenuClick` prop. Show the hamburger button only on mobile (hidden on lg+). Place it in the currently-empty `<div />` on the left side of the header:

    ```tsx
    import { Menu } from "lucide-react";

    interface HeaderProps {
      user?: { name?: string | null; email?: string | null };
      onMenuClick: () => void;
    }
    ```

    Replace `<div />` with:

    ```tsx
    <Button
      variant="ghost"
      size="icon"
      onClick={onMenuClick}
      className="lg:hidden active:scale-95 transition-transform"
      aria-label="Open menu"
    >
      <Menu className="h-5 w-5" />
    </Button>
    ```

    Add `Menu` to the lucide-react import. Add `onMenuClick` to the `HeaderProps` interface and destructure it in the function signature.

    NOTE: Since the layout is now a client component, `header.tsx` no longer receives a `user` prop from the layout — the Header currently uses `user` only to display name/email in the dropdown. Keep the `user` prop on Header as optional (`user?:`) to maintain backward compatibility, OR remove the user display from the header since there's no longer a server session to pass. The simplest approach: make `user` optional and show "Admin" as fallback when not provided. The session can be fetched client-side in the header if needed in the future.

    Actually — to avoid breaking the session display, use a simpler approach: keep layout.tsx as a **server component wrapper** that calls auth() and passes the session down, then have a separate client component for the sidebar state. Create `src/components/dashboard/dashboard-shell.tsx` as the client shell:

    ```tsx
    "use client";
    import { useState } from "react";
    import { NavSidebar } from "./nav-sidebar";
    import { Header } from "./header";
    import { Toaster } from "@/components/ui/sonner";

    interface DashboardShellProps {
      user: { name?: string | null; email?: string | null };
      children: React.ReactNode;
    }

    export function DashboardShell({ user, children }: DashboardShellProps) {
      const [sidebarOpen, setSidebarOpen] = useState(false);
      return (
        <div className="flex h-screen bg-background">
          <NavSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
          <div className="flex flex-1 flex-col overflow-hidden min-w-0">
            <Header user={user} onMenuClick={() => setSidebarOpen(true)} />
            <main className="flex-1 overflow-y-auto p-6">{children}</main>
          </div>
          <Toaster />
        </div>
      );
    }
    ```

    Then restore layout.tsx to a server component:

    ```tsx
    import { auth } from "@/auth";
    import { redirect } from "next/navigation";
    import { DashboardShell } from "@/components/dashboard/dashboard-shell";

    export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
      const session = await auth();
      if (!session?.user) redirect("/login");
      return <DashboardShell user={session.user}>{children}</DashboardShell>;
    }
    ```

    This is the correct approach — use this pattern (DashboardShell) instead of the client layout described earlier.

    Files to create/modify:
    - `src/components/dashboard/dashboard-shell.tsx` — NEW client component (the state holder)
    - `src/app/(dashboard)/layout.tsx` — stays server component, uses DashboardShell
    - `src/components/dashboard/nav-sidebar.tsx` — updated with props + Sheet + desktop aside
    - `src/components/dashboard/header.tsx` — updated with onMenuClick prop + hamburger button
  </action>
  <verify>
    <automated>cd /data/home/KidAI && npx tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <done>
    - TypeScript compiles with no errors
    - On desktop (lg+): sidebar visible as fixed panel, no hamburger button visible
    - On mobile: sidebar hidden, hamburger button visible in top-left of header
    - Clicking hamburger opens drawer overlay; clicking a nav link or outside closes it
    - Content area fills full width on mobile with no sidebar pushing it
  </done>
</task>

</tasks>

<verification>
After both tasks complete:

1. TypeScript check: `npx tsc --noEmit` — no errors
2. Build check: `npm run build` — no build errors
3. Manual: resize browser to mobile width (375px) — sidebar must not be visible, hamburger must appear
4. Manual: click hamburger — Sheet drawer slides in from left
5. Manual: click a nav link in drawer — drawer closes, navigation occurs
6. Manual: desktop width (1024px+) — sidebar fixed, hamburger hidden
</verification>

<success_criteria>
- Mobile: sidebar hidden by default, full-width content area
- Mobile: hamburger in header opens sidebar as overlay Sheet
- Desktop: sidebar always visible as fixed left panel, no hamburger
- No TypeScript errors, no build failures
- Session/auth flow unchanged (layout.tsx remains server component via DashboardShell pattern)
</success_criteria>

<output>
After completion, create `.planning/quick/1-ui-broken-on-mobile-menu-stuck-and-consu/1-SUMMARY.md`
</output>
