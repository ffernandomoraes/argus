// O que toca no sistema agora: o "Tocando agora" do Mac, a mídia do Windows, o MPRIS do Linux.
export type NowPlaying = {
  title: string
  artist: string
  playing: boolean
  // Se o app aceita tocar/pausar. Sem isso, a barra mostra só o nome.
  canToggle: boolean
  // Duração em segundos; 0 quando o app não informa (rádio, transmissão ao vivo).
  duration: number
  // Volume de saída do sistema, de 0 a 100.
  volume: number
}

export type MediaCommand = 'toggle' | 'next' | 'previous'
