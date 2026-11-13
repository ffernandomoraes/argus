import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { claudeLaunch } from '../chats';
import { closeGently, guardStdin, writeStdin } from '../lib/childProcess';

// Um `claude` só para pedidos de controle (o monitor de uso também usa). --strict-mcp-config sem
// --mcp-config: nenhum MCP. Subir os MCPs da pessoa custava centenas de MB por conta (o Playwright,
// por exemplo).
export const CONTROL_ARGS = [
  '-p',
  '--input-format',
  'stream-json',
  '--output-format',
  'stream-json',
  '--verbose',
  '--no-session-persistence',
  '--strict-mcp-config',
];

// Sem resposta até aqui, desiste (e fecha com calma, ver closeGently).
const RENEW_TIMEOUT_MS = 60_000;
const REQUEST_ID = 'renew';

// Resposta (certa ou com erro) ao pedido `id`.
export function isReplyTo(line: string, id: string): boolean {
  try {
    const msg = JSON.parse(line) as { type?: unknown; response?: { request_id?: unknown } };
    return msg?.type === 'control_response' && msg.response?.request_id === id;
  } catch {
    return false;
  }
}

// Pede ao próprio `claude` da conta que renove o login vencido. O Argus nunca renova nem grava o
// login: o código de renovação vale uma vez só, e renovar fora da trava do Claude Code (que divide
// a renovação entre todos os `claude` abertos) gastava o código que eles também usam; o servidor
// recusava o seguinte e o Claude Code apagava o login (relato de 2026-11-08, Windows com WSL). É a
// regra do NodeTerm. O pedido get_usage precisa do login válido e não envia mensagem nem gasta uso.
// Termina quando ele responde ou desiste; nunca rejeita.
export async function renewWithClaude(account: string): Promise<void> {
  const l = await claudeLaunch(CONTROL_ARGS, account).catch(() => null);
  if (!l?.ok) return;
  await new Promise<void>((resolve) => {
    // windowsHide: sem ele, o Windows mostraria uma janela de terminal para este `claude` escondido.
    const proc = spawn(l.file, l.args, { cwd: l.cwd, env: l.env, windowsHide: true });
    guardStdin(proc);
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      closeGently(proc);
      resolve();
    };
    const timer = setTimeout(finish, RENEW_TIMEOUT_MS);
    createInterface({ input: proc.stdout }).on('line', (line) => isReplyTo(line, REQUEST_ID) && finish());
    proc.stderr.on('data', () => {});
    proc.on('error', finish);
    proc.on('close', finish);
    const request = { subtype: 'get_usage', skip_behaviors: true };
    writeStdin(proc, JSON.stringify({ type: 'control_request', request_id: REQUEST_ID, request }) + '\n', { end: false });
  });
}
