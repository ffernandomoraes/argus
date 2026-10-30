import type { UUID } from 'node:crypto'
import type { SDKUserMessage } from '@anthropic-ai/claude-agent-sdk'
import { filesBlock } from '../../shared/attachedFiles'
import type { ChatSendRequest } from '../../shared/chat'
import { tr } from '../i18n'

// O que vai e volta do Claude em texto: a mensagem que você manda e o erro que ele devolve.

// Imagens, o texto, os caminhos dos outros anexos e, por último, o aviso que não aparece no chat:
// o título da conversa continua sendo o que você escreveu. O uuid deixa o Claude dizer, ao parar, se ela ainda vai rodar.
export function userMessage(req: ChatSendRequest, uuid: UUID): SDKUserMessage {
  const content = [
    ...req.images.map((img) => ({
      type: 'image' as const,
      source: { type: 'base64' as const, media_type: img.mediaType as 'image/png', data: img.data }
    })),
    ...(req.text ? [{ type: 'text' as const, text: req.text }] : []),
    ...(req.files?.length ? [{ type: 'text' as const, text: filesBlock(req.files) }] : []),
    ...(req.hint ? [{ type: 'text' as const, text: req.hint }] : [])
  ]
  return { type: 'user', message: { role: 'user', content }, parent_tool_use_id: null, uuid }
}

// O SDK avisa em inglês quando não acha o `claude`; a tela de boas-vindas instala.
export function friendlyError(message: string): string {
  return /native binary not found/i.test(message)
    ? tr(
        'O Claude Code não está instalado neste computador. Feche e abra o Argus para instalar.',
        "Claude Code isn't installed on this computer. Quit and reopen Argus to install it."
      )
    : message
}

// Como o processo do Claude acabou, pela mensagem do SDK (o código de saída e o fim do que ele
// escreveu no stderr):
// - disk: disco cheio (ENOSPC);
// - heap: passou do limite de memória do próprio processo (o heap do JavaScript);
// - oom: o processo disse que ficou sem memória, ou saiu com o código de falta de memória do
//   Windows (STATUS_NO_MEMORY), sem dizer se foi o limite dele ou o do computador;
// - killed: encerrado de fora (sinal SIGKILL, código 137), por quem a mensagem não diz.
// Quem diz se foi a memória do computador é o próprio sistema (ver systemHealth/stopEvidence.ts).
export type StopKind = 'disk' | 'heap' | 'oom' | 'killed'

export function stopKind(message: string): StopKind | null {
  if (/ENOSPC|no space left on device/i.test(message)) return 'disk'
  if (/heap out of memory|reached heap limit|heap limit allocation failed/i.test(message)) return 'heap'
  if (/out of memory|cannot allocate memory|ENOMEM|exited with code (3221225495|-1073741801)\b/i.test(message)) return 'oom'
  if (/terminated by signal SIGKILL|exited with code 137\b/.test(message)) return 'killed'
  return null
}

// O motivo que a conversa mostra. memory: o sistema confirmou a falta de memória do computador;
// processLimit: o processo passou do limite dele (não adianta fechar programas).
export type StopCause = 'memory' | 'processLimit' | 'disk' | 'oom' | 'killed'

// O que dá para dizer antes da confirmação do sistema, só pela mensagem.
export function firstCause(kind: StopKind): StopCause {
  return kind === 'heap' ? 'processLimit' : kind
}

// O que a conversa mostra no lugar da mensagem em inglês do SDK.
export function stopText(cause: StopCause): string {
  switch (cause) {
    case 'memory':
      return tr(
        'O Claude parou por falta de memória. Feche alguns programas e continue de onde parou.',
        'Claude stopped for lack of memory. Close some apps and continue where it left off.'
      )
    case 'processLimit':
      return tr(
        'O Claude passou do limite de memória do próprio processo. A próxima mensagem abre ele de novo.',
        "Claude went over its own process memory limit. Your next message starts it again."
      )
    case 'disk':
      return tr(
        'Disco cheio: o Claude não conseguiu gravar. Libere espaço e tente de novo.',
        "Disk full: Claude couldn't save. Free up some space and try again."
      )
    case 'oom':
      return tr(
        'O processo do Claude ficou sem memória. A próxima mensagem abre ele de novo.',
        "Claude's process ran out of memory. Your next message starts it again."
      )
    case 'killed':
      return tr(
        'O processo do Claude foi encerrado. A próxima mensagem abre ele de novo.',
        "Claude's process was stopped. Your next message starts it again."
      )
  }
}
