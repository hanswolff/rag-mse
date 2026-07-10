"use client";

import { useEffect, useState } from "react";
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
  const [linkInputOpen, setLinkInputOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkError, setLinkError] = useState("");

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

    if (linkInputOpen) {
      setLinkInputOpen(false);
      setLinkUrl("");
      setLinkError("");
      return;
    }

    const previousUrl = editor.getAttributes("link").href as string | undefined;
    setLinkUrl(previousUrl || "https://");
    setLinkError("");
    setLinkInputOpen(true);
  };

  const applyLink = () => {
    if (!editor) return;

    const url = linkUrl.trim();

    if (!url) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      setLinkInputOpen(false);
      setLinkUrl("");
      setLinkError("");
      return;
    }

    const ALLOWED_PROTOCOLS = ["http:", "https:", "mailto:"];
    try {
      const parsed = new URL(url);
      if (!ALLOWED_PROTOCOLS.includes(parsed.protocol)) {
        setLinkError("Nur http, https und mailto Links sind erlaubt.");
        return;
      }
    } catch {
      if (!url.startsWith("mailto:")) {
        setLinkError("Ungültige URL. Bitte eine gültige URL eingeben (z.\u00A0B. https://example.com).");
        return;
      }
    }

    editor
      .chain()
      .focus()
      .extendMarkRange("link")
      .setLink({ href: url, rel: "noopener noreferrer nofollow", target: "_blank" })
      .run();

    setLinkInputOpen(false);
    setLinkUrl("");
    setLinkError("");
  };

  return (
    <div>
      <textarea id={id} value={value} readOnly disabled={disabled} className="sr-only" tabIndex={-1} aria-hidden="true" />

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

      {linkInputOpen && (
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <input
            type="url"
            value={linkUrl}
            onChange={(e) => {
              setLinkUrl(e.target.value);
              setLinkError("");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); applyLink(); }
              if (e.key === "Escape") { setLinkInputOpen(false); setLinkUrl(""); setLinkError(""); }
            }}
            placeholder="https://example.com"
            className="form-input flex-1 min-w-0 text-sm py-1"
            autoFocus
          />
          <button type="button" onClick={applyLink} className={`${BUTTON_BASE_CLASS} bg-brand-blue-50 text-brand-blue-800`}>
            Übernehmen
          </button>
          <button type="button" onClick={() => { setLinkInputOpen(false); setLinkUrl(""); setLinkError(""); }} className={BUTTON_BASE_CLASS}>
            Abbrechen
          </button>
          {linkError && <p className="w-full text-sm text-red-600">{linkError}</p>}
        </div>
      )}

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
