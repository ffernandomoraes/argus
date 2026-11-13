import { describe, expect, it } from 'vitest'
import { closedFields } from './toolPreview'

describe('closedFields', () => {
  it('tira do JSON pela metade só os campos de texto que já fecharam', () => {
    expect(closedFields('{"command":"ls -la","description":"Listar arq')).toEqual({ command: 'ls -la' })
  })

  it('desfaz os escapes do JSON (caminho do Windows, aspas, quebra de linha)', () => {
    expect(closedFields('{"file_path":"C:\\\\Users\\\\ana\\\\a.ts","command":"echo \\"oi\\"\\nls"')).toEqual({
      file_path: 'C:\\Users\\ana\\a.ts',
      command: 'echo "oi"\nls'
    })
  })

  it('o primeiro valor de cada campo vale (o conteúdo do arquivo não troca o alvo)', () => {
    expect(closedFields('{"file_path":"/a.ts","content":"{\\"file_path\\":\\"/b.ts\\"}"')).toMatchObject({ file_path: '/a.ts' })
  })
})
