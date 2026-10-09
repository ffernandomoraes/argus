import type { LiveStatus } from './history'

// Modo design: protótipos no código do projeto. Cada design é uma conversa do Claude Code na pasta
// do projeto, com a página vista pelo servidor de desenvolvimento dele, ao lado do chat. Começa do
// zero (o Claude cria a tela) ou de uma tela que já existe (o Claude ajusta a dela). Guardado em
// ~/.argus/design, um design.json por design.

export type DesignDevice = 'desktop' | 'mobile'

// Largura em que a página aparece; o drawer reduz para caber.
export const DEVICE_WIDTH: Record<DesignDevice, number> = { desktop: 1280, mobile: 390 }

// Versão do arquivo: os de antes (com wireframe e várias telas) não abrem mais.
export const DESIGN_VERSION = 2

export type Design = {
  version: typeof DESIGN_VERSION
  id: string
  name: string
  // Pasta do projeto: o código do protótipo vai para ela.
  projectPath: string
  // Dispositivo principal da tela; a pré-visualização troca de largura sem mudar isto.
  device: DesignDevice
  // Conversa do Claude Code que escreve a tela (vazia até o primeiro pedido).
  sessionId?: string
  // Endereço da tela no servidor ("/planos"): o da tela que já existe, ou o que o Claude informa
  // numa linha ROTA.
  route?: string
  // Tela que já existia no projeto, aberta para ajustar (não foi o Claude que criou).
  existing?: boolean
  // Porta do app em que a tela está, quando o projeto sobe vários (monorepo: site, admin, app).
  port?: number
  createdAt: string
  updatedAt: string
}

// Um design na lista de conversas da pasta. `live`: o status da conversa do protótipo agora
// (rodando, esperando você), para a lista e as linhas da pasta mostrarem como a conversa comum.
export type DesignSummary = { id: string; name: string; updatedAt: string; sessionId?: string; live?: LiveStatus | null }
