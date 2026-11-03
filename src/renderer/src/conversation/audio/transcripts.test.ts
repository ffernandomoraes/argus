import { describe, expect, it, vi } from 'vitest'
import { transcriptsPending, type Transcript } from './transcripts'

// As preferências leem o localStorage e ouvem a janela; aqui só importa a regra do envio.
vi.mock('../../settings/preferences', () => ({ getPreferences: () => ({ audioTranscription: true }) }))

const audio = (name: string) => new File([], name, { type: 'audio/ogg' })

describe('transcriptsPending', () => {
  it('blocks sending while an attached audio has no transcript yet', () => {
    for (const status of ['asking', 'waiting', 'transcribing'] as const) {
      const file = audio('a.ogg')
      expect(transcriptsPending([file], new Map<File, Transcript>([[file, { status }]]))).toBe(true)
    }
  })

  it('lets it go once every audio is done, skipped or failed', () => {
    const done = audio('a.ogg')
    const skipped = audio('b.ogg')
    const failed = audio('c.ogg')
    const map = new Map<File, Transcript>([
      [done, { status: 'done', text: 'oi' }],
      [skipped, { status: 'skipped' }],
      [failed, { status: 'error', message: 'x' }]
    ])
    expect(transcriptsPending([done, skipped, failed], map)).toBe(false)
  })

  it('ignores files that are not being transcribed', () => {
    expect(transcriptsPending([new File([], 'notes.txt')], new Map())).toBe(false)
  })
})
