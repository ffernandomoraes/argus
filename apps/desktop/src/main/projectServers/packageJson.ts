import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

export type PackageJson = {
  name?: unknown
  productName?: unknown
  packageManager?: unknown
  scripts?: Record<string, unknown>
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
}

// O package.json da pasta, lido na hora; nulo se não há ou não dá para ler.
export async function readPackageJson(dir: string): Promise<PackageJson | null> {
  try {
    const pkg: unknown = JSON.parse(await readFile(join(dir, 'package.json'), 'utf8'))
    return pkg && typeof pkg === 'object' ? (pkg as PackageJson) : null
  } catch {
    return null
  }
}

const text = (value: unknown): string | undefined => (typeof value === 'string' && value.trim() ? value.trim() : undefined)

// Os nomes de cada pasta, lidos uma vez: o package.json de um servidor rodando quase nunca muda.
const names = new Map<string, Promise<{ product?: string; pkg?: string }>>()

function namesOf(cwd: string): Promise<{ product?: string; pkg?: string }> {
  let found = names.get(cwd)
  if (!found) {
    found = readPackageJson(cwd).then((pkg) => ({
      product: text(pkg?.productName),
      pkg: (text(pkg?.productName) ?? text(pkg?.name))?.replace(/^@[^/]+\//, '')
    }))
    names.set(cwd, found)
  }
  return found
}

// Nome do app no package.json da pasta (`productName`, o mesmo que aparece na janela), quando a
// pasta tem um nome diferente do app: a do Argus ainda se chama canva-agent-editor.
export async function productName(cwd: string): Promise<string | undefined> {
  return cwd ? (await namesOf(cwd)).product : undefined
}

// Nome do pacote da pasta (package.json), para dizer qual app é cada porta num monorepo: o
// productName, senão o name sem o escopo ("@loja/admin" vira "admin").
export async function packageName(cwd: string): Promise<string | undefined> {
  return cwd ? (await namesOf(cwd)).pkg : undefined
}
