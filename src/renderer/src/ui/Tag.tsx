import type { LucideIcon } from 'lucide-react'

// Etiqueta pequena na frente de um nome (Workspace, Worktree): ícone e texto na cor
// do tom, num fundo tingido dela, com o canto de 4px. A cor se mistura com a do texto em volta: na
// linha selecionada (fundo de destaque, texto branco) a etiqueta clareia e continua legível. O
// respiro de cima e de baixo, somado à entrelinha, fica igual ao dos lados.
const TONES = {
  info: 'var(--color-accent)'
}

// Sem ícone, só o texto (Grupo).
export function Tag({ icon: Icon, tone, children }: { icon?: LucideIcon; tone: keyof typeof TONES; children: string }) {
  return (
    <span
      style={{ '--tag': TONES[tone] } as React.CSSProperties}
      className="inline-flex shrink-0 items-center gap-1 rounded-[4px] bg-[color-mix(in_srgb,var(--tag)_16%,transparent)] px-1.5 py-[3px] text-[10px] font-medium leading-[12px] text-[color-mix(in_srgb,var(--tag)_75%,currentColor)] ring-1 ring-[color-mix(in_srgb,var(--tag)_28%,transparent)] ring-inset"
    >
      {Icon && <Icon size={10} strokeWidth={2.25} aria-hidden="true" />}
      {children}
    </span>
  )
}
