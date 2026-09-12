"use client";

import { useEditor, EditorContent, type JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { RICH_ANNOUNCEMENT_CONTENT_CLASS } from "@/components/dashboard/rich-announcement-editor";

interface RichAnnouncementBodyProps {
  /** Serialized TipTap JSON (special announcements) or plain text (legacy/fallback). */
  body: string;
}

/**
 * Renders a special announcement's body read-only, through an actual
 * (non-editable) TipTap/ProseMirror instance rather than
 * dangerouslySetInnerHTML — content only ever passes through
 * ProseMirror's schema (StarterKit's node/mark set, no arbitrary tags or
 * attributes), so there's no raw-HTML injection surface to sanitize
 * against. Falls back to plain text if body isn't valid TipTap JSON
 * (e.g. older rows, or malformed data) rather than throwing.
 */
export function RichAnnouncementBody({ body }: RichAnnouncementBodyProps) {
  let content: JSONContent | undefined;
  let isJson = true;
  try {
    content = JSON.parse(body) as JSONContent;
  } catch {
    isJson = false;
  }

  const editor = useEditor({
    extensions: [StarterKit],
    content: isJson ? content : undefined,
    editable: false,
    immediatelyRender: false,
    editorProps: {
      attributes: { class: RICH_ANNOUNCEMENT_CONTENT_CLASS },
    },
  });

  if (!isJson) {
    return <p className="text-sm leading-relaxed whitespace-pre-wrap">{body}</p>;
  }
  if (!editor) return null;

  return <EditorContent editor={editor} />;
}
