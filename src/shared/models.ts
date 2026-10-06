// Modelos que o `claude` informa na inicialização (mesma lista da extensão do VS Code).
export type ClaudeModel = {
  // Valor para --model e /model; '' = padrão do Claude Code.
  value: string
  displayName: string
  // Para o padrão: nome do modelo a que ele aponta hoje (ex.: "Opus 5.5").
  resolvedName?: string
  efforts: string[]
}

// O que o `claude` informa ao iniciar e o app usa nos seletores.
export type ClaudeInfo = {
  models: ClaudeModel[]
  // Modo de permissão padrão da conta, no valor que o --permission-mode aceita.
  defaultPermissionMode: string
  // Conta logada no `claude`; nulo se não houver login.
  account: { email?: string; organization?: string; subscriptionType?: string } | null
}
