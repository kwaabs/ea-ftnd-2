"use client";

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Announcement } from "@/hooks/api/use-announcements-api";
import { RichAnnouncementBody } from "@/components/dashboard/rich-announcement-body";

const SEEN_KEY = "ecg-seen-special-announcements";

function loadSeenIds(): Set<string> {
  try {
    const raw = window.localStorage.getItem(SEEN_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function saveSeenIds(ids: Set<string>) {
  try {
    window.localStorage.setItem(SEEN_KEY, JSON.stringify(Array.from(ids)));
  } catch {
    // Private browsing / storage disabled — worst case the dialog
    // auto-opens again next visit, which isn't a correctness problem.
  }
}

interface SpecialAnnouncementsDialogProps {
  announcements: Announcement[];
  compact?: boolean;
}

/**
 * A separate, higher-visibility channel for announcements marked "special"
 * (internal/announcements Kind field) — pulled out of the regular marquee
 * rotation entirely so an urgent notice can't get lost among ordinary ones.
 * Auto-opens once per browser the first time a given special announcement
 * appears (tracked client-side via localStorage — a per-user backend "seen"
 * record would survive device switches too, but isn't worth the extra
 * moving parts for what's a one-time nudge, not an audit trail), and stays
 * reachable afterward via the trigger button.
 */
export function SpecialAnnouncementsDialog({
  announcements,
  compact = false,
}: SpecialAnnouncementsDialogProps) {
  const [open, setOpen] = useState(false);
  const ids = announcements.map((a) => a.id).join(",");
  const [processedIds, setProcessedIds] = useState<string | null>(null);

  // Adjust state when the active special-announcement set changes — React's
  // documented "adjusting state on prop change" pattern, safe to call
  // setState directly during render here (guarded by the processedIds
  // check, so it can't loop) unlike inside an effect.
  if (ids !== processedIds) {
    setProcessedIds(ids);
    if (announcements.length > 0 && announcements.some((a) => !loadSeenIds().has(a.id))) {
      setOpen(true);
    }
  }

  useEffect(() => {
    // Persistence only, no setState — records that this set of special
    // announcements has now been shown, so it won't auto-open again.
    if (announcements.length === 0) return;
    saveSeenIds(new Set([...loadSeenIds(), ...announcements.map((a) => a.id)]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids]);

  if (announcements.length === 0) return null;

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className={
          (compact ? "h-8 text-xs px-2.5 " : "h-7 text-xs ") +
          "shrink-0 border-amber-300 text-amber-800 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-300 dark:hover:bg-amber-950"
        }
      >
        <AlertTriangle className="h-3.5 w-3.5 mr-1" />
        Alerts
        <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-600 px-1 text-[10px] font-semibold text-white">
          {announcements.length}
        </span>
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              Special announcements
            </DialogTitle>
            <DialogDescription>
              Important notices, kept separate from the regular marquee.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {announcements.map((a) => (
              <div
                key={a.id}
                className="rounded-md border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40 px-3 py-2.5"
              >
                <div className="text-amber-950 dark:text-amber-100">
                  <RichAnnouncementBody body={a.body} />
                </div>
                <p className="mt-1.5 text-xs text-amber-700 dark:text-amber-400">
                  {(a.author_name || a.author_email) && (
                    <>{a.author_name || a.author_email} · </>
                  )}
                  {new Date(a.created_at).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
