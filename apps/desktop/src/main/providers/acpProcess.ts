import { app } from 'electron';
import type { Launch } from './env';
import { JsonRpcProcess } from './rpc';

// Abre um agente que fala ACP (Agent Client Protocol) e se apresenta. O app não oferece arquivos nem
// terminal ao agente: cada um usa os próprios.
export async function openAcpProcess(launch: Launch, cwd?: string): Promise<JsonRpcProcess> {
  const rpc = new JsonRpcProcess(launch, cwd);
  try {
    await rpc.request('initialize', {
      protocolVersion: 1,
      clientCapabilities: { fs: { readTextFile: false, writeTextFile: false }, terminal: false },
      clientInfo: { name: 'argus', title: 'Argus', version: app.getVersion() },
    });
  } catch (err) {
    // Quem chama não recebe o processo: sem fechar aqui, um agente que não respondeu ficaria aberto.
    rpc.close();
    throw err;
  }
  return rpc;
}
