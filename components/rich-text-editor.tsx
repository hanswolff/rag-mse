"use client";

import { useEffect } from "react";
import Link from "@tiptap/extension-link";
import StarterKit from "@tiptap/starter-kit";
import { EditorContent, useEditor } from "@tiptap/react";
import { getUtf8ByteLength } from "@/lib/event-description";

interface RichTextEditorProps {
  id: string;
  value: string;
  onChange: (html: string) => void;
  onBlur?: () => void;
  disabled?: boolean;
  error?: string;
  maxBytes: number;
}

const BUTTON_BASE_CLASS =
  "px-2 py-1 text-sm rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed";
const BUTTON_ACTIVE_CLASS = "bg-brand-blue-50 text-brand-blue-800 border-brand-blue-200";

export function RichTextEditor({
  id,
  value,
  onChange,
  onBlur,
  disabled = false,
  error,
  maxBytes,
}: RichTextEditorProps) {
  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({
          heading: false,
          codeBlock: false,
          horizontalRule: false,
        }),
        Link.configure({
          openOnClick: false,
          autolink: true,
          protocols: ["http", "https", "mailto"],
          defaultProtocol: "https",
        }),
      ],
      content: value || "<p></p>",
      editable: !disabled,
      onUpdate: ({ editor }) => {
        onChange(editor.getHTML());
      },
      onBlur: () => {
        onBlur?.();
      },
      editorProps: {
        attributes: {
          class: "tiptap-content form-input min-h-[140px] max-h-[350px] overflow-y-auto",
        },
      },
    },
    [disabled]
  );

  useEffect(() => {
    if (!editor) {
      return;
    }

    const currentHtml = editor.getHTML();
    if (value !== currentHtml) {
      editor.commands.setContent(value || "<p></p>", { emitUpdate: false });
    }
  }, [editor, value]);

  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [editor, disabled]);

  const bytes = getUtf8ByteLength(value);
  const isOverLimit = bytes > maxBytes;

  const toggleLink = () => {
    if (!editor) return;

    const previousUrl = editor.getAttributes("link").href as string | undefined;
    const input = window.prompt("Link-URL eingeben", previousUrl || "https://");

    if (input === null) {
      return;
    }

    const url = input.trim();

    if (!url) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }

    editor
      .chain()
      .focus()
      .extendMarkRange("link")
      .setLink({ href: url, rel: "noopener noreferrer nofollow", target: "_blank" })
      .run();
  };

  return (
    <div>
      <textarea id={id} value={value} readOnly disabled={disabled} className="sr-only" />

      <div className="mb-2 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => editor?.chain().focus().toggleBold().run()}
          disabled={disabled || !editor}
          className={`${BUTTON_BASE_CLASS} ${editor?.isActive("bold") ? BUTTON_ACTIVE_CLASS : ""}`}
          aria-label="Fett"
        >
          Fett
        </button>
        <button
          type="button"
          onClick={() => editor?.chain().focus().toggleItalic().run()}
          disabled={disabled || !editor}
          className={`${BUTTON_BASE_CLASS} ${editor?.isActive("italic") ? BUTTON_ACTIVE_CLASS : ""}`}
          aria-label="Kursiv"
        >
          Kursiv
        </button>
        <button
          type="button"
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
          disabled={disabled || !editor}
          className={`${BUTTON_BASE_CLASS} ${editor?.isActive("bulletList") ? BUTTON_ACTIVE_CLASS : ""}`}
          aria-label="Aufzählung"
        >
          Liste
        </button>
        <button
          type="button"
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
          disabled={disabled || !editor}
          className={`${BUTTON_BASE_CLASS} ${editor?.isActive("orderedList") ? BUTTON_ACTIVE_CLASS : ""}`}
          aria-label="Nummerierte Liste"
        >
          Nummeriert
        </button>
        <button
          type="button"
          onClick={toggleLink}
          disabled={disabled || !editor}
          className={`${BUTTON_BASE_CLASS} ${editor?.isActive("link") ? BUTTON_ACTIVE_CLASS : ""}`}
          aria-label="Link setzen"
        >
          Link
        </button>
      </div>

      <div
        className={error || isOverLimit ? "rounded-md border border-red-500" : "rounded-md border border-transparent"}
      >
        <EditorContent editor={editor} />
      </div>

      <p className={`form-help ${isOverLimit ? "text-red-600" : "text-gray-500"}`}>
        {bytes.toLocaleString("de-DE")} / {maxBytes.toLocaleString("de-DE")} Bytes
      </p>
    </div>
  );
}
