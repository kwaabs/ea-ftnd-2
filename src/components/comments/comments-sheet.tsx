"use client"

import React, { useState } from "react"
import { X, Send, Trash2, Reply, MessageSquarePlus, ChevronDown, ChevronRight, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { useUserStore } from "@/stores/user-store"
import {
    useAllFeedback,
    submitFeedback,
    submitReply,
    deleteFeedback,
    type Feedback,
} from "@/hooks/api/use-feedback-api"

const ADMIN_EMAILS = ["jdanso@corg.com", "yoadofo@corg.com"]

function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return "just now"
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    if (days < 7) return `${days}d ago`
    return new Date(dateStr).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
}

function getInitials(email: string): string {
    return email.split("@")[0].slice(0, 2).toUpperCase()
}

function avatarColor(email: string): string {
    const colors = [
        "bg-blue-500", "bg-emerald-500", "bg-violet-500",
        "bg-orange-500", "bg-rose-500", "bg-teal-500", "bg-sky-500",
    ]
    let hash = 0
    for (let i = 0; i < email.length; i++) hash += email.charCodeAt(i)
    return colors[hash % colors.length]
}

interface CommentItemProps {
    comment: Feedback
    isAdmin: boolean
    currentUserEmail: string
    onReply: (id: number, email: string) => void
    onDelete: (id: number) => void
    isDeleting: boolean
}

