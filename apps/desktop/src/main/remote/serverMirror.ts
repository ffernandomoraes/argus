// No notebook: espelha aqui as portas dos servidores que rodam no outro computador. A cada poucos
// segundos pergunta ao Argus de lá quais estão rodando (devServers:ports) e abre a mesma porta neste
// computador pelo túnel (tunnelClient.ts): `localhost:3000` no navegador daqui chega ao servidor de
// lá, sem clicar em nada. Servidor que parou lá, a porta fecha aqui. Porta já em uso aqui: abre em
// outra e avisa a janela uma vez.

const POLL_MS = 3000;

export type MirrorDeps = {
  // Portas dos servidores de lá.
  list: () => Promise<number[]>
  // Abre aqui a porta que leva à `port` de lá; devolve a daqui.
  open: (port: number) => Promise<number>
  // Já aberta aqui (pelo espelho ou por um clique em "Abrir").
  isOpen: (port: number) => boolean
  close: (port: number) => void
  // Abriu aqui noutra porta.
  moved: (port: number, local: number) => void
};

export class ServerMirror {
  // Portas de lá que o espelho abriu (as abertas por um clique ficam até a janela fechar).
  private mine = new Set<number>();
  private warned = new Set<number>();
  private running = false;
  private ticking = false;
  private timer: NodeJS.Timeout | undefined;

  constructor(
    private deps: MirrorDeps,
    private pollMs = POLL_MS,
  ) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    if (!this.ticking && !this.timer) void this.tick();
  }

  // Ligação caída ou encerrada: para de perguntar. As portas abertas ficam (o túnel decide).
  stop(): void {
    this.running = false;
    clearTimeout(this.timer);
    this.timer = undefined;
  }

  // Uma volta: abre aqui o que apareceu lá e fecha o que sumiu.
  async sync(): Promise<void> {
    const ports = new Set((await this.deps.list()).filter(validPort));
    for (const port of [...this.mine]) {
      if (ports.has(port)) continue;
      this.mine.delete(port);
      this.warned.delete(port);
      this.deps.close(port);
    }
    for (const port of ports) {
      if (this.deps.isOpen(port)) continue;
      try {
        const local = await this.deps.open(port);
        this.mine.add(port);
        if (local !== port && !this.warned.has(port)) {
          this.warned.add(port);
          this.deps.moved(port, local);
        }
      } catch {
        // Tenta de novo na próxima volta.
      }
    }
  }

  private async tick(): Promise<void> {
    this.timer = undefined;
    this.ticking = true;
    try {
      await this.sync();
    } catch {
      // Sem resposta de lá (ligação caindo, Argus de lá numa versão sem devServers:ports).
    }
    this.ticking = false;
    if (this.running) this.timer = setTimeout(() => void this.tick(), this.pollMs);
  }
}

const validPort = (port: unknown): port is number => Number.isInteger(port) && (port as number) > 0 && (port as number) < 65536;
