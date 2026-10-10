// Uma etapa da abertura ou do encerramento que falha não impede as seguintes: a janela abre mesmo
// se limpar as contas falhar, e fechar o app ainda encerra os terminais se parar o ditado falhar.
// O erro fica registrado no console, em vez de virar o diálogo de erro do processo principal.
export function step(name: string, run: () => unknown): void {
  try {
    const result = run()
    if (result instanceof Promise) result.catch((err: unknown) => console.error(`[app] ${name}:`, err))
  } catch (err) {
    console.error(`[app] ${name}:`, err)
  }
}
