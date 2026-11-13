import { configEmail } from '../auth/status'

// Login trocado por fora (no terminal) com o app aberto. O app só confere o login das contas ao abrir
// e nas Configurações; até lá, o monitor de uso seguia lendo a conta anterior com o login que tinha
// em memória (até ele vencer, horas depois), sob o nome da conta de agora. Antes de cada leitura, o
// e-mail do .claude.json da conta é comparado com o que o app conferiu; diferente, o app confere de
// novo (o que reabre o monitor com o login novo) e a leitura não acontece.
export class LoginWatch {
  // O e-mail já avisado de cada uso: se a conferência do app continuar dizendo outro (o arquivo e o
  // `claude auth status` discordando), não avisa de novo nem segura as leituras seguintes.
  private flagged = new Map<string, string>()
  // Leitura do arquivo em andamento, reaproveitada: no WSL travado, não empilha uma por pergunta.
  private reading = new Map<string, Promise<string | undefined>>()

  // inWsl: o login trocado é o da conta dentro de uma distro do WSL.
  constructor(private onChanged: (account: string, inWsl: boolean) => void) {}

  // key: a chave do uso. known: o e-mail conferido pelo app. place: uma pasta do WSL, para o login
  // da conta dentro daquela distro.
  async same(key: string, account: string, known: string | undefined, place?: string): Promise<boolean> {
    if (!known) return true
    let pending = this.reading.get(key)
    if (!pending) {
      pending = configEmail(account, place).catch(() => undefined)
      this.reading.set(key, pending)
      void pending.finally(() => this.reading.get(key) === pending && this.reading.delete(key))
    }
    const seen = await pending
    if (!seen || seen.toLowerCase() === known.toLowerCase() || this.flagged.get(key) === seen) return true
    this.flagged.set(key, seen)
    this.onChanged(account, !!place)
    return false
  }

  forget(key: string): void {
    this.flagged.delete(key)
    this.reading.delete(key)
  }
}
