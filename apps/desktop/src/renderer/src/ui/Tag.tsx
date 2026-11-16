import type { LucideIcon } from 'lucide-react';

// Etiqueta pequena na frente de um nome (Workspace, Worktree): ícone e texto na cor
// do tom, num fundo tingido dela, em pílula e caixa alta, no mesmo formato da "Desenvolvimento" da
// barra de título. A cor se mistura com a do texto em volta: na linha selecionada (fundo de
// destaque, texto branco) a etiqueta clareia e continua legível.
const TONES = {
  info: 'var(--color-accent)',
};

// Sem ícone, só o texto (Grupo).
export function Tag({ icon: Icon, tone, children }: { icon?: LucideIcon; tone: keyof typeof TONES; children: string }) {
  return (
    <span
      style={{ '--tag': TONES[tone] } as React.CSSProperties}
      className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[color-mix(in_srgb,var(--tag)_40%,transparent)] bg-[color-mix(in_srgb,var(--tag)_10%,transparent)] px-2 py-px text-[11px] font-medium tracking-wide text-[color-mix(in_srgb,var(--tag)_75%,currentColor)] uppercase"
    >
      {Icon && <Icon size={10} strokeWidth={2.25} aria-hidden="true" />}
      {children}
    </span>
  );
}
