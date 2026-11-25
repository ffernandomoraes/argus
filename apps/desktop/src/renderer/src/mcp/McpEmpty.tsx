import { tr } from '../i18n';
import { EmptyState } from '../ui/emptyState/EmptyState';
import { McpArt } from '../ui/emptyState/illustrations';

// Lista de servidores MCP vazia (na conversa e nas Configurações).
export function McpEmpty({ title }: { title: string }) {
  return (
    <EmptyState
      art={<McpArt />}
      title={title}
      text={tr(
        'Um servidor MCP liga o agente a outras ferramentas, como o navegador, o GitHub ou o Figma.',
        'An MCP server connects the agent to other tools, like the browser, GitHub or Figma.',
      )}
    />
  );
}
