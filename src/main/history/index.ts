import type { Message } from '../../shared/history'
import { parseLine } from '../transcripts/line'
import { sessionFile } from '../transcripts/projectDir'
import { readSlice } from '../transcripts/read'
import { loadTranscript } from './cache'
import { imagesOf } from './images'

// Histórico de uma sessão, na ordem em que aconteceu. Raciocínio (thinking) e subagentes ficam de fora.
export async function readHistory(projectPath: string, sessionId: string): Promise<Message[]> {
  const file = sessionFile(projectPath, sessionId)
  const transcript = file ? await loadTranscript(file) : null
  return transcript ? transcript.history.messages() : []
}

// Imagens enviadas numa mensagem sua, prontas para o <img>. O histórico só conta quantas são:
// elas pesam e só são lidas quando alguém abre o preview, e só a linha delas.
export async function readImages(projectPath: string, sessionId: string, messageId: string): Promise<string[]> {
  const file = sessionFile(projectPath, sessionId)
  const transcript = file ? await loadTranscript(file) : null
  const at = transcript?.images.find(messageId)
  if (!file || !at) return []
  try {
    const line = parseLine(await readSlice(file, at.start, at.end - at.start))
    return line?.uuid === messageId ? imagesOf(line) : []
  } catch {
    return []
  }
}
