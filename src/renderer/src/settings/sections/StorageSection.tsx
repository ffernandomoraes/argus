import { useEffect, useState } from 'react'
import { withMediaCap, type CleanResult, type StorageSettings, type StorageUsage } from '../../../../shared/storage'
import { LOCALE, tr } from '../../i18n'
import { IS_MAC } from '../../platform'
import { formatBytes } from '../../systemHealth/texts'
import { Button } from '../../ui/Button'
import { Group, Row, Segmented } from '../controls'

// O que as conversas e os rascunhos do agente ocupam, os prazos da limpeza automática (ver
// main/storage) e o "Limpar agora". Medir os rascunhos leva alguns segundos: a tela pergunta de novo
// enquanto não vem.

const POLL_MS = 2_000
// O disco na base do sistema: o Finder conta de 1000 em 1000; o Windows, de 1024.
const BASE = IS_MAC ? 1000 : 1024

const CONVERSATION_DAYS = [30, 60, 90, 180, 365]
const SCRATCH_DAYS = [1, 3, 7, 14]
const MEDIA_DAYS = [30, 60, 90, 180]

const days = (n: number) => (n === 1 ? tr('1 dia', '1 day') : tr(`${n} dias`, `${n} days`))

// Um prazo posto à mão no settings.json do Claude Code (fora das opções) aparece também, marcado.
const withCurrent = (list: number[], current: number) => (list.includes(current) ? list : [...list, current].sort((a, b) => a - b))

// A data da última limpeza, sozinha: o detalhe do que sai fica no ícone de info.
function lastCleanText(last: CleanResult | null): string | undefined {
  if (!last) return undefined
  const when = new Date(last.at).toLocaleString(LOCALE, { dateStyle: 'short', timeStyle: 'short' })
  return tr(`Última limpeza: ${when}`, `Last cleanup: ${when}`)
}

// O que o "Limpar agora" fez, logo abaixo do botão: sem isso, uma limpeza que não achou nada
// parecia não ter rodado.
function resultText(r: CleanResult): string {
  if (!r.freedBytes && !r.scratchRemoved && !r.conversationsTrimmed) return tr('Nada passou dos prazos.', 'Nothing is past the periods.')
  return tr(`Liberou ${formatBytes(r.freedBytes, BASE)}.`, `Freed ${formatBytes(r.freedBytes, BASE)}.`)
}

// O que o botão apaga, com os prazos de agora: os rascunhos e os prints que já passaram deles. O total
// das linhas de cima não é isso (a aba mostrava 21 GB, e o botão não tinha nada para apagar).
function freeableLabel(f: StorageUsage['freeable']): string {
  if (!f) return tr('Medindo o que dá para liberar…', 'Measuring what can be freed…')
  return tr(`Pode liberar ${formatBytes(f.scratchBytes + f.mediaBytes, BASE)}`, `Can free ${formatBytes(f.scratchBytes + f.mediaBytes, BASE)}`)
}

function freeableInfo(f: StorageUsage['freeable'], s: StorageSettings): string | undefined {
  if (!f) return undefined
  return [
    tr(
      `Rascunhos parados há mais de ${days(s.scratchDays)}: ${formatBytes(f.scratchBytes, BASE)}`,
      `Scratch files idle for more than ${days(s.scratchDays)}: ${formatBytes(f.scratchBytes, BASE)}`
    ),
    tr(
      `Prints de conversas paradas há mais de ${days(s.mediaDays)}: ${formatBytes(f.mediaBytes, BASE)}`,
      `Screenshots from chats idle for more than ${days(s.mediaDays)}: ${formatBytes(f.mediaBytes, BASE)}`
    ),
    tr('Roda sozinha ao abrir o Argus e uma vez por dia.', 'Runs on its own when Argus opens and once a day.')
  ].join('\n')
}

