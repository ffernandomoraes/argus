// Os computadores ligados agora, por pessoa, cada um com o fluxo aberto (GET /api/notices/stream).
// Só na memória: aviso não fica guardado, e quem estava desligado não recebe depois. Um servidor só
// (a Railway roda uma instância); com mais de uma, isto teria de passar por fora (Redis).

// Um fluxo aberto: `write` devolve false quando não deu para escrever (fechado, ou o computador não
// está lendo e o fluxo foi derrubado); `close` encerra (o fluxo sai do hub ao fechar).
export type Listener = { sessionId: string; write(chunk: string): boolean; close(): void };

export type Notice = { from: string; title: string; body: string; kind: string; hostId?: string };

// Fluxos por pessoa (somando os computadores) e no servidor todo.
export const MAX_STREAMS_PER_USER = 10;
export const MAX_STREAMS = 5000;

export class NoticeHub {
  private readonly listeners = new Map<string, Set<Listener>>();
  private total = 0;

  // Nulo: o servidor está cheio. O fluxo anterior do mesmo computador fecha (ele reconectou), e
  // passando do limite da pessoa, o mais antigo dela.
  add(userId: string, listener: Listener): (() => void) | null {
    const set = this.listeners.get(userId) ?? new Set<Listener>();
    for (const l of set) if (l.sessionId === listener.sessionId) this.drop(userId, set, l);
    while (set.size >= MAX_STREAMS_PER_USER) this.drop(userId, set, set.values().next().value!);
    if (this.total >= MAX_STREAMS) return null;
    set.add(listener);
    this.total++;
    this.listeners.set(userId, set);
    return () => this.remove(userId, set, listener);
  }

  // Para os outros computadores da pessoa ligados agora; devolve para quantos foi.
  send(userId: string, fromSession: string, notice: Notice): number {
    let sent = 0;
    for (const l of [...(this.listeners.get(userId) ?? [])]) {
      if (l.sessionId === fromSession) continue;
      if (l.write(`event: notice\ndata: ${JSON.stringify(notice)}\n\n`)) sent++;
    }
    return sent;
  }

  // Para todos os computadores ligados da pessoa (o "device-removed": um aparelho saiu da conta, e o
  // computador de casa desfaz o acesso remoto que ele abriu pela conta).
  broadcast(userId: string, event: string, data: unknown): number {
    let sent = 0;
    for (const l of [...(this.listeners.get(userId) ?? [])]) if (l.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)) sent++;
    return sent;
  }

  // Sessão encerrada (saiu, foi removida): o fluxo dela fecha.
  closeSession(sessionId: string): void {
    for (const [userId, set] of [...this.listeners]) for (const l of [...set]) if (l.sessionId === sessionId) this.drop(userId, set, l);
  }

  // Conta apagada: todos os fluxos dela fecham.
  closeUser(userId: string): void {
    const set = this.listeners.get(userId);
    if (set) for (const l of [...set]) this.drop(userId, set, l);
  }

  get size(): number {
    return this.total;
  }

  private drop(userId: string, set: Set<Listener>, listener: Listener): void {
    this.remove(userId, set, listener);
    listener.close();
  }

  private remove(userId: string, set: Set<Listener>, listener: Listener): void {
    if (!set.delete(listener)) return;
    this.total--;
    if (!set.size && this.listeners.get(userId) === set) this.listeners.delete(userId);
  }
}

// Um por servidor.
export const noticeHub = new NoticeHub();
