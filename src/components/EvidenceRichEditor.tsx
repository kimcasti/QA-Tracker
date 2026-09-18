import EditorDictation from './EditorDictation';
import { Button, Modal, Tooltip, message } from 'antd';
import {
  BoldOutlined,
  CheckSquareOutlined,
  FileImageOutlined,
  ItalicOutlined,
  OrderedListOutlined,
  UnorderedListOutlined,
  RobotOutlined,
} from '@ant-design/icons';
import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { TaskItem, TaskList } from '@tiptap/extension-list';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { aiEvidenceParagraph, replaceEvidenceText } from '../utils/aiEvidence';
import { readFileAsDataUrl, validateInlineImageFile } from '../utils/uploadValidation';
import { hasCloudinaryConfigured, uploadImageToCloudinary } from '../services/cloudinaryService';
import {
  hasMeaningfulEvidenceContent,
  normalizeEvidenceHtml,
} from '../utils/evidenceRichText';

type EvidenceRichEditorProps = {
  id?: string;
  'aria-label'?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
  voiceSessionKey?: string;
  value?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  minHeightClassName?: string;
  autoSize?: boolean;
  showMarkers?: boolean;
  showImageUpload?: boolean;
  projectId?: string;
  aiContext?: string;
  aiRecordId?: string;
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
  id,
  'aria-label': ariaLabel,
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid,
  voiceSessionKey,
  value,
  onChange,
  disabled = false,
  placeholder = 'Escribe aqui las notas de la ejecucion...',
  minHeightClassName = 'min-h-[180px]',
  autoSize = false,
  showMarkers = true,
  showImageUpload = true,
  projectId,
  aiContext,
  aiRecordId,
}: EvidenceRichEditorProps) {
  const [interpreting, setInterpreting] = useState(false);
  const [suggestion, setSuggestion] = useState('');
  const requestId = useRef(0);
  const sourceHtml = useRef('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const voiceScopeRef = useRef<HTMLDivElement>(null);
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
      TaskList,
      TaskItem.configure({
        a11y: { checkboxLabel: node => `Completar tarea: ${node.textContent || 'Nueva tarea'}` },
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

  const checklistActive = useEditorState({
    editor,
    selector: ({ editor: currentEditor }) => currentEditor?.isActive('taskList') ?? false,
  });

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!disabled, false);
  }, [disabled, editor]);

  useEffect(() => {
    if (!editor) return;
    editor.setOptions({ editorProps: { ...editor.options.editorProps, attributes: {
      role: 'textbox', 'aria-multiline': 'true',
      ...(id ? { id } : {}),
      ...(ariaLabel ? { 'aria-label': ariaLabel } : {}),
      ...(ariaDescribedBy ? { 'aria-describedby': ariaDescribedBy } : {}),
      'aria-invalid': String(Boolean(ariaInvalid)),
      'aria-disabled': String(disabled),
    } } });
  }, [editor, id, ariaLabel, ariaDescribedBy, ariaInvalid, disabled]);

  useEffect(() => {
    if (!editor) return;

    const currentHtml = editor.getHTML();
    if (currentHtml === normalizedValue) return;

    if (!normalizedValue && !hasMeaningfulEvidenceContent(currentHtml)) return;

    editor.commands.setContent(normalizedValue || '<p></p>', { emitUpdate: false });
  }, [editor, normalizedValue]);

  useEffect(() => {
    requestId.current += 1;
    setInterpreting(false);
    setSuggestion('');
    return () => { requestId.current += 1; };
  }, [editor, projectId, aiContext, aiRecordId]);

  const interpretError = async () => {
    if (!editor || disabled || !projectId || interpreting) return;
    const notes = editor.getText({ blockSeparator: '\n' }).trim();
    if (!notes) {
      message.info('Pega el error de Playwright en las notas para interpretarlo.');
      return;
    }
    if (notes.length > 20000) {
      message.warning('Reduce las notas a 20000 caracteres para interpretar el error.');
      return;
    }
    const id = ++requestId.current;
    const html = editor.getHTML();
    let hasEvidence = false;
    editor.state.doc.descendants(node => { if (node.type.name === 'image') hasEvidence = true; });
    setInterpreting(true);
    try {
      const { interpretExecutionEvidenceWithAI } = await import('../services/geminiService');
      const result = await interpretExecutionEvidenceWithAI({
        projectId, notes, context: aiContext?.slice(0, 4000), hasEvidence,
      });
      if (id !== requestId.current || editor.isDestroyed) return;
      if (editor.getHTML() !== html) {
        message.info('Las notas cambiaron durante el análisis. Vuelve a interpretar el error.');
        return;
      }
      if (!result?.paragraph?.trim()) throw new Error('La IA no devolvió una interpretación.');
      sourceHtml.current = html;
      setSuggestion(result.paragraph);
    } catch (error) {
      if (id === requestId.current) {
        message.error(error instanceof Error ? error.message : 'No fue posible interpretar el error. Intenta nuevamente.');
      }
    } finally {
      if (id === requestId.current) setInterpreting(false);
    }
  };

  const applySuggestion = () => {
    if (!editor || disabled || !suggestion) return;
    if (editor.getHTML() !== sourceHtml.current) {
      message.info('Las notas cambiaron. Vuelve a interpretar el error para usar la versión actual.');
      setSuggestion('');
      return;
    }
    const document = replaceEvidenceText(editor.getJSON(), suggestion);
    editor.chain().focus().selectAll().insertContent(document.content || []).run();
    setSuggestion('');
  };

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
    <div ref={voiceScopeRef} className="space-y-3">
      <div className="min-w-0 rounded-xl border border-slate-200 bg-slate-50/80 p-3">
        <div className="flex flex-wrap items-center justify-start gap-2">
          <EditorDictation editor={editor} disabled={disabled} scopeRef={voiceScopeRef}
            sessionKey={`${(voiceSessionKey ?? aiRecordId) || ''}:${normalizedValue !== editor?.getHTML() ? normalizedValue : 'synced'}`} />
          <div role="group" aria-label="Formato de texto" className="flex flex-wrap items-center gap-1">
            {[
              { label: 'Negrita', name: 'bold', icon: <BoldOutlined />, action: toggleBold },
              { label: 'Cursiva', name: 'italic', icon: <ItalicOutlined />, action: toggleItalic },
              { label: 'Viñetas', name: 'bulletList', icon: <UnorderedListOutlined />, action: toggleBulletList },
              { label: 'Numeración', name: 'orderedList', icon: <OrderedListOutlined />, action: toggleOrderedList },
            ].map(({ label, name, icon, action }) => (
              <Tooltip key={name} title={label}>
                <Button
                  aria-label={label}
                  aria-pressed={Boolean(editor?.isActive(name))}
                  type={editor?.isActive(name) ? 'primary' : 'text'}
                  icon={icon}
                  onClick={action}
                  onMouseDown={event => event.preventDefault()}
                  disabled={disabled || !editor}
                />
              </Tooltip>
            ))}
          </div>
          <Button
            aria-label="Checklist"
            aria-pressed={Boolean(checklistActive)}
            type={checklistActive ? 'primary' : 'default'}
            icon={<CheckSquareOutlined />}
            onMouseDown={event => event.preventDefault()}
            onClick={() => editor?.chain().focus().toggleTaskList().run()}
            disabled={disabled || !editor}
          >
            Checklist
          </Button>
          {showImageUpload && (
            <Button
              icon={<FileImageOutlined />}
              onClick={openFilePicker}
              disabled={disabled || !editor}
            >
              Subir imagen
            </Button>
          )}
        </div>

        {showMarkers && (
          <div className="mt-3 border-t border-slate-200 pt-3">
            <span className="mb-2 block text-xs font-medium text-slate-500">Insertar marcador</span>
            <div role="group" aria-label="Insertar marcador en las notas" className="flex flex-wrap gap-2">
              <Button
                color="green"
                variant="filled"
                onClick={() => insertEmoji(VERIFIED_EMOJI)}
                disabled={disabled || !editor}
              >
                {VERIFIED_EMOJI} Verificado
              </Button>
              <Button
                color="orange"
                variant="filled"
                onClick={() => insertEmoji(WARNING_EMOJI)}
                disabled={disabled || !editor}
              >
                {WARNING_EMOJI} Advertencia
              </Button>
              <Button
                color="danger"
                variant="filled"
                onClick={() => insertEmoji(ERROR_EMOJI)}
                disabled={disabled || !editor}
              >
                {ERROR_EMOJI} Error
              </Button>
            </div>
          </div>
        )}

        {projectId && (
          <div className="mt-3 border-t border-slate-200 pt-3">
            <Button
              block
              color="primary"
              variant="filled"
              icon={<RobotOutlined />}
              loading={interpreting}
              disabled={disabled || !editor}
              onClick={() => { void interpretError(); }}
            >
              Interpretar error con IA
            </Button>
          </div>
        )}
      </div>

      <div
        className={`${autoSize ? '' : minHeightClassName} rounded-xl border px-3 py-3 transition ${
          disabled ? 'border-slate-200 bg-slate-50' : 'border-sky-200 bg-white'
        }`}
      >
        <EditorContent editor={editor} className={`evidence-rich-editor qa-rich-text-content${autoSize ? ' evidence-rich-editor-auto-size' : ''}`} />
      </div>

      <Modal
        title="Interpretación del error"
        open={Boolean(suggestion)}
        onCancel={() => setSuggestion('')}
        onOk={applySuggestion}
        okText="Aplicar a las notas"
        cancelText="Cancelar"
        okButtonProps={{ disabled }}
      >
        <p className="mb-4 text-sm text-slate-500">
          Revisa la interpretación antes de aplicarla. Reemplazará el texto de las notas y conservará las imágenes.
        </p>
        <p className="whitespace-pre-wrap break-words text-sm leading-6">
          {aiEvidenceParagraph(suggestion).content?.map((node, index) =>
            node.marks?.[0]?.type === 'bold' ? <strong key={index}>{node.text}</strong>
              : node.marks?.[0]?.type === 'code' ? <code key={index}>{node.text}</code>
                : <span key={index}>{node.text}</span>,
          )}
        </p>
      </Modal>

      {showImageUpload && (
        <>
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
        </>
      )}
    </div>
  );
}
