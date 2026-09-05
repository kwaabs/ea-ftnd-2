"use client"

import { useRef } from "react"
import { cn } from "@/lib/utils"

interface SqlTextareaProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

/**
 * A plain <textarea> with a synced line-number gutter — for pasting SQL
 * copied from SQL*Plus/SQL Developer/DBeaver, where an error message
 * ("ORA-00911: invalid character ... position: 1496") is only useful if
 * you can actually find that spot in what you pasted. Not a real editor
 * (no syntax highlighting, no folding) — just enough to count lines.
 *
 * Long lines don't soft-wrap (wrap="off" + white-space: pre, scrolled
 * horizontally instead): a wrapped line would span more than one visual
 * row while still being one gutter number, throwing the numbering out of
 * sync with what's actually on screen.
 */
export function SqlTextarea({ value, onChange, placeholder, className }: SqlTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const gutterRef = useRef<HTMLDivElement>(null)

  const lineCount = value.split("\n").length

  const syncGutterScroll = () => {
    if (textareaRef.current && gutterRef.current) {
      gutterRef.current.scrollTop = textareaRef.current.scrollTop
    }
  }

  return (
    <div
      className={cn(
        "flex rounded-lg border border-input bg-transparent font-mono text-xs focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50",
        className,
      )}
    >
      <div
        ref={gutterRef}
        aria-hidden
        className="select-none overflow-hidden rounded-l-lg border-r bg-muted/50 py-2 pl-2 pr-1.5 text-right text-muted-foreground/70"
        style={{ lineHeight: "1.5" }}
      >
        {Array.from({ length: lineCount }, (_, i) => (
          <div key={i}>{i + 1}</div>
        ))}
      </div>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onScroll={syncGutterScroll}
        placeholder={placeholder}
        spellCheck={false}
        wrap="off"
        className="min-h-[90px] flex-1 resize-y overflow-auto whitespace-pre bg-transparent px-2 py-2 outline-none placeholder:text-muted-foreground"
        style={{ lineHeight: "1.5" }}
      />
    </div>
  )
}
