"use client";

import { useEditor, EditorContent, type JSONContent } from "@tiptap/react";
import { generateText } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { Bold, Italic, List, ListOrdered } from "lucide-react";
import { Toggle } from "@/components/ui/toggle";

/** Plain-text preview of a serialized TipTap body, for list rows/previews
 * that shouldn't mount a full editor instance per row. Falls back to the
 * raw string if it isn't valid TipTap JSON (plain-text regular
 * announcements never hit this — callers only use it for kind=special). */
export function richAnnouncementPreviewText(body: string): string {
  try {
    return generateText(JSON.parse(body), [StarterKit]);
  } catch {
    return body;
  }
}

// Special announcements only — the regular marquee still uses a plain
// Textarea (see regional-summary-marquee.tsx), since a single-line ticker
// has no use for rich formatting. No image support: that needs an upload
// endpoint and file storage this app doesn't have yet, so StarterKit's
// default node set (no Image extension added) is deliberately left as-is.
export const RICH_ANNOUNCEMENT_MAX_CHARS = 5000;

// No @tailwindcss/typography plugin in this project, and Tailwind's
// preflight resets ul/ol to list-style:none — these explicit utilities
// restore visible bullets/numbers instead of pulling in that plugin for
// just this one use. Shared with rich-announcement-body.tsx's read-only
// renderer so editing and display look identical.
export const RICH_ANNOUNCEMENT_CONTENT_CLASS =
  "text-sm leading-relaxed [&_p]:my-1 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-1 " +
  "[&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-1 [&_li]:my-0.5 [&_strong]:font-semibold";

interface RichAnnouncementEditorProps {
  /** Serialized TipTap JSON, or empty string for a fresh editor. */
  value: string;
  /** json is what gets submitted; text (markup stripped) is for length/emptiness checks. */
  onChange: (json: string, text: string) => void;
}

function parseInitialContent(value: string): JSONContent | undefined {
  if (!value) return undefined;
  try {
    return JSON.parse(value) as JSONContent;
  } catch {
    return undefined;
  }
}

export function RichAnnouncementEditor({ value, onChange }: RichAnnouncementEditorProps) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: parseInitialContent(value),
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: `${RICH_ANNOUNCEMENT_CONTENT_CLASS} min-h-[7rem] px-3 py-2 focus:outline-none`,
      },
    },
    onUpdate: ({ editor }) => {
      onChange(JSON.stringify(editor.getJSON()), editor.getText());
    },
  });

  const charCount = editor?.getText().length ?? 0;
  const overLimit = charCount > RICH_ANNOUNCEMENT_MAX_CHARS;

  if (!editor) return null;

  return (
    <div className="rounded-md border border-input">
      <div className="flex items-center gap-1 border-b border-input px-2 py-1">
        <Toggle
          size="sm"
          pressed={editor.isActive("bold")}
          onPressedChange={() => editor.chain().focus().toggleBold().run()}
          aria-label="Bold"
        >
          <Bold className="h-3.5 w-3.5" />
        </Toggle>
        <Toggle
          size="sm"
          pressed={editor.isActive("italic")}
          onPressedChange={() => editor.chain().focus().toggleItalic().run()}
          aria-label="Italic"
        >
          <Italic className="h-3.5 w-3.5" />
        </Toggle>
        <Toggle
          size="sm"
          pressed={editor.isActive("bulletList")}
          onPressedChange={() => editor.chain().focus().toggleBulletList().run()}
          aria-label="Bullet list"
        >
          <List className="h-3.5 w-3.5" />
        </Toggle>
        <Toggle
          size="sm"
          pressed={editor.isActive("orderedList")}
          onPressedChange={() => editor.chain().focus().toggleOrderedList().run()}
          aria-label="Numbered list"
        >
          <ListOrdered className="h-3.5 w-3.5" />
        </Toggle>
      </div>
      <EditorContent editor={editor} />
      <div
        className={
          "px-3 pb-2 text-right text-xs " +
          (overLimit ? "text-red-600" : "text-muted-foreground")
        }
      >
        {charCount}/{RICH_ANNOUNCEMENT_MAX_CHARS}
      </div>
    </div>
  );
}
