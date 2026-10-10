import type { Draft } from './agentDraft'
import { Field, INPUT } from './Field'

// Primeiro passo: nome, quando usar e as instruções do agente.
export function InstructionsStep({ draft, onChange }: { draft: Draft; onChange: (patch: Partial<Draft>) => void }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-5 py-4">
      <Field label="Nome" hint="Letras minúsculas, números e hífen. É como você chama no chat: @nome.">
        <input
          value={draft.name}
          onChange={(e) => onChange({ name: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
          placeholder="revisor-de-telas"
          spellCheck={false}
          autoFocus={!draft.name}
          className={`${INPUT} font-mono`}
        />
      </Field>
      <Field label="Quando usar" hint="O Claude lê isto para decidir sozinho se chama este agente. Diga a tarefa e quando ela aparece.">
        <textarea
          value={draft.description}
          onChange={(e) => onChange({ description: e.target.value })}
          rows={2}
          placeholder="Revisa telas novas comparando com o Figma. Use depois de implementar ou alterar uma tela."
          className={`${INPUT} resize-none`}
        />
      </Field>
      <Field
        label="Instruções"
        hint="O que o agente sabe e como trabalha, passo a passo. Ele não vê a conversa: só o pedido que recebe."
        className="min-h-72 flex-1"
      >
        <textarea
          value={draft.prompt}
          onChange={(e) => onChange({ prompt: e.target.value })}
          placeholder={
            'Você revisa telas recém-implementadas no projeto atual.\n\n1. Leia o projeto: stack, componentes e tokens existentes.\n2. Abra a tela no navegador e tire prints.\n3. ...'
          }
          className={`${INPUT} flex-1 resize-none text-[14px] leading-relaxed`}
        />
      </Field>
    </div>
  )
}
