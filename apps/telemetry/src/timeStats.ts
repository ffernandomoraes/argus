// Média, mediana e máximo do tempo de uso por instalação num dia (o painel mostra os três: a média
// sozinha esconde quem usa o dia inteiro e quem abre só de passagem).

export type TimeStats = {
  // Dias de instalação com algum uso (cada instalação conta uma vez por dia).
  samples: number
  avg: number
  median: number
  max: number
};

export function timeStats(values: number[]): TimeStats {
  const used = values.filter((v) => v > 0).sort((a, b) => a - b);
  const samples = used.length;
  if (!samples) return { samples: 0, avg: 0, median: 0, max: 0 };
  const mid = Math.floor(samples / 2);
  const median = samples % 2 ? used[mid] : (used[mid - 1] + used[mid]) / 2;
  const avg = used.reduce((a, b) => a + b, 0) / samples;
  return { samples, avg, median, max: used[samples - 1] };
}
