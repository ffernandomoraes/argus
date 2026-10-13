import type { ReactNode } from 'react'
import type { AuthState } from '../../../shared/auth'
import { IS_LINUX, IS_WIN, keys } from '../platform'
import { AgentsArt, CanvasArt, ChatArt, OrganizeArt, SetupArt } from './illustrations'
import { SetupStep } from './SetupStep'
import { tr } from '../i18n'

export type Step = { title: string; art: ReactNode; body: ReactNode }

function Tip({ children }: { children: ReactNode }) {
  return <p className="mt-3 rounded-lg bg-surface-2 px-3 py-2 text-xs leading-relaxed text-muted">{children}</p>
}

const Code = ({ children }: { children: ReactNode }) => (
  <code className="whitespace-nowrap rounded bg-bg px-1 py-0.5 font-mono text-[12px] text-text">{children}</code>
)

// As etapas das boas-vindas: o que o Argus faz e, por último, a configuração do Claude Code.
export function welcomeSteps(auth: AuthState): Step[] {
  return [
    {
      title: tr('Seus projetos num canvas', 'Your projects on a canvas'),
      art: <CanvasArt />,
      body: (
        <>
          <p>
            {tr(
              'Cada pasta de projeto vira um bloco com as conversas do Claude Code. De relance, você vê o que está rodando, o que espera sua resposta e o que já terminou.',
              'Each project folder becomes a block with its Claude Code chats. At a glance, you see what is running, what is waiting for your reply and what is done.'
            )}
          </p>
          <Tip>
            {tr('Adicione pastas pelo botão + da barra lateral ou rodando', 'Add folders with the + button in the sidebar or by running')}{' '}
            <Code>argus .</Code> {tr('no terminal.', 'in the terminal.')}
          </Tip>
        </>
      )
    },
    {
      title: tr('Organize do seu jeito', 'Organize your way'),
      art: <OrganizeArt />,
      body: (
        <>
          <p>
            {tr(
              'Arraste os blocos e junte pastas em grupos coloridos, como Trabalho e Pessoal. Cada grupo pode usar uma conta diferente do Claude. O layout fica salvo.',
              'Drag blocks around and gather folders into colored groups, like Work and Personal. Each group can use a different Claude account. The layout is saved.'
            )}
          </p>
          <Tip>
            {tr(
              `Prefere pedir? Na barra de comando (${keys('⌘K')}), escreva ou fale: "cria um grupo Freela com essas duas pastas".`,
              `Rather ask? In the command bar (${keys('⌘K')}), type or say: "create a Freelance group with these two folders".`
            )}
          </Tip>
        </>
      )
    },
    {
      title: tr('Converse e rode comandos', 'Chat and run commands'),
      art: <ChatArt />,
      body: (
        <>
          <p>
            {tr(
              'Abra a conversa no painel lateral, numa janela própria ou como bloco no canvas. Cole prints, dite por voz, aprove permissões e veja cada edição como diff.',
              'Open a chat in the side panel, in its own window or as a block on the canvas. Paste screenshots, dictate by voice, approve permissions and see each edit as a diff.'
            )}
          </p>
          <Tip>
            {IS_WIN ? tr('Os terminais abrem no PowerShell, com o', 'Terminals open in PowerShell, with') : tr('Os terminais abrem no seu shell, com o', 'Terminals open in your shell, with')}{' '}
            <Code>claude</Code> {tr('pronto para usar.', 'ready to use.')}
          </Tip>
        </>
      )
    },
    {
      title: tr('Agentes globais', 'Global agents'),
      art: <AgentsArt />,
      body: (
        <>
          <p>
            {tr(
              'Agentes são especialistas que você cria uma vez (revisor, testador, redator) e valem em todos os projetos. O Claude pode escrever as instruções por você.',
              'Agents are specialists you create once (reviewer, tester, writer) and use in every project. Claude can write the instructions for you.'
            )}
          </p>
          <Tip>
            {tr('Crie em Agentes, na barra lateral, e chame no chat com', 'Create them in Agents, in the sidebar, and call them in a chat with')}{' '}
            <Code>{tr('@nome', '@name')}</Code>.
          </Tip>
        </>
      )
    },
    {
      title: tr('Configure o Claude Code', 'Set up Claude Code'),
      art: <SetupArt />,
      body: (
        <>
          <p>
            {IS_WIN
              ? tr(
                  'O Argus usa o Claude Code deste computador e a sua assinatura. No Windows, ele também precisa do Git.',
                  'Argus uses Claude Code on this computer and your subscription. On Windows, it also needs Git.'
                )
              : IS_LINUX
                ? tr(
                    'O Argus usa o Claude Code deste computador e a sua assinatura, o mesmo login do terminal. Ele também precisa do Git.',
                    'Argus uses Claude Code on this computer and your subscription, the same login as the terminal. It also needs Git.'
                  )
                : tr(
                    'O Argus usa o Claude Code deste Mac e a sua assinatura, o mesmo login do Terminal e do VS Code.',
                    'Argus uses Claude Code on this Mac and your subscription, the same login as Terminal and VS Code.'
                  )}
          </p>
          <SetupStep auth={auth} />
        </>
      )
    }
  ]
}
