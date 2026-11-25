import type { ReactNode } from 'react';

// Tela vazia: ilustração do contexto, título e uma frase do que aparece ali (e, se houver, o botão
// de começar). lg nas Configurações e nas telas grandes; sm em drawer e modal estreitos.
export function EmptyState({
  art,
  title,
  text,
  size = 'lg',
  children,
}: {
  art: ReactNode
  title: string
  text?: ReactNode
  size?: 'lg' | 'sm'
  children?: ReactNode
}) {
  const lg = size === 'lg';
  return (
    <div className={`m-auto flex flex-col items-center text-center ${lg ? 'px-6 py-12' : 'px-5 py-8'}`}>
      <div className={lg ? 'w-[320px] max-w-full' : 'w-[220px] max-w-full'}>{art}</div>
      <h3 className={`font-medium text-text ${lg ? 'mt-6 text-[17px]' : 'mt-4 text-sm'}`}>{title}</h3>
      {text && (
        <p className={`mt-2 leading-relaxed text-muted ${lg ? 'max-w-[460px] text-[15px]' : 'max-w-[320px] text-xs'}`}>{text}</p>
      )}
      {children && <div className="mt-5">{children}</div>}
    </div>
  );
}
