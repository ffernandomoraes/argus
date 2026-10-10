// Como os menus do macOS: fundo levemente translúcido e o item sob o mouse na cor de destaque.
export const MENU_PANEL = 'rounded-xl border border-line bg-surface/90 p-1 shadow-2xl shadow-black/50 backdrop-blur-xl'
export const MENU_ROW = 'flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-xs'
// Item de lista rica (com descrição e ícones) sob o mouse ou escolhido pelo teclado: tudo dentro
// fica branco sobre a cor de destaque.
export const MENU_HOVER = 'hover:bg-accent hover:text-white [&:hover_span]:text-white [&:hover_svg]:text-white'
export const MENU_ACTIVE = 'bg-accent text-white [&_span]:text-white [&_svg]:text-white'
