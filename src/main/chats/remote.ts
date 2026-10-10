import type { Query } from '@anthropic-ai/claude-agent-sdk'

// O SDK tem o pedido de remote control (o mesmo que a extensão do VS Code usa), mas não o
// publica nos tipos. Resposta conferida na 0.3.289: { session_url, bridge_session_id, ... }.
// O estado da conexão chega depois, em mensagens bridge_state (ver stream.ts).
type RemoteControlQuery = Query & {
  enableRemoteControl(enabled: boolean, name?: string): Promise<{ session_url?: string } | undefined>
}

// Liga ou desliga. Ligado, devolve o endereço da conversa no claude.ai, quando vem.
export async function setRemoteControl(q: Query, enabled: boolean): Promise<string | undefined> {
  const r = await (q as RemoteControlQuery).enableRemoteControl(enabled)
  return r?.session_url
}
