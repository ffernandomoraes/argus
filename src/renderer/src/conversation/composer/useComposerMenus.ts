import { useState } from 'react'
import type { AgentDef } from '../../../../shared/agents'
import { matchAgents } from '../agentMentions'
import { matchCommands } from '../slashCommands'

// Menus que abrem sobre o campo enquanto se digita: comandos ("/" + palavra) e agentes ("@" +
// palavra). active: o item marcado (setas e mouse); closed: fechado com ESC, clique fora ou escolha,
// até o texto mudar de novo.
export function useComposerMenus(draft: string, agents: AgentDef[]) {
  const [active, setActive] = useState(0)
  const [closed, setClosed] = useState(false)

  // Lista de comandos aparece enquanto o texto é "/" + palavra (igual à extensão do VS Code).
  const commands = closed ? null : matchCommands(draft)
  // Lista de agentes aparece enquanto o texto termina em "@" + palavra.
  const mention = closed || commands ? null : matchAgents(draft, agents)
  // Sem menu aberto, undefined: o Enter envia.
  const size = commands?.length ?? mention?.items.length

  return {
    commands,
    mention,
    size,
    active,
    setActive,
    move: (step: 1 | -1) => {
      if (size) setActive((i) => (i + step + size) % size)
    },
    close: () => setClosed(true),
    // Texto mudou: o menu volta a valer, com o primeiro item marcado.
    reset: () => {
      setActive(0)
      setClosed(false)
    }
  }
}
