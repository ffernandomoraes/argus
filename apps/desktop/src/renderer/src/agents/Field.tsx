import type { ReactNode } from 'react';
import { FIELD_SHELL } from '../settings/fieldStyles';

// Campo de texto do agente (nome, quando usar, instruções, outras ferramentas): o das Configurações,
// com a letra menor da biblioteca.
export const INPUT = `${FIELD_SHELL} text-sm`;

// Rótulo em cima, o campo e a explicação embaixo.
export function Field({
  label,
  hint,
  className = '',
  children,
}: {
  label: string
  hint?: string
  className?: string
  children: ReactNode
}) {
  return (
    <label className={`flex flex-col gap-1.5 ${className}`}>
      <span className="text-xs font-medium text-text">{label}</span>
      {children}
      {hint && <span className="text-[12px] leading-snug text-faint">{hint}</span>}
    </label>
  );
}
