import type { ReactNode } from 'react'
import type { AuthState } from '../../../shared/auth'
import { IS_WIN, keys } from '../platform'
import { AgentsArt, CanvasArt, ChatArt, OrganizeArt, SetupArt } from './illustrations'
import { SetupStep } from './SetupStep'

export type Step = { title: string; art: ReactNode; body: ReactNode }

function Tip({ children }: { children: ReactNode }) {
  return <p className="mt-3 rounded-lg bg-surface-2 px-3 py-2 text-xs leading-relaxed text-muted">{children}</p>
}

const Code = ({ children }: { children: ReactNode }) => (
  <code className="rounded bg-bg px-1 py-0.5 font-mono text-[12px] text-text">{children}</code>
)

// As etapas das boas-vindas: o que o Argus faz e, por último, a configuração do Claude Code.
export function welcomeSteps(auth: AuthState): Step[] {
  return [
    {
      title: 'Seus projetos num canvas',
      art: <CanvasArt />,
      body: (
        <>
          <p>
            Cada pasta de projeto vira um bloco com as conversas do Claude Code. De relance, você vê o que está rodando, o que
            espera sua resposta e o que já terminou.
          </p>
          <Tip>
            Adicione pastas pelo botão + da barra lateral ou rodando <Code>argus .</Code> no terminal.
          </Tip>
        </>
      )
    },
    {
      title: 'Organize do seu jeito',
      art: <OrganizeArt />,
      body: (
        <>
          <p>
            Arraste os blocos e junte pastas em grupos coloridos, como Trabalho e Pessoal. Cada grupo pode usar uma conta
            diferente do Claude. O layout fica salvo.
          </p>
          <Tip>
            Prefere pedir? Na barra de comando ({keys('⌘K')}), escreva ou fale: "cria um grupo Freela com essas duas pastas".
          </Tip>
        </>
      )
    },
    {
      title: 'Converse e rode comandos',
      art: <ChatArt />,
      body: (
        <>
          <p>
            Abra a conversa no painel lateral, numa janela própria ou como bloco no canvas. Cole prints, dite por voz, aprove
            permissões e veja cada edição como diff.
          </p>
          <Tip>
            Os terminais abrem {IS_WIN ? 'no PowerShell' : 'no seu shell'}, com o <Code>claude</Code> pronto para usar.
          </Tip>
        </>
      )
    },
    {
      title: 'Agentes globais',
      art: <AgentsArt />,
      body: (
        <>
          <p>
            Agentes são especialistas que você cria uma vez (revisor, testador, redator) e valem em todos os projetos. O Claude
            pode escrever as instruções por você.
          </p>
          <Tip>
            Crie em Agentes, na barra lateral, e chame no chat com <Code>@nome</Code>.
          </Tip>
        </>
      )
    },
    {
      title: 'Configure o Claude Code',
      art: <SetupArt />,
      body: (
        <>
          <p>
            {IS_WIN
              ? 'O Argus usa o Claude Code deste computador e a sua assinatura. No Windows, ele também precisa do Git.'
              : 'O Argus usa o Claude Code deste Mac e a sua assinatura, o mesmo login do Terminal e do VS Code.'}
          </p>
          <SetupStep auth={auth} />
        </>
      )
    }
  ]
}
