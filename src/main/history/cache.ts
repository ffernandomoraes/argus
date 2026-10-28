import { open, stat } from 'node:fs/promises'
import { parseLine } from '../transcripts/line'
import { markHolds, readLines, readMark } from '../transcripts/lineReader'
import type { HistoryRequest } from '../../shared/history'
import { ImageIndex } from './images'
import { HistoryParser, MESSAGES_MAX } from './parser'

// As últimas conversas lidas ficam na memória com o ponto onde a leitura parou: reler depois de
// uma mensagem nova lê só o que o Claude Code acrescentou, não os 100 MB do arquivo.
const MAX_FILES = 8
// Bytes logo antes de onde a leitura parou. Se mudarem, o arquivo foi regravado: lê tudo de novo.
const MARK_BYTES = 64

export type Transcript = { history: HistoryParser; images: ImageIndex }

const fresh = (keep: number, sidechain: boolean): Transcript => ({ history: new HistoryParser(keep, sidechain), images: new ImageIndex() })

class TranscriptFile {
  // Quantas mensagens guardar ao ler do zero (sobe quando a tela rola para trás; ver widen).
  private keep = MESSAGES_MAX
  data: Transcript
  private ino = -1
  private size = -1
  private mtimeMs = -1
  private offset = 0
  private mark: Buffer = Buffer.alloc(0)
  private latest: Promise<boolean> = Promise.resolve(true)
  private queued: Promise<boolean> | null = null
  // Trechos pedidos pela tela desde a última leitura (ver widen).
  private wanted: HistoryRequest[] = []

  // `sidechain`: arquivo de um subagente (ver HistoryParser).
  constructor(
    private file: string,
    private sidechain: boolean
  ) {
    this.data = fresh(this.keep, sidechain)
  }

  // Leituras pedidas ao mesmo tempo se juntam: no máximo uma rodando e uma esperando.
  update(request?: HistoryRequest): Promise<boolean> {
    if (request) this.wanted.push(request)
    this.queued ??= this.latest.then(() => {
      this.queued = null
      this.widen()
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

  // A tela rolou para mensagens que já saíram da memória: a próxima leitura é do arquivo inteiro,
  // guardando o dobro do que ela precisa (o lote seguinte não relê de novo). Antes de ler, nunca no
  // meio de uma leitura: ela continuaria alimentando o histórico novo do ponto em que estava.
  private widen(): void {
    const need = Math.max(0, ...this.wanted.map((r) => this.data.history.need(r)))
    this.wanted = []
    if (this.data.history.hold(need)) {
      // Vale também se o arquivo for regravado e lido do zero (reset).
      this.keep = Math.max(this.keep, need)
      return
    }
    this.keep = need * 2
    this.reset(this.ino)
  }

  private reset(ino: number): void {
    this.data = fresh(this.keep, this.sidechain)
    this.ino = ino
    this.size = -1
    this.mtimeMs = -1
    this.offset = 0
    this.mark = Buffer.alloc(0)
  }
}

const files = new Map<string, TranscriptFile>()

// Histórico e índice de imagens do arquivo, em dia com o disco; nulo se não deu para ler.
// `request`: o trecho que a tela vai pedir (ver widen). `sidechain`: arquivo de um subagente.
export async function loadTranscript(file: string, request?: HistoryRequest, sidechain = false): Promise<Transcript | null> {
  let entry = files.get(file)
  if (entry) files.delete(file)
  else entry = new TranscriptFile(file, sidechain)
  // O mais recente vai para o fim; os mais antigos saem quando passa do limite.
  files.set(file, entry)
  for (const old of files.keys()) {
    if (files.size <= MAX_FILES) break
    files.delete(old)
  }
  if (!(await entry.update(request))) {
    if (files.get(file) === entry) files.delete(file)
    return null
  }
  return entry.data
}
