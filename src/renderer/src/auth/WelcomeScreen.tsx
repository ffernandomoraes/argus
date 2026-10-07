import type { LoginState } from '../../../shared/auth'
import { ClaudeIcon } from '../icons/ClaudeIcon'
import { LoginPanel } from './LoginPanel'

// Sem login no Claude Code, o app abre nesta tela no lugar do canvas, como a extensão do VS Code.
export function WelcomeScreen({ login }: { login: LoginState }) {
  return (
    <div className="absolute inset-0 z-[60] flex items-center justify-center bg-bg p-6">
      {/* Faixa de cima continua arrastando a janela, como a barra de título. */}
      <div className="drag absolute inset-x-0 top-0 h-10" />
      <div className="flex w-[min(360px,100%)] flex-col">
        <ClaudeIcon size={32} />
        <h1 className="mt-5 text-lg font-semibold">Entre no Claude Code</h1>
        <p className="mb-6 mt-2 text-sm leading-relaxed text-muted">
          O Argus usa o login do Claude Code, o mesmo do terminal e do VS Code. Entre com sua assinatura do Claude ou
          pague pelo uso da API.
        </p>
        <LoginPanel login={login} />
      </div>
    </div>
  )
}
