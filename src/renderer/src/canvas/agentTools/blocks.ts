import type { XYPosition } from '@xyflow/react'
import { createFolderInstance, createGroup, createTerminal, GROUP_SIZE, INSTANCE_MIN_HEIGHT, INSTANCE_WIDTH, TERMINAL_SIZE } from '../factory'
import { addNode, moveToGroup, removeGroup, removeNode, rename, terminalsIn, ungroup } from '../operations'
import { findBlock, findGroup, kindOf, num } from './lookup'
import { ToolError, type Args, type Tool, type ToolEnv } from './tool'

// Criar, mudar de grupo, renomear e excluir blocos.

// Posição pedida, ou o centro da tela descontando metade do tamanho.
function placeAt(env: ToolEnv, args: Args, size: { width: number; height: number }): XYPosition {
  const x = num(args.x)
  const y = num(args.y)
  if (x !== undefined && y !== undefined) return { x, y }
  const c = env.screenCenter()
  return { x: x ?? c.x - size.width / 2, y: y ?? c.y - size.height / 2 }
}

const criarGrupo: Tool = (args, env) => {
  const size = { width: num(args.largura) ?? GROUP_SIZE.width, height: num(args.altura) ?? GROUP_SIZE.height }
  const base = createGroup(placeAt(env, args, size))
  const group = {
    ...base,
    ...size,
    style: { ...base.style, ...size },
    data: { ...base.data, label: String(args.nome || base.data.label), color: String(args.cor || base.data.color) }
  }
  env.apply(addNode(env.nodes(), group))
  return `Grupo criado: ${group.id}`
}

const adicionarPasta: Tool = async (args, env) => {
  const folder = args.caminho ? String(args.caminho) : await env.pickFolder()
  if (!folder) throw new ToolError('A pessoa fechou o seletor sem escolher pasta.')
  // Lido depois do seletor: a pessoa pode ter mexido no canvas enquanto escolhia.
  const nodes = env.nodes()
  const groupId = args.grupo_id ? findGroup(nodes, args.grupo_id).id : undefined
  const node = createFolderInstance(placeAt(env, args, { width: INSTANCE_WIDTH, height: INSTANCE_MIN_HEIGHT }), folder)
  env.apply(addNode(nodes, node, groupId))
  return `Pasta adicionada: ${node.id} (${node.data.path})`
}

const abrirTerminal: Tool = (args, env) => {
  const nodes = env.nodes()
  const groupId = args.grupo_id ? findGroup(nodes, args.grupo_id).id : undefined
  const node = createTerminal(placeAt(env, args, TERMINAL_SIZE), String(args.caminho))
  env.apply(addNode(nodes, node, groupId))
  return `Terminal aberto: ${node.id}`
}

const moverParaGrupo: Tool = (args, env) => {
  const nodes = env.nodes()
  const node = findBlock(nodes, args.id)
  if (node.type === 'area') throw new ToolError('Grupo não entra em outro grupo.')
  const groupId = args.grupo_id ? findGroup(nodes, args.grupo_id).id : null
  env.apply(moveToGroup(nodes, node.id, groupId))
  return groupId ? 'Movido para o grupo.' : 'Tirado do grupo.'
}

const renomear: Tool = (args, env) => {
  const node = findBlock(env.nodes(), args.id)
  env.apply(rename(env.nodes(), node.id, String(args.nome)))
  return 'Renomeado.'
}

const excluir: Tool = (args, env) => {
  const nodes = env.nodes()
  const node = findBlock(nodes, args.id)
  if (node.type === 'area') {
    const keep = !!args.manter_conteudo
    // Terminais que somem com o grupo não ficam rodando escondidos.
    if (!keep) terminalsIn(nodes, node.id).forEach((id) => env.killTerminal(id))
    env.apply(keep ? ungroup(nodes, node.id) : removeGroup(nodes, node.id))
    return keep ? 'Grupo excluído; o conteúdo ficou solto no canvas.' : 'Grupo excluído com o que tinha dentro.'
  }
  if (node.type === 'terminal') env.killTerminal(node.id)
  env.apply(removeNode(nodes, node.id))
  return `${kindOf(node)} excluído.`
}

export const blockTools: Record<string, Tool> = {
  criar_grupo: criarGrupo,
  adicionar_pasta: adicionarPasta,
  abrir_terminal: abrirTerminal,
  mover_para_grupo: moverParaGrupo,
  renomear,
  excluir
}
