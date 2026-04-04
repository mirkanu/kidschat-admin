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