export function StorageSection() {
  const [usage, setUsage] = useState<StorageUsage | null>(null)
  const [settings, setSettings] = useState<StorageSettings | null>(null)
  const [cleaning, setCleaning] = useState(false)
  // O resultado do último clique em "Limpar agora", nesta abertura da aba.
  const [result, setResult] = useState<CleanResult | null>(null)

  useEffect(() => {
    let alive = true
    void window.api.storage.settings().then((s) => alive && setSettings(s))
    void window.api.storage.usage().then((u) => alive && setUsage(u))
    return () => {
      alive = false
    }
  }, [])

  // Ainda medindo (ou com o prazo recém-trocado), ou uma limpeza rodando: pergunta de novo daqui a pouco.
  const pending = !usage || usage.scratchBytes === null || !usage.freeable || usage.running
  useEffect(() => {
    if (!pending) return
    let alive = true
    const timer = setInterval(() => void window.api.storage.usage().then((u) => alive && setUsage(u)), POLL_MS)
    return () => {
      alive = false
      clearInterval(timer)
    }
  }, [pending])

  const change = (patch: Partial<StorageSettings>) => {
    // Conversas com prazo menor que o dos prints: os dois ficam iguais (o processo principal faz o mesmo).
    if (settings) setSettings(withMediaCap({ ...settings, ...patch }))
    // O que dá para liberar muda com o prazo: some até a medida nova chegar.
    setUsage((u) => (u ? { ...u, freeable: null } : u))
    setResult(null)
    void window.api.storage.setSettings(patch).then(() => window.api.storage.usage().then(setUsage))
  }

  const cleanNow = async () => {
    setCleaning(true)
    try {
      setResult(await window.api.storage.clean())
      setUsage(await window.api.storage.usage())
    } catch (err) {
      console.error('[configurações] limpeza do disco:', err)
    } finally {
      setCleaning(false)
    }
  }

  const busy = cleaning || !!usage?.running
  return (
    <>
      <Group>
        <Row
          label={tr('Conversas', 'Chats')}
          description={
            usage
              ? tr(
                  `Ocupam ${formatBytes(usage.conversationsBytes, BASE)} - ${usage.conversations.toLocaleString(LOCALE)} conversas`,
                  `Take up ${formatBytes(usage.conversationsBytes, BASE)} - ${usage.conversations.toLocaleString(LOCALE)} chats`
                )
              : tr('Medindo…', 'Measuring…')
          }
          info={tr(
            'O texto, os prints e os anexos de cada conversa, guardados pelo Claude Code. Saem nos prazos abaixo.',
            'The text, screenshots and attachments of each chat, kept by Claude Code. They go after the periods below.'
          )}
        >
          {null}
        </Row>
        <Row
          label={tr('Rascunhos do agente', 'Agent scratch files')}
          description={
            usage && usage.scratchBytes !== null
              ? tr(
                  `Ocupam ${formatBytes(usage.scratchBytes, BASE)} - ${usage.scratchSessions.toLocaleString(LOCALE)} conversas`,
                  `Take up ${formatBytes(usage.scratchBytes, BASE)} - ${usage.scratchSessions.toLocaleString(LOCALE)} chats`
                )
              : tr('Medindo…', 'Measuring…')
          }
          info={tr(
            'Onde o agente trabalha: repositórios clonados, dependências instaladas, saídas de comandos e arquivos que ele cria.',
            'Where the agent works: cloned repositories, installed dependencies, command output and files it creates.'
          )}
        >
          {null}
        </Row>
      </Group>

      {settings && (
        <Group>
          <Row
            label={tr('Apagar as conversas paradas há mais de', 'Delete chats idle for more than')}
            description={tr(
              'A conversa sai inteira: texto, prints e anexos. Vale também para o claude no terminal.',
              'The whole chat goes: text, screenshots and attachments. Also applies to claude in the terminal.'
            )}
            below
          >
            <Segmented
              value={String(settings.conversationDays)}
              options={withCurrent(CONVERSATION_DAYS, settings.conversationDays).map((n) => ({ value: String(n), label: days(n) }))}
              onChange={(v) => change({ conversationDays: Number(v) })}
            />
          </Row>
          <Row
            label={tr('Apagar os rascunhos de conversas paradas há mais de', 'Delete scratch files of chats idle for more than')}
            description={tr('Os de uma conversa rodando nunca saem.', 'Those of a running chat never go.')}
            below
          >
            <Segmented
              value={String(settings.scratchDays)}
              options={SCRATCH_DAYS.map((n) => ({ value: String(n), label: days(n) }))}
              onChange={(v) => change({ scratchDays: Number(v) })}
            />
          </Row>
          <Row
            label={tr('Tirar prints e anexos das conversas paradas há mais de', 'Remove screenshots and attachments from chats idle for more than')}
            description={tr('O texto da conversa fica; no lugar fica "[imagem removida]".', 'The chat text stays; "[image removed]" takes their place.')}
            below
          >
            <Segmented
              value={String(settings.mediaDays)}
              options={withCurrent(MEDIA_DAYS, settings.mediaDays).map((n) => ({
                value: String(n),
                label: days(n),
                disabled: n > settings.conversationDays,
                title: n > settings.conversationDays ? tr('Maior que o prazo das conversas', 'Longer than the chat period') : undefined
              }))}
              onChange={(v) => change({ mediaDays: Number(v) })}
            />
          </Row>
          <Row
            label={freeableLabel(usage?.freeable ?? null)}
            info={freeableInfo(usage?.freeable ?? null, settings)}
            description={result ? resultText(result) : lastCleanText(usage?.lastClean ?? null)}
          >
            <Button onClick={() => void cleanNow()} disabled={busy || !usage?.freeable}>
              {busy ? tr('Limpando…', 'Cleaning…') : tr('Limpar agora', 'Clean up now')}
            </Button>
          </Row>
        </Group>
      )}
    </>
  )
}
