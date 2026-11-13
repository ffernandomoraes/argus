// O código de um erro do Node ('ENOENT', 'EPERM'...), ou '' quando não tem.
export function errorCode(err: unknown): string {
  const code = (err as { code?: unknown } | null)?.code
  return typeof code === 'string' ? code : ''
}

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}
