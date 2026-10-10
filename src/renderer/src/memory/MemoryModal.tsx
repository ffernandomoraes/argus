import type { MemoryProject } from '../../../shared/memory'
import { useSaveShortcut } from '../lib/useSaveShortcut'
import { Modal } from '../ui/Modal'
import { findLinked } from './memoryText'
import { MemoryFileView } from './MemoryFileView'
import { MemoryNav } from './MemoryNav'
import { useMemoryFiles } from './useMemoryFiles'

const DISCARD = 'Descartar as alterações deste arquivo?'

// Memória do Claude Code: instruções (CLAUDE.md) e o que ele anotou sozinho, por pasta do canvas.
export function MemoryModal({
  projects,
  only,
  initialProject,
  onClose
}: {
  projects: MemoryProject[]
  // Caminho de uma pasta: mostra só a memória dela, sem o global e sem as outras.
  only?: string
  // Pasta da conversa aberta: começa mostrando a memória dela.
  initialProject?: string
  onClose: () => void
}) {
  const memory = useMemoryFiles(projects, only, initialProject)
  const { current, draft, dirty, editing, setDraft } = memory

  const select = (path: string) => {
    if (dirty && !window.confirm(DISCARD)) return
    memory.select(path)
  }

  // ⌘S salva a edição.
  useSaveShortcut(memory.save, editing)

  const openLink = (target: string) => {
    const found = current && findLinked(memory.files, current, target)
    if (found) select(found.path)
  }

  return (
    <Modal
      label="Memória do Claude"
      size="xl"
      className="flex"
      onClose={onClose}
      // Sair com alteração pergunta antes de descartar.
      onRequestClose={() => !dirty || window.confirm(DISCARD)}
      // Editando, o Esc sai da edição sem alteração; com alteração, não faz nada (sair é pelos
      // botões, que perguntam antes de descartar).
      onEscape={
        editing
          ? () => {
              if (!dirty) memory.cancel()
            }
          : undefined
      }
    >
      <MemoryNav groups={memory.groups} only={only} selected={memory.selected} onSelect={select} />
      <MemoryFileView
        current={current}
        text={memory.text}
        draft={draft}
        error={memory.error}
        dirty={dirty}
        onEdit={memory.edit}
        onCancel={memory.cancel}
        onDraftChange={setDraft}
        onSave={() => void memory.save()}
        onOpenLink={openLink}
      />
    </Modal>
  )
}
