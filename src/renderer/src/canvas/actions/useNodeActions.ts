import { useMemo } from 'react'
import { useReactFlow, type XYPosition } from '@xyflow/react'
import { patchView, type CanvasViewStore } from '../canvasView'
import type { ConfirmRequest } from '../ConfirmDialog'
import { createGroup, createNote, createTerminal } from '../factory'
import { hidingGroup } from '../focus/reveal'
import { selectOnly } from '../focus/selectOnly'
import {
  addNode,
  dropIntoGroup,
  leaveGroup,
  removeNode,
  rename,
  setNoteText,
  setNoteWidth,
  sizeOf,
  toggleCollapse,
  toggleObscure,
  toggleProjectCollapse
} from '../operations'
import type { TerminalKind } from '../types'
import type { NodesApi } from './types'

// Criar, renomear e mexer nos blocos (grupo, nota, terminal) a partir dos menus e dos próprios
// blocos. Bloco novo nunca entra por cima de outro (addNode). O bloco em renomeação fica no
// store do canvas (canvasView), lido só pelo bloco dele.
export function useNodeActions(
  { nodesRef, setNodes, change }: NodesApi,
  view: CanvasViewStore,
  confirm: (request: ConfirmRequest) => void
) {
  const { setCenter, getZoom } = useReactFlow()

  return useMemo(() => {
    const setRenamingId = (renamingId: string | null) => patchView(view, { renamingId })
    // Sai da renomeação só se ainda for a deste bloco.
    const stopRenaming = (id: string) => view.set((s) => (s.renamingId === id ? { ...s, renamingId: null } : s))
    return {
      startRename: (id: string) => setRenamingId(id),
      finishRename: (id: string, value: string | null) => {
        stopRenaming(id)
        const name = value?.trim()
        const node = nodesRef.current.find((n) => n.id === id)
        // A nota não passa por aqui: ela guarda o texto pelo finishNote.
        if (node?.type === 'note') return
        const current = node?.type === 'area' ? node.data.label : node?.data.name
        if (name && name !== current) change((ns) => rename(ns, id, name))
      },
      addGroup: (position: XYPosition) => {
        const group = createGroup(position)
        change((ns) => addNode(ns, group))
        setRenamingId(group.id)
      },
      // Diferente dos outros blocos, a nota fica onde foi pedida, mesmo em cima de uma pasta:
      // ela é um lembrete sobre o que está embaixo. Em cima de um grupo, entra nele.
      // Nasce selecionada, sozinha: bloco selecionado sobe de camada no React Flow, e a pasta
      // selecionada embaixo cobriria a nota até perder a seleção.
      addNote: (position: XYPosition, groupId?: string) => {
        const note = createNote(position)
        change((ns) => (groupId ? addNode(ns, note, groupId) : dropIntoGroup([...ns, note], [note.id])))
        setNodes((ns) => selectOnly(ns, note.id))
        setRenamingId(note.id)
      },
      finishNote: (id: string, text: string) => {
        stopRenaming(id)
        const node = nodesRef.current.find((n) => n.id === id)
        // Só o fim do texto: quebras de linha no meio são da nota.
        const value = text.trimEnd()
        if (node?.type === 'note' && value !== node.data.text) change((ns) => setNoteText(ns, id, value))
      },
      setNoteWidth: (id: string, width: number) => change((ns) => setNoteWidth(ns, id, width)),
      // Terminal solto no canvas. Sem pasta conhecida, abre na pasta do usuário, sem perguntar.
      // Novo: pega o foco ao aparecer (useIsNewBlock). Num grupo recolhido ou oculto ele nasce
      // escondido e não é marcado: senão roubaria o foco quando o grupo abrisse, bem depois.
      addTerminal: (position: XYPosition, groupId?: string, folder?: string, kind?: TerminalKind) => {
        const node = createTerminal(position, folder ?? window.api.homeDir, kind)
        const next = addNode(nodesRef.current, node, groupId)
        if (!hidingGroup(next, node.id)) patchView(view, { newBlockId: node.id })
        change(next)
      },
      closeTerminal: (nodeId: string, name: string) => {
        const node = nodesRef.current.find((n) => n.id === nodeId)
        const shell = node?.type === 'terminal' && node.data.kind === 'shell'
        confirm({
          title: `Fechar o terminal "${name}"?`,
          description: shell
            ? 'O shell e o que estiver rodando nele são encerrados.'
            : 'A sessão do Claude que roda nele é encerrada. A conversa continua salva.',
          confirmLabel: 'Fechar terminal',
          onConfirm: () => {
            window.api.terminal.kill(nodeId)
            change((ns) => removeNode(ns, nodeId))
          }
        })
      },
      bindTerminalSession: (nodeId: string, sessionId: string) =>
        // Sem histórico: amarrar a conversa não é uma ação para desfazer.
        setNodes((ns) =>
          ns.map((n) =>
            n.id === nodeId && n.type === 'terminal' && !n.data.sessionId ? { ...n, data: { ...n.data, sessionId } } : n
          )
        ),
      toggleGroup: (id: string) => change((ns) => toggleCollapse(ns, id)),
      toggleObscure: (id: string) => change((ns) => toggleObscure(ns, id)),
      toggleProject: (id: string) => change((ns) => toggleProjectCollapse(ns, id)),
      // O bloco sai para fora do grupo e a câmera vai até ele, no zoom em que está.
      leaveGroup: (id: string) => {
        const next = leaveGroup(nodesRef.current, id)
        const node = next.find((n) => n.id === id)
        if (!node || next === nodesRef.current) return
        change(next)
        const { width, height } = sizeOf(node)
        void setCenter(node.position.x + width / 2, node.position.y + height / 2, { zoom: getZoom(), duration: 300 })
      }
    }
  }, [nodesRef, setNodes, change, view, confirm, setCenter, getZoom])
}
