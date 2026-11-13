// Acesso remoto: uma janela do Argus deste computador mostra e controla o Argus de outro (o "de
// casa"), onde ficam os projetos, as conversas e os terminais. Ver src/main/remote.

// O computador do outro lado, contado a quem conecta: a janela remota usa o sistema e a pasta
// pessoal de lá (os caminhos são de lá).
export type RemoteHostInfo = {
  name: string
  platform: string
  homeDir: string
  windowsBuild: number | null
  version: string
  // Versão do Argus de quem mostra (o notebook), posta por ele ao abrir a janela: diferente da de lá,
  // a barra avisa.
  clientVersion?: string
}

// Situação da ligação de uma janela remota: ligada, tentando de novo ou encerrada.
// kicked: o outro computador desconectou esta janela de propósito.
export type RemoteConnectionState = 'connected' | 'reconnecting' | 'closed' | 'kicked'

// Argumento da linha de comando com que a janela remota abre: o preload lê antes do primeiro
// desenho (o window.api já nasce com o sistema e a pasta pessoal de lá).
export const REMOTE_ARG = '--argus-remote='
// Configurações > Acesso remoto.
export type RemoteRelayStatus = 'connecting' | 'online' | 'offline'

// web: o app do celular, pelo navegador (os outros são Argus instalados).
export type RemoteDevice = { id: string; name: string; pairedAt: number; lastSeen: number | null; connected: boolean; web: boolean }
export type RemoteKnownHost = { hostId: string; name: string; pairedAt: number; open: boolean }

export type RemoteAccessState = {
  // Este computador aceita aparelhos pareados (o "de casa").
  hosting: boolean
  // O sistema não dorme enquanto hospeda.
  keepAwake: boolean
  relay: RemoteRelayStatus
  // Nome deste computador, como os outros o veem.
  name: string
  devices: RemoteDevice[]
  // Código à vista esperando o outro computador digitar; some ao parear, cancelar ou vencer.
  // url: o app do celular já com o código, para o QR code.
  pairing: { code: string; url: string; expiresAt: number } | null
  // Como terminou o último pareamento (aparelho novo ou o erro).
  pairingResult: { ok: true; name: string } | { ok: false; error: string } | null
  // Computadores que este pode abrir.
  hosts: RemoteKnownHost[]
}

export type RemotePairResult = { ok: true; hostId: string; name: string } | { ok: false; error: string }

// "Abrir localhost" pela janela de acesso remoto: a porta deste computador que leva à do outro (a
// mesma, se estava livre aqui).
export type RemoteLocalhostResult = { ok: true; port: number } | { ok: false; error: string }
