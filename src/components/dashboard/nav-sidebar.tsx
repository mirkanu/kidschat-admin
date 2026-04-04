"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Shield, MessageSquare, Users, BarChart3, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Dashboard", icon: Shield, active: true },
  { href: "/conversations", label: "Conversations", icon: MessageSquare, active: true },
  { href: "/users", label: "Users", icon: Users, active: true },
  { href: "/analytics", label: "Analytics", icon: BarChart3, active: false, soon: true },
  { href: "/alerts", label: "Safety Alerts", icon: AlertTriangle, active: false, soon: true },
];

export function NavSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 border-r bg-card flex flex-col">
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
        {navItems.map((item) => (
          <div key={item.href} className="relative">
            {item.active ? (
              <Link
                href={item.href}
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
            ) : (
              <div className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground cursor-not-allowed opacity-50">
                <item.icon className="h-4 w-4" />
                {item.label}
                <span className="ml-auto text-xs bg-muted px-1.5 py-0.5 rounded">Soon</span>
              </div>
            )}
          </div>
        ))}
      </nav>
    </aside>
  );
}
// cache-bust: 1775307357
