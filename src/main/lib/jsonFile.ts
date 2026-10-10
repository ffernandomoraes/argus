import { constants, copyFileSync, existsSync, readFileSync, renameSync } from 'node:fs'
import { basename, dirname, extname, join } from 'node:path'
import { writeFileAtomic, writeFileAtomicSync, type AtomicWriteOptions } from './atomicWrite'
import { errorCode, errorMessage } from './errors'

// Arquivos JSON do app (canvas, janelas, contas, configurações). A leitura distingue "não existe"
// de "existe e não dá para usar": no segundo caso, quem lê não pode gravar por cima como se fosse
// novo (era assim que um canvas.json estragado virava canvas vazio e apagava tudo).

export type JsonRead<T> = { status: 'missing' } | { status: 'ok'; data: T } | { status: 'corrupt'; error: string }

export type JsonWriteOptions = AtomicWriteOptions & {
  // Espaços de recuo; sem ele, numa linha só (o padrão dos arquivos do app).
  indent?: number
}

// Síncrona. `T` não é conferido: valide o formato de `data` antes de usar.
export function readJsonFile<T = unknown>(path: string): JsonRead<T> {
  let text: string
  try {
    text = readFileSync(path, 'utf8')
  } catch (err) {
    if (errorCode(err) === 'ENOENT') return { status: 'missing' }
    return { status: 'corrupt', error: errorMessage(err) }
  }
  try {
    // Salvo pelo Bloco de Notas do Windows, pode começar com o BOM.
    return { status: 'ok', data: JSON.parse(text.replace(/^﻿/, '')) as T }
  } catch (err) {
    return { status: 'corrupt', error: errorMessage(err) }
  }
}

// O JSON é montado na hora da chamada: mudar `data` depois não muda o que vai para o disco.
// Ver atomicWrite.ts para a ordem entre gravações.
export function writeJsonAtomic(path: string, data: unknown, options: JsonWriteOptions = {}): Promise<void> {
  let text: string
  try {
    text = toJson(data, options.indent)
  } catch (err) {
    return Promise.reject(err)
  }
  return writeFileAtomic(path, text, options)
}

// Para a saída do app, quando não dá para esperar a fila. Lança se não conseguir gravar.
export function writeJsonAtomicSync(path: string, data: unknown, options: JsonWriteOptions = {}): void {
  writeFileAtomicSync(path, toJson(data, options.indent), options)
}

function toJson(data: unknown, indent?: number): string {
  const text = JSON.stringify(data, null, indent)
  if (text === undefined) throw new TypeError('Valor sem representação em JSON')
  return text
}

// Tira do caminho um arquivo que não deu para ler, guardando ao lado com a data:
// canvas.json → canvas.corrompido-20261009-185200.json. Devolve o caminho novo, ou null se não
// conseguiu. `copy`: deixa o original onde está (a próxima leitura ainda o acha estragado).
// Depois de mover, a próxima leitura dá 'missing': não trate isso como "pode limpar tudo".
export function quarantine(path: string, { copy = false }: { copy?: boolean } = {}): string | null {
  const ext = extname(path)
  const name = basename(path, ext)
  const stamp = timestamp(new Date())
  for (let n = 1; n <= 20; n++) {
    const target = join(dirname(path), `${name}.corrompido-${stamp}${n > 1 ? `-${n}` : ''}${ext}`)
    if (existsSync(target)) continue
    try {
      if (copy) copyFileSync(path, target, constants.COPYFILE_EXCL)
      else renameSync(path, target)
      return target
    } catch (err) {
      if (errorCode(err) !== 'EEXIST') return null
    }
  }
  return null
}

// AAAAMMDD-HHMMSS no horário local, como a pessoa vê no relógio.
function timestamp(d: Date): string {
  const two = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${two(d.getMonth() + 1)}${two(d.getDate())}-${two(d.getHours())}${two(d.getMinutes())}${two(d.getSeconds())}`
}
