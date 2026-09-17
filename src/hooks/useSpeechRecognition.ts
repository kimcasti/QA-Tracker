import { useCallback, useEffect, useRef, useState } from 'react';

type RecognitionResult = { isFinal: boolean; [index: number]: { transcript: string } };
type RecognitionEvent = { resultIndex: number; results: ArrayLike<RecognitionResult> };
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type RecognitionConstructor = new () => Recognition;
function recognitionConstructor() {
  if (typeof window === 'undefined') return undefined;
  const browser = window as typeof window & {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  };
  return browser.SpeechRecognition || browser.webkitSpeechRecognition;
}

// Browser recognition is shared: a new field invalidates the previous session.
let cancelActive: (() => void) | undefined;
const errors: Record<string, string> = {
  'not-allowed': 'Permiso denegado. Habilita el micrófono en los permisos del navegador.',
  'service-not-allowed': 'El navegador no permite usar el servicio de dictado.',
  'audio-capture': 'No se pudo acceder al micrófono. Comprueba que esté conectado y disponible.',
  'no-speech': 'No se detectó voz. Pulsa el micrófono para intentarlo de nuevo.',
  network: 'Falló la conexión con el servicio de dictado. Comprueba tu conexión e inténtalo de nuevo.',
  'language-not-supported': 'El servicio no admite el idioma español seleccionado.',
};

export function useSpeechRecognition({ onFinal, canListen, disabled, sessionKey }: {
  onFinal: (text: string) => void;
  canListen: () => boolean;
  disabled?: boolean;
  sessionKey?: unknown;
}) {
  const [status, setStatus] = useState<'idle' | 'starting' | 'listening' | 'stopping'>('idle');
  const [interim, setInterim] = useState('');
  const [error, setError] = useState('');
  const current = useRef<Recognition | null>(null);
  const stopTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const latest = useRef({ onFinal, canListen, disabled, sessionKey });
  latest.current = { onFinal, canListen, disabled, sessionKey };
  const cancel = useCallback(() => {
    clearTimeout(stopTimer.current);
    stopTimer.current = undefined;
    const instance = current.current;
    current.current = null;
    if (cancelActive === cancel) cancelActive = undefined;
    if (instance) {
      instance.onresult = instance.onerror = instance.onend = instance.onstart = null;
      try { instance.abort(); } catch { /* Already ended. */ }
    }
    setStatus('idle');
    setInterim('');
  }, []);

  useEffect(() => cancel, [cancel, sessionKey]);
  useEffect(() => { if (disabled) cancel(); }, [disabled, cancel]);

  const start = () => {
    const Constructor = recognitionConstructor();
    if (!Constructor || latest.current.disabled || !latest.current.canListen()) return;
    cancelActive?.();
    setError('');
    setInterim('');
    const key = latest.current.sessionKey;
    const seen = new Set<number>();
    let instance: Recognition;
    try { instance = new Constructor(); } catch {
      setError('No se pudo iniciar el servicio de dictado. Inténtalo de nuevo.');
      return;
    }
    current.current = instance;
    cancelActive = cancel;
    const valid = () => current.current === instance && !latest.current.disabled
      && latest.current.sessionKey === key && latest.current.canListen();
    instance.lang = 'es-CO';
    instance.continuous = true;
    instance.interimResults = true;
    instance.onstart = () => {
      if (current.current !== instance) return;
      if (valid()) { if (!stopTimer.current) setStatus('listening'); } else cancel();
    };
    instance.onresult = event => {
      if (current.current !== instance) return;
      if (!valid()) { cancel(); return; }
      const pending: string[] = [];
      for (let i = 0; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (result.isFinal) {
          if (!seen.has(i)) {
            seen.add(i);
            const text = result[0]?.transcript.trim();
            if (text) latest.current.onFinal(text);
          }
        } else pending.push(result[0]?.transcript || '');
      }
      setInterim(pending.join(' '));
    };
    instance.onerror = event => {
      if (current.current !== instance) return;
      if (event.error !== 'aborted') setError(errors[event.error] || 'No se pudo transcribir. Inténtalo de nuevo.');
      cancel();
    };
    instance.onend = () => { if (current.current === instance) cancel(); };
    setStatus('starting');
    try { instance.start(); } catch {
      setError('No se pudo iniciar el micrófono. Comprueba los permisos e inténtalo de nuevo.');
      cancel();
    }
  };
  const stop = () => {
    if (!current.current || status === 'stopping') return;
    setStatus('stopping');
    stopTimer.current = setTimeout(() => {
      setError('El servicio no finalizó el dictado. Puedes volver a intentarlo.');
      cancel();
    }, 8000);
    try { current.current.stop(); } catch { cancel(); }
  };
  return { supported: Boolean(recognitionConstructor()), status, interim, error, start, stop, cancel };
}
