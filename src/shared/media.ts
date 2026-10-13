// O que toca no sistema agora: o "Tocando agora" do Mac, a mídia do Windows, o MPRIS do Linux.
export type NowPlaying = {
  title: string
  artist: string
  playing: boolean
  // Volume de saída do sistema, de 0 a 100.
  volume: number
}

export type MediaCommand = 'toggle' | 'next' | 'previous'
