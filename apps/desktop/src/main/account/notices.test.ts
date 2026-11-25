import { describe, expect, it } from 'vitest';
import { MAX_EVENT_CHARS, parseEvents, type IncomingNotice } from './notices';

// Leitura do fluxo de avisos (Server-Sent Events), que chega em pedaços.

describe('parseEvents', () => {
  it('reads whole notices, keeps the partial one and ignores pings', () => {
    const got: IncomingNotice[] = [];
    const notice = { from: 'PC de casa', title: 'Concluído - argus', body: 'Corrigir login', kind: 'done', hostId: 'room' };
    let rest = parseEvents(': ok\n\n: ping\n\nevent: notice\ndata: ' + JSON.stringify(notice).slice(0, 20), (n) => got.push(n));
    expect(got).toEqual([]);
    rest = parseEvents(rest + JSON.stringify(notice).slice(20) + '\n\n', (n) => got.push(n));
    expect(rest).toBe('');
    expect(got).toEqual([notice]);
  });

  it('skips broken or foreign events', () => {
    const got: IncomingNotice[] = [];
    parseEvents('event: notice\ndata: {nope\n\nevent: other\ndata: {"title":"x","from":"y"}\n\nevent: notice\ndata: {"title":1}\n\n', (n) => got.push(n));
    expect(got).toEqual([]);
  });

  it('tells which device left the account', () => {
    const removed: string[] = [];
    const got: IncomingNotice[] = [];
    parseEvents('event: device-removed\ndata: {"id":"sess-1"}\n\nevent: device-removed\ndata: {"id":1}\n\n', (n) => got.push(n), (id) => removed.push(id));
    expect(removed).toEqual(['sess-1']);
    expect(got).toEqual([]);
  });

  it('drops a host id that is not one, and a block that never ends', () => {
    const got: IncomingNotice[] = [];
    parseEvents(`event: notice\ndata: ${JSON.stringify({ from: 'x', title: 't', hostId: '../../etc' })}\n\n`, (n) => got.push(n));
    expect(got[0]?.hostId).toBeUndefined();
    expect(() => parseEvents('event: notice\ndata: ' + 'x'.repeat(MAX_EVENT_CHARS), () => undefined)).toThrow();
  });
});
