import { useEffect, useRef, useState, type RefObject } from 'react'
import { IS_WIN } from '../../platform'
import { usePreference } from '../../settings/preferences'
import { useActiveChats } from '../activeChats'
import type { CanvasNode } from '../types'

// O mascote vive numa janela própria, solta na tela, por cima de qualquer app (ver
// src/main/app/mascotOverlay.ts e MascotOverlay). As janelas do app só avisam o processo principal
// se ele está ligado (a preferência fica aqui, no localStorage), se alguém está escrevendo um
// pedido nesta janela (ele escuta com a mão na orelha) e, a do canvas, onde está a pasta de um
// pedido que acabou de começar (ele anda até ela para dar o golpe). O resto ele lê sozinho.

// Depois da última tecla, ainda conta como escrevendo.
const TYPING_MS = 1500

// nodesRef: os cards do canvas desta janela (sem ele, numa janela solta, não há pasta para mostrar).
export function MascotBridge({ nodesRef }: { nodesRef?: RefObject<CanvasNode[]> }) {
  const on = usePreference('mascot')
  const typing = useTyping()
  useEffect(() => window.api.mascot.setEnabled(on), [on])
  useEffect(() => {
    if (on) window.api.mascot.setTyping(typing)
  }, [on, typing])
  useStrikeTargets(on && !!nodesRef, nodesRef)
  return null
}

// Pedido novo (turnStartedAt novo) numa conversa cuja pasta está à vista nesta janela: manda onde
// está o cabeçalho dela (nome e caminho), que é onde o golpe acerta.
function useStrikeTargets(on: boolean, nodesRef?: RefObject<CanvasNode[]>) {
  const chats = useActiveChats()
  const seen = useRef<Map<string, number | undefined> | null>(null)
  useEffect(() => {
    const before = seen.current
    seen.current = new Map(chats.map((c) => [c.key, c.turnStartedAt]))
    if (!on || !before || document.visibilityState === 'hidden') return
    for (const c of chats) {
      if (!c.turnStartedAt || c.turnStartedAt === before.get(c.key)) continue
      const rect = folderHeader(c.cwd, nodesRef?.current ?? [])
      if (rect) window.api.mascot.reportTarget(c.key, c.turnStartedAt, rect)
    }
  }, [chats, on, nodesRef])
}

// Mesma pasta com barra de qualquer tipo no fim; no Windows, sem diferenciar maiúsculas.
function samePath(a: string, b: string): boolean {
  const norm = (p: string) => {
    const path = p.replace(/\\/g, '/').replace(/\/+$/, '')
    return IS_WIN ? path.toLowerCase() : path
  }
  return norm(a) === norm(b)
}

// O cabeçalho do card da pasta, se ele está dentro da janela.
function folderHeader(cwd: string, nodes: CanvasNode[]): { x: number; y: number; width: number; height: number } | null {
  const node = nodes.find((n) => n.type === 'project' && samePath(n.data.path, cwd))
  if (!node) return null
  const el = document.querySelector(`.react-flow__node[data-id="${CSS.escape(node.id)}"]`)
  const card = el?.getBoundingClientRect()
  if (!el || !card || card.right < 0 || card.left > window.innerWidth || card.bottom < 0 || card.top > window.innerHeight) return null
  const { x, y, width, height } = el.querySelector('header')?.getBoundingClientRect() ?? card
  return { x, y, width, height }
}

// Alguém digitando num campo de texto longo (caixa do chat, terminal) nesta janela.
function useTyping(): boolean {
  const [typing, setTyping] = useState(false)
  useEffect(() => {
    let timer = 0
    const onInput = (e: Event) => {
      if (!(e.target instanceof HTMLTextAreaElement)) return
      setTyping(true)
      clearTimeout(timer)
      timer = window.setTimeout(() => setTyping(false), TYPING_MS)
    }
    document.addEventListener('input', onInput, true)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('input', onInput, true)
    }
  }, [])
  return typing
}
