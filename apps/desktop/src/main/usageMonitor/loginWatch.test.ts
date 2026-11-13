import { beforeEach, describe, expect, it, vi } from 'vitest';

// Login trocado por fora (no terminal) com o app aberto: o monitor de uso seguia lendo a conta
// anterior, com o login que tinha em memória, até ele vencer.

const fake = vi.hoisted(() => ({ email: undefined as string | undefined, asked: [] as { id: string; place?: string }[], fails: false }));

vi.mock('../auth/status', () => ({
  configEmail: (id: string, place?: string) => {
    fake.asked.push({ id, place });
    return fake.fails ? Promise.reject(new Error('WSL travado')) : Promise.resolve(fake.email);
  },
}));

import { LoginWatch } from './loginWatch';

let changed: ReturnType<typeof vi.fn<(account: string, inWsl: boolean) => void>>;
let watch: LoginWatch;

beforeEach(() => {
  fake.email = 'ana@x.com';
  fake.asked = [];
  fake.fails = false;
  changed = vi.fn<(account: string, inWsl: boolean) => void>();
  watch = new LoginWatch(changed);
});

describe('LoginWatch', () => {
  it('mesmo e-mail (maiúsculas não contam): segue', async () => {
    expect(await watch.same('main', 'main', 'Ana@x.com')).toBe(true);
    expect(changed).not.toHaveBeenCalled();
  });

  it('outro e-mail no arquivo: avisa o app e segura a leitura', async () => {
    fake.email = 'bia@x.com';
    expect(await watch.same('main', 'main', 'ana@x.com')).toBe(false);
    expect(changed).toHaveBeenCalledExactlyOnceWith('main', false);
  });

  // O arquivo e a conferência do app discordando para sempre: sem isso, a barra ficava parada e o app
  // conferia o login a cada leitura.
  it('avisa uma vez só por e-mail visto, e não segura as leituras seguintes', async () => {
    fake.email = 'bia@x.com';
    await watch.same('main', 'main', 'ana@x.com');
    expect(await watch.same('main', 'main', 'ana@x.com')).toBe(true);
    expect(changed).toHaveBeenCalledTimes(1);

    watch.forget('main');
    expect(await watch.same('main', 'main', 'ana@x.com')).toBe(false);
    expect(changed).toHaveBeenCalledTimes(2);
  });

  it('arquivo ilegível, sem e-mail, ou conta sem e-mail conferido (chave de API): segue', async () => {
    fake.email = undefined;
    expect(await watch.same('main', 'main', 'ana@x.com')).toBe(true);
    fake.fails = true;
    expect(await watch.same('main', 'main', 'ana@x.com')).toBe(true);
    fake.fails = false;
    fake.email = 'bia@x.com';
    expect(await watch.same('main', 'main', undefined)).toBe(true);
    expect(changed).not.toHaveBeenCalled();
  });

  it('o login de dentro do WSL é lido na pasta de lá e avisado como do WSL', async () => {
    fake.email = 'bia@x.com';
    expect(await watch.same('wsl:ubuntu:main', 'main', 'cris@x.com', 'pasta-do-wsl')).toBe(false);
    expect(fake.asked).toEqual([{ id: 'main', place: 'pasta-do-wsl' }]);
    expect(changed).toHaveBeenCalledExactlyOnceWith('main', true);
  });
});
