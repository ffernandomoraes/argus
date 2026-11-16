import { ancestors, listeningPorts, processTable, type WinProcess } from '../winProcesses';
import type { Listening } from './types';
import { winOrigin } from './winFamily';

// Windows: sem o lsof e o ps, as portas vêm do netstat e os processos, do PowerShell. A pasta
// (cwd) de outro processo o Windows não informa: fica vazia, e quem procura o servidor de uma
// pasta olha a linha de comando (ver projectServers/matching.ts). Sem grupo de processo, o "grupo"
// é o próprio processo, encerrado com tudo que ele abriu. O ambiente também não: `env` fica vazio.
export async function scanWindows(): Promise<Listening[]> {
  const ports = await listeningPorts();
  if (ports.size === 0) return [];
  // A tabela de processos é lida de novo só quando aparece processo novo com porta aberta (ou a
  // cada 5 minutos): o PowerShell pesa, e o botão do servidor pergunta a cada 5 segundos.
  const table = await processTable(5 * 60_000, [...ports.keys(), process.pid]);
  // No pnpm dev, o servidor deste app é um dos processos acima dele.
  const own = new Set(ancestors(table, process.pid).map((p) => p.pid));
  const found: Listening[] = [];
  for (const [pid, list] of ports) {
    const proc = table.get(pid);
    const chain = ancestors(table, pid);
    // Do Claude Code (servidores MCP) ou iniciado por um shell dele ou de um terminal daqui.
    const family = [proc, ...chain].filter((p): p is WinProcess => !!p);
    const { claude, launched } = winOrigin(family, process.pid);
    found.push({
      pid,
      pgid: pid,
      ports: [...list].sort((a, b) => a - b),
      cwd: '',
      command: proc?.command || proc?.name || '',
      current: own.has(pid) || undefined,
      locked: claude ? 'claude' : undefined,
      claude,
      launched: launched || undefined,
      name: proc?.name,
      chain: chain.map((p) => p.pid),
      env: '',
    });
  }
  return found;
}
