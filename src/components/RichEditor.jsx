import React, { useEffect, useImperativeHandle, forwardRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
const RichEditor = forwardRef(function RichEditor({ content, onUpdate }, ref) {
  const editor = useEditor({
    extensions: [StarterKit, Image],
    content: content || "",
    onUpdate({ editor }) {
      onUpdate?.(editor.getHTML());
    },
  });

  useEffect(() => {
    if (!editor) return;
    editor.commands.setContent(content || "");
  }, [content, editor]);

  function addImageFromDataUrl(dataUrl) {
    if (!editor) return;
    editor.chain().focus().setImage({ src: dataUrl }).run();
  }

  useImperativeHandle(ref, () => ({
    addImageFromDataUrl,
  }));

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex gap-2">
        <button
          type="button"
          onClick={() => editor?.chain().focus().toggleBold().run()}
          className="rounded border px-2 py-1 text-sm"
        >
          Bold
        </button>
        <button
          type="button"
          onClick={() => editor?.chain().focus().toggleItalic().run()}
          className="rounded border px-2 py-1 text-sm"
        >
          Italic
        </button>
        <button
          type="button"
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
          className="rounded border px-2 py-1 text-sm"
        >
          Bullets
        </button>
      </div>

      <EditorContent editor={editor} />
    </div>
  );
});

export default RichEditor;
