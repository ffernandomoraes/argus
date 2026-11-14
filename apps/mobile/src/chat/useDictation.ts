import { useEffect, useRef, useState } from 'react';
import { tr } from '../i18n';

// Ditado pelo reconhecimento de voz do navegador (onde houver), na caixa de escrever do celular.

type SpeechRecognitionLike = {
  lang: string
  continuous: boolean
  interimResults: boolean
  start(): void
  stop(): void
  onresult: ((e: { results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null
  onend: (() => void) | null
  onerror: ((e: { error?: string }) => void) | null
};

const Recognition =
  (globalThis as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike }).SpeechRecognition ??
  (globalThis as { webkitSpeechRecognition?: new () => SpeechRecognitionLike }).webkitSpeechRecognition;

// A fala inteira até agora: frases fechadas e a que ainda está sendo revisada. Alguns navegadores
// (Android, iPhone) repetem no resultado novo o texto dos anteriores; aí o novo substitui.
function spokenText(results: ArrayLike<{ 0: { transcript: string } }>): string {
  let all = '';
  for (let i = 0; i < results.length; i++) {
    const part = results[i][0].transcript.trim();
    if (!part) continue;
    all = !all || part.startsWith(all) ? part : `${all} ${part}`;
  }
  return all;
}

function dictationError(code?: string): string | null {
  if (code === 'aborted' || code === 'no-speech') return null;
  if (code === 'not-allowed' || code === 'service-not-allowed') {
    return tr('Sem permissão de microfone ou de reconhecimento de voz. Libere nos ajustes do celular.', 'No microphone or speech recognition permission. Allow it in the phone settings.');
  }
  return tr(`O ditado parou (${code ?? 'erro'}).`, `Dictation stopped (${code ?? 'error'}).`);
}

// onText recebe a fala acumulada (com o trecho ainda sendo revisado), para o texto aparecer
// enquanto a pessoa fala; onStart marca o começo, para quem usa saber onde encaixar.
export function useDictation(onStart: () => void, onText: (spoken: string) => void, onError: (message: string) => void) {
  const [on, setOn] = useState(false);
  const rec = useRef<SpeechRecognitionLike | null>(null);
  const handlers = useRef({ onStart, onText, onError });
  handlers.current = { onStart, onText, onError };
  useEffect(() => () => rec.current?.stop(), []);
  if (!Recognition) return null;
  const toggle = () => {
    if (on) return rec.current?.stop();
    const r = new Recognition();
    r.lang = navigator.language;
    r.continuous = true;
    r.interimResults = true;
    r.onresult = (e) => handlers.current.onText(spokenText(e.results));
    r.onend = () => {
      if (rec.current === r) rec.current = null;
      setOn(false);
    };
    r.onerror = (e) => {
      const message = dictationError(e.error);
      if (message) handlers.current.onError(message);
    };
    rec.current = r;
    handlers.current.onStart();
    try {
      r.start();
      setOn(true);
    } catch {
      setOn(false);
    }
  };
  const stop = () => rec.current?.stop();
  return { on, toggle, stop };
}
