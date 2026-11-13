import { EventEmitter } from 'node:events';
import { describe, expect, it } from 'vitest';
import type { Page } from '../ipc/page';
import { TerminalSizes } from './terminalSizes';

// O mesmo terminal em duas páginas (computador de casa e notebook): o processo fica com o tamanho de
// quem clicou ou digitou por último, e cada página fica sabendo se é ela quem manda. Antes, valia o
// último tamanho que chegasse, e a outra página recebia um desenho de outra largura (letras
// embaralhadas no `claude`, 2026-11-11).

let nextId = 1;
function page(): Page & { gone: () => void } {
  const e = new EventEmitter();
  let destroyed = false;
  return Object.assign(e, {
    id: nextId++,
    send: () => {},
    isDestroyed: () => destroyed,
    gone: () => {
      destroyed = true;
      e.emit('destroyed');
    },
  }) as never;
}

function setup() {
  let pty = { cols: 80, rows: 24 };
  const notes: { cols: number; rows: number; owner: Page | null }[] = [];
  const sizes = new TerminalSizes(
    (_k, cols, rows) => (pty = { cols, rows }),
    () => pty,
    (_k, size, owner) => notes.push({ ...size, owner }),
  );
  return { sizes, notes, pty: () => pty };
}

describe('tamanho do terminal em mais de uma página', () => {
  it('quem clica manda; a outra página não muda o tamanho, só anota o dela', () => {
    const { sizes, pty, notes } = setup();
    const home = page();
    const laptop = page();
    sizes.request(home, 't', 200, 50, true);
    sizes.request(laptop, 't', 100, 30, false);
    expect(pty()).toEqual({ cols: 200, rows: 50 });
    expect(notes.at(-1)?.owner).toBe(home);
    sizes.request(laptop, 't', 100, 30, true);
    expect(pty()).toEqual({ cols: 100, rows: 30 });
    expect(notes.at(-1)?.owner).toBe(laptop);
  });

  it('digitar numa página passa o tamanho para o que ela tinha medido', () => {
    const { sizes, pty, notes } = setup();
    const home = page();
    const laptop = page();
    sizes.request(laptop, 't', 100, 30, true);
    sizes.request(home, 't', 200, 50, false);
    sizes.typed(home, 't');
    expect(pty()).toEqual({ cols: 200, rows: 50 });
    expect(notes.at(-1)?.owner).toBe(home);
    // Digitar de novo na dona não avisa ninguém.
    const count = notes.length;
    sizes.typed(home, 't');
    expect(notes).toHaveLength(count);
  });

  it('a dona fechou: a próxima página que medir passa a mandar', () => {
    const { sizes, pty } = setup();
    const home = page();
    const laptop = page();
    sizes.request(home, 't', 200, 50, true);
    home.gone();
    sizes.request(laptop, 't', 100, 30, false);
    expect(pty()).toEqual({ cols: 100, rows: 30 });
  });
});
