"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Info, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Announcement } from "@/hooks/api/use-announcements-api";
import { RichAnnouncementBody } from "@/components/dashboard/rich-announcement-body";
import { useUserStore } from "@/stores/user-store";

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
  /** True until the underlying announcements fetch first resolves — gates
   * the open-decision and login-flag consumption below so SWR's transient
   * empty array (before the first fetch completes) can't be mistaken for
   * "genuinely zero special announcements" and consume the one-shot login
   * flag before real data has actually arrived. */
  isLoading?: boolean;
}

/**
 * A separate, higher-visibility channel for announcements marked "special"
 * (internal/announcements Kind field) — pulled out of the regular marquee
 * rotation entirely so an urgent notice can't get lost among ordinary ones.
 * Auto-opens on two triggers: every successful login (see user-store.ts's
 * justLoggedIn, set by login() and cleared here once consumed — a fresh
 * sign-in should always surface active special announcements, even ones
 * already seen before), and the first time a given announcement ID appears
 * in a browser that hasn't seen it yet (tracked client-side via
 * localStorage — a per-user backend "seen" record would survive device
 * switches too, but isn't worth the extra moving parts for what's a
 * one-time nudge, not an audit trail). Stays reachable afterward either way
 * via the trigger button.
 */
export function SpecialAnnouncementsDialog({
  announcements,
  compact = false,
  isLoading = false,
}: SpecialAnnouncementsDialogProps) {
  const [open, setOpen] = useState(false);
  const ids = announcements.map((a) => a.id).join(",");
  const [processedIds, setProcessedIds] = useState<string | null>(null);
  const justLoggedIn = useUserStore((s) => s.justLoggedIn);
  const clearJustLoggedIn = useUserStore((s) => s.clearJustLoggedIn);

  // Adjust state when the active special-announcement set changes — React's
  // documented "adjusting state on prop change" pattern, safe to call
  // setState directly during render here (guarded by the processedIds
  // check, so it can't loop) unlike inside an effect. Held off until
  // isLoading clears so this fires against real data, not SWR's transient
  // empty array.
  if (!isLoading && ids !== processedIds) {
    setProcessedIds(ids);
    if (
      announcements.length > 0 &&
      (justLoggedIn || announcements.some((a) => !loadSeenIds().has(a.id)))
    ) {
      setOpen(true);
    }
  }

  useEffect(() => {
    // Persistence only, no setState — records that this set of special
    // announcements has now been shown, so it won't auto-open again on the
    // seen-id trigger (the login trigger is independent of this).
    if (isLoading || announcements.length === 0) return;
    saveSeenIds(new Set([...loadSeenIds(), ...announcements.map((a) => a.id)]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids, isLoading]);

  // Consume the login flag once real data has been used to decide whether
  // to open — an external store mutation belongs in an effect, not render
  // (unlike the local setOpen/setProcessedIds above). Gated on isLoading
  // for the same reason as the block above: clearing it against a
  // transient empty array would lose the login trigger once real
  // announcements arrive a moment later.
  useEffect(() => {
    if (!isLoading && justLoggedIn) clearJustLoggedIn();
  }, [isLoading, justLoggedIn, clearJustLoggedIn]);

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
        {/* ECG brand colors (sampled from public/images/ecg-logo.jpg):
            blue #2e3192, yellow #fdf200, red #ed1c24. Solid blue panel
            rather than a gradient wash -- reads as branded/deliberate
            without competing with the content, per feedback that a full
            rainbow gradient was "too fancy" but plain white/grey "doesn't
            stand out." showCloseButton is off here because the default
            close button assumes a light bg/dark icon, illegible on solid
            blue -- replaced below with one styled for this panel.
            onPointerDownOutside/onEscapeKeyDown prevent default so an
            outside click or Escape can't dismiss this without the reader
            actually clicking the close button -- these are meant to be
            read, not brushed past. Width is sm:max-w-lg (512px) x1.25 =
            640px, x1.10 = 704px, x1.10 again = 774px. */}
        <DialogContent
          showCloseButton={false}
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
          className="sm:max-w-[774px] gap-0 overflow-hidden rounded-xl border-0 bg-[#2e3192] p-0 shadow-[0_8px_28px_rgba(46,49,146,0.45)] ring-0"
        >
          <DialogClose asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="absolute top-3 right-3 text-white/80 hover:bg-white/10 hover:text-white"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </Button>
          </DialogClose>

          <DialogHeader className="border-b border-white/15 px-6 py-5">
            <DialogTitle className="flex items-center gap-2.5 text-2xl font-bold text-white">
              <Info className="h-7 w-7 shrink-0 text-[#fdf200]" />
              Information
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 max-h-[76vh] overflow-y-auto px-6 py-5">
            {announcements.map((a) => (
              <div
                key={a.id}
                className="rounded-md border-l-[6px] border-[#fdf200] bg-[#fdf6d8] py-2.5 pr-3 pl-3.5"
              >
                <span className="mb-1.5 inline-block rounded bg-[#ed1c24] px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-white uppercase">
                  Alert
                </span>
                <div className="text-black">
                  <RichAnnouncementBody body={a.body} />
                </div>
                <p className="mt-1.5 text-xs text-[#8a7f3f]">
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
