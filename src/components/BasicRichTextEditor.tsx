import { Button } from 'antd';
import {
  BoldOutlined,
  ItalicOutlined,
  OrderedListOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { useEffect, useMemo, type ReactNode } from 'react';
import { normalizeEvidenceHtml } from '../utils/evidenceRichText';

type BasicRichTextEditorProps = {
  value?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  minHeightClassName?: string;
};

type ToolbarButtonProps = {
  active?: boolean;
  disabled?: boolean;
  icon: ReactNode;
  onClick: () => void;
};

function ToolbarButton({ active = false, disabled = false, icon, onClick }: ToolbarButtonProps) {
  return (
    <Button
      type={active ? 'primary' : 'default'}
      size="small"
      className="rounded-lg"
      disabled={disabled}
      onMouseDown={event => {
        event.preventDefault();
        onClick();
      }}
      icon={icon}
    />
  );
}

export default function BasicRichTextEditor({
  value,
  onChange,
  disabled = false,
  placeholder = 'Escribe aquí...',
  minHeightClassName = 'min-h-[120px]',
}: BasicRichTextEditorProps) {
  const normalizedValue = useMemo(() => normalizeEvidenceHtml(value), [value]);

  const editor = useEditor({
    immediatelyRender: false,
    editable: !disabled,
    extensions: [
      StarterKit.configure({
        heading: false,
        blockquote: false,
        codeBlock: false,
        horizontalRule: false,
      }),
      Placeholder.configure({
        placeholder,
      }),
    ],
    content: normalizedValue,
    onUpdate: ({ editor: currentEditor }) => {
      onChange?.(currentEditor.getHTML());
    },
  });

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!disabled);
  }, [disabled, editor]);

  useEffect(() => {
    if (!editor) return;
    if (editor.getHTML() === normalizedValue) return;

    editor.commands.setContent(normalizedValue || '<p></p>', false);
  }, [editor, normalizedValue]);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <ToolbarButton
          icon={<BoldOutlined />}
          active={Boolean(editor?.isActive('bold'))}
          disabled={disabled || !editor}
          onClick={() => editor?.chain().focus().toggleBold().run()}
        />
        <ToolbarButton
          icon={<ItalicOutlined />}
          active={Boolean(editor?.isActive('italic'))}
          disabled={disabled || !editor}
          onClick={() => editor?.chain().focus().toggleItalic().run()}
        />
        <ToolbarButton
          icon={<UnorderedListOutlined />}
          active={Boolean(editor?.isActive('bulletList'))}
          disabled={disabled || !editor}
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
        />
        <ToolbarButton
          icon={<OrderedListOutlined />}
          active={Boolean(editor?.isActive('orderedList'))}
          disabled={disabled || !editor}
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
        />
      </div>

      <div
        className={`rounded-xl border px-3 py-3 transition ${
          disabled ? 'border-slate-200 bg-slate-50' : 'border-sky-200 bg-white'
        } ${minHeightClassName}`}
      >
        <EditorContent editor={editor} className="qa-basic-rich-editor qa-rich-text-content" />
      </div>
    </div>
  );
}
