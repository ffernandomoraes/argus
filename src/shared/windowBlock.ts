// Aviso de janela travada: a janela manda "estou viva" ao processo principal a cada WINDOW_POLL_MS, e
// o vigia dela, que roda no processo principal, avisa depois de WINDOW_BLOCK_MS sem o sinal (ver
// src/renderer/src/errorReports.ts e src/main/errorReports/snapshot.ts).
export const WINDOW_BLOCK_MS = 5000
export const WINDOW_POLL_MS = 1000
