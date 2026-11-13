import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MAX_REMOTE_UPLOAD, type FileOpResult } from '@argus/shared/files';
import { tr } from '../i18n';
import { failure } from './fsHelpers';

// Anexo mandado pela janela de acesso remoto: o arquivo está no notebook, e a conversa roda aqui. O
// conteúdo chega pela ligação e fica numa pasta temporária só dele (o nome original, sem caminho),
// que o Claude lê como lê um anexo daqui. Fica na pasta temporária do sistema, que ele limpa.
export async function saveUpload(name: string, data: Uint8Array): Promise<FileOpResult> {
  if (typeof name !== 'string' || !ArrayBuffer.isView(data)) return { ok: false, error: tr('Anexo inválido.', 'Invalid attachment.') };
  if (data.byteLength > MAX_REMOTE_UPLOAD) return { ok: false, error: tooBig(name) };
  try {
    const dir = join(tmpdir(), 'argus-anexos', randomUUID());
    await mkdir(dir, { recursive: true });
    const path = join(dir, safeName(name));
    await writeFile(path, Buffer.from(data.buffer, data.byteOffset, data.byteLength));
    return { ok: true, path };
  } catch (err) {
    return failure(err);
  }
}

// Só o nome: sem pastas, sem os caracteres que o Windows recusa, sem começar com ponto.
export function safeName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? '';
  const clean = base.replace(/[<>:"|?*\x00-\x1f]/g, '_').replace(/^\.+/, '').trim();
  return clean || 'arquivo';
}

const tooBig = (name: string) =>
  tr(
    `${name} passa de ${MAX_REMOTE_UPLOAD / 1024 / 1024} MB, o limite de anexo pelo acesso remoto.`,
    `${name} is over ${MAX_REMOTE_UPLOAD / 1024 / 1024} MB, the attachment limit over remote access.`,
  );
