"use client";

import { useState } from "react";
import { NavSidebar } from "./nav-sidebar";
import { Header } from "./header";
import { Toaster } from "@/components/ui/sonner";
import { AdminChatWidget } from "./admin-chat-widget";

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
      <AdminChatWidget />
    </div>
  );
}
