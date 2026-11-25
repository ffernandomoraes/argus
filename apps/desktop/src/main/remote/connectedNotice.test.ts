import { describe, expect, it, vi } from 'vitest';
import { saveAppSettings } from '../appSettings';
import { notifyConnected } from './connectedNotice';

// O aviso de aparelho novo no acesso remoto não depende das notificações (que vêm da conta).

const shown = vi.hoisted(() => [] as { title: string; body: string }[]);

vi.mock('electron', async (importOriginal) => {
  const real = await importOriginal<Record<string, unknown>>();
  class FakeNotification {
    static isSupported = () => true;
    constructor(private readonly options: { title: string; body: string }) {}
    show() {
      shown.push(this.options);
    }
  }
  return { ...real, Notification: FakeNotification };
});

describe('notifyConnected', () => {
  it('shows a new device even with notifications off, and skips the usual one', () => {
    saveAppSettings({ notifications: false });
    notifyConnected('iPhone', true);
    notifyConnected('iPhone', false);
    expect(shown.map((n) => n.title)).toEqual(['Aparelho novo no acesso remoto: iPhone']);
    saveAppSettings({ notifications: true });
    notifyConnected('iPhone', false);
    expect(shown).toHaveLength(2);
  });
});
