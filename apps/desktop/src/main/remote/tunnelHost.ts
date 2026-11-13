import { connect, type Socket } from 'node:net';
import type { Page } from '../ipc/page';

// Lado do Argus de casa do "abrir localhost" pela janela de acesso remoto (o outro lado está em
// tunnelClient.ts). Cada conexão que o navegador do notebook abre vira uma conexão daqui com o
// localhost deste computador, na mesma porta; os bytes vão e voltam pela ligação cifrada. Só páginas
// remotas pedem (quem chama confere), e tudo fecha junto com a página (janela fechada, ligação caída).

// Por página remota: id da conexão (dado pelo notebook) → conexão com o servidor daqui.
const byPage = new Map<Page, Map<number, Socket>>();

function socketsOf(page: Page): Map<number, Socket> {
  let sockets = byPage.get(page);
  if (sockets) return sockets;
  sockets = new Map();
  byPage.set(page, sockets);
  page.once('destroyed', () => {
    for (const s of byPage.get(page)?.values() ?? []) s.destroy();
    byPage.delete(page);
  });
  return sockets;
}

const validId = (id: unknown): id is number => Number.isSafeInteger(id) && (id as number) > 0;
const validPort = (port: unknown): port is number => Number.isInteger(port) && (port as number) > 0 && (port as number) < 65536;

export function tunnelOpen(page: Page, id: unknown, port: unknown): void {
  if (!validId(id) || !validPort(port)) return;
  const sockets = socketsOf(page);
  if (sockets.has(id)) return;
  // localhost: o servidor pode escutar no IPv4 ou no IPv6; o Node tenta os dois.
  const socket = connect({ host: 'localhost', port, autoSelectFamily: true });
  sockets.set(id, socket);
  socket.on('data', (chunk) => page.send('tunnel:data', id, chunk));
  socket.on('error', () => {});
  socket.on('close', () => {
    if (sockets.get(id) !== socket) return;
    sockets.delete(id);
    page.send('tunnel:close', id);
  });
}

export function tunnelData(page: Page, id: unknown, data: unknown): void {
  if (!validId(id) || !ArrayBuffer.isView(data)) return;
  const socket = byPage.get(page)?.get(id);
  // Escrito antes de conectar: o Node guarda e manda ao conectar.
  if (socket && !socket.destroyed) socket.write(Buffer.from(data.buffer, data.byteOffset, data.byteLength));
}

export function tunnelClose(page: Page, id: unknown): void {
  if (!validId(id)) return;
  const sockets = byPage.get(page);
  const socket = sockets?.get(id);
  if (!socket) return;
  sockets!.delete(id);
  socket.end();
  // Sem resposta ao fim educado: fecha de vez.
  setTimeout(() => socket.destroy(), 5000).unref();
}
