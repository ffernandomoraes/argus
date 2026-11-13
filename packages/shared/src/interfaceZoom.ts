// Tamanho da interface (Configurações > Aparência): a janela inteira cresce ou diminui junto, para
// monitores maiores ou menores. O zoom do canvas e o do drawer continuam valendo por cima.
export const INTERFACE_ZOOMS = [0.8, 0.9, 1, 1.1, 1.25, 1.5] as const;

export const isInterfaceZoom = (value: unknown): value is number => INTERFACE_ZOOMS.includes(value as (typeof INTERFACE_ZOOMS)[number]);

// Um degrau acima (1) ou abaixo (-1) do tamanho atual, parando nas pontas. Valor fora da lista
// parte do degrau mais próximo.
export function stepInterfaceZoom(zoom: number, direction: 1 | -1): number {
  let closest = 0;
  for (let i = 1; i < INTERFACE_ZOOMS.length; i++) {
    if (Math.abs(INTERFACE_ZOOMS[i] - zoom) < Math.abs(INTERFACE_ZOOMS[closest] - zoom)) closest = i;
  }
  return INTERFACE_ZOOMS[Math.min(INTERFACE_ZOOMS.length - 1, Math.max(0, closest + direction))];
}
