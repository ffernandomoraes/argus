// A ligação entre os dois Argus: leva bytes nos dois sentidos, na ordem em que foram mandados. Quem
// fala por cima dela (host.ts e client.ts) não sabe por onde ela passa: a ponte na internet, com
// criptografia de ponta a ponta, ou um par na memória para testar sem rede (`memoryLinks`).

export interface Link {
  send(data: Buffer): void
  onMessage(cb: (data: Buffer) => void): void
  // Chamado uma vez, quando a ligação acaba (de qualquer um dos lados).
  onClose(cb: () => void): void
  close(): void
}

// Duas pontas ligadas na memória. A entrega fica para depois (como numa rede, nunca no meio de
// quem mandou), e cada lado recebe uma cópia dos bytes. Fechar entrega antes o que já foi mandado,
// como o WebSocket: o motivo de uma recusa, mandado logo antes de fechar, chega.
export function memoryLinks(): [Link, Link] {
  type Side = { message: ((d: Buffer) => void)[]; close: (() => void)[] };
  const sides: [Side, Side] = [
    { message: [], close: [] },
    { message: [], close: [] },
  ];
  let closed = false;
  const shut = (): void => {
    if (closed) return;
    closed = true;
    setImmediate(() => sides.forEach((s) => s.close.forEach((cb) => cb())));
  };
  const end = (mine: number): Link => {
    const other = sides[1 - mine];
    return {
      send: (data) => {
        if (closed) return;
        const copy = Buffer.from(data);
        setImmediate(() => other.message.forEach((cb) => cb(copy)));
      },
      onMessage: (cb) => void sides[mine].message.push(cb),
      onClose: (cb) => void sides[mine].close.push(cb),
      close: shut,
    };
  };
  return [end(0), end(1)];
}
