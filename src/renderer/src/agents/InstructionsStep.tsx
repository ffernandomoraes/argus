import type { Draft } from './agentDraft'
import { Field, INPUT } from './Field'
import { tr } from '../i18n'

// Primeiro passo: nome, quando usar e as instruções do agente.
export function InstructionsStep({ draft, onChange }: { draft: Draft; onChange: (patch: Partial<Draft>) => void }) {
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
        hint={tr(
          'O Claude lê isto para decidir sozinho se chama este agente. Diga a tarefa e quando ela aparece.',
          'Claude reads this to decide on its own whether to call this agent. Describe the task and when it comes up.'
        )}
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
        hint={tr(
          'O que o agente sabe e como trabalha, passo a passo. Ele não vê a conversa: só o pedido que recebe.',
          'What the agent knows and how it works, step by step. It doesn’t see the chat: only the request it receives.'
        )}
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
    </div>
  )
}
