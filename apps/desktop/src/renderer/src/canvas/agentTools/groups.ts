import { fitGroupToContent, setGroupColor, toggleCollapse } from '../operations'
import { findGroup } from './lookup'
import type { Tool } from './tool'

// Recolher, colorir e ajustar grupos.

const recolherGrupo: Tool = (args, env) => {
  const group = findGroup(env.nodes(), args.id)
  const want = !!args.recolhido
  if (!!group.data.collapsed !== want) env.apply(toggleCollapse(env.nodes(), group.id))
  return want ? 'Grupo recolhido.' : 'Grupo expandido.'
}

const corDoGrupo: Tool = (args, env) => {
  const group = findGroup(env.nodes(), args.id)
  env.apply(setGroupColor(env.nodes(), group.id, String(args.cor)))
  return 'Cor alterada.'
}

const ajustarGrupo: Tool = (args, env) => {
  const group = findGroup(env.nodes(), args.id)
  env.apply(fitGroupToContent(env.nodes(), group.id))
  return 'Grupo ajustado ao conteúdo.'
}

export const groupTools: Record<string, Tool> = {
  recolher_grupo: recolherGrupo,
  cor_do_grupo: corDoGrupo,
  ajustar_grupo: ajustarGrupo
}
