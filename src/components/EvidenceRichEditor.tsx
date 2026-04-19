import { Button, message } from 'antd';
import { FileImageOutlined } from '@ant-design/icons';
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
  insertAt?: number
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
  placeholder = 'Escribe aquí las notas de la ejecución...',
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

    editor.commands.setContent(normalizedValue || '<p></p>', false);
  }, [editor, normalizedValue]);

  const insertEmoji = (emoji: string) => {
    if (!editor || disabled) return;
    editor.chain().focus().insertContent(`${emoji} `).run();
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
          onClick={() => insertEmoji('✅')}
          disabled={disabled}
        >
          ✅ Verificado
        </Button>
        <Button
          size="small"
          className="rounded-full"
          onClick={() => insertEmoji('⚠️')}
          disabled={disabled}
        >
          ⚠️ Advertencia
        </Button>
        <Button
          size="small"
          className="rounded-full"
          onClick={() => insertEmoji('❌')}
          disabled={disabled}
        >
          ❌ Error
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
          disabled ? 'bg-slate-50 border-slate-200' : 'bg-white border-sky-200'
        }`}
      >
        <EditorContent editor={editor} className="evidence-rich-editor" />
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
        Puedes escribir texto, usar emojis, pegar una captura con `Ctrl + V` o arrastrar una
        imagen al editor.
      </p>
    </div>
  );
}
