// A interface nos testes: o window.api que o preload expõe, só com o que os módulos leem ao serem
// carregados (sistema, pasta pessoal, idioma, workspaces). Para testar outro sistema, ver asPlatform em
// test/platform.ts.

const globals = globalThis as Record<string, unknown>

globals.window = {
  api: {
    platform: process.platform,
    homeDir: process.env.HOME ?? '',
    language: { get: () => 'pt', onChange: () => () => undefined },
    boards: {
      state: () => ({ boards: [{ id: 'main', name: 'Principal', paths: [], sessions: [] }], current: 'main' }),
      onChange: () => () => undefined
    }
  }
}
globals.document = { documentElement: {} }
