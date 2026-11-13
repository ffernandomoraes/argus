import type { AgentProvider } from '@argus/shared/agents';
import { AgentIcon } from '@argus/ui/icons/AgentIcon';
import { ClaudeIcon } from '@argus/ui/icons/ClaudeIcon';

// Logo do Claude ou de um dos outros agentes.
export function ProviderLogo({ provider, size = 14 }: { provider: AgentProvider; size?: number }) {
  return provider === 'claude' ? <ClaudeIcon size={size} /> : <AgentIcon provider={provider} size={size} />;
}
