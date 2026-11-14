// Colar imagens e arquivos na caixa de escrever: pelo evento de colar do campo e pelo "Colar" do
// menu +, que lê a área de transferência (no iPhone, o sistema mostra o botão de confirmar).

export const canReadClipboard = typeof navigator !== 'undefined' && typeof navigator.clipboard?.read === 'function';

// Arquivos de um colar (imagem copiada, arquivo copiado no app Arquivos...).
export function filesFrom(data: DataTransfer | null): File[] {
  if (!data) return [];
  const files = Array.from(data.files);
  if (files.length) return files;
  return Array.from(data.items)
    .filter((item) => item.kind === 'file')
    .map((item) => item.getAsFile())
    .filter((f): f is File => !!f);
}

const extension = (type: string) => type.split('/')[1]?.split(/[+;]/)[0] || 'bin';

export async function readClipboard(): Promise<{ files: File[]; text: string }> {
  const items = await navigator.clipboard.read();
  const files: File[] = [];
  let text = '';
  for (const item of items) {
    const type = item.types.find((t) => !t.startsWith('text/'));
    if (type) {
      const blob = await item.getType(type);
      files.push(new File([blob], `colado-${Date.now()}-${files.length + 1}.${extension(type)}`, { type }));
    } else if (item.types.includes('text/plain')) {
      text += await (await item.getType('text/plain')).text();
    }
  }
  return { files, text };
}
