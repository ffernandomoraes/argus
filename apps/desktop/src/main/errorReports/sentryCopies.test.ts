import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

// O detector de travamento do processo principal (@sentry/node-native) copia o escopo global do Sentry
// para o relatório: o rastro, o fim do diário e o estado do sistema (ver journalReport.ts). O escopo
// global fica guardado por versão do @sentry/core. Com o @sentry/node-native numa versão diferente da
// que o @sentry/electron pede (peerDependencies dele), cada um usa a sua cópia, e o relatório de
// travamento chega vazio. Foi assim de 2026-11-13 (697de24: o Dependabot subiu o node-native para
// 11.12.0, e o electron 8.4.0 usa o 11.10.0) a 2026-11-23: nenhum travamento trouxe rastro nem diário.
const require = createRequire(import.meta.url);

type Core = { SDK_VERSION: string; getGlobalScope(): object };
const coreOf = (pkg: string): Core => createRequire(require.resolve(pkg))('@sentry/core') as Core;

describe('Sentry', () => {
  it('o detector de travamento usa o mesmo escopo global que o app', () => {
    const app = coreOf('@sentry/electron/main');
    const detector = coreOf('@sentry/node-native');
    expect(detector.SDK_VERSION).toBe(app.SDK_VERSION);
    expect(detector.getGlobalScope()).toBe(app.getGlobalScope());
  });
});
