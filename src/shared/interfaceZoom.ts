// Tamanho da interface (Configurações > Aparência): a janela inteira cresce ou diminui junto, para
// monitores maiores ou menores. O zoom do canvas e o do drawer continuam valendo por cima.
export const INTERFACE_ZOOMS = [0.8, 0.9, 1, 1.1, 1.25, 1.5] as const

export const isInterfaceZoom = (value: unknown): value is number => INTERFACE_ZOOMS.includes(value as (typeof INTERFACE_ZOOMS)[number])
