import { createServer, type AddressInfo, type Server, type Socket } from 'node:net';

// Lado do notebook do "abrir localhost" pela janela de acesso remoto (o outro lado está em
// tunnelHost.ts). Abre aqui a mesma porta do servidor que roda no outro computador (ou outra, se
// estiver ocupada) e cada conexão do navegador daqui vai, pela ligação cifrada, para o localhost de
// lá. Só escuta neste computador (127.0.0.1 e ::1): ninguém da rede entra.

// Manda uma mensagem ao Argus de lá pela janela `w`; falso sem ligação.
type Send = (w: number, channel: string, args: unknown[]) => boolean;

type Listening = { servers: Server[]; local: number; w: number };

export class TunnelClient {
  // Porta de lá → o que escuta aqui.
  private listening = new Map<number, Listening>();
  // Conexões abertas: id (o de lá usa o mesmo) → conexão do navegador daqui.
  private sockets = new Map<number, { socket: Socket; w: number }>();
  private nextId = 1;

  constructor(private send: Send) {}

  // A porta daqui que leva à `port` de lá (a mesma, se estiver livre).
  async open(w: number, port: number): Promise<number> {
    const current = this.listening.get(port);
    if (current) return current.local;
    const onConnection = (socket: Socket) => this.accept(w, port, socket);
    const bound = await listenLocal(port, onConnection).catch(() => listenLocal(0, onConnection));
    // Duas chamadas ao mesmo tempo: fica a primeira.
    const raced = this.listening.get(port);
    if (raced) {
      for (const s of bound.servers) s.close();
      return raced.local;
    }
    this.listening.set(port, { ...bound, w });
    return bound.local;
  }

  private accept(w: number, port: number, socket: Socket): void {
    const id = this.nextId++;
    socket.on('error', () => {});
    if (!this.send(w, 'tunnel:open', [id, port])) return void socket.destroy();
    this.sockets.set(id, { socket, w });
    socket.on('data', (chunk) => this.send(w, 'tunnel:data', [id, chunk]));
    socket.on('close', () => {
      if (this.sockets.delete(id)) this.send(w, 'tunnel:close', [id]);
    });
  }

  // Aviso do Argus de lá para uma conexão: bytes do servidor, ou o servidor fechou.
  event(channel: string, args: unknown[]): void {
    const [id, data] = args;
    const entry = typeof id === 'number' ? this.sockets.get(id) : undefined;
    if (!entry) return;
    if (channel === 'tunnel:data' && ArrayBuffer.isView(data)) {
      entry.socket.write(Buffer.from(data.buffer, data.byteOffset, data.byteLength));
    } else if (channel === 'tunnel:close') {
      this.sockets.delete(id as number);
      entry.socket.end();
      setTimeout(() => entry.socket.destroy(), 5000).unref();
    }
  }

  // A ligação caiu: as conexões em andamento acabam (lá também). As portas seguem abertas aqui, para
  // quando a ligação voltar.
  dropConnections(): void {
    const all = [...this.sockets.values()];
    this.sockets.clear();
    for (const { socket } of all) socket.destroy();
  }

  // A janela que abriu fechou: as portas dela fecham.
  closeWindow(w: number): void {
    for (const [port, l] of this.listening) {
      if (l.w !== w) continue;
      for (const s of l.servers) s.close();
      this.listening.delete(port);
    }
    for (const [id, { socket, w: sw }] of this.sockets) {
      if (sw !== w) continue;
      this.sockets.delete(id);
      socket.destroy();
    }
  }

  closeAll(): void {
    this.dropConnections();
    for (const l of this.listening.values()) for (const s of l.servers) s.close();
    this.listening.clear();
  }
}

// Escuta só neste computador, no IPv4 e no IPv6 na mesma porta: o navegador pode ir a qualquer um
// dos dois ao abrir "localhost", e um outro servidor daqui num deles responderia no lugar. Sem IPv6
// na máquina, fica só o IPv4. Porta 0: a que o sistema der.
async function listenLocal(port: number, onConnection: (s: Socket) => void): Promise<{ servers: Server[]; local: number }> {
  const v4 = createServer(onConnection);
  const local = await listen(v4, port, '127.0.0.1');
  const v6 = createServer(onConnection);
  try {
    await listen(v6, local, '::1');
    return { servers: [v4, v6], local };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'EADDRINUSE') {
      v4.close();
      throw err;
    }
    return { servers: [v4], local };
  }
}

function listen(server: Server, port: number, host: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const fail = (err: Error) => {
      server.off('listening', ok);
      reject(err);
    };
    const ok = () => {
      server.off('error', fail);
      resolve((server.address() as AddressInfo).port);
    };
    server.once('error', fail);
    server.once('listening', ok);
    server.listen(port, host);
  });
}
