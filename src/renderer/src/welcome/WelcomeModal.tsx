import { X } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import type { AuthState } from '../../../shared/auth'
import { IS_WIN, keys } from '../platform'
import { useEscape } from '../useEscape'
import { AgentsArt, CanvasArt, ChatArt, OrganizeArt, SetupArt } from './illustrations'
import { SetupStep, setupReady } from './SetupStep'

type Step = { title: string; art: ReactNode; body: ReactNode }

function Tip({ children }: { children: ReactNode }) {
  return <p className="mt-3 rounded-lg bg-surface-2 px-3 py-2 text-xs leading-relaxed text-muted">{children}</p>
}

const Code = ({ children }: { children: ReactNode }) => (
  <code className="rounded bg-bg px-1 py-0.5 font-mono text-[12px] text-text">{children}</code>
)

function steps(auth: AuthState): Step[] {
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

// Boas-vindas em até 5 etapas: o que o Argus faz e, por último, a configuração do Claude Code.
// startAtSetup: já viu o passo a passo e só falta configurar (sem login, Claude desinstalado).
// Só fecha com a configuração pronta: sem ela, o canvas não funciona. Antes disso, o X leva à configuração.
export function WelcomeModal({ auth, startAtSetup, onDone }: { auth: AuthState; startAtSetup: boolean; onDone: () => void }) {
  const list = steps(auth)
  const last = list.length - 1
  const [index, setIndex] = useState(startAtSetup ? last : 0)
  const ready = setupReady(auth)
  useEscape(onDone, ready)
  const step = list[index]
  const closeBlocked = !ready && index === last

  return (
    <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/50 px-6 pb-6 pt-12 backdrop-blur-[2px]">
      {/* Faixa de cima continua arrastando a janela, como a barra de título. */}
      <div className="drag absolute inset-x-0 top-0 h-10" />
      <div
        role="dialog"
        aria-label="Boas-vindas ao Argus"
        className="relative flex max-h-full w-[min(540px,100%)] flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl shadow-black/50"
      >
        <button
          aria-label="Fechar"
          title={ready ? 'Fechar' : closeBlocked ? 'Termine a configuração para fechar' : 'Ir para a configuração'}
          disabled={closeBlocked}
          onClick={() => (ready ? onDone() : setIndex(last))}
          className="absolute right-3 top-3 z-10 flex size-7 items-center justify-center rounded-md text-muted hover:bg-fill hover:text-text disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-muted"
        >
          <X size={15} />
        </button>
        {/* Topo com folga para o X não cobrir a ilustração. */}
        <div key={index} className="welcome-step min-h-0 flex-1 overflow-y-auto px-6 pt-12 pb-4">
          {/* Pontos do canvas em toda a moldura, também nas laterais que a ilustração não cobre. */}
          <div
            className="h-[170px] overflow-hidden rounded-xl border border-line bg-bg"
            style={{ backgroundImage: 'radial-gradient(var(--color-dots) 1px, transparent 1.2px)', backgroundSize: '12px 12px' }}
          >
            {step.art}
          </div>
          <p className="mt-5 text-[12px] font-medium uppercase tracking-wide text-faint">
            {index + 1} de {list.length}
          </p>
          <h1 className="mt-1 text-lg font-semibold text-text">{step.title}</h1>
          <div className="mt-2 text-sm leading-relaxed text-muted">{step.body}</div>
        </div>

        <footer className="flex shrink-0 items-center gap-3 border-t border-line px-6 py-3">
          <div className="flex gap-1.5" role="tablist" aria-label="Etapas">
            {list.map((s, i) => (
              <button
                key={s.title}
                role="tab"
                aria-selected={i === index}
                aria-label={s.title}
                title={s.title}
                onClick={() => setIndex(i)}
                className={`h-1.5 rounded-full transition-all ${i === index ? 'w-5 bg-text' : 'w-1.5 bg-line-strong hover:bg-muted'}`}
              />
            ))}
          </div>
          <div className="flex-1" />
          {index > 0 && (
            <button onClick={() => setIndex(index - 1)} className="rounded-md border border-line px-3 py-1.5 text-sm text-text hover:bg-surface-2">
              Voltar
            </button>
          )}
          {index < last ? (
            <button onClick={() => setIndex(index + 1)} className="rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-white hover:brightness-110">
              Próximo
            </button>
          ) : (
            <button
              disabled={!ready}
              onClick={onDone}
              title={ready ? undefined : 'Termine a configuração acima'}
              className="rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-white hover:brightness-110 disabled:opacity-40"
            >
              Começar
            </button>
          )}
        </footer>
      </div>
    </div>
  )
}
