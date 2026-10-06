// Eventos do ditado, na ordem: ready → text (várias vezes, texto acumulado) → done.
export type SpeechEvent =
  | { type: 'ready' }
  // Volume da voz, de 0 a 1, umas 20 vezes por segundo (para as ondas).
  | { type: 'level'; value: number }
  | { type: 'text'; text: string }
  | { type: 'warning'; message: string }
  // action: o app pode oferecer um botão para resolver (ex.: abrir os Ajustes do Ditado).
  | { type: 'error'; message: string; action?: 'dictation-settings' }
  | { type: 'done'; text: string }
