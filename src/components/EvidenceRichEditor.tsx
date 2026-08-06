import { Button, Divider, message } from 'antd';
import {
  BoldOutlined,
  FileImageOutlined,
  ItalicOutlined,
  OrderedListOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import { useEffect, useMemo, useRef, type ChangeEvent } from 'react';
import { readFileAsDataUrl, validateInlineImageFile } from '../utils/uploadValidation';
import { hasCloudinaryConfigured, uploadImageToCloudinary } from '../services/cloudinaryService';
import {
  hasMeaningfulEvidenceContent,
  normalizeEvidenceHtml,
} from '../utils/evidenceRichText';

type EvidenceRichEditorProps = {
  value?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
};

const ACCEPTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
const VERIFIED_EMOJI = '\u2705';
const WARNING_EMOJI = '\u26A0\uFE0F';
const ERROR_EMOJI = '\u274C';

function extractAcceptedImageFiles(files?: FileList | null) {
  return Array.from(files || []).filter(file => ACCEPTED_IMAGE_TYPES.includes(file.type));
}

async function resolveImageSource(file: File) {
  if (!validateInlineImageFile(file)) {
    throw new Error('INVALID_IMAGE');
  }

  if (hasCloudinaryConfigured()) {
    const uploaded = await uploadImageToCloudinary(file);
    return uploaded.url;
  }

  return readFileAsDataUrl(file);
}

async function insertImagesIntoEditor(
  currentEditor: NonNullable<ReturnType<typeof useEditor>>,
  files: File[],
  insertAt?: number,
) {
  let currentPosition = insertAt;

  for (const file of files) {
    try {
      const src = await resolveImageSource(file);

      if (typeof currentPosition === 'number') {
        currentEditor
          .chain()
          .focus()
          .insertContentAt(currentPosition, {
            type: 'image',
            attrs: { src },
          })
          .run();
        currentPosition += 1;
        continue;
      }

      currentEditor.chain().focus().setImage({ src }).run();
    } catch (error) {
      if ((error as Error)?.message !== 'INVALID_IMAGE') {
        console.error('Error inserting image into editor:', error);
        message.error('No fue posible adjuntar la imagen. Intenta nuevamente.');
      }
    }
  }
}

export default function EvidenceRichEditor({
  value,
  onChange,
  disabled = false,
  placeholder = 'Escribe aqui las notas de la ejecucion...',
}: EvidenceRichEditorProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
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
      Image.configure({
        inline: false,
        allowBase64: true,
      }),
    ],
    content: normalizedValue,
    onUpdate: ({ editor: currentEditor }) => {
      onChange?.(currentEditor.getHTML());
    },
    editorProps: {
      handlePaste: (_view, event) => {
        if (disabled) {
          return true;
        }

        const files = extractAcceptedImageFiles(event.clipboardData?.files);
        if (!files.length || !editor) {
          return false;
        }

        event.preventDefault();
        void insertImagesIntoEditor(editor, files);
        return true;
      },
      handleDrop: (view, event, _slice, moved) => {
        if (disabled) {
          return true;
        }

        if (moved) {
          return false;
        }

        const files = extractAcceptedImageFiles(event.dataTransfer?.files);
        if (!files.length || !editor) {
          return false;
        }

        event.preventDefault();

        const position = view.posAtCoords({
          left: event.clientX,
          top: event.clientY,
        })?.pos;

        void insertImagesIntoEditor(editor, files, position);
        return true;
      },
    },
  });

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!disabled);
  }, [disabled, editor]);

  useEffect(() => {
    if (!editor) return;

    const currentHtml = editor.getHTML();
    if (currentHtml === normalizedValue) return;

    if (!normalizedValue && !hasMeaningfulEvidenceContent(currentHtml)) return;

    editor.commands.setContent(normalizedValue || '<p></p>');
  }, [editor, normalizedValue]);

  const insertEmoji = (emoji: string) => {
    if (!editor || disabled) return;
    editor.chain().focus().insertContent(`${emoji} `).run();
  };

  const toggleBold = () => {
    if (!editor || disabled) return;
    editor.chain().focus().toggleBold().run();
  };

  const toggleItalic = () => {
    if (!editor || disabled) return;
    editor.chain().focus().toggleItalic().run();
  };

  const toggleBulletList = () => {
    if (!editor || disabled) return;
    editor.chain().focus().toggleBulletList().run();
  };

  const toggleOrderedList = () => {
    if (!editor || disabled) return;
    editor.chain().focus().toggleOrderedList().run();
  };

  const openFilePicker = () => {
    if (disabled) return;
    fileInputRef.current?.click();
  };

  const handleFileSelection = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !editor) return;

    await insertImagesIntoEditor(editor, [file]);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button
          size="small"
          className="rounded-full"
          type={editor?.isActive('bold') ? 'primary' : 'default'}
          onClick={toggleBold}
          disabled={disabled}
        >
          <BoldOutlined /> Negrita
        </Button>
        <Button
          size="small"
          className="rounded-full"
          type={editor?.isActive('italic') ? 'primary' : 'default'}
          onClick={toggleItalic}
          disabled={disabled}
        >
          <ItalicOutlined /> Italica
        </Button>
        <Button
          size="small"
          className="rounded-full"
          type={editor?.isActive('bulletList') ? 'primary' : 'default'}
          onClick={toggleBulletList}
          disabled={disabled}
        >
          <UnorderedListOutlined /> Vinetas
        </Button>
        <Button
          size="small"
          className="rounded-full"
          type={editor?.isActive('orderedList') ? 'primary' : 'default'}
          onClick={toggleOrderedList}
          disabled={disabled}
        >
          <OrderedListOutlined /> Numeracion
        </Button>
        <Divider type="vertical" className="h-8" />
        <Button
          size="small"
          className="rounded-full"
          onClick={() => insertEmoji(VERIFIED_EMOJI)}
          disabled={disabled}
        >
          {VERIFIED_EMOJI} Verificado
        </Button>
        <Button
          size="small"
          className="rounded-full"
          onClick={() => insertEmoji(WARNING_EMOJI)}
          disabled={disabled}
        >
          {WARNING_EMOJI} Advertencia
        </Button>
        <Button
          size="small"
          className="rounded-full"
          onClick={() => insertEmoji(ERROR_EMOJI)}
          disabled={disabled}
        >
          {ERROR_EMOJI} Error
        </Button>
        <Button
          size="small"
          className="rounded-full"
          icon={<FileImageOutlined />}
          onClick={openFilePicker}
          disabled={disabled}
        >
          Subir imagen
        </Button>
      </div>

      <div
        className={`min-h-[180px] rounded-xl border px-3 py-3 transition ${
          disabled ? 'border-slate-200 bg-slate-50' : 'border-sky-200 bg-white'
        }`}
      >
        <EditorContent editor={editor} className="evidence-rich-editor qa-rich-text-content" />
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES.join(',')}
        hidden
        aria-hidden="true"
        tabIndex={-1}
        className="hidden"
        style={{ display: 'none' }}
        onChange={event => {
          void handleFileSelection(event);
        }}
      />

      <p className="text-[11px] text-slate-500">
        Puedes usar formato enriquecido, emojis, pegar una captura con `Ctrl + V` o arrastrar una
        imagen al editor.
      </p>
    </div>
  );
}
