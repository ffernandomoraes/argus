import { open, stat } from 'node:fs/promises'
import { parseLine } from '../transcripts/line'
import { markHolds, readLines, readMark } from '../transcripts/lineReader'
import { ImageIndex } from './images'
import { HistoryParser } from './parser'

// As últimas conversas lidas ficam na memória com o ponto onde a leitura parou: reler depois de
// uma mensagem nova lê só o que o Claude Code acrescentou, não os 100 MB do arquivo.
const MAX_FILES = 8
// Bytes logo antes de onde a leitura parou. Se mudarem, o arquivo foi regravado: lê tudo de novo.
const MARK_BYTES = 64

export type Transcript = { history: HistoryParser; images: ImageIndex }

const fresh = (): Transcript => ({ history: new HistoryParser(), images: new ImageIndex() })

class TranscriptFile {
  data = fresh()
  private ino = -1
  private size = -1
  private mtimeMs = -1
  private offset = 0
  private mark: Buffer = Buffer.alloc(0)
  private latest: Promise<boolean> = Promise.resolve(true)
  private queued: Promise<boolean> | null = null

  constructor(private file: string) {}

  // Leituras pedidas ao mesmo tempo se juntam: no máximo uma rodando e uma esperando.
  update(): Promise<boolean> {
    this.queued ??= this.latest.then(() => {
      this.queued = null
      this.latest = this.read().catch(() => false)
      return this.latest
    })
    return this.queued
  }

  private async read(): Promise<boolean> {
    const info = await stat(this.file).catch(() => null)
    if (!info) return false
    // Outro arquivo no mesmo lugar, ou encolheu: começa do zero.
    if (info.ino !== this.ino || info.size < this.offset) this.reset(info.ino)
    if (info.size === this.size && info.mtimeMs === this.mtimeMs) return true
    // Mesmo tamanho com outra data: o Claude Code só acrescenta, então foi regravado no lugar (o
    // fim pode ter ficado igual e enganar a marca). Um simples toque também cai aqui: relê tudo.
    if (info.size === this.size) this.reset(info.ino)
    const fh = await open(this.file, 'r')
    try {
      if (!(await markHolds(fh, this.offset, this.mark))) this.reset(info.ino)
      const { next, rest } = await readLines(fh, this.offset, info.size, (bytes, start) => {
        this.take(bytes, start)
      })
      // Última linha sem "\n": entra se já estiver inteira, como na leitura do arquivo todo;
      // cortada (ainda sendo gravada), é relida na próxima vez.
      const end = rest.length && this.take(rest, next) ? next + rest.length : next
      this.offset = end
      this.mark = await readMark(fh, end, MARK_BYTES)
      this.size = info.size
      this.mtimeMs = info.mtimeMs
    } catch (err) {
      // Falhou no meio: linhas já entraram no histórico sem o ponto avançar, e a próxima leitura
      // as poria de novo. Começa do zero.
      this.reset(info.ino)
      throw err
    } finally {
      await fh.close()
    }
    return true
  }

  // Linha completa: entra no histórico e no índice de imagens. Devolve se era JSON.
  private take(bytes: Buffer, start: number): boolean {
    const line = parseLine(bytes.toString('utf8'))
    if (!line) return false
    try {
      this.data.images.add(line, start, start + bytes.length)
      this.data.history.feed(line)
    } catch {
      // linha com formato inesperado: fica de fora, o resto da conversa aparece
    }
    return true
  }

  private reset(ino: number): void {
    this.data = fresh()
    this.ino = ino
    this.size = -1
    this.mtimeMs = -1
    this.offset = 0
    this.mark = Buffer.alloc(0)
  }
}

const files = new Map<string, TranscriptFile>()

// Histórico e índice de imagens do arquivo, em dia com o disco; nulo se não deu para ler.
export async function loadTranscript(file: string): Promise<Transcript | null> {
  let entry = files.get(file)
  if (entry) files.delete(file)
  else entry = new TranscriptFile(file)
  // O mais recente vai para o fim; os mais antigos saem quando passa do limite.
  files.set(file, entry)
  for (const old of files.keys()) {
    if (files.size <= MAX_FILES) break
    files.delete(old)
  }
  if (!(await entry.update())) {
    if (files.get(file) === entry) files.delete(file)
    return null
  }
  return entry.data
}
