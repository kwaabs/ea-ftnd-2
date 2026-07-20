"use client";

import type React from "react";

import { usePathname } from "next/navigation";
import { useUserStore } from "@/stores/user-store";
import { Header } from "./header";
import { Sidebar } from "./sidebar";
import { useSidebarStore } from "@/stores/sidebar-store";
import { cn } from "@/lib/utils";
import { CommentsSheet } from "@/components/comments/comments-sheet";
import { useCommentsSheetStore } from "@/stores/comments-sheet-store";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useUserStore();
  const { isCollapsed } = useSidebarStore();
  const { isOpen: commentsOpen, close: closeCommentsSheet } =
    useCommentsSheetStore();
  const pathname = usePathname();
  const isDashboard = pathname === "/dashboard";

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div
      className={cn(
        isDashboard ? "h-dvh overflow-hidden" : "min-h-screen",
        "bg-background",
      )}
    >
      <Sidebar />
      <div
        className={cn(
          "transition-all duration-300",
          isCollapsed ? "ml-16" : "ml-64",
          isDashboard && "h-dvh flex flex-col",
        )}
      >
        <Header />
        <main
          className={cn(
            "bg-zinc-100",
            isDashboard
              ? "flex-1 min-h-0 overflow-hidden px-4 pt-4 pb-3"
              : "p-6",
          )}
        >
          {children}
        </main>
      </div>
      <CommentsSheet open={commentsOpen} onClose={closeCommentsSheet} />
    </div>
  );
}
