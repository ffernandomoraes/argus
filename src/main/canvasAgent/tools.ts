import { tool } from '@anthropic-ai/claude-agent-sdk'
import { z } from 'zod'
import { findFolders, isDir } from './findFolders'
import { SYSTEM_NAME } from './prompt'

type Args = Record<string, unknown>

export const ok = (text: string) => ({ content: [{ type: 'text' as const, text }] })
export const fail = (text: string) => ({ content: [{ type: 'text' as const, text }], isError: true })

type ToolReply = ReturnType<typeof ok> | ReturnType<typeof fail>

// O que as ferramentas usam da sessão (ver index.ts).
export type ToolHost = {
  // Ferramenta executada pela janela do canvas; o rótulo aparece na barra enquanto roda.
  forward: (name: string, label: string) => (args: Args) => Promise<ToolReply>
  // Rótulo de uma ferramenta que roda aqui mesmo.
  activity: (label: string) => void
}

const id = z.string().describe('id do bloco, como aparece em ver_canvas')

export function canvasTools({ forward: f, activity }: ToolHost) {
  return [
    tool(
      'ver_canvas',
      'Lista todos os blocos do canvas (grupos, pastas, terminais) com id, nome, posição e tamanho absolutos, e a área visível da tela.',
      {},
      f('ver_canvas', 'Olhando o canvas')
    ),
    tool(
      'mover',
      'Move um ou mais blocos para posições absolutas (canto superior esquerdo). Bloco dentro de grupo continua no grupo; o grupo cresce se precisar.',
      { itens: z.array(z.object({ id, x: z.number(), y: z.number() })).min(1) },
      f('mover', 'Movendo blocos')
    ),
    tool(
      'organizar_em_grade',
      'Arruma blocos em grade, na ordem dada (esquerda para direita, depois a próxima linha). Os blocos precisam estar no mesmo grupo, ou todos soltos. Dentro de grupo, a grade começa no canto do grupo e o grupo se ajusta ao conteúdo.',
      {
        ids: z.array(z.string()).min(1).describe('ids na ordem desejada'),
        colunas: z.number().int().min(1).optional().describe('blocos por linha; padrão: todos numa linha só'),
        x: z.number().optional().describe('só para blocos soltos: onde começa a grade; padrão: onde está o primeiro'),
        y: z.number().optional()
      },
      f('organizar_em_grade', 'Organizando blocos')
    ),
    tool(
      'criar_grupo',
      'Cria um grupo vazio. Sem posição, fica no centro da tela.',
      {
        nome: z.string(),
        cor: z.string().optional().describe('hex da paleta: #3b82f6 azul, #8b5cf6 roxo, #ec4899 rosa, #ef4444 vermelho, #f59e0b laranja, #10b981 verde, #06b6d4 ciano, #71717a cinza'),
        x: z.number().optional(),
        y: z.number().optional(),
        largura: z.number().optional(),
        altura: z.number().optional()
      },
      f('criar_grupo', 'Criando grupo')
    ),
    tool(
      'procurar_pasta',
      'Procura pastas no disco pelo nome (Desktop, Documentos e perto das pastas que já estão no canvas). Devolve caminhos.',
      { nome: z.string() },
      async ({ nome }) => {
        activity('Procurando pasta')
        const found = await findFolders(nome)
        return ok(found.length ? found.join('\n') : 'Nenhuma pasta encontrada com esse nome.')
      }
    ),
    tool(
      'adicionar_pasta',
      `Adiciona uma pasta de projeto ao canvas. Sem caminho, abre o seletor de pasta do ${SYSTEM_NAME} para a pessoa escolher.`,
      {
        caminho: z.string().optional().describe('caminho absoluto ou começando com ~/'),
        grupo_id: z.string().optional().describe('grupo onde a pasta entra'),
        x: z.number().optional(),
        y: z.number().optional()
      },
      async (args) => {
        if (args.caminho && !(await isDir(args.caminho))) return fail(`A pasta ${args.caminho} não existe.`)
        return f('adicionar_pasta', args.caminho ? 'Adicionando pasta' : 'Esperando você escolher a pasta')(args)
      }
    ),
    tool(
      'abrir_terminal',
      'Abre um terminal com o claude numa pasta.',
      {
        caminho: z.string().describe('pasta onde o terminal abre; pode ser o caminho de uma pasta do canvas'),
        grupo_id: z.string().optional(),
        x: z.number().optional(),
        y: z.number().optional()
      },
      async (args) => {
        if (!(await isDir(args.caminho))) return fail(`A pasta ${args.caminho} não existe.`)
        return f('abrir_terminal', 'Abrindo terminal')(args)
      }
    ),
    tool(
      'mover_para_grupo',
      'Coloca uma pasta ou terminal dentro de um grupo (num lugar livre), ou tira do grupo com grupo_id null.',
      { id, grupo_id: z.string().nullable() },
      f('mover_para_grupo', 'Mudando de grupo')
    ),
    tool('renomear', 'Renomeia um bloco.', { id, nome: z.string() }, f('renomear', 'Renomeando')),
    tool(
      'excluir',
      'Exclui um bloco. Grupo: por padrão exclui junto o que está dentro; com manter_conteudo, o conteúdo fica solto no canvas. Terminal: encerra o processo. Pasta: só sai do canvas, nada é apagado do disco.',
      { id, manter_conteudo: z.boolean().optional() },
      f('excluir', 'Excluindo')
    ),
    tool(
      'recolher_grupo',
      'Recolhe (só a barra do título) ou expande um grupo.',
      { id, recolhido: z.boolean() },
      f('recolher_grupo', 'Recolhendo grupo')
    ),
    tool(
      'cor_do_grupo',
      'Muda a cor de um grupo. Use um hex da paleta de criar_grupo.',
      { id, cor: z.string() },
      f('cor_do_grupo', 'Mudando cor')
    ),
    tool(
      'ajustar_grupo',
      'Redimensiona o grupo para caber exatamente no que está dentro.',
      { id },
      f('ajustar_grupo', 'Ajustando grupo')
    ),
    tool(
      'focar',
      'Move a câmera para mostrar os blocos indicados. Sem ids, mostra o canvas todo.',
      { ids: z.array(z.string()).optional() },
      f('focar', 'Ajustando a visão')
    )
  ]
}
