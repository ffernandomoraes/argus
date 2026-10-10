import { useEffect, useEffectEvent, useState } from 'react'
import type { MemoryGroup, MemoryProject } from '../../../shared/memory'

// Arquivos de memória do modal: a lista por pasta, o escolhido, o texto dele e a edição em curso.
// `only`: só a memória dessa pasta. `initialProject`: começa mostrando a memória dela.
export function useMemoryFiles(projects: MemoryProject[], only?: string, initialProject?: string) {
  const [groups, setGroups] = useState<MemoryGroup[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  // Texto lido, com o caminho de quem é: outro arquivo escolhido fica "carregando" até o dele
  // chegar, sem apagar o texto à mão (o que fazia a tela piscar).
  const [loaded, setLoaded] = useState<{ path: string; text: string } | null>(null)
  const [draft, setDraft] = useState<string | null>(null)
  // Texto do arquivo quando a edição começou: salvar confere se o disco ainda é ele. Depois de um
  // conflito avisado, o próximo salvar grava por cima.
  const [base, setBase] = useState<{ text: string; overwrite: boolean } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const files = groups.flatMap((g) => g.files)
  const current = files.find((f) => f.path === selected) ?? null
  const text = loaded && loaded.path === selected ? loaded.text : null
  const editing = draft !== null
  const dirty = editing && draft !== text

  // A lista de pastas do canvas é recriada a cada mudança no canvas: o que importa são os caminhos.
  const projectsKey = projects.map((p) => p.path).join('\n')
  const latestProjects = useEffectEvent(() => projects)

  const show = (all: MemoryGroup[]) => {
    const list = only ? all.filter((g) => g.projectPath === only) : all
    setGroups(list)
    return list
  }
  const reload = async () => show(await window.api.memory.list(projects))

  // Primeira lista: começa na pasta pedida (ou na da conversa aberta), no índice dela.
  const showFirst = useEffectEvent((all: MemoryGroup[]) => {
    const list = show(all)
    const group = list.find((g) => g.projectPath === (only ?? initialProject)) ?? list[0]
    const first = group?.files.find((f) => f.kind === 'index') ?? group?.files[0]
    setSelected(first?.path ?? null)
  })
  useEffect(() => {
    let alive = true
    window.api.memory.list(latestProjects()).then(
      (all) => alive && showFirst(all),
      (err: unknown) => console.error('[memória] listar:', err)
    )
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    if (!selected) return
    let alive = true
    window.api.memory.read(selected, latestProjects()).then(
      (t) => alive && setLoaded({ path: selected, text: t ?? '' }),
      (err: unknown) => console.error('[memória] ler arquivo:', err)
    )
    return () => {
      alive = false
    }
  }, [selected, projectsKey])

  const edit = () => {
    const start = text ?? ''
    setDraft(start)
    setBase({ text: start, overwrite: false })
    setError(null)
  }

  // Sai da edição sem salvar (o aviso de conflito, se havia, sai junto).
  const cancel = () => {
    setDraft(null)
    setError(null)
  }

  // Outro arquivo: a edição deste é descartada (quem chama pergunta antes, se houver mudança).
  const select = (path: string) => {
    setDraft(null)
    setError(null)
    setSelected(path)
  }

  const save = async () => {
    if (!current || draft === null) return
    const res = await window.api.memory.write(current.path, draft, projects, base?.overwrite ? undefined : base?.text)
    if (res === 'conflict') {
      setBase({ text: base?.text ?? '', overwrite: true })
      setError('Este arquivo mudou no disco depois que você começou a editar. Salvar de novo grava por cima.')
      // Cancelar a edição mostra a versão nova do disco, não a de quando abriu.
      const path = current.path
      window.api.memory.read(path, projects).then(
        (t) => setLoaded({ path, text: t ?? '' }),
        (err: unknown) => console.error('[memória] ler arquivo:', err)
      )
      return
    }
    if (!res) return setError('Não foi possível salvar este arquivo.')
    setLoaded({ path: current.path, text: draft })
    setDraft(null)
    setError(null)
    // A lista relida mostra o arquivo criado (o "criar" some) e a descrição nova.
    reload().catch((err: unknown) => console.error('[memória] listar:', err))
  }

  return { groups, files, selected, current, text, draft, setDraft, error, editing, dirty, edit, cancel, select, save }
}
