import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { scanListening } from '../processScan';
import type { ProjectScript } from './scripts';

// O Vite só pula para a porta seguinte quando não consegue abrir a dele, e isso depende do
// endereço: um servidor em [::1]:5173 e outro com --host (*:5173) abrem juntos no Mac, e os dois
// respondem em localhost:5173. Por isso a porta é escolhida aqui, olhando todas as abertas, antes
// de rodar. Só quando o vite é o último comando do script: o gerenciador põe o --port no fim do
// texto, então em "pnpm sync-rules && vite --host" ele chega ao vite. Num "turbo dev", em pipe,
// "a; b", "a & b" ou "concurrently ..." iria parar no lugar errado.
// Depois do vite (ou vite dev/serve), só opções: "vite preview" e "vite build" ficam de fora.
const VITE_SCRIPT = /^vite(\s+(dev|serve))?(\s+-.*)?$/;
const OTHER_JOIN = /\|\||[|;]|(^|[^&])&($|[^&])/;

// O comando que recebe o --port: o último de uma sequência "a && b", ou o script inteiro.
const lastCommand = (body: string) => body.split('&&').at(-1)!.trim();
const CONFIGS = ['vite.config.ts', 'vite.config.mts', 'vite.config.js', 'vite.config.mjs'];
const DEFAULT_PORT = 5173;

// A porta que o Vite tentaria: a do vite.config (server.port) ou a padrão. Nula quando a pessoa
// fixou a porta de propósito (--port no script, strictPort na config): aí vale a escolha dela.
async function wantedPort(root: string, body: string): Promise<number | null> {
  if (/--port\b|--strictPort\b/.test(body)) return null;
  for (const file of CONFIGS) {
    const text = await readFile(join(root, file), 'utf8').catch(() => null);
    if (text === null) continue;
    if (/strictPort\s*:\s*true/.test(text)) return null;
    const port = text.match(/\bport\s*:\s*(\d{2,5})\b/);
    return port ? Number(port[1]) : DEFAULT_PORT;
  }
  return DEFAULT_PORT;
}

// O comando com --port na primeira livre, quando a do Vite já está em uso; senão, o mesmo. O npm
// só repassa o que vem depois de "--"; pnpm, yarn e bun repassam direto.
export async function freePort(root: string, run: ProjectScript): Promise<ProjectScript> {
  if (OTHER_JOIN.test(run.body) || !VITE_SCRIPT.test(lastCommand(run.body))) return run;
  const wanted = await wantedPort(root, lastCommand(run.body));
  if (wanted === null) return run;
  const busy = new Set((await scanListening({ fresh: true })).flatMap((p) => p.ports));
  if (!busy.has(wanted)) return run;
  let port = wanted + 1;
  while (busy.has(port) && port < 65535) port++;
  return { ...run, command: `${run.command}${run.manager === 'npm' ? ' --' : ''} --port ${port}` };
}
