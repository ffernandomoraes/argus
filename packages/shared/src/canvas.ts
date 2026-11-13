// Câmera de uma janela do canvas: cada janela olha para um pedaço do mesmo canvas.
export type CanvasViewport = { x: number; y: number; zoom: number }

// Workspace: um canvas separado, com nome (na interface, "Workspace"; no código, board). Fechado:
// fora do menu, com o canvas guardado e os terminais rodando, até reabrir ou excluir.
export type BoardEntry = { id: string; name: string; closed?: boolean }

// O que o menu de workspaces precisa de cada um sem abrir o canvas dele: as pastas e as conversas
// postas soltas, para mostrar se alguma está trabalhando ou esperando você.
export type BoardSummary = BoardEntry & { paths: string[]; sessions: string[] }

// Workspaces e o que esta janela mostra.
export type BoardsState = { boards: BoardSummary[]; current: string }
