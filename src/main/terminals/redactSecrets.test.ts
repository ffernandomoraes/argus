import { describe, expect, it } from 'vitest'
import { redactSecrets } from './redactSecrets'

const masked = (text: string) => redactSecrets(text).text

describe('redactSecrets', () => {
  it('.env impresso: o valor das variáveis de segredo sai, o resto fica', () => {
    const env = ['DATABASE_PASSWORD=hunter2', 'API_KEY="abc 123"', "export JWT_SECRET='x1'", 'PORT=3000', 'NODE_ENV=production'].join('\n')
    expect(masked(env)).toBe(['DATABASE_PASSWORD=***', 'API_KEY="***"', "export JWT_SECRET='***'", 'PORT=3000', 'NODE_ENV=production'].join('\n'))
  })

  it('JSON e YAML: "apiKey": "valor" e token: valor', () => {
    expect(masked('{ "apiKey": "abcdef", "name": "argus" }')).toBe('{ "apiKey": "***", "name": "argus" }')
    expect(masked('  auth_token: zzz999')).toBe('  auth_token: ***')
  })

  it('nomes em português: senha, chave, segredo', () => {
    expect(masked('SENHA_DO_BANCO=hunter2\nCHAVE_PIX=abc\nsegredo: x')).toBe('SENHA_DO_BANCO=***\nCHAVE_PIX=***\nsegredo: ***')
  })

  it('a pasta atual (PWD) e contadores (PASSED) não são segredo', () => {
    expect(masked('PWD=/Users/p/projeto\nOLDPWD=/tmp\nTESTS_PASSED=12')).toBe('PWD=/Users/p/projeto\nOLDPWD=/tmp\nTESTS_PASSED=12')
  })

  it('senha dentro de endereço', () => {
    expect(masked('DATABASE_URL=postgres://app:s3nh4@db:5432/x')).toBe('DATABASE_URL=postgres://app:***@db:5432/x')
  })

  it('formatos conhecidos, mesmo sem nome em volta', () => {
    const text = [
      'sk-ant-api03-abcdefghijklmnopqrstuvwxyz',
      'ghp_abcdefghijklmnopqrstuvwxyz0123',
      'AKIAABCDEFGHIJKLMNOP',
      'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abcdefghijklmnop'
    ].join('\n')
    expect(masked(text)).toBe('***\n***\n***\n***')
  })

  it('chave privada: o bloco inteiro, ou até o fim se ele foi cortado', () => {
    expect(masked('a\n-----BEGIN OPENSSH PRIVATE KEY-----\nAAAA\n-----END OPENSSH PRIVATE KEY-----\nb')).toBe('a\n***\nb')
    expect(masked('-----BEGIN RSA PRIVATE KEY-----\nAAAA\nBBBB')).toBe('***')
  })

  it('conta quantos trocou; texto comum passa igual', () => {
    expect(redactSecrets('API_KEY=x TOKEN=y')).toEqual({ text: 'API_KEY=*** TOKEN=***', count: 2 })
    expect(redactSecrets('3 testes passaram em 1.2s')).toEqual({ text: '3 testes passaram em 1.2s', count: 0 })
  })
})
