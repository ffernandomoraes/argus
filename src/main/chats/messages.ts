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
