"use client"

import { useEffect, useMemo, useState } from "react"
import { Bell } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Separator } from "@/components/ui/separator"
import { useAllFeedback, type Feedback } from "@/hooks/api/use-feedback-api"
import { useCommentsSheetStore } from "@/stores/comments-sheet-store"

const LAST_SEEN_KEY = "comments-notifications-last-seen"
const POLL_INTERVAL_MS = 30_000

function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return "just now"
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    return `${days}d ago`
}

function getInitials(email: string): string {
    return email.split("@")[0].slice(0, 2).toUpperCase()
}

// Common shape between a top-level comment and a reply — all this component needs to render either.
type Message = Pick<Feedback, "id" | "email" | "comments" | "created_at">

// Flatten top-level comments + their replies into one list, newest first.
function flattenFeedback(feedback: Feedback[]): Message[] {
    const all: Message[] = []
    for (const item of feedback) {
        all.push(item)
        if (item.replies) all.push(...item.replies)
    }
    return all.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
}

interface NotificationBellProps {
    userEmail: string
}

export function NotificationBell({ userEmail }: NotificationBellProps) {
    const { feedback, isLoading } = useAllFeedback(100, 0, { refreshInterval: POLL_INTERVAL_MS })
    const [lastSeen, setLastSeen] = useState<number>(0)
    const [popoverOpen, setPopoverOpen] = useState(false)
    const openCommentsSheet = useCommentsSheetStore(s => s.open)

    useEffect(() => {
        const stored = window.localStorage.getItem(LAST_SEEN_KEY)
        setLastSeen(stored ? Number(stored) : 0)
    }, [])

    const allMessages = useMemo(() => flattenFeedback(feedback), [feedback])

    // Don't notify a user about their own comments — only other people's.
    const messagesFromOthers = useMemo(
        () => allMessages.filter(m => m.email !== userEmail),
        [allMessages, userEmail],
    )

    const unreadCount = useMemo(
        () => messagesFromOthers.filter(m => new Date(m.created_at).getTime() > lastSeen).length,
        [messagesFromOthers, lastSeen],
    )

    const latest = messagesFromOthers.slice(0, 5)

    const markAsSeen = () => {
        const now = Date.now()
        window.localStorage.setItem(LAST_SEEN_KEY, String(now))
        setLastSeen(now)
    }

    const handleOpenChange = (open: boolean) => {
        setPopoverOpen(open)
        if (open) markAsSeen()
    }

    return (
        <Popover open={popoverOpen} onOpenChange={handleOpenChange}>
            <PopoverTrigger asChild>
                <Button variant="outline" size="icon" className="relative bg-transparent">
                    <Bell className="h-4 w-4" />
                    {unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 flex items-center justify-center rounded-full bg-rose-500 text-white text-[10px] font-semibold leading-none h-4 min-w-4 px-1">
                            {unreadCount > 9 ? "9+" : unreadCount}
                        </span>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent align="end" side="bottom" sideOffset={8} className="w-80 p-0">
                <div className="px-4 py-3 border-b">
                    <p className="text-sm font-semibold">Comments</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                        {allMessages.length} message{allMessages.length === 1 ? "" : "s"} total
                        {unreadCount > 0 && ` · ${unreadCount} new`}
                    </p>
                </div>

                <div className="max-h-80 overflow-y-auto">
                    {isLoading ? (
                        <p className="text-xs text-muted-foreground text-center py-6">Loading…</p>
                    ) : latest.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-6">No comments yet</p>
                    ) : (
                        latest.map((m, idx) => (
                            <div key={m.id}>
                                <div className="flex gap-2 px-4 py-2.5">
                                    <Avatar className="h-6 w-6 shrink-0 mt-0.5">
                                        <AvatarFallback className="bg-primary text-primary-foreground text-[10px] font-semibold">
                                            {getInitials(m.email)}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-semibold truncate">{m.email.split("@")[0]}</span>
                                            <span className="text-[10px] text-muted-foreground ml-auto shrink-0">{timeAgo(m.created_at)}</span>
                                        </div>
                                        <p className="text-xs text-foreground/90 mt-0.5 line-clamp-2">{m.comments}</p>
                                    </div>
                                </div>
                                {idx < latest.length - 1 && <Separator />}
                            </div>
                        ))
                    )}
                </div>

                <div className="border-t p-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="w-full text-xs"
                        onClick={() => {
                            setPopoverOpen(false)
                            openCommentsSheet()
                        }}
                    >
                        View all comments
                    </Button>
                </div>
            </PopoverContent>
        </Popover>
    )
}
