import { agentProviderName, type AgentProvider } from '../../../shared/agents'
import type { Draft } from './agentDraft'
import { Field, INPUT } from './Field'
import { tr } from '../i18n'

// Primeiro passo: nome, quando usar e as instruções do agente. No Codex e no Gemini, também o
// modelo (no Claude ele fica no passo de ferramentas; no Cursor, o agente vai no texto da mensagem
// e roda no modelo da conversa).
export function InstructionsStep({ provider, draft, onChange }: { provider: AgentProvider; draft: Draft; onChange: (patch: Partial<Draft>) => void }) {
  const name = agentProviderName(provider)
  const injected = provider === 'cursor'
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-5 py-4">
      <Field
        label={tr('Nome', 'Name')}
        hint={tr('Letras minúsculas, números e hífen. É como você chama no chat: @nome.', 'Lowercase letters, numbers and hyphens. It’s how you call it in a chat: @name.')}
      >
        <input
          value={draft.name}
          onChange={(e) => onChange({ name: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
          placeholder={tr('revisor-de-telas', 'screen-reviewer')}
          spellCheck={false}
          autoFocus={!draft.name}
          className={`${INPUT} font-mono`}
        />
      </Field>
      <Field
        label={tr('Quando usar', 'When to use')}
        hint={
          injected
            ? tr('Aparece no @ da conversa, para lembrar quando usar este agente.', 'Shown in the chat’s @ menu, as a reminder of when to use this agent.')
            : tr(
                `O ${name} lê isto para decidir se chama este agente. Diga a tarefa e quando ela aparece.`,
                `${name} reads this to decide whether to call this agent. Describe the task and when it comes up.`
              )
        }
      >
        <textarea
          value={draft.description}
          onChange={(e) => onChange({ description: e.target.value })}
          rows={2}
          placeholder={tr(
            'Revisa telas novas comparando com o Figma. Use depois de implementar ou alterar uma tela.',
            'Reviews new screens against the Figma design. Use after implementing or changing a screen.'
          )}
          className={`${INPUT} resize-none`}
        />
      </Field>
      <Field
        label={tr('Instruções', 'Instructions')}
        hint={
          injected
            ? tr(
                'O que o agente sabe e como trabalha, passo a passo. Vai junto da mensagem quando você chama com @.',
                'What the agent knows and how it works, step by step. It goes along with your message when you call it with @.'
              )
            : tr(
                'O que o agente sabe e como trabalha, passo a passo. Ele não vê a conversa: só o pedido que recebe.',
                'What the agent knows and how it works, step by step. It doesn’t see the chat: only the request it receives.'
              )
        }
        className="min-h-72 flex-1"
      >
        <textarea
          value={draft.prompt}
          onChange={(e) => onChange({ prompt: e.target.value })}
          placeholder={tr(
            'Você revisa telas recém-implementadas no projeto atual.\n\n1. Leia o projeto: stack, componentes e tokens existentes.\n2. Abra a tela no navegador e tire prints.\n3. ...',
            'You review newly implemented screens in the current project.\n\n1. Read the project: stack, existing components and tokens.\n2. Open the screen in the browser and take screenshots.\n3. ...'
          )}
          className={`${INPUT} flex-1 resize-none text-[14px] leading-relaxed`}
        />
      </Field>
      {(provider === 'codex' || provider === 'gemini') && (
        <Field
          label={tr('Modelo', 'Model')}
          hint={tr(
            `Opcional. O nome do modelo do ${name}, como aparece no seletor da conversa. Vazio: o mesmo da conversa.`,
            `Optional. The ${name} model name, as shown in the chat’s picker. Empty: same as the chat.`
          )}
        >
          <input value={draft.model} onChange={(e) => onChange({ model: e.target.value.trim() })} spellCheck={false} className={`${INPUT} font-mono`} />
        </Field>
      )}
    </div>
  )
}
