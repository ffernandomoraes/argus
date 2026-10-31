import { describe, expect, it } from 'vitest'
import { installerCommand } from './windows'

// O instalador do Windows desinstala a versão antiga antes de copiar a nova: se a cópia falhar, o
// app some da máquina. A linha do cmd precisa rodar o instalador de novo quando o Argus.exe faltar.

const installer = 'C:\\Users\\João Silva\\AppData\\Roaming\\Argus\\updates\\argus-update-x\\Argus-Setup-0.1.102.exe'
const exe = 'C:\\Users\\João Silva\\AppData\\Local\\Programs\\argus\\Argus.exe'

describe('installerCommand', () => {
  it('roda o instalador e, sem o Argus.exe no fim, roda de novo', () => {
    expect(installerCommand(installer, exe, false)).toBe(
      `start "" /wait "${installer}" /S --updated & if not exist "${exe}" start "" /wait "${installer}" /S --updated`
    )
  })

  it('com reinício, as duas tentativas abrem o app no fim', () => {
    const line = installerCommand(installer, exe, true)
    expect(line.match(/--force-run/g)).toHaveLength(2)
  })

  it('caminhos com espaço vão entre aspas', () => {
    const line = installerCommand(installer, exe, false)
    expect(line).toContain(`"${installer}"`)
    expect(line).toContain(`if not exist "${exe}"`)
  })
})
