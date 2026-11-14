import type { LiveStatus } from '@argus/shared/history';

export type DotStatus = LiveStatus | 'done' | 'interrupted' | null | undefined;

const SOLID: Record<string, string> = {
  'needs-you': 'bg-needs-you',
  done: 'bg-done',
  interrupted: 'bg-red',
};

// Bolinha do status da conversa, nas cores do Argus. Trabalhando: azul, com um anel que cresce e
// some em volta. Precisa de você: laranja. Resposta que ninguém viu ainda: verde. Interrompida:
// vermelha. Parada e vista: nada.
export function StatusDot({ status, size = 10 }: { status: DotStatus; size?: number }) {
  if (!status || status === 'idle') return null;
  if (status !== 'running') return <span className={`inline-block shrink-0 rounded-full ${SOLID[status] ?? 'bg-red'}`} style={{ width: size, height: size }} />;
  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
      <span className="status-ping absolute inset-0 rounded-full bg-running" />
      <span className="relative inline-block size-full rounded-full bg-running" />
    </span>
  );
}