function CommentItem({ comment, isAdmin, currentUserEmail, onReply, onDelete, isDeleting }: CommentItemProps) {
    const [repliesOpen, setRepliesOpen] = useState(false)
    const replies = comment.replies ?? []
    const hasReplies = replies.length > 0

    return (
        <div className="group">
            <div className="flex gap-3 py-3">
                <Avatar className="h-8 w-8 shrink-0 mt-0.5">
                    <AvatarFallback className={`text-white text-xs font-semibold ${avatarColor(comment.email)}`}>
                        {getInitials(comment.email)}
                    </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold">{comment.email.split("@")[0]}</span>
                        <Badge variant={comment.type === "COMPLAINT" ? "destructive" : "secondary"} className="text-[10px] px-1.5 py-0 h-4">
                            {comment.type}
                        </Badge>
                        <span className="text-xs text-muted-foreground ml-auto">{timeAgo(comment.created_at)}</span>
                    </div>
                    <p className="text-sm mt-1 text-foreground/90 leading-relaxed">{comment.comments}</p>

                    <div className="flex items-center gap-1 mt-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
                            onClick={() => onReply(comment.id, comment.email)}
                        >
                            <Reply className="h-3.5 w-3.5" />
                            Reply
                        </Button>
                        {hasReplies && (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
                                onClick={() => setRepliesOpen(o => !o)}
                            >
                                {repliesOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                                {replies.length} {replies.length === 1 ? "reply" : "replies"}
                            </Button>
                        )}
                        {isAdmin && (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs text-rose-500 hover:text-rose-600 hover:bg-rose-50 gap-1 ml-auto opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => onDelete(comment.id)}
                                disabled={isDeleting}
                            >
                                {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                                Delete
                            </Button>
                        )}
                    </div>

                    {/* Replies */}
                    {hasReplies && repliesOpen && (
                        <div className="mt-2 ml-2 border-l-2 border-border pl-3 space-y-2">
                            {replies.map((reply) => (
                                <div key={reply.id} className="group/reply flex gap-2 py-2">
                                    <Avatar className="h-6 w-6 shrink-0 mt-0.5">
                                        <AvatarFallback className={`text-white text-[10px] font-semibold ${avatarColor(reply.email)}`}>
                                            {getInitials(reply.email)}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-semibold">{reply.email.split("@")[0]}</span>
                                            <span className="text-[10px] text-muted-foreground ml-auto">{timeAgo(reply.created_at)}</span>
                                        </div>
                                        <p className="text-xs mt-0.5 text-foreground/90 leading-relaxed">{reply.comments}</p>
                                        {isAdmin && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-6 px-2 text-[10px] text-rose-500 hover:text-rose-600 hover:bg-rose-50 gap-1 mt-1 opacity-0 group-hover/reply:opacity-100 transition-opacity"
                                                onClick={() => onDelete(reply.id)}
                                            >
                                                <Trash2 className="h-3 w-3" />
                                                Delete
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
            <Separator />
        </div>
    )
}

interface CommentsSheetProps {
    open: boolean
    onClose: () => void
}

// Inner component — always mounted so hooks are never conditionally skipped
function CommentsSheetInner({ onClose }: { onClose: () => void }) {
    const { user } = useUserStore()
    const userEmail = user?.email || user?.username || ""
    const isAdmin = ADMIN_EMAILS.includes(userEmail)

    const { feedback, isLoading, mutate } = useAllFeedback(100, 0)

    const [newComment, setNewComment] = useState("")
    const [commentType, setCommentType] = useState<"COMMENT" | "COMPLAINT">("COMMENT")
    const [replyingTo, setReplyingTo] = useState<{ id: number; email: string } | null>(null)
    const [replyText, setReplyText] = useState("")
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [deletingId, setDeletingId] = useState<number | null>(null)
    const [activeTab, setActiveTab] = useState<"all" | "comments" | "complaints">("all")
    const [error, setError] = useState<string | null>(null)

    // Only top-level comments — guard against undefined parent_id (backend omits field when null)
    const topLevel = feedback.filter(f => f.parent_id === null || f.parent_id === undefined)
    const tabTypeMap = { all: null, comments: "COMMENT", complaints: "COMPLAINT" } as const
    const filtered = activeTab === "all"
        ? topLevel
        : topLevel.filter(f => f.type === tabTypeMap[activeTab])

    const handleSubmitComment = async () => {
        if (!newComment.trim()) return
        if (!userEmail) {
            setError("Could not determine your email. Please log out and log in again.")
            return
        }
        setIsSubmitting(true)
        setError(null)
        try {
            await submitFeedback({ email: userEmail, type: commentType, comments: newComment.trim() })
            setNewComment("")
            await mutate()
        } catch (err: any) {
            setError(err?.message || "Failed to post comment. Please try again.")
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleSubmitReply = async () => {
        if (!replyText.trim() || !replyingTo) return
        if (!userEmail) {
            setError("Could not determine your email. Please log out and log in again.")
            return
        }
        setIsSubmitting(true)
        setError(null)
        try {
            await submitReply({ email: userEmail, comments: replyText.trim(), parent_id: replyingTo.id })
            setReplyText("")
            setReplyingTo(null)
            await mutate()
        } catch (err: any) {
            setError(err?.message || "Failed to post reply. Please try again.")
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleDelete = async (id: number) => {
        if (!isAdmin) return
        setDeletingId(id)
        try {
            await deleteFeedback(id)
            mutate()
        } catch {
            setError("Failed to delete comment.")
        } finally {
            setDeletingId(null)
        }
    }

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Sheet panel */}
            <div className="fixed right-0 top-0 z-50 h-screen w-[480px] max-w-full bg-background border-l shadow-2xl flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
                    <div>
                        <h2 className="text-base font-semibold">Comments</h2>
                        <p className="text-xs text-muted-foreground mt-0.5">{topLevel.length} total &middot; {feedback.length} including replies</p>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
                        <X className="h-4 w-4" />
                    </Button>
                </div>

                {/* Tabs */}
                <div className="flex gap-1 px-5 pt-3 pb-1 shrink-0">
                    {(["all", "comments", "complaints"] as const).map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-3 py-1.5 text-xs font-medium rounded-md capitalize transition-colors ${activeTab === tab
                                    ? "bg-primary text-primary-foreground"
                                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                                }`}
                        >
                            {tab} {tab === "all" ? `(${topLevel.length})` : tab === "comments" ? `(${topLevel.filter(f => f.type === "COMMENT").length})` : `(${topLevel.filter(f => f.type === "COMPLAINT").length})`}
                        </button>
                    ))}
                </div>

                {/* Comment list */}
                <ScrollArea className="flex-1 px-5">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-16">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                            <MessageSquarePlus className="h-10 w-10 text-muted-foreground/40 mb-3" />
                            <p className="text-sm text-muted-foreground">No comments yet</p>
                            <p className="text-xs text-muted-foreground/60 mt-1">Be the first to leave a comment</p>
                        </div>
                    ) : (
                        <div className="py-2">
                            {filtered.map(comment => (
                                <CommentItem
                                    key={comment.id}
                                    comment={comment}
                                    isAdmin={isAdmin}
                                    currentUserEmail={user?.email ?? ""}
                                    onReply={(id, email) => { setReplyingTo({ id, email }); setReplyText("") }}
                                    onDelete={handleDelete}
                                    isDeleting={deletingId === comment.id}
                                />
                            ))}
                        </div>
                    )}
                </ScrollArea>

                {/* Reply indicator */}
                {replyingTo && (
                    <div className="mx-5 px-3 py-2 bg-muted rounded-t-md border border-b-0 flex items-center justify-between shrink-0">
                        <span className="text-xs text-muted-foreground">
                            Replying to <span className="font-medium text-foreground">{replyingTo.email.split("@")[0]}</span>
                        </span>
                        <button
                            onClick={() => setReplyingTo(null)}
                            className="text-muted-foreground hover:text-foreground"
                        >
                            <X className="h-3.5 w-3.5" />
                        </button>
                    </div>
                )}

                {/* Compose area */}
                <div className={`px-5 pb-5 pt-3 border-t shrink-0 ${replyingTo ? "pt-0" : ""}`}>
                    {error && (
                        <p className="text-xs text-rose-500 mb-2">{error}</p>
                    )}

                    {/* Type selector — only show when not replying */}
                    {!replyingTo && (
                        <div className="flex gap-2 mb-2">
                            <button
                                onClick={() => setCommentType("COMMENT")}
                                className={`text-xs px-2.5 py-1 rounded-md border transition-colors ${commentType === "COMMENT" ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground"}`}
                            >
                                Comment
                            </button>
                            <button
                                onClick={() => setCommentType("COMPLAINT")}
                                className={`text-xs px-2.5 py-1 rounded-md border transition-colors ${commentType === "COMPLAINT" ? "bg-rose-500 text-white border-rose-500" : "border-border text-muted-foreground hover:text-foreground"}`}
                            >
                                Complaint
                            </button>
                        </div>
                    )}

                    <div className="flex gap-2 items-end">
                        <Textarea
                            placeholder={replyingTo ? `Reply to ${replyingTo.email.split("@")[0]}...` : "Write a comment..."}
                            value={replyingTo ? replyText : newComment}
                            onChange={e => replyingTo ? setReplyText(e.target.value) : setNewComment(e.target.value)}
                            className="resize-none text-sm min-h-[80px]"
                            onKeyDown={e => {
                                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                                    replyingTo ? handleSubmitReply() : handleSubmitComment()
                                }
                            }}
                        />
                        <Button
                            size="icon"
                            className="h-10 w-10 shrink-0"
                            disabled={isSubmitting || !(replyingTo ? replyText.trim() : newComment.trim())}
                            onClick={replyingTo ? handleSubmitReply : handleSubmitComment}
                        >
                            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        </Button>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1.5">Press Ctrl+Enter to submit</p>
                </div>
            </div>
        </>
    )
}

// Outer wrapper — controls visibility without breaking hook rules
export function CommentsSheet({ open, onClose }: CommentsSheetProps) {
    if (!open) return null
    return <CommentsSheetInner onClose={onClose} />
}
