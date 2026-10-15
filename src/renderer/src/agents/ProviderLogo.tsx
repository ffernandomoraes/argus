import type { AgentProvider } from '../../../shared/agents'
import { AgentIcon } from '../icons/AgentIcon'
import { ClaudeIcon } from '../icons/ClaudeIcon'

// Logo do Claude ou de um dos outros agentes.
export function ProviderLogo({ provider, size = 14 }: { provider: AgentProvider; size?: number }) {
  return provider === 'claude' ? <ClaudeIcon size={size} /> : <AgentIcon provider={provider} size={size} />
}
