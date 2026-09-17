import { AudioOutlined, StopOutlined } from '@ant-design/icons';
import { Button, Tooltip } from 'antd';
import { useEffect, useRef, type RefObject } from 'react';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';

export function isDictationVisible(element: HTMLElement | null) {
  return Boolean(element?.isConnected && element.getClientRects().length
    && !element.closest('[hidden], [aria-hidden="true"], [inert]')
    && getComputedStyle(element).visibility !== 'hidden');
}

export default function VoiceDictation({ onFinal, onStart, disabled, sessionKey, scopeRef }: {
  onFinal: (text: string) => void;
  onStart?: () => void;
  disabled?: boolean;
  sessionKey?: unknown;
  scopeRef: RefObject<HTMLElement | null>;
}) {
  const buttonScope = useRef<HTMLDivElement>(null);
  const speech = useSpeechRecognition({ onFinal, disabled, sessionKey,
    canListen: () => isDictationVisible(buttonScope.current) });
  const active = speech.status !== 'idle';
  useEffect(() => {
    if (!active) return;
    const check = () => {
      if (document.hidden || !isDictationVisible(buttonScope.current)) speech.cancel();
    };
    const leave = (event: Event) => {
      if (event.target instanceof Node && !scopeRef.current?.contains(event.target)) speech.cancel();
    };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') speech.cancel(); };
    // Ant Design can keep closed modal children mounted. Observe ancestor visibility too.
    const observer = new MutationObserver(check);
    let ancestor: HTMLElement | null = buttonScope.current;
    while (ancestor) {
      observer.observe(ancestor, { attributes: true, attributeFilter: ['class', 'style', 'hidden', 'aria-hidden', 'inert'] });
      ancestor = ancestor.parentElement;
    }
    document.addEventListener('visibilitychange', check);
    document.addEventListener('pointerdown', leave, true);
    document.addEventListener('focusin', leave, true);
    document.addEventListener('keydown', escape, true);
    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', check);
      document.removeEventListener('pointerdown', leave, true);
      document.removeEventListener('focusin', leave, true);
      document.removeEventListener('keydown', escape, true);
    };
  }, [active, speech.cancel, scopeRef]);
  if (disabled) return null;
  const label = active ? 'Detener dictado' : 'Iniciar dictado';
  return (
    <div ref={buttonScope} className="flex max-w-full flex-wrap items-center gap-2">
      <Tooltip title={speech.supported
        ? 'Dictar en español. El navegador puede enviar el audio a su servicio de reconocimiento.'
        : 'Este navegador no admite dictado por voz. Puedes escribir manualmente.'}>
        <span>
          <Button size="small" htmlType="button" aria-label={label} aria-pressed={active}
            disabled={!speech.supported || speech.status === 'stopping'}
            type={active ? 'primary' : 'default'} danger={active}
            icon={active ? <StopOutlined /> : <AudioOutlined />}
            onMouseDown={event => event.preventDefault()}
            onClick={() => { if (active) speech.stop(); else { onStart?.(); speech.start(); } }} />
        </span>
      </Tooltip>
      <span role="status" className="text-xs text-slate-600">
        {speech.status === 'starting' ? 'Iniciando micrófono…' : speech.status === 'listening'
          ? 'Escuchando…' : speech.status === 'stopping' ? 'Finalizando dictado…' : ''}
        {speech.interim && <span className="ml-1 italic">{speech.interim}</span>}
      </span>
      {speech.error && <span role="alert" className="text-xs text-red-600">{speech.error}</span>}
    </div>
  );
}
