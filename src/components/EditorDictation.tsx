import type { Editor } from '@tiptap/react';
import { useContext, useEffect, useRef, type RefObject } from 'react';
import DisabledContext from 'antd/es/config-provider/DisabledContext';
import VoiceDictation from './VoiceDictation';
import { dictationText } from '../utils/dictationText';

export default function EditorDictation({ editor, disabled, sessionKey, scopeRef }: {
  editor: Editor | null;
  disabled?: boolean;
  sessionKey?: string;
  scopeRef: RefObject<HTMLElement | null>;
}) {
  const position = useRef<number | null>(null);
  const inheritedDisabled = useContext(DisabledContext);
  useEffect(() => {
    position.current = null;
    if (!editor) return;
    const select = () => { position.current = editor.state.selection.to; };
    const map = ({ transaction }: { transaction: Parameters<Editor['view']['dispatch']>[0] }) => {
      if (position.current !== null) position.current = transaction.mapping.map(position.current);
    };
    editor.on('selectionUpdate', select);
    editor.on('focus', select);
    editor.on('transaction', map);
    return () => { editor.off('selectionUpdate', select); editor.off('focus', select); editor.off('transaction', map); };
  }, [editor, sessionKey]);
  return <VoiceDictation scopeRef={scopeRef} disabled={disabled || inheritedDisabled || !editor}
    sessionKey={sessionKey}
    onStart={() => {
      if (editor && position.current === null) {
        const { doc } = editor.state;
        position.current = doc.content.size - (doc.lastChild?.isTextblock ? 1 : 0);
      }
    }}
    onFinal={text => {
      if (!editor || editor.isDestroyed || !editor.isEditable) return;
      const { doc } = editor.state;
      const at = Math.max(0, Math.min(position.current ?? doc.content.size, doc.content.size));
      if (!doc.resolve(at).parent.inlineContent) {
        // A document ending in an image/list needs a text block for the new speech.
        const paragraph = editor.schema.nodes.paragraph.create(null, editor.schema.text(text));
        editor.view.dispatch(editor.state.tr.insert(at, paragraph));
        position.current = at + 1 + text.length;
        return;
      }
      const insertion = dictationText(text, doc.textBetween(Math.max(0, at - 1), at),
        doc.textBetween(at, Math.min(at + 1, doc.content.size)));
      // insertText preserves marks and history, and never parses speech as HTML.
      editor.view.dispatch(editor.state.tr.insertText(insertion, at, at));
      position.current = at + insertion.length;
    }} />;
}
