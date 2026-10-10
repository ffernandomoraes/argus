import { closeSync, fchmodSync, fsyncSync, mkdirSync, openSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { mkdir, open, rm } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { errorCode } from './errors'

// Gravação que nunca deixa o arquivo pela metade: escreve num temporário só desta gravação
// (`<arquivo>.<pid>.<n>.tmp`) e troca pelo nome certo com rename, que é atômico. Fechar o app ou
// faltar luz no meio deixa o arquivo antigo inteiro.
//
// Ordem por arquivo: as gravações assíncronas entram numa fila e a última pedida vence (as que
// ficaram velhas na fila nem gravam). A síncrona (na saída do app) passa na frente de todas: uma
// assíncrona mais velha, ainda em andamento, nunca troca o arquivo depois dela.

export type AtomicWriteOptions = {
  // Permissões do arquivo novo (ex.: 0o600 para credenciais). O rename leva as do temporário, não
  // as do arquivo antigo. Aplicadas com chmod, sem o umask cortar bits (ex.: 0o664 continua 0o664).
  mode?: number
}

type Slot = {
  // Última gravação pedida neste arquivo, assíncrona ou síncrona.
  version: number
  // Fila das assíncronas; nunca rejeita, para uma falha não travar as seguintes.
  tail: Promise<unknown>
  latestAsync: { version: number; result: Promise<void> } | null
}

const slots = new Map<string, Slot>()
let tmpCount = 0

// Windows: antivírus e indexador seguram o arquivo por um instante e o rename falha com estes.
const BUSY = new Set(['EPERM', 'EBUSY', 'EACCES'])
const ASYNC_TRIES = 8
const SYNC_TRIES = 4
const RETRY_MS = 25

function slotOf(path: string): Slot {
  let slot = slots.get(path)
  if (!slot) {
    slot = { version: 0, tail: Promise.resolve(), latestAsync: null }
    slots.set(path, slot)
  }
  return slot
}

const tmpOf = (path: string) => `${path}.${process.pid}.${++tmpCount}.tmp`

export function writeFileAtomic(path: string, text: string, options: AtomicWriteOptions = {}): Promise<void> {
  const target = resolve(path)
  const slot = slotOf(target)
  const version = ++slot.version

  const run = async (): Promise<boolean> => {
    // Já há pedido mais novo (na fila, ou síncrono já gravado): este nem grava.
    if (slot.version !== version) return false
    const tmp = tmpOf(target)
    let swapped = false
    try {
      await writeTmp(tmp, text, options.mode)
      swapped = await swapIn(slot, version, tmp, target)
      return swapped
    } finally {
      if (!swapped) await rm(tmp, { force: true }).catch(() => {})
    }
  }

  const ran = slot.tail.then(run)
  slot.tail = ran.catch(() => {})
  const result = ran.then((wrote): Promise<void> | undefined => {
    // Nada mais novo pedido nem em andamento: o arquivo não precisa mais do controle.
    if (slot.version === version && slots.get(target) === slot) slots.delete(target)
    if (wrote) return undefined
    // Passou a vez para uma gravação mais nova: termina junto com ela (ou já, se foi a síncrona).
    const newer = slot.latestAsync
    return newer && newer.version > version ? newer.result : undefined
  })
  slot.latestAsync = { version, result }
  return result
}

export function writeFileAtomicSync(path: string, text: string, options: AtomicWriteOptions = {}): void {
  const target = resolve(path)
  // As assíncronas na fila ou no meio da gravação veem a versão nova e desistem.
  slotOf(target).version++
  const tmp = tmpOf(target)
  try {
    writeTmpSync(tmp, text, options.mode)
    renameRetryingSync(tmp, target)
  } catch (err) {
    try {
      rmSync(tmp, { force: true })
    } catch {
      // Sobra um .tmp; não atrapalha a próxima gravação, que usa outro nome.
    }
    throw err
  }
}

async function writeTmp(tmp: string, text: string, mode?: number): Promise<void> {
  const write = async () => {
    const file = await open(tmp, 'w', mode ?? 0o666)
    try {
      if (mode !== undefined) await file.chmod(mode)
      await file.writeFile(text, 'utf8')
      // Garante o conteúdo no disco antes da troca; alguns sistemas de arquivos (rede) não deixam.
      await file.sync().catch(() => {})
    } finally {
      await file.close()
    }
  }
  try {
    await write()
  } catch (err) {
    if (errorCode(err) !== 'ENOENT') throw err
    // A pasta ainda não existe (ex.: primeiro design de um projeto): cria e tenta de novo.
    await mkdir(dirname(tmp), { recursive: true })
    await write()
  }
}

function writeTmpSync(tmp: string, text: string, mode?: number): void {
  const write = () => {
    const fd = openSync(tmp, 'w', mode ?? 0o666)
    try {
      if (mode !== undefined) fchmodSync(fd, mode)
      writeFileSync(fd, text, 'utf8')
      try {
        fsyncSync(fd)
      } catch {
        // Ver writeTmp.
      }
    } finally {
      closeSync(fd)
    }
  }
  try {
    write()
  } catch (err) {
    if (errorCode(err) !== 'ENOENT') throw err
    mkdirSync(dirname(tmp), { recursive: true })
    write()
  }
}

async function swapIn(slot: Slot, version: number, tmp: string, target: string): Promise<boolean> {
  for (let attempt = 1; ; attempt++) {
    // Conferir e trocar no mesmo passo síncrono: uma gravação síncrona não consegue entrar entre
    // os dois e depois ser desfeita por esta, mais velha.
    if (slot.version !== version) return false
    try {
      renameSync(tmp, target)
      return true
    } catch (err) {
      if (!BUSY.has(errorCode(err)) || attempt >= ASYNC_TRIES) throw err
    }
    await new Promise((r) => setTimeout(r, RETRY_MS * attempt))
  }
}

const pause = new Int32Array(new SharedArrayBuffer(4))

function renameRetryingSync(tmp: string, target: string): void {
  for (let attempt = 1; ; attempt++) {
    try {
      renameSync(tmp, target)
      return
    } catch (err) {
      if (!BUSY.has(errorCode(err)) || attempt >= SYNC_TRIES) throw err
    }
    // Espera parada (é a gravação da saída do app): no máximo ~150 ms somando as tentativas.
    Atomics.wait(pause, 0, 0, RETRY_MS * attempt)
  }
}
