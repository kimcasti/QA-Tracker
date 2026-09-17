import { Input } from 'antd';
import DisabledContext from 'antd/es/config-provider/DisabledContext';
import type { TextAreaProps, TextAreaRef } from 'antd/es/input/TextArea';
import { forwardRef, useContext, useEffect, useRef } from 'react';
import VoiceDictation from './VoiceDictation';
import { dictationText } from '../utils/dictationText';

export type VoiceTextAreaProps = TextAreaProps & { voiceSessionKey?: string };

const VoiceTextArea = forwardRef<TextAreaRef, VoiceTextAreaProps>(function VoiceTextArea(
  { voiceSessionKey, ...props }, forwardedRef,
) {
  const scopeRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<TextAreaRef | null>(null);
  const selection = useRef<number | null>(null);
  const inheritedDisabled = useContext(DisabledContext);
  const disabled = props.disabled ?? inheritedDisabled;
  const expectedValue = useRef(props.value);
  const revision = useRef(0);
  if (props.value !== expectedValue.current) {
    expectedValue.current = props.value;
    selection.current = null;
    revision.current += 1;
  }
  useEffect(() => { selection.current = null; }, [voiceSessionKey]);
  const getElement = () => inputRef.current?.resizableTextArea?.textArea;
  return (
    <div ref={scopeRef} className="min-w-0 space-y-1">
      <Input.TextArea {...props} ref={node => {
        inputRef.current = node;
        if (typeof forwardedRef === 'function') forwardedRef(node);
        else if (forwardedRef) forwardedRef.current = node;
      }} onSelect={event => {
        selection.current = event.currentTarget.selectionEnd;
        props.onSelect?.(event);
      }} onChange={event => {
        selection.current = event.target.selectionEnd;
        if (props.value !== undefined) expectedValue.current = event.target.value;
        props.onChange?.(event);
      }} />
      <VoiceDictation scopeRef={scopeRef} disabled={disabled || props.readOnly}
        sessionKey={`${voiceSessionKey || ''}:${revision.current}`}
        onFinal={text => {
          const element = getElement();
          if (!element || element.disabled || element.readOnly) return;
          const current = element.value;
          const position = Math.min(selection.current ?? current.length, current.length);
          let insertion = dictationText(text, current.slice(0, position), current.slice(position));
          if (props.maxLength !== undefined) {
            const available = Math.max(0, props.maxLength - current.length);
            let prefix = '';
            for (const character of insertion) {
              if (prefix.length + character.length > available) break;
              prefix += character;
            }
            insertion = prefix;
          }
          if (!insertion) return;
          const next = current.slice(0, position) + insertion + current.slice(position);
          // Dispatch through React/Ant Design's real input path, preserving Form events,
          // uncontrolled fields, validation and character counters.
          const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
          setter?.call(element, next);
          element.setSelectionRange(position + insertion.length, position + insertion.length);
          element.dispatchEvent(new Event('input', { bubbles: true }));
          selection.current = position + insertion.length;
        }} />
    </div>
  );
});

export default VoiceTextArea;
