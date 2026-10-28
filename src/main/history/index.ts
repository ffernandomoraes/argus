import type { HistoryPage, HistoryRequest, Message } from '../../shared/history'
import { parseLine } from '../transcripts/line'
import { sessionFile } from '../transcripts/projectDir'
import { readSlice } from '../transcripts/read'
import { loadTranscript } from './cache'
import { imagesOf } from './images'
import { subagentFile } from './subagentFile'

// Histórico de uma sessão, na ordem em que aconteceu. Raciocínio (thinking) e subagentes ficam de fora.
export async function readHistory(projectPath: string, sessionId: string): Promise<Message[]> {
  const file = sessionFile(projectPath, sessionId)
  const transcript = file ? await loadTranscript(file) : null
  return transcript ? transcript.history.messages() : []
}

// O trecho do fim do histórico que a conversa mostra (ver HistoryRequest): abre com as últimas e
// carrega as anteriores conforme você rola para cima.
export async function readHistoryPage(projectPath: string, sessionId: string, request: HistoryRequest): Promise<HistoryPage> {
  const file = sessionFile(projectPath, sessionId)
  const transcript = file ? await loadTranscript(file, request) : null
  return transcript ? transcript.history.page(request) : { messages: [], more: false }
}

// O mesmo trecho, do histórico de um subagente: o que ele recebeu, pensou, fez e entregou. Ainda
// sem arquivo (acabou de ser lançado), vazio.
export async function readSubagentPage(projectPath: string, sessionId: string, toolUseId: string, request: HistoryRequest): Promise<HistoryPage> {
  const file = await subagentFile(projectPath, sessionId, toolUseId)
  const transcript = file ? await loadTranscript(file, request, true) : null
  return transcript ? transcript.history.page(request) : { messages: [], more: false }
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
