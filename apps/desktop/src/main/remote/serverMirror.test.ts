import { describe, expect, it } from 'vitest';
import { ServerMirror } from './serverMirror';

// O túnel de mentira: portas daqui ocupadas por outro programa abrem na seguinte livre.
function setup(busyHere: number[] = []) {
  let remote: number[] = [];
  const open = new Map<number, number>();
  const moved: [number, number][] = [];
  const mirror = new ServerMirror({
    list: async () => remote,
    open: async (port) => {
      let local = port;
      while (busyHere.includes(local) || [...open.values()].includes(local)) local++;
      open.set(port, local);
      return local;
    },
    isOpen: (port) => open.has(port),
    close: (port) => void open.delete(port),
    moved: (port, local) => void moved.push([port, local]),
  });
  return { mirror, open, moved, setRemote: (ports: number[]) => (remote = ports) };
}

describe('ServerMirror', () => {
  it('abre aqui as portas que apareceram lá e fecha as que sumiram', async () => {
    const t = setup();
    t.setRemote([3000, 5173]);
    await t.mirror.sync();
    expect([...t.open]).toEqual([
      [3000, 3000],
      [5173, 5173],
    ]);
    t.setRemote([5173]);
    await t.mirror.sync();
    expect([...t.open.keys()]).toEqual([5173]);
    expect(t.moved).toEqual([]);
  });

  it('porta ocupada aqui: abre em outra e avisa uma vez só', async () => {
    const t = setup([3000]);
    t.setRemote([3000]);
    await t.mirror.sync();
    await t.mirror.sync();
    expect(t.open.get(3000)).toBe(3001);
    expect(t.moved).toEqual([[3000, 3001]]);
  });

  it('não fecha a porta aberta por um clique, mesmo sem servidor na lista', async () => {
    const t = setup();
    t.open.set(8080, 8080);
    t.setRemote([]);
    await t.mirror.sync();
    expect(t.open.has(8080)).toBe(true);
  });

  it('reabre a porta que fechou junto com a janela', async () => {
    const t = setup();
    t.setRemote([3000]);
    await t.mirror.sync();
    t.open.clear();
    await t.mirror.sync();
    expect(t.open.get(3000)).toBe(3000);
  });

  it('ignora portas inválidas vindas de lá', async () => {
    const t = setup();
    t.setRemote([0, -1, 70000, 3.5, 4000]);
    await t.mirror.sync();
    expect([...t.open.keys()]).toEqual([4000]);
  });
});
