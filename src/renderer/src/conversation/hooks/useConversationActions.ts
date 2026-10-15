import { agentProviderOf, type AgentDef } from '../../../../shared/agents'
import type { PermissionAnswer } from '../../../../shared/chat'
import { orchestratorPrompt } from '../../../../shared/orchestrator'
import { parseAgentRef } from '../../../../shared/providers'
import { getAuth, resolveAccount } from '../../auth/useAuth'
import type { ConversationSummary } from '../../canvas/types'
import { useStableCallback } from '../../lib/useStableCallback'
import { getPreferences } from '../../settings/preferences'
import { agentHint, mentionedAgents } from '../agentMentions'
import { imagesForSend, isSendableImage } from '../chatImages'
import { freezeConversationAccount } from '../conversationAccount'
import { freezeConversationSettings, setConversationSettings } from '../conversationSettings'
import { addLocalEvent } from '../localEvents'
import { liveCommands, type SessionSettings } from '../SessionSettings'
import { settingChangeEvents } from '../settingChangeEvents'
import { useClaudeInfo } from '../useModels'

// Agentes chamados com @ e, com o orquestrador ligado, as regras dele. Vão em toda mensagem: valem
// assim que a pessoa liga, sem reabrir a conversa, e sobrevivem à compactação.
function hintFor(text: string, agents: AgentDef[], settings: SessionSettings, account?: string): string | undefined {
  const parts = [agentHint(mentionedAgents(text, agents), agentProviderOf(account)), settings.orchestrator && getPreferences().orchestratorEnabled ? orchestratorPrompt(getPreferences().orchestrator) : undefined]
  return parts.filter(Boolean).join('\n\n') || undefined
}

type Options = {
  // Chave do chat da conversa na tela (ver useViewKey).
  chatKey: string
  conversation: ConversationSummary
  cwd: string
  // Workspace: as pastas dele, que o agente recebe como pastas adicionais.
  folders?: string[]
  account?: string
  settings: SessionSettings
  agents: AgentDef[]
}

// O que a conversa pede ao Claude: enviar, trocar modelo/esforço/modo, remote control, parar,
// responder permissões e ler as imagens de uma mensagem. Todas com identidade fixa (vão para o
// chat memorizado) e lendo os valores do último desenho.
export function useConversationActions({ chatKey, conversation, cwd, folders, account, settings, agents }: Options) {
  // Conversa nova ainda sem sessão guarda as trocas pelo id provisório.
  const settingsId = conversation.sessionId ?? conversation.id
  const info = useClaudeInfo(account)

  // Imagens vão junto da mensagem (reduzidas se passarem do limite); outros arquivos, pelo caminho
  // no disco. Falha ao preparar as imagens rejeita a promessa: o chat devolve o texto ao campo.
  const send = useStableCallback(async (text: string, files: File[]) => {
    const images = await imagesForSend(files)
    const paths = files.filter((f) => !isSendableImage(f)).map((f) => window.api.filePath(f)).filter(Boolean)
    const full = paths.length ? `${text}\n\nArquivos anexados:\n${paths.map((p) => `- ${p}`).join('\n')}`.trim() : text
    freezeConversationSettings(settingsId, settings)
    // A conta fica fixa no primeiro envio; a de outro agente já fica guardada com a conversa.
    if (!parseAgentRef(account)) freezeConversationAccount(settingsId, resolveAccount(getAuth(), account))
    window.api.chat.send({
      key: chatKey,
      cwd,
      folders,
      account,
      sessionId: conversation.sessionId,
      settings,
      text: full,
      images,
      hint: hintFor(text, agents, settings, account)
    })
  })

  // Numa sessão de terminal já aberta, a troca vai como comando do próprio Claude Code.
  // Sem sessão aberta, o write é ignorado e a escolha vale ao abrir o terminal.
  // Divisor no chat para cada troca feita aqui, como na extensão do VS Code.
  const change = useStableCallback((patch: Partial<SessionSettings>) => {
    const sid = conversation.sessionId
    if (sid) for (const e of settingChangeEvents(patch, info?.models ?? [])) addLocalEvent(sid, e.kind, e.text)
    setConversationSettings(settingsId, patch)
    for (const command of liveCommands(patch)) window.api.terminal.write(conversation.id, `${command}\r`)
    window.api.chat.configure(chatKey, patch)
  })

  const remoteControl = useStableCallback((enabled: boolean) =>
    window.api.chat.remoteControl({ key: chatKey, cwd, folders, account, sessionId: conversation.sessionId, settings, enabled })
  )
  const interrupt = useStableCallback(() => window.api.chat.interrupt(chatKey))
  const answer = useStableCallback((id: string, a: PermissionAnswer) => window.api.chat.answer(chatKey, id, a))
  const loadImages = useStableCallback((messageId: string) =>
    conversation.sessionId ? window.api.sessions.images(cwd, conversation.sessionId, messageId) : Promise.resolve([])
  )

  return { send, change, remoteControl, interrupt, answer, loadImages }
}
